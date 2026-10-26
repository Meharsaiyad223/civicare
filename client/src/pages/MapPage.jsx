import { useState } from 'react';
import { ArrowLeft, MapPinned } from 'lucide-react';
import MapView from '../components/MapView.jsx';
import MemoryCard from '../components/MemoryCard.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function MapPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  const [memory, setMemory] = useState(null);
  async function selectReport(id) {
    setSelected(id);
    try {
      const { report } = await api.getReport(id);
      const result = await api.getMemory(report.cellId);
      setMemory(result.memory);
    } catch { setMemory(null); }
  }
  return (
    <div className="page-wrap map-page">
      <header className="page-header-row"><div><span className="eyebrow">CITYWIDE VIEW</span><h1><MapPinned size={25} /> Live hotspot map</h1><p className="muted">Explore active reports, issue density, and repair history across Springfield.</p></div><a className="button button-quiet" href={user?.role === 'officer' ? '/officer' : '/citizen'}><ArrowLeft size={15} /> Back to dashboard</a></header>
      <div className="map-page-layout"><div className="map-main"><MapView onReportSelect={selectReport} /><div className="map-insight-strip"><div><span className="insight-mark">↗</span><div><small>HOW TO READ THIS MAP</small><p>Marker colors show issue severity. The soft overlay highlights report density by 100 m area.</p></div></div><span className="map-refresh-copy">Updates every 30 seconds</span></div></div><aside className="map-aside"><MemoryCard memory={memory} /><div className="panel-card map-help-card"><span className="help-icon">i</span><div><strong>{selected ? 'Report selected' : 'Select a report'}</strong><p>{selected ? 'Civic memory for this location is shown above.' : 'Choose a marker to inspect its history and recurrence signals.'}</p></div></div><div className="panel-card map-help-card"><span className="help-icon help-mint">⌖</span><div><strong>Prioritize repeat trouble spots</strong><p>Memory helps officers distinguish a new issue from a location that may need a lasting repair.</p></div></div></aside></div>
    </div>
  );
}
