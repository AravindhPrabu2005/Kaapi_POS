import { useState, useEffect, useCallback } from 'react';
import { ChefHat } from 'lucide-react';
import { getPublicTickets, advancePublicTicket, markPublicItemComplete } from '../api/kdsPublic';
import KdsBoard from '../components/KdsBoard';

const stageLabels = { to_cook: 'To Cook', preparing: 'Preparing', completed: 'Prepared' };

export default function KitchenDisplay() {
  const [tickets, setTickets] = useState([]);

  const fetchTickets = useCallback(() => {
    getPublicTickets({ page_size: 100 })
      .then(({ data }) => setTickets(data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 10000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const handleAdvance = async (id, targetStage) => {
    try {
      await advancePublicTicket(id, targetStage);
      fetchTickets();
    } catch { /* ignore */ }
  };

  const handleItemDone = async (ticketId, itemId) => {
    try {
      await markPublicItemComplete(ticketId, itemId);
      fetchTickets();
    } catch { /* ignore */ }
  };

  const renderTicketHeader = (ticket) => {
    if (!ticket.table_number) return null;
    return <span className="text-caption text-text-secondary ml-2">Table {ticket.table_number}</span>;
  };

  return (
    <div className="h-screen w-screen bg-bg-cream flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border-strong shrink-0 bg-accent-soft/40">
        <div className="flex items-center gap-3">
          <ChefHat size={28} className="text-accent" />
          <h1 className="text-display text-text-primary">Kitchen Display</h1>
        </div>
        <div className="flex items-center gap-4 text-caption text-text-secondary">
          <span>{tickets.length} tickets</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        </div>
      </header>

      <div className="flex-1 min-h-0 p-4">
        <KdsBoard
          tickets={tickets}
          loading={false}
          onAdvance={handleAdvance}
          onItemComplete={handleItemDone}
          stageLabels={stageLabels}
          renderTicketHeader={renderTicketHeader}
          className="h-full"
        />
      </div>
    </div>
  );
}
