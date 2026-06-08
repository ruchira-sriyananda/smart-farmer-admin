import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function MobileUsers() {
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showBanModal, setShowBanModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    banned: 0,
    farmers: 0,
    vendors: 0,
    newToday: 0,
    verified: 0,
    pending: 0
  })
  const [debugInfo, setDebugInfo] = useState(null)

  useEffect(() => {
    checkAndInsertSampleData()
    fetchUsers()
    fetchStats()
    
    // Subscribe to real-time changes
    const subscription = supabase
      .channel('mobile_users_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'users' },
        () => {
          fetchUsers()
          fetchStats()
        }
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [])

  // Function to check and insert sample data
  const checkAndInsertSampleData = async () => {
    try {
      // Check if users table has any data
      const { count, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.error('Error checking users:', countError)
        setDebugInfo({ error: countError.message })
        return
      }

      console.log('Current user count:', count)

      if (count === 0) {
        console.log('No users found, inserting sample data...')
        await insertSampleUsers()
      }
    } catch (err) {
      console.error('Error checking sample data:', err)
    }
  }

  // Insert sample users
  const insertSampleUsers = async () => {
    try {
      // First, get role IDs from roles table
      const { data: roles, error: rolesError } = await supabase
        .from('roles')
        .select('role_id, role_name')

      if (rolesError) {
        console.error('Error fetching roles:', rolesError)
        return
      }

      console.log('Available roles:', roles)

      const roleMap = {}
      roles?.forEach(r => { roleMap[r.role_name] = r.role_id })

      const sampleUsers = [
        {
          full_name: 'John Farmer',
          email: 'john.farmer@example.com',
          phone: '+94 77 123 4567',
          role_id: roleMap['FARMER'] || null,
          status: 'active',
          is_verified: true,
          location: 'Kandy, Sri Lanka',
          bio: 'Organic farmer specializing in vegetables',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          full_name: 'Sarah Vendor',
          email: 'sarah.vendor@example.com',
          phone: '+94 77 234 5678',
          role_id: roleMap['VENDOR'] || null,
          status: 'active',
          is_verified: true,
          location: 'Colombo, Sri Lanka',
          bio: 'Fresh produce supplier',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          full_name: 'Mike Thompson',
          email: 'mike.thompson@example.com',
          phone: '+94 77 345 6789',
          role_id: roleMap['FARMER'] || null,
          status: 'banned',
          is_verified: false,
          location: 'Galle, Sri Lanka',
          bio: 'Rice farmer',
          ban_reason: 'Violation of community guidelines',
          banned_at: new Date().toISOString(),
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          full_name: 'Emma Wilson',
          email: 'emma.wilson@example.com',
          phone: '+94 77 456 7890',
          role_id: roleMap['VENDOR'] || null,
          status: 'active',
          is_verified: true,
          location: 'Kandy, Sri Lanka',
          bio: 'Organic fertilizer supplier',
          created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          full_name: 'David Perera',
          email: 'david.perera@example.com',
          phone: '+94 77 567 8901',
          role_id: roleMap['FARMER'] || null,
          status: 'pending',
          is_verified: false,
          location: 'Kurunegala, Sri Lanka',
          bio: 'Spice farmer',
          created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }
      ]

      for (const user of sampleUsers) {
        const { error } = await supabase
          .from('users')
          .insert(user)
        
        if (error) {
          console.error('Error inserting sample user:', error)
        } else {
          console.log('Inserted user:', user.full_name)
        }
      }

      console.log('Sample users inserted successfully')
    } catch (err) {
      console.error('Error inserting sample users:', err)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch all users with their role names using join
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          roles!users_role_id_fkey (
            role_id,
            role_name
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      console.log('Fetched users:', data?.length || 0)

      if (data && data.length > 0) {
        const processedUsers = data.map(user => ({
          ...user,
          role_name: user.roles?.role_name || 'USER'
        }))
        setUsers(processedUsers)
      } else {
        setUsers([])
      }
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      // Fetch all users for stats
      const { data, error } = await supabase
        .from('users')
        .select('status, is_verified, created_at, role_id')

      if (error) throw error

      console.log('Stats data:', data?.length || 0)

      if (data && data.length > 0) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        // Get role IDs for accurate counting
        const { data: roles } = await supabase
          .from('roles')
          .select('role_id, role_name')
        
        const roleMap = {}
        roles?.forEach(r => { roleMap[r.role_name] = r.role_id })
        
        const total = data.length
        const active = data.filter(u => u.status === 'active').length
        const banned = data.filter(u => u.status === 'banned').length
        const pending = data.filter(u => u.status === 'pending').length
        const verified = data.filter(u => u.is_verified === true).length
        const newToday = data.filter(u => new Date(u.created_at) >= today).length
        
        // Count by role using role_id
        let farmersCount = 0
        let vendorsCount = 0
        
        if (roleMap['FARMER']) {
          farmersCount = data.filter(u => u.role_id === roleMap['FARMER']).length
        }
        if (roleMap['VENDOR']) {
          vendorsCount = data.filter(u => u.role_id === roleMap['VENDOR']).length
        }

        setStats({
          total,
          active,
          banned,
          farmers: farmersCount,
          vendors: vendorsCount,
          newToday,
          verified,
          pending
        })
      } else {
        setStats({
          total: 0,
          active: 0,
          banned: 0,
          farmers: 0,
          vendors: 0,
          newToday: 0,
          verified: 0,
          pending: 0
        })
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const handleBanUser = async () => {
    if (!banReason.trim()) {
      alert('Please provide a reason for banning')
      return
    }
    
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          status: 'banned',
          ban_reason: banReason,
          banned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', selectedUser.user_id)

      if (error) throw error

      alert('User has been banned successfully!')
      fetchUsers()
      fetchStats()
      setShowBanModal(false)
      setSelectedUser(null)
      setBanReason('')
    } catch (err) {
      console.error('Error banning user:', err)
      alert('Error banning user: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnbanUser = async (userId) => {
    if (!confirm('Are you sure you want to unban this user?')) return
    
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          status: 'active',
          ban_reason: null,
          unbanned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) throw error

      alert('User has been unbanned successfully!')
      fetchUsers()
      fetchStats()
    } catch (err) {
      console.error('Error unbanning user:', err)
      alert('Error unbanning user: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteUser = async () => {
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('user_id', selectedUser.user_id)

      if (error) throw error

      alert('User deleted successfully!')
      fetchUsers()
      fetchStats()
      setShowDeleteModal(false)
      setSelectedUser(null)
    } catch (err) {
      console.error('Error deleting user:', err)
      alert('Error deleting user: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'active': { class: 'success', icon: 'bi-check-circle-fill', text: 'Active' },
      'banned': { class: 'danger', icon: 'bi-ban-fill', text: 'Banned' },
      'pending': { class: 'warning', icon: 'bi-clock-fill', text: 'Pending' },
      'inactive': { class: 'secondary', icon: 'bi-x-circle-fill', text: 'Inactive' }
    }
    const s = statusMap[status] || statusMap['active']
    return (
      <span className={`status-badge ${s.class}`}>
        <i className={`bi ${s.icon}`}></i>
        {s.text}
      </span>
    )
  }

  const getRoleBadge = (roleName) => {
    const roleMap = {
      'FARMER': { class: 'farmer', icon: 'bi-tree-fill', text: 'Farmer' },
      'VENDOR': { class: 'vendor', icon: 'bi-shop', text: 'Vendor' },
      'ADMIN': { class: 'admin', icon: 'bi-shield-lock-fill', text: 'Admin' }
    }
    const r = roleMap[roleName] || { class: 'default', icon: 'bi-person', text: roleName || 'User' }
    return (
      <span className={`role-badge ${r.class}`}>
        <i className={`bi ${r.icon}`}></i>
        {r.text}
      </span>
    )
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.phone && user.phone.includes(searchTerm))
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus
    const matchesRole = filterRole === 'all' || user.role_name?.toLowerCase() === filterRole
    return matchesSearch && matchesStatus && matchesRole
  })

  if (loading) {
    return (
      <AdminLayout title="Mobile Users">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading users...</p>
        </div>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
          }
          .loading-spinner {
            width: 48px;
            height: 48px;
            border: 3px solid #e9ecef;
            border-top-color: #4f46e5;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </AdminLayout>
    )
  }

  if (error && users.length === 0) {
    return (
      <AdminLayout title="Mobile Users">
        <div className="error-container">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <h3>Error Loading Users</h3>
          <p>{error}</p>
          {debugInfo && (
            <div className="debug-info">
              <details>
                <summary>Debug Information</summary>
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </details>
            </div>
          )}
          <button className="retry-btn" onClick={() => { fetchUsers(); fetchStats(); }}>
            Retry
          </button>
          <button className="insert-btn" onClick={insertSampleUsers}>
            Insert Sample Users
          </button>
        </div>
        <style jsx>{`
          .error-container {
            text-align: center;
            padding: 60px 20px;
            background: white;
            border-radius: 24px;
            max-width: 600px;
            margin: 40px auto;
          }
          .error-container i {
            font-size: 48px;
            color: #f59e0b;
            margin-bottom: 16px;
          }
          .debug-info {
            margin: 20px 0;
            text-align: left;
            background: #f8f9fa;
            padding: 12px;
            border-radius: 8px;
            overflow-x: auto;
          }
          .retry-btn, .insert-btn {
            margin-top: 20px;
            padding: 10px 24px;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            margin-right: 12px;
          }
          .retry-btn {
            background: #4f46e5;
            color: white;
          }
          .insert-btn {
            background: #10b981;
            color: white;
          }
        `}</style>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Mobile Users Management">
      <div className="users-container">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-content">
            <div className="hero-text">
              <div className="hero-icon-wrapper">
                <i className="bi bi-people-fill"></i>
              </div>
              <div>
                <h1 className="hero-title">Mobile Users Management</h1>
                <p className="hero-subtitle">Manage and monitor all mobile application users</p>
              </div>
            </div>
            <div className="hero-actions">
              <button className="btn-refresh" onClick={() => { fetchUsers(); fetchStats(); }}>
                <i className="bi bi-arrow-repeat"></i> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards - Real counts from database */}
        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-icon"><i className="bi bi-people"></i></div>
            <div className="stat-info">
              <span className="stat-label">Total Users</span>
              <h3>{stats.total}</h3>
              <span className="stat-trend">All registered users</span>
            </div>
          </div>
          <div className="stat-card active">
            <div className="stat-icon"><i className="bi bi-person-check"></i></div>
            <div className="stat-info">
              <span className="stat-label">Active Users</span>
              <h3 className="text-success">{stats.active}</h3>
              <span className="stat-trend">{stats.total > 0 ? ((stats.active/stats.total)*100).toFixed(0) : 0}% of total</span>
            </div>
          </div>
          <div className="stat-card banned">
            <div className="stat-icon"><i className="bi bi-ban"></i></div>
            <div className="stat-info">
              <span className="stat-label">Banned Users</span>
              <h3 className="text-danger">{stats.banned}</h3>
              <span className="stat-trend">Restricted access</span>
            </div>
          </div>
          <div className="stat-card farmers">
            <div className="stat-icon"><i className="bi bi-tree"></i></div>
            <div className="stat-info">
              <span className="stat-label">Farmers</span>
              <h3 className="text-info">{stats.farmers}</h3>
              <span className="stat-trend">Agricultural producers</span>
            </div>
          </div>
          <div className="stat-card vendors">
            <div className="stat-icon"><i className="bi bi-shop"></i></div>
            <div className="stat-info">
              <span className="stat-label">Vendors</span>
              <h3 className="text-warning">{stats.vendors}</h3>
              <span className="stat-trend">Product sellers</span>
            </div>
          </div>
          <div className="stat-card new">
            <div className="stat-icon"><i className="bi bi-calendar-plus"></i></div>
            <div className="stat-info">
              <span className="stat-label">New Today</span>
              <h3 className="text-primary">{stats.newToday}</h3>
              <span className="stat-trend">Last 24 hours</span>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="controls-bar">
          <div className="controls-left">
            <div className="search-box">
              <i className="bi bi-search"></i>
              <input 
                type="text" 
                placeholder="Search by name, email or phone..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="clear-search" onClick={() => setSearchTerm('')}>
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
            <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
              <option value="pending">Pending</option>
            </select>
            <select className="filter-select" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="farmer">Farmers</option>
              <option value="vendor">Vendors</option>
            </select>
          </div>
          <div className="info-text">
            <i className="bi bi-info-circle"></i>
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>

        {/* Users Table */}
        {filteredUsers.length > 0 ? (
          <div className="users-table-container">
            <div className="table-responsive">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Contact</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Last Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.user_id}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">
                            {user.profile_image ? (
                              <img src={user.profile_image} alt={user.full_name} />
                            ) : (
                              <span>{user.full_name?.charAt(0) || 'U'}</span>
                            )}
                          </div>
                          <div>
                            <div className="user-name">{user.full_name}</div>
                            <div className="user-id">ID: {user.user_id?.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="contact-info">
                          <div><i className="bi bi-envelope"></i> {user.email}</div>
                          {user.phone && <div><i className="bi bi-telephone"></i> {user.phone}</div>}
                          {user.is_verified && <span className="verified-badge"><i className="bi bi-check-circle-fill"></i> Verified</span>}
                        </div>
                      </td>
                      <td>{getRoleBadge(user.role_name)}</td>
                      <td>{getStatusBadge(user.status)}</td>
                      <td className="date-cell">{new Date(user.created_at).toLocaleDateString()}</td>
                      <td className="date-cell">{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn view" onClick={() => { setSelectedUser(user); setShowDetailsModal(true); }} title="View Details">
                            <i className="bi bi-eye"></i>
                          </button>
                          {user.status !== 'banned' ? (
                            <button className="action-btn ban" onClick={() => { setSelectedUser(user); setShowBanModal(true); }} title="Ban User">
                              <i className="bi bi-ban"></i>
                            </button>
                          ) : (
                            <button className="action-btn unban" onClick={() => handleUnbanUser(user.user_id)} title="Unban User">
                              <i className="bi bi-check-circle"></i>
                            </button>
                          )}
                          <button className="action-btn delete" onClick={() => { setSelectedUser(user); setShowDeleteModal(true); }} title="Delete User">
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <i className="bi bi-people-slash"></i>
            <h3>No Users Found</h3>
            <p>No mobile users match your search criteria</p>
            <button className="btn-clear-filters" onClick={() => { setSearchTerm(''); setFilterStatus('all'); setFilterRole('all'); }}>
              Clear Filters
            </button>
            <button className="btn-insert-sample" onClick={insertSampleUsers}>
              Insert Sample Users
            </button>
          </div>
        )}
      </div>

      {/* User Details Modal - Same as before */}
      {showDetailsModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-wrapper">
                <i className="bi bi-person-circle"></i>
              </div>
              <div>
                <h2>User Details</h2>
                <p>Complete user information</p>
              </div>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="user-profile-header">
                <div className="user-avatar-large">
                  {selectedUser.profile_image ? (
                    <img src={selectedUser.profile_image} alt={selectedUser.full_name} />
                  ) : (
                    <span>{selectedUser.full_name?.charAt(0) || 'U'}</span>
                  )}
                </div>
                <div className="user-profile-info">
                  <h3>{selectedUser.full_name}</h3>
                  <div className="user-meta">
                    {getRoleBadge(selectedUser.role_name)}
                    {getStatusBadge(selectedUser.status)}
                  </div>
                  <div className="user-id-full">ID: {selectedUser.user_id}</div>
                </div>
              </div>

              <div className="details-grid">
                <div className="detail-section">
                  <h4><i className="bi bi-envelope"></i> Contact Information</h4>
                  <div><strong>Email:</strong> {selectedUser.email}</div>
                  <div><strong>Phone:</strong> {selectedUser.phone || 'Not provided'}</div>
                  <div><strong>Location:</strong> {selectedUser.location || 'Not provided'}</div>
                  {selectedUser.is_verified && <div className="verified-badge-sm"><i className="bi bi-check-circle-fill"></i> Verified Account</div>}
                </div>
                <div className="detail-section">
                  <h4><i className="bi bi-calendar"></i> Account Information</h4>
                  <div><strong>Joined:</strong> {new Date(selectedUser.created_at).toLocaleString()}</div>
                  <div><strong>Last Updated:</strong> {new Date(selectedUser.updated_at).toLocaleString()}</div>
                  <div><strong>Last Login:</strong> {selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString() : 'Never'}</div>
                </div>
                {selectedUser.ban_reason && (
                  <div className="detail-section full-width">
                    <h4><i className="bi bi-exclamation-triangle"></i> Ban Information</h4>
                    <div><strong>Reason:</strong> {selectedUser.ban_reason}</div>
                    <div><strong>Banned At:</strong> {new Date(selectedUser.banned_at).toLocaleString()}</div>
                  </div>
                )}
                {selectedUser.bio && (
                  <div className="detail-section full-width">
                    <h4><i className="bi bi-file-text"></i> Bio</h4>
                    <p>{selectedUser.bio}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Ban User Modal */}
      {showBanModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowBanModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header warning">
              <div className="modal-icon-wrapper"><i className="bi bi-ban"></i></div>
              <div><h2>Ban User</h2><p>Provide a reason for banning</p></div>
              <button className="modal-close" onClick={() => setShowBanModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="modal-body">
              <div className="ban-user-info">
                <div className="user-avatar-small">
                  {selectedUser.profile_image ? <img src={selectedUser.profile_image} alt={selectedUser.full_name} /> : <span>{selectedUser.full_name?.charAt(0)}</span>}
                </div>
                <div><strong>{selectedUser.full_name}</strong><br />{selectedUser.email}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Ban Reason *</label>
                <textarea className="form-textarea" rows="4" placeholder="Enter reason for banning..." value={banReason} onChange={(e) => setBanReason(e.target.value)} />
              </div>
              <div className="warning-message"><i className="bi bi-exclamation-triangle-fill"></i> Banned users cannot access the platform.</div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowBanModal(false)}>Cancel</button>
              <button className="btn-primary danger" onClick={handleBanUser} disabled={actionLoading}>
                {actionLoading ? 'Banning...' : 'Ban User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header danger">
              <div className="modal-icon-wrapper"><i className="bi bi-trash"></i></div>
              <div><h2>Delete User</h2><p>This action cannot be undone</p></div>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to permanently delete <strong>{selectedUser.full_name}</strong>?</p>
              <div className="warning-message"><i className="bi bi-exclamation-triangle-fill"></i> All user data will be permanently removed.</div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn-primary danger" onClick={handleDeleteUser} disabled={actionLoading}>
                {actionLoading ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .users-container { max-width: 1400px; margin: 0 auto; padding: 0 24px; }

        /* Hero Section */
        .hero-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 28px;
          padding: 40px 32px;
          margin-bottom: 32px;
        }
        .hero-content { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; }
        .hero-text { display: flex; align-items: center; gap: 20px; }
        .hero-icon-wrapper { width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 20px; display: flex; align-items: center; justify-content: center; }
        .hero-icon-wrapper i { font-size: 32px; color: white; }
        .hero-title { font-size: 28px; font-weight: 700; color: white; margin: 0 0 8px 0; }
        .hero-subtitle { font-size: 14px; color: rgba(255,255,255,0.9); margin: 0; }
        .btn-refresh { padding: 10px 24px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 12px; color: white; cursor: pointer; transition: all 0.3s ease; }
        .btn-refresh:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }

        /* Stats Grid */
        .stats-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 20px; margin-bottom: 32px; }
        .stat-card { background: white; border-radius: 20px; padding: 20px; display: flex; align-items: center; gap: 16px; transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); }
        .stat-icon { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
        .total .stat-icon { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
        .active .stat-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .banned .stat-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .farmers .stat-icon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .vendors .stat-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .new .stat-icon { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
        .stat-info { flex: 1; }
        .stat-label { font-size: 12px; color: #6c757d; margin-bottom: 4px; display: block; }
        .stat-info h3 { font-size: 28px; font-weight: 700; margin: 0; }
        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }
        .text-info { color: #3b82f6; }
        .text-warning { color: #f59e0b; }
        .text-primary { color: #8b5cf6; }
        .stat-trend { font-size: 11px; color: #6c757d; }

        /* Controls */
        .controls-bar { background: white; border-radius: 20px; padding: 16px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .controls-left { display: flex; gap: 16px; flex-wrap: wrap; flex: 1; }
        .search-box { position: relative; min-width: 300px; flex: 1; }
        .search-box i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #9ca3af; }
        .search-box input { width: 100%; padding: 10px 40px 10px 40px; border: 2px solid #e9ecef; border-radius: 12px; font-size: 14px; transition: all 0.3s ease; }
        .search-box input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
        .clear-search { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; }
        .filter-select { padding: 10px 12px; border: 2px solid #e9ecef; border-radius: 12px; font-size: 14px; min-width: 140px; background: white; cursor: pointer; }
        .info-text { padding: 8px 16px; background: #f8f9fa; border-radius: 12px; font-size: 13px; color: #6c757d; display: flex; align-items: center; gap: 8px; }

        /* Table */
        .users-table-container { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .table-responsive { overflow-x: auto; }
        .users-table { width: 100%; border-collapse: collapse; min-width: 1000px; }
        .users-table th { text-align: left; padding: 16px 20px; background: #f8f9fa; font-weight: 600; font-size: 13px; border-bottom: 1px solid #e9ecef; }
        .users-table td { padding: 16px 20px; border-bottom: 1px solid #e9ecef; vertical-align: middle; }
        .user-row:hover { background: #f8f9fa; }
        .user-cell { display: flex; align-items: center; gap: 12px; }
        .user-avatar { width: 40px; height: 40px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; overflow: hidden; }
        .user-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .user-name { font-weight: 600; color: #1f2937; margin-bottom: 2px; }
        .user-id { font-size: 11px; color: #9ca3af; font-family: monospace; }
        .contact-info { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
        .contact-info i { font-size: 12px; color: #9ca3af; margin-right: 6px; }
        .verified-badge { font-size: 11px; color: #10b981; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; }
        .date-cell { font-size: 13px; color: #6c757d; }
        
        /* Badges */
        .role-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .role-badge.farmer { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .role-badge.vendor { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .role-badge.admin { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .role-badge.default { background: rgba(107, 114, 128, 0.1); color: #6c757d; }
        
        .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .status-badge.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-badge.danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .status-badge.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .status-badge.secondary { background: rgba(107, 114, 128, 0.1); color: #6c757d; }

        /* Action Buttons */
        .action-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
        .action-btn { padding: 6px 10px; border: none; border-radius: 8px; cursor: pointer; transition: all 0.3s ease; display: inline-flex; align-items: center; gap: 4px; }
        .action-btn.view { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .action-btn.view:hover { background: #4f46e5; color: white; }
        .action-btn.ban { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .action-btn.ban:hover { background: #ef4444; color: white; }
        .action-btn.unban { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .action-btn.unban:hover { background: #10b981; color: white; }
        .action-btn.delete { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .action-btn.delete:hover { background: #ef4444; color: white; }

        .empty-state { text-align: center; padding: 80px 20px; background: white; border-radius: 24px; }
        .empty-state i { font-size: 64px; color: #cbd5e1; margin-bottom: 16px; }
        .btn-clear-filters, .btn-insert-sample { margin-top: 20px; padding: 12px 32px; border: none; border-radius: 12px; color: white; cursor: pointer; margin-right: 12px; }
        .btn-clear-filters { background: linear-gradient(135deg, #667eea, #764ba2); }
        .btn-insert-sample { background: #10b981; }

        /* Modal Styles */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1100; animation: fadeIn 0.2s ease; }
        .modal-container { background: white; border-radius: 28px; width: 90%; max-width: 700px; max-height: 85vh; overflow-y: auto; animation: slideUp 0.3s ease; }
        .modal-container.modal-lg { max-width: 800px; }
        .modal-header { padding: 24px 28px; border-bottom: 1px solid #e9ecef; display: flex; align-items: center; gap: 16px; position: relative; }
        .modal-header.warning .modal-icon-wrapper { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .modal-header.danger .modal-icon-wrapper { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .modal-icon-wrapper { width: 48px; height: 48px; border-radius: 24px; display: flex; align-items: center; justify-content: center; }
        .modal-icon-wrapper i { font-size: 24px; }
        .modal-header h2 { font-size: 20px; margin: 0 0 4px 0; }
        .modal-header p { margin: 0; color: #6c757d; font-size: 13px; }
        .modal-close { position: absolute; right: 20px; top: 20px; background: none; border: none; font-size: 18px; cursor: pointer; transition: all 0.3s ease; }
        .modal-close:hover { transform: rotate(90deg); }
        .modal-body { padding: 28px; }
        .modal-footer { padding: 16px 28px 28px; border-top: 1px solid #e9ecef; display: flex; justify-content: flex-end; gap: 12px; }
        
        .user-profile-header { display: flex; align-items: center; gap: 24px; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e9ecef; flex-wrap: wrap; }
        .user-avatar-large { width: 80px; height: 80px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; color: white; overflow: hidden; }
        .user-avatar-large img { width: 100%; height: 100%; object-fit: cover; }
        .user-profile-info h3 { margin: 0 0 8px 0; font-size: 20px; }
        .user-meta { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
        .user-id-full { font-size: 12px; color: #6c757d; font-family: monospace; }
        .user-avatar-small { width: 48px; height: 48px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; overflow: hidden; }
        .ban-user-info { display: flex; align-items: center; gap: 16px; padding: 16px; background: #f8f9fa; border-radius: 16px; margin-bottom: 20px; }
        
        .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
        .detail-section { background: #f8f9fa; border-radius: 16px; padding: 20px; }
        .detail-section.full-width { grid-column: span 2; }
        .detail-section h4 { margin: 0 0 16px 0; font-size: 14px; font-weight: 600; }
        .detail-section h4 i { margin-right: 8px; color: #667eea; }
        .detail-section div { margin-bottom: 8px; font-size: 13px; }
        .verified-badge-sm { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #10b981; margin-top: 8px; }
        
        .form-group { margin-bottom: 20px; }
        .form-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #374151; }
        .form-textarea { width: 100%; padding: 12px; border: 2px solid #e9ecef; border-radius: 12px; font-size: 14px; resize: vertical; transition: all 0.3s ease; }
        .form-textarea:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
        .warning-message { background: #fef3c7; padding: 12px; border-radius: 12px; display: flex; align-items: center; gap: 12px; font-size: 13px; color: #92400e; margin-top: 16px; }
        
        .btn-secondary { padding: 10px 20px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 10px; cursor: pointer; font-weight: 500; transition: all 0.3s ease; }
        .btn-secondary:hover { background: #e9ecef; }
        .btn-primary { padding: 10px 24px; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; }
        .btn-primary.danger { background: #ef4444; color: white; }
        .btn-primary.danger:hover { background: #dc2626; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 1200px) { .stats-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px) {
          .users-container { padding: 0 16px; }
          .hero-section { padding: 32px 24px; }
          .hero-content { flex-direction: column; text-align: center; }
          .hero-text { flex-direction: column; }
          .hero-title { font-size: 24px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .controls-left { flex-direction: column; width: 100%; }
          .search-box { width: 100%; }
          .filter-select { width: 100%; }
          .details-grid { grid-template-columns: 1fr; }
          .detail-section.full-width { grid-column: span 1; }
          .user-profile-header { flex-direction: column; text-align: center; }
          .user-meta { justify-content: center; }
          .action-buttons { justify-content: center; }
        }
      `}</style>
    </AdminLayout>
  )
}