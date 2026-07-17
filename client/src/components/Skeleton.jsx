// ==========================================================================
// Skeleton.jsx — Loading Placeholder Components
// ==========================================================================
// Renders shimmer-animated placeholder cards while data is being fetched.
// SkeletonCard: single placeholder matching a BabysitterCard layout.
// SkeletonList: renders a grid of N skeleton cards (default 6).
// Both disable pointer events to prevent interaction during loading.
// ==========================================================================

function SkeletonCard() {
  return (
    <div className="babysitter-card" style={{ pointerEvents: 'none' }}>
      <div className="babysitter-card-header">
        <div className="skeleton skeleton-avatar" />
        <div className="skeleton skeleton-text short" style={{ width: 60 }} />
      </div>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-text short" />
      <div className="skeleton skeleton-text" />
      <div className="card-details" style={{ marginTop: 12 }}>
        <div className="skeleton skeleton-text short" style={{ width: 80 }} />
        <div className="skeleton skeleton-text short" style={{ width: 60 }} />
      </div>
    </div>
  );
}

function SkeletonList({ count = 6 }) {
  return (
    <div className="babysitter-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export { SkeletonCard, SkeletonList };
