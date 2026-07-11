import { useState, useRef } from 'react';
import { SkipForward, Check, GripVertical } from 'lucide-react';

const DEFAULT_STAGES = ['to_cook', 'preparing', 'completed'];
const DEFAULT_LABELS = { to_cook: 'To cook', preparing: 'Preparing', completed: 'Completed' };
const DEFAULT_COLORS = { to_cook: 'border-l-danger', preparing: 'border-l-warning', completed: 'border-l-success' };
const DEFAULT_BG = { to_cook: 'bg-danger-bg', preparing: 'bg-warning-bg', completed: 'bg-success-bg' };


export default function KdsBoard({
  tickets,
  loading,
  onAdvance,
  onItemComplete,
  stages = DEFAULT_STAGES,
  stageLabels = DEFAULT_LABELS,
  stageColors = DEFAULT_COLORS,
  stageBg = DEFAULT_BG,
  renderTicketHeader,
  className = '',
  ticketClassName = '',
}) {
  const [dragTicketId, setDragTicketId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const dragNode = useRef(null);

  const grouped = {};
  stages.forEach((s) => {
    let filtered = tickets.filter((t) => t.stage === s);
    if (s === 'completed') {
      filtered = [...filtered].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }
    grouped[s] = filtered;
  });

  const handleDragStart = (e, ticketId, currentStage) => {
    setDragTicketId(ticketId);
    dragNode.current = { id: ticketId, stage: currentStage };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ticketId);
  };

  const handleDragEnd = () => {
    setDragTicketId(null);
    setDragOverStage(null);
    dragNode.current = null;
  };

  const handleDragOver = (e, stage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragNode.current && stage !== dragOverStage) {
      setDragOverStage(stage);
    }
  };

  const handleDragLeave = (e, stage) => {
    if (dragOverStage === stage) {
      setDragOverStage(null);
    }
  };

  const handleDrop = (e, targetStage) => {
    e.preventDefault();
    const source = dragNode.current;
    if (!source) return;

    setDragOverStage(null);

    const currentIdx = stages.indexOf(source.stage);
    const targetIdx = stages.indexOf(targetStage);

    if (targetStage === source.stage) return;
    if (targetIdx <= currentIdx) return;

    onAdvance?.(source.id, targetStage);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      {stages.map((stage) => {
        const isOver = dragOverStage === stage;
        return (
          <div
            key={stage}
            onDragOver={(e) => handleDragOver(e, stage)}
            onDragLeave={(e) => handleDragLeave(e, stage)}
            onDrop={(e) => handleDrop(e, stage)}
            className={`flex flex-col rounded-lg overflow-hidden transition-colors duration-150 ${
              isOver ? 'bg-bg-subtle ring-2 ring-accent' : 'bg-bg-subtle'
            }`}
          >
            <div className={`${stageBg[stage]} px-4 py-3`}>
              <h2 className="text-h2 text-text-primary">{stageLabels[stage]}</h2>
              <p className="text-caption text-text-secondary">{grouped[stage]?.length || 0} tickets</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {grouped[stage]?.length === 0 && (
                <p className="text-caption text-text-disabled text-center py-8">No tickets</p>
              )}
              {grouped[stage]?.map((ticket) => {
                const isDragging = dragTicketId === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    draggable={stage !== 'completed'}
                    onDragStart={(e) => handleDragStart(e, ticket.id, ticket.stage)}
                    onDragEnd={handleDragEnd}
                    className={`bg-bg-app rounded-md shadow-sm border-l-4 ${stageColors[stage]} p-3 transition-all duration-150 ${
                      isDragging ? 'opacity-40 scale-95' : 'opacity-100'
                    } ${stage !== 'completed' ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : ''} ${ticketClassName}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {stage !== 'completed' && <GripVertical size={14} className="text-text-disabled shrink-0" />}
                        <span className="text-price-lg text-text-primary truncate">#{ticket.ticket_number}</span>
                        {renderTicketHeader?.(ticket)}
                      </div>
                      {stage !== 'completed' && (
                        <button
                          onClick={() => onAdvance?.(ticket.id)}
                          className="shrink-0 flex items-center gap-1 text-caption text-accent hover:text-accent-hover"
                        >
                          <SkipForward size={14} /> {stage === 'to_cook' ? 'Start' : 'Complete'}
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {ticket.items?.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-body">
                          <div className="flex items-center gap-2 min-w-0">
                            {stage === 'completed' ? (
                              <span className="text-text-disabled line-through truncate">{item.product_name}</span>
                            ) : (
                              <span className="text-text-primary truncate">{item.product_name}</span>
                            )}
                            <span className="text-caption text-text-secondary shrink-0">×{item.quantity}</span>
                          </div>
                          {!item.completed && stage !== 'completed' && (
                            <button
                              onClick={() => onItemComplete?.(ticket.id, item.id)}
                              className="shrink-0 text-text-secondary hover:text-success"
                            >
                              <Check size={16} />
                            </button>
                          )}
                          {item.completed && <Check size={16} className="shrink-0 text-success" />}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
