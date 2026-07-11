import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api/products';
import { getCategories } from '../api/categories';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

export default function Products() {
  const [data, setData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', category_id: '', price: '', unit_of_measure: 'unit', tax_percent: '0', description: '', image_url: '', kds_enabled: true });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchData = (p = 1) => {
    setLoading(true);
    const params = { page: p, page_size: 20 };
    if (search) params.search = search;
    if (categoryFilter) params.category_id = categoryFilter;
    Promise.all([
      getProducts(params),
      getCategories({ page_size: 100 }),
    ])
      .then(([prodRes, catRes]) => {
        setData(prodRes.data.data);
        setMeta(prodRes.data.meta);
        setCategories(catRes.data.data || []);
      })
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(page); }, [page, search, categoryFilter]);

  const openCreate = () => {
    setEdit(null);
    setForm({ name: '', category_id: categories[0]?.id || '', price: '', unit_of_measure: 'unit', tax_percent: '0', description: '', image_url: '', kds_enabled: true });
    setModal(true);
  };

  const openEdit = (prod) => {
    setEdit(prod);
    setForm({
      name: prod.name,
      category_id: prod.category?.id || '',
      price: String(prod.price),
      unit_of_measure: prod.unit_of_measure,
      tax_percent: String(prod.tax_percent),
      description: prod.description || '',
      image_url: prod.image_url || '',
      kds_enabled: prod.kds_enabled,
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.category_id) { toast.error('Please select a category'); return; }
    if (!form.price || parseFloat(form.price) <= 0) { toast.error('Please enter a valid price'); return; }
    const payload = {
      ...form,
      price: form.price,
      tax_percent: form.tax_percent || '0',
      kds_enabled: form.kds_enabled || false,
    };
    try {
      if (edit) {
        await updateProduct(edit.id, payload);
        toast.success('Product updated');
      } else {
        await createProduct(payload);
        toast.success('Product created');
      }
      setModal(false);
      fetchData(page);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await deleteProduct(id);
      toast.success('Product deleted');
      fetchData(page);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Delete failed');
    }
  };

  const columns = [
    { key: 'image', label: '', render: (row) => (
      row.image_url ? (
        <img src={row.image_url} alt={row.name} className="w-10 h-10 rounded-md object-cover" onError={(e) => { e.target.style.display = 'none' }} />
      ) : (
        <div className="w-10 h-10 rounded-md bg-bg-subtle flex items-center justify-center text-text-disabled text-xs">{row.name[0]}</div>
      )
    )},
    { key: 'name', label: 'Name', render: (row) => (
      <div className="flex items-center gap-2">
        {row.category && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: row.category.color }} />}
        <span>{row.name}</span>
      </div>
    )},
    { key: 'category', label: 'Category', render: (row) => (
      <span className="text-text-secondary">{row.category?.name || '—'}</span>
    )},
    { key: 'price', label: 'Price', render: (row) => `₹${Number(row.price).toFixed(2)}` },
    { key: 'unit_of_measure', label: 'Unit', render: (row) => row.unit_of_measure },
    { key: 'kds_enabled', label: 'KDS', render: (row) => row.kds_enabled ? 'Yes' : 'No' },
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
        <h1 className="text-display text-text-primary">Products</h1>
        <button onClick={openCreate} className="flex items-center gap-2 bg-accent text-accent-on rounded-md px-4 py-2.5 text-body-strong hover:bg-accent-hover">
          <Plus size={18} /> Add product
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search products..."
            className="w-full border border-border rounded-sm pl-9 pr-8 py-2 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
              <X size={16} />
            </button>
          )}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="border border-border rounded-sm px-3 py-2 text-body bg-bg-app focus:outline-none focus:border-accent"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-bg-app border border-border rounded-md shadow-sm">
        <DataTable columns={columns} data={data} meta={meta} onPageChange={setPage} loading={loading} emptyMessage="No products match your search" />
      </div>

      {modal && (
        <Modal title={edit ? 'Edit product' : 'New product'} onClose={() => setModal(false)}>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
            </div>
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Category</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft">
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-strong text-text-primary block mb-1">Price (₹)</label>
                <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
              </div>
              <div>
                <label className="text-body-strong text-text-primary block mb-1">Unit</label>
                <select value={form.unit_of_measure} onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft">
                  <option value="unit">Unit</option>
                  <option value="kg">Kg</option>
                  <option value="g">G</option>
                  <option value="l">L</option>
                  <option value="ml">Ml</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Tax (%)</label>
              <input type="number" step="0.01" value={form.tax_percent} onChange={(e) => setForm({ ...form, tax_percent: e.target.value })} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
            </div>
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Image URL</label>
              <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
            </div>
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="kds_enabled" checked={form.kds_enabled} onChange={(e) => setForm({ ...form, kds_enabled: e.target.checked })} className="rounded border-border" />
              <label htmlFor="kds_enabled" className="text-body text-text-primary">Send to kitchen display</label>
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
