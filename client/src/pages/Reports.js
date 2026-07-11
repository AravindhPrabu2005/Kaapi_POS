import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, Receipt, ShoppingBag, Users, TrendingUp, Download,
  Clock, Sun, Coffee,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getDashboard, exportReport } from '../api/reports';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

function formatCurrency(val) {
  return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ChangeBadge({ value }) {
  if (value === null || value === undefined) return null;
  const isUp = parseFloat(value) >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-caption font-semibold ${isUp ? 'text-success' : 'text-danger'}`}>
      <TrendingUp size={12} className={isUp ? '' : 'rotate-180'} />
      {Math.abs(parseFloat(value)).toFixed(1)}%
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, change, color }) {
  return (
    <div className="bg-bg-app border border-border rounded-md p-3 shadow-sm min-w-0">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-md shrink-0 ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
        <div className="min-w-0 overflow-hidden">
          <p className="text-caption text-text-secondary truncate">{label}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-price text-text-primary truncate">{value}</p>
            {change !== undefined && <ChangeBadge value={change} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = '', isEmpty = false }) {
  return (
    <div className={`bg-bg-app border border-border rounded-md shadow-sm ${className}`}>
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-h2 text-text-primary">{title}</h3>
        {subtitle && <p className="text-caption text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-4">
        {isEmpty ? (
          <div className="flex items-center justify-center h-[260px] text-text-secondary text-body">
            No data available for this period
          </div>
        ) : children}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-app border border-border rounded-md shadow-md px-3 py-2 text-caption">
      <p className="text-text-secondary mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-semibold">
          {entry.name}: {entry.name === 'Revenue' || entry.name?.includes('Revenue') ? formatCurrency(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

export default function Reports() {
  const [period, setPeriod] = useState('this_week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [compare, setCompare] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = { period };
    if (period === 'custom') {
      if (customFrom) params.from = customFrom;
      if (customTo) params.to = customTo;
    }
    getDashboard(params)
      .then((res) => {
        setData(res.data.data);
      })
      .catch(() => toast.error('Failed to load reports'))
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const params = { period, format };
      if (period === 'custom') {
        if (customFrom) params.from = customFrom;
        if (customTo) params.to = customTo;
      }
      const res = await exportReport(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-report.${format === 'xls' ? 'xlsx' : 'pdf'}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} exported`);
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const summary = data?.summary || {};
  const comparison = data?.comparison || {};
  const showCompare = compare && comparison.revenue;

  const stats = [
    { icon: DollarSign, label: 'Revenue', value: formatCurrency(summary.revenue), change: showCompare ? comparison.revenue?.change : undefined, color: 'bg-success' },
    { icon: Receipt, label: 'Orders', value: summary.total_orders ?? '—', change: showCompare ? comparison.orders?.change : undefined, color: 'bg-accent' },
    { icon: ShoppingBag, label: 'Avg. Order Value', value: formatCurrency(summary.average_order_value), change: showCompare ? comparison.average_order_value?.change : undefined, color: 'bg-info' },
    { icon: Users, label: 'Customers', value: summary.customer_count ?? '—', color: 'bg-[#8E7DBE]' },
    { icon: Coffee, label: 'Dine-in', value: summary.dine_in_count ?? '—', color: 'bg-[#F4A261]' },
    { icon: Sun, label: 'Takeaway', value: summary.takeaway_count ?? '—', color: 'bg-[#D9A23B]' },
    { icon: Clock, label: 'Tax Collected', value: formatCurrency(summary.tax_collected), color: 'bg-[#D1564B]' },
  ];

  return (
    <div className="space-y-6 max-w-[1440px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-display text-text-primary">Reports</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="flex items-center gap-2 border border-border rounded-md px-3 py-2 text-body-strong text-text-primary hover:bg-bg-subtle disabled:opacity-50"
          >
            <Download size={16} /> PDF
          </button>
          <button
            onClick={() => handleExport('xls')}
            disabled={exporting}
            className="flex items-center gap-2 border border-border rounded-md px-3 py-2 text-body-strong text-text-primary hover:bg-bg-subtle disabled:opacity-50"
          >
            <Download size={16} /> XLS
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-bg-app border border-border rounded-md p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-body rounded-sm transition-colors ${
                period === p.key
                  ? 'bg-accent text-accent-on font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="border border-border rounded-sm px-2 py-1.5 text-body bg-bg-app focus:outline-none focus:border-accent"
            />
            <span className="text-text-secondary">—</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="border border-border rounded-sm px-2 py-1.5 text-body bg-bg-app focus:outline-none focus:border-accent"
            />
          </div>
        )}
        <label className="flex items-center gap-2 text-body text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            className="rounded border-border accent-accent"
          />
          Compare with previous period
        </label>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {stats.map((s) => <MetricCard key={s.label} {...s} />)}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <ChartCard title="Sales Trend" subtitle="Revenue over time" isEmpty={!(data?.sales_trend?.length)}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data?.sales_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D8" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B6258' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6B6258' }} tickLine={false} tickFormatter={(v) => `₹${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#E8998D" strokeWidth={2} dot={{ r: 3, fill: '#E8998D' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top Products */}
        <ChartCard title="Top Products" subtitle="Best selling products by revenue" isEmpty={!(data?.top_products?.length)}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={(data?.top_products || []).slice(0, 8)}
              layout="vertical"
              margin={{ left: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#6B6258' }} tickFormatter={(v) => `₹${v}`} />
              <YAxis dataKey="product_name" type="category" tick={{ fontSize: 11, fill: '#6B6258' }} tickLine={false} width={120} />
              <Tooltip content={<CustomTooltip />} formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="revenue" name="Revenue" fill="#E8998D" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Hourly Sales */}
        <ChartCard title="Hourly Sales" subtitle="Revenue distribution by hour" isEmpty={!data?.hourly_trend || data.hourly_trend.every(h => h.count === 0)}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.hourly_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D8" />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#6B6258' }} tickFormatter={(h) => `${h}:00`} />
              <YAxis tick={{ fontSize: 11, fill: '#6B6258' }} tickFormatter={(v) => `₹${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue" fill="#5B8AB8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Employee Performance */}
        <ChartCard title="Employee Performance" subtitle="Revenue generated per employee" isEmpty={!(data?.employee_performance?.length)}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data?.employee_performance || []}
              layout="vertical"
              margin={{ left: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#6B6258' }} tickFormatter={(v) => `₹${v}`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#6B6258' }} tickLine={false} width={100} />
              <Tooltip content={<CustomTooltip />} formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="revenue" name="Revenue" fill="#4F9D6E" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top Orders Table */}
      <div className="bg-bg-app border border-border rounded-md shadow-sm">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-h2 text-text-primary">Top Orders</h3>
        </div>
        {(!data?.top_orders || data.top_orders.length === 0) ? (
          <div className="text-center py-10 text-text-secondary text-body">No orders yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-text-secondary font-semibold text-caption uppercase tracking-wide">Order #</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-semibold text-caption uppercase tracking-wide">Total</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-semibold text-caption uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.top_orders.map((order, i) => (
                  <tr key={i} className="border-b border-border last:border-0 even:bg-bg-subtle">
                    <td className="py-3 px-4 text-text-primary font-semibold">#{order.order_number}</td>
                    <td className="py-3 px-4 text-text-primary">{formatCurrency(order.total)}</td>
                    <td className="py-3 px-4 text-text-secondary">{new Date(order.date).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
