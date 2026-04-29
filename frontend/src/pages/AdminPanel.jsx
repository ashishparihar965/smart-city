import { useState, useEffect } from 'react'
import { adminAPI, authAPI } from '../services/api'
import { useToast } from '../context/ToastContext'
import {
  Users, Shield, Search, RefreshCw, Plus, UserCheck, UserX, Mail, MapPin
} from 'lucide-react'

const AdminPanel = () => {
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'operator', department: 'general', zone: 'central' })
  const { addToast } = useToast()

  const fetchUsers = async () => {
    try {
      const res = await adminAPI.getUsers({ search, role: roleFilter })
      setUsers(res.data.data)
      setStats(res.data.stats)
    } catch (err) {
      console.error('Admin fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [search, roleFilter])

  const handleCreate = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      addToast('All fields required', 'error')
      return
    }
    try {
      await authAPI.createUser(newUser)
      addToast(`User ${newUser.email} created`, 'success')
      setShowCreate(false)
      setNewUser({ name: '', email: '', password: '', role: 'operator', department: 'general', zone: 'central' })
      fetchUsers()
    } catch (err) {
      addToast(err.response?.data?.message || 'Create failed', 'error')
    }
  }

  const handleToggleActive = async (user) => {
    try {
      await adminAPI.updateUser(user._id, { isActive: !user.isActive })
      addToast(`${user.name} ${user.isActive ? 'deactivated' : 'activated'}`, 'success')
      fetchUsers()
    } catch (err) {
      addToast(err.response?.data?.message || 'Update failed', 'error')
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await adminAPI.updateUser(userId, { role: newRole })
      addToast('Role updated', 'success')
      fetchUsers()
    } catch (err) {
      addToast(err.response?.data?.message || 'Update failed', 'error')
    }
  }

  if (loading) return <div className="loading-container" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1><Shield size={20} style={{ display: 'inline', marginRight: 8 }} />Admin Panel</h1>
          <p>User management and system administration</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> Create User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Total Users', value: stats.totalUsers || 0, color: '#3b82f6' },
          { label: 'Admins', value: stats.admins || 0, color: '#8b5cf6' },
          { label: 'Operators', value: stats.operators || 0, color: '#06b6d4' },
          { label: 'Citizens', value: stats.citizens || 0, color: '#10b981' },
          { label: 'Inactive', value: stats.inactive || 0, color: '#ef4444' },
        ].map((s) => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name or email..."
            style={{
              width: '100%', padding: '0.65rem 0.9rem 0.65rem 2.3rem',
              background: 'var(--bg-input)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.9rem'
            }}
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          style={{ padding: '0.65rem 0.9rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="operator">Operator</option>
          <option value="user">Citizen</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Zone</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} style={{ opacity: u.isActive ? 1 : 0.5 }}>
                <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--gradient-blue)', color: 'white', fontSize: '0.8rem', fontWeight: 700,
                  }}>
                    {u.name?.charAt(0).toUpperCase()}
                  </div>
                  {u.name}
                </td>
                <td style={{ fontSize: '0.85rem' }}><Mail size={12} style={{ marginRight: 4 }} />{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u._id, e.target.value)}
                    style={{
                      padding: '0.3rem 0.5rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                      borderRadius: 4, color: 'var(--text-primary)', fontSize: '0.8rem'
                    }}
                  >
                    <option value="admin">Admin</option>
                    <option value="operator">Operator</option>
                    <option value="user">Citizen</option>
                  </select>
                </td>
                <td><span className="badge badge-blue">{u.department || 'general'}</span></td>
                <td><MapPin size={12} style={{ marginRight: 2 }} />{u.zone || 'central'}</td>
                <td>
                  <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <button
                    className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-success'}`}
                    onClick={() => handleToggleActive(u)}
                  >
                    {u.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create User</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label>Name</label>
                <input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Email</label>
                <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label>Role</label>
                  <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                    <option value="admin">Admin</option>
                    <option value="operator">Operator</option>
                    <option value="user">Citizen</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Department</label>
                  <select value={newUser.department} onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}>
                    {['general', 'traffic', 'waste', 'water', 'lighting', 'emergency'].map((d) => (
                      <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="input-group">
                <label>Zone</label>
                <select value={newUser.zone} onChange={(e) => setNewUser({ ...newUser, zone: e.target.value })}>
                  {['central', 'north', 'south', 'east', 'west'].map((z) => (
                    <option key={z} value={z}>{z.charAt(0).toUpperCase() + z.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}>Create User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPanel
