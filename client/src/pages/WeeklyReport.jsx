import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CalendarDays, Download, Sparkles, WandSparkles } from 'lucide-react';
import { format } from 'date-fns';
import { api, getApiError } from '../services/api.js';
import { CategoryChart, RecurrenceStat } from '../components/Charts.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function WeeklyReport() {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function loadLatest() {
    try { const result = await api.latestWeekly(); setReport(result.report); setError(''); }
    catch (requestError) { setReport(null); if (requestError?.response?.status !== 404) setError(getApiError(requestError)); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadLatest(); }, []);
  async function generate() {
    setBusy(true); setError('');
    try { const result = await api.generateWeekly(); setReport(result.report); }
    catch (requestError) { setError(getApiError(requestError)); }
    finally { setBusy(false); }
  }
  const stats = report?.statistics || {};
  return (
    <div className="page-wrap weekly-page">
      <header className="page-header-row"><div><span className="eyebrow">OFFICER BRIEFING · SPRINGFIELD</span><h1>Weekly city report</h1><p className="muted">A plain-English read on the city’s most important repair signals.</p></div><div className="header-actions"><a className="button button-quiet" href={user?.role === 'officer' ? '/officer' : '/citizen'}><ArrowLeft size={15} /> Back</a>{user?.role === 'officer' && <button className="button weekly-generate-button" onClick={generate} disabled={busy}>{busy ? <span className="spinner" /> : <WandSparkles size={16} />}{busy ? 'Generating summary…' : 'Generate summary'}</button>}</div></header>
      {error && <div className="page-alert">{error}</div>}
      {loading ? <div className="panel-card loading-line">Loading the latest weekly briefing…</div> : report ? <>
        <section className="weekly-hero"><div className="weekly-hero-top"><span className="weekly-ai-badge"><Sparkles size={14} /> {report.aiProvider === 'gemini' ? 'GEMINI AI SUMMARY' : report.aiProvider === 'openai' ? 'OPENAI AI SUMMARY' : report.aiProvider === 'openrouter' ? 'OPENROUTER AI SUMMARY' : 'CITYPULSE AI SUMMARY'}</span><span><CalendarDays size={14} /> {format(new Date(report.periodStart), 'MMM d')} — {format(new Date(report.periodEnd), 'MMM d, yyyy')}</span></div><h2>What the city needs to know</h2><p>{report.narrative}</p><div className="weekly-hero-footer"><span>Generated {format(new Date(report.createdAt), 'MMM d, yyyy · h:mm a')}</span><span>Based on {stats.totalReports || 0} reports this week</span></div></section>
        <section className="weekly-stat-grid"><article><small>REPORTS THIS WEEK</small><strong>{stats.totalReports || 0}</strong><span className={stats.weekOverWeekChange > 0 ? 'text-danger' : 'text-mint'}>{stats.weekOverWeekChange > 0 ? '+' : ''}{stats.weekOverWeekChange || 0}% vs prior week</span></article><article><small>RECURRENCE RATE</small><strong>{Number(stats.recurrenceRate || 0).toFixed(1)}%</strong><span>{stats.recurrenceCount || 0} repeat reports</span></article><article><small>REPAIRS COMPLETED</small><strong>{stats.repairsCompleted || 0}</strong><span>{stats.repairRecurrences || 0} repeat failures recorded</span></article></section>
        <div className="weekly-grid"><CategoryChart counts={stats.categoryCounts} /><section className="panel-card weekly-hotspots"><div className="section-heading"><div><p className="eyebrow">NEEDS A CLOSER LOOK</p><h3>Top hotspots</h3></div><a href="/map" className="text-link">Open map <ArrowUpRight size={14} /></a></div>{stats.topHotspots?.length ? stats.topHotspots.map((spot, index) => <div className="hotspot-row" key={spot.cellId}><span className="hotspot-rank">{String(index + 1).padStart(2, '0')}</span><div><strong>{spot.label || spot.cellId}</strong><small>{spot.reportCount} reports · average priority {spot.averagePriority}</small></div><span className="hotspot-score">{spot.reportCount}</span></div>) : <p className="muted">No report clusters were found in this period.</p>}</section></div>
        <section className="panel-card recommendations"><div className="section-heading"><div><p className="eyebrow">NEXT STEPS</p><h3>Recommended actions</h3></div><span className="action-count">{report.recommendations?.length || 0} actions</span></div><div className="recommendation-list">{(report.recommendations || []).map((action, index) => <div className="recommendation-row" key={action}><span>{String(index + 1).padStart(2, '0')}</span><p>{action}</p><ArrowUpRight size={15} /></div>)}</div></section>
      </> : <section className="panel-card empty-weekly"><span className="empty-weekly-icon"><Sparkles size={21} /></span><h2>No weekly briefing yet</h2><p>Generate the first officer summary from current city reports and repair outcomes.</p>{user?.role === 'officer' && <button className="button weekly-generate-button" onClick={generate} disabled={busy}>{busy ? <span className="spinner" /> : <WandSparkles size={15} />}{busy ? 'Generating summary…' : 'Generate summary'}</button>}</section>}
    </div>
  );
}
