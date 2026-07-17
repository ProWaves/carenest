// client/src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockedAccount, setBlockedAccount] = useState(null);
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setBlockedAccount(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBlockedAccount(null);
    setLoading(true);

    try {
      const data = await login(form.email, form.password);
      
      if (data.blocked || data.error === 'account_suspended' || data.error === 'account_deactivated') {
        setBlockedAccount({
          message: data.message || 'Your account is blocked.',
          supportEmail: data.supportEmail || 'support@carenest.com',
          supportLink: data.supportLink || 'mailto:support@carenest.com',
          details: data.details || '',
          suspendedAt: data.suspendedAt,
          suspensionEndDate: data.suspensionEndDate,
          suspensionReason: data.suspensionReason
        });
        setLoading(false);
        return;
      }

      if (data.user.role === 'parent') navigate('/dashboard');
      else if (data.user.role === 'babysitter') navigate('/dashboard');
      else if (data.user.role === 'admin') navigate('/dashboard');
      else navigate('/');
    } catch (err) {
      if (err.response?.data?.blocked) {
        setBlockedAccount({
          message: err.response.data.message || 'Your account is blocked.',
          supportEmail: err.response.data.supportEmail || 'support@carenest.com',
          supportLink: err.response.data.supportLink || 'mailto:support@carenest.com',
          details: err.response.data.details || '',
          suspendedAt: err.response.data.suspendedAt,
          suspensionEndDate: err.response.data.suspensionEndDate,
          suspensionReason: err.response.data.suspensionReason
        });
      } else {
        setError(err.response?.data?.error || t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: 'var(--radius)', border: '1.5px solid var(--color-border)', fontSize: '0.92rem', background: 'var(--color-surface)', color: 'var(--color-text)', outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-secondary)' };

  if (blockedAccount) {
    return (
      <div className="auth-page">
        <div style={{ maxWidth: 440, width: '100%', margin: '40px auto', padding: '0 20px' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', padding: '28px 32px', color: '#fff', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{String.fromCodePoint(128683)}</div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700' }}>Account Blocked</h2>
            </div>
            <div style={{ padding: '28px 32px' }}>
              <p style={{ margin: '0 0 12px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{blockedAccount.message}</p>
              {blockedAccount.details && (
                <p style={{ margin: '0 0 12px', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>{blockedAccount.details}</p>
              )}
              {blockedAccount.suspensionReason && (
                <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 12, fontSize: '0.88rem' }}>
                  <strong style={{ color: 'var(--color-text)' }}>Reason:</strong> <span style={{ color: 'var(--color-text-secondary)' }}>{blockedAccount.suspensionReason}</span>
                </div>
              )}
              {blockedAccount.suspensionEndDate && (
                <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20, fontSize: '0.88rem' }}>
                  <strong style={{ color: 'var(--color-text)' }}>Expected Reactivation:</strong> <span style={{ color: 'var(--color-text-secondary)' }}>{new Date(blockedAccount.suspensionEndDate).toLocaleDateString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <a href={blockedAccount.supportLink} style={{ display: 'block', textAlign: 'center', padding: '12px', background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#fff', borderRadius: 'var(--radius)', fontWeight: '600', textDecoration: 'none', fontSize: '0.92rem' }} target="_blank" rel="noopener noreferrer">
                  {String.fromCodePoint(128231)} Contact Support
                </a>
                <button onClick={() => { setBlockedAccount(null); setForm({ email: '', password: '' }); }} style={{ display: 'block', textAlign: 'center', padding: '12px', background: 'transparent', color: 'var(--color-text-secondary)', borderRadius: 'var(--radius)', fontWeight: '600', border: '1.5px solid var(--color-border)', fontSize: '0.92rem', cursor: 'pointer' }}>
                  {String.fromCodePoint(8592)} Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div style={{ maxWidth: 440, width: '100%', margin: '40px auto', padding: '0 20px' }}>
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
          {/* Gradient Header */}
          <div style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #6366F1)', padding: '32px 32px 28px', color: '#fff', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', bottom: -30, left: 30, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '1.5rem', backdropFilter: 'blur(4px)' }}>
                {String.fromCodePoint(128274)}
              </div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '700' }}>{t('auth.login')}</h2>
              <p style={{ margin: '6px 0 0', opacity: 0.85, fontSize: '0.88rem' }}>Welcome back to CareNest</p>
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
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>{t('auth.email')}</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} required style={inputStyle} placeholder="you@example.com" />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>{t('auth.password')}</label>
                <input type="password" name="password" value={form.password} onChange={handleChange} required style={inputStyle} placeholder="Enter your password" />
              </div>
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: loading ? 'var(--color-primary-300)' : 'linear-gradient(135deg, #4F46E5, #6366F1)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontWeight: '700', fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(79,70,229,0.3)', transition: 'all 0.2s' }}>
                {loading ? t('common.loading') : t('auth.login')}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
              {t('auth.noAccount')} <Link to="/register" style={{ color: '#4F46E5', fontWeight: '600', textDecoration: 'none' }}>{t('auth.registerHere')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
