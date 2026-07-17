// client/src/pages/BabysitterDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../components/Toast';
import PhoneInput from '../components/PhoneInput';
import BackButton from '../components/BackButton';
import ReportModal from '../components/ReportModal';
import BabysitterLocation from '../components/BabysitterLocation';

function BabysitterDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { addToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState('bookings');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Profile Form State
  const [editForm, setEditForm] = useState({ 
    bio: '', 
    experience_years: '', 
    hourly_rate: '' 
  });
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState('');
  const [availability, setAvailability] = useState([]);
  const [emergency, setEmergency] = useState({ 
    emergency_contact_name: '', 
    emergency_contact_phone: '' 
  });
  const [gallery, setGallery] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [earnings, setEarnings] = useState({ 
    total: 0, 
    average: 0, 
    monthly: [], 
    completedCount: 0, 
    statusBreakdown: {} 
  });

  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState(null);
  const [savingAvailability, setSavingAvailability] = useState(false);

  // Saved Slots state
  const [slots, setSlots] = useState([]);
  const [editingSlot, setEditingSlot] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSlotData, setEditSlotData] = useState({ start_time: '', end_time: '' });

  // Modal states
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [currentDocId, setCurrentDocId] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: '' });
  const [bookingToReview, setBookingToReview] = useState(null);

  // Report state
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedBookingForReport, setSelectedBookingForReport] = useState(null);

  // Load all data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading dashboard data...');
      
      // Load profile
      try {
        const profileRes = await API.get('/babysitters/profile/me');
        console.log('✅ Profile loaded:', profileRes.data);
        setProfile(profileRes.data);
        setDocuments(profileRes.data.documents || []);
        
        setEditForm({
          bio: profileRes.data.bio || '',
          experience_years: profileRes.data.experience_years || '',
          hourly_rate: profileRes.data.hourly_rate || '',
        });
        setSkills(profileRes.data.skills || []);
        
        if (profileRes.data.availability) {
          setAvailability(profileRes.data.availability);
        }
        
        setEmergency({
          emergency_contact_name: profileRes.data.emergency_contact_name || '',
          emergency_contact_phone: profileRes.data.emergency_contact_phone || '',
        });
      } catch (profileError) {
        console.error('❌ Profile load error:', profileError);
        addToast('Failed to load profile. Please ensure you have a babysitter profile.', 'error');
      }

      // Load bookings
      try {
        const bookingsRes = await API.get('/bookings');
        console.log('✅ Bookings loaded:', bookingsRes.data.length);
        setBookings(bookingsRes.data);
        calculateEarnings(bookingsRes.data);
      } catch (bookingError) {
        console.error('❌ Bookings load error:', bookingError);
        setBookings([]);
      }

      // Load slots
      try {
        await loadSlots();
      } catch (slotError) {
        console.error('❌ Slots load error:', slotError);
      }

      // Load gallery
      if (user?.id) {
        try {
          const galleryRes = await API.get(`/babysitters/gallery/${user.id}`);
          setGallery(galleryRes.data);
          console.log('✅ Gallery loaded:', galleryRes.data.length);
        } catch (galleryError) {
          console.error('❌ Gallery load error:', galleryError);
        }
      }

    } catch (error) {
      console.error('❌ Load all data error:', error);
      addToast('Failed to load some data. Please refresh.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = async () => {
    try {
      const res = await API.get('/babysitters/availability/slots');
      setSlots(res.data);
    } catch (error) {
      console.error('Load slots error:', error);
    }
  };

  const calculateEarnings = (bookingsData) => {
    if (bookingsData.length > 0) {
      const completed = bookingsData.filter((b) => b.status === 'completed');
      const total = completed.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
      const average = completed.length > 0 ? total / completed.length : 0;
      const months = {};
      const breakdown = {};
      
      completed.forEach((b) => {
        const m = new Date(b.created_at).toLocaleString('default', { month: 'short', year: 'numeric' });
        months[m] = (months[m] || 0) + parseFloat(b.total_amount || 0);
      });
      
      bookingsData.forEach((b) => { 
        breakdown[b.status] = (breakdown[b.status] || 0) + 1; 
      });
      
      setEarnings({ 
        total, 
        average, 
        monthly: Object.entries(months), 
        completedCount: completed.length, 
        statusBreakdown: breakdown 
      });
    }
  };

  // ============================================
  // PROFILE MANAGEMENT
  // ============================================
  const updateProfile = async (e) => {
    e.preventDefault();
    try {
      await API.put('/babysitters/profile', { ...editForm, skills });
      addToast('Profile updated!', 'success');
      loadAllData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Error updating profile', 'error');
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const removeSkill = (s) => setSkills(skills.filter((sk) => sk !== s));

  // ============================================
  // AVAILABILITY MANAGEMENT
  // ============================================
  
  const toggleDay = (day) => {
    setAvailability((prev) => {
      const exists = prev.find((a) => a.day_of_week === day);
      if (exists) {
        return prev.filter((a) => a.day_of_week !== day);
      } else {
        return [...prev, { 
          day_of_week: day, 
          start_time: '09:00', 
          end_time: '17:00',
          is_available: true,
          is_published: false
        }];
      }
    });
  };

  const updateSlot = (day, field, value) => {
    setAvailability((prev) => 
      prev.map((a) => (a.day_of_week === day ? { ...a, [field]: value } : a))
    );
  };

  const saveAvailability = async () => {
    try {
      setSavingAvailability(true);
      
      const availableSlots = availability.filter(a => a.is_available !== false);
      
      if (availableSlots.length === 0) {
        addToast('Please select at least one day and time.', 'error');
        setSavingAvailability(false);
        return;
      }

      for (const slot of availableSlots) {
        if (!slot.start_time || !slot.end_time) {
          addToast('Please set both start and end times for all selected days.', 'error');
          setSavingAvailability(false);
          return;
        }
        if (slot.start_time >= slot.end_time) {
          addToast('Start time must be before end time for all selected days.', 'error');
          setSavingAvailability(false);
          return;
        }
      }

      const dataToSend = availableSlots.map(({ day_of_week, start_time, end_time }) => ({
        day_of_week,
        start_time,
        end_time
      }));

      await API.post('/babysitters/availability', { availability: dataToSend });
      addToast('Availability saved successfully! ✅', 'success');
      await loadAllData();
    } catch (err) {
      console.error('Save availability error:', err);
      addToast(err.response?.data?.error || 'Error saving availability', 'error');
    } finally {
      setSavingAvailability(false);
    }
  };

  // ============================================
  // PUBLISH AVAILABILITY
  // ============================================
  const publishAvailability = async () => {
    if (profile?.status !== 'approved') {
      addToast('Your profile must be approved before you can publish availability.', 'error');
      return;
    }

    if (profile?.suspended_at) {
      addToast('Your account is suspended. You cannot publish availability. Please contact support.', 'error');
      return;
    }

    const hasAvailability = availability.some(a => a.is_available);
    if (!hasAvailability) {
      addToast('Please add some availability slots first.', 'error');
      return;
    }

    setPublishing(true);
    try {
      const availableSlots = availability.filter(a => a.is_available);
      
      const res = await API.post('/babysitters/availability/publish', {
        availability: availableSlots.map(slot => ({ id: slot.id }))
      });

      setPublishStatus({
        success: true,
        message: res.data.message,
        count: res.data.published
      });

      addToast(`✅ ${res.data.message}`, 'success');
      loadAllData();
    } catch (error) {
      console.error('Publish error:', error);
      const errorMsg = error.response?.data?.error || 'Failed to publish availability.';
      
      if (error.response?.data?.suspended) {
        addToast('❌ Your account is suspended. Please contact support.', 'error');
      } else {
        addToast(errorMsg, 'error');
      }
      
      setPublishStatus({
        success: false,
        message: errorMsg
      });
    } finally {
      setPublishing(false);
    }
  };

  // ============================================
  // SLOT MANAGEMENT FUNCTIONS
  // ============================================
  
  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Are you sure you want to delete this availability slot?')) return;
    
    try {
      await API.delete(`/babysitters/availability/slots/${slotId}`);
      addToast('Slot deleted successfully!', 'success');
      loadSlots();
      loadAllData();
    } catch (error) {
      addToast(error.response?.data?.error || 'Error deleting slot', 'error');
    }
  };

  const handleEditSlot = async (slotId) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;
    
    setEditingSlot(slot);
    setEditSlotData({ 
      start_time: slot.start_time, 
      end_time: slot.end_time 
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      await API.put(`/babysitters/availability/slots/${editingSlot.id}`, {
        start_time: editSlotData.start_time,
        end_time: editSlotData.end_time,
        is_available: true
      });
      addToast('Slot updated successfully!', 'success');
      setShowEditModal(false);
      setEditingSlot(null);
      loadSlots();
      loadAllData();
    } catch (error) {
      addToast(error.response?.data?.error || 'Error updating slot', 'error');
    }
  };

  const handlePublishSlot = async (slotId) => {
    try {
      await API.post(`/babysitters/availability/publish/${slotId}`);
      addToast('Slot published successfully!', 'success');
      loadSlots();
      loadAllData();
    } catch (error) {
      addToast(error.response?.data?.error || 'Error publishing slot', 'error');
    }
  };

  const handleUnpublishSlot = async (slotId) => {
    try {
      await API.post(`/babysitters/availability/unpublish/${slotId}`);
      addToast('Slot unpublished successfully!', 'success');
      loadSlots();
      loadAllData();
    } catch (error) {
      addToast(error.response?.data?.error || 'Error unpublishing slot', 'error');
    }
  };

  // ============================================
  // DOCUMENT MANAGEMENT
  // ============================================
  const getDocumentTypeLabel = (type) => {
    const types = {
      'id_card': '🪪 ID Card',
      'cv': '📄 CV/Resume',
      'certificate': '📜 Certificate',
    };
    return types[type] || type;
  };

  const uploadDocument = async (type) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setUploading(true);
      const formData = new FormData();
      formData.append('document', file);
      formData.append('document_type', type);
      
      try {
        await API.post('/babysitters/documents', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        addToast('Document uploaded!', 'success');
        loadAllData();
      } catch (err) {
        addToast(err.response?.data?.error || 'Error uploading document', 'error');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const deleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await API.delete(`/babysitters/documents/${docId}`);
      addToast('Document deleted!', 'success');
      loadAllData();
    } catch (err) {
      addToast('Error deleting document', 'error');
    }
  };

  const updateDocument = async (docId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setUploading(true);
      const formData = new FormData();
      formData.append('document', file);
      
      try {
        await API.put(`/babysitters/documents/${docId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        addToast('Document updated and resubmitted for review!', 'success');
        loadAllData();
      } catch (err) {
        addToast('Error updating document', 'error');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  // ============================================
  // BOOKING MANAGEMENT
  // ============================================
  const handleBookingStatus = async (id, status) => {
    try {
      await API.put(`/bookings/${id}/status`, { status });
      addToast(`Booking ${status}!`, 'success');
      loadAllData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Error updating booking', 'error');
    }
  };

  const handleCancelBooking = async () => {
    if (!cancelReason.trim()) {
      addToast('Please provide a cancellation reason', 'error');
      return;
    }

    try {
      await API.put(`/bookings/${bookingToCancel}/cancel`, { 
        reason: cancelReason 
      });
      addToast('Booking cancelled!', 'success');
      setShowCancelModal(false);
      setCancelReason('');
      setBookingToCancel(null);
      loadAllData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Error cancelling booking', 'error');
    }
  };

  const submitReview = async () => {
    try {
      await API.post('/bookings/parent-reviews', {
        booking_id: bookingToReview,
        parent_id: bookings.find(b => b.id === bookingToReview)?.parent_id,
        rating: reviewData.rating,
        comment: reviewData.comment
      });
      addToast('Review submitted!', 'success');
      setShowReviewModal(false);
      setReviewData({ rating: 5, comment: '' });
      setBookingToReview(null);
      loadAllData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Error submitting review', 'error');
    }
  };

  // ============================================
  // EMERGENCY CONTACT
  // ============================================
  const saveEmergency = async (e) => {
    e.preventDefault();
    try {
      await API.put('/babysitters/profile', emergency);
      addToast('Emergency contact saved!', 'success');
      loadAllData();
    } catch (err) {
      addToast('Error saving emergency contact', 'error');
    }
  };

  // ============================================
  // GALLERY MANAGEMENT
  // ============================================
  const uploadGalleryImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const formData = new FormData();
      formData.append('image', file);
      
      try {
        const res = await API.post('/babysitters/gallery', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setGallery((prev) => [res.data, ...prev]);
        addToast('Image uploaded for approval!', 'success');
        loadAllData();
      } catch (err) {
        addToast('Error uploading image', 'error');
      }
    };
    input.click();
  };

  const deleteGalleryImage = async (imageId) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;
    
    try {
      await API.delete(`/babysitters/gallery/${imageId}`);
      setGallery((prev) => prev.filter((img) => img.id !== imageId));
      addToast('Image deleted!', 'success');
    } catch (err) {
      addToast('Error deleting image', 'error');
    }
  };

  const setPrimaryImage = async (imageId) => {
    try {
      await API.put(`/babysitters/gallery/${imageId}/primary`);
      setGallery((prev) => prev.map((img) => ({ 
        ...img, 
        is_primary: img.id === imageId 
      })));
      addToast('Primary image updated!', 'success');
    } catch (err) {
      addToast('Error updating primary image', 'error');
    }
  };

  // ============================================
  // HELPERS
  // ============================================
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      in_progress: '#8b5cf6',
      completed: '#10b981',
      cancelled: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  // ============================================
  // RENDER BOOKINGS TAB
  // ============================================
  const renderBookingsTab = () => (
    <div className="dash-content">
      {bookings.length === 0 ? (
        <div className="no-results">
          <p>No bookings yet.</p>
        </div>
      ) : (
        <div className="booking-list">
          {bookings.map((b) => (
            <div key={b.id} className="booking-item">
              <div className="booking-main">
                <div className="booking-person">
                  <div className="avatar-sm">{b.parent_first_name?.[0]}</div>
                  <div>
                    <strong>{b.parent_first_name} {b.parent_last_name}</strong>
                    <span className="booking-child">{b.child_name}</span>
                  </div>
                </div>
                <div className="booking-dates">
                  <span>{new Date(b.start_date).toLocaleDateString()} {b.start_time?.slice(0, 5)}</span>
                  <span>→</span>
                  <span>{new Date(b.end_date).toLocaleDateString()} {b.end_time?.slice(0, 5)}</span>
                </div>
                <div className="booking-amount">${parseFloat(b.total_amount || 0).toFixed(2)}</div>
                <span className={`booking-status ${statusClass(b.status)}`}>
                  {b.status}
                </span>
                {b.cancellation_reason && (
                  <div className="cancellation-reason">
                    Cancelled: {b.cancellation_reason}
                  </div>
                )}
              </div>
              <div className="booking-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {b.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => handleBookingStatus(b.id, 'confirmed')} 
                      className="btn btn-sm btn-primary"
                    >
                      ✅ Confirm
                    </button>
                    <button 
                      onClick={() => {
                        setBookingToCancel(b.id);
                        setShowCancelModal(true);
                      }} 
                      className="btn btn-sm btn-outline-danger"
                    >
                      ❌ Cancel
                    </button>
                  </>
                )}
                {b.status === 'confirmed' && (
                  <>
                    <button 
                      onClick={() => handleBookingStatus(b.id, 'in_progress')} 
                      className="btn btn-sm btn-primary"
                    >
                      🔄 Start
                    </button>
                    <button 
                      onClick={() => {
                        setBookingToCancel(b.id);
                        setShowCancelModal(true);
                      }} 
                      className="btn btn-sm btn-outline-danger"
                    >
                      ❌ Cancel
                    </button>
                  </>
                )}
                {b.status === 'in_progress' && (
                  <>
                    <button 
                      onClick={() => handleBookingStatus(b.id, 'completed')} 
                      className="btn btn-sm btn-success"
                    >
                      ✅ Complete
                    </button>
                    <button 
                      onClick={() => {
                        setBookingToCancel(b.id);
                        setShowCancelModal(true);
                      }} 
                      className="btn btn-sm btn-outline-danger"
                    >
                      ❌ Cancel
                    </button>
                  </>
                )}
                {b.status === 'completed' && (
                  <>
                    <button 
                      onClick={() => {
                        setBookingToReview(b.id);
                        setShowReviewModal(true);
                      }} 
                      className="btn btn-sm btn-outline"
                    >
                      ⭐ Review Parent
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBookingForReport(b);
                        setShowReportModal(true);
                      }}
                      className="btn btn-sm btn-outline-danger"
                    >
                      🚨 Report Parent
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
                    🚨 Report Parent
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER PROFILE TAB
  // ============================================
  const renderProfileTab = () => (
    <div className="dash-content">
      <form onSubmit={updateProfile} className="profile-form">
        <div className="form-group">
          <label>Bio</label>
          <textarea 
            name="bio" 
            value={editForm.bio} 
            onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} 
            rows={4} 
            placeholder="Tell parents about yourself..." 
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Experience (years)</label>
            <input 
              type="number" 
              name="experience_years" 
              value={editForm.experience_years} 
              onChange={(e) => setEditForm({ ...editForm, experience_years: e.target.value })} 
              min="0" 
            />
          </div>
          <div className="form-group">
            <label>Hourly Rate ($)</label>
            <input 
              type="number" 
              step="0.01" 
              name="hourly_rate" 
              value={editForm.hourly_rate} 
              onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })} 
              min="0" 
            />
          </div>
        </div>
        <div className="form-group">
          <label>Skills</label>
          <div className="skills-tags" style={{ marginBottom: 8 }}>
            {skills.map((s) => (
              <span key={s} className="skill-tag" style={{ cursor: 'pointer' }} onClick={() => removeSkill(s)}>
                {s} ✕
              </span>
            ))}
          </div>
          <div className="skill-input-group">
            <input 
              type="text" 
              value={newSkill} 
              onChange={(e) => setNewSkill(e.target.value)} 
              placeholder="e.g., First Aid, Infant Care..." 
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())} 
            />
            <button type="button" onClick={addSkill} className="btn btn-sm btn-outline">Add</button>
          </div>
        </div>
        <button type="submit" className="btn btn-primary">Save Profile</button>
      </form>
    </div>
  );

  // ============================================
  // RENDER AVAILABILITY TAB
  // ============================================
  const renderAvailabilityTab = () => (
    <div className="dash-content">
      <div className="availability-setup">
        {profile?.status !== 'approved' && (
          <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
            ⚠️ Your profile is <strong>{profile?.status}</strong>. You can set up your availability, 
            but it will not be visible to parents until your profile is approved by admin.
          </div>
        )}

        {profile?.suspended_at && (
          <div className="alert alert-error" style={{ marginBottom: '16px' }}>
            🚫 Your account is suspended. You cannot publish availability until your account is restored.
            <br />
            <small>Please contact support at <a href="mailto:support@carenest.com">support@carenest.com</a></small>
          </div>
        )}

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h4 style={{ margin: 0 }}>📆 Your Weekly Availability</h4>
            {profile?.status === 'approved' && !profile?.suspended_at && (
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {availability.filter(a => a.is_published).length} slots currently published
              </p>
            )}
          </div>
          {profile?.status === 'approved' && !profile?.suspended_at ? (
            <button
              onClick={publishAvailability}
              disabled={publishing || availability.filter(a => a.is_available).length === 0}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
              }}
            >
              {publishing ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Publishing...
                </>
              ) : (
                <>📢 Publish All</>
              )}
            </button>
          ) : profile?.suspended_at ? (
            <button disabled className="btn btn-secondary" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
              🔒 Account Suspended
            </button>
          ) : null}
        </div>

        <div style={{ marginBottom: '12px' }}>
          {dayNames.map((day, i) => {
            const slot = availability.find((a) => a.day_of_week === i);
            const isActive = !!slot && slot.is_available !== false;
            
            return (
              <div 
                key={i} 
                className={`avail-day ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius)',
                  background: isActive ? 'rgba(79, 70, 229, 0.08)' : 'var(--color-surface)',
                  border: isActive ? '1px solid rgba(79, 70, 229, 0.25)' : '1px solid var(--color-border-light)',
                  transition: 'all var(--transition)',
                  marginBottom: '4px',
                  flexWrap: 'wrap',
                }}
              >
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  fontWeight: 500, 
                  minWidth: '120px', 
                  cursor: 'pointer',
                  fontSize: '0.88rem' 
                }}>
                  <input 
                    type="checkbox" 
                    checked={isActive} 
                    onChange={() => toggleDay(i)} 
                    style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary-500)' }}
                  />
                  {day}
                </label>
                
                {isActive && (
                  <>
                    <div className="avail-times" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <input 
                        type="time" 
                        value={slot?.start_time || '09:00'} 
                        onChange={(e) => updateSlot(i, 'start_time', e.target.value)} 
                        style={{ 
                          padding: '6px 10px', 
                          border: '1px solid var(--color-border)', 
                          borderRadius: 'var(--radius-sm)', 
                          fontSize: '0.85rem', 
                          background: 'var(--color-surface)', 
                          color: 'var(--color-text)', 
                          outline: 'none' 
                        }}
                      />
                      <span style={{ color: 'var(--color-text-secondary)' }}>to</span>
                      <input 
                        type="time" 
                        value={slot?.end_time || '17:00'} 
                        onChange={(e) => updateSlot(i, 'end_time', e.target.value)} 
                        style={{ 
                          padding: '6px 10px', 
                          border: '1px solid var(--color-border)', 
                          borderRadius: 'var(--radius-sm)', 
                          fontSize: '0.85rem', 
                          background: 'var(--color-surface)', 
                          color: 'var(--color-text)', 
                          outline: 'none' 
                        }}
                      />
                    </div>
                    
                    {profile?.status === 'approved' && !profile?.suspended_at && slot?.is_published && (
                      <span style={{ 
                        fontSize: '0.7rem', 
                        color: '#10b981',
                        fontWeight: '600',
                        marginLeft: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        ✅ Published
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        
        <button 
          onClick={saveAvailability} 
          className="btn btn-primary" 
          style={{ marginTop: 8 }}
          disabled={savingAvailability}
        >
          {savingAvailability ? (
            <>
              <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, marginRight: '8px' }} />
              Saving...
            </>
          ) : (
            '💾 Save Availability'
          )}
        </button>

        {publishStatus && (
          <div className={`alert ${publishStatus.success ? 'alert-success' : 'alert-error'}`} style={{ marginTop: '12px' }}>
            {publishStatus.message}
          </div>
        )}

        <div style={{ 
          marginTop: '16px', 
          padding: '12px 16px', 
          background: 'var(--color-bg-alt)', 
          borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border-light)',
          fontSize: '0.85rem',
          color: 'var(--color-text-secondary)'
        }}>
          <p style={{ margin: 0 }}>
            💡 <strong>How it works:</strong> 
            {' '}Check the days you're available, set your preferred times, then click <strong>"Save Availability"</strong>.
            {' '}Once saved, click <strong>"Publish All"</strong> or publish individual slots in the <strong>"Saved Slots"</strong> tab.
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
            📌 Your availability will appear in search results and booking requests once published.
          </p>
        </div>
      </div>
    </div>
  );

  // ============================================
  // RENDER SAVED SLOTS TAB
  // ============================================
  const renderSavedSlotsTab = () => (
    <div className="dash-content">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <h3 style={{ margin: 0 }}>📋 Saved Availability Slots</h3>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {slots.filter(s => s.is_published).length} published · {slots.filter(s => s.is_booked).length} booked
        </span>
      </div>

      {slots.length === 0 ? (
        <div className="no-results">
          <p>No availability slots saved yet.</p>
          <p style={{ fontSize: '0.85rem' }}>Go to the Availability tab to add your schedule.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const dayName = dayNames[slot.day_of_week] || slot.day_of_week;
                const isBooked = slot.is_booked;
                const isPublished = slot.is_published;
                
                return (
                  <tr key={slot.id} style={{
                    background: isBooked ? 'rgba(239, 68, 68, 0.05)' : 
                               isPublished ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
                  }}>
                    <td>
                      <strong>{dayName}</strong>
                      {isBooked && (
                        <span style={{ 
                          display: 'block', 
                          fontSize: '0.7rem', 
                          color: '#ef4444',
                          fontWeight: '600'
                        }}>
                          🔒 Booked by {slot.booked_by_first_name || 'a parent'}
                        </span>
                      )}
                    </td>
                    <td>{slot.start_time?.slice(0, 5) || '--'}</td>
                    <td>{slot.end_time?.slice(0, 5) || '--'}</td>
                    <td>
                      {isBooked ? (
                        <span className="badge badge-danger">Booked</span>
                      ) : isPublished ? (
                        <span className="badge badge-success">✅ Published</span>
                      ) : (
                        <span className="badge badge-warning">⏳ Draft</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {!isBooked ? (
                          <>
                            {!isPublished ? (
                              <button
                                onClick={() => handlePublishSlot(slot.id)}
                                className="btn btn-sm btn-success"
                                title="Publish this slot"
                              >
                                📢 Publish
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUnpublishSlot(slot.id)}
                                className="btn btn-sm btn-outline"
                                title="Unpublish this slot"
                              >
                                📥 Unpublish
                              </button>
                            )}
                            <button
                              onClick={() => handleEditSlot(slot.id)}
                              className="btn btn-sm btn-outline"
                              title="Edit this slot"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteSlot(slot.id)}
                              className="btn btn-sm btn-outline-danger"
                              title="Delete this slot"
                            >
                              🗑️
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ⚠️ Booked - Cannot modify
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingSlot && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>✏️ Edit Availability Slot</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px' }}>
                Editing <strong>{dayNames[editingSlot.day_of_week]}</strong>
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={editSlotData.start_time}
                    onChange={(e) => setEditSlotData({ ...editSlotData, start_time: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>End Time</label>
                  <input
                    type="time"
                    value={editSlotData.end_time}
                    onChange={(e) => setEditSlotData({ ...editSlotData, end_time: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER DOCUMENTS TAB
  // ============================================
  const renderDocumentsTab = () => (
    <div className="dash-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>📄 My Documents</h3>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {documents.filter(d => d.is_verified).length} verified · {documents.filter(d => !d.is_verified && !d.rejection_reason).length} pending
        </span>
      </div>

      <div className="documents-upload">
        <button onClick={() => uploadDocument('id_card')} className="btn btn-outline" disabled={uploading}>
          {uploading ? 'Uploading...' : '🪪 Upload ID Card'}
        </button>
        <button onClick={() => uploadDocument('cv')} className="btn btn-outline" disabled={uploading}>
          {uploading ? 'Uploading...' : '📄 Upload CV/Resume'}
        </button>
        <button onClick={() => uploadDocument('certificate')} className="btn btn-outline" disabled={uploading}>
          {uploading ? 'Uploading...' : '📜 Upload Certificate'}
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="no-results" style={{ padding: '40px 20px' }}>
          <p>No documents uploaded yet.</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Upload your documents to get verified as a babysitter.
          </p>
        </div>
      ) : (
        <div className="documents-list">
          {documents.map((doc) => (
            <div 
              key={doc.id} 
              className="document-item" 
              style={{
                borderLeft: doc.is_verified ? '4px solid #10b981' : 
                           doc.rejection_reason ? '4px solid #ef4444' : 
                           '4px solid #f59e0b',
                padding: '12px 18px',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-xs)',
                border: '1px solid var(--color-border-light)',
                transition: 'all var(--transition)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.95rem' }}>{getDocumentTypeLabel(doc.document_type)}</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                  </span>
                </div>
                {doc.rejection_reason && (
                  <div style={{ 
                    fontSize: '0.8rem', 
                    color: '#ef4444', 
                    marginTop: '4px',
                    padding: '4px 10px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    borderRadius: '4px'
                  }}>
                    📝 Revision Needed: {doc.rejection_reason}
                  </div>
                )}
                {doc.admin_notes && (
                  <div style={{ 
                    fontSize: '0.8rem', 
                    color: 'var(--text-muted)', 
                    marginTop: '2px' 
                  }}>
                    Admin Note: {doc.admin_notes}
                  </div>
                )}
              </div>
              <div className="doc-status">
                {doc.is_verified ? (
                  <span className="badge badge-success">✅ Verified</span>
                ) : doc.rejection_reason ? (
                  <span className="badge badge-danger">🔄 Revision Needed</span>
                ) : (
                  <span className="badge badge-warning">⏳ Pending</span>
                )}
              </div>
              <div className="doc-actions" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {doc.rejection_reason && (
                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={() => updateDocument(doc.id)}
                  >
                    🔄 Resubmit
                  </button>
                )}
                <button 
                  className="btn btn-sm btn-outline"
                  onClick={() => window.open(doc.document_url, '_blank')}
                >
                  👁️ View
                </button>
                <button 
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => deleteDocument(doc.id)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {documents.some(d => d.rejection_reason) && (
        <div className="alert alert-info" style={{ marginTop: '16px' }}>
          <strong>📝 Revision Needed:</strong> Please update the documents marked with "Revision Needed" 
          and resubmit them for review.
        </div>
      )}

      {/* Document Status Summary */}
      <div style={{ 
        marginTop: '16px', 
        padding: '12px 16px', 
        background: 'var(--bg-alt)', 
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border-light)',
        display: 'flex',
        gap: '24px',
        flexWrap: 'wrap'
      }}>
        <div>
          <span style={{ fontWeight: '600' }}>Total: </span>
          <span>{documents.length}</span>
        </div>
        <div>
          <span style={{ fontWeight: '600', color: '#10b981' }}>Verified: </span>
          <span>{documents.filter(d => d.is_verified).length}</span>
        </div>
        <div>
          <span style={{ fontWeight: '600', color: '#f59e0b' }}>Pending: </span>
          <span>{documents.filter(d => !d.is_verified && !d.rejection_reason).length}</span>
        </div>
        <div>
          <span style={{ fontWeight: '600', color: '#ef4444' }}>Revision: </span>
          <span>{documents.filter(d => d.rejection_reason).length}</span>
        </div>
      </div>
    </div>
  );

  // ============================================
  // RENDER LOCATION TAB (NEW)
  // ============================================
  const renderLocationTab = () => (
    <div className="dash-content">
      <BabysitterLocation />
    </div>
  );

  // ============================================
  // RENDER EMERGENCY TAB
  // ============================================
  const renderEmergencyTab = () => (
    <div className="dash-content">
      <form onSubmit={saveEmergency} className="emergency-form">
        <div className="form-group">
          <label>Emergency Contact Name</label>
          <input
            type="text"
            value={emergency.emergency_contact_name}
            onChange={(e) => setEmergency({ ...emergency, emergency_contact_name: e.target.value })}
            placeholder="e.g., John Doe"
          />
        </div>
        <div className="form-group">
          <label>Emergency Contact Phone</label>
          <PhoneInput
            value={emergency.emergency_contact_phone}
            onChange={(val) => setEmergency({ ...emergency, emergency_contact_phone: val })}
          />
        </div>
        <button type="submit" className="btn btn-primary">Save Emergency Contact</button>
      </form>

      {(profile?.emergency_contact_name || profile?.emergency_contact_phone) && (
        <div className="emergency-card" style={{ marginTop: 20 }}>
          <div className="emergency-icon">🚨</div>
          <div>
            <strong>{profile.emergency_contact_name}</strong>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{profile.emergency_contact_phone}</p>
          </div>
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER GALLERY TAB
  // ============================================
  const renderGalleryTab = () => (
    <div className="dash-content">
      <button onClick={uploadGalleryImage} className="btn btn-outline" style={{ marginBottom: 16 }}>
        📷 Upload Image
      </button>
      <div className="image-gallery">
        {gallery.map((img) => (
          <div key={img.id} style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={img.image_url}
              alt={img.caption || ''}
              className={`gallery-image ${img.is_primary ? 'primary' : ''}`}
            />
            <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
              {!img.is_primary && (
                <button
                  onClick={() => setPrimaryImage(img.id)}
                  className="btn btn-sm btn-outline"
                  title="Set as primary"
                  style={{ padding: '2px 6px', fontSize: '0.7rem', background: 'var(--surface)' }}
                >
                  ⭐
                </button>
              )}
              <button
                onClick={() => deleteGalleryImage(img.id)}
                className="btn btn-sm btn-outline-danger"
                title="Delete"
                style={{ padding: '2px 6px', fontSize: '0.7rem', background: 'var(--surface)' }}
              >
                🗑️
              </button>
            </div>
            {img.status === 'pending' && (
              <div style={{ 
                position: 'absolute', 
                bottom: 4, 
                left: 4, 
                background: 'var(--warning)', 
                color: 'white',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '600'
              }}>
                Pending Approval
              </div>
            )}
          </div>
        ))}
        {gallery.length === 0 && <p className="no-results">No images uploaded yet.</p>}
      </div>
    </div>
  );

  // ============================================
  // RENDER EARNINGS TAB
  // ============================================
  const renderEarningsTab = () => (
    <div className="dash-content">
      <div className="stats-grid admin-stats" style={{ marginBottom: 20 }}>
        <div className="stat stat-primary">
          <span className="stat-number">${earnings.total.toFixed(2)}</span>
          <span className="stat-label">Total Revenue</span>
        </div>
        <div className="stat">
          <span className="stat-number">{earnings.completedCount}</span>
          <span className="stat-label">Completed Bookings</span>
        </div>
        <div className="stat">
          <span className="stat-number">${earnings.average.toFixed(2)}</span>
          <span className="stat-label">Average per Booking</span>
        </div>
      </div>

      <div className="stats-grid admin-stats" style={{ marginBottom: 20 }}>
        {Object.entries(earnings.statusBreakdown).map(([status, count]) => (
          <div key={status} className={`stat ${status === 'completed' ? 'stat-success' : status === 'cancelled' ? 'stat-danger' : status === 'pending' ? 'stat-warning' : 'stat-accent'}`}>
            <span className="stat-number">{count}</span>
            <span className="stat-label" style={{ textTransform: 'capitalize' }}>{status}</span>
          </div>
        ))}
      </div>

      {earnings.monthly.length > 0 && (
        <div className="detail-card">
          <h3 style={{ marginBottom: 16 }}>📊 Monthly Earnings</h3>
          <div className="bar-chart">
            {earnings.monthly.map(([month, amount]) => {
              const max = Math.max(...earnings.monthly.map(([, a]) => a));
              return (
                <div key={month} className="bar-item">
                  <div className="bar-fill bar-fill-green" style={{ height: `${Math.max(8, (amount / max) * 120)}px` }} />
                  <span className="bar-value">${amount.toFixed(0)}</span>
                  <span className="bar-label">{month.split(' ')[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ============================================
  // MAIN RENDER
  // ============================================
  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'bookings', label: '📅 Bookings' },
    { id: 'profile', label: '👤 Profile' },
    { id: 'availability', label: '📆 Availability' },
    { id: 'saved-slots', label: '📋 Saved Slots' },
    { id: 'documents', label: '📄 Documents' },
    { id: 'location', label: '📍 Location' },  // <-- NEW TAB
    { id: 'emergency', label: '🚨 Emergency' },
    { id: 'gallery', label: '🖼️ Gallery' },
    { id: 'earnings', label: '💰 Earnings' },
  ];

  return (
    <div className="dashboard">
      <BackButton label="← Back to Home" fallback="/" />

      <div className="dash-header">
        <div>
          <h1>👶 Babysitter Dashboard</h1>
          <p>Welcome, {user?.first_name}!</p>
        </div>
      </div>

      <div className="dash-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`dash-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'bookings' && renderBookingsTab()}
      {activeTab === 'profile' && renderProfileTab()}
      {activeTab === 'availability' && renderAvailabilityTab()}
      {activeTab === 'saved-slots' && renderSavedSlotsTab()}
      {activeTab === 'documents' && renderDocumentsTab()}
      {activeTab === 'location' && renderLocationTab()}  {/* <-- NEW TAB RENDER */}
      {activeTab === 'emergency' && renderEmergencyTab()}
      {activeTab === 'gallery' && renderGalleryTab()}
      {activeTab === 'earnings' && renderEarningsTab()}

      {/* Cancel Booking Modal */}
      {showCancelModal && (
        <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>❌ Cancel Booking</h3>
              <button className="modal-close" onClick={() => setShowCancelModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Cancellation Reason <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Please explain why you're cancelling this booking..."
                  rows={4}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleCancelBooking}>Confirm Cancellation</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Parent Modal */}
      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⭐ Review Parent</h3>
              <button className="modal-close" onClick={() => setShowReviewModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Rating</label>
                <div className="rating-select">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      className={`rating-star ${r <= reviewData.rating ? 'active' : ''}`}
                      onClick={() => setReviewData({ ...reviewData, rating: r })}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Comment</label>
                <textarea
                  value={reviewData.comment}
                  onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                  placeholder="Share your experience with this parent..."
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReviewModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitReview}>Submit Review</button>
            </div>
          </div>
        </div>
      )}

      {/* Report Parent Modal */}
      {selectedBookingForReport && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setSelectedBookingForReport(null);
          }}
          reportedUserId={selectedBookingForReport.parent_id}
          reportedName={`${selectedBookingForReport.parent_first_name || ''} ${selectedBookingForReport.parent_last_name || ''}`}
          reportedRole="parent"
          bookingId={selectedBookingForReport.id}
          reporterRole="babysitter"
          onSuccess={() => {
            addToast('Report submitted successfully! Admin will review it.', 'success');
          }}
        />
      )}
    </div>
  );
}

export default BabysitterDashboard;