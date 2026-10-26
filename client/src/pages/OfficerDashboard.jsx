import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck, CheckCircle2, ClipboardList, MapPinned, RefreshCw, Send, Wrench, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api, getApiError } from '../services/api.js';
import PriorityBadge from '../components/PriorityBadge.jsx';
import { CategoryChart, RecurrenceStat } from '../components/Charts.jsx';
import MemoryCard from '../components/MemoryCard.jsx';

export default function OfficerDashboard() {
  const [reports, setReports] = useState([]);
  const [recentReports, setRecentReports] = useState([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [contractors, setContractors] = useState([]);
  const [contractorAccounts, setContractorAccounts] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [assignmentReport, setAssignmentReport] = useState(null);
  const [assignment, setAssignment] = useState({ contractorId: '', instructions: 'Inspect and repair the reported issue. Add a completion note when the work is finished.', dueDate: '' });

  const refresh = useCallback(async ({ announce = false } = {}) => {
    setRefreshing(true);
    try {
      const [queueResult, qualityResult, ordersResult, accountsResult] = await Promise.allSettled([
        api.officerQueue({ limit: 200 }),
        api.contractorQuality(),
        api.listWorkOrders(),
        api.listContractors(),
      ]);
      if (queueResult.status === 'rejected') throw queueResult.reason;
      const queue = queueResult.value;
      setReports(queue.reports || []);
      setRecentReports(queue.recentReports || []);
      setQueueTotal(queue.total ?? queue.reports?.length ?? 0);
      if (qualityResult.status === 'fulfilled') setContractors(qualityResult.value.contractors || []);
      if (ordersResult.status === 'fulfilled') setWorkOrders(ordersResult.value.workOrders || []);
      if (accountsResult.status === 'fulfilled') {
        const accounts = accountsResult.value;
        setContractorAccounts(accounts.contractors || []);
        setAssignment((current) => ({ ...current, contractorId: current.contractorId || accounts.contractors?.[0]?._id || '' }));
      }
      const optionalFailure = [qualityResult, ordersResult, accountsResult].find((result) => result.status === 'rejected');
      setError(optionalFailure ? `The queue refreshed, but some other dashboard data could not refresh: ${getApiError(optionalFailure.reason)}` : '');
      if (announce) setNotice('Report queue refreshed.');
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    let active = true;
    const refreshLiveData = async () => {
      try {
        const [queue, orders] = await Promise.all([
          api.officerQueue({ limit: 200 }),
          api.listWorkOrders(),
        ]);
        if (!active) return;
        setReports(queue.reports || []);
        setRecentReports(queue.recentReports || []);
        setQueueTotal(queue.total ?? queue.reports?.length ?? 0);
        setWorkOrders(orders.workOrders || []);
      } catch { /* Keep the last loaded city data if a poll is interrupted. */ }
    };
    const interval = window.setInterval(refreshLiveData, 15_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  async function assignContractor(event) {
    event.preventDefault();
    if (!assignmentReport) return;
    setBusyId(assignmentReport._id);
    setError('');
    setNotice('');
    try {
      await api.assignWorkOrder({ reportId: assignmentReport._id, ...assignment, dueDate: assignment.dueDate || undefined });
      setNotice(`Work order sent to ${contractorAccounts.find((item) => item._id === assignment.contractorId)?.name || 'the contractor'}.`);
      setAssignmentReport(null);
      await refresh();
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setBusyId(''); }
  }

  async function verifyCompletion(order) {
    setBusyId(order._id);
    setError('');
    setNotice('');
    try {
      await api.verifyWorkOrder(order._id);
      setNotice('Contractor completion verified and the report marked repaired.');
      await refresh();
    } catch (requestError) { setError(getApiError(requestError)); }
    finally { setBusyId(''); }
  }

  const recurrenceCount = reports.filter((report) => report.isRecurrence).length;
  const recurringCell = reports.find((report) => report.isRecurrence)?.cellId || reports[0]?.cellId;
  const top = reports[0];
  const activeReportIds = new Set(workOrders.filter((order) => ['assigned', 'completion_submitted'].includes(order.status)).map((order) => order.report?._id));
  const reviewOrders = workOrders.filter((order) => order.status !== 'verified');
  const newestReport = recentReports[0];

  return (
    <div className="page-wrap dashboard-page officer-page">
      <header className="welcome-row officer-welcome"><div><span className="eyebrow">MUNICIPAL OPERATIONS · SPRINGFIELD</span><h1>Good morning, team <span className="wave">✳</span></h1><p className="muted">A clear view of what needs attention and what keeps coming back.</p></div><div className="header-actions"><button className="button button-quiet" onClick={() => refresh({ announce: true })} disabled={refreshing}><RefreshCw size={15} />{refreshing ? 'Refreshing queue…' : 'Refresh queue'}</button><a className="button button-primary" href="/weekly">Weekly briefing <ArrowUpRight size={15} /></a></div></header>
      {error && <div className="page-alert">{error}</div>}
      {notice && <div className="contractor-success"><CheckCircle2 size={16} />{notice}</div>}
      {!loading && !contractorAccounts.length && <div className="page-alert">No contractor demo accounts are in this database yet. From the project folder, run <code>npm run seed:contractors</code> to add them without replacing your reports.</div>}
      <section className="officer-stat-grid">
        <article className="officer-stat-card"><span className="officer-stat-icon icon-mint"><ClipboardList size={18} /></span><div><small>OPEN QUEUE</small><strong>{loading ? '—' : queueTotal}</strong><span>awaiting city action</span></div><div className="stat-trend">Live</div></article>
        <article className="officer-stat-card"><span className="officer-stat-icon icon-amber"><MapPinned size={18} /></span><div><small>TOP PRIORITY</small><strong>{loading ? '—' : top?.priorityScore ?? '—'}</strong><span>{top?.address || 'No current reports'}</span></div><PriorityBadge compact score={top?.priorityScore || 0} /></article>
        <article className="officer-stat-card"><span className="officer-stat-icon icon-coral"><Wrench size={18} /></span><div><small>REPEAT ISSUES</small><strong>{loading ? '—' : recurrenceCount}</strong><span>within the active queue</span></div><a className="stat-corner" href="/map"><ArrowUpRight size={16} /></a></article>
        <article className="officer-stat-card"><span className="officer-stat-icon icon-blue"><BadgeCheck size={18} /></span><div><small>CONTRACTOR RECORD</small><strong>{contractors.length}</strong><span>crews with tracked outcomes</span></div></article>
      </section>
      <div className="officer-dashboard-grid">
        <section className="panel-card queue-card"><div className="section-heading"><div><p className="eyebrow">ACTION REQUIRED</p><h2>Priority queue</h2></div><a className="text-link" href="/map">Open live map <ArrowUpRight size={15} /></a></div>
          {newestReport && <article className="latest-citizen-report"><div className="latest-citizen-report-main"><span className="latest-citizen-report-label">LATEST CITIZEN REPORT</span><strong>{newestReport.address || newestReport.description}</strong><p>{newestReport.description}</p><small>{newestReport.category?.replaceAll('_', ' ')} · Severity {newestReport.severity}/5 · {formatDistanceToNow(new Date(newestReport.createdAt), { addSuffix: true })}</small></div><PriorityBadge compact score={newestReport.priorityScore || 0} /><button className="assign-action" disabled={busyId === newestReport._id || activeReportIds.has(newestReport._id) || !contractorAccounts.length} onClick={() => setAssignmentReport(newestReport)} title={activeReportIds.has(newestReport._id) ? 'A contractor already has this work order' : 'Assign this latest citizen report'}>{activeReportIds.has(newestReport._id) ? 'Assigned' : <><Wrench size={14} /> Assign</>}</button></article>}
          {loading ? <div className="loading-line">Loading the city queue…</div> : reports.length ? <div className="queue-list">{reports.slice(0, 10).map((report, index) => <article className="queue-row" key={report._id}><span className="queue-rank">{String(index + 1).padStart(2, '0')}</span><span className={`report-symbol issue-${report.category}`}><MapPinned size={16} /></span><div className="queue-row-content"><div className="report-title-row"><strong>{report.address || report.description}</strong>{report.isRecurrence && <span className="recurred-label">REOCCURRED</span>}</div><p>{report.description}</p><span className="report-row-meta">{report.category.replaceAll('_', ' ')} · severity {report.severity}/5 · {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}</span></div><PriorityBadge score={report.priorityScore} compact /><button className="assign-action" disabled={busyId === report._id || activeReportIds.has(report._id) || !contractorAccounts.length} onClick={() => setAssignmentReport(report)} title={activeReportIds.has(report._id) ? 'A contractor already has this work order' : 'Assign this report to a contractor'}>{activeReportIds.has(report._id) ? 'Assigned' : <><Wrench size={14} /> Assign</>}</button></article>)}</div> : <div className="empty-state"><strong>Queue is clear.</strong><p>New reports will appear here when residents submit them.</p></div>}
          {queueTotal > 10 && <a className="queue-footer-link" href="/map">View {queueTotal - 10} more reports <ArrowUpRight size={14} /></a>}
        </section>
        <aside className="officer-side-stack">{recurringCell ? <MemoryLoader cellId={recurringCell} /> : <div className="panel-card memory-card"><div><p className="eyebrow">CIVIC MEMORY</p><h3>Location learning</h3><p>No issue location is active in the queue yet.</p></div></div>}<div className="contractor-card"><div className="section-heading"><div><p className="eyebrow">REPAIR QUALITY</p><h3>Contractor record</h3></div><Wrench size={16} /></div>{contractors.slice(0, 4).map((contractor) => <div className="contractor-row" key={contractor.contractor}><span>{contractor.contractor}</span><strong className={contractor.recurrences ? 'text-danger' : ''}>{contractor.recurrences} repeat</strong></div>)}{!contractors.length && <p className="muted small-copy">Repair outcomes appear here as follow-ups are recorded.</p>}</div></aside>
      </div>
      <section className="panel-card work-order-review"><div className="section-heading"><div><p className="eyebrow">CONTRACTOR HANDOFF</p><h2>Work order updates</h2></div><span className="count-pill">{reviewOrders.filter((order) => order.status === 'completion_submitted').length} ready to review</span></div>{reviewOrders.length ? <div className="work-order-review-list">{reviewOrders.map((order) => <article className="work-order-review-row" key={order._id}><div><strong>{order.report?.address || order.report?.description || 'City issue'}</strong><p>{order.contractor?.name} · {order.status === 'completion_submitted' ? 'Contractor reports the work is complete' : 'Work assigned to contractor'}</p>{order.status === 'completion_submitted' && <small>“{order.completionNotes}”</small>}</div><span className={`work-order-status work-order-${order.status}`}>{order.status === 'completion_submitted' ? 'Review completion' : 'In progress'}</span>{order.status === 'completion_submitted' && <button className="button button-primary verify-work-button" disabled={busyId === order._id} onClick={() => verifyCompletion(order)}>{busyId === order._id ? <span className="spinner" /> : <CheckCircle2 size={14} />}{busyId === order._id ? 'Verifying…' : 'Verify repair'}</button>}</article>)}</div> : <div className="empty-state compact-empty"><strong>No contractor handoffs yet.</strong><p>Assign a report from the priority queue to start the handoff.</p></div>}</section>
      <div className="officer-bottom-grid"><CategoryChart reports={reports} /><section className="panel-card recurrence-card"><div className="section-heading"><div><p className="eyebrow">QUALITY SIGNAL</p><h3>Recurring issues</h3></div></div><RecurrenceStat count={recurrenceCount} total={reports.length} /><p className="chart-footnote">When a new report follows a repair at the same location, the issue is flagged and added to the contractor record.</p><a className="text-link" href="/weekly">Review weekly trends <ArrowUpRight size={14} /></a></section></div>
      {assignmentReport && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssignmentReport(null); }}><section className="help-dialog assignment-dialog" role="dialog" aria-modal="true" aria-labelledby="assignment-title"><button className="dialog-close" onClick={() => setAssignmentReport(null)} aria-label="Close assignment form"><X size={18} /></button><span className="help-dialog-icon"><Wrench size={20} /></span><p className="eyebrow">NEW CONTRACTOR WORK ORDER</p><h2 id="assignment-title">Assign this issue</h2><p className="muted assignment-report-name">{assignmentReport.address || assignmentReport.description}</p><form onSubmit={assignContractor} className="assignment-form"><label className="field-label">Contractor<select required value={assignment.contractorId} onChange={(event) => setAssignment({ ...assignment, contractorId: event.target.value })}><option value="">Choose a contractor</option>{contractorAccounts.map((contractor) => <option key={contractor._id} value={contractor._id}>{contractor.name}</option>)}</select></label><label className="field-label">Work instructions<textarea required minLength={6} maxLength={1000} rows={3} value={assignment.instructions} onChange={(event) => setAssignment({ ...assignment, instructions: event.target.value })} /></label><label className="field-label">Due date (optional)<input type="date" value={assignment.dueDate} onChange={(event) => setAssignment({ ...assignment, dueDate: event.target.value })} /></label>{error && <p className="form-alert form-error">{error}</p>}<div className="help-dialog-actions"><button type="button" className="button button-quiet" onClick={() => setAssignmentReport(null)}>Cancel</button><button className="button button-primary" disabled={busyId === assignmentReport._id || !contractorAccounts.length}>{busyId === assignmentReport._id ? <span className="spinner" /> : <Send size={15} />}{busyId === assignmentReport._id ? 'Sending…' : 'Send work order'}</button></div></form></section></div>}
    </div>
  );
}

function MemoryLoader({ cellId }) {
  const [memory, setMemory] = useState(null);
  useEffect(() => { api.getMemory(cellId).then((result) => setMemory(result.memory)).catch(() => setMemory(null)); }, [cellId]);
  return <MemoryCard memory={memory} />;
}
