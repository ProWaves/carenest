import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import { useLanguage } from '../context/LanguageContext';
import Rating from '../components/Rating';
import { SkeletonList } from '../components/Skeleton';
import BackButton from '../components/BackButton';
import AIChatbot from '../components/AIChatbot';
import AIMap from '../components/AIMap';

function FindBabysitters() {
  const [data, setData] = useState({ babysitters: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ city: '', min_rate: '', max_rate: '', search: '', sort: 'default' });
  const [page, setPage] = useState(1);
  const [cities, setCities] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    API.get('/cities').then((r) => setCities(r.data)).catch(() => {});
  }, []);

  const fetchBabysitters = async (params = {}, pageNum = 1) => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
      query.append('page', pageNum);
      query.append('limit', 12);
      const res = await API.get(`/babysitters?${query.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchBabysitters(filters, page);
    }, 300);
    return () => clearTimeout(timeout);
  }, [filters, page]);

  const handleFilter = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  return (
    <div className="find-page">
      <BackButton label="← Back to Home" fallback="/" />

      {/* Gradient Hero */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #6366F1)', borderRadius: 'var(--radius-lg)', padding: '28px 32px', marginBottom: '24px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -40, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800' }}>{t('nav.find')}</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.9rem' }}>
              {String.fromCodePoint(128269)} {data.total > 0 ? `${data.total} babysitters available` : 'Search for babysitters'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setShowMap(!showMap)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
              {showMap ? String.fromCodePoint(128203) + ' List View' : String.fromCodePoint(128506) + ' Map View'}
            </button>
            <button onClick={() => setShowAIChat(!showAIChat)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: 'var(--radius)', border: 'none', background: '#fff', color: '#4F46E5', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
              {String.fromCodePoint(129302)} AI Help
            </button>
          </div>
        </div>
      </div>

      {/* AI Chat Panel */}
      {showAIChat && (
        <div style={{
          marginBottom: '20px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
          }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              🤖 AI Babysitter Finder
            </h4>
            <button
              onClick={() => setShowAIChat(false)}
              className="btn btn-sm btn-ghost"
              style={{ padding: '2px 8px', fontSize: '12px' }}
            >
              ✕
            </button>
          </div>
          <AIChatbot 
            isEmbedded={true} 
            onClose={() => setShowAIChat(false)}
            initialMessage="Help me find a babysitter. I need someone reliable and experienced."
          />
        </div>
      )}

      {/* Map View */}
      {showMap && (
        <div style={{ marginBottom: '24px' }}>
          <AIMap 
            onSelectBabysitter={(bs) => {
              window.location.href = `/babysitters/${bs.id}`;
            }}
          />
        </div>
      )}

      <div className="filter-bar">
        <div className="filter-group">
          <label>{String.fromCodePoint(128269)} {t('common.search')}</label>
          <input type="text" name="search" placeholder="Name or keyword..." value={filters.search} onChange={handleFilter} />
        </div>
        <div className="filter-group">
          <label>{String.fromCodePoint(128205)} {t('auth.city')}</label>
          <input type="text" name="city" placeholder="City..." value={filters.city} onChange={handleFilter} list="cities" />
          <datalist id="cities">
            {cities.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div className="filter-group">
          <label>{String.fromCodePoint(128176)} Min rate</label>
          <input type="number" name="min_rate" placeholder="0" value={filters.min_rate} onChange={handleFilter} min="0" />
        </div>
        <div className="filter-group">
          <label>{String.fromCodePoint(128176)} Max rate</label>
          <input type="number" name="max_rate" placeholder="100" value={filters.max_rate} onChange={handleFilter} min="0" />
        </div>
        <div className="filter-group">
          <label>{String.fromCodePoint(8645)} {t('common.sort')}</label>
          <select name="sort" value={filters.sort} onChange={handleFilter}>
            <option value="default">{t('common.all')}</option>
            <option value="rating">Top Rated</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="experience">Most Experienced</option>
          </select>
        </div>
        <div className="filter-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilters({ city: '', min_rate: '', max_rate: '', search: '', sort: 'default' }); setPage(1); }}>
            {String.fromCodePoint(10005)} Clear
          </button>
        </div>
      </div>

      <div className="results-header">
        <span className="results-count">
          {!loading && <span>Showing <strong>{data.babysitters.length}</strong> of <strong>{data.total}</strong> babysitters</span>}
        </span>
      </div>

      {loading ? (
        <SkeletonList count={6} />
      ) : data.babysitters.length === 0 ? (
        <div className="no-results">
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>{String.fromCodePoint(128269)}</div>
          <p>{t('common.noResults')}</p>
          <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => { setFilters({ city: '', min_rate: '', max_rate: '', search: '', sort: 'default' }); setPage(1); }}>
            {String.fromCodePoint(10005)} Clear Filters
          </button>
        </div>
      ) : (
        <>
          <div className="babysitter-grid">
            {data.babysitters.map((s) => (
              <Link to={`/babysitters/${s.id}`} key={s.id} className="babysitter-card">
                <div className="babysitter-card-header">
                  <div className="avatar">{s.first_name?.[0]}{s.last_name?.[0]}</div>
                  <div>
                    {s.is_verified ? (
                      <span className="badge badge-success">{String.fromCodePoint(10003)} {t('babysitter.verified')}</span>
                    ) : (
                      <span className="badge badge-warning">{t('babysitter.pending')}</span>
                    )}
                  </div>
                </div>
                <h3>{s.first_name} {s.last_name}</h3>
                <p className="city">
                  {String.fromCodePoint(128205)} {s.city || 'Unknown'}
                  {s.gender && <span> &middot; {s.gender === 'male' ? 'Male' : s.gender === 'female' ? 'Female' : s.gender}</span>}
                </p>
                <Rating value={parseFloat(s.avg_rating)} count={s.review_count} />
                {s.skills && s.skills.length > 0 && (
                  <div className="skills-tags">
                    {s.skills.slice(0, 3).map((skill, i) => (
                      <span key={i} className="skill-tag">{skill}</span>
                    ))}
                    {s.skills.length > 3 && <span className="skill-tag">+{s.skills.length - 3}</span>}
                  </div>
                )}
                <div className="card-details">
                  <span>{s.experience_years} {t('babysitter.experience')}</span>
                  <span className="rate">{parseFloat(s.hourly_rate || 0).toFixed(2)} <small>{t('common.dt')}</small></span>
                </div>
              </Link>
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{String.fromCodePoint(8592)}</button>
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>{String.fromCodePoint(8594)}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default FindBabysitters;