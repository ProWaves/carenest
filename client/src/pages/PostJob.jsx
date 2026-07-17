// client/src/pages/PostJob.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useToast } from '../components/Toast';
import BackButton from '../components/BackButton';

function PostJob() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    child_age: '',
    child_count: 1,
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    hourly_rate: '',
    location: '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await API.post('/jobs', form);
      addToast('Job posted successfully! 🎉', 'success');
      navigate('/dashboard?tab=jobs');
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to post job.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="dashboard">
      <BackButton label="← Back to Dashboard" fallback="/dashboard" />

      {/* Gradient Hero */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #6366F1)', borderRadius: 'var(--radius-lg)', padding: '28px 32px', marginBottom: '24px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800' }}>{String.fromCodePoint(128221)} Post a Job</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.9rem' }}>Find the perfect babysitter for your family</p>
        </div>
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)', padding: '28px 32px' }}>

        <form onSubmit={handleSubmit} className="post-job-form">
          <div className="form-group">
            <label>Job Title <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g., Need a babysitter for my 3-year-old"
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe your needs, expectations, and any special requirements..."
              rows={4}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Child's Age</label>
              <input
                type="text"
                name="child_age"
                value={form.child_age}
                onChange={handleChange}
                placeholder="e.g., 3 years, 6 months"
              />
            </div>
            <div className="form-group">
              <label>Number of Children</label>
              <input
                type="number"
                name="child_count"
                value={form.child_count}
                onChange={handleChange}
                min="1"
                max="10"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={handleChange}
                min={today}
                required
              />
            </div>
            <div className="form-group">
              <label>End Date <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="date"
                name="end_date"
                value={form.end_date}
                onChange={handleChange}
                min={form.start_date || today}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Time <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="time"
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>End Time <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="time"
                name="end_time"
                value={form.end_time}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Hourly Rate ($) <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="number"
                name="hourly_rate"
                value={form.hourly_rate}
                onChange={handleChange}
                placeholder="15"
                min="1"
                step="0.50"
                required
              />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="City or area"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Posting...
              </>
            ) : (
              '📢 Post Job'
            )}
          </button>
        </form>

        <div style={{ marginTop: '24px', padding: '20px 24px', background: 'rgba(79,70,229,0.04)', borderRadius: 'var(--radius)', border: '1px solid rgba(79,70,229,0.1)' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>{String.fromCodePoint(128161)} Tips for posting a great job:</h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--color-text-secondary)', fontSize: '0.88rem', lineHeight: 1.7 }}>
            <li>Be specific about your needs and expectations</li>
            <li>Include any special requirements (allergies, pets, etc.)</li>
            <li>Set a competitive hourly rate to attract quality candidates</li>
            <li>Provide clear dates and times</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default PostJob;