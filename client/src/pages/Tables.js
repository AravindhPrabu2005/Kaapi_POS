import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTables, createTable, updateTable, deleteTable } from '../api/tables';
import { getFloors } from '../api/floors';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

export default function Tables() {
  const [data, setData] = useState([]);
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ floor_id: '', table_number: '', seats: '4' });
  const [search, setSearch] = useState('');

  const fetchData = () => {
    setLoading(true);
    const params = { page_size: 100 };
    if (search) params.search = search;
    Promise.all([getTables(params), getFloors()])
      .then(([tRes, fRes]) => {
        setData(tRes.data.data || []);
        setFloors(fRes.data.data || []);
      })
      .catch(() => toast.error('Failed to load tables'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [search]);

  const openCreate = () => { setEdit(null); setForm({ floor_id: floors[0]?.id || '', table_number: '', seats: '4' }); setModal(true); };
  const openEdit = (t) => { setEdit(t); setForm({ floor_id: t.floor?.id || '', table_number: String(t.table_number), seats: String(t.seats) }); setModal(true); };

  const handleSave = async () => {
    const payload = { ...form, table_number: parseInt(form.table_number), seats: parseInt(form.seats) };
    try {
      if (edit) {
        await updateTable(edit.id, payload);
        toast.success('Table updated');
      } else {
        await createTable(payload);
        toast.success('Table created');
      }
      setModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this table?')) return;
    try {
      await deleteTable(id);
      toast.success('Table deleted');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Delete failed');
    }
  };

  const getFloorName = (id) => floors.find((f) => f.id === id)?.name || '—';

  const columns = [
    { key: 'table_number', label: 'Table #', render: (row) => <span className="text-body-strong">{row.table_number}</span> },
    { key: 'floor', label: 'Floor', render: (row) => <span className="text-text-secondary">{getFloorName(row.floor?.id)}</span> },
    { key: 'seats', label: 'Seats', render: (row) => row.seats },
    { key: 'qr_token', label: 'QR Token', render: (row) => row.qr_token ? <span className="text-caption text-text-disabled">{row.qr_token.slice(0, 8)}...</span> : '—' },
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
        <h1 className="text-display text-text-primary">Tables</h1>
        <button onClick={openCreate} className="flex items-center gap-2 bg-accent text-accent-on rounded-md px-4 py-2.5 text-body-strong hover:bg-accent-hover">
          <Plus size={18} /> Add table
        </button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by table number..." className="w-full border border-border rounded-sm pl-9 pr-8 py-2 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"><X size={16} /></button>}
        </div>
      </div>
      <div className="bg-bg-app border border-border rounded-md shadow-sm">
        <DataTable columns={columns} data={data} loading={loading} emptyMessage="No tables match your search" />
      </div>
      {modal && (
        <Modal title={edit ? 'Edit table' : 'New table'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Floor</label>
              <select value={form.floor_id} onChange={(e) => setForm({ ...form, floor_id: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft">
                {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-strong text-text-primary block mb-1">Table number</label>
                <input type="number" value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
              </div>
              <div>
                <label className="text-body-strong text-text-primary block mb-1">Seats</label>
                <input type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
              </div>
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
