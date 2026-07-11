import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Minus, ChefHat, Table2, X, Users, LogOut, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { getProducts } from '../api/products';
import { getCategories } from '../api/categories';
import { getFloors, getFloor } from '../api/floors';
import { getOrders, getOrder, createOrder, addOrderLine, sendToKitchen, updateOrder, cancelOrder, evaluatePromotions } from '../api/orders';
import { getKdsTickets, advanceTicket, markItemComplete } from '../api/kds';
import { getPaymentMethods } from '../api/settings';
import { getCustomers, createCustomer } from '../api/customers';
import { lookupCoupon } from '../api/coupons';
import { applyCoupon, removeCoupon } from '../api/orders';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import PosPaymentModal from '../components/PosPaymentModal';
import KdsBoard from '../components/KdsBoard';

const KDS_LABELS = { to_cook: 'To cook', preparing: 'Preparing', completed: 'Prepared' };

export default function PosDashboard() {
  const { user, logout } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [floors, setFloors] = useState([]);
  const [tablesByFloor, setTablesByFloor] = useState({});
  const [occupiedTables, setOccupiedTables] = useState(new Set());
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTable, setSelectedTable] = useState('');
  const [isTakeaway, setIsTakeaway] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [tableModal, setTableModal] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const [payingOrder, setPayingOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingOrderLines, setEditingOrderLines] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState('pos');
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      getProducts({ page_size: 100 }),
      getCategories({ page_size: 100 }),
      getFloors(),
      getOrders({ status: 'draft', page_size: 100 }),
      getPaymentMethods(),
      getKdsTickets({ page_size: 100 }),
      getCustomers({ page_size: 100 }),
    ])
      .then(([pRes, cRes, fRes, oRes, pmRes, kRes, custRes]) => {
        setProducts(pRes.data.data || []);
        setCategories(cRes.data.data || []);
        const floorList = fRes.data.data || [];
        setFloors(floorList);
        const draftOrders = oRes.data.data || [];
        setActiveOrders(draftOrders);
        const occupied = new Set(draftOrders.map((o) => o.table?.id).filter(Boolean));
        setOccupiedTables(occupied);
        setPaymentMethods(pmRes.data.data || []);
        setTickets(kRes.data.data || []);
        setCustomers(custRes.data.data || []);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (floors.length === 0) return;
    Promise.all(floors.map((f) => getFloor(f.id)))
      .then((results) => {
        const grouped = {};
        results.forEach((res) => {
          const fd = res.data.data;
          grouped[fd.id] = fd.tables || [];
        });
        setTablesByFloor(grouped);
      })
      .catch(() => {});
  }, [floors]);

  const fetchTickets = () => {
    getKdsTickets({ page_size: 100 })
      .then(({ data }) => setTickets(data.data || []))
      .catch(() => {});
  };

  const searchCustomers = (q) => {
    getCustomers({ search: q, page_size: 20 })
      .then(({ data }) => setCustomers(data.data || []))
      .catch(() => {});
  };

  const filtered = products.filter((p) => {
    const catMatch = selectedCategory === 'all' || (p.category?.id || p.category_id) === selectedCategory;
    const searchMatch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return catMatch && searchMatch;
  });

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
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

  const handlePlaceOrder = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (!isTakeaway && !selectedTable) { setTableModal(true); return; }
    if (!isTakeaway && occupiedTables.has(selectedTable)) {
      toast.error('Table is already occupied');
      setSelectedTable('');
      return;
    }
    setCreating(true);
    try {
      const tableId = isTakeaway ? null : selectedTable;
      const { data } = await createOrder({ table_id: tableId });
      const orderData = data.data;
      const orderId = orderData.id;
      if (selectedCustomer) {
        await updateOrder(orderId, { customer_id: selectedCustomer.id });
      }
      for (const item of cart) {
        await addOrderLine(orderId, {
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        });
      }
      try { await evaluatePromotions(orderId); } catch { /* ignore */ }
      if (appliedCoupon) {
        try {
          await applyCoupon(orderId, { code: appliedCoupon.code });
        } catch (err) {
          toast.error('Coupon could not be applied: ' + (err.response?.data?.error?.message || 'Unknown error'));
        }
      }
      await sendToKitchen(orderId);
      toast.success('Order sent to kitchen');
      const { data: orderDetail } = await getOrder(orderId);
      const orderFull = orderDetail.data;
      const tableNum = (() => {
        if (isTakeaway) return null;
        for (const f of floors) {
          const tbls = tablesByFloor[f.id] || [];
          const t = tbls.find((t) => t.id === selectedTable);
          if (t) return t.table_number;
        }
        return null;
      })();
      const newOrder = {
        id: orderFull.id,
        order_number: orderFull.order_number,
        status: 'draft',
        table: isTakeaway ? null : (orderFull.table || { id: selectedTable, table_number: tableNum }),
        total: orderFull.total,
        created_at: orderFull.created_at,
      };
      setActiveOrders((prev) => [...prev, newOrder]);
      setCart([]);
      setAppliedCoupon(null);
      setCouponCode('');
      setIsTakeaway(false);
      if (!isTakeaway) setOccupiedTables((prev) => new Set(prev).add(selectedTable));
      fetchTickets();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create order');
    } finally {
      setCreating(false);
    }
  };

  const handlePayOrder = (order) => {
    setPayingOrder(order);
    setPaymentModal(true);
  };

  const handleCancelOrder = async (order) => {
    if (!window.confirm(`Cancel ${order.order_number} for Table ${order.table?.table_number || '—'}?`)) return;
    try {
      await cancelOrder(order.id, { reason: 'Cancelled by cashier' });
      toast.success('Order cancelled');
      const tableId = order.table?.id;
      setOccupiedTables((prev) => {
        const next = new Set(prev);
        next.delete(tableId);
        return next;
      });
      if (selectedTable === tableId) setSelectedTable('');
      fetchTickets();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel order');
    }
  };

  const handlePaymentSuccess = () => {
    const tableId = payingOrder?.table?.id;
    setPaymentModal(false);
    setPayingOrder(null);
    setActiveOrders((prev) => prev.filter((o) => o.id !== payingOrder?.id));
    if (tableId) {
      setOccupiedTables((prev) => {
        const next = new Set(prev);
        next.delete(tableId);
        return next;
      });
    }
    setSelectedCustomer(null);
    if (selectedTable === tableId) {
      setSelectedTable('');
    }
    fetchTickets();
    fetchAll();
  };

  const handleEditOrder = async (order) => {
    setEditingOrder(order);
    setSelectedTable(order.table?.id || '');
    try {
      const { data } = await getOrder(order.id);
      const lines = (data.data?.lines || []).map((l) => ({
        product_id: l.product?.id,
        name: l.product?.name || 'Unknown',
        quantity: l.quantity,
        unit_price: parseFloat(l.unit_price),
        line_total: parseFloat(l.line_total),
      }));
      setEditingOrderLines(lines);
    } catch {
      toast.error('Failed to load order details');
      setEditingOrder(null);
    }
  };

  const handleUpdateOrder = async () => {
    if (cart.length === 0) { toast.error('No new items to add'); return; }
    setCreating(true);
    try {
      for (const item of cart) {
        await addOrderLine(editingOrder.id, {
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        });
      }
      await sendToKitchen(editingOrder.id);
      toast.success('Items added & sent to kitchen');
      setCart([]);
      setEditingOrder(null);
      setEditingOrderLines([]);
      fetchTickets();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update order');
    } finally {
      setCreating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingOrder(null);
    setEditingOrderLines([]);
    setCart([]);
  };

  const handleAdvance = async (id, targetStage) => {
    try { await advanceTicket(id, targetStage); fetchTickets(); } catch { toast.error('Failed to advance'); }
  };

  const handleApplyCouponPreview = async () => {
    if (!couponCode.trim()) { toast.error('Enter a coupon code'); return; }
    setCouponApplying(true);
    try {
      const { data } = await lookupCoupon(couponCode.trim().toUpperCase());
      const coupon = data.data;
      let discount = 0;
      if (coupon.discount_type === 'percentage') {
        discount = cartTotal * parseFloat(coupon.discount_value) / 100;
      } else {
        discount = parseFloat(coupon.discount_value);
      }
      setAppliedCoupon({ ...coupon, discount_amount: Math.min(discount, cartTotal).toFixed(2) });
      toast.success(`Coupon "${coupon.code}" applied — ₹${Math.min(discount, cartTotal).toFixed(2)} off`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Invalid coupon');
      setAppliedCoupon(null);
    } finally {
      setCouponApplying(false);
      setCouponCode('');
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

  const selectedFloorName = () => {
    if (isTakeaway) return 'Take Away';
    for (const floor of floors) {
      const tbls = tablesByFloor[floor.id] || [];
      const t = tbls.find((t) => t.id === selectedTable);
      if (t) return `${floor.name} – ${t.table_number}`;
    }
    return '';
  };

  const activeTickets = tickets.filter((t) => t.stage !== 'completed');

  const orderStages = {};
  tickets.forEach((t) => {
    if (!orderStages[t.order_id]) orderStages[t.order_id] = [];
    orderStages[t.order_id].push(t.stage);
  });
  const STAGE_BADGE = {
    to_cook: { label: 'To cook', class: 'bg-orange-100 text-orange-800 border-orange-300' },
    preparing: { label: 'Preparing', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    completed: { label: 'Prepared', class: 'bg-green-100 text-green-800 border-green-300' },
  };
  const getOrderBadge = (orderId) => {
    const stages = orderStages[orderId];
    if (!stages?.length) return null;
    const stage = stages.includes('to_cook') ? 'to_cook'
      : stages.includes('preparing') ? 'preparing'
      : 'completed';
    return { ...STAGE_BADGE[stage], ticketCount: stages.length };
  };

  if (loading) {
    return (
      <div className="h-screen flex justify-center items-center bg-bg-cream">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg-cream overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-4 h-14 border-b border-border-strong bg-accent-soft/40 shrink-0">
        <div className="flex items-center gap-1">
          <img src="/odoo_cafe_logo.png" alt="Kaapi Cafe" className="h-8 w-8 rounded-full object-cover" />
          <button
            onClick={() => setViewMode('pos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-strong transition-colors ${
              viewMode === 'pos' ? 'bg-accent text-accent-on' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <ShoppingCart size={16} />
            POS
          </button>
          <button
            onClick={() => setViewMode('kds')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-strong transition-colors ${
              viewMode === 'kds' ? 'bg-accent text-accent-on' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <ChefHat size={16} />
            KDS
            {activeTickets.length > 0 && (
              <span className="bg-danger text-white text-caption rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none">
                {activeTickets.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 max-w-md relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-body text-text-primary bg-bg-subtle focus:border-accent focus:ring-[3px] focus:ring-accent-soft outline-none"
          />
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <span className="text-caption text-text-secondary hidden sm:inline">{user?.name}</span>
          <span className="text-caption text-text-disabled hidden sm:inline">({user?.role})</span>
          <button onClick={logout} className="text-text-secondary hover:text-danger p-1" title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main content */}
      {viewMode === 'pos' ? (
        <div className="flex-1 flex min-h-0">
          {/* Left: Product area */}
          <div className="flex-1 flex flex-col min-w-0 p-4">
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 shrink-0">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`shrink-0 px-4 py-1.5 rounded-full text-caption font-semibold border ${
                  selectedCategory === 'all'
                    ? 'bg-accent text-accent-on border-accent'
                    : 'bg-bg-app text-text-secondary border-border hover:border-accent'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-caption font-semibold border ${
                    selectedCategory === cat.id
                      ? 'bg-accent text-accent-on border-accent'
                      : 'bg-bg-app text-text-secondary border-border hover:border-accent'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-text-disabled">
                  <p className="text-body">No products found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filtered.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className="bg-bg-app border-2 border-border rounded-lg shadow-sm p-0 text-left hover:border-accent hover:shadow-md transition-all active:scale-[0.98] overflow-hidden"
                    >
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-20 object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                      ) : (
                        <div className="w-full h-20 bg-bg-subtle flex items-center justify-center text-text-disabled text-xs">
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
              )}
            </div>
          </div>

          {/* Right: Cart panel */}
          <div className="w-80 shrink-0 bg-bg-app border-l-2 border-border-strong flex flex-col">
            <div className="flex items-center gap-2 p-4 border-b-2 border-border-strong shrink-0 bg-accent-soft/20">
              {editingOrder ? (
                <>
                  <ShoppingCart size={20} className="text-accent" />
                  <h2 className="text-h2 text-text-primary truncate">Editing {editingOrder.order_number}</h2>
                  <button onClick={handleCancelEdit} className="ml-auto text-text-secondary hover:text-danger p-1">
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <ShoppingCart size={20} className="text-accent" />
                  <h2 className="text-h2 text-text-primary">Cart</h2>
                  <span className="text-caption text-text-secondary">({cart.length})</span>
                </>
              )}
            </div>

            {/* Table + Customer info */}
            <div className="px-4 pt-3 pb-2 space-y-2 border-b-2 border-border-strong shrink-0 bg-bg-subtle">
              <button
                onClick={() => setTableModal(true)}
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

            {/* Coupon section */}
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
                  <button
                    onClick={handleRemoveCoupon}
                    className="ml-auto text-text-secondary hover:text-danger p-0.5"
                    title="Remove coupon"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Cart items / Active orders / Editing */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 bg-bg-app">
              {editingOrder ? (
                <>
                  {/* Existing items from the order */}
                  {editingOrderLines.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-caption font-semibold text-text-secondary">In kitchen</p>
                      {editingOrderLines.map((line, i) => (
                        <div key={i} className="bg-bg-subtle rounded-md px-3 py-2 border border-border flex items-center justify-between opacity-70">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-body text-text-primary truncate">{line.name}</span>
                            <span className="text-caption text-text-secondary shrink-0">×{line.quantity}</span>
                          </div>
                          <span className="text-price text-text-primary shrink-0 ml-2">₹{line.line_total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* New items being added */}
                  {cart.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-caption font-semibold text-text-secondary">Adding new</p>
                      {cart.map((item) => (
                        <div key={item.product_id} className="bg-bg-cream rounded-md p-3 shadow-sm border border-border">
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
                  ) : (
                    <p className="text-text-disabled text-body text-center py-8">Tap products to add to order</p>
                  )}
                </>
              ) : cart.length === 0 ? (
                activeOrders.length === 0 ? (
                  <p className="text-text-disabled text-body text-center py-8">Tap products to add</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-caption font-semibold text-text-secondary mb-3">Active Orders</p>
                    {activeOrders.map((order) => {
                      const badge = getOrderBadge(order.id);
                      return (
                        <div key={order.id} className="bg-bg-cream rounded-md p-3 shadow-sm border border-border">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-body-strong text-text-primary truncate">{order.order_number}</p>
                              <p className="text-caption text-text-secondary">{order.table ? `Table ${order.table.table_number}` : 'Takeaway'}</p>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p className="text-price text-text-primary">₹{parseFloat(order.total).toFixed(2)}</p>
                              <div className="flex items-center gap-1.5 mt-1 justify-end">
                                {badge && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge.class}`}>
                                    {badge.label}{badge.ticketCount > 1 ? ` +${badge.ticketCount - 1}` : ''}
                                  </span>
                                )}
                                {!badge && (
                                  <span className="text-[10px] text-text-disabled">Pending</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handlePayOrder(order)}
                              className="flex-1 text-caption text-accent hover:text-accent-hover font-semibold border border-accent/30 rounded py-1"
                            >
                              Pay
                            </button>
                            <button
                              onClick={() => handleEditOrder(order)}
                              className="flex-1 text-caption text-text-secondary hover:text-text-primary font-semibold border border-border rounded py-1"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleCancelOrder(order)}
                              className="flex-1 text-caption text-danger hover:text-danger font-semibold border border-danger/30 rounded py-1"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                cart.map((item) => (
                  <div key={item.product_id} className="bg-bg-cream rounded-md p-3 shadow-sm border border-border">
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
                ))
              )}
            </div>

            {/* Total + Place order / Update order */}
            <div className="border-t-2 border-border-strong p-4 space-y-3 shrink-0 bg-bg-app">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-body text-text-secondary">Subtotal</span>
                  <span className="text-body text-text-primary">
                    ₹{editingOrder
                      ? (editingOrderLines.reduce((s, l) => s + l.line_total, 0) + cartTotal).toFixed(2)
                      : cartTotal.toFixed(2)}
                  </span>
                </div>
                {(editingOrder ? (editingOrderLines.reduce((s, l) => s + l.line_total, 0) + cartTotal) : cartTotal) > 0 && appliedCoupon && (
                  <div className="flex justify-between items-center text-success">
                    <span className="text-body">Coupon ({appliedCoupon.code})</span>
                    <span className="text-body">-₹{couponDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-border-strong">
                  <span className="text-body-strong text-text-primary">Total</span>
                  <span className="text-price-lg text-text-primary">
                    ₹{editingOrder
                      ? Math.max(0, editingOrderLines.reduce((s, l) => s + l.line_total, 0) + cartTotal).toFixed(2)
                      : cartTotalAfterDiscount.toFixed(2)}
                  </span>
                </div>
              </div>
              {editingOrder ? (
                <button
                  onClick={handleUpdateOrder}
                  disabled={creating || cart.length === 0}
                  className="w-full bg-accent text-accent-on rounded-md py-2.5 text-body-strong hover:bg-accent-hover disabled:bg-accent-soft disabled:text-text-disabled"
                >
                  {creating ? 'Updating...' : 'Add to order'}
                </button>
              ) : (
                <button
                  onClick={handlePlaceOrder}
                  disabled={creating || cart.length === 0 || (!isTakeaway && !selectedTable)}
                  className="w-full bg-accent text-accent-on rounded-md py-2.5 text-body-strong hover:bg-accent-hover disabled:bg-accent-soft disabled:text-text-disabled"
                >
                  {creating ? 'Creating order...' : 'Create order'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 p-4">
          <KdsBoard
            tickets={tickets}
            loading={false}
            onAdvance={handleAdvance}
            onItemComplete={(ticketId, itemId) => markItemComplete(ticketId, itemId).then(fetchTickets).catch(() => {})}
            stageLabels={KDS_LABELS}
            renderTicketHeader={(ticket) =>
              ticket.table_number ? <span className="text-caption text-text-secondary ml-2">Table {ticket.table_number}</span> : null
            }
            className="h-full"
          />
        </div>
      )}

      {/* Table selection modal */}
      {tableModal && (
        <Modal title="Select table or Take Away" onClose={() => setTableModal(false)}>
          <div className="mb-4">
            <button
              onClick={() => { setIsTakeaway(true); setSelectedTable(''); setTableModal(false); }}
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
                          onClick={() => { if (!isOccupied) { setSelectedTable(t.id); setIsTakeaway(false); setTableModal(false); } }}
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
            <button onClick={() => setTableModal(false)} className="px-4 py-2.5 text-body-strong text-text-primary border border-border-strong rounded-md hover:bg-bg-subtle">
              Done
            </button>
          </div>
        </Modal>
      )}

      {/* Customer selection modal */}
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

      {/* Payment modal */}
      {paymentModal && payingOrder && (
        <PosPaymentModal
          orderId={payingOrder.id}
          orderNumber={payingOrder.order_number}
          tableNumber={payingOrder.table?.table_number}
          total={parseFloat(payingOrder.total)}
          paymentMethods={paymentMethods}
          onClose={() => setPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
