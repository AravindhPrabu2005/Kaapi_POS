import { useState, useEffect } from 'react';
import { Download, Table2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSelfOrderingSettings, updateSelfOrderingSettings } from '../api/settings';
import { getTables } from '../api/tables';
import { downloadQrCodesPdf } from '../api/tables';
import { getFloors } from '../api/floors';
import DataTable from '../components/DataTable';

export default function SelfOrderAdmin() {
  const [settings, setSettings] = useState(null);
  const [tables, setTables] = useState([]);
  const [floors, setFloors] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadLoading, setDownloadLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      getSelfOrderingSettings(),
      getTables({ page_size: 100 }),
      getFloors(),
    ])
      .then(([sRes, tRes, fRes]) => {
        setSettings(sRes.data.data);
        setTables(tRes.data.data || []);
        setFloors(fRes.data.data || []);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const toggleEnabled = async () => {
    if (!settings) return;
    try {
      await updateSelfOrderingSettings({ enabled: !settings.enabled });
      toast.success(`Self-ordering ${!settings.enabled ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update');
    }
  };

  const changeMode = async (mode) => {
    try {
      await updateSelfOrderingSettings({ mode });
      toast.success(`Mode changed to ${mode === 'online_ordering' ? 'Online Ordering' : 'QR Menu'}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update');
    }
  };

  const handleDownloadQr = async () => {
    setDownloadLoading(true);
    try {
      const response = await downloadQrCodesPdf(selectedFloor || undefined);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `table-qr-codes${selectedFloor ? `-floor-${selectedFloor}` : ''}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('QR codes PDF downloaded');
    } catch (err) {
      toast.error('Failed to download QR codes');
    } finally {
      setDownloadLoading(false);
    }
  };

  const getFloorName = (id) => floors.find((f) => f.id === id)?.name || '—';

  const columns = [
    { key: 'table_number', label: 'Table #', render: (row) => <span className="font-semibold">{row.table_number}</span> },
    { key: 'floor', label: 'Floor', render: (row) => <span className="text-text-secondary">{getFloorName(row.floor?.id)}</span> },
    { key: 'seats', label: 'Seats' },
    {
      key: 'status', label: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
          row.status === 'occupied' ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'occupied' ? 'bg-warning' : 'bg-success'}`} />
          {row.status}
        </span>
      ),
    },
    {
      key: 'qr_token', label: 'QR URL',
      render: (row) => (
        <span className="text-caption text-text-disabled max-w-[200px] truncate block" title={row.qr_url}>
          {row.qr_url}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] space-y-6">
      <h1 className="text-display text-text-primary">Self Order</h1>

      {/* Settings card */}
      <div className="bg-bg-app border border-border rounded-md shadow-sm p-4">
        <h2 className="text-h2 text-text-primary mb-4">Settings</h2>
        {settings && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body-strong text-text-primary">Enable self-ordering</p>
                <p className="text-caption text-text-secondary">
                  Let customers place orders from their phones
                </p>
              </div>
              <button
                onClick={toggleEnabled}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings.enabled ? 'bg-success' : 'bg-border'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${settings.enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => changeMode('online_ordering')}
                  className={`flex-1 px-4 py-2.5 rounded-md text-body-strong border transition-colors ${
                    settings.mode === 'online_ordering'
                      ? 'bg-accent text-accent-on border-accent'
                      : 'bg-bg-app text-text-secondary border-border hover:border-accent'
                  }`}
                >
                  Online Ordering
                </button>
                <button
                  onClick={() => changeMode('qr_menu')}
                  className={`flex-1 px-4 py-2.5 rounded-md text-body-strong border transition-colors ${
                    settings.mode === 'qr_menu'
                      ? 'bg-accent text-accent-on border-accent'
                      : 'bg-bg-app text-text-secondary border-border hover:border-accent'
                  }`}
                >
                  QR Menu (View Only)
                </button>
              </div>
              <p className="text-caption text-text-secondary mt-2">
                {settings.mode === 'online_ordering'
                  ? 'Customers can browse menu and place orders'
                  : 'Customers can only view the menu — ordering is disabled'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* QR Codes card */}
      <div className="bg-bg-app border border-border rounded-md shadow-sm p-4">
        <h2 className="text-h2 text-text-primary mb-4">Download QR Codes</h2>
        <p className="text-caption text-text-secondary mb-4">
          Generate a PDF with QR codes for all active tables. Print, cut, and place on tables for customers to scan.
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="w-full sm:w-48">
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
            >
              <option value="">All floors</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleDownloadQr}
            disabled={downloadLoading}
            className="flex items-center gap-2 bg-accent text-accent-on rounded-md px-5 py-2.5 text-body-strong hover:bg-accent-hover disabled:bg-accent-soft disabled:text-text-disabled transition-colors"
          >
            <Download size={18} />
            {downloadLoading ? 'Generating...' : 'Download QR Codes PDF'}
          </button>
        </div>
      </div>

      {/* Tables list */}
      <div className="bg-bg-app border border-border rounded-md shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Table2 size={18} className="text-text-secondary" />
          <h2 className="text-h2 text-text-primary">Tables</h2>
          <span className="text-caption text-text-secondary ml-auto">{tables.length} table{tables.length !== 1 ? 's' : ''}</span>
        </div>
        <DataTable columns={columns} data={tables} loading={false} emptyMessage="No tables found" />
      </div>
    </div>
  );
}
