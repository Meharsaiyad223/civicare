import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Activity, Bell, CheckCircle2, ChevronDown, CircleHelp, ClipboardList, LayoutDashboard, LogOut, Map, Menu, Sparkles, X } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { api } from './services/api.js';
import Login from './pages/Login.jsx';
import CitizenDashboard from './pages/CitizenDashboard.jsx';
import OfficerDashboard from './pages/OfficerDashboard.jsx';
import ContractorDashboard from './pages/ContractorDashboard.jsx';
import MapPage from './pages/MapPage.jsx';
import WeeklyReport from './pages/WeeklyReport.jsx';
import './index.css';

const statusLabels = { open: 'Received', acknowledged: 'Acknowledged', in_progress: 'In progress', repaired: 'Repaired', closed: 'Closed', assigned: 'Work assigned', completion_submitted: 'Completion submitted for review', verified: 'Repair verified' };

function Protected({ role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="app-loading"><span className="brand-mark"><Sparkles size={18} /></span><span>Preparing your city view…</span></div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'officer' ? '/officer' : user.role === 'contractor' ? '/contractor' : '/citizen'} replace />;
  return <Outlet />;
}

function AppShell() {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('');
  const [services, setServices] = useState({ state: 'unknown', checkedAt: '' });
  const notificationReadKey = `civiccare.notifications.read.${user?.id || 'guest'}`;
  const [notificationSeenAt, setNotificationSeenAt] = useState(() => Number(localStorage.getItem(notificationReadKey)) || 0);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const location = useLocation();
  const officer = user?.role === 'officer';
  const contractor = user?.role === 'contractor';
  const dashboardPath = officer ? '/officer' : contractor ? '/contractor' : '/citizen';
  const title = location.pathname.startsWith('/map') ? 'Live map' : location.pathname.startsWith('/weekly') ? 'Weekly report' : contractor ? 'My assignments' : 'Overview';
  const links = contractor ? [
    { to: '/contractor', label: 'My assignments', icon: ClipboardList, end: true },
    { to: '/map', label: 'City map', icon: Map },
  ] : officer ? [
    { to: '/officer', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/map', label: 'Live map', icon: Map },
    { to: '/weekly', label: 'Weekly report', icon: ClipboardList },
  ] : [
    { to: '/citizen', label: 'My dashboard', icon: LayoutDashboard, end: true },
    { to: '/map', label: 'City map', icon: Map },
    { to: '/weekly', label: 'City weekly report', icon: ClipboardList },
  ];
  async function checkServices() {
    setServices((current) => ({ ...current, state: 'checking' }));
    try {
      await api.checkHealth();
      setServices({ state: 'online', checkedAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) });
    } catch {
      setServices({ state: 'offline', checkedAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) });
    }
  }
  async function loadNotifications() {
    setNotificationsLoading(true);
    setNotificationsError('');
    try {
      const result = officer || contractor
        ? await api.listWorkOrders()
        : await api.listReports({ mine: true, limit: 50 });
      const items = officer || contractor
        ? (result.workOrders || []).map((order) => ({
          _id: order._id,
          updatedAt: order.updatedAt,
          createdAt: order.createdAt,
          status: order.status,
          description: officer && order.status === 'completion_submitted'
            ? `${order.contractor?.name || 'Contractor'} completed ${order.report?.address || order.report?.description || 'a complaint'} and is waiting for your review.`
            : `${order.report?.address || order.report?.description || 'Report'} · ${order.report?.description || ''}`,
        }))
        : (result.reports || []);
      const latest = items.sort((first, second) => new Date(second.updatedAt || second.createdAt) - new Date(first.updatedAt || first.createdAt));
      setNotifications(latest.slice(0, 6));
    } catch (error) {
      setNotificationsError(error?.response?.data?.error?.message || 'Could not load report updates. Check your connection and try again.');
    } finally {
      setNotificationsLoading(false);
    }
  }
  function openNotifications() {
    if (activePanel === 'notifications') {
      setActivePanel('');
      return;
    }
    setActivePanel('notifications');
    loadNotifications();
  }
  useEffect(() => {
    if (!officer) return undefined;
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 15_000);
    return () => window.clearInterval(interval);
  }, [officer, user?.id]);
  function markNotificationsRead() {
    const now = Date.now();
    localStorage.setItem(notificationReadKey, String(now));
    setNotificationSeenAt(now);
  }
  const unreadCount = notifications.filter((item) => new Date(item.updatedAt || item.createdAt).getTime() > notificationSeenAt).length;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <Link to={dashboardPath} className="brand"><span className="brand-mark"><Sparkles size={18} /></span><span>CityPulse</span></Link>
        <button className={`workspace-switch ${activePanel === 'workspace' ? 'is-open' : ''}`} aria-expanded={activePanel === 'workspace'} onClick={() => setActivePanel(activePanel === 'workspace' ? '' : 'workspace')}><span className="workspace-avatar">S</span><span><strong>Springfield Demo</strong><small>{officer ? 'Municipal workspace' : contractor ? 'Contractor portal' : 'Community space'}</small></span><ChevronDown size={14} /></button>
        {activePanel === 'workspace' && <div className="workspace-popover"><strong>Springfield Demo</strong><span className="workspace-current"><CheckCircle2 size={14} /> Active workspace</span><p>{officer ? 'Municipal workspace for city staff.' : contractor ? 'Contractor portal for city work orders and completion updates.' : 'Community space for residents to report and follow local issues.'}</p><small>Springfield, Illinois · Demo workspace</small><div className="workspace-actions"><Link to="/map" onClick={() => setActivePanel('')}>Open city map <Map size={13} /></Link><Link to="/weekly" onClick={() => setActivePanel('')}>Weekly report <ClipboardList size={13} /></Link></div></div>}
        <span className="sidebar-label">WORKSPACE</span>
        <nav className="side-nav">{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `side-link ${isActive ? 'side-link-active' : ''}`}><Icon size={17} /><span>{label}</span>{to === '/map' && <span className="nav-live-dot" />}</NavLink>)}</nav>
        <div className="sidebar-bottom"><button className="help-link" onClick={() => setActivePanel('help')}><span><CircleHelp size={16} /></span><div><strong>Need a hand?</strong><small>View quick guide</small></div></button><div className="user-menu"><span className="user-avatar">{user?.name?.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="user-name"><strong>{user?.name}</strong><small>{officer ? 'City officer' : contractor ? 'Contractor account' : 'Citizen account'}</small></span><button onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button></div></div>
      </aside>
      {mobileOpen && <button aria-label="Close navigation" className="mobile-backdrop" onClick={() => setMobileOpen(false)} />}
      <div className="app-main"><header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="breadcrumbs"><span>Springfield</span><i>/</i><strong>{title}</strong></div></div><div className="topbar-right"><button className={`service-status service-status-button ${activePanel === 'services' ? 'is-open' : ''}`} aria-expanded={activePanel === 'services'} onClick={() => { setActivePanel(activePanel === 'services' ? '' : 'services'); if (services.state === 'unknown' || services.state === 'offline') checkServices(); }}><i className={services.state === 'offline' ? 'status-offline' : services.state === 'unknown' ? 'status-unknown' : ''} />{services.state === 'offline' ? 'Services unavailable' : services.state === 'checking' ? 'Checking services…' : services.state === 'online' ? 'City services online' : 'Check city services'}</button><button className={`icon-button ${activePanel === 'notifications' ? 'is-open' : ''}`} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={activePanel === 'notifications'} onClick={openNotifications}><Bell size={17} />{unreadCount > 0 && <i />}</button><span className="topbar-divider" /><span className="topbar-date">{new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span></div>
      {activePanel === 'services' && <div className="topbar-popover services-popover"><strong>City services</strong><p><span className={`service-indicator ${services.state === 'offline' ? 'status-offline' : ''}`} />{services.state === 'checking' ? 'Checking API and database connection…' : services.state === 'offline' ? 'CityPulse cannot reach the API or database. Make sure the backend and MongoDB are running.' : services.state === 'unknown' ? 'Check API and database connectivity.' : 'CityPulse API and database are responding.'}</p>{services.checkedAt && <small>Last checked at {services.checkedAt}</small>}<button className="popover-action" disabled={services.state === 'checking'} onClick={checkServices}>{services.state === 'checking' ? 'Checking…' : 'Check again'}</button></div>}
      {activePanel === 'notifications' && <div className="topbar-popover notifications-popover"><div className="notification-heading"><strong>{officer ? 'Contractor updates' : contractor ? 'Work order updates' : 'Report updates'}</strong>{unreadCount > 0 && <span>{unreadCount} new</span>}</div>{notificationsLoading ? <p className="notification-message">Loading the latest updates…</p> : notificationsError ? <div className="notification-error"><p>{notificationsError}</p><button className="popover-action" onClick={loadNotifications}>Try again</button></div> : notifications.length ? <><div className="notification-list">{notifications.map((item) => { const date = item.updatedAt || item.createdAt; const unread = new Date(date).getTime() > notificationSeenAt; return <Link key={item._id} to={dashboardPath} className={`notification-item ${unread ? 'notification-unread' : ''}`} onClick={() => { setActivePanel(''); markNotificationsRead(); }}><span className="notification-status-dot" /><span><b>{statusLabels[item.status] || item.status}</b><small>{item.description}</small><small>{date ? new Date(date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recent update'}</small></span></Link>; })}</div><button className="popover-action" onClick={markNotificationsRead}>Mark all as read</button><Link className="popover-action notification-view-link" to={dashboardPath} onClick={() => setActivePanel('')}>Open dashboard</Link></> : <div className="notification-empty"><span><Bell size={17} /></span><div><b>{officer || contractor ? 'No contractor updates yet' : 'No report updates yet'}</b><p>{officer ? 'Contractor assignments and completion notes will appear here.' : contractor ? 'New assignments and city review results will appear here.' : 'When reports are submitted or their status changes, they’ll appear here.'}</p></div></div>}</div>}
      </header><main className="app-content"><Outlet /></main><footer className="app-footer"><span><Activity size={13} /> CityPulse · Springfield Demo City</span><span>Building a clearer picture of city needs</span></footer></div>
      {activePanel === 'help' && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActivePanel(''); }}><section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="dialog-close" onClick={() => setActivePanel('')} aria-label="Close quick guide"><X size={18} /></button><span className="help-dialog-icon"><CircleHelp size={20} /></span><p className="eyebrow">CITYPULSE QUICK GUIDE</p><h2 id="help-title">How can we help?</h2><div className="help-guide-list"><Link to={contractor ? '/contractor' : officer ? '/officer' : '/citizen#report'} onClick={() => setActivePanel('')}><b>{contractor ? 'Open assigned work' : officer ? 'Open your work queue' : 'Report a problem'}</b><p>{contractor ? 'Review assignments, send completion notes, and check their review status.' : officer ? 'Review open issues and assign work to a contractor.' : 'Add a photo, describe the issue, set its severity and location, then send it.'}</p><span>Open {contractor ? 'assignments' : officer ? 'dashboard' : 'report form'} →</span></Link><Link to="/map" onClick={() => setActivePanel('')}><b>Explore the city map</b><p>See reported issues around Springfield and filter by category.</p><span>Open city map →</span></Link><Link to="/weekly" onClick={() => setActivePanel('')}><b>Read the weekly report</b><p>See the latest summary of city activity and recurring issues.</p><span>Open weekly report →</span></Link></div><div className="help-dialog-actions"><button className="button button-quiet" onClick={() => setActivePanel('')}>Close</button></div></section></div>}
    </div>
  );
}

function RouterView() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<Protected />}><Route element={<AppShell />}>
      <Route path="/citizen" element={<Protected role="citizen" />}><Route index element={<CitizenDashboard />} /></Route>
      <Route path="/officer" element={<Protected role="officer" />}><Route index element={<OfficerDashboard />} /></Route>
      <Route path="/contractor" element={<Protected role="contractor" />}><Route index element={<ContractorDashboard />} /></Route>
      <Route path="/map" element={<MapPage />} />
      <Route path="/weekly" element={<WeeklyReport />} />
      <Route index element={<HomeRedirect />} />
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'officer' ? '/officer' : user?.role === 'contractor' ? '/contractor' : '/citizen'} replace />;
}

export default function App() {
  return <BrowserRouter><AuthProvider><RouterView /></AuthProvider></BrowserRouter>;
}
