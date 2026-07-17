// client/src/components/admin/BabysitterManagement.jsx
import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useToast } from '../Toast';

function BabysitterManagement() {
  const [babysitters, setBabysitters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    loadBabysitters();
  }, [filter]);

  const loadBabysitters = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await API.get(`/admin/babysitters${params}`);
      setBabysitters(res.data);
    } catch (error) {
      addToast('Failed to load babysitters', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (userId, status) => {
    try {
      await API.put(`/admin/babysitters/${userId}/status`, { status });
      addToast(`Babysitter ${status} successfully`, 'success');
      loadBabysitters();
    } catch (error) {
      addToast('Failed to update status', 'error');
    }
  };

  const filteredBabysitters = babysitters.filter(bs => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      bs.first_name?.toLowerCase().includes(search) ||
      bs.last_name?.toLowerCase().includes(search) ||
      bs.email?.toLowerCase().includes(search)
    );
  });

  const filters = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: '⏳ Pending' },
    { value: 'approved', label: '✅ Approved' },
    { value: 'rejected', label: '❌ Rejected' },
  ];

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      approved: '#10b981',
      rejected: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading babysitters...</p>
      </div>
    );
  }

  return (
    <div className="babysitter-management">
      <div className="management-header">
        <h2>👶 Babysitter Management</h2>
        <div className="management-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search babysitters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-tabs">
        {filters.map(f => {
          const count = babysitters.filter(b => f.value === 'all' || b.status === f.value).length;
          return (
            <button
              key={f.value}
              className={`filter-tab ${filter === f.value ? 'active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="babysitter-list">
        {filteredBabysitters.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👶</div>
            <h3>No Babysitters Found</h3>
            <p>{searchTerm ? 'Try adjusting your search' : `No ${filter} babysitters available`}</p>
          </div>
        ) : (
          filteredBabysitters.map((bs) => (
            <div key={bs.id} className="babysitter-item">
              <div className="bs-info">
                <div className="bs-avatar">
                  {bs.first_name?.[0]}{bs.last_name?.[0]}
                </div>
                <div className="bs-details">
                  <div className="bs-header">
                    <h4>{bs.first_name} {bs.last_name}</h4>
                    <span 
                      className="status-badge" 
                      style={{ backgroundColor: getStatusColor(bs.status) }}
                    >
                      {bs.status}
                    </span>
                  </div>
                  <p className="bs-email">{bs.email}</p>
                  <div className="bs-meta">
                    <span>💰 ${bs.hourly_rate || 0}/hr</span>
                    <span>⭐ {bs.experience_years || 0} yrs exp</span>
                    <span>📍 {bs.city || 'No city'}</span>
                    {bs.is_verified && (
                      <span className="verified-badge">✅ Verified</span>
                    )}
                  </div>
                  {bs.bio && (
                    <p className="bs-bio">{bs.bio.substring(0, 150)}...</p>
                  )}
                </div>
                <div className="bs-actions">
                  {bs.status === 'pending' && (
                    <>
                      <button 
                        className="btn btn-approve"
                        onClick={() => updateStatus(bs.id, 'approved')}
                      >
                        ✓ Approve
                      </button>
                      <button 
                        className="btn btn-reject"
                        onClick={() => updateStatus(bs.id, 'rejected')}
                      >
                        ✗ Reject
                      </button>
                    </>
                  )}
                  {bs.status === 'approved' && (
                    <button 
                      className="btn btn-secondary"
                      onClick={() => updateStatus(bs.id, 'pending')}
                    >
                      ↻ Reset
                    </button>
                  )}
                  {bs.status === 'rejected' && (
                    <button 
                      className="btn btn-approve"
                      onClick={() => updateStatus(bs.id, 'pending')}
                    >
                      ↻ Reconsider
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default BabysitterManagement;