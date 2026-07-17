// client/src/components/admin/AdminStats.jsx
import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useToast } from '../Toast';

function AdminStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/stats');
      setStats(res.data);
    } catch (error) {
      addToast('Failed to load statistics', 'error');
      console.error('Stats error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="stats-loading">
        <div className="spinner"></div>
        <p>Loading dashboard statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="stats-error">
        <p>Failed to load statistics. Please try again.</p>
        <button className="btn btn-primary" onClick={loadStats}>Retry</button>
      </div>
    );
  }

  const statCards = [
    { 
      label: '👤 Total Users', 
      value: stats.totalUsers,
      color: '#4f46e5',
      change: '+12%'
    },
    { 
      label: '👶 Babysitters', 
      value: stats.totalBabysitters,
      color: '#10b981',
      change: '+8%'
    },
    { 
      label: '⏳ Pending Approvals', 
      value: stats.pendingApprovals,
      color: '#f59e0b',
      change: stats.pendingApprovals > 0 ? '⚠️ Action needed' : '✅ All clear'
    },
    { 
      label: '📅 Total Bookings', 
      value: stats.totalBookings,
      color: '#6366f1',
      change: '+15%'
    },
    { 
      label: '💰 Total Revenue', 
      value: `$${parseFloat(stats.totalRevenue || 0).toFixed(2)}`,
      color: '#22c55e',
      change: '+23%'
    },
    { 
      label: '📊 Monthly Revenue', 
      value: `$${parseFloat(stats.monthlyRevenue || 0).toFixed(2)}`,
      color: '#8b5cf6',
      change: '+5%'
    },
  ];

  return (
    <div className="admin-stats">
      <div className="stats-header">
        <h2>📊 Platform Overview</h2>
        <span className="stats-updated">
          Updated: {new Date().toLocaleTimeString()}
        </span>
      </div>

      <div className="stats-grid">
        {statCards.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">{stat.label}</span>
              <span className="stat-change" style={{ color: stat.color }}>
                {stat.change}
              </span>
            </div>
            <div className="stat-value" style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Additional Stats */}
      <div className="stats-extra">
        <div className="stats-extra-card">
          <h4>📈 Cancellation Rate</h4>
          <p className="extra-value">{stats.cancellationRate || 0}%</p>
          <p className="extra-sub">of all bookings</p>
        </div>
        <div className="stats-extra-card">
          <h4>⭐ Average Rating</h4>
          <p className="extra-value">
            {stats.averageBookingValue ? `$${stats.averageBookingValue.toFixed(2)}` : 'N/A'}
          </p>
          <p className="extra-sub">per booking</p>
        </div>
        <div className="stats-extra-card">
          <h4>📊 Monthly Bookings</h4>
          <p className="extra-value">
            {stats.monthlyBookings?.length || 0}
          </p>
          <p className="extra-sub">in the last 6 months</p>
        </div>
      </div>

      {/* Top Babysitters */}
      {stats.topBabysitters && stats.topBabysitters.length > 0 && (
        <div className="stats-section">
          <h3>🏆 Top Babysitters</h3>
          <div className="top-babysitters">
            {stats.topBabysitters.map((bs, index) => (
              <div key={bs.id} className="top-babysitter-item">
                <span className="rank">{index + 1}</span>
                <span className="name">{bs.first_name} {bs.last_name}</span>
                <span className="bookings">{bs.completed} bookings</span>
                <span className="revenue">${parseFloat(bs.revenue || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {stats.recentActivity && stats.recentActivity.length > 0 && (
        <div className="stats-section">
          <h3>🔄 Recent Activity</h3>
          <div className="recent-activity">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="activity-item">
                <span className="activity-users">
                  {activity.pfirst} {activity.plast} → {activity.sfirst} {activity.slast}
                </span>
                <span className={`activity-status ${activity.status}`}>
                  {activity.status}
                </span>
                <span className="activity-amount">
                  ${activity.total_amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminStats;