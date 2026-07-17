// client/src/pages/JobDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useToast } from '../components/Toast';
import BackButton from '../components/BackButton';

function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [showApplyForm, setShowApplyForm] = useState(false);

  useEffect(() => {
    loadJob();
  }, [id]);

  const loadJob = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/jobs/${id}`);
      setJob(res.data);
    } catch (error) {
      addToast('Failed to load job details', 'error');
      navigate('/jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!applicationMessage.trim()) {
      addToast('Please include a message to the parent', 'error');
      return;
    }

    setApplying(true);
    try {
      await API.post(`/jobs/${id}/apply`, { message: applicationMessage });
      addToast('Application submitted successfully! 🎉', 'success');
      loadJob();
      setShowApplyForm(false);
      setApplicationMessage('');
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to apply', 'error');
    } finally {
      setApplying(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="dashboard">
        <div className="no-results">
          <p>Job not found.</p>
          <Link to="/jobs" className="btn btn-primary">Back to Jobs</Link>
        </div>
      </div>
    );
  }

  const canApply = job.status === 'active' && !job.my_application_status;

  return (
    <div className="dashboard">
      <BackButton label="← Back to Jobs" fallback="/jobs" />

      {/* Gradient Hero */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #6366F1)', borderRadius: 'var(--radius-lg)', padding: '28px 32px', marginBottom: '24px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>{job.title}</h1>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px', opacity: 0.85, fontSize: '0.88rem' }}>
              <span>{String.fromCodePoint(128100)} {job.first_name} {job.last_name}</span>
              {job.city && <span>{String.fromCodePoint(128205)} {job.city}</span>}
              <span>{String.fromCodePoint(128197)} Posted {formatDate(job.created_at)}</span>
            </div>
          </div>
          <div>
            {job.status === 'active' ? (
              <span style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', background: 'rgba(16,185,129,0.2)', color: '#fff', fontWeight: '600', fontSize: '0.78rem' }}>Active</span>
            ) : job.status === 'filled' ? (
              <span style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', background: 'rgba(245,158,11,0.2)', color: '#fff', fontWeight: '600', fontSize: '0.78rem' }}>Filled</span>
            ) : (
              <span style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', background: 'rgba(239,68,68,0.2)', color: '#fff', fontWeight: '600', fontSize: '0.78rem' }}>Expired</span>
            )}
          </div>
        </div>
      </div>

        <div className="job-detail-body">
          <div className="job-detail-section">
            <h3>📝 Description</h3>
            <p>{job.description || 'No description provided.'}</p>
          </div>

          <div className="job-detail-section">
            <h3>📋 Job Details</h3>
            <div className="job-detail-grid">
              <div>
                <span className="label">Start Date</span>
                <span>{formatDate(job.start_date)}</span>
              </div>
              <div>
                <span className="label">End Date</span>
                <span>{formatDate(job.end_date)}</span>
              </div>
              <div>
                <span className="label">Start Time</span>
                <span>{job.start_time.slice(0, 5)}</span>
              </div>
              <div>
                <span className="label">End Time</span>
                <span>{job.end_time.slice(0, 5)}</span>
              </div>
              <div>
                <span className="label">Hourly Rate</span>
                <span style={{ fontWeight: 'bold', color: 'var(--color-primary-600)', fontSize: '1.2rem' }}>
                  ${job.hourly_rate}/hr
                </span>
              </div>
              <div>
                <span className="label">Children</span>
                <span>{job.child_count || 1} {job.child_age ? `(${job.child_age})` : ''}</span>
              </div>
            </div>
          </div>

          <div className="job-detail-section">
            <h3>📊 Applications</h3>
            <p>{job.application_count || 0} babysitter{job.application_count !== 1 ? 's' : ''} have applied</p>
            {job.my_application_status && (
              <div style={{ marginTop: '8px' }}>
                <span className="badge badge-info">Your status: {job.my_application_status}</span>
              </div>
            )}
          </div>

          {canApply && (
            <div className="job-detail-section">
              <h3>📝 Apply for this Job</h3>
              {!showApplyForm ? (
                <button onClick={() => setShowApplyForm(true)} className="btn btn-primary">
                  Apply Now
                </button>
              ) : (
                <div className="apply-form">
                  <div className="form-group">
                    <label>Message to Parent</label>
                    <textarea
                      value={applicationMessage}
                      onChange={(e) => setApplicationMessage(e.target.value)}
                      placeholder="Introduce yourself and explain why you're a good fit..."
                      rows={4}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleApply} className="btn btn-primary" disabled={applying}>
                      {applying ? 'Submitting...' : 'Submit Application'}
                    </button>
                    <button onClick={() => setShowApplyForm(false)} className="btn btn-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {job.my_application_status === 'pending' && (
            <div className="alert alert-info">
              ⏳ Your application is pending review by the parent.
            </div>
          )}

          {job.my_application_status === 'accepted' && (
            <div className="alert alert-success">
              🎉 Congratulations! Your application has been accepted!
            </div>
          )}

          {job.my_application_status === 'rejected' && (
            <div className="alert alert-error">
              ❌ Your application was rejected. Keep looking for other opportunities!
            </div>
          )}
        </div>
    </div>
  );
}

export default JobDetail;