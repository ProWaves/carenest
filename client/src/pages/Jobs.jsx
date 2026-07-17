// client/src/pages/Jobs.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import { useToast } from '../components/Toast';
import BackButton from '../components/BackButton';

function Jobs() {
  const { addToast } = useToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    loadJobs();
  }, [page, sort]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/jobs?page=${page}&limit=10&sort=${sort}`);
      setJobs(res.data.jobs);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      addToast('Failed to load jobs', 'error');
    } finally {
      setLoading(false);
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
    switch (status) {
      case 'active':
        return <span className="badge badge-success">Active</span>;
      case 'filled':
        return <span className="badge badge-warning">Filled</span>;
      case 'expired':
        return <span className="badge badge-danger">Expired</span>;
      default:
        return <span className="badge badge-secondary">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading jobs...</p>
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
        <div style={{ position: 'absolute', bottom: -40, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800' }}>{String.fromCodePoint(128269)} Find Jobs</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.9rem' }}>Browse available babysitting jobs near you</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.88rem', fontWeight: '500', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
              <option value="newest" style={{ color: '#333' }}>Newest First</option>
              <option value="rate_high" style={{ color: '#333' }}>Highest Rate</option>
              <option value="rate_low" style={{ color: '#333' }}>Lowest Rate</option>
            </select>
            <button onClick={loadJobs} style={{ padding: '10px 16px', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>{String.fromCodePoint(128260)} Refresh</button>
          </div>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="no-results">
          <p>No jobs available right now.</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Check back later for new opportunities.</p>
        </div>
      ) : (
        <div className="jobs-grid">
          {jobs.map((job) => (
            <div key={job.id} className="job-card">
              <div className="job-card-header">
                <div>
                  <h3>{job.title}</h3>
                  <div className="job-parent">
                    👤 {job.first_name} {job.last_name}
                    {job.city && <span style={{ marginLeft: '8px' }}>📍 {job.city}</span>}
                  </div>
                </div>
                {getStatusBadge(job.status)}
              </div>

              <div className="job-card-body">
                {job.description && (
                  <p className="job-description">{job.description.substring(0, 120)}...</p>
                )}
                <div className="job-details-grid">
                  <div className="job-detail">
                    <span className="label">📅 Dates</span>
                    <span>{formatDate(job.start_date)} - {formatDate(job.end_date)}</span>
                  </div>
                  <div className="job-detail">
                    <span className="label">⏰ Time</span>
                    <span>{job.start_time.slice(0, 5)} - {job.end_time.slice(0, 5)}</span>
                  </div>
                  <div className="job-detail">
                    <span className="label">💰 Rate</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-primary-600)' }}>${job.hourly_rate}/hr</span>
                  </div>
                  <div className="job-detail">
                    <span className="label">👶 Children</span>
                    <span>{job.child_count || 1} {job.child_age ? `(${job.child_age})` : ''}</span>
                  </div>
                </div>
                <div className="job-application-info">
                  <span>📋 {job.application_count || 0} applications</span>
                  {job.my_application_status === 'pending' && (
                    <span className="badge badge-warning">Pending Review</span>
                  )}
                  {job.my_application_status === 'accepted' && (
                    <span className="badge badge-success">✅ Accepted</span>
                  )}
                  {job.my_application_status === 'rejected' && (
                    <span className="badge badge-danger">Rejected</span>
                  )}
                </div>
              </div>

              <div className="job-card-footer">
                <Link to={`/jobs/${job.id}`} className="btn btn-primary">
                  {job.my_application_status ? 'View Application' : 'Apply Now'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>
              {p}
            </button>
          ))}
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>→</button>
        </div>
      )}
    </div>
  );
}

export default Jobs;