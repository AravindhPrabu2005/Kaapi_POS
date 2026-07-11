import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getPaymentMethods, updatePaymentMethod, getSelfOrderingSettings, updateSelfOrderingSettings } from '../api/settings';


export default function Settings() {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selfSettings, setSelfSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getPaymentMethods({ page_size: 100 }),
      getSelfOrderingSettings().catch(() => null),
    ])
      .then(([pmRes, ssRes]) => {
        setPaymentMethods(pmRes.data.data || []);
        setSelfSettings(ssRes?.data?.data || { enabled: false, mode: 'qr_menu' });
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const togglePaymentMethod = async (id, currentEnabled) => {
    try {
      await updatePaymentMethod(id, { enabled: !currentEnabled });
      toast.success('Payment method updated');
      const { data } = await getPaymentMethods({ page_size: 100 });
      setPaymentMethods(data.data || []);
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
  };

  const toggleSelfSetting = async (field, value) => {
    try {
      await updateSelfOrderingSettings({ ...selfSettings, [field]: value });
      toast.success('Settings updated');
      const { data } = await getSelfOrderingSettings();
      setSelfSettings(data.data);
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] space-y-6">
      <h1 className="text-display text-text-primary">Settings</h1>

      <div className="bg-bg-app border border-border rounded-md shadow-sm p-4">
        <h2 className="text-h2 text-text-primary mb-4">Payment methods</h2>
        <div className="space-y-3">
          {paymentMethods.map((pm) => (
            <div key={pm.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-body-strong text-text-primary">{pm.label}</p>
                <p className="text-caption text-text-secondary">{pm.type}{pm.upi_id ? ` (${pm.upi_id})` : ''}</p>
              </div>
              <button
                onClick={() => togglePaymentMethod(pm.id, pm.enabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${pm.enabled ? 'bg-success' : 'bg-border'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${pm.enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-bg-app border border-border rounded-md shadow-sm p-4">
        <h2 className="text-h2 text-text-primary mb-4">Self-ordering</h2>
        {selfSettings && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body-strong text-text-primary">Enable self-ordering</p>
                <p className="text-caption text-text-secondary">Allow customers to order from their phones</p>
              </div>
              <button
                onClick={() => toggleSelfSetting('enabled', !selfSettings.enabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${selfSettings.enabled ? 'bg-success' : 'bg-border'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${selfSettings.enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Mode</label>
              <select
                value={selfSettings.mode}
                onChange={(e) => toggleSelfSetting('mode', e.target.value)}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
              >
                <option value="online_ordering">Online ordering</option>
                <option value="qr_menu">QR menu</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
