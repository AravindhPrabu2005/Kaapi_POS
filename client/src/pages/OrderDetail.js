import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, XCircle, Printer, Download, CheckCircle, Tag, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getOrder, sendToKitchen, cancelOrder, sendReceipt, confirmPayment, applyCoupon, removeCoupon, getOrderReceiptPdf } from '../api/orders';
import { lookupCoupon } from '../api/coupons';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [email, setEmail] = useState('');
  const [paying, setPaying] = useState(false);
  const [couponModal, setCouponModal] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponApplying, setCouponApplying] = useState(false);

  const fetchOrder = () => {
    setLoading(true);
    getOrder(id)
      .then(({ data }) => setOrder(data.data))
      .catch(() => toast.error('Failed to load order'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrder(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendToKitchen = async () => {
    try {
      await sendToKitchen(id);
      toast.success('Sent to kitchen');
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      await cancelOrder(id, { reason: 'Cancelled by admin' });
      toast.success('Order cancelled');
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    }
  };

  const handleMarkAsPaid = async () => {
    setPaying(true);
    try {
      await confirmPayment(id, { payment_method: 'cash' });
      toast.success('Marked as paid');
      setPaymentModal(false);
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      await getOrderReceiptPdf(order.id);
    } catch (err) {
      toast.error('Failed to download PDF');
    }
  };

  const handleSendReceipt = async () => {
    try {
      await sendReceipt(id, { email });
      toast.success('Receipt sent');
      setReceiptModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) { toast.error('Enter a coupon code'); return; }
    setCouponApplying(true);
    try {
      await applyCoupon(id, { code: couponInput.trim().toUpperCase() });
      toast.success('Coupon applied');
      setCouponModal(false);
      setCouponInput('');
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to apply coupon');
    } finally {
      setCouponApplying(false);
    }
  };

  const handleRemoveCoupon = async () => {
    if (!window.confirm('Remove coupon from this order?')) return;
    try {
      await removeCoupon(id);
      toast.success('Coupon removed');
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to remove coupon');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!order) return <div className="text-text-secondary text-body">Order not found</div>;

  return (
    <div className="max-w-[1280px] space-y-5">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/orders')} className="text-text-secondary hover:text-text-primary"><ArrowLeft size={22} /></button>
        <h1 className="text-display text-text-primary">Order #{order.order_number}</h1>
        <StatusBadge status={order.status} label={order.status === 'draft' ? 'Draft' : order.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-bg-app border border-border rounded-md shadow-sm p-4">
            <h2 className="text-h2 text-text-primary mb-3">Order lines</h2>
            {order.lines?.length === 0 ? (
              <p className="text-text-secondary text-body">No items</p>
            ) : (
              <div className="divide-y divide-border">
                {order.lines?.map((line) => (
                  <div key={line.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-body-strong text-text-primary">{line.product?.name || 'Product'}</p>
                      <p className="text-caption text-text-secondary">×{line.quantity} @ ₹{Number(line.unit_price).toFixed(2)}</p>
                      {line.applied_promotion && (
                        <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold text-success bg-success-bg px-1.5 py-0.5 rounded-sm">
                          <Tag size={10} />
                          {line.applied_promotion.name}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-price text-text-primary">₹{Number(line.line_total).toFixed(2)}</p>
                      {parseFloat(line.line_discount || 0) > 0 && (
                        <p className="text-[10px] text-success">-₹{Number(line.line_discount).toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
            <div className="bg-bg-app border border-border rounded-md shadow-sm p-4">
              <h2 className="text-h2 text-text-primary mb-3">Summary</h2>
              <div className="space-y-2 text-body">
                <div className="flex justify-between"><span className="text-text-secondary">Subtotal</span><span>₹{Number(order.subtotal).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Tax</span><span>₹{Number(order.tax).toFixed(2)}</span></div>
                {Number(order.discount) > 0 && (
                  <div className="flex justify-between text-success">
                    <span>
                      Discount
                      {order.coupon && (
                        <span className="ml-1 text-[10px] font-semibold bg-success-bg px-1.5 py-0.5 rounded-sm">({order.coupon.code})</span>
                      )}
                    </span>
                    <span>-₹{Number(order.discount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-border text-price-lg"><span>Total</span><span>₹{Number(order.total).toFixed(2)}</span></div>
              </div>
            </div>

          <div className="bg-bg-app border border-border rounded-md shadow-sm p-4 space-y-2 text-body">
            <p><span className="text-text-secondary">Table:</span> {order.table?.table_number ? `Table ${order.table.table_number}` : 'Takeaway'}</p>
            <p><span className="text-text-secondary">Customer:</span> {order.customer?.name || 'Walk-in'}</p>
            <p><span className="text-text-secondary">Created:</span> {new Date(order.created_at).toLocaleString()}</p>
          </div>

          {order.status === 'draft' && (
            <div className="space-y-2">
              <button onClick={handleSendToKitchen} className="w-full flex items-center justify-center gap-2 bg-accent text-accent-on rounded-md py-2.5 text-body-strong hover:bg-accent-hover">
                <Send size={18} /> Send to kitchen
              </button>
              <button onClick={() => setPaymentModal(true)} className="w-full flex items-center justify-center gap-2 bg-success text-white rounded-md py-2.5 text-body-strong hover:bg-success/90">
                <CheckCircle size={18} /> Mark as paid
              </button>
              {order.coupon ? (
                <button onClick={handleRemoveCoupon} className="w-full flex items-center justify-center gap-2 border border-warning text-warning rounded-md py-2.5 text-body-strong hover:bg-warning-bg">
                  <X size={18} /> Remove coupon ({order.coupon.code})
                </button>
              ) : (
                <button onClick={() => { setCouponInput(''); setCouponModal(true); }} className="w-full flex items-center justify-center gap-2 border border-accent text-accent rounded-md py-2.5 text-body-strong hover:bg-accent-soft/30">
                  <Tag size={18} /> Apply coupon
                </button>
              )}
              <button onClick={handleCancel} className="w-full flex items-center justify-center gap-2 border border-danger text-danger rounded-md py-2.5 text-body-strong hover:bg-danger-bg">
                <XCircle size={18} /> Cancel order
              </button>
            </div>
          )}

          {order.status === 'paid' && (
            <>
              <button onClick={handleDownloadPdf} className="w-full flex items-center justify-center gap-2 border border-accent text-accent rounded-md py-2.5 text-body-strong hover:bg-accent-soft/30">
                <Download size={18} /> Download PDF
              </button>
              <button onClick={() => setReceiptModal(true)} className="w-full flex items-center justify-center gap-2 bg-accent text-accent-on rounded-md py-2.5 text-body-strong hover:bg-accent-hover">
                <Printer size={18} /> Send receipt
              </button>
            </>
          )}
        </div>
      </div>

      {paymentModal && (
        <Modal title="Mark as paid" onClose={() => setPaymentModal(false)}>
          <div className="space-y-4 text-center">
            <p className="text-price-lg text-text-primary">₹{Number(order.total).toFixed(2)}</p>
            <p className="text-body text-text-secondary">This will mark the order as paid (cash).</p>
            <div className="flex justify-center gap-3 pt-2">
              <button onClick={() => setPaymentModal(false)} className="px-4 py-2.5 text-body-strong text-text-primary border border-border-strong rounded-md hover:bg-bg-subtle">Cancel</button>
              <button onClick={handleMarkAsPaid} disabled={paying} className="px-6 py-2.5 text-body-strong bg-success text-white rounded-md hover:bg-success/90 disabled:opacity-50">
                {paying ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {receiptModal && (
        <Modal title="Send receipt" onClose={() => setReceiptModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" placeholder="customer@example.com" />
            </div>
            <button onClick={handleSendReceipt} className="w-full bg-accent text-accent-on rounded-md py-2.5 text-body-strong hover:bg-accent-hover">Send</button>
          </div>
        </Modal>
      )}

      {couponModal && (
        <Modal title="Apply coupon" onClose={() => setCouponModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Coupon code</label>
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft uppercase"
                placeholder="Enter code"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyCoupon(); }}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setCouponModal(false)} className="px-4 py-2.5 text-body-strong text-text-primary border border-border-strong rounded-md hover:bg-bg-subtle">Cancel</button>
              <button onClick={handleApplyCoupon} disabled={couponApplying || !couponInput.trim()} className="px-4 py-2.5 text-body-strong bg-accent text-accent-on rounded-md hover:bg-accent-hover disabled:bg-accent-soft disabled:text-text-disabled">
                {couponApplying ? 'Applying...' : 'Apply'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
