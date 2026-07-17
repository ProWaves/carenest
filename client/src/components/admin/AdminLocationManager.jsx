// client/src/components/admin/AdminLocationManager.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import API from '../../api/axios';
import { useToast } from '../Toast';

function AdminLocationManager() {
  const { addToast } = useToast();
  const [babysitters, setBabysitters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBabysitter, setSelectedBabysitter] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const abortControllerRef = useRef(null);

  const loadBabysitters = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setLoading(true);
    setError(null);
    setRefreshing(true);
    
    try {
      console.log('📡 Fetching babysitter locations...');
      const res = await API.get('/admin/locations', {
        signal: controller.signal
      });
      
      console.log(`✅ Loaded ${res.data.length} babysitters`);
      setBabysitters(res.data);
      setError(null);
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        console.log('🔄 Request was cancelled');
        return;
      }
      
      console.error('❌ Load error:', error);
      setError(error.message || 'Failed to load babysitters');
      
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        addToast('Failed to load babysitters', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadBabysitters();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadBabysitters]);

  const toggleLocationSharing = async (userId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      console.log(`🔄 Toggling location sharing for user ${userId} to ${newStatus}`);
      
      await API.put(`/admin/locations/${userId}/toggle`, { is_sharing: newStatus });
      
      setBabysitters(prev => prev.map(bs => 
        bs.id === userId 
          ? { ...bs, is_sharing: newStatus, share_location: newStatus }
          : bs
      ));
      
      addToast(`Location sharing ${newStatus ? 'enabled' : 'disabled'}`, 'success');
    } catch (error) {
      console.error('❌ Toggle error:', error);
      addToast(error.response?.data?.error || 'Failed to toggle location sharing', 'error');
    }
  };

  const viewProfile = async (userId) => {
    try {
      console.log(`👤 Fetching profile for user ${userId}`);
      const res = await API.get(`/admin/locations/${userId}`);
      setSelectedBabysitter(res.data);
      setShowProfileModal(true);
    } catch (error) {
      console.error('❌ Profile error:', error);
      addToast('Failed to load profile', 'error');
    }
  };

  const filteredBabysitters = babysitters.filter(bs => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      bs.first_name?.toLowerCase().includes(search) ||
      bs.last_name?.toLowerCase().includes(search) ||
      bs.email?.toLowerCase().includes(search) ||
      bs.city?.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (bs) => {
    const isSharing = bs.is_sharing && bs.share_location;
    if (isSharing) {
      return <span className="badge badge-success">🟢 Sharing</span>;
    } else if (bs.is_sharing && !bs.share_location) {
      return <span className="badge badge-danger">🔴 Disabled by Admin</span>;
    } else {
      return <span className="badge badge-secondary">⚪ Off</span>;
    }
  };

  if (loading && !refreshing) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading babysitters...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h3>Failed to Load Data</h3>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button 
          onClick={loadBabysitters} 
          className="btn btn-primary"
          style={{ marginTop: '16px' }}
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  return (
    <div className="admin-location-manager">
      <div className="management-header">
        <h2>📍 Babysitter Location Management</h2>
        <div className="management-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search babysitters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            onClick={loadBabysitters} 
            className="btn btn-sm btn-outline"
            disabled={refreshing}
          >
            {refreshing ? '⏳' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat stat-primary">
          <span className="stat-number">{babysitters.length}</span>
          <span className="stat-label">Total Babysitters</span>
        </div>
        <div className="stat stat-success">
          <span className="stat-number">{babysitters.filter(b => b.is_sharing && b.share_location).length}</span>
          <span className="stat-label">Sharing Location</span>
        </div>
        <div className="stat stat-danger">
          <span className="stat-number">{babysitters.filter(b => b.is_sharing && !b.share_location).length}</span>
          <span className="stat-label">Disabled by Admin</span>
        </div>
        <div className="stat stat-secondary">
          <span className="stat-number">{babysitters.filter(b => !b.is_sharing).length}</span>
          <span className="stat-label">Location Off</span>
        </div>
      </div>

      <div className="babysitter-location-list">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Babysitter</th>
              <th>Location</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBabysitters.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-state">No babysitters found</td>
              </tr>
            ) : (
              filteredBabysitters.map((bs) => (
                <tr key={bs.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar-mini">
                        {bs.first_name?.[0]}{bs.last_name?.[0]}
                      </div>
                      <div>
                        <div className="user-name">{bs.first_name} {bs.last_name}</div>
                        <div className="user-email">{bs.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {bs.latitude && bs.longitude ? (
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {parseFloat(bs.latitude).toFixed(4)}, {parseFloat(bs.longitude).toFixed(4)}
                        </span>
                        <br />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {bs.city || 'Unknown'}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>No location set</span>
                    )}
                  </td>
                  <td>{getStatusBadge(bs)}</td>
                  <td>
                    {bs.location_updated_at ? (
                      <span style={{ fontSize: '12px' }}>
                        {new Date(bs.location_updated_at).toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Never</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => toggleLocationSharing(bs.id, bs.is_sharing && bs.share_location)}
                        className={`btn btn-sm ${bs.is_sharing && bs.share_location ? 'btn-danger' : 'btn-success'}`}
                      >
                        {bs.is_sharing && bs.share_location ? '🔴 Disable' : '🟢 Enable'}
                      </button>
                      <button
                        onClick={() => viewProfile(bs.id)}
                        className="btn btn-sm btn-outline"
                      >
                        👁️ View
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Profile Modal - Clean Design with Clear Text */}
      {showProfileModal && selectedBabysitter && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowProfileModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              animation: 'scaleIn 0.3s ease'
            }}
          >
            {/* Header - Clean white background */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
              borderRadius: '16px 16px 0 0'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '16px',
                  flexShrink: 0
                }}>
                  {selectedBabysitter.first_name?.[0]}{selectedBabysitter.last_name?.[0]}
                </div>
                <div>
                  <h3 style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#111827'
                  }}>
                    {selectedBabysitter.first_name} {selectedBabysitter.last_name}
                  </h3>
                  <span style={{
                    fontSize: '13px',
                    color: '#6b7280'
                  }}>
                    {selectedBabysitter.role || 'Babysitter'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowProfileModal(false)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: 'none',
                  background: '#f3f4f6',
                  color: '#6b7280',
                  fontSize: '22px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e5e7eb';
                  e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                ×
              </button>
            </div>

            {/* Body - Clean white background */}
            <div style={{
              padding: '24px',
              background: '#ffffff'
            }}>
              {/* Info Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '16px',
                marginBottom: '20px'
              }}>
                <div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                    marginBottom: '4px'
                  }}>Email</div>
                  <div style={{ 
                    fontWeight: '500',
                    color: '#111827',
                    fontSize: '14px',
                    wordBreak: 'break-all'
                  }}>{selectedBabysitter.email}</div>
                </div>
                <div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                    marginBottom: '4px'
                  }}>Phone</div>
                  <div style={{ 
                    fontWeight: '500',
                    color: '#111827',
                    fontSize: '14px'
                  }}>{selectedBabysitter.phone || 'Not provided'}</div>
                </div>
                <div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                    marginBottom: '4px'
                  }}>City</div>
                  <div style={{ 
                    fontWeight: '500',
                    color: '#111827',
                    fontSize: '14px'
                  }}>{selectedBabysitter.city || 'Not provided'}</div>
                </div>
                <div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                    marginBottom: '4px'
                  }}>Hourly Rate</div>
                  <div style={{ 
                    fontWeight: '700',
                    color: '#059669',
                    fontSize: '16px'
                  }}>${selectedBabysitter.hourly_rate || 0}/hr</div>
                </div>
                <div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                    marginBottom: '4px'
                  }}>Experience</div>
                  <div style={{ 
                    fontWeight: '500',
                    color: '#111827',
                    fontSize: '14px'
                  }}>{selectedBabysitter.experience_years || 0} years</div>
                </div>
                <div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                    marginBottom: '4px'
                  }}>Rating</div>
                  <div style={{ 
                    fontWeight: '600',
                    color: '#d97706',
                    fontSize: '14px'
                  }}>⭐ {parseFloat(selectedBabysitter.avg_rating || 0).toFixed(1)} ({selectedBabysitter.review_count || 0} reviews)</div>
                </div>
                <div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                    marginBottom: '4px'
                  }}>Profile Status</div>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: selectedBabysitter.status === 'approved' ? '#d1fae5' : selectedBabysitter.status === 'pending' ? '#fef3c7' : '#fee2e2',
                      color: selectedBabysitter.status === 'approved' ? '#065f46' : selectedBabysitter.status === 'pending' ? '#92400e' : '#991b1b'
                    }}>
                      {selectedBabysitter.status || 'Unknown'}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                    marginBottom: '4px'
                  }}>Verified</div>
                  <div style={{ 
                    fontWeight: '500',
                    fontSize: '14px',
                    color: selectedBabysitter.is_verified ? '#059669' : '#6b7280'
                  }}>
                    {selectedBabysitter.is_verified ? '✅ Verified' : '❌ Not Verified'}
                  </div>
                </div>
              </div>

              {/* Location Status - Clean card */}
              <div style={{ 
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                marginBottom: '16px'
              }}>
                <div style={{ 
                  fontSize: '11px', 
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '600',
                  marginBottom: '8px'
                }}>📍 Location Status</div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  flexWrap: 'wrap'
                }}>
                  {selectedBabysitter.is_sharing && selectedBabysitter.share_location ? (
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 14px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: '#d1fae5',
                      color: '#065f46'
                    }}>🟢 Sharing Location</span>
                  ) : selectedBabysitter.is_sharing && !selectedBabysitter.share_location ? (
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 14px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: '#fee2e2',
                      color: '#991b1b'
                    }}>🔴 Disabled by Admin</span>
                  ) : (
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 14px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: '#f3f4f6',
                      color: '#6b7280'
                    }}>⚪ Location Off</span>
                  )}
                  {selectedBabysitter.latitude && selectedBabysitter.longitude && (
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#6b7280',
                      fontFamily: 'monospace'
                    }}>
                      {parseFloat(selectedBabysitter.latitude).toFixed(4)}, {parseFloat(selectedBabysitter.longitude).toFixed(4)}
                    </span>
                  )}
                </div>
                {selectedBabysitter.location_updated_at && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#6b7280',
                    marginTop: '6px'
                  }}>
                    Last updated: {new Date(selectedBabysitter.location_updated_at).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Bio */}
              {selectedBabysitter.bio && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                    marginBottom: '4px'
                  }}>Bio</div>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '14px',
                    color: '#4b5563',
                    lineHeight: '1.6'
                  }}>
                    {selectedBabysitter.bio}
                  </p>
                </div>
              )}

              {/* Skills */}
              {selectedBabysitter.skills && selectedBabysitter.skills.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                    marginBottom: '6px'
                  }}>Skills</div>
                  <div style={{ 
                    display: 'flex', 
                    gap: '6px', 
                    flexWrap: 'wrap'
                  }}>
                    {selectedBabysitter.skills.map((skill, i) => (
                      <span 
                        key={i} 
                        style={{
                          padding: '4px 14px',
                          borderRadius: '20px',
                          background: '#eef2ff',
                          color: '#4f46e5',
                          fontSize: '12px',
                          fontWeight: '600',
                          border: '1px solid #c7d2fe'
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div style={{ 
                paddingTop: '16px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <div style={{ 
                  fontSize: '11px', 
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '600',
                  marginBottom: '10px'
                }}>Quick Actions</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      toggleLocationSharing(selectedBabysitter.id, selectedBabysitter.is_sharing && selectedBabysitter.share_location);
                      setShowProfileModal(false);
                    }}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: selectedBabysitter.is_sharing && selectedBabysitter.share_location ? '#ef4444' : '#10b981',
                      color: '#fff',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {selectedBabysitter.is_sharing && selectedBabysitter.share_location ? '🔴 Disable Sharing' : '🟢 Enable Sharing'}
                  </button>
                  <button
                    onClick={() => {
                      window.open(`/babysitters/${selectedBabysitter.id}`, '_blank');
                    }}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      background: '#ffffff',
                      color: '#4b5563',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#6366f1';
                      e.currentTarget.style.color = '#6366f1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.color = '#4b5563';
                    }}
                  >
                    🔗 View Public Profile
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              background: '#f8fafc',
              borderRadius: '0 0 16px 16px'
            }}>
              <button 
                onClick={() => setShowProfileModal(false)}
                style={{
                  padding: '8px 24px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  background: '#ffffff',
                  color: '#4b5563',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#6366f1';
                  e.currentTarget.style.color = '#6366f1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.color = '#4b5563';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminLocationManager;