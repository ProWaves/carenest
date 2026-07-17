// client/src/components/AIMap.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';

// Google Maps API Key - you'll need to add this to your .env file
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Default to Beirut, Lebanon instead of Tunis
const DEFAULT_LOCATION = {
  lat: 33.8938,  // Beirut, Lebanon
  lng: 35.5018,
};

function AIMap({ onSelectBabysitter, showNearby = true, initialLat, initialLng }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const circleRef = useRef(null);
  const infoWindowRef = useRef(null);
  const [babysitters, setBabysitters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBabysitter, setSelectedBabysitter] = useState(null);
  const [userLocation, setUserLocation] = useState({
    lat: initialLat || DEFAULT_LOCATION.lat,
    lng: initialLng || DEFAULT_LOCATION.lng,
  });
  const [radius, setRadius] = useState(10);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [locationAttempts, setLocationAttempts] = useState(0);

  // Load Google Maps script
  useEffect(() => {
    // If API key is not set, show a message
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('Google Maps API key is not set. Please add VITE_GOOGLE_MAPS_API_KEY to your .env file');
      setLoading(false);
      setApiError('API_KEY_MISSING');
      return;
    }

    // Check if script is already loaded
    if (document.querySelector('#google-maps-script')) {
      setScriptLoaded(true);
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setScriptLoaded(true);
      setMapLoaded(true);
      setApiError(null);
    };
    script.onerror = () => {
      console.error('Failed to load Google Maps script');
      setLoading(false);
      setApiError('SCRIPT_LOAD_FAILED');
      addToast('Failed to load map. Please try again.', 'error');
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup markers when component unmounts
      markersRef.current.forEach(m => {
        if (m && m.setMap) m.setMap(null);
      });
      if (userMarkerRef.current && userMarkerRef.current.setMap) {
        userMarkerRef.current.setMap(null);
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
      // Stop watching location
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Get user location with better error handling
  const getUserLocation = useCallback(() => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('Geolocation not supported');
        resolve({
          lat: DEFAULT_LOCATION.lat,
          lng: DEFAULT_LOCATION.lng,
          error: 'Geolocation not supported'
        });
        return;
      }

      // Try with high accuracy first
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ Location obtained:', position.coords.latitude, position.coords.longitude);
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          console.warn('⚠️ Geolocation error:', error.message);
          
          // Try again with lower accuracy if it was a timeout
          if (error.code === 3 && locationAttempts < 2) {
            setLocationAttempts(prev => prev + 1);
            navigator.geolocation.getCurrentPosition(
              (position) => {
                console.log('✅ Location obtained (retry):', position.coords.latitude, position.coords.longitude);
                resolve({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                });
              },
              (err) => {
                console.warn('⚠️ Geolocation retry failed:', err.message);
                resolve({
                  lat: DEFAULT_LOCATION.lat,
                  lng: DEFAULT_LOCATION.lng,
                  error: err.message,
                });
              },
              { enableHighAccuracy: false, timeout: 10000 }
            );
          } else {
            resolve({
              lat: DEFAULT_LOCATION.lat,
              lng: DEFAULT_LOCATION.lng,
              error: error.message,
            });
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  }, [locationAttempts]);

  // Set up location tracking
  useEffect(() => {
    // Only parents should share location to find babysitters
    if (user?.role !== 'parent') return;

    const setupLocation = async () => {
      // Check permission status
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        setLocationPermission(permission.state);
        
        if (permission.state === 'granted') {
          const position = await getUserLocation();
          if (position && !position.error) {
            setUserLocation({ lat: position.lat, lng: position.lng });
            startLocationTracking();
          }
        } else if (permission.state === 'prompt') {
          // Try to get location (this will trigger permission prompt)
          const position = await getUserLocation();
          if (position && !position.error) {
            setUserLocation({ lat: position.lat, lng: position.lng });
            setLocationPermission('granted');
            startLocationTracking();
          } else {
            addToast('Unable to get your location. Using default location.', 'info');
          }
        } else {
          setLocationPermission('denied');
          addToast('Please enable location access to find babysitters near you.', 'warning');
        }
      } catch (error) {
        console.warn('Location permission check error:', error);
        // Try to get location anyway
        const position = await getUserLocation();
        if (position && !position.error) {
          setUserLocation({ lat: position.lat, lng: position.lng });
        }
      }
    };

    setupLocation();
  }, [user, getUserLocation, addToast]);

  // Start location tracking for parents
  const startLocationTracking = () => {
    if (!navigator.geolocation) return;

    // Send initial location to server
    if (user?.role === 'parent' && userLocation.lat && userLocation.lng) {
      API.post('/babysitters/location', {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      }).catch(console.error);
    }

    // Start watching position for real-time updates
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const newLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(newLoc);
        
        // Update location on server periodically
        if (user?.role === 'parent') {
          API.post('/babysitters/location', {
            latitude: newLoc.lat,
            longitude: newLoc.lng,
          }).catch(console.error);
        }
        
        // Refetch nearby babysitters when location changes
        if (mapInstanceRef.current) {
          fetchNearbyBabysitters();
        }
      },
      (error) => {
        console.warn('Location watch error:', error);
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
    );
    setWatchId(id);
  };

  // Fetch nearby babysitters
  const fetchNearbyBabysitters = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      console.log('📍 Fetching babysitters near:', userLocation.lat, userLocation.lng);
      
      const res = await API.get('/babysitters/nearby', {
        params: {
          lat: userLocation.lat,
          lng: userLocation.lng,
          radius: radius,
          limit: 50,
        },
      });
      
      console.log('📊 Response:', res.data);
      
      // Check if response has a message about missing data
      if (res.data.message) {
        addToast(res.data.message, 'info');
        setBabysitters([]);
        setApiError('NO_DATA');
      } else {
        const babysittersData = res.data.babysitters || [];
        setBabysitters(babysittersData);
        updateMapMarkers(babysittersData);
        if (babysittersData.length === 0) {
          addToast('No babysitters found in this area. Try increasing the radius.', 'info');
        }
      }
    } catch (error) {
      console.error('❌ Fetch nearby babysitters error:', error);
      
      // Handle specific error types
      if (error.response?.status === 500) {
        setApiError('SERVER_ERROR');
        addToast('Map service is being set up. Please try again later.', 'info');
      } else if (error.response?.status === 400) {
        setApiError('INVALID_LOCATION');
        addToast('Invalid location. Please check your position.', 'error');
      } else if (error.code === 'ERR_NETWORK') {
        setApiError('NETWORK_ERROR');
        addToast('Network error. Please check your connection.', 'error');
      } else {
        setApiError('UNKNOWN_ERROR');
        addToast('Failed to load nearby babysitters.', 'error');
      }
      setBabysitters([]);
    } finally {
      setLoading(false);
    }
  }, [userLocation, radius, addToast]);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !window.google || !mapRef.current) return;

    try {
      const map = new window.google.maps.Map(mapRef.current, {
        center: userLocation,
        zoom: 13,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
          {
            featureType: 'transit',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      mapInstanceRef.current = map;

      // Create info window
      infoWindowRef.current = new window.google.maps.InfoWindow({
        maxWidth: 320,
      });

      // Add user marker
      const userMarker = new window.google.maps.Marker({
        position: userLocation,
        map: map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#4f46e5',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 4,
        },
        title: 'Your Location',
        zIndex: 1000,
        animation: window.google.maps.Animation.DROP,
      });
      userMarkerRef.current = userMarker;

      // Add circle for search radius
      const circle = new window.google.maps.Circle({
        map: map,
        radius: radius * 1000,
        fillColor: '#4f46e5',
        fillOpacity: 0.08,
        strokeColor: '#4f46e5',
        strokeOpacity: 0.3,
        strokeWeight: 2,
        zIndex: 0,
      });
      circle.bindTo('center', userMarker, 'position');
      circleRef.current = circle;

      // Fetch babysitters after map is ready
      fetchNearbyBabysitters();
    } catch (error) {
      console.error('Map initialization error:', error);
      setApiError('MAP_INIT_ERROR');
      addToast('Failed to initialize map.', 'error');
    }

    return () => {
      markersRef.current.forEach(m => {
        if (m && m.setMap) m.setMap(null);
      });
      markersRef.current = [];
      if (userMarkerRef.current && userMarkerRef.current.setMap) {
        userMarkerRef.current.setMap(null);
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
    };
  }, [mapLoaded, userLocation, radius, fetchNearbyBabysitters]);

  // Update map markers
  const updateMapMarkers = useCallback((babysittersData) => {
    if (!mapInstanceRef.current || !window.google) return;

    markersRef.current.forEach(m => {
      if (m && m.setMap) m.setMap(null);
    });
    markersRef.current = [];

    if (!babysittersData || babysittersData.length === 0) return;

    try {
      babysittersData.forEach((bs) => {
        if (!bs.latitude || !bs.longitude) return;

        const lat = parseFloat(bs.latitude);
        const lng = parseFloat(bs.longitude);
        
        if (isNaN(lat) || isNaN(lng)) return;

        const isFresh = bs.location_freshness === 'fresh' || 
                        (bs.location_updated_minutes_ago !== null && bs.location_updated_minutes_ago < 30);
        const isStale = !isFresh && bs.location_updated_minutes_ago !== null;

        let markerColor;
        if (bs.is_verified) {
          markerColor = '#10b981';
        } else if (isFresh) {
          markerColor = '#6366f1';
        } else if (isStale) {
          markerColor = '#f59e0b';
        } else {
          markerColor = '#94a3b8';
        }

        const markerSize = bs.is_verified ? 46 : 40;

        const marker = new window.google.maps.Marker({
          position: { lat, lng },
          map: mapInstanceRef.current,
          animation: window.google.maps.Animation.DROP,
          icon: {
            url: `data:image/svg+xml,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="${markerSize}" height="${markerSize}" viewBox="0 0 ${markerSize} ${markerSize}">
                <defs>
                  <filter id="glow-${bs.id}">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <circle cx="${markerSize/2}" cy="${markerSize/2}" r="${markerSize/2 - 2}" fill="${markerColor}" stroke="white" stroke-width="2" filter="${isFresh ? 'url(#glow-' + bs.id + ')' : ''}"/>
                <text x="${markerSize/2}" y="${markerSize/2 + 6}" font-size="${markerSize > 40 ? 18 : 14}" text-anchor="middle" fill="white" font-weight="bold" font-family="Arial">${bs.first_name ? bs.first_name[0] : ''}${bs.last_name ? bs.last_name[0] : ''}</text>
                ${bs.is_verified ? `<circle cx="${markerSize - 10}" cy="10" r="6" fill="#10b981" stroke="white" stroke-width="1.5"/>` : ''}
              </svg>
            `)}`,
            scaledSize: new window.google.maps.Size(markerSize, markerSize),
            anchor: new window.google.maps.Point(markerSize/2, markerSize/2),
          },
          title: `${bs.first_name || ''} ${bs.last_name || ''} - ${bs.distance_km || '?'}km away`,
          zIndex: bs.is_verified ? 100 : 50,
        });

        const statusColor = isFresh ? '#10b981' : isStale ? '#f59e0b' : '#94a3b8';
        const statusText = isFresh ? '🟢 Online now' : isStale ? `🟡 Last seen ${bs.location_updated_minutes_ago} min ago` : '📍 Location unknown';
        const distanceDisplay = bs.distance_km ? `${bs.distance_km} km away` : 'Distance unknown';

        const content = `
          <div style="padding: 8px 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 200px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; flex-shrink: 0;">
                ${bs.first_name ? bs.first_name[0] : ''}${bs.last_name ? bs.last_name[0] : ''}
              </div>
              <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 15px; color: #1e293b;">${bs.first_name || ''} ${bs.last_name || ''}</div>
                <div style="font-size: 12px; color: #64748b;">${distanceDisplay}</div>
                <div style="font-size: 11px; color: ${statusColor}; margin-top: 2px; font-weight: 500;">${statusText}</div>
              </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;">
              <span style="background: #f1f5f9; padding: 2px 10px; border-radius: 12px; font-size: 12px;">⭐ ${bs.avg_rating ? bs.avg_rating.toFixed(1) : '0.0'}</span>
              <span style="background: #f1f5f9; padding: 2px 10px; border-radius: 12px; font-size: 12px;">$${bs.hourly_rate || 0}/hr</span>
              ${bs.is_verified ? '<span style="background: #d1fae5; padding: 2px 10px; border-radius: 12px; font-size: 12px; color: #065f46;">✅ Verified</span>' : ''}
              ${bs.experience_years > 0 ? `<span style="background: #e0e7ff; padding: 2px 10px; border-radius: 12px; font-size: 12px; color: #4f46e5;">${bs.experience_years} yrs</span>` : ''}
            </div>
            <button onclick="window.selectBabysitter('${bs.id}')" style="width: 100%; padding: 8px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; transition: transform 0.2s; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);">
              📅 View Profile
            </button>
          </div>
        `;

        marker.addListener('click', () => {
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(content);
            infoWindowRef.current.open(mapInstanceRef.current, marker);
            setSelectedBabysitter(bs);
          }
        });

        markersRef.current.push(marker);
      });
    } catch (error) {
      console.error('Error updating markers:', error);
    }
  }, []);

  // Handle babysitter selection
  useEffect(() => {
    window.selectBabysitter = (id) => {
      const bs = babysitters.find(b => b.id === parseInt(id));
      if (bs && onSelectBabysitter) {
        if (infoWindowRef.current) {
          infoWindowRef.current.close();
        }
        onSelectBabysitter(bs);
      }
    };
    return () => { delete window.selectBabysitter; };
  }, [babysitters, onSelectBabysitter]);

  // Center map on user location
  const centerOnUser = () => {
    if (mapInstanceRef.current && userLocation) {
      mapInstanceRef.current.panTo(userLocation);
      mapInstanceRef.current.setZoom(14);
      addToast('📍 Centered on your location', 'info');
    }
  };

  // Refresh nearby babysitters
  const refreshBabysitters = () => {
    fetchNearbyBabysitters();
    addToast('🔄 Refreshing nearby babysitters...', 'info');
  };

  // Handle radius change
  const handleRadiusChange = (e) => {
    const newRadius = parseInt(e.target.value);
    setRadius(newRadius);
    if (circleRef.current) {
      circleRef.current.setRadius(newRadius * 1000);
    }
  };

  // If Google Maps API key is not set
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div style={{ 
        width: '100%', 
        height: '400px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
        <h3>Map Unavailable</h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px' }}>
          Please add your Google Maps API key to the .env file:
          <br />
          <code style={{ background: 'var(--bg-card)', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '8px' }}>
            VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
          </code>
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
          You can still browse babysitters in list view.
        </p>
      </div>
    );
  }

  // Loading state
  if (!mapLoaded) {
    return (
      <div style={{ 
        width: '100%', 
        height: '400px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
      }}>
        <div className="loading-container">
          <div className="spinner"></div>
          <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Map Controls */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 10,
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={centerOnUser}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          📍 My Location
        </button>
        <select
          value={radius}
          onChange={handleRadiusChange}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            color: 'var(--text)',
          }}
        >
          <option value={5}>5 km</option>
          <option value={10}>10 km</option>
          <option value={20}>20 km</option>
          <option value={50}>50 km</option>
          <option value={100}>100 km</option>
        </select>
        <button
          onClick={refreshBabysitters}
          disabled={loading}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: loading ? 'var(--text-muted)' : 'var(--primary)',
            color: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: '500',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
        {user?.role === 'parent' && (
          <span style={{
            padding: '6px 14px',
            borderRadius: '8px',
            background: locationPermission === 'granted' ? '#d1fae5' : '#fee2e2',
            color: locationPermission === 'granted' ? '#065f46' : '#991b1b',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            {locationPermission === 'granted' ? '📍 Live' : '📍 Location Off'}
          </span>
        )}
      </div>

      {/* Info Panel */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        background: 'rgba(255,255,255,0.95)',
        padding: '8px 20px',
        borderRadius: '12px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        gap: '24px',
        alignItems: 'center',
        fontSize: '13px',
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.2)',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>📍</span> 
          <strong>{babysitters.length}</strong> babysitters nearby
        </span>
        {selectedBabysitter && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
            <strong>{selectedBabysitter.first_name}</strong>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span>{selectedBabysitter.distance_km || '?'}km away</span>
            {selectedBabysitter.is_verified && (
              <span style={{ color: '#10b981', fontSize: '12px' }}>✅</span>
            )}
          </span>
        )}
        {loading && <span className="loading-dots" style={{ color: 'var(--text-muted)' }}>Loading...</span>}
      </div>

      {/* Google Map */}
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '500px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}
      />

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: '70px',
        right: '12px',
        zIndex: 10,
        background: 'rgba(255,255,255,0.95)',
        padding: '10px 14px',
        borderRadius: '10px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        fontSize: '11px',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.2)',
        minWidth: '100px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#10b981', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }} />
          <span>Verified</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0', marginTop: '4px' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#6366f1', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }} />
          <span>Unverified</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0', marginTop: '4px' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#4f46e5', border: '2px solid white', boxShadow: '0 0 0 2px #4f46e5' }} />
          <span>Your Location</span>
        </div>
      </div>

      {/* Map Attribution */}
      <div style={{
        position: 'absolute',
        bottom: '4px',
        right: '12px',
        zIndex: 10,
        fontSize: '10px',
        color: 'rgba(0,0,0,0.3)',
        background: 'rgba(255,255,255,0.5)',
        padding: '2px 8px',
        borderRadius: '4px',
      }}>
        Powered by Google Maps
      </div>
    </div>
  );
}

export default AIMap;