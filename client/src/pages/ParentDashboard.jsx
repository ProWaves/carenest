// client/src/pages/ParentDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import Rating from '../components/Rating';
import AIChatbot from '../components/AIChatbot';
import ReportModal from '../components/ReportModal';

function ParentDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { addToast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [children, setChildren] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [activeTab, setActiveTab] = useState('bookings');
  const [showChildModal, setShowChildModal] = useState(false);
  const [newChild, setNewChild] = useState({ name: '', age: '', notes: '' });
  const [spending, setSpending] = useState({ total: 0, average: 0, monthly: [], recent: [] });
  const [showAIChat, setShowAIChat] = useState(false);
  const [reviewModal, setReviewModal] = useState({ open: false, booking: null });
  const [reviewData, setReviewData] = useState({ rating: 0, comment: '' });
  
  // Report state
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedBookingForReport, setSelectedBookingForReport] = useState(null);

  useEffect(() => {
    API.get('/bookings').then((r) => setBookings(r.data)).catch(console.error);
    API.get('/admin/children').then((r) => setChildren(r.data)).catch(console.error);
    API.get('/parent/favorites').then((r) => setFavorites(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (bookings.length > 0) {
      const completed = bookings.filter((b) => b.status === 'completed');
      const total = completed.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
      const average = completed.length > 0 ? total / completed.length : 0;
      const months = {};
      const recent = [...bookings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
      completed.forEach((b) => {
        const m = new Date(b.created_at).toLocaleString('default', { month: 'short', year: 'numeric' });
        months[m] = (months[m] || 0) + parseFloat(b.total_amount || 0);
      });
      setSpending({ total, average, monthly: Object.entries(months), recent });
    }
  }, [bookings]);

  const addChild = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/admin/children', newChild);
      setChildren([res.data, ...children]);
      setNewChild({ name: '', age: '', notes: '' });
      setShowChildModal(false);
      addToast('Child added!', 'success');
    } catch (err) {
      addToast('Error adding child', 'error');
    }
  };

  const deleteChild = async (id) => {
    try {
      await API.delete(`/admin/children/${id}`);
      setChildren(children.filter((c) => c.id !== id));
      addToast('Child removed', 'info');
    } catch (err) {
      addToast('Error removing child', 'error');
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    const b = reviewModal.booking;
    if (!reviewData.rating) {
      addToast('Please select a rating', 'error');
      return;
    }
    try {
      await API.post('/reviews', {
        booking_id: b.id,
        babysitter_id: b.babysitter_id,
        rating: reviewData.rating,
        comment: reviewData.comment,
      });
      addToast('Review submitted!', 'success');
      setReviewModal({ open: false, booking: null });
      setReviewData({ rating: 0, comment: '' });
    } catch (err) {
      addToast(err.response?.data?.error || 'Error submitting review', 'error');
    }
  };

  const cancelBooking = async (id) => {
    const reason = window.prompt('Please provide a reason for cancelling this booking (optional):') || 'Cancelled by parent';
    try {
      await API.put(`/bookings/${id}/cancel`, { reason });
      setBookings(bookings.map((b) => b.id === id ? { ...b, status: 'cancelled' } : b));
      addToast('Booking cancelled and slots freed', 'info');
    } catch (err) {
      addToast(err.response?.data?.error || 'Error cancelling booking', 'error');
    }
  };

  const statusClass = (s) => {
    const map = { pending: 'status-pending', confirmed: 'status-confirmed', in_progress: 'status-progress', completed: 'status-completed', cancelled: 'status-cancelled' };
    return map[s] || '';
  };

  return (
    <div className="dashboard">
      {/* Gradient Hero */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #6366F1)', borderRadius: 'var(--radius-lg)', padding: '28px 32px', marginBottom: '24px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -40, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800' }}>{t('nav.dashboard')}</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.9rem' }}>Welcome, {user?.first_name}! {String.fromCodePoint(128075)}</p>
          </div>
          <button onClick={() => setShowAIChat(!showAIChat)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: 'var(--radius)', border: 'none', background: '#fff', color: '#4F46E5', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
            {String.fromCodePoint(129302)} AI Assistant
          </button>
        </div>
      </div>

      {/* AI Chatbot Panel */}
      {showAIChat && (
        <div style={{
          marginBottom: '24px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
          }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🤖 AI Assistant
            </h3>
            <button
              onClick={() => setShowAIChat(false)}
              className="btn btn-sm btn-ghost"
              style={{ padding: '4px 8px' }}
            >
              ✕ Close
            </button>
          </div>
          <AIChatbot isEmbedded={true} onClose={() => setShowAIChat(false)} />
        </div>
      )}

      <div className="dash-tabs">
        <button className={`dash-tab ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => setActiveTab('bookings')}>
          {String.fromCodePoint(128203)} {t('booking.myBookings')}
        </button>
        <button className={`dash-tab ${activeTab === 'spending' ? 'active' : ''}`} onClick={() => setActiveTab('spending')}>
          {String.fromCodePoint(128176)} {t('parent.spending')}
        </button>
        <button className={`dash-tab ${activeTab === 'children' ? 'active' : ''}`} onClick={() => setActiveTab('children')}>
          {String.fromCodePoint(128118)} {t('booking.addChild')}
        </button>
        <button className={`dash-tab ${activeTab === 'favorites' ? 'active' : ''}`} onClick={() => setActiveTab('favorites')}>
          {String.fromCodePoint(10084)} {t('babysitter.addFavorite')}
        </button>
      </div>

      {/* Bookings Tab with Report Button */}
      {activeTab === 'bookings' && (
        <div className="dash-content">
          {bookings.length === 0 ? (
            <div className="no-results">
              <p>{t('booking.noBookings')}</p>
              <Link to="/babysitters" className="btn btn-primary" style={{ marginTop: 16 }}>
                {String.fromCodePoint(128269)} {t('nav.find')}
              </Link>
            </div>
          ) : (
            <div className="booking-list">
              {bookings.map((b) => (
                <div key={b.id} className="booking-item">
                  <div className="booking-main">
                    <div className="booking-person">
                      <div className="avatar-sm">{b.babysitter_first_name?.[0]}</div>
                      <div>
                        <strong>{b.babysitter_first_name} {b.babysitter_last_name}</strong>
                        {b.child_name && <span className="booking-child">with {b.child_name}</span>}
                      </div>
                    </div>
                    <div className="booking-dates">
                      <span>{new Date(b.start_date).toLocaleDateString()} {b.start_time?.slice(0, 5)}</span>
                      <span>&rarr;</span>
                      <span>{new Date(b.end_date).toLocaleDateString()} {b.end_time?.slice(0, 5)}</span>
                    </div>
                    <div className="booking-amount">{parseFloat(b.total_amount || 0).toFixed(2)} {t('common.currency')}</div>
                    <span className={`booking-status ${statusClass(b.status)}`}>{t(`booking.${b.status}`)}</span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="booking-actions" style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {b.status === 'pending' && (
                      <button onClick={() => cancelBooking(b.id)} className="btn btn-sm btn-outline-danger">
                        {t('booking.cancelled')}
                      </button>
                    )}
                    
                    {b.status === 'completed' && (
                      <>
                        <button
                          onClick={() => {
                            setReviewModal({ open: true, booking: b });
                            setReviewData({ rating: 0, comment: '' });
                          }}
                          className="btn btn-sm btn-outline"
                        >
                          {String.fromCodePoint(11088)} {t('review.title')}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBookingForReport(b);
                            setShowReportModal(true);
                          }}
                          className="btn btn-sm btn-outline-danger"
                        >
                          🚨 Report
                        </button>
                      </>
                    )}
                    
                    {b.status === 'cancelled' && (
                      <button
                        onClick={() => {
                          setSelectedBookingForReport(b);
                          setShowReportModal(true);
                        }}
                        className="btn btn-sm btn-outline-danger"
                      >
                        🚨 Report
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Spending Tab */}
      {activeTab === 'spending' && (
        <div className="dash-content">
          <div className="stats-grid admin-stats" style={{ marginBottom: 20 }}>
            <div className="stat stat-primary">
              <span className="stat-number">{spending.total.toFixed(2)}</span>
              <span className="stat-label">{t('admin.totalRevenue')}</span>
            </div>
            <div className="stat">
              <span className="stat-number">{spending.average.toFixed(2)}</span>
              <span className="stat-label">{t('parent.avgBooking')}</span>
            </div>
            <div className="stat">
              <span className="stat-number">{bookings.filter(b => b.status === 'completed').length}</span>
              <span className="stat-label">{t('home.bookings')}</span>
            </div>
          </div>
          {spending.monthly.length > 0 && (
            <div className="detail-card" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 16 }}>{String.fromCodePoint(128202)} {t('parent.monthlySpending')}</h3>
              <div className="bar-chart">
                {spending.monthly.map(([month, amount]) => {
                  const max = Math.max(...spending.monthly.map(([, a]) => a));
                  return (
                    <div key={month} className="bar-item">
                      <div className="bar-fill bar-fill-green" style={{ height: `${Math.max(8, (amount / max) * 120)}px` }} />
                      <span className="bar-value">{amount.toFixed(0)}</span>
                      <span className="bar-label">{month.split(' ')[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {spending.recent.length > 0 && (
            <div className="detail-card">
              <h3 style={{ marginBottom: 16 }}>{String.fromCodePoint(128339)} {t('parent.recentTransactions')}</h3>
              <div className="booking-list">
                {spending.recent.map((b) => (
                  <div key={b.id} className="booking-item" style={{ padding: '12px 16px' }}>
                    <div className="booking-main">
                      <div className="booking-person">
                        <div className="avatar-sm">{b.babysitter_first_name?.[0]}</div>
                        <div>
                          <strong>{b.babysitter_first_name} {b.babysitter_last_name}</strong>
                          <span className="booking-child">{new Date(b.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="booking-amount">{parseFloat(b.total_amount || 0).toFixed(2)} {t('common.currency')}</div>
                      <span className={`booking-status ${statusClass(b.status)}`}>{t(`booking.${b.status}`)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Children Tab */}
      {activeTab === 'children' && (
        <div className="dash-content">
          <button className="btn btn-primary" onClick={() => setShowChildModal(true)} style={{ marginBottom: 20 }}>
            + {t('booking.addChild')}
          </button>

          <Modal isOpen={showChildModal} onClose={() => setShowChildModal(false)} title={t('booking.addChild')}>
            <form onSubmit={addChild}>
              <div className="form-group">
                <label>{t('booking.childName')}</label>
                <input type="text" value={newChild.name} onChange={(e) => setNewChild({ ...newChild, name: e.target.value })} required placeholder="Child's full name" />
              </div>
              <div className="form-group">
                <label>{t('booking.childAge')}</label>
                <input type="number" value={newChild.age} onChange={(e) => setNewChild({ ...newChild, age: e.target.value })} required min={0} placeholder="Age in years" />
              </div>
              <div className="form-group">
                <label>{t('booking.notes')}</label>
                <textarea value={newChild.notes} onChange={(e) => setNewChild({ ...newChild, notes: e.target.value })} rows={2} placeholder="Allergies, preferences..." />
              </div>
              <button type="submit" className="btn btn-primary btn-block">{t('booking.addChild')}</button>
            </form>
          </Modal>

          {children.length === 0 ? (
            <p className="no-results">{t('common.noResults')}</p>
          ) : (
            <div className="children-list">
              {children.map((c) => (
                <div key={c.id} className="child-card">
                  <div className="child-avatar">{c.name[0]}</div>
                  <div className="child-info">
                    <strong>{c.name}</strong>
                    <span>{c.age} years old</span>
                    {c.notes && <p className="child-notes">{c.notes}</p>}
                  </div>
                  <button onClick={() => deleteChild(c.id)} className="btn btn-sm btn-outline-danger">{t('common.delete')}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Favorites Tab */}
      {activeTab === 'favorites' && (
        <div className="dash-content">
          {favorites.length === 0 ? (
            <div className="no-results">
              <p>{t('common.noResults')}</p>
              <Link to="/babysitters" className="btn btn-primary" style={{ marginTop: 16 }}>
                {String.fromCodePoint(128269)} {t('nav.find')}
              </Link>
            </div>
          ) : (
            <div className="babysitter-grid min-grid">
              {favorites.map((s) => (
                <Link to={`/babysitters/${s.id}`} key={s.id} className="babysitter-card">
                  <div className="babysitter-card-header">
                    <div className="avatar">{s.first_name[0]}{s.last_name[0]}</div>
                    {s.is_verified && <span className="badge badge-success">{String.fromCodePoint(10003)}</span>}
                  </div>
                  <h3>{s.first_name} {s.last_name}</h3>
                  <p className="city">{String.fromCodePoint(128205)} {s.city}</p>
                  <div className="card-details">
                    <span>{s.experience_years} {t('babysitter.experience')}</span>
                    <span className="rate">{parseFloat(s.hourly_rate || 0).toFixed(2)} <small>{t('common.dt')}</small></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={reviewModal.open}
        onClose={() => setReviewModal({ open: false, booking: null })}
        title={t('review.title')}
      >
        <form onSubmit={submitReview} style={{ padding: '20px' }}>
          {reviewModal.booking && (
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
              {t('review.from')} <strong>{reviewModal.booking.babysitter_first_name} {reviewModal.booking.babysitter_last_name}</strong>
            </p>
          )}
          <div className="form-group">
            <label>{t('review.rating')}</label>
            <div style={{ fontSize: '1.8rem', marginTop: 4 }}>
              <Rating value={reviewData.rating} onChange={(v) => setReviewData({ ...reviewData, rating: v })} />
            </div>
          </div>
          <div className="form-group">
            <label>{t('review.comment')}</label>
            <textarea
              value={reviewData.comment}
              onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
              rows={4}
              placeholder={t('review.writeReview')}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            {String.fromCodePoint(11088)} {t('review.submit')}
          </button>
        </form>
      </Modal>

      {/* Report Modal */}
      {selectedBookingForReport && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setSelectedBookingForReport(null);
          }}
          reportedUserId={selectedBookingForReport.babysitter_id}
          reportedName={`${selectedBookingForReport.babysitter_first_name || ''} ${selectedBookingForReport.babysitter_last_name || ''}`}
          reportedRole="babysitter"
          bookingId={selectedBookingForReport.id}
          reporterRole="parent"
          onSuccess={() => {
            // Optional: refresh data or show additional message
          }}
        />
      )}
    </div>
  );
}

export default ParentDashboard;