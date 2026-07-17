// client/src/components/BabysitterLocation.jsx
import React, { useState, useEffect } from 'react';
import API from '../api/axios';
import { useToast } from './Toast';

function BabysitterLocation() {
  const { addToast } = useToast();
  const [location, setLocation] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [adminDisabled, setAdminDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [watchId, setWatchId] = useState(null);

  useEffect(() => {
    loadLocationSettings();
    
    // Cleanup location watch on unmount
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Load current location settings
  const loadLocationSettings = async () => {
    try {
      setLoading(true);
      const res = await API.get('/babysitters/location/me');
      setLocation(res.data);
      setIsSharing(res.data.is_sharing || false);
      setAdminDisabled(res.data.admin_disabled || false);
    } catch (error) {
      console.error('Load location error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get current position
  const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          let message = 'Unable to get your location.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Location permission denied. Please enable location access in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              message = 'Location request timed out. Please try again.';
              break;
          }
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  // Update location on server
  const updateLocation = async (latitude, longitude, sharing) => {
    try {
      setUpdating(true);
      const res = await API.post('/babysitters/location', {
        latitude,
        longitude,
        is_sharing: sharing,
      });
      
      setLocation(res.data.location || { latitude, longitude, is_sharing: sharing });
      setIsSharing(res.data.location?.is_sharing || sharing);
      setAdminDisabled(res.data.location?.admin_disabled || false);
      
      if (res.data.location?.admin_disabled) {
        addToast('Location sharing has been disabled by admin.', 'warning');
      } else {
        addToast('Location updated successfully!', 'success');
      }
    } catch (error) {
      console.error('Update location error:', error);
      if (error.response?.data?.admin_disabled) {
        addToast('Location sharing has been disabled by admin. Please contact support.', 'error');
        setAdminDisabled(true);
      } else {
        addToast(error.response?.data?.error || 'Failed to update location.', 'error');
      }
    } finally {
      setUpdating(false);
    }
  };

  // Toggle location sharing
  const toggleSharing = async () => {
    if (adminDisabled) {
      addToast('Location sharing has been disabled by admin. Please contact support.', 'error');
      return;
    }

    const newSharing = !isSharing;
    
    if (newSharing) {
      // If turning on, get current location first
      try {
        const position = await getCurrentPosition();
        await updateLocation(position.latitude, position.longitude, true);
        
        // Start watching position for updates
        if (navigator.geolocation) {
          const id = navigator.geolocation.watchPosition(
            async (pos) => {
              // Update location every 30 seconds or when significant change
              if (pos.coords.accuracy < 100) {
                await updateLocation(
                  pos.coords.latitude,
                  pos.coords.longitude,
                  true
                );
              }
            },
            (error) => {
              console.warn('Location watch error:', error);
            },
            { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
          );
          setWatchId(id);
        }
      } catch (error) {
        addToast(error.message, 'error');
        return;
      }
    } else {
      // If turning off, stop watching and update server
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      await updateLocation(location?.latitude || 0, location?.longitude || 0, false);
    }
  };

  // Manual location update (refresh)
  const refreshLocation = async () => {
    if (adminDisabled) {
      addToast('Location sharing has been disabled by admin.', 'warning');
      return;
    }

    try {
      const position = await getCurrentPosition();
      await updateLocation(position.latitude, position.longitude, isSharing);
      addToast('Location refreshed!', 'success');
    } catch (error) {
      addToast(error.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="location-loading">
        <div className="spinner"></div>
        <p>Loading location settings...</p>
      </div>
    );
  }

  return (
    <div className="babysitter-location">
      <div className="location-header">
        <h3>📍 Location Sharing</h3>
        <p className="location-subtitle">
          Share your location so parents can find you nearby
        </p>
      </div>

      {adminDisabled && (
        <div className="alert alert-warning" style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
          ⚠️ Location sharing has been disabled by an administrator.
          <br />
          <small>Please contact support if you believe this is an error.</small>
        </div>
      )}

      <div className="location-status">
        <div className={`status-badge ${isSharing && !adminDisabled ? 'active' : 'inactive'}`}>
          {isSharing && !adminDisabled ? '🟢 Sharing Location' : adminDisabled ? '🔴 Disabled by Admin' : '🔴 Location Sharing Off'}
        </div>
        {location && isSharing && !adminDisabled && (
          <div className="location-coords">
            <span>📍 {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}</span>
            {location.location_updated_at && (
              <span className="location-time">
                Updated: {new Date(location.location_updated_at).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="location-actions">
        <button
          onClick={toggleSharing}
          disabled={updating || adminDisabled}
          className={`btn ${isSharing && !adminDisabled ? 'btn-danger' : 'btn-primary'}`}
        >
          {updating ? (
            <span className="spinner-small"></span>
          ) : isSharing && !adminDisabled ? (
            '🔴 Stop Sharing'
          ) : adminDisabled ? (
            '🔒 Disabled by Admin'
          ) : (
            '🟢 Start Sharing'
          )}
        </button>

        {isSharing && !adminDisabled && (
          <button
            onClick={refreshLocation}
            disabled={updating}
            className="btn btn-outline"
          >
            🔄 Refresh Location
          </button>
        )}
      </div>

      {isSharing && !adminDisabled && (
        <div className="location-info">
          <div className="info-item">
            <span className="info-icon">📡</span>
            <div>
              <strong>Live Updates</strong>
              <p>Your location updates automatically when you move</p>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">🔒</span>
            <div>
              <strong>Privacy</strong>
              <p>Only parents searching nearby will see your approximate location</p>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">⏱️</span>
            <div>
              <strong>Last Updated</strong>
              <p>{location?.location_updated_at ? new Date(location.location_updated_at).toLocaleString() : 'Never'}</p>
            </div>
          </div>
        </div>
      )}

      {adminDisabled && (
        <div className="location-info" style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '16px' }}>
          <div className="info-item" style={{ background: 'rgba(239,68,68,0.05)' }}>
            <span className="info-icon">🛡️</span>
            <div>
              <strong>Admin Disabled</strong>
              <p>Your location sharing has been turned off by an administrator. Please contact support for assistance.</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .babysitter-location {
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          padding: 24px;
          border: 1px solid var(--color-border-light);
        }

        .location-header {
          margin-bottom: 20px;
        }

        .location-header h3 {
          margin: 0;
          font-size: 1.2rem;
          color: var(--color-text);
        }

        .location-subtitle {
          margin: 4px 0 0;
          color: var(--color-text-muted);
          font-size: 0.9rem;
        }

        .location-status {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: var(--color-bg-alt);
          border-radius: var(--radius);
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .status-badge {
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 0.85rem;
        }

        .status-badge.active {
          background: #d1fae5;
          color: #065f46;
        }

        .status-badge.inactive {
          background: #fee2e2;
          color: #991b1b;
        }

        [data-theme="dark"] .status-badge.active {
          background: rgba(16, 185, 129, 0.2);
          color: #6ee7b7;
        }

        [data-theme="dark"] .status-badge.inactive {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }

        .location-coords {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 0.85rem;
          color: var(--color-text-secondary);
        }

        .location-time {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .location-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .location-actions .btn {
          padding: 10px 20px;
          font-weight: 600;
        }

        .spinner-small {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .location-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid var(--color-border-light);
        }

        .info-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: var(--color-bg-alt);
          border-radius: var(--radius);
        }

        .info-icon {
          font-size: 1.2rem;
          flex-shrink: 0;
        }

        .info-item strong {
          display: block;
          font-size: 0.85rem;
          color: var(--color-text);
        }

        .info-item p {
          margin: 2px 0 0;
          font-size: 0.8rem;
          color: var(--color-text-muted);
        }

        .location-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px;
          color: var(--color-text-muted);
        }

        .location-loading .spinner {
          margin-bottom: 12px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .location-status {
            flex-direction: column;
            align-items: stretch;
          }

          .location-info {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default BabysitterLocation;