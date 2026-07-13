const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { sendSuccess } = require('../utils/response');
const { db } = require('../db');
const { orders, orderLines, products, categories, payments, sessions, users, tables } = require('../db/schema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const router = Router();
router.use(authenticate);

function getDateRange(period, from, to) {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let start, end;

  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = endOfDay;
      break;
    case 'this_week': {
      const day = now.getDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      end = endOfDay;
      break;
    }
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = endOfDay;
      break;
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1);
      end = endOfDay;
      break;
    case 'custom':
      start = from ? new Date(from) : new Date(0);
      end = to ? new Date(to) : endOfDay;
      break;
    default:
      start = new Date(0);
      end = endOfDay;
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

function getPreviousRange(period, from, to) {
  const now = new Date();
  const { start, end } = getDateRange(period, from, to);
  const currentStart = new Date(start);
  const currentEnd = new Date(end);
  const duration = currentEnd.getTime() - currentStart.getTime();

  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration);

  return { start: prevStart.toISOString(), end: prevEnd.toISOString() };
}

async function getOrderStats(start, end, extraFilter = {}) {
  const filter = {
    createdAt: { $gte: start, $lte: end },
    status: 'paid',
    ...extraFilter,
  };

  const cursor = await db.collection(orders.tableName).find(filter);
  const paidOrders = await cursor.sort({ createdAt: 1 }).toArray();

  let totalOrders = paidOrders.length;
  let revenue = 0;
  let taxCollected = 0;
  let discountGiven = 0;
  let subtotalSum = 0;
  let dineInCount = 0;
  let takeawayCount = 0;

  for (const o of paidOrders) {
    revenue += parseFloat(o.total);
    taxCollected += parseFloat(o.tax);
    discountGiven += parseFloat(o.discount);
    subtotalSum += parseFloat(o.subtotal);
    if (o.tableId) dineInCount++;
    else takeawayCount++;
  }

  const avgOrderValue = totalOrders > 0 ? (revenue / totalOrders).toFixed(2) : '0.00';

  return { paidOrders, totalOrders, revenue, taxCollected, discountGiven, subtotalSum, dineInCount, takeawayCount, avgOrderValue };
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const { period, from, to, employee_id, session_id } = req.query;
    const { start, end } = getDateRange(period || 'this_week', from, to);

    const extraFilter = {};
    if (employee_id) extraFilter.employeeId = employee_id;
    if (session_id) extraFilter.sessionId = session_id;

    const {
      paidOrders, totalOrders, revenue, taxCollected, discountGiven, subtotalSum,
      dineInCount, takeawayCount, avgOrderValue,
    } = await getOrderStats(start, end, extraFilter);

    const salesByDate = {};
    for (const o of paidOrders) {
      const date = o.createdAt.slice(0, 10);
      salesByDate[date] = salesByDate[date] || { revenue: 0, count: 0 };
      salesByDate[date].revenue += parseFloat(o.total);
      salesByDate[date].count += 1;
    }
    const salesTrend = Object.entries(salesByDate).map(([date, vals]) => ({
      date, revenue: vals.revenue.toFixed(2), order_count: vals.count,
    }));

    const categoryRevenue = {};
    for (const o of paidOrders) {
      const linesCursor = await db.collection(orderLines.tableName).find({ orderId: o.id });
      const lines = await linesCursor.toArray();
      for (const line of lines) {
        const p = await db.collection(products.tableName).findOne({ id: line.productId });
        if (p && p.categoryId) {
          const cat = await db.collection(categories.tableName).findOne({ id: p.categoryId });
          const catName = cat ? cat.name : 'Uncategorized';
          categoryRevenue[catName] = (categoryRevenue[catName] || 0) + parseFloat(line.lineTotal);
        }
      }
    }
    const maxCatRev = Math.max(...Object.values(categoryRevenue), 1);
    const topCategoriesChart = Object.entries(categoryRevenue).map(([category, rev]) => ({
      category, revenue: rev.toFixed(2), percent: ((rev / maxCatRev) * 100).toFixed(1),
    }));

    const productSales = {};
    for (const o of paidOrders) {
      const linesCursor = await db.collection(orderLines.tableName).find({ orderId: o.id });
      const lines = await linesCursor.toArray();
      for (const line of lines) {
        const p = await db.collection(products.tableName).findOne({ id: line.productId });
        const name = p ? p.name : 'Unknown';
        productSales[name] = productSales[name] || { qty: 0, rev: 0 };
        productSales[name].qty += line.quantity;
        productSales[name].rev += parseFloat(line.lineTotal);
      }
    }
    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1].rev - a[1].rev)
      .slice(0, 10)
      .map(([name, vals]) => ({ product_name: name, quantity_sold: vals.qty, revenue: vals.rev.toFixed(2) }));

    const topOrders = paidOrders
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
      .slice(0, 5)
      .map((o) => ({
        order_number: o.orderNumber, customer: null, total: o.total, date: o.createdAt,
      }));

    const topCategoriesTable = topCategoriesChart.map((c) => ({ category: c.category, revenue: c.revenue }));

    // Payment breakdown
    const paymentBreakdown = {};
    for (const o of paidOrders) {
      const paysCursor = await db.collection(payments.tableName).find({ orderId: o.id });
      const pays = await paysCursor.toArray();
      for (const p of pays) {
        if (p.status === 'confirmed') {
          paymentBreakdown[p.method] = paymentBreakdown[p.method] || { amount: 0, count: 0 };
          paymentBreakdown[p.method].amount += parseFloat(p.amount);
          paymentBreakdown[p.method].count += 1;
        }
      }
    }
    const paymentMethodsArray = Object.entries(paymentBreakdown).map(([method, vals]) => ({
      method, amount: vals.amount.toFixed(2), count: vals.count,
    }));

    // Hourly distribution
    const hourlyData = {};
    for (const o of paidOrders) {
      const hour = new Date(o.createdAt).getHours();
      hourlyData[hour] = hourlyData[hour] || { revenue: 0, count: 0 };
      hourlyData[hour].revenue += parseFloat(o.total);
      hourlyData[hour].count += 1;
    }
    const hourlyTrend = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      revenue: (hourlyData[i]?.revenue || 0).toFixed(2),
      count: hourlyData[i]?.count || 0,
    }));

    // Employee performance
    const employeeMap = {};
    for (const o of paidOrders) {
      if (o.employeeId) {
        employeeMap[o.employeeId] = employeeMap[o.employeeId] || { order_count: 0, revenue: 0 };
        employeeMap[o.employeeId].order_count += 1;
        employeeMap[o.employeeId].revenue += parseFloat(o.total);
      }
    }
    const employeePerformance = [];
    for (const [empId, vals] of Object.entries(employeeMap)) {
      const emp = await db.collection(users.tableName).findOne({ id: empId });
      employeePerformance.push({
        name: emp ? emp.name : 'Unknown',
        order_count: vals.order_count,
        revenue: vals.revenue.toFixed(2),
      });
    }
    employeePerformance.sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue));

    // Period comparison
    const { start: prevStart, end: prevEnd } = getPreviousRange(period || 'this_week', from, to);
    const prevStats = await getOrderStats(prevStart, prevEnd);
    const comparison = {
      revenue: {
        current: revenue.toFixed(2),
        previous: prevStats.revenue.toFixed(2),
        change: prevStats.revenue > 0 ? (((revenue - prevStats.revenue) / prevStats.revenue) * 100).toFixed(1) : null,
      },
      orders: {
        current: totalOrders,
        previous: prevStats.totalOrders,
        change: prevStats.totalOrders > 0 ? (((totalOrders - prevStats.totalOrders) / prevStats.totalOrders) * 100).toFixed(1) : null,
      },
      average_order_value: {
        current: avgOrderValue,
        previous: prevStats.avgOrderValue,
        change: parseFloat(prevStats.avgOrderValue) > 0 ? (((parseFloat(avgOrderValue) - parseFloat(prevStats.avgOrderValue)) / parseFloat(prevStats.avgOrderValue)) * 100).toFixed(1) : null,
      },
    };

    // Customer count
    const customerIds = new Set(paidOrders.filter((o) => o.customerId).map((o) => o.customerId));

    sendSuccess(res, {
      period: period || 'this_week',
      summary: {
        total_orders: totalOrders,
        revenue: revenue.toFixed(2),
        average_order_value: avgOrderValue,
        tax_collected: taxCollected.toFixed(2),
        discount_given: discountGiven.toFixed(2),
        subtotal: subtotalSum.toFixed(2),
        dine_in_count: dineInCount,
        takeaway_count: takeawayCount,
        customer_count: customerIds.size,
      },
      sales_trend: salesTrend,
      top_categories_chart: topCategoriesChart,
      top_orders: topOrders,
      top_products: topProducts,
      top_categories_table: topCategoriesTable,
      payment_breakdown: paymentMethodsArray,
      hourly_trend: hourlyTrend,
      employee_performance: employeePerformance,
      comparison,
    });
  } catch (err) { next(err); }
});

