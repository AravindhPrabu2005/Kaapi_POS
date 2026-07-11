import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, children, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(43,37,32,0.4)]" onClick={onClose} />
      <div className="relative bg-bg-app rounded-lg shadow-lg p-5 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h1 text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-1">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
