import { useState, useEffect } from 'react';
import { ShoppingBag, Users, Receipt, DollarSign, Clock } from 'lucide-react';
import { getDashboard } from '../api/reports';
import { getOrders } from '../api/orders';
import { getProducts } from '../api/products';
import { getCustomers } from '../api/customers';
import { getActiveSession } from '../api/sessions';
import StatusBadge from '../components/StatusBadge';
import { useNavigate } from 'react-router-dom';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-bg-app border border-border rounded-md p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-md ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
        <div>
          <p className="text-caption text-text-secondary">{label}</p>
          <p className="text-h2 text-text-primary">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [session, setSession] = useState(null);
  const [productCount, setProductCount] = useState(null);
  const [customerCount, setCustomerCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      getDashboard({ period: 'today' }),
      getOrders({ page_size: 5, sort_by: 'created_at', sort_dir: 'desc' }),
      getActiveSession().catch(() => null),
      getProducts({ page_size: 1 }),
      getCustomers({ page_size: 1 }),
    ])
      .then(([dash, orders, sess, prodRes, custRes]) => {
        setDashboard(dash.data.data);
        setRecentOrders(orders.data.data || []);
        setSession(sess?.data?.data || null);
        setProductCount(prodRes.data.meta?.total_count ?? '—');
        setCustomerCount(custRes.data.meta?.total_count ?? '—');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const summary = dashboard?.summary || {};
  const stats = [
    { icon: Receipt, label: 'Total orders', value: summary.total_orders ?? '—', color: 'bg-accent' },
    { icon: DollarSign, label: 'Revenue', value: summary.revenue ? `₹${Number(summary.revenue).toFixed(2)}` : '—', color: 'bg-success' },
    { icon: ShoppingBag, label: 'Products', value: productCount ?? '—', color: 'bg-info' },
    { icon: Users, label: 'Customers', value: customerCount ?? '—', color: 'bg-[#8E7DBE]' },
  ];

  return (
    <div className="space-y-6 max-w-[1280px]">
      <h1 className="text-display text-text-primary">Dashboard</h1>

      {session && (
        <div className="flex items-center gap-3 bg-accent-soft/30 border border-accent/30 rounded-md p-3">
          <Clock size={20} className="text-accent" />
          <span className="text-body text-text-primary">
            Active session since {new Date(session.opened_at).toLocaleString()}
          </span>
          <StatusBadge status="open" label="Open" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="bg-bg-app border border-border rounded-md shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-h2 text-text-primary">Recent orders</h2>
          <button onClick={() => navigate('/orders')} className="text-caption text-accent hover:text-accent-hover">View all</button>
        </div>
        {recentOrders.length === 0 ? (
          <div className="text-center py-10 text-text-secondary text-body">No orders yet</div>
        ) : (
          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="flex items-center justify-between px-4 py-3 hover:bg-bg-subtle cursor-pointer"
              >
                <div>
                  <p className="text-body-strong text-text-primary">#{order.order_number}</p>
                  <p className="text-caption text-text-secondary">
                    {order.table ? `Table ${order.table.table_number}` : 'Takeaway'} · {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-price text-text-primary">₹{Number(order.total).toFixed(2)}</p>
                  <StatusBadge status={order.status} label={order.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
