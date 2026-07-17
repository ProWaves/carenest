import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Rating from '../components/Rating';
import { useToast } from '../components/Toast';
import AIChatbot from '../components/AIChatbot';
import ReportModal from '../components/ReportModal';

function BabysitterProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await API.get(`/babysitters/${id}`);
        setProfile(res.data);
        
        if (user) {
          try {
            const favRes = await API.get('/parent/favorites');
            setIsFav(favRes.data.some(f => f.id === parseInt(id)));
          } catch (favError) {
            console.error('Favorite check error:', favError);
          }
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
        addToast('Failed to load babysitter profile', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id, user, addToast]);

  useEffect(() => {
    if (profile?.id) {
      API.get(`/babysitters/gallery/${profile.id}`)
        .then((r) => setGallery(r.data))
        .catch(() => {});
    }
  }, [profile?.id]);

  const handleFavorite = async () => {
    if (!user) return navigate('/login');
    try {
      if (isFav) {
        await API.delete(`/parent/favorites/${id}`);
        setIsFav(false);
        addToast('Removed from favorites', 'info');
      } else {
        await API.post('/parent/favorites', { babysitter_id: parseInt(id) });
        setIsFav(true);
        addToast('Added to favorites!', 'success');
      }
    } catch (err) {
      addToast('Error updating favorites', 'error');
    }
  };

  const dayNames = [
    t('babysitter.sunday'), 
    t('babysitter.monday'), 
    t('babysitter.tuesday'), 
    t('babysitter.wednesday'), 
    t('babysitter.thursday'), 
    t('babysitter.friday'), 
    t('babysitter.saturday')
  ];

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }
  
  if (!profile) {
    return (
      <div className="no-results">
        <p>{t('common.noResults')}</p>
        <Link to="/babysitters" className="btn btn-primary">
          ← Back to Search
        </Link>
      </div>
    );
  }

  return (
    <>
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
          maxWidth: '720px',
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
            padding: '28px 32px 28px',
            background: 'var(--gradient-primary)',
            color: 'white',
            overflow: 'hidden',
          }}>
            {/* decorative circles */}
            <div style={{
              position: 'absolute', top: -50, right: -50,
              width: 160, height: 160, borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)',
            }} />
            <div style={{
              position: 'absolute', bottom: -40, left: 40,
              width: 100, height: 100, borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
            }} />

            {/* top row: back + utility */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
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
                {user?.role === 'parent' && (
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
                )}
              </div>
            </div>

            {/* profile info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
              <div style={{
                width: '80px', height: '80px',
                borderRadius: '22px',
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(8px)',
                border: '2px solid rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: '28px',
                flexShrink: 0,
              }}>
                {profile.first_name?.[0]}{profile.last_name?.[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: '700' }}>
                  {profile.first_name} {profile.last_name}
                </div>
                <div style={{
                  fontSize: '0.85rem',
                  opacity: 0.85,
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}>
                  <span>📍 {profile.city || 'Unknown'}</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>{profile.language === 'en' ? 'English' : 'Français'}</span>
                  {profile.gender && (
                    <>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span>{profile.gender === 'male' ? 'Male' : profile.gender === 'female' ? 'Female' : profile.gender}</span>
                    </>
                  )}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <Rating value={parseFloat(profile.avg_rating)} count={profile.review_count} size="lg" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Action Bar ── */}
          {user?.role === 'parent' && (
            <div style={{
              display: 'flex',
              gap: '10px',
              padding: '20px 32px',
              borderBottom: '1px solid var(--color-border-light)',
              flexWrap: 'wrap',
            }}>
              <Link
                to={`/babysitters/${id}/book`}
                style={{
                  flex: '1 1 auto',
                  minWidth: '140px',
                  padding: '13px 24px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'var(--gradient-primary)',
                  color: 'white',
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                  transition: 'all 0.25s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                📅 {t('babysitter.book')}
              </Link>
              <Link
                to={`/messages/${id}`}
                style={{
                  flex: '1 1 auto',
                  minWidth: '140px',
                  padding: '13px 24px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-400)'; e.currentTarget.style.color = 'var(--color-primary-600)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text)'; }}
              >
                💬 {t('babysitter.sendMessage')}
              </Link>
              <button
                onClick={handleFavorite}
                style={{
                  padding: '13px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--color-border)',
                  background: isFav ? '#FEF2F2' : 'var(--color-surface)',
                  color: isFav ? '#EF4444' : 'var(--color-text-secondary)',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { if (!isFav) { e.currentTarget.style.borderColor = '#FECACA'; e.currentTarget.style.color = '#EF4444'; } }}
                onMouseLeave={e => { if (!isFav) { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; } }}
              >
                {isFav ? '❤️' : '🤍'} {isFav ? t('babysitter.removeFavorite') : t('babysitter.addFavorite')}
              </button>
              {profile.is_verified ? (
                <span style={{
                  padding: '13px 18px',
                  borderRadius: 'var(--radius-md)',
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  color: '#065F46',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  ✅ {t('babysitter.verified')}
                </span>
              ) : (
                <span style={{
                  padding: '13px 18px',
                  borderRadius: 'var(--radius-md)',
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  color: '#92400E',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  ⏳ {t('babysitter.pending')}
                </span>
              )}
            </div>
          )}

          {/* ── AI Chat Panel ── */}
          {showAIChat && user?.role === 'parent' && (
            <div style={{
              margin: '24px 32px 0',
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
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text)' }}>🤖 AI Assistant</span>
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
                initialMessage={`Tell me about ${profile.first_name} ${profile.last_name}. Are they available for booking?`}
              />
            </div>
          )}

          {/* ── Body Content ── */}
          <div style={{ padding: '28px 32px 32px' }}>

            {/* Bio & Stats */}
            <div style={{
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-light)',
              marginBottom: '16px',
              background: 'var(--color-surface)',
            }}>
              <h3 style={{
                fontSize: '0.8rem',
                fontWeight: '600',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '14px',
              }}>
                About
              </h3>
              <p style={{ fontSize: '0.92rem', lineHeight: '1.7', color: 'var(--color-text-secondary)', marginBottom: 0 }}>
                {profile.bio || 'No bio yet.'}
              </p>

              {profile.skills && profile.skills.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                  }}>
                    {profile.skills.map((s, i) => (
                      <span key={i} style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        background: 'var(--color-primary-50)',
                        color: 'var(--color-primary-700)',
                        fontSize: '0.78rem',
                        fontWeight: '600',
                        border: '1px solid var(--color-primary-100)',
                      }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats Row */}
              <div style={{
                display: 'flex',
                gap: '24px',
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--color-border-light)',
              }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--color-primary-600)' }}>
                    {profile.experience_years}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {t('babysitter.experience')}
                  </div>
                </div>
                <div style={{ width: 1, background: 'var(--color-border-light)' }} />
                <div style={{ flex: 1, textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--color-primary-600)' }}>
                    ${parseFloat(profile.hourly_rate || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {t('babysitter.rate')}
                  </div>
                </div>
                <div style={{ width: 1, background: 'var(--color-border-light)' }} />
                <div style={{ flex: 1, textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--color-primary-600)' }}>
                    {profile.review_count}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Reviews
                  </div>
                </div>
              </div>
            </div>

            {/* Availability */}
            <div style={{
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-light)',
              marginBottom: '16px',
              background: 'var(--color-surface)',
            }}>
              <h3 style={{
                fontSize: '0.8rem',
                fontWeight: '600',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '14px',
              }}>
                📅 Availability
              </h3>
              {profile.availability?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {profile.availability.map((a, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius)',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border-light)',
                    }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: 'var(--color-accent)',
                          flexShrink: 0,
                        }} />
                        {dayNames[a.day_of_week]}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>
                        {a.start_time?.slice(0, 5)} — {a.end_time?.slice(0, 5)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>{t('common.noResults')}</p>
              )}
            </div>

            {/* Gallery */}
            {gallery.length > 0 && (
              <div style={{
                padding: '24px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-light)',
                marginBottom: '16px',
                background: 'var(--color-surface)',
              }}>
                <h3 style={{
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '14px',
                }}>
                  📷 Gallery
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {gallery.map((img) => (
                    <img
                      key={img.id}
                      src={img.image_url}
                      alt={img.caption || ''}
                      onClick={() => setLightboxImg(img.image_url)}
                      style={{
                        width: 80, height: 80,
                        borderRadius: 'var(--radius)',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        border: img.is_primary ? '2px solid var(--color-primary-500)' : '2px solid transparent',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-500)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = img.is_primary ? '2px solid var(--color-primary-500)' : '2px solid transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            <div style={{
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-light)',
              background: 'var(--color-surface)',
            }}>
              <h3 style={{
                fontSize: '0.8rem',
                fontWeight: '600',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '14px',
              }}>
                ⭐ Reviews ({profile.review_count})
              </h3>
              {profile.reviews?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {profile.reviews.map((r, i) => (
                    <div key={i} style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius)',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border-light)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--color-text)' }}>{r.first_name} {r.last_name}</strong>
                        <Rating value={r.rating} />
                      </div>
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', margin: 0, lineHeight: '1.6' }}>{r.comment}</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px', display: 'block' }}>
                        {new Date(r.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>{t('babysitter.noReviews')}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {user?.role === 'parent' && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedUserId={parseInt(id)}
          reportedName={`${profile.first_name} ${profile.last_name}`}
          bookingId={null}
          onSuccess={() => {
            addToast('Report submitted! Admin will review it.', 'success');
          }}
        />
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <img
            src={lightboxImg}
            alt=""
            className="lightbox-content"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxImg(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

export default BabysitterProfile;