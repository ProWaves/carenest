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
      <div style={{
  background: `
  linear-gradient(135deg, rgba(79,70,229,0.85), rgba(124,58,237,0.85), rgba(99,102,241,0.85)),
  url('/babysitter.jpg') center 40% / 110% no-repeat
`,
  borderRadius: 'var(--radius-lg)',
  padding: '48px 40px 40px',
  marginBottom: '32px',
  color: '#fff',
  position: 'relative',
  overflow: 'hidden',
}}>
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

      {/* VALUES — image + word + description */}
      <section className="section">
  <h2 className="section-title">{t('home.values')}</h2>
  <p className="section-subtitle" style={{ marginBottom: '40px' }}>
    {t('home.valuesSubtitle')}
  </p>
  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
    {[
      {
        img: '/values/verified.jpg',
        icon: '🛡️',
        title: t('home.valueVerified'),
        desc: t('home.valueVerifiedDesc'),
        color: COLORS.primary,
      },
      {
        img: '/values/caring.jpg',
        icon: '💚',
        title: t('home.valueCaring'),
        desc: t('home.valueCaringDesc'),
        color: COLORS.teal,
      },
      {
        img: '/values/reliable.jpg',
        icon: '🕐',
        title: t('home.valueReliable'),
        desc: t('home.valueReliableDesc'),
        color: COLORS.purple,
      },
      {
        img: '/values/trusted.jpg',
        icon: '🏠',
        title: t('home.valueTrusted'),
        desc: t('home.valueTrustedDesc'),
        color: COLORS.amber,
      },
    ].map((v, i) => (
      <div
        key={i}
        className="animate-slide-up"
        style={{
          animationDelay: `${i * 0.12}s`,
          flex: '1 1 220px',
          maxWidth: '260px',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-light)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-6px)';
          e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }}
      >
        {/* Image with emoji fallback */}
        <div style={{
          width: '100%',
          aspectRatio: '1 / 1',
          background: `linear-gradient(135deg, ${v.color}22, ${v.color}08)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <img
            src={v.img}
            alt={v.title}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          {/* Fallback emoji — hidden when the image loads, visible when not */}
          <span style={{
            position: 'absolute',
            fontSize: '3.5rem',
            zIndex: -1,
          }}>
            {v.icon}
          </span>
        </div>

        {/* Text block */}
        <div style={{ padding: '20px 18px 24px', textAlign: 'center' }}>
          <div style={{
            fontSize: '1.15rem',
            fontWeight: '800',
            color: v.color,
            marginBottom: '8px',
            letterSpacing: '-0.01em',
          }}>
            {v.title}
          </div>
          <div style={{
            fontSize: '0.85rem',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
          }}>
            {v.desc}
          </div>
        </div>
      </div>
    ))}
  </div>
</section>
      

      {/* TESTIMONIALS */}
      {/* TESTIMONIALS — Quotes on the value of babysitting */}
<section className="section">
  <h2 className="section-title">{t('home.testimonialsTitle')}</h2>
  <p className="section-subtitle" style={{ marginBottom: '40px' }}>
    {t('home.testimonialsSubtitle')}
  </p>
  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
    {[
      {
        text: "Babysitting is the quiet profession that makes every other profession possible. Behind nearly every working parent, there is someone they trust with what matters most.",
        author: "— The SitterSpot team",
      },
      {
        text: "A babysitter isn't a replacement for a parent. They're the extra pair of hands, eyes, and heart that lets a parent breathe.",
        author: "— A mother of two",
      },
      {
        text: "The best babysitters don't just watch children — they remember their favorite snacks, their fears, their quiet habits. They become part of the family in ways you don't notice until they're gone.",
        author: "— Written by a former sitter",
      },
      {
        text: "Babysitting taught me more about responsibility, patience, and love than any job I've had since.",
        author: "— Unknown",
      },
    ].map((tst, i) => (
      <div
        key={i}
        className="animate-slide-up"
        style={{
          ...testimonialCardStyle,
          animationDelay: `${i * 0.12}s`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          paddingTop: '36px',
        }}
      >
        {/* Big decorative quote mark */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 12,
            left: 20,
            fontSize: '3rem',
            lineHeight: 1,
            color: 'var(--color-primary-200)',
            fontFamily: 'Georgia, serif',
            opacity: 0.6,
            userSelect: 'none',
          }}
        >
          &ldquo;
        </div>

        {/* Quote text */}
        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: '0.95rem',
            lineHeight: 1.75,
            margin: '0 0 20px',
            fontStyle: 'italic',
            flex: 1,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {tst.text}
        </p>

        {/* Attribution */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingTop: '14px',
            borderTop: '1px solid var(--color-border-light)',
          }}
        >
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: '600',
              color: 'var(--color-primary-600)',
              letterSpacing: '0.01em',
            }}
          >
            {tst.author}
          </span>
        </div>
      </div>
    ))}
  </div>
</section>
    </div>
  );
}

export default Home;