router.post('/export', async (req, res, next) => {
  try {
    const { format, period, from, to, employee_id, session_id } = req.body;

    const { start, end } = getDateRange(period || 'this_month', from, to);
    const filter = {
      createdAt: { $gte: start, $lte: end },
      status: 'paid',
    };
    if (employee_id) filter.employeeId = employee_id;
    if (session_id) filter.sessionId = session_id;

    const cursor = await db.collection(orders.tableName).find(filter);
    const paidOrders = await cursor.sort({ createdAt: 1 }).toArray();

    const fileName = `sales-report-${Date.now()}`;

    if (format === 'xls') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sales Report');

      sheet.columns = [
        { header: 'Order #', key: 'order_number', width: 15 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Subtotal', key: 'subtotal', width: 12 },
        { header: 'Tax', key: 'tax', width: 10 },
        { header: 'Discount', key: 'discount', width: 10 },
        { header: 'Total', key: 'total', width: 12 },
        { header: 'Date', key: 'created_at', width: 25 },
      ];

      for (const o of paidOrders) {
        sheet.addRow({
          order_number: o.orderNumber, status: o.status, subtotal: o.subtotal,
          tax: o.tax, discount: o.discount, total: o.total, created_at: o.createdAt,
        });
      }

      const buf = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
      return res.send(Buffer.from(buf));
    }

    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    doc.fontSize(20).text('Sales Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Period: ${period || 'this_month'}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(10).text('Orders', { underline: true });
    doc.moveDown(0.5);

    let total = 0;
    for (const o of paidOrders) {
      doc.text(`${o.orderNumber.padEnd(15)} ₹${parseFloat(o.total).toFixed(2).padStart(10)}  ${o.createdAt.slice(0, 10)}`, { lineGap: 2 });
      total += parseFloat(o.total);
    }
    doc.moveDown();
    doc.fontSize(14).text(`Total Revenue: ₹${total.toFixed(2)}`, { align: 'right' });

    doc.end();

    await new Promise((resolve) => doc.on('end', resolve));

    const pdfBuf = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
    return res.send(pdfBuf);
  } catch (err) { next(err); }
});

module.exports = router;
