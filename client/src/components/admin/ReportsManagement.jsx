// client/src/components/admin/ReportsManagement.jsx
import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useToast } from '../Toast';

function ReportsManagement() {
  const { addToast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ status: 'all', category: 'all', severity: 'all' });
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [restoreReason, setRestoreReason] = useState('');
  const [adminAction, setAdminAction] = useState({
    status: '',
    admin_notes: '',
    admin_action: '',
    refund_status: '',
    refund_amount: '',
    warning_message: '',
    suspension_duration: 7,
    ban_reason: '',
  });

  // Auto-refresh every 30 seconds
  useEffect(() => {
    loadReports();
    loadStats();
    
    const interval = setInterval(() => {
      loadReports();
      loadStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [filters]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params.append(key, value);
      });
      const res = await API.get(`/reports/admin/all?${params.toString()}`);
      setReports(res.data.reports || []);
    } catch (error) {
      addToast('Failed to load reports', 'error');
      console.error('Reports error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await API.get('/reports/admin/stats');
      setStats(res.data);
    } catch (error) {
      console.error('Stats error:', error);
    }
  };

  const updateReport = async (reportId) => {
    try {
      await API.put(`/reports/admin/${reportId}`, adminAction);
      addToast('Report updated successfully!', 'success');
      setShowReportModal(false);
      loadReports();
      loadStats();
      setAdminAction({ 
        status: '', 
        admin_notes: '', 
        admin_action: '', 
        refund_status: '', 
        refund_amount: '', 
        warning_message: '',
        suspension_duration: 7,
        ban_reason: '',
      });
    } catch (error) {
      addToast('Failed to update report', 'error');
    }
  };

  const handleRestoreUser = async (userId) => {
    if (!restoreReason.trim()) {
      addToast('Please provide a restoration reason.', 'error');
      return;
    }

    try {
      await API.put(`/reports/restore/${userId}`, { 
        reason: restoreReason 
      });
      addToast('User restored successfully!', 'success');
      setShowRestoreModal(false);
      setRestoreReason('');
      setSelectedUser(null);
      loadReports();
      loadStats();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to restore user', 'error');
    }
  };

  const getSeverityBadge = (severity) => {
    const colors = {
      low: '#6b7280',
      medium: '#f59e0b',
      high: '#ef4444',
      critical: '#7f1d1d'
    };
    return (
      <span className="severity-badge" style={{ 
        backgroundColor: colors[severity] || '#6b7280', 
        color: 'white', 
        padding: '2px 8px', 
        borderRadius: '4px', 
        fontSize: '11px', 
        fontWeight: '600' 
      }}>
        {severity?.toUpperCase() || 'MEDIUM'}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: '#f59e0b',
      reviewed: '#3b82f6',
      resolved: '#10b981',
      dismissed: '#6b7280'
    };
    return (
      <span className="status-badge" style={{ 
        backgroundColor: colors[status] || '#6b7280', 
        color: 'white', 
        padding: '2px 8px', 
        borderRadius: '4px', 
        fontSize: '11px', 
        fontWeight: '600' 
      }}>
        {status || 'PENDING'}
      </span>
    );
  };

  const getCategoryLabel = (category) => {
    const labels = {
      unprofessional_behavior: 'Unprofessional Behavior',
      no_show: 'No Show',
      late_arrival: 'Late Arrival',
      cancellation_without_notice: 'Cancellation Without Notice',
      inappropriate_conduct: 'Inappropriate Conduct',
      safety_concern: 'Safety Concern',
      fraud: 'Fraud',
      harassment: 'Harassment',
      dispute: 'Payment Dispute',
      last_minute_cancellation: 'Last Minute Cancellation',
      disrespectful: 'Disrespectful Behavior',
      payment_issue: 'Payment Issue',
      unreasonable_demands: 'Unreasonable Demands',
      other: 'Other'
    };
    return labels[category] || category || 'General';
  };

  const getActionBadge = (action) => {
    const configs = {
      warning: { label: '⚠️ Warning', color: '#f59e0b' },
      suspension: { label: '⛔ Suspension', color: '#ef4444' },
      ban: { label: '🚫 Banned', color: '#7f1d1d' },
      refund: { label: '💰 Refund', color: '#10b981' },
      dismissed: { label: '❌ Dismissed', color: '#6b7280' },
    };
    const config = configs[action];
    if (!config) return null;
    return (
      <span style={{ 
        backgroundColor: config.color, 
        color: 'white', 
        padding: '2px 8px', 
        borderRadius: '4px', 
        fontSize: '10px', 
        fontWeight: '600',
        display: 'inline-block'
      }}>
        {config.label}
      </span>
    );
  };

  const getUserStatusBadge = (user) => {
    if (!user) return null;
    if (user.is_active === false && user.suspended_at) {
      if (!user.suspension_end_date) {
        return <span style={{ backgroundColor: '#7f1d1d', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>🚫 BANNED</span>;
      }
      return <span style={{ backgroundColor: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>⛔ SUSPENDED</span>;
    }
    return <span style={{ backgroundColor: '#10b981', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>✅ ACTIVE</span>;
  };

  const isUserSuspended = (user) => {
    return user && user.suspended_at && user.is_active === false;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="reports-management">
      <div className="management-header">
        <h2>🚨 Reports Management</h2>
        <div className="management-controls">
          <select
            className="filter-select"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <select
            className="filter-select"
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button 
            className="btn btn-sm btn-outline" 
            onClick={loadReports}
            style={{ padding: '6px 12px' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid" style={{ marginBottom: '20px' }}>
          <div className="stat stat-warning">
            <span className="stat-number">{stats.pending_reports || 0}</span>
            <span className="stat-label">Pending</span>
          </div>
          <div className="stat stat-danger">
            <span className="stat-number">{stats.critical_reports || 0}</span>
            <span className="stat-label">Critical</span>
          </div>
          <div className="stat stat-primary">
            <span className="stat-number">{stats.total_reports || 0}</span>
            <span className="stat-label">Total Reports</span>
          </div>
          <div className="stat stat-success">
            <span className="stat-number">{stats.refunds_approved || 0}</span>
            <span className="stat-label">Refunds</span>
          </div>
          <div className="stat stat-warning">
            <span className="stat-number">{stats.warnings_issued || 0}</span>
            <span className="stat-label">Warnings</span>
          </div>
          <div className="stat stat-danger">
            <span className="stat-number">{stats.suspensions_issued || 0}</span>
            <span className="stat-label">Suspensions</span>
          </div>
          <div className="stat stat-danger" style={{ backgroundColor: '#7f1d1d' }}>
            <span className="stat-number">{stats.bans_issued || 0}</span>
            <span className="stat-label">Bans</span>
          </div>
        </div>
      )}

      {/* Reports Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Reporter</th>
              <th>Reported User</th>
              <th>Status</th>
              <th>Category</th>
              <th>Severity</th>
              <th>Action</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-state">No reports found</td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr key={report.id} style={{ 
                  background: report.severity === 'critical' ? 'rgba(127, 29, 29, 0.08)' : 
                             report.severity === 'high' ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                }}>
                  <td>#{report.id}</td>
                  <td>
                    <strong>{report.reporter_first_name || report.reporter_name || 'Unknown'}</strong>
                    <br />
                    <small style={{ color: 'var(--text-muted)' }}>{report.reporter_email}</small>
                  </td>
                  <td>
                    <strong>{report.reported_first_name || report.reported_name || 'Unknown'}</strong>
                    <br />
                    <small style={{ color: 'var(--text-muted)' }}>
                      {report.reported_role || 'User'} • {report.total_reports || 0} reports
                    </small>
                    <br />
                    {getUserStatusBadge(report)}
                  </td>
                  <td>{getStatusBadge(report.status)}</td>
                  <td>{getCategoryLabel(report.category)}</td>
                  <td>{getSeverityBadge(report.severity)}</td>
                  <td>{getActionBadge(report.admin_action)}</td>
                  <td>
                    <button 
                      className="btn btn-sm btn-outline"
                      onClick={() => {
                        setSelectedReport(report);
                        setShowReportModal(true);
                        setAdminAction({ 
                          status: report.status || 'pending', 
                          admin_notes: report.admin_notes || '',
                          admin_action: report.admin_action || '',
                          refund_status: report.refund_status || '',
                          refund_amount: report.refund_amount || '',
                          warning_message: '',
                          suspension_duration: 7,
                          ban_reason: '',
                        });
                      }}
                      style={{ marginRight: '4px' }}
                    >
                      👁️ Manage
                    </button>
                    {isUserSuspended(report) && (
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={() => {
                          setSelectedUser(report);
                          setShowRestoreModal(true);
                          setRestoreReason('');
                        }}
                      >
                        🔓 Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Report Detail Modal */}
      {showReportModal && selectedReport && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>📋 Report #{selectedReport.id}</h3>
              <button className="modal-close" onClick={() => setShowReportModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <div className="report-details" style={{ marginBottom: '20px' }}>
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Reporter:</span>
                  <span className="value">{selectedReport.reporter_first_name || selectedReport.reporter_name} {selectedReport.reporter_last_name || ''}</span>
                </div>
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Reported User:</span>
                  <span className="value">
                    {selectedReport.reported_first_name || selectedReport.reported_name} {selectedReport.reported_last_name || ''}
                    <br />
                    {getUserStatusBadge(selectedReport)}
                    {selectedReport.suspended_at && selectedReport.suspension_end_date && (
                      <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                        Suspended until: {new Date(selectedReport.suspension_end_date).toLocaleDateString()}
                      </small>
                    )}
                  </span>
                </div>
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Category:</span>
                  <span className="value">{getCategoryLabel(selectedReport.category)}</span>
                </div>
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Severity:</span>
                  <span className="value">{getSeverityBadge(selectedReport.severity)}</span>
                </div>
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Reason:</span>
                  <span className="value">{selectedReport.reason}</span>
                </div>
                {selectedReport.description && (
                  <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Description:</span>
                    <span className="value">{selectedReport.description}</span>
                  </div>
                )}
                {selectedReport.booking_id && (
                  <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Booking:</span>
                    <span className="value">#{selectedReport.booking_id}</span>
                  </div>
                )}
                {selectedReport.refund_requested && (
                  <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Refund Requested:</span>
                    <span className="value" style={{ color: '#f59e0b' }}>${selectedReport.refund_amount || '0.00'}</span>
                  </div>
                )}
                {selectedReport.admin_action && (
                  <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Action Taken:</span>
                    <span className="value">{getActionBadge(selectedReport.admin_action)}</span>
                  </div>
                )}
                {selectedReport.admin_notes && (
                  <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span className="label" style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Admin Notes:</span>
                    <span className="value" style={{ color: 'var(--primary)' }}>{selectedReport.admin_notes}</span>
                  </div>
                )}
              </div>

              <div className="admin-actions" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h4 style={{ marginBottom: '12px' }}>Admin Actions</h4>
                
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={adminAction.status}
                    onChange={(e) => setAdminAction({ ...adminAction, status: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  >
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Admin Notes</label>
                  <textarea
                    value={adminAction.admin_notes}
                    onChange={(e) => setAdminAction({ ...adminAction, admin_notes: e.target.value })}
                    placeholder="Add notes about this report..."
                    rows={3}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', resize: 'vertical' }}
                  />
                </div>

                <div className="form-group">
                  <label>Admin Action</label>
                  <select
                    value={adminAction.admin_action}
                    onChange={(e) => setAdminAction({ ...adminAction, admin_action: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  >
                    <option value="">Select action...</option>
                    <option value="warning">⚠️ Warning</option>
                    <option value="suspension">⛔ Suspension</option>
                    <option value="refund">💰 Refund</option>
                    <option value="dismissed">❌ Dismiss</option>
                    <option value="ban">🚫 Ban</option>
                  </select>
                </div>

                {adminAction.admin_action === 'warning' && (
                  <div className="form-group">
                    <label>Warning Message</label>
                    <input
                      type="text"
                      value={adminAction.warning_message}
                      onChange={(e) => setAdminAction({ ...adminAction, warning_message: e.target.value })}
                      placeholder="Warning message to user..."
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                    />
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                      ⚠️ 3 warnings = auto-suspension for 7 days
                    </small>
                  </div>
                )}

                {adminAction.admin_action === 'suspension' && (
                  <div className="form-group">
                    <label>Suspension Duration (days)</label>
                    <input
                      type="number"
                      value={adminAction.suspension_duration}
                      onChange={(e) => setAdminAction({ ...adminAction, suspension_duration: parseInt(e.target.value) || 7 })}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                      min="1"
                      max="365"
                    />
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                      ⛔ User will be suspended for {adminAction.suspension_duration || 7} days
                    </small>
                  </div>
                )}

                {adminAction.admin_action === 'ban' && (
                  <div className="form-group">
                    <label>Ban Reason</label>
                    <textarea
                      value={adminAction.ban_reason}
                      onChange={(e) => setAdminAction({ ...adminAction, ban_reason: e.target.value })}
                      placeholder="Reason for permanent ban..."
                      rows={2}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', resize: 'vertical' }}
                    />
                    <small style={{ color: '#ef4444', display: 'block', marginTop: '4px' }}>
                      🚫 This action is permanent and cannot be easily undone
                    </small>
                  </div>
                )}

                {adminAction.admin_action === 'refund' && (
                  <>
                    <div className="form-group">
                      <label>Refund Status</label>
                      <select
                        value={adminAction.refund_status}
                        onChange={(e) => setAdminAction({ ...adminAction, refund_status: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">✅ Approved</option>
                        <option value="rejected">❌ Rejected</option>
                        <option value="processed">💰 Processed</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Refund Amount</label>
                      <input
                        type="number"
                        value={adminAction.refund_amount}
                        onChange={(e) => setAdminAction({ ...adminAction, refund_amount: e.target.value })}
                        placeholder="0.00"
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowReportModal(false)}>
                Close
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => updateReport(selectedReport.id)}
              >
                Apply Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore User Modal */}
      {showRestoreModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowRestoreModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%' }}>
            <div className="modal-header">
              <h3>🔓 Restore User Account</h3>
              <button className="modal-close" onClick={() => setShowRestoreModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <p>
                <strong>{selectedUser.reported_first_name || selectedUser.reported_name} {selectedUser.reported_last_name || ''}</strong>
                <br />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {selectedUser.reported_email}
                </span>
                <br />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Role: {selectedUser.reported_role || 'User'}
                </span>
                {selectedUser.suspended_at && (
                    <>
                  <br />
                  <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>
                    Suspended since: {new Date(selectedUser.suspended_at).toLocaleDateString()}
                    {selectedUser.suspension_end_date && (
                      <> • Until: {new Date(selectedUser.suspension_end_date).toLocaleDateString()}</>
                    )}
                  </span>
                </>
                )}
              </p>
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Restoration Reason <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  placeholder="Explain why this user is being restored..."
                  rows={3}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', resize: 'vertical' }}
                  required
                />
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowRestoreModal(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-success" 
                onClick={() => handleRestoreUser(selectedUser.reported_user_id || selectedUser.user_id)}
              >
                ✅ Restore User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportsManagement;