// ==========================================================================
// Register.jsx — User Registration Page
// ==========================================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import PhoneInput from '../components/PhoneInput';

function Register() {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '',
    phone: '', city: '', role: 'parent', language: 'en', gender: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: 'var(--radius)', border: '1.5px solid var(--color-border)', fontSize: '0.92rem', background: 'var(--color-surface)', color: 'var(--color-text)', outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-secondary)' };

  return (
    <div className="auth-page">
      <div style={{ maxWidth: 520, width: '100%', margin: '32px auto', padding: '0 20px' }}>
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
          {/* Gradient Header */}
          <div style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #6366F1)', padding: '28px 32px 24px', color: '#fff', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', bottom: -30, left: 30, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '1.5rem', backdropFilter: 'blur(4px)' }}>
                {String.fromCodePoint(128100)}
              </div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '700' }}>{t('auth.register')}</h2>
              <p style={{ margin: '6px 0 0', opacity: 0.85, fontSize: '0.88rem' }}>Join the CareNest community</p>
            </div>
          </div>

          {/* Form Body */}
          <div style={{ padding: '28px 32px 32px' }}>
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20, color: '#EF4444', fontSize: '0.88rem', fontWeight: '500' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              {/* Role Toggle */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>{t('auth.role')}</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[
                    { value: 'parent', label: t('auth.parent'), icon: String.fromCodePoint(128105) + String.fromCodePoint(8205) + String.fromCodePoint(128118) },
                    { value: 'babysitter', label: t('auth.babysitter'), icon: String.fromCodePoint(128105) + String.fromCodePoint(8205) + String.fromCodePoint(128118) },
                  ].map((r) => (
                    <button key={r.value} type="button" onClick={() => setForm({ ...form, role: r.value })} style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius)', border: form.role === r.value ? '2px solid #4F46E5' : '1.5px solid var(--color-border)', background: form.role === r.value ? 'rgba(79,70,229,0.06)' : 'var(--color-surface)', color: form.role === r.value ? '#4F46E5' : 'var(--color-text-secondary)', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: 18 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{t('auth.firstName')}</label>
                  <input type="text" name="first_name" value={form.first_name} onChange={handleChange} required style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{t('auth.lastName')}</label>
                  <input type="text" name="last_name" value={form.last_name} onChange={handleChange} required style={inputStyle} />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>{t('auth.email')}</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} required style={inputStyle} placeholder="you@example.com" />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>{t('auth.password')}</label>
                <input type="password" name="password" value={form.password} onChange={handleChange} required minLength={6} style={inputStyle} placeholder="Min 6 characters" />
              </div>

              {/* Phone & City */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: 18 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{t('auth.phone')}</label>
                  <PhoneInput value={form.phone} onChange={(val) => setForm({ ...form, phone: val })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{t('auth.city')}</label>
                  <input type="text" name="city" value={form.city} onChange={handleChange} placeholder={t('auth.city')} style={inputStyle} />
                </div>
              </div>

              {/* Language & Gender */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: 24 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{t('auth.language')}</label>
                  <select name="language" value={form.language} onChange={handleChange} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{t('auth.gender')}</label>
                  <select name="gender" value={form.gender} onChange={handleChange} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">--</option>
                    <option value="male">{t('auth.male')}</option>
                    <option value="female">{t('auth.female')}</option>
                    <option value="other">{t('auth.other')}</option>
                  </select>
                </div>
              </div>

              <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: loading ? 'var(--color-primary-300)' : 'linear-gradient(135deg, #4F46E5, #6366F1)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontWeight: '700', fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(79,70,229,0.3)', transition: 'all 0.2s' }}>
                {loading ? t('common.loading') : t('auth.register')}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
              {t('auth.hasAccount')} <Link to="/login" style={{ color: '#4F46E5', fontWeight: '600', textDecoration: 'none' }}>{t('auth.loginHere')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
