import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const COLORS = {
  primary: '#4F46E5',
  primaryLight: '#6366F1',
  purple: '#7C3AED',
  rose: '#F43F5E',
  teal: '#14B8A6',
  green: '#10B981',
  amber: '#F59E0B',
  blue: '#3B82F6',
};

function Home() {
  const { t } = useLanguage();

  const statCardStyle = { background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)', textAlign: 'center', flex: '1 1 0', minWidth: 160 };
  const stepCardStyle = { background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '28px 24px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)', textAlign: 'center', flex: '1 1 0', minWidth: 240 };
  const testimonialCardStyle = { background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)', flex: '1 1 0', minWidth: 280 };

  return (
    <div className="home-page">
      {/* HERO SECTION */}
      <div style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.purple}, ${COLORS.primaryLight})`, borderRadius: 'var(--radius-lg)', padding: '48px 40px 40px', marginBottom: '32px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -60, right: 80, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', top: 20, left: '40%', width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '48px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 400px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--radius-full)', padding: '6px 16px', fontSize: '0.82rem', fontWeight: '600', marginBottom: '20px', backdropFilter: 'blur(4px)' }}>
              {String.fromCodePoint(10024)} Trusted by 500+ parents
            </div>
            <h1 style={{ margin: 0, fontSize: '2.4rem', fontWeight: '800', lineHeight: 1.15 }}>{t('home.title')}</h1>
            <p style={{ margin: '12px 0 24px', opacity: 0.9, fontSize: '1.05rem', lineHeight: 1.6, maxWidth: 520 }}>{t('home.subtitle')}</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fff', color: COLORS.primary, padding: '12px 28px', borderRadius: 'var(--radius)', fontWeight: '700', fontSize: '0.95rem', textDecoration: 'none', boxShadow: 'var(--shadow-md)', transition: 'all 0.2s' }}>{t('home.start')} {String.fromCodePoint(8594)}</Link>
              <Link to="/babysitters" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '12px 28px', borderRadius: 'var(--radius)', fontWeight: '600', fontSize: '0.95rem', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(4px)', transition: 'all 0.2s' }}>{t('home.learn')}</Link>
            </div>
            <div style={{ display: 'flex', gap: '32px', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <div><div style={{ fontSize: '1.5rem', fontWeight: '800' }}>500+</div><div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{t('home.parents')}</div></div>
              <div><div style={{ fontSize: '1.5rem', fontWeight: '800' }}>200+</div><div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{t('home.babysitters')}</div></div>
              <div><div style={{ fontSize: '1.5rem', fontWeight: '800' }}>1K+</div><div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{t('home.bookings')}</div></div>
            </div>
          </div>
          <div style={{ flex: '0 0 320px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow-lg)', width: 280, color: 'var(--color-text)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.green})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.95rem' }}>SM</div>
                <div><div style={{ fontWeight: '700', fontSize: '0.95rem' }}>Sarah M.</div><div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Verified Babysitter</div></div>
              </div>
              <div style={{ color: COLORS.amber, fontSize: '0.9rem', marginBottom: 8 }}>{String.fromCodePoint(9733)}{String.fromCodePoint(9733)}{String.fromCodePoint(9733)}{String.fromCodePoint(9733)}{String.fromCodePoint(9733)} 5.0</div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', marginBottom: 12, lineHeight: 1.5 }}>&ldquo;I love caring for children and have 5 years of experience.&rdquo;</p>
              <div style={{ fontWeight: '800', fontSize: '1.2rem', color: COLORS.primary }}>$15 <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>/hr</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="section">
        <h2 className="section-title">{t('home.how')}</h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { icon: String.fromCodePoint(128269), title: t('home.step1'), desc: t('home.step1desc'), color: COLORS.primary },
            { icon: String.fromCodePoint(128197), title: t('home.step2'), desc: t('home.step2desc'), color: COLORS.purple },
            { icon: String.fromCodePoint(10084), title: t('home.step3'), desc: t('home.step3desc'), color: COLORS.rose },
          ].map((step, i) => (
            <div key={i} style={{ ...stepCardStyle, animationDelay: `${i * 0.15}s` }} className="animate-slide-up">
              <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-md)', background: `linear-gradient(135deg, ${step.color}18, ${step.color}08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', margin: '0 auto 16px' }}>{step.icon}</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text)' }}>{step.title}</h3>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ROLES */}
      <section className="section">
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div className="animate-slide-up" style={{ ...stepCardStyle, background: `linear-gradient(135deg, ${COLORS.primary}08, ${COLORS.primary}03)`, border: `1px solid ${COLORS.primary}22`, textAlign: 'left', maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', fontWeight: '700', color: COLORS.primary }}>{t('home.forParents')}</h3>
            <p style={{ margin: '0 0 18px', color: 'var(--color-text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{t('home.parentDesc')}</p>
            <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryLight})`, color: '#fff', padding: '10px 22px', borderRadius: 'var(--radius)', fontWeight: '600', fontSize: '0.88rem', textDecoration: 'none' }}>{t('home.start')} {String.fromCodePoint(8594)}</Link>
          </div>
          <div className="animate-slide-up" style={{ ...stepCardStyle, background: `linear-gradient(135deg, ${COLORS.rose}08, ${COLORS.rose}03)`, border: `1px solid ${COLORS.rose}22`, textAlign: 'left', maxWidth: 400, animationDelay: '0.15s' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', fontWeight: '700', color: COLORS.rose }}>{t('home.forBabysitters')}</h3>
            <p style={{ margin: '0 0 18px', color: 'var(--color-text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{t('home.babysitterDesc')}</p>
            <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: `linear-gradient(135deg, ${COLORS.rose}, ${COLORS.purple})`, color: '#fff', padding: '10px 22px', borderRadius: 'var(--radius)', fontWeight: '600', fontSize: '0.88rem', textDecoration: 'none' }}>{t('home.start')} {String.fromCodePoint(8594)}</Link>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="section">
        <h2 className="section-title">{t('home.stats')}</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { num: '500+', label: t('home.parents'), color: COLORS.primary },
            { num: '200+', label: t('home.babysitters'), color: COLORS.purple },
            { num: '1000+', label: t('home.bookings'), color: COLORS.teal },
            { num: '50+', label: t('home.cities'), color: COLORS.amber },
          ].map((stat, i) => (
            <div key={i} className="animate-scale" style={{ ...statCardStyle, animationDelay: `${i * 0.1}s` }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: stat.color, marginBottom: 4 }}>{stat.num}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: '500' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section">
        <h2 className="section-title">What Parents Say</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { initials: 'ML', name: 'Maria L.', text: 'CareNest made it so easy to find a trusted babysitter for my daughter. The verification process gave me peace of mind.' },
            { initials: 'AK', name: 'Ahmed K.', text: 'I found a wonderful babysitter through CareNest who speaks both English and French. My kids love her!' },
            { initials: 'SB', name: 'Sophie B.', text: 'The booking process was seamless and the chat feature made communication so convenient. Highly recommended!' },
          ].map((t, i) => (
            <div key={i} className="animate-slide-up" style={{ ...testimonialCardStyle, animationDelay: `${i * 0.12}s` }}>
              <div style={{ color: COLORS.amber, fontSize: '0.95rem', marginBottom: 10 }}>{String.fromCodePoint(9733)}{String.fromCodePoint(9733)}{String.fromCodePoint(9733)}{String.fromCodePoint(9733)}{String.fromCodePoint(9733)}</div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 16px' }}>&ldquo;{t.text}&rdquo;</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${COLORS.primary}22, ${COLORS.purple}22)`, color: COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.82rem' }}>{t.initials}</div>
                <div><strong style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>{t.name}</strong><br /><span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Parent</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Home;
