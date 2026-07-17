// client/src/pages/JobApplications.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import { useToast } from '../components/Toast';
import BackButton from '../components/BackButton';

function JobApplications() {
  const { addToast } = useToast();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const res = await API.get('/jobs/applications/my');
      setApplications(res.data);
    } catch (error) {
      addToast('Failed to load applications', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleJobStatus = async (jobId, status) => {
    try {
      await API.put(`/jobs/${jobId}/status`, { status });
      addToast(`Job ${status}!`, 'success');
      loadApplications();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to update job', 'error');
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: <span className="badge badge-warning">Pending</span>,
      accepted: <span className="badge badge-success">✅ Accepted</span>,
      rejected: <span className="badge badge-danger">Rejected</span>,
      withdrawn: <span className="badge badge-secondary">Withdrawn</span>
    };
    return statusMap[status] || <span className="badge badge-secondary">{status}</span>;
  };

  const getJobStatusBadge = (status) => {
    const statusMap = {
      active: <span className="badge badge-success">Active</span>,
      in_progress: <span className="badge badge-warning">In Progress</span>,
      completed: <span className="badge badge-primary">Completed</span>,
      cancelled: <span className="badge badge-danger">Cancelled</span>
    };
    return statusMap[status] || <span className="badge badge-secondary">{status}</span>;
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <BackButton label="← Back to Dashboard" fallback="/dashboard" />

      {/* Gradient Hero */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #6366F1)', borderRadius: 'var(--radius-lg)', padding: '28px 32px', marginBottom: '24px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800' }}>{String.fromCodePoint(128203)} My Applications</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.9rem' }}>Track your job applications</p>
          </div>
          <Link to="/jobs" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: 'var(--radius)', border: 'none', background: '#fff', color: '#4F46E5', fontWeight: '700', fontSize: '0.88rem', textDecoration: 'none', boxShadow: 'var(--shadow-sm)' }}>
            {String.fromCodePoint(128269)} Find More Jobs
          </Link>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="no-results">
          <p>You haven't applied for any jobs yet.</p>
          <Link to="/jobs" className="btn btn-primary" style={{ marginTop: '12px' }}>
            🔍 Find Jobs
          </Link>
        </div>
      ) : (
        <div className="applications-list">
          {applications.map((app) => {
            const isSelected = app.job_status === 'in_progress' && app.selected_babysitter_id === app.babysitter_id;
            
            return (
              <div key={app.id} className="application-card">
                <div className="application-card-header">
                  <div>
                    <h3>{app.title}</h3>
                    <div className="application-parent">
                      👤 {app.first_name} {app.last_name}
                      {app.city && <span style={{ marginLeft: '8px' }}>📍 {app.city}</span>}
                    </div>
                  </div>
                  {getStatusBadge(app.status)}
                </div>

                <div className="application-card-body">
                  <div className="application-details">
                    <div>
                      <span className="label">📅 Dates</span>
                      <span>{formatDate(app.start_date)} - {formatDate(app.end_date)}</span>
                    </div>
                    <div>
                      <span className="label">💰 Rate</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--color-primary-600)' }}>${app.hourly_rate}/hr</span>
                    </div>
                    <div>
                      <span className="label">📋 Job Status</span>
                      {getJobStatusBadge(app.job_status)}
                    </div>
                    <div>
                      <span className="label">📋 Application Status</span>
                      {getStatusBadge(app.status)}
                    </div>
                  </div>
                  {app.message && (
                    <div className="application-message">
                      <strong>Your Message:</strong>
                      <p>{app.message}</p>
                    </div>
                  )}
                </div>

                <div className="application-card-footer">
                  {app.status === 'pending' && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      ⏳ Waiting for parent's response...
                    </span>
                  )}
                  
                  {app.status === 'accepted' && app.job_status === 'in_progress' && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleJobStatus(app.job_post_id, 'completed')}
                        className="btn btn-sm btn-success"
                      >
                        ✅ Complete Job
                      </button>
                      <button
                        onClick={() => handleJobStatus(app.job_post_id, 'cancelled')}
                        className="btn btn-sm btn-danger"
                      >
                        ❌ Cancel Job
                      </button>
                    </div>
                  )}
                  
                  {app.status === 'accepted' && app.job_status === 'completed' && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.85rem', color: '#10b981' }}>
                        🎉 Job completed! Leave a review for the parent.
                      </span>
                      <Link to={`/jobs/${app.job_post_id}/review`} className="btn btn-sm btn-primary">
                        ⭐ Review Parent
                      </Link>
                    </div>
                  )}
                  
                  {app.status === 'accepted' && app.job_status === 'cancelled' && (
                    <span style={{ fontSize: '0.85rem', color: '#ef4444' }}>
                      ❌ This job was cancelled. It may be available again.
                    </span>
                  )}
                  
                  {app.status === 'rejected' && (
                    <span style={{ fontSize: '0.85rem', color: '#ef4444' }}>
                      ❌ Keep looking for more opportunities!
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default JobApplications;