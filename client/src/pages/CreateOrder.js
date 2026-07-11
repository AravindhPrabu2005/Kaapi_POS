import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, ShoppingCart, X, Users, Table2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getProducts } from '../api/products';
import { getCategories } from '../api/categories';
import { getFloors, getFloor } from '../api/floors';
import { getOrders, createOrder, addOrderLine, updateOrder, applyCoupon, evaluatePromotions } from '../api/orders';
import { getCustomers, createCustomer } from '../api/customers';
import { lookupCoupon } from '../api/coupons';
import Modal from '../components/Modal';

export default function CreateOrder() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [floors, setFloors] = useState([]);
  const [tablesByFloor, setTablesByFloor] = useState({});
  const [occupiedTables, setOccupiedTables] = useState(new Set());
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTable, setSelectedTable] = useState('');
  const [isTakeaway, setIsTakeaway] = useState(false);
  const [cart, setCart] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerModal, setCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);

  useEffect(() => {
    Promise.all([
      getProducts({ page_size: 100 }),
      getCategories({ page_size: 100 }),
      getFloors(),
      getOrders({ status: 'draft', page_size: 100 }),
      getCustomers({ page_size: 100 }),
    ]).then(([pRes, cRes, fRes, oRes, custRes]) => {
      setProducts(pRes.data.data || []);
      setCategories(cRes.data.data || []);
      const floorList = fRes.data.data || [];
      setFloors(floorList);
      const occupied = new Set((oRes.data.data || []).map((o) => o.table_id).filter(Boolean));
      setOccupiedTables(occupied);
      setCustomers(custRes.data.data || []);
    }).catch(() => toast.error('Failed to load data'));
  }, []);

  useEffect(() => {
    if (floors.length === 0) return;
    Promise.all(floors.map((f) => getFloor(f.id)))
      .then((results) => {
        const grouped = {};
        results.forEach((res) => {
          const floorData = res.data.data;
          grouped[floorData.id] = floorData.tables || [];
        });
        setTablesByFloor(grouped);
      })
      .catch(() => {});
  }, [floors]);

  const selectedFloorName = () => {
    if (isTakeaway) return 'Take Away';
    for (const floor of floors) {
      const tbls = tablesByFloor[floor.id] || [];
      const t = tbls.find((t) => t.id === selectedTable);
      if (t) return `${floor.name} – ${t.table_number}`;
    }
    return '';
  };

  const filtered = selectedCategory === 'all'
    ? products
    : products.filter((p) => (p.category?.id || p.category_id) === selectedCategory);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        unit_price: parseFloat(product.price),
        quantity: 1,
        line_total: parseFloat(product.price),
      }];
    });
  };

  const updateQty = (productId, delta) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: Math.max(0, item.quantity + delta), line_total: item.unit_price * Math.max(0, item.quantity + delta) }
          : item
      ).filter((item) => item.quantity > 0)
    );
  };

  const handleCreateOrder = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (!isTakeaway && !selectedTable) { setShowTableModal(true); return; }
    if (!isTakeaway && occupiedTables.has(selectedTable)) {
      toast.error('Table is already occupied');
      setSelectedTable('');
      return;
    }
    setCreating(true);
    try {
      const tableId = isTakeaway ? null : selectedTable;
      const { data } = await createOrder({ table_id: tableId });
      const newOrderId = data.data.id;
      if (selectedCustomer) {
        await updateOrder(newOrderId, { customer_id: selectedCustomer.id });
      }
      for (const item of cart) {
        await addOrderLine(newOrderId, {
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        });
      }
      try { await evaluatePromotions(newOrderId); } catch { /* ignore */ }
      if (appliedCoupon) {
        try {
          await applyCoupon(newOrderId, { code: appliedCoupon.code });
        } catch (err) {
          toast.error('Coupon could not be applied: ' + (err.response?.data?.error?.message || 'Unknown error'));
        }
      }
      toast.success('Order created');
      navigate(`/orders/${newOrderId}`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create order');
    } finally {
      setCreating(false);
    }
  };

  const handleApplyCouponPreview = async () => {
    if (!couponCode.trim()) { toast.error('Enter a coupon code'); return; }
    setCouponApplying(true);
    try {
      const { data } = await lookupCoupon(couponCode.trim().toUpperCase());
      const coupon = data.data;
      const total = cart.reduce((sum, item) => sum + item.line_total, 0);
      let discount = 0;
      if (coupon.discount_type === 'percentage') {
        discount = total * parseFloat(coupon.discount_value) / 100;
      } else {
        discount = parseFloat(coupon.discount_value);
      }
      setAppliedCoupon({ ...coupon, discount_amount: Math.min(discount, total).toFixed(2) });
      toast.success(`Coupon "${coupon.code}" applied — ₹${Math.min(discount, total).toFixed(2)} off`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Invalid coupon');
      setAppliedCoupon(null);
    } finally {
      setCouponApplying(false);
      setCouponCode('');
    }
  };

  const searchCustomers = (q) => {
    getCustomers({ search: q, page_size: 20 })
      .then(({ data }) => setCustomers(data.data || []))
      .catch(() => {});
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) { toast.error('Name is required'); return; }
    setCreatingCustomer(true);
    try {
      const { data } = await createCustomer({
        name: newCustomerName,
        email: newCustomerEmail || undefined,
        phone: newCustomerPhone || undefined,
      });
      const newCust = data.data;
      setSelectedCustomer(newCust);
      setCustomerModal(false);
      setNewCustomerName('');
      setNewCustomerEmail('');
      setNewCustomerPhone('');
      toast.success('Customer created');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create customer');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const couponDiscount = appliedCoupon ? parseFloat(appliedCoupon.discount_amount) : 0;
  const cartTotal = cart.reduce((sum, item) => sum + item.line_total, 0);
  const cartTotalAfterDiscount = Math.max(0, cartTotal - couponDiscount);

  const getCategoryColor = (categoryId) => {
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.color || '#ccc';
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-5">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate('/orders')} className="text-text-secondary hover:text-text-primary"><ArrowLeft size={22} /></button>
          <h1 className="text-display text-text-primary">New order</h1>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`shrink-0 px-4 py-1.5 rounded-full text-caption font-semibold border ${
              selectedCategory === 'all' ? 'bg-accent text-accent-on border-accent' : 'bg-bg-app text-text-secondary border-border hover:border-accent'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-caption font-semibold border ${
                selectedCategory === cat.id ? 'bg-accent text-accent-on border-accent' : 'bg-bg-app text-text-secondary border-border hover:border-accent'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-bg-app border border-border rounded-lg shadow-sm p-0 text-left hover:border-accent hover:shadow-md transition-all overflow-hidden"
              >
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-20 object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                ) : (
                  <div className="w-full h-20 bg-bg-subtle flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(product.category?.id || product.category_id) }} />
                  </div>
                )}
                <div className="p-2.5">
                  <p className="text-body-strong text-text-primary truncate">{product.name}</p>
                  <p className="text-price text-text-primary mt-0.5">₹{Number(product.price).toFixed(2)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-80 shrink-0 bg-bg-cream rounded-lg flex flex-col">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <ShoppingCart size={20} className="text-accent" />
          <h2 className="text-h2 text-text-primary">Cart</h2>
          <span className="text-caption text-text-secondary">({cart.length})</span>
        </div>

        {/* Table + Customer info */}
        <div className="px-4 pt-3 pb-2 space-y-2 border-b-2 border-border-strong shrink-0 bg-bg-subtle">
          <button
            onClick={() => setShowTableModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-md text-body text-text-primary bg-bg-app hover:border-accent transition-colors"
          >
            <Table2 size={16} className="text-text-secondary shrink-0" />
            <span className={(selectedTable || isTakeaway) ? 'text-text-primary truncate' : 'text-text-disabled'}>
              {isTakeaway ? 'Take Away' : selectedTable ? selectedFloorName() : 'Select table'}
            </span>
          </button>
          <button
            onClick={() => { setCustomerSearch(''); setCustomerModal(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-md text-body text-text-primary bg-bg-app hover:border-accent transition-colors"
          >
            <Users size={16} className="text-text-secondary shrink-0" />
            <span className={selectedCustomer ? 'text-text-primary truncate' : 'text-text-disabled'}>
              {selectedCustomer ? selectedCustomer.name : 'Add customer'}
            </span>
            {selectedCustomer && (
              <X
                size={14}
                className="ml-auto text-text-secondary hover:text-danger shrink-0"
                onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }}
              />
            )}
          </button>
        </div>

        {/* Coupon */}
        <div className="px-4 py-2 border-b-2 border-border-strong shrink-0 bg-bg-subtle">
          {!appliedCoupon ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Coupon code"
                className="flex-1 border border-border rounded-sm px-3 py-2 text-caption text-text-primary bg-bg-app focus:border-accent focus:ring-[3px] focus:ring-accent-soft outline-none uppercase"
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyCouponPreview(); }}
              />
              <button
                onClick={handleApplyCouponPreview}
                disabled={couponApplying || !couponCode.trim()}
                className="shrink-0 px-3 py-2 bg-accent text-accent-on rounded-sm text-caption font-semibold hover:bg-accent-hover disabled:bg-accent-soft disabled:text-text-disabled"
              >
                {couponApplying ? '...' : 'Apply'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-success-bg border border-success/30 rounded-md">
              <span className="text-caption font-semibold text-success shrink-0">{appliedCoupon.code}</span>
              <span className="text-caption text-success">-₹{appliedCoupon.discount_amount}</span>
              <button onClick={handleRemoveCoupon} className="ml-auto text-text-secondary hover:text-danger p-0.5" title="Remove coupon">
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 bg-bg-app">
          {cart.length === 0 && (
            <p className="text-text-disabled text-body text-center py-8">Tap products to add</p>
          )}
          {cart.map((item) => (
            <div key={item.product_id} className="bg-bg-cream rounded-md p-3 shadow-sm">
              <p className="text-body-strong text-text-primary truncate">{item.name}</p>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(item.product_id, -1)} className="w-7 h-7 flex items-center justify-center border border-border rounded-sm text-text-secondary hover:bg-bg-subtle">
                    <Minus size={14} />
                  </button>
                  <span className="text-body-strong text-text-primary w-5 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, 1)} className="w-7 h-7 flex items-center justify-center border border-border rounded-sm text-text-secondary hover:bg-bg-subtle">
                    <Plus size={14} />
                  </button>
                </div>
                <p className="text-price text-text-primary">₹{item.line_total.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t-2 border-border-strong bg-bg-subtle p-4 space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-body text-text-secondary">Subtotal</span>
              <span className="text-body text-text-primary">₹{cartTotal.toFixed(2)}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between items-center text-success">
                <span className="text-body">Coupon ({appliedCoupon.code})</span>
                <span className="text-body">-₹{couponDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-border-strong">
              <span className="text-body-strong text-text-primary">Total</span>
              <span className="text-price-lg text-text-primary">₹{cartTotalAfterDiscount.toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={handleCreateOrder}
            disabled={creating || cart.length === 0 || (!isTakeaway && !selectedTable)}
            className="w-full bg-accent text-accent-on rounded-md py-2.5 text-body-strong hover:bg-accent-hover disabled:bg-accent-soft disabled:text-text-disabled"
          >
            {creating ? 'Creating...' : 'Create order'}
          </button>
        </div>
      </div>

      {showTableModal && (
        <Modal title="Select table or Take Away" onClose={() => setShowTableModal(false)}>
          <div className="mb-4">
            <button
              onClick={() => { setIsTakeaway(true); setSelectedTable(''); setShowTableModal(false); }}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md text-body-strong border-2 transition-all ${
                isTakeaway
                  ? 'bg-accent text-accent-on border-accent'
                  : 'bg-bg-app text-text-primary border-border hover:border-accent'
              }`}
            >
              <ShoppingCart size={18} />
              Take Away
            </button>
          </div>
          <div className="space-y-5 max-h-[50vh] overflow-y-auto">
            {floors.map((floor) => {
              const floorTables = tablesByFloor[floor.id] || [];
              if (floorTables.length === 0) return null;
              return (
                <div key={floor.id}>
                  <p className="text-caption font-semibold text-text-secondary mb-3 uppercase tracking-wide">{floor.name}</p>
                  <div className="flex flex-wrap gap-3">
                    {floorTables.map((t) => {
                      const isOccupied = occupiedTables.has(t.id);
                      const isSelected = selectedTable === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => { if (!isOccupied) { setSelectedTable(t.id); setIsTakeaway(false); setShowTableModal(false); } }}
                          disabled={isOccupied}
                          title={`Table ${t.table_number}${isOccupied ? ' (occupied)' : ''}`}
                          className={`w-16 h-16 rounded-full flex items-center justify-center text-h2 font-semibold transition-all ${
                            isSelected
                              ? 'bg-accent text-accent-on shadow-md ring-2 ring-accent ring-offset-2'
                              : isOccupied
                              ? 'bg-accent-soft text-accent border-2 border-accent cursor-not-allowed opacity-60'
                              : 'bg-bg-app text-text-primary border border-border hover:border-accent hover:shadow-sm'
                          }`}
                        >
                          {t.table_number}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end pt-4 border-t border-border mt-4">
            <button onClick={() => setShowTableModal(false)} className="px-4 py-2.5 text-body-strong text-text-primary border border-border-strong rounded-md hover:bg-bg-subtle">Done</button>
          </div>
        </Modal>
      )}

      {customerModal && (
        <Modal title="Customer" onClose={() => setCustomerModal(false)}>
          <div className="space-y-4">
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); searchCustomers(e.target.value); }}
              placeholder="Search by name or email..."
              className="w-full border border-border rounded-sm p-3 text-body text-text-primary bg-bg-app focus:border-accent focus:ring-[3px] focus:ring-accent-soft outline-none"
              autoFocus
            />

            <div className="max-h-48 overflow-y-auto space-y-1">
              {customers.filter((c) => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.email?.toLowerCase().includes(customerSearch.toLowerCase())).map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c); setCustomerModal(false); }}
                  className={`w-full text-left px-3 py-2 rounded-md text-body hover:bg-bg-subtle transition-colors ${
                    selectedCustomer?.id === c.id ? 'bg-accent-soft/30' : ''
                  }`}
                >
                  <span className="text-text-primary">{c.name}</span>
                  {c.email && <span className="text-caption text-text-secondary ml-2">{c.email}</span>}
                </button>
              ))}
              {customers.length === 0 && customerSearch && (
                <p className="text-caption text-text-disabled text-center py-4">No customers found</p>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-caption font-semibold text-text-secondary mb-3">Create new customer</p>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Name *"
                  className="w-full border border-border rounded-sm p-3 text-body text-text-primary bg-bg-app focus:border-accent focus:ring-[3px] focus:ring-accent-soft outline-none"
                />
                <input
                  type="email"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full border border-border rounded-sm p-3 text-body text-text-primary bg-bg-app focus:border-accent focus:ring-[3px] focus:ring-accent-soft outline-none"
                />
                <input
                  type="tel"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="Phone"
                  className="w-full border border-border rounded-sm p-3 text-body text-text-primary bg-bg-app focus:border-accent focus:ring-[3px] focus:ring-accent-soft outline-none"
                />
                <button
                  onClick={handleCreateCustomer}
                  disabled={creatingCustomer || !newCustomerName.trim()}
                  className="w-full bg-accent text-accent-on rounded-md py-2.5 text-body-strong hover:bg-accent-hover disabled:bg-accent-soft disabled:text-text-disabled"
                >
                  {creatingCustomer ? 'Creating...' : 'Create & select'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
