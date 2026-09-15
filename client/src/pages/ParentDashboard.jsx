// client/src/pages/ParentDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import Rating from '../components/Rating';
import AIChatbot from '../components/AIChatbot';
import ReportModal from '../components/ReportModal';
import StatDetailModal from '../components/StatDetailModal';
import Avatar from '../components/Avatar';

function ParentDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [children, setChildren] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [receivedReviews, setReceivedReviews] = useState([]);
  const [activeTab, setActiveTab] = useState('bookings');
  const [showChildModal, setShowChildModal] = useState(false);
  const [newChild, setNewChild] = useState({ name: '', age: '', notes: '' });
  const [spending, setSpending] = useState({ total: 0, average: 0, monthly: [], recent: [] });
  const [showAIChat, setShowAIChat] = useState(false);
  const [reviewModal, setReviewModal] = useState({ open: false, booking: null });
  const [reviewData, setReviewData] = useState({ rating: 0, comment: '' });

  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedBookingForReport, setSelectedBookingForReport] = useState(null);

  const [detailModal, setDetailModal] = useState({ open: false, type: null });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const [bookingsRes, childrenRes, favoritesRes, reviewsRes] = await Promise.all([
        API.get('/bookings'),
        API.get('/parent/children'),
        API.get('/parent/favorites'),
        API.get('/reviews/received')
      ]);
      setBookings(bookingsRes.data);
      setChildren(childrenRes.data);
      setFavorites(favoritesRes.data);
      setReceivedReviews(reviewsRes.data);

      if (bookingsRes.data.length > 0) {
        calculateSpending(bookingsRes.data);
      }
    } catch (error) {
      console.error('Load data error:', error);
      addToast('Failed to load some data', 'error');
    }
  };

  const calculateSpending = (bookingsData) => {
    const completed = bookingsData.filter((b) => b.status === 'completed');
    const total = completed.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
    const average = completed.length > 0 ? total / completed.length : 0;
    const months = {};
    const recent = [...bookingsData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

    completed.forEach((b) => {
      const m = new Date(b.created_at).toLocaleString('default', { month: 'short', year: 'numeric' });
      months[m] = (months[m] || 0) + parseFloat(b.total_amount || 0);
    });

    setSpending({ total, average, monthly: Object.entries(months), recent });
  };

  const getDetailRows = (type) => {
    const completed = bookings.filter(b => b.status === 'completed');
    switch (type) {
      case 'totalSpent':
      case 'avgBooking':
      case 'completedBookings':
        return completed;
      case 'allBookings':
        return bookings;
      case 'recent':
        return spending.recent;
      default:
        return [];
    }
  };

  const getDetailTitle = (type) => {
    switch (type) {
      case 'totalSpent':        return '💵 Spending Detail (Completed Bookings)';
      case 'avgBooking':        return '📊 Average per Booking';
      case 'completedBookings': return '✅ Completed Bookings';
      case 'allBookings':       return '📅 All Bookings';
      case 'recent':            return '🕐 Recent Transactions';
      default:                  return 'Details';
    }
  };

  const getDetailSubtitle = (type) => {
    const rows = getDetailRows(type);
    const total = rows.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
    if (type === 'totalSpent' || type === 'avgBooking' || type === 'completedBookings') {
      return `Total: $${total.toFixed(2)}`;
    }
    return `${rows.length} booking${rows.length === 1 ? '' : 's'}`;
  };

  const detailColumns = [
    { key: 'id', label: 'ID', render: (b) => `#${b.id}` },
    {
      key: 'babysitter', label: 'Babysitter',
      render: (b) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar
            avatarUrl={b.babysitter_avatar_url}
            firstName={b.babysitter_first_name}
            lastName={b.babysitter_last_name}
            size={28}
          />
          <span>{`${b.babysitter_first_name || ''} ${b.babysitter_last_name || ''}`.trim() || '—'}</span>
        </div>
      ),
    },
    {
      key: 'date', label: 'Date',
      render: (b) => b.start_date
        ? `${new Date(b.start_date).toLocaleDateString()} → ${new Date(b.end_date).toLocaleDateString()}`
        : '—',
    },
    {
      key: 'hours', label: 'Hours',
      render: (b) => `${parseFloat(b.total_hours || 0).toFixed(1)}h`,
    },
    {
      key: 'amount', label: 'Amount',
      render: (b) => `$${parseFloat(b.total_amount || 0).toFixed(2)}`,
    },
    {
      key: 'status', label: 'Status',
      render: (b) => (
        <span style={{
          padding: '2px 10px', borderRadius: '10px',
          fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase',
          background: b.status === 'completed' ? '#D1FAE5' :
                      b.status === 'cancelled' ? '#FEE2E2' :
                      b.status === 'pending' ? '#FEF3C7' :
                      b.status === 'confirmed' ? '#DBEAFE' :
                      b.status === 'in_progress' ? '#EDE9FE' : '#F3F4F6',
          color: b.status === 'completed' ? '#065F46' :
                 b.status === 'cancelled' ? '#991B1B' :
                 b.status === 'pending' ? '#92400E' :
                 b.status === 'confirmed' ? '#1E40AF' :
                 b.status === 'in_progress' ? '#5B21B6' : '#374151',
        }}>
          {b.status}
        </span>
      ),
    },
  ];

  const deleteBooking = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this booking? This action cannot be undone.')) return;

    try {
      await API.delete(`/bookings/${id}`);
      setBookings(bookings.filter((b) => b.id !== id));
      addToast('Booking deleted successfully!', 'success');
    } catch (err) {
      console.error('Delete error:', err);
      addToast(err.response?.data?.error || 'Error deleting booking', 'error');
    }
  };

  const messageBabysitter = (babysitterId) => {
    navigate(`/messages/${babysitterId}`);
  };

  const bookAgain = (babysitterId) => {
    navigate(`/babysitters/${babysitterId}/book`);
  };

  const addChild = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/parent/children', newChild);
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
      await API.delete(`/parent/children/${id}`);
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
    const map = {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      in_progress: 'status-progress',
      completed: 'status-completed',
      cancelled: 'status-cancelled'
    };
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

      {showAIChat && (
        <div style={{ marginBottom: '24px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>🤖 AI Assistant</h3>
            <button onClick={() => setShowAIChat(false)} className="btn btn-sm btn-ghost" style={{ padding: '4px 8px' }}>✕ Close</button>
          </div>
          <AIChatbot isEmbedded={true} onClose={() => setShowAIChat(false)} />
        </div>
      )}

      <div className="dash-tabs">
        <button className={`dash-tab ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => setActiveTab('bookings')}>
          {String.fromCodePoint(128203)} {t('booking.myBookings')}
        </button>
        <button className={`dash-tab ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
          {String.fromCodePoint(11088)} Reviews
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

      {/* BOOKINGS TAB */}
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
              {bookings.map((b) => {
                const status = (b.status || '').toLowerCase();
                const isCompleted = status === 'completed';
                const isCancelled = status === 'cancelled' || status === 'canceled';
                const isPending = status === 'pending';

                return (
                  <div key={b.id} className="booking-item">
                    <div className="booking-main">
                      <div className="booking-person">
                        <Avatar
                          avatarUrl={b.babysitter_avatar_url}
                          firstName={b.babysitter_first_name}
                          lastName={b.babysitter_last_name}
                          size={38}
                        />
                        <div>
                          <strong>{b.babysitter_first_name || 'Unknown'} {b.babysitter_last_name || ''}</strong>
                          {b.child_name && <span className="booking-child">with {b.child_name}</span>}
                        </div>
                      </div>
                      <div className="booking-dates">
                        <span>{b.start_date ? new Date(b.start_date).toLocaleDateString() : 'N/A'} {b.start_time?.slice(0, 5) || ''}</span>
                        <span>&rarr;</span>
                        <span>{b.end_date ? new Date(b.end_date).toLocaleDateString() : 'N/A'} {b.end_time?.slice(0, 5) || ''}</span>
                      </div>
                      <div className="booking-amount">
                        ${b.total_amount ? parseFloat(b.total_amount).toFixed(2) : '0.00'}
                      </div>
                      <span className={`booking-status ${statusClass(b.status)}`}>
                        {t(`booking.${b.status}`) || b.status || 'Unknown'}
                      </span>
                    </div>

                    <div className="booking-actions" style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {isPending && (
                        <button onClick={() => cancelBooking(b.id)} className="btn btn-sm btn-outline-danger">
                          {t('booking.cancelled')}
                        </button>
                      )}

                      {isCompleted && (
                        <>
                          <button onClick={() => deleteBooking(b.id)} className="btn btn-sm btn-outline-danger" title="Permanently delete">
                            🗑️ Delete
                          </button>
                          <button onClick={() => messageBabysitter(b.babysitter_id)} className="btn btn-sm btn-outline" title="Message">
                            💬 Message
                          </button>
                          <button onClick={() => bookAgain(b.babysitter_id)} className="btn btn-sm btn-primary" title="Book Again">
                            📅 Book Again
                          </button>
                          <button onClick={() => { setReviewModal({ open: true, booking: b }); setReviewData({ rating: 0, comment: '' }); }} className="btn btn-sm btn-outline">
                            {String.fromCodePoint(11088)} {t('review.title')}
                          </button>
                          <button onClick={() => { setSelectedBookingForReport(b); setShowReportModal(true); }} className="btn btn-sm btn-outline-danger">
                            🚨 Report
                          </button>
                        </>
                      )}

                      {isCancelled && (
                        <>
                          <button onClick={() => deleteBooking(b.id)} className="btn btn-sm btn-outline-danger" title="Permanently delete">
                            🗑️ Delete
                          </button>
                          <button onClick={() => messageBabysitter(b.babysitter_id)} className="btn btn-sm btn-outline" title="Message">
                            💬 Message
                          </button>
                          <button onClick={() => bookAgain(b.babysitter_id)} className="btn btn-sm btn-primary" title="Book Again">
                            📅 Book Again
                          </button>
                          <button onClick={() => { setSelectedBookingForReport(b); setShowReportModal(true); }} className="btn btn-sm btn-outline-danger">
                            🚨 Report
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* REVIEWS TAB */}
      {activeTab === 'reviews' && (
        <div className="dash-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0 }}>⭐ Reviews I Received</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {receivedReviews.length} review{receivedReviews.length !== 1 ? 's' : ''}
            </span>
          </div>

          {receivedReviews.length === 0 ? (
            <div className="no-results">
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⭐</div>
              <p>No reviews yet.</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Complete bookings to receive reviews from babysitters.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {receivedReviews.map((review) => (
                <div key={review.id} style={{
                  padding: '18px 20px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Avatar
                        avatarUrl={review.avatar_url}
                        firstName={review.first_name}
                        lastName={review.last_name}
                        size={40}
                      />
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '0.92rem' }}>
                          {review.first_name || 'Anonymous'} {review.last_name || ''}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {new Date(review.created_at).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                    <Rating value={review.rating} />
                  </div>
                  {review.comment && (
                    <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                      "{review.comment}"
                    </p>
                  )}
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
            <div
              className="stat stat-primary"
              onClick={() => setDetailModal({ open: true, type: 'totalSpent' })}
              style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <span className="stat-number">{spending.total.toFixed(2)}</span>
              <span className="stat-label">{t('admin.totalRevenue')}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>Tap for details →</span>
            </div>
            <div
              className="stat"
              onClick={() => setDetailModal({ open: true, type: 'avgBooking' })}
              style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <span className="stat-number">{spending.average.toFixed(2)}</span>
              <span className="stat-label">{t('parent.avgBooking')}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>Tap for details →</span>
            </div>
            <div
              className="stat"
              onClick={() => setDetailModal({ open: true, type: 'completedBookings' })}
              style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <span className="stat-number">{bookings.filter(b => b.status === 'completed').length}</span>
              <span className="stat-label">{t('home.bookings')}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>Tap for details →</span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>{String.fromCodePoint(128339)} {t('parent.recentTransactions')}</h3>
                <button
                  onClick={() => setDetailModal({ open: true, type: 'recent' })}
                  className="btn btn-sm btn-outline"
                >
                  View all →
                </button>
              </div>
              <div className="booking-list">
                {spending.recent.map((b) => (
                  <div
                    key={b.id}
                    className="booking-item"
                    style={{ padding: '12px 16px', cursor: 'pointer' }}
                    onClick={() => setDetailModal({ open: true, type: 'recent' })}
                  >
                    <div className="booking-main">
                      <div className="booking-person">
                        <Avatar
                          avatarUrl={b.babysitter_avatar_url}
                          firstName={b.babysitter_first_name}
                          lastName={b.babysitter_last_name}
                          size={38}
                        />
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
                    <Avatar user={s} size={52} />
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
          onClose={() => { setShowReportModal(false); setSelectedBookingForReport(null); }}
          reportedUserId={selectedBookingForReport.babysitter_id}
          reportedName={`${selectedBookingForReport.babysitter_first_name || ''} ${selectedBookingForReport.babysitter_last_name || ''}`}
          reportedRole="babysitter"
          bookingId={selectedBookingForReport.id}
          reporterRole="parent"
          onSuccess={() => { addToast('Report submitted successfully!', 'success'); }}
        />
      )}

      <StatDetailModal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, type: null })}
        title={getDetailTitle(detailModal.type)}
        subtitle={getDetailSubtitle(detailModal.type)}
        columns={detailColumns}
        rows={getDetailRows(detailModal.type)}
        emptyText="No bookings in this category"
      />
    </div>
  );
}

export default ParentDashboard;