import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../components/Toast';
import PhoneInput from '../components/PhoneInput';
import BackButton from '../components/BackButton';
import AIChatbot from '../components/AIChatbot';

function ProfilePage() {
  const { user, setUser } = useAuth();
  const { t } = useLanguage();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', city: '', language: 'en', gender: '',
  });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' });
  const [error, setError] = useState('');
  const [showAIChat, setShowAIChat] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
        city: user.city || '',
        language: user.language || 'en',
        gender: user.gender || '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await API.put('/users/profile', form);
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      addToast('Profile updated!', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || t('common.error'), 'error');
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await API.put('/users/password', passwordForm);
      addToast('Password updated!', 'success');
      setPasswordForm({ current_password: '', new_password: '' });
    } catch (err) {
      addToast(err.response?.data?.error || t('common.error'), 'error');
    }
  };

  const uploadAvatar = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('avatar', file);
      try {
        const res = await API.post('/users/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setUser({ ...user, avatar_url: res.data.avatar_url });
        localStorage.setItem('user', JSON.stringify({ ...user, avatar_url: res.data.avatar_url }));
        addToast('Avatar updated!', 'success');
      } catch (err) {
        addToast('Error uploading avatar', 'error');
      }
    };
    input.click();
  };

  return (
    <div className="profile-layout">
      <div className="profile-topbar">
        <BackButton label="← Back" fallback="/dashboard" />
        <button
          onClick={() => setShowAIChat(!showAIChat)}
          className="profile-ai-btn"
        >
          <span className="profile-ai-btn-icon">✦</span>
          AI Assistant
        </button>
      </div>

      {showAIChat && (
        <div className="profile-ai-panel">
          <div className="profile-ai-panel-header">
            <span>✦ AI Profile Assistant</span>
            <button onClick={() => setShowAIChat(false)} className="profile-ai-close">✕</button>
          </div>
          <AIChatbot
            isEmbedded={true}
            onClose={() => setShowAIChat(false)}
            initialMessage="I need help updating my profile. What should I know?"
          />
        </div>
      )}

      <div className="profile-page">
        <div className="profile-hero">
          <div className="profile-hero-bg" />
          <div className="profile-hero-avatar-wrap" onClick={uploadAvatar}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="Avatar" className="profile-hero-avatar-img" />
            ) : (
              <div className="profile-hero-avatar">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
            )}
            <div className="profile-hero-avatar-edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </div>
          <div className="profile-hero-info">
            <h2>{user?.first_name} {user?.last_name}</h2>
            <p>{user?.email}</p>
          </div>
        </div>

        <div className="profile-body">
          <div className="profile-section">
            <div className="profile-section-header">
              <div className="profile-section-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h3>Personal Information</h3>
                <p>Update your personal details</p>
              </div>
            </div>
            <form onSubmit={updateProfile} className="profile-form">
              <div className="profile-form-row">
                <div className="profile-field">
                  <label>First Name</label>
                  <input type="text" name="first_name" value={form.first_name} onChange={handleChange} required />
                </div>
                <div className="profile-field">
                  <label>Last Name</label>
                  <input type="text" name="last_name" value={form.last_name} onChange={handleChange} required />
                </div>
              </div>
              <div className="profile-field">
                <label>Email</label>
                <input type="email" value={user?.email || ''} disabled />
              </div>
              <div className="profile-form-row">
                <div className="profile-field">
                  <label>Phone</label>
                  <PhoneInput value={form.phone} onChange={(val) => setForm({ ...form, phone: val })} />
                </div>
                <div className="profile-field">
                  <label>City</label>
                  <input type="text" name="city" value={form.city} onChange={handleChange} placeholder="Your city" />
                </div>
              </div>
              <div className="profile-field">
                <label>Language</label>
                <select name="language" value={form.language} onChange={handleChange}>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </div>
              <div className="profile-field">
                <label>Gender</label>
                <select name="gender" value={form.gender} onChange={handleChange}>
                  <option value="">--</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="profile-form-actions">
                <button type="submit" className="profile-save-btn">
                  Save Changes
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </form>
          </div>

          <div className="profile-section">
            <div className="profile-section-header">
              <div className="profile-section-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <h3>Password & Security</h3>
                <p>Manage your password</p>
              </div>
            </div>
            <form onSubmit={updatePassword} className="profile-form">
              <div className="profile-field">
                <label>Current Password</label>
                <input type="password" name="current_password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} required placeholder="Enter current password" />
              </div>
              <div className="profile-field">
                <label>New Password</label>
                <input type="password" name="new_password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} required minLength={6} placeholder="Min 6 characters" />
              </div>
              <div className="profile-form-actions">
                <button type="submit" className="profile-save-btn">
                  Update Password
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;