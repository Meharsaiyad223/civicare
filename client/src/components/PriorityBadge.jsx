export default function PriorityBadge({ score = 0, compact = false }) {
  const tone = score >= 75 ? 'priority-high' : score >= 45 ? 'priority-medium' : 'priority-low';
  return (
    <span className={`priority-badge ${tone} ${compact ? 'priority-compact' : ''}`}>
      <span className="priority-dot" />
      {compact ? score : `Priority ${score}`}
    </span>
  );
}
