// client/src/pages/ParentJobs.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useToast } from '../components/Toast';

function ParentJobs() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showApplicants, setShowApplicants] = useState(false);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const res = await API.get('/jobs/parent');
      setJobs(res.data);
    } catch (error) {
      addToast('Failed to load your jobs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadApplicants = async (jobId) => {
    setLoadingApplicants(true);
    setApplicants([]);
    try {
      const res = await API.get(`/jobs/parent/applicants/${jobId}`);
      
      console.log('Applicants API Response:', res.data);
      
      let applicantsData = [];
      let jobData = null;
      
      if (res.data) {
        if (Array.isArray(res.data)) {
          applicantsData = res.data;
        } else if (res.data.success && Array.isArray(res.data.applicants)) {
          applicantsData = res.data.applicants;
          jobData = res.data.job;
        } else if (res.data.applicants && Array.isArray(res.data.applicants)) {
          applicantsData = res.data.applicants;
          jobData = res.data.job;
        } else {
          applicantsData = [];
        }
      }
      
      setApplicants(applicantsData);
      if (jobData) {
        setSelectedJob(jobData);
      }
      setShowApplicants(true);
      
      if (applicantsData.length === 0) {
        addToast('No applicants found for this job', 'info');
      }
    } catch (error) {
      console.error('Error loading applicants:', error);
      addToast(error.response?.data?.error || 'Failed to load applicants', 'error');
      setApplicants([]);
    } finally {
      setLoadingApplicants(false);
    }
  };

  const handleSelectBabysitter = async (jobId, babysitterId) => {
    if (!window.confirm('Are you sure you want to select this babysitter? This will create a booking.')) return;
    try {
      const res = await API.put(`/jobs/${jobId}/select`, { babysitter_id: babysitterId });
      addToast('Babysitter selected and booking created! 🎉', 'success');
      setShowApplicants(false);
      loadJobs();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to select babysitter', 'error');
    }
  };

  const handleCancelSelection = async (jobId) => {
    if (!window.confirm('Are you sure you want to cancel this selection? The booking will be cancelled and slots freed.')) return;
    try {
      await API.put(`/jobs/${jobId}/cancel-selection`);
      addToast('Selection cancelled. Job is available again.', 'info');
      loadJobs();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to cancel selection', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    try {
      await API.delete(`/jobs/${id}`);
      addToast('Job deleted successfully', 'success');
      loadJobs();
    } catch (error) {
      addToast('Failed to delete job', 'error');
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
      active: <span className="badge badge-success">Active</span>,
      in_progress: <span className="badge badge-warning">In Progress</span>,
      completed: <span className="badge badge-primary">Completed</span>,
      cancelled: <span className="badge badge-danger">Cancelled</span>
    };
    return statusMap[status] || <span className="badge badge-secondary">{status}</span>;
  };

  // Get status color for applicant
  const getApplicantStatusColor = (status) => {
    switch(status) {
      case 'pending': return '#f59e0b';
      case 'accepted': return '#10b981';
      case 'rejected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        backgroundImage: 'var(--gradient-glow)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner"></div>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '12px' }}>Loading your jobs…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      backgroundImage: 'var(--gradient-glow)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '40px 20px 60px',
    }}>

      <div style={{
        width: '100%',
        maxWidth: '780px',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border-light)',
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden',
        animation: 'scaleIn 0.35s var(--ease)',
      }}>

        {/* ── Hero Header ── */}
        <div style={{
          position: 'relative',
          padding: '28px 32px',
          background: 'var(--gradient-primary)',
          color: 'white',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ position: 'absolute', bottom: -40, left: 40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                padding: '7px 14px',
                borderRadius: 'var(--radius)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            >
              ← Back
            </button>
            <Link
              to="/jobs/post"
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '8px 18px',
                borderRadius: 'var(--radius)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.32)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
            >
              + Post New Job
            </Link>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: '700' }}>📋 My Jobs</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: '4px' }}>
              Manage your job posts and applications
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '28px 32px 32px' }}>

          {jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📭</div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', marginBottom: '16px' }}>
                You haven't posted any jobs yet.
              </p>
              <Link
                to="/jobs/post"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 28px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'var(--gradient-primary)',
                  color: 'white',
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                  transition: 'all 0.25s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                📝 Post Your First Job
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {jobs.map((job) => {
                const statusColors = {
                  active: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#22C55E', label: '🟢 Active' },
                  in_progress: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#F59E0B', label: '🔄 In Progress' },
                  completed: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3B82F6', label: '✅ Completed' },
                  cancelled: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#EF4444', label: '❌ Cancelled' },
                };
                const sc = statusColors[job.status] || statusColors.active;

                return (
                  <div key={job.id} style={{
                    padding: '20px 24px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-light)',
                    background: 'var(--color-surface)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--color-primary-200)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--color-border-light)'; }}
                  >
                    {/* Top row: title + status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text)' }}>
                        {job.title}
                      </h3>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: sc.bg,
                        border: `1px solid ${sc.border}`,
                        color: sc.text,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        {sc.label}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px 16px',
                      fontSize: '0.82rem',
                      color: 'var(--color-text-muted)',
                      marginBottom: '12px',
                    }}>
                      <span>📅 {formatDate(job.start_date)} — {formatDate(job.end_date)}</span>
                      <span>⏰ {job.start_time?.slice(0, 5)} — {job.end_time?.slice(0, 5)}</span>
                      <span>💰 ${job.hourly_rate}/hr</span>
                      <span>📋 {job.application_count || 0} applicants</span>
                    </div>

                    {/* Description */}
                    {job.description && (
                      <p style={{ margin: '0 0 14px', fontSize: '0.88rem', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
                        {job.description.length > 150 ? job.description.substring(0, 150) + '…' : job.description}
                      </p>
                    )}

                    {/* In-Progress Babysitter Card */}
                    {job.status === 'in_progress' && job.selected_babysitter_details && (
                      <div style={{
                        padding: '14px 18px',
                        borderRadius: 'var(--radius)',
                        background: 'rgba(34,197,94,0.08)',
                        border: '1px solid rgba(34,197,94,0.25)',
                        marginBottom: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                      }}>
                        <div style={{
                          width: '42px', height: '42px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                          color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 'bold', fontSize: '16px', flexShrink: 0,
                        }}>
                          {job.selected_babysitter_details.first_name?.[0]}{job.selected_babysitter_details.last_name?.[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--color-text)' }}>
                            {job.selected_babysitter_details.first_name} {job.selected_babysitter_details.last_name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            ⭐ {parseFloat(job.selected_babysitter_details.avg_rating || 0).toFixed(1)} · 💰 ${parseFloat(job.selected_babysitter_details.hourly_rate || 0).toFixed(2)}/hr
                            {job.selected_babysitter_details.is_verified && ' · ✅ Verified'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {job.status === 'active' && (
                        <>
                          <button
                            onClick={() => { setSelectedJob(job); loadApplicants(job.id); }}
                            disabled={loadingApplicants}
                            style={{
                              padding: '9px 18px',
                              borderRadius: 'var(--radius)',
                              border: 'none',
                              background: 'var(--gradient-primary)',
                              color: 'white',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              cursor: loadingApplicants ? 'not-allowed' : 'pointer',
                              opacity: loadingApplicants ? 0.6 : 1,
                              boxShadow: '0 2px 8px rgba(99,102,241,0.2)',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={e => { if (!loadingApplicants) { e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}}
                            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                          >
                            👁️ View Applicants ({job.application_count || 0})
                          </button>
                          <button
                            onClick={() => handleDelete(job.id)}
                            style={{
                              padding: '9px 18px',
                              borderRadius: 'var(--radius)',
                              border: '1.5px solid var(--color-border)',
                              background: 'var(--color-surface)',
                              color: 'var(--color-text-secondary)',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; e.currentTarget.style.color = '#EF4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                          >
                            🗑️ Delete
                          </button>
                        </>
                      )}
                      {job.status === 'in_progress' && (
                        <>
                          <button
                            onClick={() => { setSelectedJob(job); loadApplicants(job.id); }}
                            disabled={loadingApplicants}
                            style={{
                              padding: '9px 18px',
                              borderRadius: 'var(--radius)',
                              border: '1.5px solid var(--color-border)',
                              background: 'var(--color-surface)',
                              color: 'var(--color-text)',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              cursor: loadingApplicants ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-400)'; e.currentTarget.style.color = 'var(--color-primary-600)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text)'; }}
                          >
                            👁️ View Applicants
                          </button>
                          <button
                            onClick={() => handleCancelSelection(job.id)}
                            style={{
                              padding: '9px 18px',
                              borderRadius: 'var(--radius)',
                              border: '1.5px solid rgba(239,68,68,0.3)',
                              background: 'rgba(239,68,68,0.08)',
                              color: '#EF4444',
                              fontSize: '0.82rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                          >
                            ❌ Cancel Selection
                          </button>
                        </>
                      )}
                      {job.status === 'completed' && (
                        <span style={{ fontSize: '0.85rem', color: '#10B981', fontWeight: '600' }}>
                          ✅ Job completed! Leave a review.
                        </span>
                      )}
                      {job.status === 'cancelled' && (
                        <span style={{ fontSize: '0.85rem', color: '#EF4444', fontWeight: '600' }}>
                          ❌ Job cancelled
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Applicants Modal ── */}
      {showApplicants && selectedJob && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s var(--ease)',
          }}
          onClick={() => setShowApplicants(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-light)',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Hero */}
            <div style={{
              padding: '24px 28px',
              background: 'var(--gradient-primary)',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>👥 Applicants</div>
                <div style={{ fontSize: '0.82rem', opacity: 0.85, marginTop: '2px' }}>for "{selectedJob.title}"</div>
              </div>
              <button
                onClick={() => setShowApplicants(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  width: '34px', height: '34px',
                  borderRadius: '10px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.28)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
              {loadingApplicants ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div className="spinner"></div>
                  <p style={{ color: 'var(--color-text-muted)', marginTop: '12px' }}>Loading applicants…</p>
                </div>
              ) : applicants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📭</div>
                  <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>No applicants yet. Check back later!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {applicants.map((app) => {
                    const appStatus = app.application_status || app.status || 'pending';
                    const babysitterId = app.babysitter_id || app.babysitterId;

                    const statusStyles = {
                      pending: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#F59E0B', label: 'Pending' },
                      accepted: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', text: '#22C55E', label: 'Accepted' },
                      rejected: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: '#EF4444', label: 'Rejected' },
                    };
                    const ss = statusStyles[appStatus] || statusStyles.pending;

                    return (
                      <div key={app.application_id || app.id} style={{
                        padding: '20px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${ss.border}`,
                        background: ss.bg,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                          {/* Left */}
                          <div style={{ flex: 1, minWidth: '220px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <div style={{
                                width: '52px', height: '52px',
                                borderRadius: '14px',
                                background: 'var(--gradient-primary)',
                                color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 'bold', fontSize: '18px', flexShrink: 0,
                              }}>
                                {app.first_name?.[0]}{app.last_name?.[0]}
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <strong style={{ fontSize: '1rem', color: 'var(--color-text)' }}>{app.first_name} {app.last_name}</strong>
                                  {app.is_verified && (
                                    <span style={{ fontSize: '0.68rem', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: '#22C55E', color: 'white' }}>
                                      ✓ Verified
                                    </span>
                                  )}
                                  <span style={{ fontSize: '0.68rem', fontWeight: '700', padding: '2px 10px', borderRadius: '20px', background: ss.text, color: 'white' }}>
                                    {ss.label}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '3px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                  <span>⭐ {parseFloat(app.avg_rating || 0).toFixed(1)} ({app.review_count || 0})</span>
                                  {app.city && <span>📍 {app.city}</span>}
                                  <span>💰 ${app.hourly_rate || 0}/hr</span>
                                  <span>📅 {app.experience_years || 0} yrs exp</span>
                                </div>
                              </div>
                            </div>

                            {/* Message */}
                            {app.message && (
                              <div style={{
                                marginTop: '12px',
                                padding: '12px 16px',
                                background: 'var(--color-bg)',
                                borderRadius: 'var(--radius)',
                                borderLeft: '3px solid var(--color-primary-400)',
                                fontSize: '0.88rem',
                                color: 'var(--color-text-secondary)',
                                lineHeight: '1.5',
                              }}>
                                💬 "{app.message}"
                              </div>
                            )}

                            <div style={{ marginTop: '10px' }}>
                              <Link to={`/babysitters/${babysitterId}`} style={{ fontSize: '0.82rem', color: 'var(--color-primary-600)', fontWeight: '600', textDecoration: 'none' }}>
                                View Full Profile →
                              </Link>
                            </div>
                          </div>

                          {/* Right — Action */}
                          <div style={{ flexShrink: 0 }}>
                            {appStatus === 'pending' && selectedJob.status === 'active' ? (
                              <button
                                onClick={() => handleSelectBabysitter(selectedJob.id, babysitterId)}
                                style={{
                                  padding: '10px 22px',
                                  borderRadius: 'var(--radius)',
                                  border: 'none',
                                  background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                                  color: 'white',
                                  fontSize: '0.88rem',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  boxShadow: '0 4px 12px rgba(34,197,94,0.3)',
                                  transition: 'all 0.2s ease',
                                  whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(34,197,94,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(34,197,94,0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                              >
                                ✅ Select
                              </button>
                            ) : appStatus === 'accepted' ? (
                              <div style={{ padding: '10px 20px', borderRadius: 'var(--radius)', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', textAlign: 'center', fontSize: '0.88rem', fontWeight: '700', color: '#22C55E' }}>
                                ✅ Selected
                              </div>
                            ) : appStatus === 'rejected' ? (
                              <div style={{ padding: '10px 20px', borderRadius: 'var(--radius)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', textAlign: 'center', fontSize: '0.88rem', fontWeight: '700', color: '#EF4444' }}>
                                ❌ Rejected
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* Reviews */}
                        {app.recent_reviews && app.recent_reviews.length > 0 && (
                          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${ss.border}` }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '6px' }}>⭐ Recent Reviews</div>
                            {app.recent_reviews.map((r, i) => (
                              <div key={i} style={{ fontSize: '0.8rem', padding: '4px 0', color: 'var(--color-text-secondary)', borderBottom: i < app.recent_reviews.length - 1 ? `1px solid ${ss.border}` : 'none' }}>
                                <span style={{ fontWeight: '600', color: '#F59E0B' }}>{r.rating}⭐</span> — {r.comment?.substring(0, 80)}…
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 28px',
              borderTop: '1px solid var(--color-border-light)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'var(--color-bg)',
            }}>
              <button
                onClick={() => setShowApplicants(false)}
                style={{
                  padding: '10px 28px',
                  borderRadius: 'var(--radius)',
                  border: '1.5px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-400)'; e.currentTarget.style.color = 'var(--color-primary-600)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ParentJobs;