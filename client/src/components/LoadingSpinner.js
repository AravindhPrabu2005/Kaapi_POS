export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-app">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" />
    </div>
  );
}
