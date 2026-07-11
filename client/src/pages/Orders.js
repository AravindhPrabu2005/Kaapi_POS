import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getOrders } from '../api/orders';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function Orders() {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const params = { page, page_size: 20, sort_by: 'created_at', sort_dir: 'desc' };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    getOrders(params)
      .then(({ data: res }) => { setData(res.data); setMeta(res.meta); })
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const columns = [
    { key: 'order_number', label: 'Order #', render: (row) => <span className="text-body-strong">#{row.order_number}</span> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} label={row.status === 'draft' ? 'Draft' : row.status === 'paid' ? 'Paid' : row.status === 'cancelled' ? 'Cancelled' : row.status} /> },
    { key: 'table', label: 'Table', render: (row) => row.table?.table_number ? `Table ${row.table.table_number}` : 'Takeaway' },
    { key: 'payment', label: 'Payment', render: (row) =>
      row.payment?.method
        ? <span className="capitalize">{row.payment.method}</span>
        : <span className="text-text-disabled">—</span>
    },
    { key: 'discount', label: 'Discount', render: (row) =>
      Number(row.discount) > 0
        ? <span className="text-success">-₹{Number(row.discount).toFixed(2)}</span>
        : <span className="text-text-disabled">—</span>
    },
    { key: 'total', label: 'Total', render: (row) => `₹${Number(row.total).toFixed(2)}` },
    { key: 'created_at', label: 'Date', render: (row) => new Date(row.created_at).toLocaleDateString() },
  ];

  return (
    <div className="max-w-[1280px]">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-display text-text-primary">Orders</h1>
        <button onClick={() => navigate('/orders/new')} className="flex items-center gap-2 bg-accent text-accent-on rounded-md px-4 py-2.5 text-body-strong hover:bg-accent-hover">
          <Plus size={18} /> New order
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by order number..."
            className="w-full border border-border rounded-sm pl-9 pr-8 py-2 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
              <X size={16} />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={handleStatusChange}
          className="border border-border rounded-sm px-3 py-2 text-body bg-bg-app focus:outline-none focus:border-accent"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-bg-app border border-border rounded-md shadow-sm">
        <DataTable
          columns={columns}
          data={data}
          meta={meta}
          onPageChange={setPage}
          loading={loading}
          onRowClick={(row) => navigate(`/orders/${row.id}`)}
          emptyMessage="No orders match your search"
        />
      </div>
    </div>
  );
}
