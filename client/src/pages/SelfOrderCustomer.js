import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Minus, ShoppingCart, ArrowLeft, ChevronRight, Clock, Check, X, Phone, Mail, User, Search } from 'lucide-react';
import { resolveQrToken, getMenu, placeOrder, getOrderStatus } from '../api/selfOrdering';
import toast from 'react-hot-toast';

const KDS_STAGE_LABELS = { to_cook: 'Order Received', preparing: 'Being Prepared', completed: 'Ready!' };
const KDS_STAGE_ORDER = ['to_cook', 'preparing', 'completed'];

export default function SelfOrderCustomer() {
  const { qrToken } = useParams();
  const navigate = useNavigate();

  const [tableInfo, setTableInfo] = useState(null);
  const [settings, setSettings] = useState({ background_color: '#FBF3E7', mode: 'online_ordering' });
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [view, setView] = useState('menu');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [pageReady, setPageReady] = useState(false);
  const [error, setError] = useState(null);
  const [ordering, setOrdering] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const [placedOrder, setPlacedOrder] = useState(null);
  const [trackingStage, setTrackingStage] = useState(null);
  const [showCheckmark, setShowCheckmark] = useState(false);

  const orderData = useRef(null);

  const loadMenu = useCallback(async (tableId, search) => {
    const { data } = await getMenu(tableId, search);
    const cats = data.data.categories || [];
    setCategories(cats);
    const allProds = cats.flatMap((c) =>
      (c.products || []).map((p) => ({ ...p, categoryId: c.id, categoryName: c.name, categoryColor: c.color }))
    );
    setProducts(allProds);
  }, []);

  useEffect(() => {
    if (!qrToken) return;
    resolveQrToken(qrToken)
      .then(({ data }) => {
        const d = data.data;
        setTableInfo(d.table);
        setSettings({
          background_color: d.background_color || '#FBF3E7',
          mode: d.mode || 'online_ordering',
        });
        setPageReady(true);
        return loadMenu(d.table.id, '');
      })
      .catch((err) => {
        const msg = err.response?.data?.error?.message || 'Invalid QR code. Please scan a valid table QR.';
        setError(msg);
      });
  }, [qrToken, loadMenu]);

  useEffect(() => {
    if (!pageReady || !tableInfo) return;
    const timer = setTimeout(() => loadMenu(tableInfo.id, searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, pageReady, tableInfo, loadMenu]);

  const isQrMenu = settings.mode === 'qr_menu';

  const cartItems = cart.filter((i) => i.quantity > 0);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartSubtotal = cartItems.reduce((s, i) => s + i.line_total, 0);
  const tax = cartSubtotal * 0.05;
  const total = cartSubtotal + tax;

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter((p) => p.categoryId === selectedCategory);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1, line_total: (i.quantity + 1) * i.unit_price }
            : i
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
      prev.map((i) =>
        i.product_id === productId
          ? { ...i, quantity: Math.max(0, i.quantity + delta), line_total: i.unit_price * Math.max(0, i.quantity + delta) }
          : i
      ).filter((i) => i.quantity > 0)
    );
  };

  const validateForm = () => {
    const errors = {};
    if (!customerName.trim()) errors.name = 'Name is required';
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) errors.email = 'Invalid email';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;
    if (!tableInfo) return;
    if (settings.mode !== 'online_ordering') {
      toast.error('Ordering is currently disabled');
      return;
    }
    setOrdering(true);
    try {
      const { data } = await placeOrder({
        table_id: tableInfo.id,
        customer: {
          name: customerName.trim(),
          ...(customerEmail.trim() && { email: customerEmail.trim() }),
          ...(customerPhone.trim() && { phone: customerPhone.trim() }),
        },
        items: cartItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      });
      orderData.current = data.data;
      setPlacedOrder(data.data);
      setShowCheckmark(true);
      setTimeout(() => {
        setShowCheckmark(false);
        setView('tracking');
        setTrackingStage(data.data.kds_ticket?.stage || 'to_cook');
      }, 1800);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  };

  const pollStage = useCallback(() => {
    if (!orderData.current) return;
    getOrderStatus(orderData.current.order_id)
      .then(({ data }) => {
        setTrackingStage(data.data.stage);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (view !== 'tracking') return;
    const interval = setInterval(pollStage, 8000);
    return () => clearInterval(interval);
  }, [view, pollStage]);

  const stageIndex = KDS_STAGE_ORDER.indexOf(trackingStage);
  const progressPct = stageIndex >= 0 ? ((stageIndex + 1) / KDS_STAGE_ORDER.length) * 100 : 33;

  const bgStyle = settings.background_color
    ? { backgroundColor: settings.background_color }
    : {};

  if (error) {
    return (
      <div style={bgStyle} className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg p-8 max-w-md w-full text-center animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-danger-bg flex items-center justify-center mx-auto mb-4">
            <X size={32} className="text-danger" />
          </div>
          <h1 className="text-xl font-bold text-text-primary mb-2">Invalid QR Code</h1>
          <p className="text-text-secondary mb-6">{error}</p>
          <button
            onClick={() => navigate('/landing')}
            className="bg-accent text-accent-on rounded-xl px-6 py-3 font-semibold hover:bg-accent-hover transition-colors w-full"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!pageReady) {
    return (
      <div style={bgStyle} className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-accent border-t-transparent mx-auto mb-4" />
          <p className="text-text-secondary text-sm">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={bgStyle} className="min-h-screen flex flex-col relative">
      {showCheckmark && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-10 shadow-xl animate-scaleIn">
            <svg width="80" height="80" viewBox="0 0 80 80" className="mx-auto">
              <circle cx="40" cy="40" r="36" fill="none" stroke="#22c55e" strokeWidth="4"
                strokeDasharray="226" strokeDashoffset="226"
                className="animate-circleCheck" />
              <path d="M24 40 L36 52 L56 28" fill="none" stroke="#22c55e" strokeWidth="4"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="48" strokeDashoffset="48"
                className="animate-checkmark" />
            </svg>
            <p className="text-xl font-bold text-text-primary mt-4 text-center">Order Placed!</p>
            <p className="text-text-secondary text-center text-sm mt-1">{placedOrder?.order_number}</p>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border/50 px-4 h-14 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <img src="/odoo_cafe_logo.png" alt="Kaapi Cafe" className="h-8 w-8 rounded-full object-cover shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary truncate">Kaapi Cafe</p>
            {tableInfo && (
              <p className="text-xs text-text-secondary truncate">Table {tableInfo.table_number}{tableInfo.floor ? ` · ${tableInfo.floor}` : ''}</p>
            )}
          </div>
        </div>
        {view === 'menu' && !isQrMenu && (
          <button
            onClick={() => setView(cartItems.length > 0 ? 'cart' : 'menu')}
            className="relative p-2 hover:bg-accent-soft/30 rounded-xl transition-colors"
          >
            <ShoppingCart size={22} className="text-text-primary" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-accent text-accent-on text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>
        )}
        {isQrMenu && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-accent-soft/60 text-accent shrink-0">
            View Only
          </span>
        )}
      </header>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {view === 'menu' && (
          <div className="animate-slideUp">
            {/* Welcome banner */}
            <div className="px-4 pt-4 pb-3">
              <h1 className="text-xl font-bold text-text-primary">Hey there! 👋</h1>
              <p className="text-text-secondary text-sm mt-0.5">
                {isQrMenu ? 'Browse our menu' : 'Tap items to add to your order'}
                {tableInfo && <span> · Table <strong>{tableInfo.table_number}</strong></span>}
              </p>
            </div>

            {/* Search bar */}
            <div className="px-4 pb-2">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setSelectedCategory('all'); }}
                  placeholder="Search items..."
                  className="w-full border border-border/60 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-white/70 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft transition-colors"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Category pills */}
            <div className="px-4 pb-3 overflow-x-auto scrollbar-none">
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-accent text-accent-on border-accent shadow-sm'
                      : 'bg-white/70 text-text-secondary border-border/60 hover:border-accent'
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-accent text-accent-on border-accent shadow-sm'
                        : 'bg-white/70 text-text-secondary border-border/60 hover:border-accent'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Product grid */}
            <div className={`px-4 ${isQrMenu ? 'pb-8' : 'pb-24'}`}>
              {filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-text-disabled">
                  <p className="text-sm">{searchTerm ? `No items matching "${searchTerm}"` : 'No items in this category'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`bg-white/80 backdrop-blur rounded-xl overflow-hidden text-left border border-border/40 shadow-sm transition-all ${isQrMenu ? '' : 'hover:shadow-md hover:border-accent/50 cursor-pointer active:scale-[0.97]'}`}
                      onClick={() => !isQrMenu && addToCart(product)}
                    >
                      {product.image_url ? (
                        <div className="relative">
                          <img src={product.image_url} alt={product.name} className="w-full h-24 object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                          {!isQrMenu && cart.find((i) => i.product_id === product.id) && (
                            <span className="absolute top-1.5 right-1.5 bg-accent text-accent-on text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md">
                              {cart.find((i) => i.product_id === product.id).quantity}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-start justify-between p-3.5 pb-0">
                          <div className="flex items-start gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: product.categoryColor || '#ccc' }} />
                            {!isQrMenu && cart.find((i) => i.product_id === product.id) && (
                              <span className="bg-accent text-accent-on text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                                {cart.find((i) => i.product_id === product.id).quantity}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="p-3 pt-2.5">
                        <p className="text-sm font-semibold text-text-primary leading-tight">{product.name}</p>
                        {product.description && (
                          <p className="text-[11px] text-text-secondary mt-1 line-clamp-2">{product.description}</p>
                        )}
                        <p className="text-sm font-bold text-accent mt-1.5">₹{Number(product.price).toFixed(2)}</p>
                        {!isQrMenu && (
                          <div className="mt-2 w-full bg-accent text-accent-on rounded-lg py-1.5 text-xs font-semibold text-center hover:bg-accent-hover transition-colors">
                            Add
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom cart bar */}
            {!isQrMenu && cartItems.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 z-30 animate-slideUp">
                <div className="bg-white/95 backdrop-blur-md border-t border-border/60 shadow-lg rounded-t-2xl px-4 py-3 mx-2 mb-2">
                  <button
                    onClick={() => setView('cart')}
                    className="w-full flex items-center justify-between bg-accent text-accent-on rounded-xl px-4 py-3 font-semibold hover:bg-accent-hover transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingCart size={18} />
                      <span>{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      ₹{total.toFixed(2)}
                      <ChevronRight size={18} />
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'cart' && !isQrMenu && (
          <div className="animate-slideUp p-4 pb-28">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setView('menu')} className="p-1.5 hover:bg-accent-soft/30 rounded-lg transition-colors">
                <ArrowLeft size={22} className="text-text-primary" />
              </button>
              <h2 className="text-lg font-bold text-text-primary">Your Cart</h2>
              <span className="text-text-secondary text-sm">({cartCount} item{cartCount !== 1 ? 's' : ''})</span>
            </div>

            {cartItems.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingCart size={48} className="text-text-disabled mx-auto mb-3" />
                <p className="text-text-secondary">Your cart is empty</p>
                <button onClick={() => setView('menu')} className="mt-4 text-accent font-semibold text-sm">Browse Menu</button>
              </div>
            ) : (
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.product_id} className="bg-white/80 backdrop-blur rounded-xl p-3.5 border border-border/40 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-text-primary truncate flex-1">{item.name}</p>
                      <button
                        onClick={() => updateQty(item.product_id, -999)}
                        className="ml-2 p-1 text-text-secondary hover:text-danger transition-colors shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(item.product_id, -1)}
                          className="w-8 h-8 flex items-center justify-center bg-accent-soft/20 rounded-lg text-text-primary hover:bg-accent-soft/40 transition-colors"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="text-base font-bold text-text-primary w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.product_id, 1)}
                          className="w-8 h-8 flex items-center justify-center bg-accent text-accent-on rounded-lg hover:bg-accent-hover transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <p className="text-sm font-bold text-text-primary">₹{item.line_total.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'customer' && !isQrMenu && (
          <div className="animate-slideUp p-4 pb-28">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setView('cart')} className="p-1.5 hover:bg-accent-soft/30 rounded-lg transition-colors">
                <ArrowLeft size={22} className="text-text-primary" />
              </button>
              <h2 className="text-lg font-bold text-text-primary">Your Details</h2>
            </div>

            <div className="bg-white/80 backdrop-blur rounded-xl p-5 border border-border/40 shadow-sm space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 flex items-center gap-1.5">
                  <User size={14} /> Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => { setCustomerName(e.target.value); setFormErrors((p) => ({ ...p, name: '' })); }}
                  placeholder="Your name"
                  className={`w-full border ${formErrors.name ? 'border-danger' : 'border-border'} rounded-xl px-4 py-3 text-sm bg-white/60 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft transition-colors`}
                  autoFocus
                />
                {formErrors.name && <p className="text-xs text-danger mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 flex items-center gap-1.5">
                  <Mail size={14} /> Email
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => { setCustomerEmail(e.target.value); setFormErrors((p) => ({ ...p, email: '' })); }}
                  placeholder="email@example.com"
                  className={`w-full border ${formErrors.email ? 'border-danger' : 'border-border'} rounded-xl px-4 py-3 text-sm bg-white/60 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft transition-colors`}
                />
                {formErrors.email && <p className="text-xs text-danger mt-1">{formErrors.email}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 flex items-center gap-1.5">
                  <Phone size={14} /> Phone
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-white/60 focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft transition-colors"
                />
              </div>
            </div>

            {/* Order summary */}
            <div className="bg-white/80 backdrop-blur rounded-xl p-5 border border-border/40 shadow-sm mt-4">
              <p className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wide">Order Summary</p>
              <div className="space-y-2 text-sm">
                {cartItems.map((item) => (
                  <div key={item.product_id} className="flex justify-between">
                    <span className="text-text-primary">{item.quantity}× {item.name}</span>
                    <span className="text-text-primary font-medium">₹{item.line_total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border/60 mt-3 pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Subtotal</span>
                  <span className="text-text-primary">₹{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Tax (5%)</span>
                  <span className="text-text-primary">₹{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-1 border-t border-border/60">
                  <span className="text-text-primary">Total</span>
                  <span className="text-accent">₹{total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'tracking' && placedOrder && !isQrMenu && (
          <div className="animate-slideUp p-4 pb-28">
            <div className="text-center pt-4 pb-6">
              <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-3">
                <Check size={32} className="text-success" />
              </div>
              <h1 className="text-xl font-bold text-text-primary">Order Placed!</h1>
              <p className="text-text-secondary text-sm mt-1">{placedOrder.order_number}</p>
            </div>

            {/* Progress tracker */}
            <div className="bg-white/80 backdrop-blur rounded-xl p-5 border border-border/40 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-text-primary">Order Status</h3>
                <span className="text-xs text-text-secondary flex items-center gap-1">
                  <Clock size={12} /> Live
                </span>
              </div>
              <div className="relative mt-4 mb-2">
                <div className="h-2 bg-border/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  {KDS_STAGE_ORDER.map((stage, idx) => {
                    const active = stageIndex >= idx;
                    return (
                      <div key={stage} className="flex flex-col items-center" style={{ width: `${100 / KDS_STAGE_ORDER.length}%` }}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-500 ${
                          active
                            ? 'bg-accent text-accent-on shadow-sm'
                            : 'bg-border/30 text-text-disabled'
                        }`}>
                          {active ? <Check size={12} /> : idx + 1}
                        </div>
                        <p className={`text-[10px] mt-1.5 text-center leading-tight ${
                          active ? 'text-text-primary font-semibold' : 'text-text-disabled'
                        }`}>
                          {KDS_STAGE_LABELS[stage]}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Ordered items */}
            <div className="bg-white/80 backdrop-blur rounded-xl p-5 border border-border/40 shadow-sm mb-4">
              <h3 className="text-sm font-bold text-text-primary mb-3">Items Ordered</h3>
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.product_id} className="flex justify-between text-sm">
                    <span className="text-text-primary">{item.quantity}× {item.name}</span>
                    <span className="text-text-secondary">₹{item.line_total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setCart([]);
                setView('menu');
                setCustomerName('');
                setCustomerEmail('');
                setCustomerPhone('');
                setPlacedOrder(null);
                setTrackingStage(null);
              }}
              className="w-full bg-accent text-accent-on rounded-xl py-3.5 font-semibold hover:bg-accent-hover transition-colors"
            >
              Order More
            </button>
          </div>
        )}
      </div>

      {/* Bottom action bars (for cart, customer views) */}
      {view === 'cart' && cartItems.length > 0 && !isQrMenu && (
        <div className="fixed bottom-0 left-0 right-0 z-30 animate-slideUp">
          <div className="bg-white/95 backdrop-blur-md border-t border-border/60 shadow-lg rounded-t-2xl px-4 py-3 mx-2 mb-2">
            <div className="flex justify-between items-center mb-3 px-1">
              <span className="text-sm text-text-secondary">Total</span>
              <span className="text-lg font-bold text-text-primary">₹{total.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setView('customer')}
              className="w-full bg-accent text-accent-on rounded-xl py-3.5 font-semibold hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
            >
              Proceed <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {view === 'customer' && !isQrMenu && (
        <div className="fixed bottom-0 left-0 right-0 z-30 animate-slideUp">
          <div className="bg-white/95 backdrop-blur-md border-t border-border/60 shadow-lg rounded-t-2xl px-4 py-3 mx-2 mb-2">
            <div className="flex justify-between items-center mb-3 px-1">
              <span className="text-sm text-text-secondary">Total</span>
              <span className="text-lg font-bold text-accent">₹{total.toFixed(2)}</span>
            </div>
            <button
              onClick={handlePlaceOrder}
              disabled={ordering}
              className="w-full bg-accent text-accent-on rounded-xl py-3.5 font-semibold hover:bg-accent-hover disabled:bg-accent-soft disabled:text-text-disabled transition-colors flex items-center justify-center gap-2"
            >
              {ordering ? (
                <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" /> Placing Order...</>
              ) : (
                <>Place Order · ₹{total.toFixed(2)}</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
