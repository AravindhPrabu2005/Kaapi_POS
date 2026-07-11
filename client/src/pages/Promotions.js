import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPromotions, createPromotion, updatePromotion, deletePromotion } from '../api/promotions';
import { getProducts } from '../api/products';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';

export default function Promotions() {
  const [data, setData] = useState([]);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', scope: 'product', product_id: '', min_quantity: '1', min_order_amount: '0', discount_type: 'percentage', discount_value: '', valid_from: '', valid_until: '', active: true });
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = { page, page_size: 20 };
    if (search) params.search = search;
    Promise.all([getPromotions(params), getProducts({ page_size: 100 })])
      .then(([pRes, prodRes]) => { setData(pRes.data.data); setMeta(pRes.data.meta); setProducts(prodRes.data.data || []); })
      .catch(() => toast.error('Failed to load promotions'))
      .finally(() => setLoading(false));
  }, [page]);

  const openCreate = () => { setEdit(null); setForm({ name: '', scope: 'product', product_id: '', min_quantity: '1', min_order_amount: '0', discount_type: 'percentage', discount_value: '', valid_from: '', valid_until: '', active: true }); setModal(true); };
  const openEdit = (p) => {
    setEdit(p);
    setForm({
      name: p.name, scope: p.scope,
      product_id: p.product?.id || '',
      min_quantity: String(p.min_quantity || 1),
      min_order_amount: String(p.min_order_amount || 0),
      discount_type: p.discount_type === 'fixed_amount' ? 'fixed' : p.discount_type,
      discount_value: String(p.discount_value),
      valid_from: p.valid_from || '',
      valid_until: p.valid_until || '',
      active: p.active,
    });
    setModal(true);
  };

  const refreshList = () => {
    getPromotions({ page, page_size: 20 }).then(({ data }) => { setData(data.data); setMeta(data.meta); }).catch(() => {});
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    if (form.scope === 'product' && !form.product_id) { toast.error('Select a product'); return; }
    if (!form.discount_value || parseFloat(form.discount_value) <= 0) { toast.error('Enter a valid discount value'); return; }
    if (form.scope === 'product') {
      const qty = parseInt(form.min_quantity);
      if (isNaN(qty) || qty < 1) { toast.error('Enter a valid min quantity'); return; }
    }
    const payload = {
      name: form.name,
      scope: form.scope,
      discount_type: form.discount_type === 'fixed' ? 'fixed_amount' : 'percentage',
      discount_value: form.discount_value,
      active: form.active,
      ...(form.scope === 'product'
        ? { product_id: form.product_id, min_quantity: parseInt(form.min_quantity) }
        : { min_order_amount: form.min_order_amount }),
    };
    if (form.valid_from) payload.valid_from = form.valid_from;
    if (form.valid_until) payload.valid_until = form.valid_until;
    try {
      if (edit) { await updatePromotion(edit.id, payload); toast.success('Promotion updated'); }
      else { await createPromotion(payload); toast.success('Promotion created'); }
      setModal(false);
      refreshList();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Save failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this promotion?')) return;
    try { await deletePromotion(id); toast.success('Promotion deleted'); refreshList(); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Delete failed'); }
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'scope', label: 'Scope', render: (row) => <span className="text-caption bg-bg-subtle px-2 py-0.5 rounded-sm">{row.scope}</span> },
    { key: 'discount_type', label: 'Type' },
    { key: 'discount_value', label: 'Value', render: (row) => row.discount_type === 'percentage' ? `${row.discount_value}%` : `₹${Number(row.discount_value).toFixed(2)}` },
    { key: 'validity', label: 'Valid', render: (row) => {
      if (!row.valid_from && !row.valid_until) return <span className="text-text-secondary">—</span>;
      const f = row.valid_from ? new Date(row.valid_from).toLocaleDateString() : '∞';
      const u = row.valid_until ? new Date(row.valid_until).toLocaleDateString() : '∞';
      return <span className="text-caption text-text-secondary">{f} → {u}</span>;
    }},
    { key: 'active', label: 'Status', render: (row) => <StatusBadge status={row.active ? 'active' : 'closed'} label={row.active ? 'Active' : 'Inactive'} /> },
    { key: 'actions', label: '', render: (row) => (
      <div className="flex gap-2 justify-end">
        <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="p-1.5 text-text-secondary hover:text-text-primary"><Pencil size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} className="p-1.5 text-text-secondary hover:text-danger"><Trash2 size={16} /></button>
      </div>
    )},
  ];

  return (
    <div className="max-w-[1280px]">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-display text-text-primary">Promotions</h1>
        <button onClick={openCreate} className="flex items-center gap-2 bg-accent text-accent-on rounded-md px-4 py-2.5 text-body-strong hover:bg-accent-hover"><Plus size={18} /> Add promotion</button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search promotions..." className="w-full border border-border rounded-sm pl-9 pr-8 py-2 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
          {search && <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"><X size={16} /></button>}
        </div>
      </div>
      <div className="bg-bg-app border border-border rounded-md shadow-sm">
        <DataTable columns={columns} data={data} meta={meta} onPageChange={setPage} loading={loading} emptyMessage="No promotions match your search" />
      </div>
      {modal && (
        <Modal title={edit ? 'Edit promotion' : 'New promotion'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-strong text-text-primary block mb-1">Scope</label>
                <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft">
                  <option value="product">Product</option>
                  <option value="order">Order</option>
                </select>
              </div>
              <div>
                <label className="text-body-strong text-text-primary block mb-1">Discount type</label>
                <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft">
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-strong text-text-primary block mb-1">Value</label>
                <input type="number" step="0.01" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
              </div>
              {form.scope === 'product' && (
                <div>
                  <label className="text-body-strong text-text-primary block mb-1">Product</label>
                  <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft">
                    <option value="">Select product</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-strong text-text-primary block mb-1">Min quantity</label>
                <input type="number" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
              </div>
              <div>
                <label className="text-body-strong text-text-primary block mb-1">Min order amount (₹)</label>
                <input type="number" step="0.01" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-strong text-text-primary block mb-1">Valid From</label>
                <input type="datetime-local" value={form.valid_from ? form.valid_from.slice(0,16) : ''} onChange={(e) => setForm({ ...form, valid_from: e.target.value ? e.target.value + ':00.000Z' : '' })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
              </div>
              <div>
                <label className="text-body-strong text-text-primary block mb-1">Valid Until</label>
                <input type="datetime-local" value={form.valid_until ? form.valid_until.slice(0,16) : ''} onChange={(e) => setForm({ ...form, valid_until: e.target.value ? e.target.value + ':00.000Z' : '' })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="promo_active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded border-border" />
              <label htmlFor="promo_active" className="text-body text-text-primary">Active</label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModal(false)} className="px-4 py-2.5 text-body-strong text-text-primary border border-border-strong rounded-md hover:bg-bg-subtle">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2.5 text-body-strong bg-accent text-accent-on rounded-md hover:bg-accent-hover">Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
