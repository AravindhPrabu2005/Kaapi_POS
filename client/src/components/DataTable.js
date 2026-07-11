import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function DataTable({ columns, data, meta, onPageChange, loading, onRowClick, emptyMessage = 'No data found' }) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="text-center py-10 text-text-secondary text-body">{emptyMessage}</div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th key={col.key} className="text-left py-3 px-3 text-text-secondary font-semibold text-caption uppercase tracking-wide">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={row.id || i}
                className={`border-b border-border ${onRowClick ? 'cursor-pointer hover:bg-bg-subtle' : ''} ${i % 2 === 1 ? 'bg-bg-subtle' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="py-3 px-3 text-text-primary">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && (
        <div className="flex items-center justify-between pt-4 text-caption text-text-secondary">
          <span>Page {meta.page} of {meta.total_pages}</span>
          <div className="flex gap-2">
            <button
              disabled={meta.page <= 1}
              onClick={() => onPageChange?.(meta.page - 1)}
              className="p-1 disabled:opacity-40 hover:text-text-primary"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              disabled={meta.page >= meta.total_pages}
              onClick={() => onPageChange?.(meta.page + 1)}
              className="p-1 disabled:opacity-40 hover:text-text-primary"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
