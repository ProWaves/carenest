// ==========================================================================
// Rating.jsx — Star Rating Component
// ==========================================================================
// Renders 1-5 clickable/interactive stars for reviews. Supports read-only
// display (no onChange), interactive selection, optional count label, and
// a lg size variant for detailed profile views.
// ==========================================================================

function Rating({ value = 0, onChange, size = 'default', count }) {
  const stars = [];
  const interactive = !!onChange;

  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span
        key={i}
        className={`star ${i <= Math.round(value) ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
        onClick={() => interactive && onChange(i)}
        style={interactive ? { cursor: 'pointer', fontSize: size === 'lg' ? '1.5rem' : '1rem' } : {}}
      >
        {String.fromCodePoint(9733)}
      </span>
    );
  }

  return (
    <div className="stars" style={size === 'lg' ? { fontSize: '1.2rem' } : {}}>
      {stars}
      {count !== undefined && <span>({count})</span>}
    </div>
  );
}

export default Rating;
