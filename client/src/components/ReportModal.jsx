// client/src/components/ReportModal.jsx
import React, { useState } from 'react';
import API from '../api/axios';
import { useToast } from './Toast';

// Parent reporting babysitter
const PARENT_REPORT_CATEGORIES = [
  { value: 'unprofessional_behavior', label: 'Unprofessional Behavior', icon: '👎' },
  { value: 'no_show', label: 'Did Not Show Up', icon: '🚫' },
  { value: 'late_arrival', label: 'Arrived Late', icon: '⏰' },
  { value: 'cancellation_without_notice', label: 'Cancelled Without Notice', icon: '❌' },
  { value: 'inappropriate_conduct', label: 'Inappropriate Conduct', icon: '🚨' },
  { value: 'safety_concern', label: 'Safety Concern', icon: '🛡️' },
  { value: 'harassment', label: 'Harassment', icon: '😤' },
  { value: 'dispute', label: 'Payment Dispute', icon: '💳' },
  { value: 'other', label: 'Other Issue', icon: '📝' },
];

// Babysitter reporting parent
const BABYSITTER_REPORT_CATEGORIES = [
  { value: 'no_show', label: 'Did Not Show Up', icon: '🚫' },
  { value: 'last_minute_cancellation', label: 'Last Minute Cancellation', icon: '❌' },
  { value: 'disrespectful', label: 'Disrespectful Behavior', icon: '😤' },
  { value: 'payment_issue', label: 'Payment Issue / Non-Payment', icon: '💰' },
  { value: 'harassment', label: 'Harassment', icon: '😤' },
  { value: 'safety_concern', label: 'Safety Concern', icon: '🛡️' },
  { value: 'unreasonable_demands', label: 'Unreasonable Demands', icon: '📋' },
  { value: 'other', label: 'Other Issue', icon: '📝' },
];

function ReportModal({ 
  isOpen, 
  onClose, 
  reportedUserId, 
  reportedName, 
  reportedRole,
  bookingId,
  reporterRole, // 'parent' or 'babysitter'
  onSuccess 
}) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const categories = reporterRole === 'babysitter' 
    ? BABYSITTER_REPORT_CATEGORIES 
    : PARENT_REPORT_CATEGORIES;

  const [form, setForm] = useState({
    category: '',
    reason: '',
    description: '',
    refund_requested: false,
    refund_amount: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.reason) {
      addToast('Please select a category and provide a reason.', 'error');
      return;
    }

    setLoading(true);
    try {
      await API.post('/reports', {
        reported_user_id: reportedUserId,
        booking_id: bookingId || null,
        category: form.category,
        reason: form.reason,
        description: form.description || null,
        refund_requested: form.refund_requested,
        refund_amount: form.refund_requested ? parseFloat(form.refund_amount) : null,
      });
      
      addToast('Report submitted successfully! Admin will review it within 24 hours.', 'success');
      onSuccess?.();
      onClose();
      setForm({ category: '', reason: '', description: '', refund_requested: false, refund_amount: '' });
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to submit report.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="report-modal-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="report-modal-header">
          <div className="report-modal-title">
            <span className="report-modal-icon">🚨</span>
            <h3>Report {reportedName || 'User'}</h3>
          </div>
          <button className="report-modal-close" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="report-modal-body">
          {bookingId && (
            <div className="report-booking-info">
              <span>📅</span>
              <span>Reporting from Booking #{bookingId}</span>
            </div>
          )}

          <div className="report-field">
            <label className="report-label">
              Category <span className="report-required">*</span>
            </label>
            <select
              className="report-select"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              required
            >
              <option value="">Select a category...</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="report-field">
            <label className="report-label">
              Reason <span className="report-required">*</span>
            </label>
            <input
              type="text"
              className="report-input"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Brief summary of the issue"
              required
            />
          </div>

          <div className="report-field">
            <label className="report-label">Description</label>
            <textarea
              className="report-textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Provide more details about what happened..."
              rows={4}
            />
          </div>

          {reporterRole === 'parent' && (
            <div className="report-refund-section">
              <label className="report-checkbox-label">
                <input
                  type="checkbox"
                  className="report-checkbox"
                  checked={form.refund_requested}
                  onChange={(e) => setForm({ ...form, refund_requested: e.target.checked })}
                />
                <span>Request Refund</span>
              </label>
              {form.refund_requested && (
                <div className="report-refund-amount">
                  <span className="report-currency">$</span>
                  <input
                    type="number"
                    className="report-input report-amount-input"
                    value={form.refund_amount}
                    onChange={(e) => setForm({ ...form, refund_amount: e.target.value })}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required={form.refund_requested}
                  />
                </div>
              )}
            </div>
          )}

          <div className="report-notice">
            <p>
              💡 Your report will be reviewed by our admin team within 24 hours.
              False reports may result in account suspension.
            </p>
          </div>

          {/* Footer */}
          <div className="report-modal-footer">
            <button type="button" className="report-btn report-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="report-btn report-btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="report-spinner"></span>
                  Submitting...
                </>
              ) : (
                'Submit Report'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportModal;