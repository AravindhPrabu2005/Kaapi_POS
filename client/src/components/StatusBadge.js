const statusStyles = {
  draft: 'bg-warning-bg text-warning',
  paid: 'bg-success-bg text-success',
  cancelled: 'bg-danger-bg text-danger',
  'to_cook': 'bg-danger-bg text-danger',
  preparing: 'bg-warning-bg text-warning',
  completed: 'bg-success-bg text-success',
  active: 'bg-success-bg text-success',
  open: 'bg-success-bg text-success',
  closed: 'bg-bg-subtle text-text-secondary',
};

export default function StatusBadge({ status, label }) {
  const style = statusStyles[status] || 'bg-bg-subtle text-text-secondary';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-caption font-semibold ${style}`}>
      {label || status}
    </span>
  );
}
