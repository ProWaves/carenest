// client/src/components/admin/UserManagement.jsx
import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useToast } from '../Toast';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const { addToast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/users');
      setUsers(res.data);
    } catch (error) {
      addToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId) => {
    try {
      const res = await API.put(`/admin/users/${userId}/toggle-status`);
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, is_active: res.data.is_active } : u
      ));
      addToast(`User ${res.data.is_active ? 'activated' : 'deactivated'}`, 'success');
    } catch (error) {
      addToast('Failed to toggle user status', 'error');
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      admin: 'badge-admin',
      parent: 'badge-parent',
      babysitter: 'badge-babysitter'
    };
    return <span className={`badge ${colors[role] || ''}`}>{role}</span>;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading users...</p>
      </div>
    );
  }

  const roles = ['all', 'admin', 'parent', 'babysitter'];

  return (
    <div className="user-management">
      <div className="management-header">
        <h2>👤 User Management</h2>
        <div className="management-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select 
            className="filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            {roles.map(role => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="user-list">
        <div className="user-stats">
          <span>Total: {users.length}</span>
          <span>Active: {users.filter(u => u.is_active).length}</span>
          <span>Inactive: {users.filter(u => !u.is_active).length}</span>
        </div>

        <table className="user-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>City</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div>
                        <div className="user-name">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="user-id">ID: {user.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>{getRoleBadge(user.role)}</td>
                  <td>{user.city || '—'}</td>
                  <td>
                    <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                      {user.is_active ? '✅ Active' : '❌ Inactive'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className={`btn ${user.is_active ? 'btn-deactivate' : 'btn-activate'}`}
                      onClick={() => toggleUserStatus(user.id)}
                    >
                      {user.is_active ? '🔒 Deactivate' : '🔓 Activate'}
                    </button>
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

export default UserManagement;