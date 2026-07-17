// client/src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import API from '../api/axios';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../components/Toast';
import AdminLocationManager from '../components/admin/AdminLocationManager';

const COLORS = {
  purple: '#6366f1', green: '#10b981', amber: '#f59e0b', red: '#ef4444',
  blue: '#3b82f6', pink: '#ec4899', teal: '#14b8a6', orange: '#f97316',
  gray: '#6b7280', white: '#ffffff'
};

function DonutChart({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(107,114,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>No data</div>;
  const r = size / 2 - 10;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.filter(d => d.value > 0).map((d, i) => {
          const pct = d.value / total;
          const dash = pct * circumference;
          const circle = (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
              stroke={d.color} strokeWidth="18"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--color-text)' }}>{total}</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>Total</span>
      </div>
    </div>
  );
}

function HorizontalBarChart({ data, maxWidth = 400 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ minWidth: '50px', fontSize: '0.8rem', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{d.label}</span>
          <div style={{ flex: 1, height: '22px', background: 'rgba(107,114,128,0.08)', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: d.color || COLORS.purple, borderRadius: '6px', transition: 'width 0.6s ease', minWidth: d.value > 0 ? '4px' : 0 }} />
          </div>
          <span style={{ minWidth: '28px', fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-text)' }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function SparkLine({ data, color = COLORS.purple, width = 200, height = 50 }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const min = Math.min(...data.map(d => d.value), 0);
  const range = max - min || 1;
  const step = width / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => `${i * step},${height - ((d.value - min) / range) * (height - 8) - 4}`).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace('#','')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.length > 0 && (
        <circle cx={width} cy={height - ((data[data.length-1].value - min) / range) * (height - 8) - 4} r="3" fill={color} />
      )}
    </svg>
  );
}

function AdminDashboard() {
  const { t } = useLanguage();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [jobStats, setJobStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [reports, setReports] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [analytics, setAnalytics] = useState({ userGrowth: [], ratingDist: null, revenueTrend: null, health: null });
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [currentDocId, setCurrentDocId] = useState(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [filters, setFilters] = useState({ babysitterStatus: 'all', userRole: 'all', bookingStatus: 'all', reportStatus: 'all', documentStatus: 'all', reviewRating: 'all', refundStatus: 'all' });
  const [searchTerm, setSearchTerm] = useState('');
  const [reportAction, setReportAction] = useState({ status: '', admin_notes: '', admin_action: '', refund_status: '', refund_amount: '', warning_message: '' });
  const [reviews, setReviews] = useState([]);
  const [parentReviews, setParentReviews] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [adminJobs, setAdminJobs] = useState([]);
  const [notifForm, setNotifForm] = useState({ title: '', message: '', target_role: 'all', target_user_id: '' });
  const [showNotifModal, setShowNotifModal] = useState(false);

  // Only load data on mount, not on tab change
  useEffect(() => { 
    loadAllData(); 
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, applicationsRes, usersRes, bookingsRes, reportsRes, documentsRes, jobStatsRes, activityRes, userGrowthRes, ratingRes, revenueRes, healthRes, reviewsRes, parentReviewsRes, refundsRes, adminJobsRes] = await Promise.all([
        API.get('/admin/stats'), API.get('/admin/babysitters'), API.get('/admin/users'),
        API.get('/admin/bookings'), API.get('/admin/reports'), API.get('/admin/documents'),
        API.get('/admin/jobs/stats'), API.get('/admin/activity-log?limit=20'),
        API.get('/admin/analytics/user-growth'), API.get('/admin/analytics/rating-distribution'),
        API.get('/admin/analytics/revenue-trend'), API.get('/admin/analytics/platform-health'),
        API.get('/reviews/admin/all').catch(() => ({ data: [] })),
        API.get('/reviews/admin/parent-reviews').catch(() => ({ data: [] })),
        API.get('/reports/refunds/admin').catch(() => ({ data: [] })),
        API.get('/jobs/admin/jobs').catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      setApplications(applicationsRes.data);
      setUsers(usersRes.data);
      setBookings(bookingsRes.data);
      setReports(reportsRes.data);
      setDocuments(documentsRes.data);
      setJobStats(jobStatsRes.data);
      setActivityLog(activityRes.data);
      setAnalytics({ userGrowth: userGrowthRes.data, ratingDist: ratingRes.data, revenueTrend: revenueRes.data, health: healthRes.data });
      setReviews(reviewsRes.data);
      setParentReviews(parentReviewsRes.data);
      setRefunds(refundsRes.data);
      setAdminJobs(adminJobsRes.data);
    } catch (error) {
      // Only show toast if it's not a 401/403 (which triggers redirect)
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        addToast('Failed to load admin data', 'error');
      }
      console.error('Load error:', error);
    } finally { setLoading(false); }
  };

  const handleBabysitterStatus = async (id, status) => {
    try {
      await API.put(`/admin/babysitters/${id}/status`, { status });
      const [appsRes, statsRes] = await Promise.all([API.get('/admin/babysitters'), API.get('/admin/stats')]);
      setApplications(appsRes.data); setStats(statsRes.data);
      addToast(`Babysitter ${status}!`, 'success');
    } catch (err) { 
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        addToast(err.response?.data?.error || 'Error', 'error'); 
      }
    }
  };

  const handleDeleteBabysitter = async (id) => {
    if (!window.confirm('Permanently remove this babysitter?')) return;
    try { await API.delete(`/admin/babysitters/${id}`); addToast('Removed!', 'success'); loadAllData(); }
    catch (err) { 
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        addToast('Error removing babysitter', 'error'); 
      }
    }
  };

  const toggleUserSuspension = async (id, suspend) => {
    if (suspend && !suspensionReason.trim()) { addToast('Provide a reason', 'error'); return; }
    try {
      await API.put(`/admin/users/${id}/suspend`, { suspend, reason: suspensionReason });
      const [usersRes, statsRes] = await Promise.all([API.get('/admin/users'), API.get('/admin/stats')]);
      setUsers(usersRes.data); setStats(statsRes.data);
      setSuspensionReason(''); setShowUserModal(false);
      addToast(suspend ? 'User suspended!' : 'User restored!', 'success');
    } catch (err) { 
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        addToast(err.response?.data?.error || 'Error', 'error'); 
      }
    }
  };

  const handleReportAction = async (id) => {
    try {
      await API.put(`/reports/admin/${id}`, reportAction);
      addToast('Action applied!', 'success');
      setShowReportModal(false);
      setReportAction({ status: '', admin_notes: '', admin_action: '', refund_status: '', refund_amount: '', warning_message: '' });
      loadAllData();
    } catch (err) { 
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        addToast(err.response?.data?.error || 'Error', 'error'); 
      }
    }
  };

  const handleSendNotification = async () => {
    if (!notifForm.title.trim() || !notifForm.message.trim()) { addToast('Title and message required', 'error'); return; }
    try {
      const res = await API.post('/admin/notifications', {
        title: notifForm.title,
        message: notifForm.message,
        target_role: notifForm.target_role,
      });
      addToast(res.data.message || 'Notification sent!', 'success');
      setNotifForm({ title: '', message: '', target_role: 'all', target_user_id: '' });
      setShowNotifModal(false);
      loadAllData();
    } catch (err) { 
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        addToast(err.response?.data?.error || 'Error sending notification', 'error'); 
      }
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Permanently delete this job?')) return;
    try {
      await API.delete(`/jobs/admin/jobs/${jobId}`);
      addToast('Job deleted!', 'success');
      loadAllData();
    } catch (err) { 
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        addToast(err.response?.data?.error || 'Error', 'error'); 
      }
    }
  };

  const verifyDocument = async (id, verified, rejectionReason = null) => {
    try {
      await API.put(`/admin/documents/${id}/verify`, { is_verified: verified, rejection_reason: rejectionReason, admin_notes: adminNotes });
      addToast(`Document ${verified ? 'verified' : 'rejected'}!`, 'success');
      setAdminNotes(''); const res = await API.get('/admin/documents'); setDocuments(res.data);
      const doc = documents.find(d => d.id === id);
      if (doc && verified) {
        const remaining = documents.filter(d => d.profile_id === doc.profile_id && d.id !== id);
        if (remaining.length === 0) autoApproveBabysitter(doc.profile_id);
      }
    } catch (err) { 
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        addToast('Error verifying document', 'error'); 
      }
    }
  };

  const requestDocumentRevision = async () => {
    if (!revisionNotes.trim()) { addToast('Provide revision notes', 'error'); return; }
    try {
      await API.post(`/admin/documents/${currentDocId}/request-revision`, { revision_notes: revisionNotes });
      addToast('Revision requested!', 'success'); setRevisionNotes(''); setShowRevisionModal(false);
      const res = await API.get('/admin/documents'); setDocuments(res.data);
    } catch (err) { 
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        addToast('Error', 'error'); 
      }
    }
  };

  const autoApproveBabysitter = async (profileId) => {
    try {
      const res = await API.get('/admin/babysitters');
      const profile = res.data.find(p => p.profile_id === profileId);
      if (profile) { await API.put(`/admin/babysitters/${profile.id}/status`, { status: 'approved' }); addToast('Auto-approved!', 'success'); const appsRes = await API.get('/admin/babysitters'); setApplications(appsRes.data); }
    } catch (e) { console.error('Auto-approve failed:', e); }
  };

  const getDocumentTypeLabel = (type) => ({ 'id_card': 'ID Card', 'cv': 'CV/Resume', 'certificate': 'Certificate', 'background_check': 'Background Check' }[type] || type);
  const statusClass = (s) => ({ pending: 'status-pending', confirmed: 'status-confirmed', completed: 'status-completed', cancelled: 'status-cancelled', in_progress: 'status-progress', reviewed: 'status-confirmed', resolved: 'status-completed', dismissed: 'status-cancelled', approved: 'status-completed', rejected: 'status-cancelled' }[s] || '');
  const getStatusColor = (s) => ({ pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444', confirmed: '#3b82f6', in_progress: '#8b5cf6', completed: '#10b981', cancelled: '#ef4444', reviewed: '#3b82f6', resolved: '#10b981', dismissed: '#6b7280' }[s] || '#6b7280');
  const getInitials = (f, l) => `${f?.[0] || ''}${l?.[0] || ''}`.toUpperCase();
  const hexToRgba = (hex, alpha) => { const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${alpha})` };

  const formatAction = (action) => {
    const map = {
      'publish availability': { label: 'Published Availability', icon: '📅' },
      'update babysitter status': { label: 'Updated Status', icon: '🔄' },
      'verify document': { label: 'Verified Document', icon: '✅' },
      'request revision': { label: 'Requested Revision', icon: '🔄' },
      'dismiss report': { label: 'Dismissed Report', icon: '📋' },
      'restore user': { label: 'Restored User', icon: '🔓' },
      'suspend user': { label: 'Suspended User', icon: '🔒' },
      'delete user': { label: 'Deleted User', icon: '🗑️' },
      'warning': { label: 'Sent Warning', icon: '⚠️' },
      'create report': { label: 'Created Report', icon: '📋' },
      'update profile': { label: 'Updated Profile', icon: '👤' },
      'submit review': { label: 'Submitted Review', icon: '⭐' },
    };
    return map[action] || { label: action?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown', icon: '📋' };
  };

  const formatDetails = (details, action) => {
    if (!details) return null;
    const d = typeof details === 'string' ? (() => { try { return JSON.parse(details); } catch { return { raw: details }; } })() : details;

    if (action?.includes('publish availability')) {
      return `Published ${d.slots_published || 0} time slot${(d.slots_published || 0) !== 1 ? 's' : ''}`;
    }
    if (action?.includes('update babysitter status')) {
      const s = d.status || '';
      const label = s === 'approved' ? 'Approved' : s === 'rejected' ? 'Rejected' : s === 'pending' ? 'Pending' : s;
      return `Status changed to ${label}`;
    }
    if (action?.includes('verify document')) {
      return d.is_verified ? 'Document verified' : `Document rejected${d.rejection_reason ? ': ' + d.rejection_reason : ''}`;
    }
    if (action?.includes('request revision')) {
      return `Revision requested${d.revision_notes ? ': ' + d.revision_notes : ''}`;
    }
    if (action?.includes('dismiss report')) {
      return `Report dismissed${d.reason ? ' — ' + d.reason : ''}`;
    }
    if (action?.includes('restore user')) {
      return 'User account restored';
    }
    if (action?.includes('suspend user')) {
      return `User suspended${d.reason ? ' — ' + d.reason : ''}`;
    }
    if (action?.includes('warning')) {
      return `Warning sent${d.message ? ': ' + d.message : ''}`;
    }
    if (action?.includes('delete')) {
      return 'Record deleted';
    }
    if (action?.includes('create report')) {
      return `Report filed${d.reason ? ' — ' + d.reason : ''}`;
    }

    const parts = Object.entries(d).filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (parts.length === 0) return null;
    return parts.map(([k, v]) => {
      const key = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      if (typeof v === 'boolean') return v ? `${key}: Yes` : `${key}: No`;
      return `${key}: ${v}`;
    }).join(' · ');
  };

  const getFilteredApplications = () => { let f = applications; if (filters.babysitterStatus !== 'all') f = f.filter(a => a.status === filters.babysitterStatus); if (searchTerm) { const s = searchTerm.toLowerCase(); f = f.filter(a => a.first_name?.toLowerCase().includes(s) || a.last_name?.toLowerCase().includes(s) || a.email?.toLowerCase().includes(s)); } return f; };
  const getFilteredUsers = () => { let f = users.filter(u => u.role !== 'admin'); if (filters.userRole !== 'all') f = f.filter(u => u.role === filters.userRole); if (searchTerm) { const s = searchTerm.toLowerCase(); f = f.filter(u => u.first_name?.toLowerCase().includes(s) || u.last_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s)); } return f; };
  const getFilteredBookings = () => { let f = bookings; if (filters.bookingStatus !== 'all') f = f.filter(b => b.status === filters.bookingStatus); if (searchTerm) { const s = searchTerm.toLowerCase(); f = f.filter(b => b.parent_name?.toLowerCase().includes(s) || b.babysitter_name?.toLowerCase().includes(s)); } return f; };
  const getFilteredReports = () => { let f = reports; if (filters.reportStatus !== 'all') f = f.filter(r => r.status === filters.reportStatus); if (searchTerm) { const s = searchTerm.toLowerCase(); f = f.filter(r => r.reporter_name?.toLowerCase().includes(s) || r.reported_name?.toLowerCase().includes(s) || r.reason?.toLowerCase().includes(s)); } return f; };
  const getFilteredDocuments = () => { let f = documents; if (filters.documentStatus !== 'all') f = f.filter(d => filters.documentStatus === 'verified' ? d.is_verified : !d.is_verified); if (searchTerm) { const s = searchTerm.toLowerCase(); f = f.filter(d => d.first_name?.toLowerCase().includes(s) || d.last_name?.toLowerCase().includes(s) || d.email?.toLowerCase().includes(s)); } return f; };
  const getFilteredReviews = () => { let f = reviews; if (filters.reviewRating !== 'all') f = f.filter(r => parseInt(r.rating) === parseInt(filters.reviewRating)); if (searchTerm) { const s = searchTerm.toLowerCase(); f = f.filter(r => r.reviewer_name?.toLowerCase().includes(s) || r.babysitter_name?.toLowerCase().includes(s) || r.comment?.toLowerCase().includes(s)); } return f; };
  const getFilteredRefunds = () => { let f = refunds; if (filters.refundStatus !== 'all') f = f.filter(r => r.refund_status === filters.refundStatus); if (searchTerm) { const s = searchTerm.toLowerCase(); f = f.filter(r => r.reporter_name?.toLowerCase().includes(s) || r.reported_name?.toLowerCase().includes(s) || r.reason?.toLowerCase().includes(s)); } return f; };
  const getFilteredAdminJobs = () => { let f = adminJobs; if (searchTerm) { const s = searchTerm.toLowerCase(); f = f.filter(j => j.title?.toLowerCase().includes(s) || j.first_name?.toLowerCase().includes(s) || j.last_name?.toLowerCase().includes(s) || j.city?.toLowerCase().includes(s)); } return f; };
  const getReportStats = () => ({ total: reports.length, pending: reports.filter(r => r.status === 'pending').length, reviewed: reports.filter(r => r.status === 'reviewed').length, resolved: reports.filter(r => r.status === 'resolved').length, dismissed: reports.filter(r => r.status === 'dismissed').length });

  if (loading) return (<div className="dashboard admin-dashboard"><div className="loading-container"><div className="spinner"></div><p>Loading admin dashboard...</p></div></div>);

  const reportStats = getReportStats();
  const healthScore = stats ? Math.min(100, Math.round(
    (stats.totalUsers > 0 ? 20 : 0) +
    (parseFloat(analytics.health?.completionRate || 0) > 70 ? 25 : parseFloat(analytics.health?.completionRate || 0) * 0.35) +
    (stats.cancelledBookings / Math.max(stats.totalBookings, 1) < 0.2 ? 25 : 10) +
    (stats.pendingApprovals < 10 ? 15 : 5) +
    (reports.filter(r => r.status === 'pending').length < 5 ? 15 : 5)
  )) : 0;

  const userGrowthByMonth = {};
  (analytics.userGrowth || []).forEach(r => {
    if (!userGrowthByMonth[r.month]) userGrowthByMonth[r.month] = { month: r.month, parents: 0, babysitters: 0 };
    if (r.role === 'parent') userGrowthByMonth[r.month].parents = parseInt(r.count);
    if (r.role === 'babysitter') userGrowthByMonth[r.month].babysitters = parseInt(r.count);
  });
  const userGrowthData = Object.values(userGrowthByMonth).slice(-8);

  const revenueData = (analytics.revenueTrend?.trend || []).map(d => ({ label: d.date.slice(5), value: parseFloat(d.revenue) }));

  const ratingDistData = [
    { label: '5 stars', value: 0, color: '#10b981' },
    { label: '4 stars', value: 0, color: '#22c55e' },
    { label: '3 stars', value: 0, color: '#f59e0b' },
    { label: '2 stars', value: 0, color: '#f97316' },
    { label: '1 star', value: 0, color: '#ef4444' }
  ];
  (analytics.ratingDist?.distribution || []).forEach(r => {
    const idx = 5 - parseInt(r.rating);
    if (idx >= 0 && idx < 5) ratingDistData[idx].value = parseInt(r.count);
  });

  const bookingDonut = [
    { label: 'Completed', value: stats?.completedBookings || 0, color: COLORS.green },
    { label: 'Active', value: stats?.activeBookings || 0, color: COLORS.blue },
    { label: 'Cancelled', value: stats?.cancelledBookings || 0, color: COLORS.red },
    { label: 'Other', value: Math.max(0, (stats?.totalBookings || 0) - (stats?.completedBookings || 0) - (stats?.activeBookings || 0) - (stats?.cancelledBookings || 0)), color: COLORS.gray }
  ];

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'applications', label: '👶 Babysitters', badge: applications.filter(a => a.status === 'pending').length },
    { id: 'documents', label: '📄 Documents', badge: documents.filter(d => !d.is_verified).length },
    { id: 'users', label: '👤 Users' },
    { id: 'bookings', label: '📅 Bookings' },
    { id: 'jobs', label: '💼 Jobs' },
    { id: 'reviews', label: '⭐ Reviews' },
    { id: 'refunds', label: '💰 Refunds', badge: refunds.filter(r => r.refund_status === 'pending').length },
    { id: 'notifications', label: '🔔 Notifications' },
    { id: 'reports', label: '🚨 Reports', badge: reports.filter(r => r.status === 'pending').length },
    { id: 'activity', label: '🕐 Activity' },
    { id: 'locations', label: '📍 Locations' },
  ];

  const cardStyle = (bg) => ({ background: bg || 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '20px', border: '1px solid var(--color-border-light)' });
  const miniCardStyle = { background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: '16px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '6px' };
  const searchInputStyle = { flex: 1, minWidth: 220, padding: '11px 16px 11px 42px', borderRadius: 'var(--radius)', border: '1.5px solid var(--color-border)', fontSize: '0.88rem', background: 'var(--color-surface)', color: 'var(--color-text)', outline: 'none', transition: 'border 0.2s, box-shadow 0.2s', boxSizing: 'border-box' };
  const filterSelectStyle = { padding: '11px 36px 11px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--color-border)', fontSize: '0.88rem', fontWeight: '500', background: 'var(--color-surface)', color: 'var(--color-text)', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '14px', transition: 'border 0.2s, box-shadow 0.2s', boxSizing: 'border-box' };
  const filterBarStyle = { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px', background: 'var(--color-bg-alt, rgba(0,0,0,0.02))', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)' };

  // Handle tab change
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchTerm('');
    
    // Only reset filters for specific tabs
    if (tabId === 'applications') {
      setFilters({...filters, babysitterStatus: 'all'});
    } else if (tabId === 'documents') {
      setFilters({...filters, documentStatus: 'all'});
    } else if (tabId === 'users') {
      setFilters({...filters, userRole: 'all'});
    } else if (tabId === 'bookings') {
      setFilters({...filters, bookingStatus: 'all'});
    } else if (tabId === 'reports') {
      setFilters({...filters, reportStatus: 'all'});
    } else if (tabId === 'reviews') {
      setFilters({...filters, reviewRating: 'all'});
    } else if (tabId === 'refunds') {
      setFilters({...filters, refundStatus: 'all'});
    }
    // Don't reset filters for 'locations' tab
  };

  return (
    <div className="dashboard admin-dashboard">
      {/* HERO */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #6366F1)', borderRadius: 'var(--radius-lg)', padding: '28px 32px', marginBottom: '24px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -40, right: 60, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800' }}>Admin Dashboard</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.9rem' }}>Manage your CareNest platform</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', padding: '0 16px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800' }}>{stats?.totalUsers || 0}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Users</div>
            </div>
            <div style={{ textAlign: 'center', padding: '0 16px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800' }}>${parseFloat(stats?.totalRevenue || 0).toFixed(0)}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Revenue</div>
            </div>
            <div style={{ textAlign: 'center', padding: '0 16px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800' }}>{stats?.totalBookings || 0}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Bookings</div>
            </div>
            <div style={{ textAlign: 'center', padding: '0 12px' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800' }}>{healthScore}%</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Health</div>
            </div>
            <button onClick={loadAllData} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', borderRadius: 'var(--radius)', padding: '8px 14px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', backdropFilter: 'blur(4px)' }}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="dash-tabs">
        {tabs.map(tab => (
          <button 
            key={tab.id} 
            className={`dash-tab ${activeTab === tab.id ? 'active' : ''}`} 
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
            {tab.badge > 0 && <span className="tab-badge">{tab.badge}</span>}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === 'overview' && stats && (
        <div className="dash-content">
          {/* Quick Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            {[
              { icon: '👥', label: 'Total Users', value: stats.totalUsers, color: COLORS.purple, sub: `${stats.totalParents} parents · ${stats.totalBabysitters} sitters` },
              { icon: '💰', label: 'Total Revenue', value: `$${parseFloat(stats.totalRevenue || 0).toFixed(0)}`, color: COLORS.green, sub: `Monthly: $${parseFloat(stats.monthlyRevenue || 0).toFixed(0)}` },
              { icon: '📅', label: 'Total Bookings', value: stats.totalBookings, color: COLORS.blue, sub: `${stats.completedBookings} completed · ${stats.activeBookings} active` },
              { icon: '⭐', label: 'Avg Rating', value: analytics.ratingDist?.avgRating || '0.0', color: COLORS.amber, sub: `${analytics.ratingDist?.totalReviews || 0} reviews` },
              { icon: '⚠️', label: 'Pending', value: stats.pendingApprovals + stats.pendingDocuments + reportStats.pending, color: COLORS.orange, sub: `${stats.pendingApprovals} approvals · ${stats.pendingDocuments} docs` },
              { icon: '📈', label: 'Completion', value: `${parseFloat(analytics.health?.completionRate || 0).toFixed(0)}%`, color: COLORS.teal, sub: `Avg ${analytics.health?.avgBookingDurationMins || 0}min/booking` },
            ].map((s, i) => (
              <div key={i} style={{ ...miniCardStyle, borderLeft: `3px solid ${s.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: '500' }}>{s.label}</span>
                  <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text)' }}>{s.value}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            {/* Booking Status Donut */}
            <div style={cardStyle()}>
              <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>Booking Status</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <DonutChart data={bookingDonut} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {bookingDonut.filter(d => d.value > 0).map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{d.label}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-text)', marginLeft: 'auto' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rating Distribution */}
            <div style={cardStyle()}>
              <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>Rating Distribution</h3>
              <HorizontalBarChart data={ratingDistData} />
            </div>

            {/* Revenue Trend Sparkline */}
            <div style={cardStyle()}>
              <h3 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>Revenue (30d)</h3>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--color-text)', marginBottom: '8px' }}>
                ${parseFloat(analytics.revenueTrend?.summary?.totalRevenue30d || 0).toFixed(2)}
              </div>
              <SparkLine data={revenueData} color={COLORS.green} width={280} height={60} />
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                {analytics.revenueTrend?.summary?.totalBookings30d || 0} bookings in last 30 days
              </div>
            </div>
          </div>

          {/* User Growth + Platform Health */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            {/* User Growth */}
            <div style={cardStyle()}>
              <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>User Growth</h3>
              {userGrowthData.length > 0 ? (
                <div className="bar-chart" style={{ minHeight: 140 }}>
                  {userGrowthData.map((m, i) => {
                    const total = m.parents + m.babysitters;
                    const max = Math.max(...userGrowthData.map(d => d.parents + d.babysitters), 1);
                    return (
                      <div key={i} className="bar-item" style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center' }}>
                          <div style={{ width: '100%', maxWidth: 36, height: `${Math.max(4, (m.babysitters / max) * 100)}px`, background: COLORS.purple, borderRadius: '4px 4px 0 0', transition: 'height 0.5s' }} />
                          <div style={{ width: '100%', maxWidth: 36, height: `${Math.max(4, (m.parents / max) * 100)}px`, background: COLORS.teal, borderRadius: '0 0 4px 4px', transition: 'height 0.5s' }} />
                        </div>
                        <span className="bar-value">{total}</span>
                        <span className="bar-label">{m.month.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No data yet</p>}
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '0.75rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS.teal, display: 'inline-block' }} /> Parents</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS.purple, display: 'inline-block' }} /> Babysitters</span>
              </div>
            </div>

            {/* Platform Health */}
            <div style={cardStyle()}>
              <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>Platform Health</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Health Score', value: `${healthScore}%`, bar: healthScore, color: healthScore > 70 ? COLORS.green : healthScore > 40 ? COLORS.amber : COLORS.red },
                  { label: 'Completion Rate', value: `${parseFloat(analytics.health?.completionRate || 0).toFixed(1)}%`, bar: parseFloat(analytics.health?.completionRate || 0), color: COLORS.green },
                  { label: 'Cancellation Rate', value: `${stats.cancellationRate}%`, bar: Math.min(100, parseFloat(stats.cancellationRate || 0)), color: parseFloat(stats.cancellationRate) > 20 ? COLORS.red : COLORS.green },
                  { label: 'Pending Approvals', value: stats.pendingApprovals, bar: Math.min(100, stats.pendingApprovals * 10), color: stats.pendingApprovals > 5 ? COLORS.amber : COLORS.green },
                  { label: 'Pending Documents', value: stats.pendingDocuments, bar: Math.min(100, stats.pendingDocuments * 5), color: stats.pendingDocuments > 10 ? COLORS.amber : COLORS.green },
                  { label: 'Active Reports', value: reportStats.pending, bar: Math.min(100, reportStats.pending * 10), color: reportStats.pending > 3 ? COLORS.red : COLORS.green },
                ].map((item, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{item.label}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-text)' }}>{item.value}</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(107,114,128,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.bar}%`, height: '100%', background: item.color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Revenue by Top Babysitters + City Distribution + Monthly Bookings */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            {stats.topBabysitters?.length > 0 && (
              <div style={cardStyle()}>
                <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>Top Babysitters</h3>
                {stats.topBabysitters.slice(0, 5).map((bs, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < 4 ? '1px solid var(--color-border-light)' : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.blue})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '700', flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text)' }}>{bs.first_name} {bs.last_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{bs.completed} bookings</div>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: COLORS.green }}>${parseFloat(bs.revenue || 0).toFixed(0)}</div>
                  </div>
                ))}
              </div>
            )}

            {stats.cityDistribution?.length > 0 && (
              <div style={cardStyle()}>
                <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>City Distribution</h3>
                {stats.cityDistribution.slice(0, 8).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', minWidth: '80px' }}>{c.city}</span>
                    <div style={{ flex: 1, height: '18px', background: 'rgba(107,114,128,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${(parseInt(c.count) / Math.max(...stats.cityDistribution.map(x => parseInt(x.count)), 1)) * 100}%`, height: '100%', background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.green})`, borderRadius: '4px' }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-text)', minWidth: '20px', textAlign: 'right' }}>{c.count}</span>
                  </div>
                ))}
              </div>
            )}

            {stats.monthlyBookings?.length > 0 && (
              <div style={cardStyle()}>
                <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>Monthly Bookings</h3>
                <div className="bar-chart" style={{ minHeight: 120 }}>
                  {stats.monthlyBookings.map((m, i) => {
                    const max = Math.max(...stats.monthlyBookings.map(b => parseInt(b.count)), 1);
                    return (
                      <div key={i} className="bar-item">
                        <div className="bar-fill" style={{ height: `${Math.max(8, (parseInt(m.count) / max) * 110)}px` }} />
                        <span className="bar-value">{m.count}</span>
                        <span className="bar-label">{m.month.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Job Stats Quick Overview */}
          {jobStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              {[
                { icon: '💼', label: 'Total Jobs', value: jobStats.total_jobs || 0, color: COLORS.purple },
                { icon: '🟢', label: 'Active', value: jobStats.active_jobs || 0, color: COLORS.green },
                { icon: '📭', label: 'Open', value: jobStats.open_jobs || 0, color: COLORS.amber },
                { icon: '🔄', label: 'In Progress', value: jobStats.in_progress_jobs || 0, color: COLORS.blue },
                { icon: '✅', label: 'Completed', value: jobStats.completed_jobs || 0, color: COLORS.green },
                { icon: '📝', label: 'Applications', value: jobStats.total_applications || 0, color: COLORS.pink },
              ].map((s, i) => (
                <div key={i} style={{ ...miniCardStyle, borderLeft: `3px solid ${s.color}`, alignItems: 'center', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)' }}>{s.value}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recent Activity */}
          {stats.recentActivity?.length > 0 && (
            <div style={cardStyle()}>
              <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>Recent Activity</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {stats.recentActivity.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < stats.recentActivity.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: getStatusColor(b.status), flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
                        <strong>{b.pfirst} {b.plast}</strong> booked <strong>{b.sfirst} {b.slast}</strong>
                      </span>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: COLORS.green }}>${parseFloat(b.total_amount || 0).toFixed(2)}</span>
                    <span className={`booking-status ${statusClass(b.status)}`} style={{ fontSize: '0.7rem' }}>{b.status}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{new Date(b.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== BABYSITTERS TAB ===== */}
      {activeTab === 'applications' && (
        <div className="dash-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {[
              { label: 'Total', value: applications.length, color: COLORS.purple, icon: '👶' },
              { label: 'Pending', value: applications.filter(a => a.status === 'pending').length, color: COLORS.amber, icon: '⏳' },
              { label: 'Approved', value: applications.filter(a => a.status === 'approved').length, color: COLORS.green, icon: '✅' },
              { label: 'Rejected', value: applications.filter(a => a.status === 'rejected').length, color: COLORS.red, icon: '❌' },
              { label: 'Suspended', value: applications.filter(a => a.suspended_at).length, color: COLORS.orange, icon: '⛔' },
              { label: 'Verified', value: applications.filter(a => a.is_verified).length, color: COLORS.teal, icon: '🛡️' },
            ].map((s, i) => (
              <div key={i} style={{ ...miniCardStyle, borderLeft: `3px solid ${s.color}`, textAlign: 'center' }}>
                <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)' }}>{s.value}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={filterBarStyle}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.45 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search by name or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={searchInputStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ position: 'relative' }}>
              <select value={filters.babysitterStatus} onChange={(e) => setFilters({...filters, babysitterStatus: e.target.value})} style={filterSelectStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          {getFilteredApplications().length === 0 ? <p className="no-results">No babysitters found</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
              {getFilteredApplications().map(a => (
                <div key={`app-${a.id}`} style={{ ...cardStyle(), padding: 0, overflow: 'hidden' }}>
                  <div style={{ background: `linear-gradient(135deg, ${hexToRgba(getStatusColor(a.status), 0.13)}, ${hexToRgba(getStatusColor(a.status), 0.07)})`, padding: '16px 18px 12px', borderBottom: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg, ${getStatusColor(a.status)}, ${hexToRgba(getStatusColor(a.status), 0.8)})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', flexShrink: 0 }}>{getInitials(a.first_name, a.last_name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text)' }}>{a.first_name} {a.last_name}</span>
                          <span style={{ fontSize: '0.65rem', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: getStatusColor(a.status), color: '#fff', textTransform: 'uppercase' }}>{a.status}</span>
                          {a.suspended_at && <span style={{ fontSize: '0.65rem', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', background: COLORS.red, color: '#fff' }}>Suspended</span>}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{a.email}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        <span style={{ color: COLORS.green, fontWeight: '700' }}>${parseFloat(a.hourly_rate || 0).toFixed(2)}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>/hr</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        <span style={{ color: COLORS.purple }}>{a.experience_years || 0}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>years exp</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        <span>{a.city || 'No city'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        {a.is_verified && <span style={{ color: COLORS.green }}>Verified</span>}
                        {a.avg_rating > 0 && <span>⭐ {parseFloat(a.avg_rating).toFixed(1)}</span>}
                        {a.completed_bookings > 0 && <span>{a.completed_bookings} bookings</span>}
                      </div>
                    </div>
                    {a.pending_documents > 0 && <div style={{ fontSize: '0.75rem', color: COLORS.amber, marginBottom: '10px', padding: '6px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: '6px' }}>{a.pending_documents} documents pending review</div>}
                    {a.bio && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '12px', lineHeight: 1.4 }}>{a.bio.substring(0, 120)}{a.bio.length > 120 ? '...' : ''}</div>}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px' }}>
                      {a.status === 'pending' && (<>
                        <button style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: COLORS.green, color: '#fff', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => handleBabysitterStatus(a.id, 'approved')}>Approve</button>
                        <button style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: COLORS.red, fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => handleBabysitterStatus(a.id, 'rejected')}>Reject</button>
                      </>)}
                      {a.status === 'approved' && (<>
                        <button style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => handleBabysitterStatus(a.id, 'pending')}>Reset</button>
                        <button style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: COLORS.red, fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => handleDeleteBabysitter(a.id)}>Remove</button>
                      </>)}
                      {a.status === 'rejected' && <button style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: COLORS.purple, color: '#fff', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => handleBabysitterStatus(a.id, 'pending')}>Reconsider</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== DOCUMENTS TAB ===== */}
      {activeTab === 'documents' && (
        <div className="dash-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {[
              { label: 'Total', value: documents.length, color: COLORS.purple, icon: '📄' },
              { label: 'Pending', value: documents.filter(d => !d.is_verified && !d.rejection_reason).length, color: COLORS.amber, icon: '⏳' },
              { label: 'Verified', value: documents.filter(d => d.is_verified).length, color: COLORS.green, icon: '✅' },
              { label: 'Revision', value: documents.filter(d => !d.is_verified && d.rejection_reason).length, color: COLORS.red, icon: '🔄' },
            ].map((s, i) => (
              <div key={i} style={{ ...miniCardStyle, borderLeft: `3px solid ${s.color}`, textAlign: 'center' }}>
                <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)' }}>{s.value}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={filterBarStyle}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.45 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search by name or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={searchInputStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ position: 'relative' }}>
              <select value={filters.documentStatus} onChange={(e) => setFilters({...filters, documentStatus: e.target.value})} style={filterSelectStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}>
                <option value="all">All Documents</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="revision">Revision Needed</option>
              </select>
            </div>
          </div>
          {getFilteredDocuments().length === 0 ? <p className="no-results">No documents found</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
              {getFilteredDocuments().map(d => {
                const docColor = d.is_verified ? COLORS.green : d.rejection_reason ? COLORS.red : COLORS.amber;
                const docIcon = { 'id_card': '🪪', 'cv': '📋', 'certificate': '📜', 'background_check': '🔍' }[d.document_type] || '📄';
                return (
                  <div key={`doc-${d.id}`} style={{ ...cardStyle(), padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--color-border-light)', background: `linear-gradient(135deg, ${hexToRgba(docColor, 0.07)}, transparent)` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 38, height: 38, borderRadius: '10px', background: `${hexToRgba(docColor, 0.09)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>{docIcon}</div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--color-text)' }}>{d.first_name} {d.last_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{d.email}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.65rem', fontWeight: '600', padding: '3px 10px', borderRadius: '10px', background: docColor, color: '#fff', textTransform: 'uppercase' }}>
                        {d.is_verified ? 'Verified' : d.rejection_reason ? 'Revision' : 'Pending'}
                      </span>
                    </div>
                    <div style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.8rem' }}><span style={{ color: 'var(--color-text-muted)' }}>Type: </span><span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{getDocumentTypeLabel(d.document_type)}</span></div>
                        <div style={{ fontSize: '0.8rem' }}><span style={{ color: 'var(--color-text-muted)' }}>Uploaded: </span><span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{new Date(d.uploaded_at).toLocaleDateString()}</span></div>
                        {d.hourly_rate && <div style={{ fontSize: '0.8rem' }}><span style={{ color: 'var(--color-text-muted)' }}>Rate: </span><span style={{ fontWeight: '600', color: COLORS.green }}>${d.hourly_rate}/hr</span></div>}
                        {d.experience_years && <div style={{ fontSize: '0.8rem' }}><span style={{ color: 'var(--color-text-muted)' }}>Exp: </span><span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{d.experience_years} yrs</span></div>}
                      </div>
                      {d.rejection_reason && <div style={{ fontSize: '0.78rem', padding: '8px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.15)', color: COLORS.red, marginBottom: '12px' }}>{d.rejection_reason}</div>}
                      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px' }}>
                        <button style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => setSelectedDoc(d)}>View</button>
                        {!d.is_verified && (<>
                          <button style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: COLORS.green, color: '#fff', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => verifyDocument(d.id, true)}>Approve</button>
                          <button style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: COLORS.amber, fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => { setCurrentDocId(d.id); setShowRevisionModal(true); }}>Revision</button>
                          <button style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: COLORS.red, fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => verifyDocument(d.id, false, 'Rejected')}>Reject</button>
                        </>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== USERS TAB ===== */}
      {activeTab === 'users' && (
        <div className="dash-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {[
              { label: 'Total', value: users.filter(u => u.role !== 'admin').length, color: COLORS.purple, icon: '👤' },
              { label: 'Parents', value: users.filter(u => u.role === 'parent').length, color: COLORS.teal, icon: '👨‍👩‍👦' },
              { label: 'Babysitters', value: users.filter(u => u.role === 'babysitter').length, color: COLORS.blue, icon: '👶' },
              { label: 'Active', value: users.filter(u => u.is_active && !u.suspended_at).length, color: COLORS.green, icon: '✅' },
              { label: 'Suspended', value: users.filter(u => u.suspended_at).length, color: COLORS.red, icon: '⛔' },
            ].map((s, i) => (
              <div key={i} style={{ ...miniCardStyle, borderLeft: `3px solid ${s.color}`, textAlign: 'center' }}>
                <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)' }}>{s.value}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={filterBarStyle}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.45 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search users..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={searchInputStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ position: 'relative' }}>
              <select value={filters.userRole} onChange={(e) => setFilters({...filters, userRole: e.target.value})} style={filterSelectStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}>
                <option value="all">All Roles</option>
                <option value="parent">Parent</option>
                <option value="babysitter">Babysitter</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {getFilteredUsers().map(u => {
              const roleColor = u.role === 'parent' ? COLORS.teal : COLORS.purple;
              return (
                <div key={`user-${u.id}`} style={{ ...cardStyle(), display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: `linear-gradient(135deg, ${roleColor}, ${hexToRgba(roleColor, 0.67)})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.8rem', flexShrink: 0 }}>{getInitials(u.first_name, u.last_name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--color-text)' }}>{u.first_name} {u.last_name}</span>
                      <span style={{ fontSize: '0.6rem', fontWeight: '600', padding: '1px 7px', borderRadius: '8px', background: `${roleColor}18`, color: roleColor }}>{u.role}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '1px' }}>{u.email}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.75rem' }}>
                      {u.city && <span style={{ color: 'var(--color-text-secondary)' }}>{u.city}</span>}
                      {u.suspended_at ? (
                        <span style={{ color: COLORS.red, fontWeight: '600' }}>Suspended</span>
                      ) : (
                        <span style={{ color: u.is_active ? COLORS.green : COLORS.gray }}>{u.is_active ? 'Active' : 'Inactive'}</span>
                      )}
                    </div>
                    {u.suspension_reason && <div style={{ fontSize: '0.7rem', color: COLORS.red, marginTop: '2px' }}>{u.suspension_reason}</div>}
                  </div>
                  <button style={{ padding: '6px 14px', borderRadius: '8px', border: u.suspended_at ? `1px solid ${COLORS.green}` : `1px solid rgba(239,68,68,0.3)`, background: u.suspended_at ? hexToRgba(COLORS.green, 0.07) : 'rgba(239,68,68,0.08)', color: u.suspended_at ? COLORS.green : COLORS.red, fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => { setSelectedUser(u); setShowUserModal(true); }}>
                    {u.suspended_at ? 'Restore' : 'Suspend'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== BOOKINGS TAB ===== */}
      {activeTab === 'bookings' && (
        <div className="dash-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {[
              { label: 'Total', value: bookings.length, color: COLORS.purple, icon: '📅' },
              { label: 'Completed', value: bookings.filter(b => b.status === 'completed').length, color: COLORS.green, icon: '✅' },
              { label: 'Active', value: bookings.filter(b => b.status === 'in_progress' || b.status === 'confirmed').length, color: COLORS.blue, icon: '🔄' },
              { label: 'Cancelled', value: bookings.filter(b => b.status === 'cancelled').length, color: COLORS.red, icon: '❌' },
              { label: 'Revenue', value: `$${bookings.filter(b => b.status === 'completed').reduce((s, b) => s + parseFloat(b.total_amount || 0), 0).toFixed(0)}`, color: COLORS.green, icon: '💰' },
            ].map((s, i) => (
              <div key={i} style={{ ...miniCardStyle, borderLeft: `3px solid ${s.color}`, textAlign: 'center' }}>
                <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)' }}>{s.value}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={filterBarStyle}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.45 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={searchInputStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ position: 'relative' }}>
              <select value={filters.bookingStatus} onChange={(e) => setFilters({...filters, bookingStatus: e.target.value})} style={filterSelectStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          {getFilteredBookings().length === 0 ? <p className="no-results">No bookings found</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {getFilteredBookings().map(b => {
                const bColor = getStatusColor(b.status);
                return (
                  <div key={`booking-${b.id}`} style={{ ...cardStyle(), padding: '0', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-border-light)', background: `linear-gradient(135deg, ${hexToRgba(bColor, 0.07)}, transparent)` }}>
                      <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--color-text)' }}>#{b.id}</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: '600', padding: '3px 10px', borderRadius: '10px', background: bColor, color: '#fff', textTransform: 'uppercase' }}>{b.status}</span>
                    </div>
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '0.8rem' }}><span style={{ color: 'var(--color-text-muted)' }}>Parent: </span><span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{b.parent_first_name || 'N/A'} {b.parent_last_name || ''}</span></div>
                        <div style={{ fontSize: '0.8rem' }}><span style={{ color: 'var(--color-text-muted)' }}>Sitter: </span><span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{b.babysitter_first_name || 'N/A'} {b.babysitter_last_name || ''}</span></div>
                        <div style={{ fontSize: '0.8rem' }}><span style={{ color: 'var(--color-text-muted)' }}>Date: </span><span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{b.start_date ? new Date(b.start_date).toLocaleDateString() : 'N/A'}</span></div>
                        <div style={{ fontSize: '0.8rem' }}><span style={{ color: 'var(--color-text-muted)' }}>Amount: </span><span style={{ fontWeight: '700', color: COLORS.green }}>${parseFloat(b.total_amount || 0).toFixed(2)}</span></div>
                        {b.start_time && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>{b.start_time} - {b.end_time} · {b.total_hours || 0}h</div>}
                      </div>
                      {b.cancellation_reason && <div style={{ fontSize: '0.75rem', padding: '6px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: '6px', color: COLORS.red, marginBottom: '10px' }}>{b.cancellation_reason}</div>}
                      <button style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => { setSelectedBooking(b); setShowBookingModal(true); }}>View Details</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== JOBS TAB ===== */}
      {activeTab === 'jobs' && jobStats && (
        <div className="dash-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {[
              { label: 'Total Jobs', value: jobStats.total_jobs || 0, color: COLORS.purple, icon: '💼' },
              { label: 'Active', value: jobStats.active_jobs || 0, color: COLORS.green, icon: '🟢' },
              { label: 'Open', value: jobStats.open_jobs || 0, color: COLORS.amber, icon: '📭' },
              { label: 'In Progress', value: jobStats.in_progress_jobs || 0, color: COLORS.blue, icon: '🔄' },
              { label: 'Completed', value: jobStats.completed_jobs || 0, color: COLORS.green, icon: '✅' },
              { label: 'Cancelled', value: jobStats.cancelled_jobs || 0, color: COLORS.red, icon: '❌' },
              { label: 'Applications', value: jobStats.total_applications || 0, color: COLORS.pink, icon: '📝' },
              { label: 'Avg Rate', value: `$${parseFloat(jobStats.avg_hourly_rate || 0).toFixed(0)}`, color: COLORS.teal, icon: '💰' },
            ].map((s, i) => (
              <div key={i} style={{ ...miniCardStyle, borderLeft: `3px solid ${s.color}`, textAlign: 'center' }}>
                <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)' }}>{s.value}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '18px' }}>
            {jobStats.monthly?.length > 0 && (
              <div style={cardStyle()}>
                <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>Monthly Job Trends</h3>
                <div className="bar-chart">
                  {jobStats.monthly.map((m, i) => {
                    const max = Math.max(...jobStats.monthly.map(b => parseInt(b.count)), 1);
                    return (<div key={i} className="bar-item"><div className="bar-fill bar-fill-green" style={{ height: `${Math.max(8, (parseInt(m.count) / max) * 110)}px` }} /><span className="bar-value">{m.count}</span><span className="bar-label">{m.month.slice(5)}</span></div>);
                  })}
                </div>
              </div>
            )}

            {jobStats.topParents?.length > 0 && (
              <div style={cardStyle()}>
                <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>Top Parents</h3>
                {jobStats.topParents.slice(0, 6).map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < 5 ? '1px solid var(--color-border-light)' : 'none' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: COLORS.teal, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '700', flexShrink: 0 }}>{i + 1}</div>
                    <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--color-text)' }}>{p.first_name} {p.last_name}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: COLORS.purple }}>{p.jobs_posted}</span>
                  </div>
                ))}
              </div>
            )}

            {jobStats.topBabysitters?.length > 0 && (
              <div style={cardStyle()}>
                <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>Top Babysitters</h3>
                {jobStats.topBabysitters.slice(0, 6).map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < 5 ? '1px solid var(--color-border-light)' : 'none' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: COLORS.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '700', flexShrink: 0 }}>{i + 1}</div>
                    <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--color-text)' }}>{b.first_name} {b.last_name}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: COLORS.green }}>{b.jobs_completed}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Pending Apps', value: jobStats.pending_applications || 0, color: COLORS.amber },
              { label: 'Accepted Apps', value: jobStats.accepted_applications || 0, color: COLORS.green },
              { label: 'Rejected Apps', value: jobStats.rejected_applications || 0, color: COLORS.red },
              { label: 'Unique Parents', value: jobStats.unique_parents || 0, color: COLORS.teal },
              { label: 'Unique Sitters', value: jobStats.unique_babysitters || 0, color: COLORS.purple },
              { label: 'Booked Jobs', value: jobStats.booked_jobs || 0, color: COLORS.blue },
            ].map((s, i) => (
              <div key={i} style={{ ...miniCardStyle, borderLeft: `3px solid ${s.color}`, textAlign: 'center' }}>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)' }}>{s.value}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== REPORTS TAB ===== */}
      {activeTab === 'reports' && (
        <div className="dash-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {[
              { label: 'Total', value: reportStats.total, color: COLORS.purple, icon: '🚨' },
              { label: 'Pending', value: reportStats.pending, color: COLORS.amber, icon: '⏳' },
              { label: 'Reviewed', value: reportStats.reviewed, color: COLORS.blue, icon: '👀' },
              { label: 'Resolved', value: reportStats.resolved, color: COLORS.green, icon: '✅' },
              { label: 'Dismissed', value: reportStats.dismissed, color: COLORS.gray, icon: '❌' },
            ].map((s, i) => (
              <div key={i} style={{ ...miniCardStyle, borderLeft: `3px solid ${s.color}`, textAlign: 'center' }}>
                <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)' }}>{s.value}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={filterBarStyle}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.45 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search reports..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={searchInputStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ position: 'relative' }}>
              <select value={filters.reportStatus} onChange={(e) => setFilters({...filters, reportStatus: e.target.value})} style={filterSelectStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>
          {getFilteredReports().length === 0 ? <p className="no-results">No reports found</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
              {getFilteredReports().map(r => {
                const sevColor = { critical: COLORS.red, high: COLORS.orange, medium: COLORS.amber, low: COLORS.gray }[r.severity] || COLORS.amber;
                const stColor = getStatusColor(r.status);
                return (
                  <div key={`report-${r.id}`} style={{ ...cardStyle(), padding: 0, overflow: 'hidden', borderLeft: `3px solid ${sevColor}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--color-text)' }}>#{r.id}</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: '700', padding: '2px 8px', borderRadius: '8px', background: sevColor, color: '#fff', textTransform: 'uppercase' }}>{r.severity || 'medium'}</span>
                      </div>
                      <span style={{ fontSize: '0.65rem', fontWeight: '600', padding: '3px 10px', borderRadius: '10px', background: stColor, color: '#fff', textTransform: 'uppercase' }}>{r.status}</span>
                    </div>
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '0.8rem' }}><span style={{ color: 'var(--color-text-muted)' }}>Reporter: </span><span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{r.reporter_first_name || r.reporter_name} {r.reporter_last_name || ''}</span></div>
                        <div style={{ fontSize: '0.8rem' }}><span style={{ color: 'var(--color-text-muted)' }}>Reported: </span><span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{r.reported_first_name || r.reported_name} {r.reported_last_name || ''}</span></div>
                      </div>
                      <div style={{ fontSize: '0.8rem', marginBottom: '6px' }}><span style={{ color: 'var(--color-text-muted)' }}>Category: </span><span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{r.category?.replace('_', ' ') || r.reason}</span></div>
                      {r.reason && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: '12px', lineHeight: 1.4 }}>{r.reason}</div>}
                      <button style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => { setSelectedReport(r); setShowReportModal(true); setReportAction({ status: r.status, admin_notes: r.admin_notes || '', admin_action: r.admin_action || '', refund_status: r.refund_status || '', refund_amount: r.refund_amount || '', warning_message: '' }); }}>Manage Report</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== ACTIVITY LOG TAB ===== */}
      {activeTab === 'activity' && (
        <div className="dash-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {[
              { label: 'Total Actions', value: activityLog.length, color: COLORS.purple, icon: '📋' },
              { label: 'Suspensions', value: activityLog.filter(l => l.action?.includes('suspend')).length, color: COLORS.red, icon: '🔒' },
              { label: 'Approvals', value: activityLog.filter(l => l.action?.includes('verify')).length, color: COLORS.green, icon: '✅' },
              { label: 'Deletions', value: activityLog.filter(l => l.action?.includes('delete')).length, color: COLORS.orange, icon: '🗑️' },
            ].map((s, i) => (
              <div key={i} style={{ ...miniCardStyle, borderLeft: `3px solid ${s.color}`, textAlign: 'center' }}>
                <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)' }}>{s.value}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          {activityLog.length === 0 ? <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px' }}>No activity logged yet.</p> : (
            <div style={cardStyle()}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {activityLog.map((log, i) => {
                  const actInfo = formatAction(log.action);
                  const actColor = log.action?.includes('suspend') ? COLORS.red : log.action?.includes('verify') ? COLORS.green : log.action?.includes('delete') ? COLORS.orange : log.action?.includes('revision') ? COLORS.amber : log.action?.includes('restore') ? COLORS.teal : log.action?.includes('warning') ? COLORS.amber : COLORS.purple;
                  const detailText = formatDetails(log.details, log.action);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 0', borderBottom: i < activityLog.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '10px', background: hexToRgba(actColor, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0, border: `1px solid ${hexToRgba(actColor, 0.13)}` }}>
                        {actInfo.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text)', lineHeight: 1.4 }}>
                          <strong>{log.first_name} {log.last_name}</strong>
                          <span style={{ color: 'var(--color-text-secondary)' }}> {actInfo.label.toLowerCase()} </span>
                          {log.target_type && <span style={{ color: 'var(--color-text-muted)' }}>on <span style={{ fontWeight: '600' }}>{log.target_type}</span> #{log.target_id}</span>}
                        </div>
                        {detailText && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '5px', padding: '7px 12px', background: hexToRgba(actColor, 0.04), borderRadius: '8px', border: `1px solid ${hexToRgba(actColor, 0.08)}`, lineHeight: 1.5 }}>{detailText}</div>}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', flexShrink: 0, marginTop: '2px' }}>{new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== REVIEWS TAB ===== */}
      {activeTab === 'reviews' && (
        <div style={{ padding: '0 4px' }}>
          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Total Reviews', value: reviews.length, color: COLORS.purple, icon: '⭐' },
              { label: '5 Stars', value: reviews.filter(r => parseInt(r.rating) === 5).length, color: COLORS.green, icon: '🌟' },
              { label: '4 Stars', value: reviews.filter(r => parseInt(r.rating) === 4).length, color: '#22c55e', icon: '⭐' },
              { label: '3 Stars', value: reviews.filter(r => parseInt(r.rating) === 3).length, color: COLORS.amber, icon: '⭐' },
              { label: 'Low Rating', value: reviews.filter(r => parseInt(r.rating) <= 2).length, color: COLORS.red, icon: '⚠️' },
              { label: 'Avg Rating', value: reviews.length > 0 ? (reviews.reduce((s, r) => s + parseInt(r.rating || 0), 0) / reviews.length).toFixed(1) : '0', color: COLORS.teal, icon: '📊' },
            ].map((s, i) => (
              <div key={i} style={{ ...miniCardStyle, borderLeft: `3px solid ${s.color}`, textAlign: 'center' }}>
                <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)' }}>{s.value}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          {/* Filter Bar */}
          <div style={filterBarStyle}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.45 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search reviews..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={searchInputStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ position: 'relative' }}>
              <select value={filters.reviewRating} onChange={(e) => setFilters({...filters, reviewRating: e.target.value})} style={filterSelectStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}>
                <option value="all">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>
          </div>
          {/* Reviews List */}
          {getFilteredReviews().length === 0 ? <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px' }}>No reviews found.</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
              {getFilteredReviews().map((r, i) => {
                const ratingColor = parseInt(r.rating) >= 4 ? COLORS.green : parseInt(r.rating) === 3 ? COLORS.amber : COLORS.red;
                return (
                  <div key={r.id || i} style={{ ...cardStyle(), padding: 0, overflow: 'hidden' }}>
                    <div style={{ background: `linear-gradient(135deg, ${hexToRgba(ratingColor, 0.08)}, transparent)`, padding: '14px 18px 10px', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: `linear-gradient(135deg, ${ratingColor}, ${hexToRgba(ratingColor, 0.7)})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.8rem', flexShrink: 0 }}>{r.reviewer_name?.[0] || '?'}</div>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--color-text)' }}>{r.reviewer_name || 'Anonymous'}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>reviewed {r.babysitter_name || 'a babysitter'}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '2px', color: COLORS.amber, fontSize: '0.85rem' }}>
                          {[1,2,3,4,5].map(star => <span key={star} style={{ opacity: star <= parseInt(r.rating) ? 1 : 0.25 }}>{String.fromCodePoint(9733)}</span>)}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '12px 18px 16px' }}>
                      {r.comment && <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>&ldquo;{r.comment}&rdquo;</p>}
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== REFUNDS TAB ===== */}
      {activeTab === 'refunds' && (
        <div style={{ padding: '0 4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Total Requests', value: refunds.length, color: COLORS.blue, icon: '💰' },
              { label: 'Pending', value: refunds.filter(r => r.refund_status === 'pending').length, color: COLORS.amber, icon: '⏳' },
              { label: 'Approved', value: refunds.filter(r => r.refund_status === 'approved').length, color: COLORS.green, icon: '✅' },
              { label: 'Rejected', value: refunds.filter(r => r.refund_status === 'rejected').length, color: COLORS.red, icon: '❌' },
              { label: 'Processed', value: refunds.filter(r => r.refund_status === 'processed').length, color: COLORS.purple, icon: '🔄' },
            ].map((s, i) => (
              <div key={i} style={{ ...miniCardStyle, borderLeft: `3px solid ${s.color}`, textAlign: 'center' }}>
                <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)' }}>{s.value}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={filterBarStyle}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.45 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search refunds..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={searchInputStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ position: 'relative' }}>
              <select value={filters.refundStatus} onChange={(e) => setFilters({...filters, refundStatus: e.target.value})} style={filterSelectStyle} onFocus={(e) => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="processed">Processed</option>
              </select>
            </div>
          </div>
          {getFilteredRefunds().length === 0 ? <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px' }}>No refund requests found.</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
              {getFilteredRefunds().map((r, i) => {
                const statusColor = r.refund_status === 'approved' ? COLORS.green : r.refund_status === 'rejected' ? COLORS.red : r.refund_status === 'processed' ? COLORS.purple : COLORS.amber;
                return (
                  <div key={r.id || i} style={{ ...cardStyle(), padding: 0, overflow: 'hidden' }}>
                    <div style={{ background: `linear-gradient(135deg, ${hexToRgba(statusColor, 0.08)}, transparent)`, padding: '14px 18px 10px', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text)' }}>Refund #{r.id || i + 1}</div>
                        <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', background: statusColor, color: '#fff', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase' }}>{r.refund_status || 'pending'}</span>
                      </div>
                    </div>
                    <div style={{ padding: '12px 18px 16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                        <div><strong>Reporter:</strong> {r.reporter_name || 'N/A'}</div>
                        <div><strong>Reported:</strong> {r.reported_name || 'N/A'}</div>
                        <div><strong>Amount:</strong> <span style={{ color: COLORS.green, fontWeight: '700' }}>${parseFloat(r.refund_amount || 0).toFixed(2)}</span></div>
                        <div><strong>Report:</strong> #{r.report_id}</div>
                      </div>
                      {r.reason && <div style={{ marginTop: '8px', fontSize: '0.82rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>&ldquo;{r.reason}&rdquo;</div>}
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== NOTIFICATIONS TAB ===== */}
      {activeTab === 'notifications' && (
        <div style={{ padding: '0 4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Total Sent', value: activityLog.filter(l => l.action?.includes('notification')).length, color: COLORS.blue, icon: '🔔' },
              { label: 'To Parents', value: '—', color: COLORS.teal, icon: '👨‍👩‍👧' },
              { label: 'To Sitters', value: '—', color: COLORS.purple, icon: '👶' },
              { label: 'To All', value: '—', color: COLORS.amber, icon: '📢' },
            ].map((s, i) => (
              <div key={i} style={{ ...miniCardStyle, borderLeft: `3px solid ${s.color}`, textAlign: 'center' }}>
                <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text)' }}>{s.value}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          {/* Compose Notification */}
          <div style={{ ...cardStyle(), marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: '700', color: 'var(--color-text)' }}>Send Notification</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Target Audience</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[{ value: 'all', label: 'All Users', icon: '📢' }, { value: 'parent', label: 'Parents', icon: '👨‍👩‍👧' }, { value: 'babysitter', label: 'Babysitters', icon: '👶' }].map(opt => (
                  <button key={opt.value} onClick={() => setNotifForm({ ...notifForm, target_role: opt.value })} style={{ padding: '8px 16px', borderRadius: 'var(--radius)', border: notifForm.target_role === opt.value ? '2px solid #6366F1' : '1.5px solid var(--color-border)', background: notifForm.target_role === opt.value ? 'rgba(99,102,241,0.06)' : 'var(--color-surface)', color: notifForm.target_role === opt.value ? '#6366F1' : 'var(--color-text-secondary)', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}>{opt.icon} {opt.label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Title</label>
              <input type="text" value={notifForm.title} onChange={(e) => setNotifForm({ ...notifForm, title: e.target.value })} placeholder="Notification title..." style={{ width: '100%', padding: '11px 16px', borderRadius: 'var(--radius)', border: '1.5px solid var(--color-border)', fontSize: '0.92rem', background: 'var(--color-surface)', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Message</label>
              <textarea value={notifForm.message} onChange={(e) => setNotifForm({ ...notifForm, message: e.target.value })} placeholder="Write your notification message..." rows={4} style={{ width: '100%', padding: '11px 16px', borderRadius: 'var(--radius)', border: '1.5px solid var(--color-border)', fontSize: '0.92rem', background: 'var(--color-surface)', color: 'var(--color-text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>This will send to {notifForm.target_role === 'all' ? 'all users' : notifForm.target_role === 'parent' ? 'all parents' : 'all babysitters'}</span>
              <button onClick={handleSendNotification} style={{ padding: '10px 24px', borderRadius: 'var(--radius)', border: 'none', background: 'linear-gradient(135deg, #4F46E5, #6366F1)', color: '#fff', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>{String.fromCodePoint(128227)} Send Notification</button>
            </div>
          </div>
          {/* Recent Notification Activity */}
          <div style={cardStyle()}>
            <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>Recent Notification Activity</h3>
            {activityLog.filter(l => l.action?.includes('notification')).length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '30px', fontSize: '0.88rem' }}>No notifications sent yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {activityLog.filter(l => l.action?.includes('notification')).map((log, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 0', borderBottom: i < activityLog.filter(l => l.action?.includes('notification')).length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: hexToRgba(COLORS.blue, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>🔔</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}><strong>{log.first_name} {log.last_name}</strong> sent a notification</div>
                      {formatDetails(log.details, log.action) && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '3px' }}>{formatDetails(log.details, log.action)}</div>}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== LOCATIONS TAB ===== */}
      {activeTab === 'locations' && (
        <div className="dash-content">
          <AdminLocationManager />
        </div>
      )}

      {/* ===== MODALS ===== */}
      {selectedDoc && (
        <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="modal document-viewer" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{getDocumentTypeLabel(selectedDoc.document_type)} - {selectedDoc.first_name} {selectedDoc.last_name}</h3><button className="modal-close" onClick={() => setSelectedDoc(null)}>×</button></div>
            <div className="modal-body">
              {selectedDoc.document_url?.match(/\.(jpg|jpeg|png|gif)$/i) ? <img src={selectedDoc.document_url} alt="Document" style={{ maxWidth: '100%', maxHeight: '70vh' }} /> : <iframe src={selectedDoc.document_url} title="Document" style={{ width: '100%', height: '70vh', border: 'none', background: 'var(--color-bg-alt)' }} />}
            </div>
            <div className="modal-footer">
              {!selectedDoc.is_verified && (<>
                <button className="btn btn-verify" onClick={() => { verifyDocument(selectedDoc.id, true); setSelectedDoc(null); }}>Approve</button>
                <button className="btn btn-revision" onClick={() => { setCurrentDocId(selectedDoc.id); setShowRevisionModal(true); setSelectedDoc(null); }}>Revision</button>
                <button className="btn btn-reject" onClick={() => { verifyDocument(selectedDoc.id, false, 'Rejected'); setSelectedDoc(null); }}>Reject</button>
              </>)}
              <button className="btn btn-secondary" onClick={() => setSelectedDoc(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showRevisionModal && (
        <div className="modal-overlay" onClick={() => setShowRevisionModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Request Document Revision</h3><button className="modal-close" onClick={() => setShowRevisionModal(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-group"><label>Revision Notes <span style={{ color: '#ef4444' }}>*</span></label><textarea value={revisionNotes} onChange={e => setRevisionNotes(e.target.value)} placeholder="Explain what needs to change..." rows={5} required /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowRevisionModal(false)}>Cancel</button><button className="btn btn-primary" onClick={requestDocumentRevision}>Send Request</button></div>
          </div>
        </div>
      )}

      {showUserModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{selectedUser.suspended_at ? 'Restore User' : 'Suspend User'}</h3><button className="modal-close" onClick={() => setShowUserModal(false)}>×</button></div>
            <div className="modal-body">
              <p><strong>{selectedUser.first_name} {selectedUser.last_name}</strong><br /><span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{selectedUser.email} · {selectedUser.role}</span></p>
              {!selectedUser.suspended_at && <div className="form-group" style={{ marginTop: 16 }}><label>Suspension Reason <span style={{ color: '#ef4444' }}>*</span></label><textarea value={suspensionReason} onChange={e => setSuspensionReason(e.target.value)} placeholder="Why is this user being suspended?" rows={3} required /></div>}
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Cancel</button><button className={`btn ${selectedUser.suspended_at ? 'btn-success' : 'btn-danger'}`} onClick={() => toggleUserSuspension(selectedUser.id, !selectedUser.suspended_at)}>{selectedUser.suspended_at ? 'Restore User' : 'Confirm Suspension'}</button></div>
          </div>
        </div>
      )}

      {showBookingModal && selectedBooking && (
        <div className="modal-overlay" onClick={() => setShowBookingModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Booking #{selectedBooking.id}</h3><button className="modal-close" onClick={() => setShowBookingModal(false)}>×</button></div>
            <div className="modal-body">
              <div className="booking-details">
                {[
                  ['Parent', `${selectedBooking.parent_first_name || selectedBooking.parent_name} ${selectedBooking.parent_last_name}`],
                  ['Babysitter', `${selectedBooking.babysitter_first_name || selectedBooking.babysitter_name} ${selectedBooking.babysitter_last_name}`],
                  ['Date', selectedBooking.start_date ? `${new Date(selectedBooking.start_date).toLocaleDateString()} ${selectedBooking.start_time || ''} - ${selectedBooking.end_time || ''}` : 'N/A'],
                  ['Hours', `${selectedBooking.total_hours || 0}h`],
                  ['Amount', `$${parseFloat(selectedBooking.total_amount || 0).toFixed(2)}`],
                ].map(([label, value], i) => (
                  <div key={i} className="detail-row"><span className="label">{label}:</span><span className="value">{value}</span></div>
                ))}
                <div className="detail-row"><span className="label">Status:</span><span className={`booking-status ${statusClass(selectedBooking.status)}`}>{selectedBooking.status}</span></div>
                {selectedBooking.cancellation_reason && <div className="detail-row"><span className="label">Reason:</span><span className="value" style={{ color: '#ef4444' }}>{selectedBooking.cancellation_reason}</span></div>}
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowBookingModal(false)}>Close</button></div>
          </div>
        </div>
      )}

      {showReportModal && selectedReport && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header"><h3>Report #{selectedReport.id}</h3><button className="modal-close" onClick={() => setShowReportModal(false)}>×</button></div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                {[
                  ['Reporter', `${selectedReport.reporter_first_name || selectedReport.reporter_name} ${selectedReport.reporter_last_name}`],
                  ['Reported', `${selectedReport.reported_first_name || selectedReport.reported_name} ${selectedReport.reported_last_name}`],
                  ['Category', selectedReport.category?.replace('_', ' ') || 'General'],
                  ['Reason', selectedReport.reason],
                ].map(([label, value], i) => (
                  <div key={i} className="detail-row"><span className="label">{label}:</span><span className="value">{value}</span></div>
                ))}
                <div className="detail-row"><span className="label">Severity:</span><span className={`severity-badge severity-${selectedReport.severity || 'medium'}`}>{selectedReport.severity?.toUpperCase() || 'MEDIUM'}</span></div>
                {selectedReport.description && <div className="detail-row"><span className="label">Description:</span><span className="value">{selectedReport.description}</span></div>}
                {selectedReport.admin_notes && <div className="detail-row"><span className="label">Admin Notes:</span><span className="value" style={{ color: COLORS.purple }}>{selectedReport.admin_notes}</span></div>}
              </div>
              <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '16px' }}>
                <h4 style={{ marginBottom: '12px', color: 'var(--color-text)' }}>Admin Actions</h4>
                <div className="form-group"><label>Status</label><select value={reportAction.status} onChange={e => setReportAction({...reportAction, status: e.target.value})}>
                  <option value="pending">Pending</option><option value="reviewed">Reviewed</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option>
                </select></div>
                <div className="form-group"><label>Admin Notes</label><textarea value={reportAction.admin_notes} onChange={e => setReportAction({...reportAction, admin_notes: e.target.value})} placeholder="Notes..." rows={3} /></div>
                <div className="form-group"><label>Action</label><select value={reportAction.admin_action} onChange={e => setReportAction({...reportAction, admin_action: e.target.value})}>
                  <option value="">Select...</option><option value="warning">Warning</option><option value="suspension">Suspension</option><option value="refund">Refund</option><option value="dismissed">Dismiss</option><option value="ban">Ban</option>
                </select></div>
                {reportAction.admin_action === 'warning' && <div className="form-group"><label>Warning Message</label><input type="text" value={reportAction.warning_message} onChange={e => setReportAction({...reportAction, warning_message: e.target.value})} placeholder="Warning message..." /></div>}
                {reportAction.admin_action === 'refund' && (<>
                  <div className="form-group"><label>Refund Status</label><select value={reportAction.refund_status} onChange={e => setReportAction({...reportAction, refund_status: e.target.value})}>
                    <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="processed">Processed</option>
                  </select></div>
                  <div className="form-group"><label>Refund Amount</label><input type="number" value={reportAction.refund_amount} onChange={e => setReportAction({...reportAction, refund_amount: e.target.value})} placeholder="0.00" step="0.01" min="0" /></div>
                </>)}
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowReportModal(false)}>Close</button><button className="btn btn-primary" onClick={() => handleReportAction(selectedReport.id)}>Apply Action</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;