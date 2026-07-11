import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Archive, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, archiveEmployee } from '../api/employees';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';

export default function Employees() {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'cashier' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = { page, page_size: 20 };
    if (search) params.search = search;
    getEmployees(params)
      .then(({ data: res }) => { setData(res.data); setMeta(res.meta); })
      .catch(() => toast.error('Failed to load employees'))
      .finally(() => setLoading(false));
  }, [page, search]);

  const openCreate = () => { setEdit(null); setForm({ name: '', email: '', password: '', role: 'cashier' }); setModal(true); };
  const openEdit = (e) => { setEdit(e); setForm({ name: e.name, email: e.email, password: '', role: e.role }); setModal(true); };

  const handleSave = async () => {
    const payload = edit ? { name: form.name, email: form.email, role: form.role } : form;
    if (!edit && !payload.password) { toast.error('Password is required'); return; }
    if (edit && form.password) payload.password = form.password;
    try {
      if (edit) {
        await updateEmployee(edit.id, payload);
        toast.success('Employee updated');
      } else {
        await createEmployee(payload);
        toast.success('Employee created');
      }
      setModal(false);
      getEmployees({ page, page_size: 20 }).then(({ data: res }) => { setData(res.data); setMeta(res.meta); });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this employee?')) return;
    try {
      await deleteEmployee(id);
      toast.success('Employee deleted');
      getEmployees({ page, page_size: 20 }).then(({ data: res }) => { setData(res.data); setMeta(res.meta); });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Delete failed');
    }
  };

  const handleArchive = async (id) => {
    try {
      await archiveEmployee(id);
      toast.success('Employee archived');
      getEmployees({ page, page_size: 20 }).then(({ data: res }) => { setData(res.data); setMeta(res.meta); });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Archive failed');
    }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (row) => <span className="text-body-strong">{row.name}</span> },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (row) => <StatusBadge status={row.role} label={row.role} /> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} label={row.status} /> },
    { key: 'actions', label: '', render: (row) => (
      <div className="flex gap-2 justify-end">
        <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="p-1.5 text-text-secondary hover:text-text-primary"><Pencil size={16} /></button>
        {row.status !== 'archived' && <button onClick={(e) => { e.stopPropagation(); handleArchive(row.id); }} className="p-1.5 text-text-secondary hover:text-warning"><Archive size={16} /></button>}
        <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} className="p-1.5 text-text-secondary hover:text-danger"><Trash2 size={16} /></button>
      </div>
    )},
  ];

  return (
    <div className="max-w-[1280px]">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-display text-text-primary">Employees</h1>
        <button onClick={openCreate} className="flex items-center gap-2 bg-accent text-accent-on rounded-md px-4 py-2.5 text-body-strong hover:bg-accent-hover"><Plus size={18} /> Add employee</button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search employees..." className="w-full border border-border rounded-sm pl-9 pr-8 py-2 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
          {search && <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"><X size={16} /></button>}
        </div>
      </div>
      <div className="bg-bg-app border border-border rounded-md shadow-sm">
        <DataTable columns={columns} data={data} meta={meta} onPageChange={setPage} loading={loading} emptyMessage="No employees match your search" />
      </div>
      {modal && (
        <Modal title={edit ? 'Edit employee' : 'New employee'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
            </div>
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
            </div>
            <div>
              <label className="text-body-strong text-text-primary block mb-1">{edit ? 'New password (leave blank to keep)' : 'Password'}</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
            </div>
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft">
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModal(false)} className="px-4 py-2.5 text-body-strong text-text-primary border border-border-strong rounded-md hover:bg-bg-subtle">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2.5 text-body-strong bg-accent text-accent-on rounded-md hover:bg-accent-hover">{edit ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
