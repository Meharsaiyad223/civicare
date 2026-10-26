import { BrainCircuit, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';

export default function MemoryCard({ memory, loading = false, compact = false }) {
  if (loading) return <div className="panel-card animate-pulse h-36" />;
  if (!memory) {
    return (
      <div className="panel-card memory-card">
        <div className="memory-icon"><BrainCircuit size={18} /></div>
        <div><h3>Location memory</h3><p>No civic history is recorded for this geo-cell yet.</p></div>
      </div>
    );
  }
  const summary = memory.memorySummary || 'This location is building a history as reports and repair outcomes arrive.';
  const held = memory.outcomes?.held || 0;
  const failed = memory.outcomes?.failed || 0;
  return (
    <section className={`panel-card memory-card ${compact ? 'memory-compact' : ''}`}>
      <div className="memory-card-top">
        <div className="memory-icon"><BrainCircuit size={18} /></div>
        <div className="memory-heading"><h3>Civic memory</h3><span>Geo-cell {memory.cellId}</span></div>
        <Sparkles size={16} className="memory-spark" />
      </div>
      <p className="memory-summary">{summary}</p>
      <div className="memory-metrics">
        <div><span className="metric-icon"><RotateCcw size={14} /></span><strong>{memory.recurrenceCount || 0}</strong><small>recurrences</small></div>
        <div><span className="metric-icon"><ShieldCheck size={14} /></span><strong>{memory.riskWeight?.toFixed?.(2) || '1.00'}×</strong><small>risk weight</small></div>
      </div>
      {!compact && <div className="memory-outcomes"><span>{held} repairs held</span><span>{failed} repeat failures</span><span>{memory.reportCount || 0} reports remembered</span></div>}
    </section>
  );
}
