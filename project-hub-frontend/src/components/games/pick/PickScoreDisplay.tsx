/** Comfort 1–5 as five small dots (filled = level). */
export default function PickScoreDisplay({ rating }: { rating: number | null }) {
  if (rating == null) {
    return <span className="pick-results-score-muted">No response</span>;
  }
  return (
    <div className="pick-results-score-dots" aria-label={`${rating} out of 5 comfort`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={`pick-results-score-dot${n <= rating ? ' pick-results-score-dot--on' : ''}`} />
      ))}
      <span className="pick-results-score-num">{rating}/5</span>
    </div>
  );
}
