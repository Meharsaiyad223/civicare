import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, Clock3, FileText, MapPin, Send, UserRound, Wrench } from 'lucide-react';
import { api, assetUrl, getApiError } from '../services/api.js';
import PriorityBadge from '../components/PriorityBadge.jsx';

const statusText = {
  assigned: 'Assigned to you',
  completion_submitted: 'Sent to the city for review',
  verified: 'Verified by the city',
};

const reportStatusText = {
  open: 'Open complaint',
  acknowledged: 'Acknowledged by city',
  in_progress: 'Work in progress',
  repaired: 'Repair complete',
  closed: 'Closed',
};

export default function ContractorDashboard() {
  const [workOrders, setWorkOrders] = useState([]);
  const [notes, setNotes] = useState({});
  const [completionConfirmed, setCompletionConfirmed] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refresh = useCallback(async () => {
    try {
      const result = await api.listWorkOrders();
      setWorkOrders(result.workOrders || []);
      setError('');
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function submitCompletion(order) {
    const completionNote = (notes[order._id] || '').trim();
    if (!completionConfirmed[order._id]) {
      setError('Tick the completion confirmation before notifying the city officer.');
      return;
    }
    if (completionNote.length < 6) {
      setError('Add a completion note of at least 6 characters before sending the update.');
      return;
    }
    setBusyId(order._id);
    setError('');
    setSuccess('');
    try {
      await api.completeWorkOrder(order._id, completionNote);
      setNotes((current) => ({ ...current, [order._id]: '' }));
      setCompletionConfirmed((current) => ({ ...current, [order._id]: false }));
      setSuccess(`Completion sent to ${order.assignedBy?.name || 'the city officer'} for review.`);
      await refresh();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setBusyId('');
    }
  }

  const assigned = workOrders.filter((order) => order.status === 'assigned').length;
  const awaitingReview = workOrders.filter((order) => order.status === 'completion_submitted').length;

  return (
    <div className="page-wrap contractor-page">
      <header className="page-header-row">
        <div><span className="eyebrow">CONTRACTOR WORKSPACE · SPRINGFIELD</span><h1>My assignments</h1><p className="muted">Review jobs sent by the city and report when work is complete.</p></div>
        <button className="button button-quiet" onClick={refresh}><Clock3 size={15} /> Refresh assignments</button>
      </header>
      <section className="contractor-summary-grid">
        <article className="contractor-summary-card"><span><ClipboardList size={17} /></span><div><small>ASSIGNED TO YOU</small><strong>{loading ? '—' : assigned}</strong></div></article>
        <article className="contractor-summary-card"><span><CheckCircle2 size={17} /></span><div><small>AWAITING CITY REVIEW</small><strong>{loading ? '—' : awaitingReview}</strong></div></article>
        <article className="contractor-summary-card"><span><Wrench size={17} /></span><div><small>CITY VERIFIED</small><strong>{loading ? '—' : workOrders.filter((order) => order.status === 'verified').length}</strong></div></article>
      </section>
      {error && <div className="page-alert">{error}</div>}
      {success && <div className="contractor-success"><CheckCircle2 size={16} />{success}</div>}
      <section className="panel-card contractor-orders-card">
        <div className="section-heading"><div><p className="eyebrow">CITY WORK ORDERS</p><h2>Assignments and updates</h2><p className="muted small-copy">New assignments and city updates refresh automatically.</p></div><span className="count-pill">{workOrders.length} total</span></div>
        {loading ? <div className="loading-line">Loading your assignments…</div> : workOrders.length ? <div className="contractor-order-list">{workOrders.map((order) => {
          const issue = order.report || {};
          return <article className="contractor-order" key={order._id}>
            <div className="contractor-order-heading"><div><span className="eyebrow">{issue.category?.replaceAll('_', ' ') || 'CITY ISSUE'} · PRIORITY {issue.priorityScore ?? '—'}</span><h3>{issue.address || 'Springfield service request'}</h3></div><span className={`work-order-status work-order-${order.status}`}>{statusText[order.status] || order.status}</span></div>
            <div className="contractor-case-chain"><div className="contractor-case-person"><span className="contractor-source-icon citizen-source-icon"><UserRound size={15} /></span><div><small>RAISED BY CITIZEN</small><strong>{issue.reporter?.name || 'Springfield resident'}</strong><span>{issue.createdAt ? `Reported ${new Date(issue.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'Citizen complaint'}</span></div></div><span className="contractor-chain-arrow">→</span><div className="contractor-case-person"><span className="contractor-source-icon"><UserRound size={15} /></span><div><small>ASSIGNED BY CITY OFFICER</small><strong>{order.assignedBy?.name || 'Springfield City Office'}</strong><span>{order.assignedBy?.email || 'City operations'}</span></div></div><span className="contractor-source-date">Sent {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'date unavailable'}</span></div>
            <p className="contractor-issue-description">{issue.description || 'Issue details are unavailable.'}</p>
            {issue.photoUrl && <a className="contractor-complaint-photo" href={assetUrl(issue.photoUrl)} target="_blank" rel="noreferrer"><img src={assetUrl(issue.photoUrl)} alt="Photo attached to the citizen complaint" /><span>View citizen photo</span></a>}
            <div className="contractor-priority-row"><span>City priority</span><PriorityBadge score={issue.priorityScore || 0} /><span className="contractor-priority-help">Higher scores are more urgent for city response.</span></div>
            <div className="contractor-instructions"><strong>Work requested</strong><p>{order.instructions}</p></div>
            <div className="contractor-order-meta"><span><Wrench size={14} /> Severity {issue.severity || '—'} / 5</span><span><FileText size={14} /> {reportStatusText[issue.status] || 'Complaint linked'}</span>{issue._id && <span>Complaint #{issue._id.slice(-8).toUpperCase()}</span>}{order.dueDate && <span><CalendarDays size={14} /> Due {new Date(order.dueDate).toLocaleDateString()}</span>}{issue.location?.coordinates?.length === 2 && <a href={`https://www.google.com/maps?q=${issue.location.coordinates[1]},${issue.location.coordinates[0]}`} target="_blank" rel="noreferrer"><MapPin size={14} /> Open complaint location</a>}</div>
            {order.status === 'assigned' && <div className="completion-form"><label className="field-label">Completion update<textarea rows={3} minLength={6} maxLength={1000} placeholder="Describe the work completed and anything the city should verify…" value={notes[order._id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [order._id]: event.target.value }))} /></label><label className="contractor-complete-check"><input type="checkbox" checked={Boolean(completionConfirmed[order._id])} onChange={(event) => setCompletionConfirmed((current) => ({ ...current, [order._id]: event.target.checked }))} /><span><strong>I confirm this task is complete</strong><small>Tick this and send your update to notify the assigned city officer.</small></span></label><button className="button button-primary" disabled={busyId === order._id || !completionConfirmed[order._id] || (notes[order._id] || '').trim().length < 6} onClick={() => submitCompletion(order)}>{busyId === order._id ? <span className="spinner" /> : <Send size={15} />}{busyId === order._id ? 'Notifying city…' : 'Mark complete and notify city'}</button></div>}
            {order.status === 'completion_submitted' && <div className="completion-note"><strong>Your completion update</strong><p>{order.completionNotes}</p><small>The city officer will review it and verify the repair.</small></div>}
            {order.status === 'verified' && <div className="completion-note completion-verified"><strong>City verified this repair</strong><p>{order.completionNotes}</p></div>}
          </article>;
        })}</div> : <div className="empty-state contractor-empty"><span><ClipboardList size={20} /></span><strong>No assignments yet</strong><p>Work orders sent by the Springfield city team will appear here.</p></div>}
      </section>
    </div>
  );
}
