import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/categories';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

const palette = ['#E76F51','#F4A261','#E9C46A','#2A9D8F','#287271','#5B8AB8','#8E7DBE','#C9667B','#6B9080','#B5838D'];

export default function Categories() {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', color: palette[0] });
  const [search, setSearch] = useState('');

  const fetchData = (p = 1) => {
    setLoading(true);
    const params = { page: p, page_size: 20 };
    if (search) params.search = search;
    getCategories(params)
      .then(({ data: res }) => { setData(res.data); setMeta(res.meta); })
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(page); }, [page, search]);

  const openCreate = () => { setEdit(null); setForm({ name: '', color: palette[0] }); setModal(true); };
  const openEdit = (cat) => { setEdit(cat); setForm({ name: cat.name, color: cat.color }); setModal(true); };

  const handleSave = async () => {
    try {
      if (edit) {
        await updateCategory(edit.id, form);
        toast.success('Category updated');
      } else {
        await createCategory(form);
        toast.success('Category created');
      }
      setModal(false);
      fetchData(page);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await deleteCategory(id);
      toast.success('Category deleted');
      fetchData(page);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Delete failed');
    }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (row) => (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: row.color }} />
        <span>{row.name}</span>
      </div>
    )},
    { key: 'actions', label: '', render: (row) => (
      <div className="flex gap-2 justify-end">
        <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="p-1.5 text-text-secondary hover:text-text-primary">
          <Pencil size={16} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} className="p-1.5 text-text-secondary hover:text-danger">
          <Trash2 size={16} />
        </button>
      </div>
    )},
  ];

  return (
    <div className="max-w-[1280px]">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-display text-text-primary">Categories</h1>
        <button onClick={openCreate} className="flex items-center gap-2 bg-accent text-accent-on rounded-md px-4 py-2.5 text-body-strong hover:bg-accent-hover">
          <Plus size={18} /> Add category
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search categories..." className="w-full border border-border rounded-sm pl-9 pr-8 py-2 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
          {search && <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"><X size={16} /></button>}
        </div>
      </div>
      <div className="bg-bg-app border border-border rounded-md shadow-sm">
        <DataTable columns={columns} data={data} meta={meta} onPageChange={setPage} loading={loading} emptyMessage="No categories match your search" />
      </div>

      {modal && (
        <Modal title={edit ? 'Edit category' : 'New category'} onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
              />
            </div>
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Color</label>
              <div className="flex gap-2 flex-wrap">
                {palette.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-8 h-8 rounded-full border-2 ${form.color === c ? 'border-accent scale-110' : 'border-transparent'} transition-all`}
                    style={{ backgroundColor: c }}
                  />
                ))}
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
