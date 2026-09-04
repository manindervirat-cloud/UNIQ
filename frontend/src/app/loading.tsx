export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="skeleton h-40" />
      <div className="skeleton h-72" />
      <p className="text-center text-sm text-ink-faint">One moment…</p>
    </div>
  );
}
