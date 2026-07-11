const PDFDocument = require('pdfkit');

function generateReceiptPdf(order) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const pageWidth = 495;
  const leftMargin = 50;

  function centerText(text, size, options = {}) {
    doc.fontSize(size).text(text, leftMargin, doc.y, { align: 'center', width: pageWidth, ...options });
  }

  // ── Header ──
  doc.fontSize(24).font('Helvetica-Bold').text('TAX INVOICE', leftMargin, doc.y, { align: 'center', width: pageWidth });
  doc.moveDown(0.3);

  // Cafe name / address block
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#333333');
  centerText('ODDO CAFE', 16);
  doc.fontSize(9).font('Helvetica').fillColor('#666666');
  centerText('123, Cafe Street, Foodville - 600001', 9);
  centerText('GSTIN: 33ABCDE1234F1Z5 | Phone: +91 98765 43210', 9);
  centerText('Email: hello@odoo.cafe', 9);

  doc.moveDown(1);

  // Separator line
  doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.8);

  // ── Invoice Details ──
  doc.fontSize(9).font('Helvetica').fillColor('#333333');
  const invoiceY = doc.y;
  doc.text(`Invoice No: ${order.order_number}`, leftMargin, invoiceY);
  doc.text(`Date: ${new Date(order.createdAt || order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, leftMargin, invoiceY, { align: 'right', width: pageWidth });

  if (order.table_number) {
    doc.text(`Table: ${order.table_number}`, leftMargin, doc.y + 14);
  } else {
    doc.text('Order Type: Take Away', leftMargin, doc.y + 14);
  }

  doc.moveDown(2);

  // ── Items Table Header ──
  const tableTop = doc.y;
  const col1 = leftMargin;              // #
  const col2 = leftMargin + 30;         // Item
  const col3 = leftMargin + 280;        // Qty
  const col4 = leftMargin + 330;        // Rate
  const col5 = leftMargin + 410;        // Amount

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
  doc.roundedRect(leftMargin, tableTop, pageWidth, 18, 3).fill('#333333');
  doc.fillColor('#ffffff');
  doc.text('#', col1 + 8, tableTop + 4);
  doc.text('Item', col2 + 8, tableTop + 4);
  doc.text('Qty', col3 + 8, tableTop + 4, { width: 40, align: 'center' });
  doc.text('Rate', col4 + 8, tableTop + 4, { width: 60, align: 'right' });
  doc.text('Amount', col5 + 8, tableTop + 4, { width: 70, align: 'right' });

  doc.fillColor('#333333');

  // ── Items ──
  let itemY = tableTop + 22;
  const items = order.items || [];

  items.forEach((item, i) => {
    if (i % 2 === 0) {
      doc.rect(leftMargin, itemY - 2, pageWidth, 18).fill('#f9f9f9');
    }

    const qty = item.quantity || 0;
    const rate = parseFloat(item.unit_price || 0);
    const amount = parseFloat(item.line_total || (qty * rate));

    doc.fontSize(9).font('Helvetica').fillColor('#333333');
    doc.text(String(i + 1), col1 + 8, itemY);
    doc.text(item.name || 'Unknown', col2 + 8, itemY, { width: 240 });
    doc.text(String(qty), col3 + 8, itemY, { width: 40, align: 'center' });
    doc.text(`₹${rate.toFixed(2)}`, col4 + 8, itemY, { width: 60, align: 'right' });
    doc.text(`₹${amount.toFixed(2)}`, col5 + 8, itemY, { width: 70, align: 'right' });

    itemY += 18;
  });

  // ── Totals ──
  doc.moveDown(1);
  const totalsY = Math.max(itemY + 8, doc.y + 8);

  const subtotal = parseFloat(order.subtotal || 0);
  const tax = parseFloat(order.tax || 0);
  const discount = parseFloat(order.discount || 0);
  const total = parseFloat(order.total || 0);

  // Draw totals box
  const totalsX = leftMargin + 280;
  const totalsWidth = pageWidth - 280;

  doc.roundedRect(totalsX, totalsY, totalsWidth, discount > 0 ? 72 : 54, 3).stroke('#cccccc');

  let ty = totalsY + 6;
  doc.fontSize(9).font('Helvetica');
  doc.text('Subtotal:', totalsX + 8, ty, { width: 80 });
  doc.text(`₹${subtotal.toFixed(2)}`, totalsX + totalsWidth - 70, ty, { width: 60, align: 'right' });

  ty += 16;
  doc.text('Tax (5%):', totalsX + 8, ty, { width: 80 });
  doc.text(`₹${tax.toFixed(2)}`, totalsX + totalsWidth - 70, ty, { width: 60, align: 'right' });

  if (discount > 0) {
    ty += 16;
    doc.text('Discount:', totalsX + 8, ty, { width: 80 });
    doc.fillColor('#e74c3c');
    doc.text(`-₹${discount.toFixed(2)}`, totalsX + totalsWidth - 70, ty, { width: 60, align: 'right' });
    doc.fillColor('#333333');
  }

  ty += 16;
  doc.roundedRect(totalsX, ty - 2, totalsWidth, 20, 2).fill('#333333');
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff');
  doc.text('Total:', totalsX + 8, ty + 2, { width: 80 });
  doc.text(`₹${Math.max(0, total).toFixed(2)}`, totalsX + totalsWidth - 75, ty + 2, { width: 65, align: 'right' });

  // ── Payment Info ──
  doc.fillColor('#333333');
  doc.moveDown(3);
  const paymentY = doc.y + 10;
  doc.fontSize(9).font('Helvetica');
  doc.text(`Payment: ${order.payment_method || (order.payment ? order.payment.method : 'N/A')}`, leftMargin, paymentY);
  if (order.coupon_code) {
    doc.text(`Coupon: ${order.coupon_code}`, leftMargin, paymentY + 14);
  }

  // ── Footer ──
  doc.moveDown(4);
  doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.5);
  doc.fontSize(8).font('Helvetica').fillColor('#999999');
  centerText('Thank you for your visit!', 8);
  centerText('This is a computer-generated invoice.', 8);

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

module.exports = { generateReceiptPdf };
