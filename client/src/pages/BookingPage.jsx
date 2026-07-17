// client/src/pages/BookingPage.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../components/Toast';
import AIChatbot from '../components/AIChatbot';
import ReportModal from '../components/ReportModal';

function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { addToast } = useToast();
  const [babysitter, setBabysitter] = useState(null);
  const [children, setChildren] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [form, setForm] = useState({
    child_id: '', 
    start_date: '', 
    end_date: '', 
    start_time: '', 
    end_time: '', 
    notes: '',
    slot_ids: []
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [useSelectedSlots, setUseSelectedSlots] = useState(false);

  // Get next 7 days for date calculation
  const getNextDateForDay = (dayOfWeek) => {
    const today = new Date();
    const currentDay = today.getDay();
    let daysToAdd = dayOfWeek - currentDay;
    if (daysToAdd < 0) daysToAdd += 7;
    if (daysToAdd === 0) daysToAdd = 7; // Always show next week's date, not today
    const date = new Date(today);
    date.setDate(date.getDate() + daysToAdd);
    return date;
  };

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bsRes, chRes, slotsRes] = await Promise.all([
          API.get(`/babysitters/${id}`),
          API.get('/parent/children'),
          API.get(`/babysitters/availability/available/${id}`)
        ]);
        setBabysitter(bsRes.data);
        setChildren(chRes.data);
        
        // Add dates to slots
        const slotsWithDates = slotsRes.data.map(slot => ({
          ...slot,
          date: getNextDateForDay(slot.day_of_week),
          dateString: formatDate(getNextDateForDay(slot.day_of_week))
        }));
        setAvailableSlots(slotsWithDates);
      } catch (err) {
        console.error('Fetch data error:', err);
        addToast('Failed to load booking data', 'error');
      }
    };
    fetchData();
  }, [id, addToast]);

  // Toggle slot selection
  const toggleSlotSelection = (slotId) => {
    setSelectedSlots(prev => {
      const newSelection = prev.includes(slotId)
        ? prev.filter(id => id !== slotId)
        : [...prev, slotId];
      
      // Update form with selected slot IDs
      setForm(prevForm => ({
        ...prevForm,
        slot_ids: newSelection
      }));
      
      // If slots are selected, auto-fill date/time from first selected slot
      if (newSelection.length > 0 && useSelectedSlots) {
        const selectedSlot = availableSlots.find(s => s.id === newSelection[0]);
        if (selectedSlot) {
          const date = selectedSlot.date;
          const dateStr = date.toISOString().split('T')[0];
          setForm(prevForm => ({
            ...prevForm,
            start_date: dateStr,
            end_date: dateStr,
            start_time: selectedSlot.start_time,
            end_time: selectedSlot.end_time
          }));
        }
      } else if (newSelection.length === 0) {
        // Clear dates if no slots selected
        setForm(prevForm => ({
          ...prevForm,
          start_date: '',
          end_date: '',
          start_time: '',
          end_time: ''
        }));
      }
      
      return newSelection;
    });
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const calculateTotal = () => {
    if (!form.start_date || !form.end_date || !form.start_time || !form.end_time || !babysitter) return null;
    const start = new Date(`${form.start_date}T${form.start_time}`);
    const end = new Date(`${form.end_date}T${form.end_time}`);
    const hours = Math.max(0, (end - start) / (1000 * 60 * 60));
    const amount = hours * parseFloat(babysitter.hourly_rate || 0);
    return { hours: hours.toFixed(1), amount: amount.toFixed(2) };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await API.post('/bookings', {
        babysitter_id: parseInt(id),
        child_id: form.child_id ? parseInt(form.child_id) : null,
        start_date: form.start_date,
        end_date: form.end_date,
        start_time: form.start_time,
        end_time: form.end_time,
        notes: form.notes,
        slot_ids: useSelectedSlots ? selectedSlots : []
      });
      addToast('Booking request sent! 🎉', 'success');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
      addToast(err.response?.data?.error || 'Booking failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAIRecommendation = (recommendation) => {
    if (recommendation.start_date) {
      setForm(prev => ({ ...prev, start_date: recommendation.start_date }));
    }
    if (recommendation.end_date) {
      setForm(prev => ({ ...prev, end_date: recommendation.end_date }));
    }
    if (recommendation.start_time) {
      setForm(prev => ({ ...prev, start_time: recommendation.start_time }));
    }
    if (recommendation.end_time) {
      setForm(prev => ({ ...prev, end_time: recommendation.end_time }));
    }
    if (recommendation.notes) {
      setForm(prev => ({ ...prev, notes: recommendation.notes }));
    }
    addToast('AI suggestions applied! ✨', 'success');
  };

  const total = calculateTotal();
  const today = new Date().toISOString().split('T')[0];

  const getAISuggestions = () => {
    if (!babysitter || !babysitter.availability || babysitter.availability.length === 0) {
      return null;
    }

    const todayDay = new Date().getDay();
    const availableDays = babysitter.availability.map(a => a.day_of_week);
    
    let nextDay = todayDay;
    let daysToAdd = 0;
    for (let i = 0; i < 7; i++) {
      const checkDay = (todayDay + i) % 7;
      if (availableDays.includes(checkDay)) {
        nextDay = checkDay;
        daysToAdd = i;
        break;
      }
    }

    if (daysToAdd === 0 && !availableDays.includes(todayDay)) {
      daysToAdd = 1;
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysToAdd);
    const dateStr = nextDate.toISOString().split('T')[0];

    const slot = babysitter.availability.find(a => a.day_of_week === nextDay);
    
    if (slot) {
      return {
        start_date: dateStr,
        end_date: dateStr,
        start_time: slot.start_time || '09:00',
        end_time: slot.end_time || '17:00',
        notes: `Booking suggested by AI based on ${babysitter.first_name}'s availability`
      };
    }
    return null;
  };

  const aiSuggestions = getAISuggestions();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

      {/* ── Main Card ── */}
      <div style={{
        width: '100%',
        maxWidth: '640px',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border-light)',
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden',
        animation: 'scaleIn 0.35s var(--ease)',
      }}>

        {/* ── Hero Header ── */}
        {babysitter && (
          <div style={{
            position: 'relative',
            padding: '28px 32px 24px',
            background: 'var(--gradient-primary)',
            color: 'white',
            overflow: 'hidden',
          }}>
            {/* decorative circles */}
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 140, height: 140, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
            }} />
            <div style={{
              position: 'absolute', bottom: -30, left: 60,
              width: 80, height: 80, borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
            }} />

            {/* top row: back + utility */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              position: 'relative',
            }}>
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
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setShowAIChat(!showAIChat)}
                  style={{
                    background: showAIChat ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: 'white',
                    padding: '7px 14px',
                    borderRadius: 'var(--radius)',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.28)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = showAIChat ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)'; }}
                >
                  🤖 AI Help
                </button>
                <button
                  onClick={() => setShowReportModal(true)}
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: 'rgba(255,255,255,0.85)',
                    padding: '7px 14px',
                    borderRadius: 'var(--radius)',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
                >
                  🚨 Report
                </button>
              </div>
            </div>

            {/* babysitter profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
              <div style={{
                width: '64px', height: '64px',
                borderRadius: '18px',
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(8px)',
                border: '2px solid rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: '22px',
                flexShrink: 0,
              }}>
                {babysitter.first_name?.[0]}{babysitter.last_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                  {babysitter.first_name} {babysitter.last_name}
                </div>
                <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span>${parseFloat(babysitter.hourly_rate || 0).toFixed(2)}/hr</span>
                  {babysitter.is_verified && (
                    <span style={{
                      fontSize: '11px', fontWeight: '600',
                      background: 'rgba(255,255,255,0.2)',
                      padding: '2px 10px',
                      borderRadius: '20px',
                    }}>
                      ✅ Verified
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Body ── */}
        <div style={{ padding: '28px 32px 32px' }}>

          {/* AI Chat Panel */}
          {showAIChat && (
            <div style={{
              marginBottom: '24px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-light)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 16px',
                background: 'var(--color-bg)',
                borderBottom: '1px solid var(--color-border-light)',
              }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text)' }}>🤖 AI Booking Assistant</span>
                <button
                  onClick={() => setShowAIChat(false)}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--color-text-muted)',
                    fontSize: '16px', cursor: 'pointer', padding: '2px 6px',
                  }}
                >✕</button>
              </div>
              <AIChatbot
                isEmbedded={true}
                onClose={() => setShowAIChat(false)}
                initialMessage={`I want to book ${babysitter?.first_name || 'this babysitter'} for a session. What are their available times?`}
              />
            </div>
          )}

          {/* AI Suggestion Banner */}
          {aiSuggestions && !showAIChat && (
            <div style={{
              marginBottom: '24px',
              padding: '14px 18px',
              borderRadius: 'var(--radius)',
              background: 'linear-gradient(135deg, var(--color-primary-50), #EEF2FF)',
              border: '1px solid var(--color-primary-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <strong style={{ color: 'var(--color-text)' }}>🤖 AI Suggestion:</strong>{' '}
                Book {babysitter?.first_name} on {new Date(aiSuggestions.start_date).toLocaleDateString()}{' '}
                from {aiSuggestions.start_time} to {aiSuggestions.end_time}
              </div>
              <button
                onClick={() => handleAIRecommendation(aiSuggestions)}
                style={{
                  background: 'var(--gradient-primary)',
                  color: 'white',
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: 'var(--radius)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.25)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                ✨ Apply
              </button>
            </div>
          )}

          {/* Section Title */}
          <h3 style={{
            fontSize: '0.8rem',
            fontWeight: '600',
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '12px',
          }}>
            Available Time Slots
          </h3>

          {/* Slot toggle */}
          {availableSlots.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '12px',
              }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none',
                  color: 'var(--color-text-secondary)',
                }}>
                  <div
                    onClick={() => {
                      const next = !useSelectedSlots;
                      setUseSelectedSlots(next);
                      if (!next) { setSelectedSlots([]); setForm(prev => ({ ...prev, slot_ids: [] })); }
                    }}
                    style={{
                      width: '38px', height: '22px', borderRadius: '11px',
                      background: useSelectedSlots ? 'var(--color-primary-500)' : 'var(--color-border)',
                      position: 'relative', cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%',
                      background: 'white',
                      position: 'absolute', top: '2px',
                      left: useSelectedSlots ? '18px' : '2px',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }} />
                  </div>
                  Use available slots
                </label>
              </div>

              {/* Slots Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '10px',
              }}>
                {availableSlots.map((slot) => {
                  const dayName = dayNames[slot.day_of_week] || slot.day_of_week;
                  const isSelected = selectedSlots.includes(slot.id);
                  const isBooked = slot.is_booked;
                  const dateStr = slot.dateString || formatDate(slot.date);
                  const clickable = useSelectedSlots && !isBooked;

                  return (
                    <div
                      key={slot.id}
                      onClick={() => clickable && toggleSlotSelection(slot.id)}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius)',
                        border: isBooked
                          ? '1px solid var(--color-border-light)'
                          : isSelected
                            ? '2px solid var(--color-primary-500)'
                            : '1px solid var(--color-border)',
                        background: isBooked
                          ? 'var(--color-bg)'
                          : isSelected
                            ? 'var(--color-primary-50)'
                            : 'var(--color-surface)',
                        cursor: clickable ? 'pointer' : 'default',
                        opacity: isBooked ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      onMouseEnter={e => { if (clickable && !isSelected) e.currentTarget.style.borderColor = 'var(--color-primary-300)'; }}
                      onMouseLeave={e => { if (clickable && !isSelected) e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                    >
                      {isSelected && (
                        <div style={{
                          position: 'absolute', top: 0, right: 0,
                          width: 0, height: 0,
                          borderLeft: '24px solid transparent',
                          borderTop: '24px solid var(--color-primary-500)',
                        }} />
                      )}
                      {isSelected && (
                        <span style={{
                          position: 'absolute', top: 2, right: 2,
                          fontSize: '8px', color: 'white', fontWeight: '700',
                        }}>✓</span>
                      )}
                      <div style={{ fontWeight: '700', fontSize: '0.88rem', color: isBooked ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
                        {dayName}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {dateStr}
                      </div>
                      <div style={{
                        marginTop: '8px',
                        fontSize: '0.82rem',
                        fontWeight: '600',
                        color: isBooked ? 'var(--color-text-muted)' : 'var(--color-primary-600)',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        {slot.start_time?.slice(0, 5)} — {slot.end_time?.slice(0, 5)}
                      </div>
                      {isBooked && (
                        <span style={{
                          marginTop: '6px', fontSize: '0.7rem',
                          color: 'var(--color-danger)', fontWeight: '600',
                        }}>🔒 Booked</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedSlots.length > 0 && (
                <div style={{
                  marginTop: '10px', padding: '10px 14px',
                  background: 'var(--color-primary-50)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.82rem', color: 'var(--color-primary-700)',
                  fontWeight: '500',
                }}>
                  {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''} selected — dates auto-filled below
                </div>
              )}
              {!useSelectedSlots && (
                <div style={{
                  marginTop: '10px', padding: '10px 14px',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.8rem', color: 'var(--color-text-muted)',
                  border: '1px dashed var(--color-border)',
                }}>
                  Toggle the switch above to pick slots, or fill in dates manually below.
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--color-border-light)', margin: '4px 0 24px' }} />

          {/* Form */}
          <form onSubmit={handleSubmit}>

            {children.length > 0 && (
              <div className="form-group">
                <label>👶 {t('booking.selectChild')}</label>
                <select name="child_id" value={form.child_id} onChange={handleChange}>
                  <option value="">— Select child —</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.age} yrs)</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" name="start_date" value={form.start_date} onChange={handleChange} required min={today} />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input type="date" name="end_date" value={form.end_date} onChange={handleChange} required min={form.start_date || today} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Start Time</label>
                <input type="time" name="start_time" value={form.start_time} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input type="time" name="end_time" value={form.end_time} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                name="notes" value={form.notes} onChange={handleChange}
                rows={3} placeholder="Any special instructions for the babysitter..."
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '12px 16px', borderRadius: 'var(--radius)',
                background: '#FEF2F2', border: '1px solid #FECACA',
                color: '#991B1B', fontSize: '0.85rem', marginBottom: '16px',
              }}>
                {error}
              </div>
            )}

            {/* Summary */}
            {total && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                padding: '20px 24px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--color-primary-50), #EEF2FF)',
                border: '1px solid var(--color-primary-100)',
                marginBottom: '20px',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: '800', color: '#0B1120' }}>{total.hours}h</span>
                  <span style={{ fontSize: '0.78rem', color: '#475569' }}>{t('booking.totalHours')}</span>
                </div>
                <div style={{ width: 1, background: 'var(--color-primary-200)' }} />
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '1.8rem', fontWeight: '800', color: '#4F46E5' }}>${total.amount}</span>
                  <span style={{ fontSize: '0.78rem', color: '#475569' }}>{t('booking.totalAmount')}</span>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px 24px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--gradient-primary)',
                color: 'white',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.65 : 1,
                boxShadow: loading ? 'none' : '0 4px 16px rgba(99,102,241,0.3)',
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.3)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Sending…
                </>
              ) : (
                <>Send Booking Request →</>
              )}
            </button>

          </form>

          {/* Tip */}
          <p style={{
            marginTop: '18px', fontSize: '0.78rem',
            color: 'var(--color-text-muted)',
            textAlign: 'center', lineHeight: '1.5',
          }}>
            Book at least 24 hours in advance for best availability.
          </p>
        </div>
      </div>

      {/* Report Modal */}
      {babysitter && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedUserId={parseInt(id)}
          reportedName={`${babysitter.first_name} ${babysitter.last_name}`}
          bookingId={null}
          onSuccess={() => {
            addToast('Report submitted! Admin will review it.', 'success');
          }}
        />
      )}
    </div>
  );
}

export default BookingPage;