import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getKdsTickets, advanceTicket, markItemComplete } from '../api/kds';
import { ChefHat } from 'lucide-react';
import KdsBoard from '../components/KdsBoard';

export default function KDSTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = () => {
    setLoading(true);
    getKdsTickets({ page_size: 100 })
      .then(({ data }) => setTickets(data.data || []))
      .catch(() => toast.error('Failed to load KDS tickets'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTickets(); const id = setInterval(fetchTickets, 10000); return () => clearInterval(id); }, []);

  const handleAdvance = async (id, targetStage) => {
    try {
      await advanceTicket(id, targetStage);
      toast.success(targetStage ? 'Ticket moved' : 'Ticket advanced');
      fetchTickets();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
  };

  const handleItemComplete = async (ticketId, itemId) => {
    try {
      await markItemComplete(ticketId, itemId);
      fetchTickets();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
  };

  return (
    <div className="h-full">
      <div className="flex items-center gap-3 mb-5">
        <ChefHat size={28} className="text-accent" />
        <h1 className="text-display text-text-primary">Kitchen Display</h1>
      </div>

      <KdsBoard
        tickets={tickets}
        loading={loading}
        onAdvance={handleAdvance}
        onItemComplete={handleItemComplete}
        className="h-[calc(100vh-12rem)]"
      />
    </div>
  );
}
