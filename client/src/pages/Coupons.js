import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '../api/coupons';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';

export default function Coupons() {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ code: '', discount_type: 'percentage', discount_value: '', max_uses: '', valid_from: '', valid_until: '', active: true });
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = { page, page_size: 20 };
    if (search) params.search = search;
    getCoupons(params)
      .then(({ data: res }) => { setData(res.data); setMeta(res.meta); })
      .catch(() => toast.error('Failed to load coupons'))
      .finally(() => setLoading(false));
  }, [page, search]);

  const openCreate = () => { setEdit(null); setForm({ code: '', discount_type: 'percentage', discount_value: '', max_uses: '', valid_from: '', valid_until: '', active: true }); setModal(true); };
  const openEdit = (c) => { setEdit(c); setForm({ code: c.code, discount_type: c.discount_type, discount_value: String(c.discount_value), max_uses: c.max_uses != null ? String(c.max_uses) : '', valid_from: c.valid_from || '', valid_until: c.valid_until || '', active: c.active }); setModal(true); };

  const handleSave = async () => {
    if (!form.code) { toast.error('Code is required'); return; }
    if (!form.discount_value || parseFloat(form.discount_value) <= 0) { toast.error('Enter a valid discount value'); return; }
    const isFixed = form.discount_type === 'fixed';
    const payload = {
      code: form.code,
      discount_type: isFixed ? 'fixed_amount' : 'percentage',
      discount_value: form.discount_value,
      active: form.active,
    };
    if (form.max_uses !== '') {
      payload.max_uses = parseInt(form.max_uses, 10);
    } else if (edit && edit.max_uses != null) {
      payload.max_uses_null = true;
    }
    if (form.valid_from) payload.valid_from = form.valid_from;
    if (form.valid_until) payload.valid_until = form.valid_until;
    if (edit) {
      if (!form.valid_from && edit.valid_from) payload.valid_from_null = true;
      if (!form.valid_until && edit.valid_until) payload.valid_until_null = true;
    }
    try {
      if (edit) { await updateCoupon(edit.id, payload); toast.success('Coupon updated'); }
      else { await createCoupon(payload); toast.success('Coupon created'); }
      setModal(false);
      getCoupons({ page, page_size: 20 }).then(({ data: res }) => { setData(res.data); setMeta(res.meta); });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this coupon?')) return;
    try { await deleteCoupon(id); toast.success('Coupon deleted'); getCoupons({ page, page_size: 20 }).then(({ data: res }) => { setData(res.data); setMeta(res.meta); }); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Delete failed'); }
  };

  const columns = [
    { key: 'code', label: 'Code', render: (row) => <span className="text-body-strong uppercase">{row.code}</span> },
    { key: 'discount_type', label: 'Type', render: (row) => row.discount_type },
    { key: 'discount_value', label: 'Value', render: (row) => row.discount_type === 'percentage' ? `${row.discount_value}%` : `₹${Number(row.discount_value).toFixed(2)}` },
    { key: 'usage', label: 'Uses', render: (row) => row.max_uses != null ? `${row.redemption_count || 0} / ${row.max_uses}` : `${row.redemption_count || 0}` },
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
        <h1 className="text-display text-text-primary">Coupons</h1>
        <button onClick={openCreate} className="flex items-center gap-2 bg-accent text-accent-on rounded-md px-4 py-2.5 text-body-strong hover:bg-accent-hover"><Plus size={18} /> Add coupon</button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by coupon code..." className="w-full border border-border rounded-sm pl-9 pr-8 py-2 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
          {search && <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"><X size={16} /></button>}
        </div>
      </div>
      <div className="bg-bg-app border border-border rounded-md shadow-sm">
        <DataTable columns={columns} data={data} meta={meta} onPageChange={setPage} loading={loading} emptyMessage="No coupons match your search" />
      </div>
      {modal && (
        <Modal title={edit ? 'Edit coupon' : 'New coupon'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Code</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft uppercase" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-strong text-text-primary block mb-1">Type</label>
                <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft">
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              <div>
                <label className="text-body-strong text-text-primary block mb-1">Value</label>
                <input type="number" step="0.01" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
              </div>
            </div>
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Max Uses <span className="text-text-disabled text-caption">(empty = unlimited)</span></label>
              <input type="number" min="1" step="1" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
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
              <input type="checkbox" id="active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded border-border" />
              <label htmlFor="active" className="text-body text-text-primary">Active</label>
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
