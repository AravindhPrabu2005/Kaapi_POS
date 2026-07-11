import { useState } from 'react';
import { X, DollarSign, CreditCard, Smartphone } from 'lucide-react';
import { initiatePayment, confirmPayment, cancelPayment } from '../api/orders';
import toast from 'react-hot-toast';

const methodIcons = { cash: DollarSign, card: CreditCard, upi: Smartphone };

export default function PosPaymentModal({ orderId, orderNumber, tableNumber, total, paymentMethods, onClose, onSuccess }) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [amountReceived, setAmountReceived] = useState('');
  const [txnRef, setTxnRef] = useState('');
  const [initiated, setInitiated] = useState(null);
  const [processing, setProcessing] = useState(false);

  const enabledMethods = paymentMethods.filter((m) => m.enabled);

  const handleInitiate = async () => {
    if (!selectedMethod) return;
    setProcessing(true);
    try {
      const payload = { payment_method: selectedMethod };
      if (selectedMethod === 'cash') {
        if (!amountReceived || parseFloat(amountReceived) < parseFloat(total)) {
          toast.error('Amount received must be at least the total');
          setProcessing(false);
          return;
        }
        payload.amount_received = amountReceived;
      }
      if (selectedMethod === 'card' && txnRef) {
        payload.transaction_reference = txnRef;
      }
      const { data } = await initiatePayment(orderId, payload);
      setInitiated(data.data);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to initiate payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      await confirmPayment(orderId, { payment_method: selectedMethod });
      toast.success('Payment confirmed');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to confirm payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelPayment = async () => {
    setProcessing(true);
    try {
      await cancelPayment(orderId);
      setInitiated(null);
      setSelectedMethod(null);
      setAmountReceived('');
      setTxnRef('');
      toast('Payment cancelled');
    } catch {
    } finally {
      setProcessing(false);
    }
  };

  const methodLabel = (type) => {
    const m = paymentMethods.find((p) => p.type === type);
    return m ? m.label : type;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(43,37,32,0.4)]" onClick={onClose} />
      <div className="relative bg-bg-app rounded-lg shadow-lg p-5 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h1 text-text-primary">Payment</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-1">
            <X size={20} />
          </button>
        </div>

        <div className="bg-bg-subtle rounded-md px-4 py-2 mb-4 flex items-center justify-between text-body">
          <span className="text-text-secondary">{orderNumber || 'Order'}</span>
          <span className="text-text-primary font-semibold">{tableNumber ? `Table ${tableNumber}` : ''}</span>
        </div>

        <div className="text-center mb-6">
          <p className="text-caption text-text-secondary">Total amount</p>
          <p className="text-price-lg text-text-primary">₹{Number(total).toFixed(2)}</p>
        </div>

        {!initiated ? (
          <>
            {!selectedMethod ? (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {enabledMethods.map((m) => {
                  const Icon = methodIcons[m.type];
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMethod(m.type)}
                      className="flex flex-col items-center gap-2 p-4 border border-border rounded-md hover:border-accent hover:shadow-sm transition-all"
                    >
                      <Icon size={28} className="text-text-primary" />
                      <span className="text-caption text-text-primary">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 p-3 bg-accent-soft/30 rounded-md">
                  <span className="text-body-strong text-text-primary capitalize">{methodLabel(selectedMethod)}</span>
                  <button
                    onClick={() => { setSelectedMethod(null); setAmountReceived(''); setTxnRef(''); }}
                    className="text-caption text-accent hover:text-accent-hover ml-auto"
                  >
                    Change
                  </button>
                </div>

                {selectedMethod === 'cash' && (
                  <div>
                    <label className="text-body-strong text-text-primary block mb-1">Amount received</label>
                    <input
                      type="number"
                      step="0.01"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      className="w-full border border-border rounded-sm p-3 text-body text-text-primary bg-bg-app focus:border-accent focus:ring-[3px] focus:ring-accent-soft outline-none"
                      placeholder={`Min ₹${Number(total).toFixed(2)}`}
                      autoFocus
                    />
                  </div>
                )}
                {selectedMethod === 'card' && (
                  <div>
                    <label className="text-body-strong text-text-primary block mb-1">Transaction reference (optional)</label>
                    <input
                      type="text"
                      value={txnRef}
                      onChange={(e) => setTxnRef(e.target.value)}
                      className="w-full border border-border rounded-sm p-3 text-body text-text-primary bg-bg-app focus:border-accent focus:ring-[3px] focus:ring-accent-soft outline-none"
                      placeholder="e.g. TXN-12345"
                      autoFocus
                    />
                  </div>
                )}

                <button
                  onClick={handleInitiate}
                  disabled={processing || (selectedMethod === 'cash' && !amountReceived)}
                  className="w-full bg-accent text-accent-on rounded-md py-2.5 text-body-strong hover:bg-accent-hover disabled:bg-accent-soft disabled:text-text-disabled"
                >
                  {processing ? 'Processing...' : 'Continue'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4 mb-6">
            {selectedMethod === 'upi' && initiated.qr_image_url && (
              <div className="text-center">
                <img src={initiated.qr_image_url} alt="UPI QR" className="mx-auto w-48 h-48 border border-border rounded-md" />
                <p className="text-caption text-text-secondary mt-2">Scan with any UPI app to pay</p>
              </div>
            )}
            {selectedMethod === 'cash' && (
              <div className="bg-success-bg rounded-md p-4 text-center">
                <p className="text-body-strong text-success">Change due</p>
                <p className="text-price-lg text-success">₹{Number(initiated.change_due || 0).toFixed(2)}</p>
              </div>
            )}
            {selectedMethod === 'card' && (
              <div className="bg-info/10 rounded-md p-4 text-center">
                <p className="text-body text-text-secondary">Ready to confirm card payment</p>
              </div>
            )}

            {initiated.status === 'awaiting_confirmation' && (
              <div className="flex gap-3">
                <button
                  onClick={handleCancelPayment}
                  disabled={processing}
                  className="flex-1 px-4 py-2.5 text-body-strong text-text-primary border border-border-strong rounded-md hover:bg-bg-subtle"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={processing}
                  className="flex-1 bg-accent text-accent-on rounded-md py-2.5 text-body-strong hover:bg-accent-hover disabled:bg-accent-soft disabled:text-text-disabled"
                >
                  {processing ? 'Confirming...' : 'Confirm payment'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-border">
          <button onClick={onClose} className="text-caption text-text-secondary hover:text-text-primary">Close</button>
        </div>
      </div>
    </div>
  );
}
