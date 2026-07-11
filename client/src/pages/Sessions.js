import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getSessions, openSession, closeSession, getActiveSession } from '../api/sessions';
import { Play, Square } from 'lucide-react';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export default function Sessions() {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [confirmClose, setConfirmClose] = useState(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      getSessions({ page, page_size: 20, sort_by: 'opened_at', sort_dir: 'desc' }),
      getActiveSession().catch(() => null),
    ])
      .then(([sRes, active]) => {
        setData(sRes.data.data);
        setMeta(sRes.data.meta);
        setActiveSession(active?.data?.data || null);
      })
      .catch(() => toast.error('Failed to load sessions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpen = async () => {
    try {
      await openSession({ opening_amount: parseFloat(openingAmount) || 0 });
      toast.success('Session opened');
      setOpenModal(false);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed to open session'); }
  };

  const handleClose = async () => {
    if (!confirmClose) return;
    try {
      await closeSession(confirmClose, { closing_amount: parseFloat(closingAmount) || 0 });
      toast.success('Session closed');
      setCloseModal(false);
      setConfirmClose(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed to close session'); }
  };

  const columns = [
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} label={row.status} /> },
    { key: 'opened_at', label: 'Opened', render: (row) => new Date(row.opened_at).toLocaleString() },
    { key: 'closed_at', label: 'Closed', render: (row) => row.closed_at ? new Date(row.closed_at).toLocaleString() : '—' },
  ];

  return (
    <div className="max-w-[1280px]">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-display text-text-primary">Sessions</h1>
        {activeSession ? (
          <button onClick={() => { setConfirmClose(activeSession.id); setCloseModal(true); }} className="flex items-center gap-2 border border-danger text-danger rounded-md px-4 py-2.5 text-body-strong hover:bg-danger-bg">
            <Square size={18} /> Close session
          </button>
        ) : (
          <button onClick={() => setOpenModal(true)} className="flex items-center gap-2 bg-accent text-accent-on rounded-md px-4 py-2.5 text-body-strong hover:bg-accent-hover">
            <Play size={18} /> Open session
          </button>
        )}
      </div>

      {activeSession && (
        <div className="bg-success-bg border border-success/30 rounded-md p-4 mb-5 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
          <span className="text-body text-text-primary">
            Active session opened {new Date(activeSession.opened_at).toLocaleString()}
          </span>
        </div>
      )}

      <div className="bg-bg-app border border-border rounded-md shadow-sm">
        <DataTable columns={columns} data={data} meta={meta} onPageChange={setPage} loading={loading} emptyMessage="No sessions yet" />
      </div>

      {openModal && (
        <Modal title="Open session" onClose={() => setOpenModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Opening amount (₹)</label>
              <input type="number" step="0.01" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
            </div>
            <button onClick={handleOpen} className="w-full bg-accent text-accent-on rounded-md py-2.5 text-body-strong hover:bg-accent-hover">Open session</button>
          </div>
        </Modal>
      )}

      {closeModal && (
        <Modal title="Close session" onClose={() => setCloseModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-body-strong text-text-primary block mb-1">Closing amount (₹)</label>
              <input type="number" step="0.01" value={closingAmount} onChange={(e) => setClosingAmount(e.target.value)} className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft" />
            </div>
            <button onClick={handleClose} className="w-full bg-danger text-white rounded-md py-2.5 text-body-strong hover:bg-danger/90">Close session</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
