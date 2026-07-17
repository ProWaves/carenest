// client/src/components/admin/BookingManagement.jsx
import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useToast } from '../Toast';

function BookingManagement() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/bookings');
      setBookings(res.data);
    } catch (error) {
      addToast('Failed to load bookings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      in_progress: '#8b5cf6',
      completed: '#10b981',
      cancelled: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.parent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.babysitter_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || booking.status === filter;
    return matchesSearch && matchesFilter;
  });

  const statuses = ['all', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading bookings...</p>
      </div>
    );
  }

  return (
    <div className="booking-management">
      <div className="management-header">
        <h2>📅 Booking Management</h2>
        <div className="management-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select 
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {statuses.map(status => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="booking-stats">
        <span>Total: {bookings.length}</span>
        <span>Completed: {bookings.filter(b => b.status === 'completed').length}</span>
        <span>Cancelled: {bookings.filter(b => b.status === 'cancelled').length}</span>
      </div>

      <div className="booking-list">
        <table className="booking-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Parent</th>
              <th>Babysitter</th>
              <th>Date</th>
              <th>Hours</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  No bookings found
                </td>
              </tr>
            ) : (
              filteredBookings.map((booking) => (
                <tr key={booking.id}>
                  <td>#{booking.id}</td>
                  <td>{booking.parent_name || 'N/A'}</td>
                  <td>{booking.babysitter_name || 'N/A'}</td>
                  <td>
                    {booking.start_date && (
                      <>
                        {new Date(booking.start_date).toLocaleDateString()}
                        <br />
                        <small>
                          {booking.start_time} - {booking.end_time}
                        </small>
                      </>
                    )}
                  </td>
                  <td>{booking.total_hours || 0}h</td>
                  <td>${booking.total_amount || 0}</td>
                  <td>
                    <span 
                      className="status-badge" 
                      style={{ backgroundColor: getStatusColor(booking.status) }}
                    >
                      {booking.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BookingManagement;