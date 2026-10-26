import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Clock3, FileText, MapPinned, Plus, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ReportForm from '../components/ReportForm.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';
import { CategoryChart } from '../components/Charts.jsx';
import { api, getApiError } from '../services/api.js';
import MapView from '../components/MapView.jsx';
import ReportProgress from '../components/ReportProgress.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const statusLabels = { open: 'Received', acknowledged: 'Acknowledged', in_progress: 'In progress', repaired: 'Repaired', closed: 'Closed' };

function citizenReportStatus(report) {
  if (['completion_submitted', 'verified'].includes(report.workOrder?.status)) return 'Contractor completed';
  return statusLabels[report.status] || report.status;
}

export default function CitizenDashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { const result = await api.listReports({ mine: true, limit: 50 }); setReports(result.reports || []); setError(''); }
    catch (requestError) { setError(getApiError(requestError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(interval);
  }, [refresh]);
  const openCount = reports.filter((report) => !['repaired', 'closed'].includes(report.status)).length;
  const fixedCount = reports.filter((report) => report.status === 'repaired' || report.status === 'closed').length;
  const recentLocatedReport = reports.find((report) => report.location?.coordinates?.length === 2);
  const defaultMapCenter = recentLocatedReport ? [recentLocatedReport.location.coordinates[1], recentLocatedReport.location.coordinates[0]] : undefined;

  return (
    <div className="page-wrap dashboard-page">
      <header className="welcome-row"><div><span className="eyebrow">CITIZEN SPACE · SPRINGFIELD</span><h1>Good morning, {user?.name?.split(' ')[0] || 'neighbor'} <span className="wave">✳</span></h1><p className="muted">A small report can help make a whole block safer.</p></div><a className="button button-primary" href="#report"><Plus size={17} /> Report an issue</a></header>
      <section className="citizen-stat-grid">
        <article className="stat-card"><span className="stat-icon stat-mint"><FileText size={18} /></span><div><small>YOUR REPORTS</small><strong>{loading ? '—' : reports.length}</strong><span>submitted to the city</span></div><ArrowUpRight className="stat-corner" size={16} /></article>
        <article className="stat-card"><span className="stat-icon stat-amber"><Clock3 size={18} /></span><div><small>IN PROGRESS</small><strong>{loading ? '—' : openCount}</strong><span>being reviewed or repaired</span></div><ArrowUpRight className="stat-corner" size={16} /></article>
        <article className="stat-card"><span className="stat-icon stat-blue"><CheckCircle2 size={18} /></span><div><small>RESOLVED</small><strong>{loading ? '—' : fixedCount}</strong><span>closed or repaired</span></div><ArrowUpRight className="stat-corner" size={16} /></article>
        <article className="stat-card stat-tip"><span className="tip-spark"><Sparkles size={18} /></span><small>COMMUNITY NOTE</small><p>Photo reports help crews identify patterns sooner.</p><a href="#report">Share what you see <ArrowUpRight size={13} /></a></article>
      </section>
      {error && <div className="page-alert">{error}</div>}
      <div className="citizen-layout">
        <div className="citizen-main-column">
          <section className="panel-card history-card"><div className="section-heading"><div><p className="eyebrow">YOUR ACTIVITY</p><h2>Recent reports</h2><p className="muted citizen-progress-refresh-note">Task progress refreshes automatically.</p></div><span className="count-pill">{reports.length} total</span></div>
            {loading ? <div className="loading-line">Loading your reports…</div> : reports.length ? <div className="report-list">{reports.map((report) => <article className="report-row" key={report._id}><span className={`report-symbol issue-${report.category}`}><MapPinned size={16} /></span><div className="report-row-main"><div className="report-title-row"><strong>{report.address || report.description}</strong><PriorityBadge score={report.priorityScore} compact /></div><p>{report.description}</p><span className="report-row-meta">{report.category.replaceAll('_', ' ')} · {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}</span><ReportProgress report={report} /></div><span className={`status-pill status-${report.status}`}>{citizenReportStatus(report)}</span></article>)}</div> : <div className="empty-state"><span><FileText size={20} /></span><strong>Your first report makes a difference.</strong><p>Use the form to let your city know what needs attention.</p></div>}
          </section>
          <section className="panel-card map-preview-card"><div className="section-heading"><div><p className="eyebrow">AROUND YOUR CITY</p><h2>What neighbors are reporting</h2></div><a className="text-link" href="/map">Explore full map <ArrowUpRight size={15} /></a></div><MapView compact /></section>
          <CategoryChart reports={reports} />
        </div>
        <aside className="citizen-side-column"><div id="report"><ReportForm onCreated={refresh} defaultMapCenter={defaultMapCenter} /></div><div className="support-card"><span><Sparkles size={17} /></span><div><strong>Every report becomes part of the picture.</strong><p>CityPulse looks for repeat issues so the city can focus on lasting fixes.</p></div></div></aside>
      </div>
    </div>
  );
}
