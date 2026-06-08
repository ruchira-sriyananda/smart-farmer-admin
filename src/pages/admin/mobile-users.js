import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function MobileUsers() {
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [debugInfo, setDebugInfo] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showBanModal, setShowBanModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [profileImages, setProfileImages] = useState({})
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    banned: 0,
    farmers: 0,
    vendors: 0,
    newToday: 0
  })

  useEffect(() => {
    fetchTableInfo()
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

  // First, let's check what columns exist in the users table
  const fetchTableInfo = async () => {
    try {
      // Get table info to see available columns
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(1)

      if (error) throw error

      if (data && data.length > 0) {
        const columns = Object.keys(data[0])
        console.log('Available columns in users table:', columns)
        setDebugInfo({ columns, sample: data[0] })
      }
    } catch (err) {
      console.error('Error fetching table info:', err)
      setDebugInfo({ error: err.message })
    }
  }

  // Helper function to get Supabase storage URL for profile images
  const getProfileImageUrl = (imagePath) => {
    if (!imagePath) return null
    if (imagePath.startsWith('http')) return imagePath
    try {
      const { data } = supabase.storage.from('profile-images').getPublicUrl(imagePath)
      return data?.publicUrl || imagePath
    } catch (err) {
      return imagePath
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get all columns to see what's available
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      console.log('Fetched users:', data?.length || 0, 'users')

      if (data && data.length > 0) {
        // Map the data to our expected format based on available columns
        const processedUsers = data.map(user => ({
          user_id: user.user_id || user.id,
          full_name: user.full_name || user.name || user.username || `User_${(user.user_id || user.id)?.slice(0, 8)}`,
          email: user.email || 'No email',
          phone: user.phone || user.mobile || null,
          role: user.role || user.user_role || 'user',
          status: user.status || user.account_status || 'active',
          is_verified: user.is_verified || user.email_verified || false,
          profile_image: user.profile_image || user.avatar_url || null,
          location: user.location || user.address || null,
          bio: user.bio || user.description || null,
          ban_reason: user.ban_reason || null,
          banned_at: user.banned_at || null,
          last_login: user.last_login || user.last_active || null,
          created_at: user.created_at,
          updated_at: user.updated_at
        }))
        
        setUsers(processedUsers)
        
        // Load profile images
        const images = {}
        for (const user of processedUsers) {
          if (user.profile_image) {
            images[user.user_id] = getProfileImageUrl(user.profile_image)
          }
        }
        setProfileImages(images)
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
      const { data, error } = await supabase
        .from('users')
        .select('status, role, created_at')

      if (error) throw error

      console.log('Stats data:', data?.length || 0, 'records')

      if (data && data.length > 0) {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        
        // Check what status values exist
        const statuses = [...new Set(data.map(u => u.status))];
        const roles = [...new Set(data.map(u => u.role))];
        console.log('Available statuses:', statuses);
        console.log('Available roles:', roles);
        
        setStats({
          total: data.length,
          active: data.filter(u => u.status === 'active' || u.status === 'ACTIVE' || u.status === 'Active').length,
          banned: data.filter(u => u.status === 'banned' || u.status === 'BANNED' || u.status === 'Banned').length,
          farmers: data.filter(u => u.role === 'farmer' || u.role === 'FARMER' || u.role === 'Farmer').length,
          vendors: data.filter(u => u.role === 'vendor' || u.role === 'VENDOR' || u.role === 'Vendor').length,
          newToday: data.filter(u => new Date(u.created_at) >= today).length
        })
      } else {
        // If no data, let's insert some sample users for testing
        await insertSampleUsers()
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
      setError(err.message)
    }
  }

  // Insert sample users if table is empty
  const insertSampleUsers = async () => {
    try {
      console.log('Inserting sample users...')
      
      const sampleUsers = [
        {
          full_name: 'John Farmer',
          email: 'john.farmer@example.com',
          phone: '+94 77 123 4567',
          role: 'farmer',
          status: 'active',
          is_verified: true,
          location: 'Kandy, Sri Lanka',
          bio: 'Organic farmer specializing in vegetables'
        },
        {
          full_name: 'Sarah Vendor',
          email: 'sarah.vendor@example.com',
          phone: '+94 77 234 5678',
          role: 'vendor',
          status: 'active',
          is_verified: true,
          location: 'Colombo, Sri Lanka',
          bio: 'Fresh produce supplier'
        },
        {
          full_name: 'Mike Thompson',
          email: 'mike@example.com',
          phone: '+94 77 345 6789',
          role: 'farmer',
          status: 'banned',
          is_verified: false,
          location: 'Galle, Sri Lanka',
          ban_reason: 'Violation of community guidelines',
          bio: 'Rice farmer'
        },
        {
          full_name: 'Emma Wilson',
          email: 'emma@example.com',
          phone: '+94 77 456 7890',
          role: 'vendor',
          status: 'active',
          is_verified: true,
          location: 'Kandy, Sri Lanka',
          bio: 'Organic fertilizer supplier'
        },
        {
          full_name: 'David Perera',
          email: 'david@example.com',
          phone: '+94 77 567 8901',
          role: 'farmer',
          status: 'pending',
          is_verified: false,
          location: 'Kurunegala, Sri Lanka',
          bio: 'Spice farmer'
        }
      ]

      for (const user of sampleUsers) {
        const { error } = await supabase
          .from('users')
          .insert({
            ...user,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        
        if (error) {
          console.error('Error inserting sample user:', error)
        }
      }

      console.log('Sample users inserted successfully')
      // Refresh data after inserting
      fetchUsers()
      fetchStats()
      
    } catch (err) {
      console.error('Error inserting sample users:', err)
    }
  }

  const handleBanUser = async (userId, reason) => {
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          status: 'banned',
          ban_reason: reason,
          banned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) throw error

      alert('User has been banned successfully!')
      fetchUsers()
      fetchStats()
      setShowBanModal(false)
      setSelectedUser(null)
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

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone!')) return
    
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('user_id', userId)

      if (error) throw error

      alert('User deleted successfully!')
      fetchUsers()
      fetchStats()
    } catch (err) {
      console.error('Error deleting user:', err)
      alert('Error deleting user: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleChangeRole = async (userId, newRole) => {
    if (!confirm(`Change user role to ${newRole.toUpperCase()}?`)) return
    
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          role: newRole,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) throw error

      alert(`User role changed to ${newRole.toUpperCase()} successfully!`)
      fetchUsers()
    } catch (err) {
      console.error('Error changing role:', err)
      alert('Error changing role: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || 'active'
    const badges = {
      'active': { class: 'success', icon: 'bi-check-circle-fill', text: 'Active' },
      'banned': { class: 'danger', icon: 'bi-ban-fill', text: 'Banned' },
      'suspended': { class: 'warning', icon: 'bi-exclamation-triangle-fill', text: 'Suspended' },
      'pending': { class: 'info', icon: 'bi-clock-fill', text: 'Pending' }
    }
    const badge = badges[statusLower] || badges['active']
    return (
      <span className={`status-badge ${badge.class}`}>
        <i className={`bi ${badge.icon}`}></i>
        {badge.text}
      </span>
    )
  }

  const getRoleBadge = (role) => {
    const roleLower = role?.toLowerCase() || 'user'
    const roles = {
      'farmer': { class: 'farmer', icon: 'bi-tree-fill', text: 'Farmer' },
      'vendor': { class: 'vendor', icon: 'bi-shop', text: 'Vendor' },
      'admin': { class: 'admin', icon: 'bi-shield-lock-fill', text: 'Admin' },
      'user': { class: 'default', icon: 'bi-person', text: 'User' }
    }
    const roleInfo = roles[roleLower] || roles['user']
    return (
      <span className={`role-badge ${roleInfo.class}`}>
        <i className={`bi ${roleInfo.icon}`}></i>
        {roleInfo.text}
      </span>
    )
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.phone && user.phone.includes(searchTerm))
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus
    const matchesRole = filterRole === 'all' || user.role === filterRole
    return matchesSearch && matchesStatus && matchesRole
  })

  if (loading) {
    return (
      <AdminLayout title="Mobile Users">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading users...</p>
        </div>
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
        </div>
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
                <i className="bi bi-arrow-repeat"></i>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-wrapper">
          <div className="stats-grid">
            <div className="stat-card stat-total">
              <div className="stat-icon"><i className="bi bi-people"></i></div>
              <div className="stat-info">
                <span className="stat-label">Total Users</span>
                <h3>{stats.total}</h3>
                <span className="stat-trend">All registered users</span>
              </div>
            </div>

            <div className="stat-card stat-active">
              <div className="stat-icon"><i className="bi bi-person-check"></i></div>
              <div className="stat-info">
                <span className="stat-label">Active Users</span>
                <h3 className="text-success">{stats.active}</h3>
                <span className="stat-trend">{stats.total > 0 ? ((stats.active/stats.total)*100).toFixed(0) : 0}% of total</span>
              </div>
            </div>

            <div className="stat-card stat-banned">
              <div className="stat-icon"><i className="bi bi-ban"></i></div>
              <div className="stat-info">
                <span className="stat-label">Banned Users</span>
                <h3 className="text-danger">{stats.banned}</h3>
                <span className="stat-trend">Restricted access</span>
              </div>
            </div>

            <div className="stat-card stat-farmers">
              <div className="stat-icon"><i className="bi bi-tree"></i></div>
              <div className="stat-info">
                <span className="stat-label">Farmers</span>
                <h3 className="text-info">{stats.farmers}</h3>
                <span className="stat-trend">Agricultural producers</span>
              </div>
            </div>

            <div className="stat-card stat-vendors">
              <div className="stat-icon"><i className="bi bi-shop"></i></div>
              <div className="stat-info">
                <span className="stat-label">Vendors</span>
                <h3 className="text-warning">{stats.vendors}</h3>
                <span className="stat-trend">Product sellers</span>
              </div>
            </div>

            <div className="stat-card stat-new">
              <div className="stat-icon"><i className="bi bi-calendar-plus"></i></div>
              <div className="stat-info">
                <span className="stat-label">New Today</span>
                <h3 className="text-primary">{stats.newToday}</h3>
                <span className="stat-trend">Joined in last 24h</span>
              </div>
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
            
            <div className="filter-group">
              <select 
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="banned">Banned</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div className="filter-group">
              <select 
                className="filter-select"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="farmer">Farmers</option>
                <option value="vendor">Vendors</option>
              </select>
            </div>
          </div>

          <div className="controls-right">
            <div className="info-text">
              <i className="bi bi-info-circle"></i>
              Showing {filteredUsers.length} of {users.length} users
            </div>
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
                    <th>Contact Info</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Last Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.user_id} className="user-row">
                      <td className="user-cell">
                        <div className="user-info">
                          <div className="user-avatar">
                            {profileImages[user.user_id] ? (
                              <img src={profileImages[user.user_id]} alt={user.full_name} />
                            ) : (
                              <span>{user.full_name?.charAt(0) || 'U'}</span>
                            )}
                          </div>
                          <div className="user-details">
                            <div className="user-name">{user.full_name}</div>
                            <div className="user-id">ID: {user.user_id?.slice(0, 8)}...</div>
                          </div>
                        </div>
                       </td>
                      <td className="contact-cell">
                        <div className="contact-info">
                          <div className="contact-item">
                            <i className="bi bi-envelope"></i>
                            <span>{user.email || 'No email'}</span>
                          </div>
                          <div className="contact-item">
                            <i className="bi bi-telephone"></i>
                            <span>{user.phone || 'No phone'}</span>
                          </div>
                          {user.is_verified && (
                            <div className="verified-badge">
                              <i className="bi bi-check-circle-fill"></i> Verified
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="role-cell">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="status-cell">
                        {getStatusBadge(user.status)}
                        {user.ban_reason && (
                          <div className="ban-reason-tooltip" title={user.ban_reason}>
                            <i className="bi bi-info-circle"></i>
                          </div>
                        )}
                      </td>
                      <td className="date-cell">
                        <div className="date-info">
                          <i className="bi bi-calendar3"></i>
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="date-cell">
                        <div className="date-info">
                          <i className="bi bi-clock"></i>
                          {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                        </div>
                      </td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button 
                            className="action-btn view" 
                            onClick={() => {
                              setSelectedUser(user)
                              setShowDetailsModal(true)
                            }}
                            title="View Details"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          
                          {user.status !== 'banned' ? (
                            <button 
                              className="action-btn ban" 
                              onClick={() => {
                                setSelectedUser(user)
                                setShowBanModal(true)
                              }}
                              title="Ban User"
                            >
                              <i className="bi bi-ban"></i>
                            </button>
                          ) : (
                            <button 
                              className="action-btn unban" 
                              onClick={() => handleUnbanUser(user.user_id)}
                              disabled={actionLoading}
                              title="Unban User"
                            >
                              <i className="bi bi-check-circle"></i>
                            </button>
                          )}
                          
                          <select 
                            className="role-select"
                            value={user.role}
                            onChange={(e) => handleChangeRole(user.user_id, e.target.value)}
                            disabled={actionLoading}
                          >
                            <option value="farmer">Farmer</option>
                            <option value="vendor">Vendor</option>
                          </select>
                          
                          <button 
                            className="action-btn delete" 
                            onClick={() => handleDeleteUser(user.user_id)}
                            disabled={actionLoading}
                            title="Delete User"
                          >
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
            <div className="empty-state-icon">
              <i className="bi bi-people-slash"></i>
            </div>
            <h3>No Users Found</h3>
            <p>No mobile users match your search criteria</p>
            <button className="btn-create-sample" onClick={insertSampleUsers}>
              <i className="bi bi-database-add"></i>
              Create Sample Users
            </button>
            <button className="btn-clear-filters" onClick={() => {
              setSearchTerm('')
              setFilterStatus('all')
              setFilterRole('all')
            }}>
              <i className="bi bi-arrow-repeat"></i>
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Rest of the modals remain the same... */}
      {/* User Details Modal */}
      {showDetailsModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-wrapper">
                  <i className="bi bi-person-circle"></i>
                </div>
                <div>
                  <h2>User Details</h2>
                  <p>Complete user information and statistics</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="user-profile-header">
                <div className="user-avatar-large">
                  {profileImages[selectedUser.user_id] ? (
                    <img src={profileImages[selectedUser.user_id]} alt={selectedUser.full_name} />
                  ) : (
                    <span>{selectedUser.full_name?.charAt(0) || 'U'}</span>
                  )}
                </div>
                <div className="user-profile-info">
                  <h3>{selectedUser.full_name}</h3>
                  <div className="user-meta">
                    {getRoleBadge(selectedUser.role)}
                    {getStatusBadge(selectedUser.status)}
                  </div>
                  <div className="user-id-full">
                    <strong>User ID:</strong> {selectedUser.user_id}
                  </div>
                </div>
              </div>

              <div className="details-grid">
                <div className="detail-section">
                  <h4><i className="bi bi-envelope"></i> Contact Information</h4>
                  <div className="detail-item">
                    <label>Email Address</label>
                    <p>{selectedUser.email || 'Not provided'}</p>
                    {selectedUser.is_verified && (
                      <span className="verified-badge-sm">
                        <i className="bi bi-check-circle-fill"></i> Verified
                      </span>
                    )}
                  </div>
                  <div className="detail-item">
                    <label>Phone Number</label>
                    <p>{selectedUser.phone || 'Not provided'}</p>
                  </div>
                  {selectedUser.location && (
                    <div className="detail-item">
                      <label>Location</label>
                      <p>{selectedUser.location}</p>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h4><i className="bi bi-calendar"></i> Account Information</h4>
                  <div className="detail-item">
                    <label>Joined Date</label>
                    <p>{new Date(selectedUser.created_at).toLocaleString()}</p>
                  </div>
                  <div className="detail-item">
                    <label>Last Login</label>
                    <p>{selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString() : 'Never'}</p>
                  </div>
                  <div className="detail-item">
                    <label>Last Updated</label>
                    <p>{new Date(selectedUser.updated_at).toLocaleString()}</p>
                  </div>
                </div>

                {selectedUser.ban_reason && (
                  <div className="detail-section full-width">
                    <h4><i className="bi bi-exclamation-triangle"></i> Ban Information</h4>
                    <div className="detail-item">
                      <label>Ban Reason</label>
                      <p className="ban-reason">{selectedUser.ban_reason}</p>
                    </div>
                    {selectedUser.banned_at && (
                      <div className="detail-item">
                        <label>Banned Date</label>
                        <p>{new Date(selectedUser.banned_at).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedUser.bio && (
                  <div className="detail-section full-width">
                    <h4><i className="bi bi-file-text"></i> Bio</h4>
                    <p className="user-bio">{selectedUser.bio}</p>
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
              <div className="modal-icon-wrapper">
                <i className="bi bi-ban"></i>
              </div>
              <div>
                <h2>Ban User</h2>
                <p>Provide a reason for banning this user</p>
              </div>
              <button className="modal-close" onClick={() => setShowBanModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="ban-user-info">
                <div className="user-avatar-small">
                  {profileImages[selectedUser.user_id] ? (
                    <img src={profileImages[selectedUser.user_id]} alt={selectedUser.full_name} />
                  ) : (
                    <span>{selectedUser.full_name?.charAt(0) || 'U'}</span>
                  )}
                </div>
                <div>
                  <strong>{selectedUser.full_name}</strong>
                  <p>{selectedUser.email}</p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Ban Reason *</label>
                <textarea
                  className="form-textarea"
                  rows="4"
                  placeholder="Enter detailed reason for banning this user..."
                  id="banReason"
                />
                <small className="form-hint">This reason will be visible to the user</small>
              </div>

              <div className="warning-message">
                <i className="bi bi-exclamation-triangle-fill"></i>
                <div>
                  <strong>Warning:</strong> Banned users will lose access to all platform features and cannot log in.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowBanModal(false)}>Cancel</button>
              <button 
                className="btn-primary danger" 
                onClick={() => {
                  const reason = document.getElementById('banReason').value
                  if (!reason.trim()) {
                    alert('Please provide a reason for banning')
                    return
                  }
                  handleBanUser(selectedUser.user_id, reason)
                }}
                disabled={actionLoading}
              >
                {actionLoading ? 'Banning...' : 'Ban User'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .users-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px;
        }

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
          color: #dc3545;
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

        .debug-info pre {
          margin: 0;
          font-size: 11px;
        }

        .retry-btn, .btn-create-sample {
          margin-top: 20px;
          padding: 10px 24px;
          background: #4f46e5;
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          margin-right: 12px;
        }

        .btn-create-sample {
          background: #10b981;
        }

        /* Hero Section */
        .hero-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 28px;
          padding: 40px 32px;
          margin-bottom: 32px;
          position: relative;
          overflow: hidden;
        }

        .hero-section::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          animation: pulse 10s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }

        .hero-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .hero-text {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .hero-icon-wrapper {
          width: 60px;
          height: 60px;
          background: rgba(255,255,255,0.2);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
        }

        .hero-icon-wrapper i {
          font-size: 32px;
          color: white;
        }

        .hero-title {
          font-size: 28px;
          font-weight: 700;
          color: white;
          margin: 0 0 8px 0;
        }

        .hero-subtitle {
          font-size: 14px;
          color: rgba(255,255,255,0.9);
          margin: 0;
        }

        .btn-refresh {
          padding: 10px 24px;
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 12px;
          color: white;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-refresh:hover {
          background: rgba(255,255,255,0.3);
          transform: translateY(-2px);
        }

        /* Stats Grid */
        .stats-wrapper {
          margin-bottom: 32px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 20px;
        }

        .stat-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.3s ease;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }

        .stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .stat-total .stat-icon { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
        .stat-active .stat-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-banned .stat-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .stat-farmers .stat-icon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .stat-vendors .stat-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .stat-new .stat-icon { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }

        .stat-info {
          flex: 1;
        }

        .stat-label {
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 4px;
          display: block;
        }

        .stat-info h3 {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          color: #1f2937;
        }

        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }
        .text-info { color: #3b82f6; }
        .text-warning { color: #f59e0b; }
        .text-primary { color: #8b5cf6; }

        .stat-trend {
          font-size: 11px;
          color: #6c757d;
        }

        /* Controls Bar */
        .controls-bar {
          background: white;
          border-radius: 20px;
          padding: 16px 20px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .controls-left {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
          flex: 1;
        }

        .search-box {
          position: relative;
          min-width: 300px;
          flex: 1;
        }

        .search-box i {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .search-box input {
          width: 100%;
          padding: 10px 40px 10px 40px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .search-box input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }

        .clear-search {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
        }

        .filter-group {
          min-width: 150px;
        }

        .filter-select {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
          background: white;
          cursor: pointer;
        }

        .controls-right {
          display: flex;
          align-items: center;
        }

        .info-text {
          padding: 8px 16px;
          background: #f8f9fa;
          border-radius: 12px;
          font-size: 13px;
          color: #6c757d;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Users Table */
        .users-table-container {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .table-responsive {
          overflow-x: auto;
        }

        .users-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1000px;
        }

        .users-table th {
          text-align: left;
          padding: 16px 20px;
          background: #f8f9fa;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          border-bottom: 1px solid #e9ecef;
        }

        .users-table td {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
          vertical-align: middle;
        }

        .user-row:hover {
          background: #f8f9fa;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          overflow: hidden;
        }

        .user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .user-name {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 2px;
        }

        .user-id {
          font-size: 11px;
          color: #9ca3af;
          font-family: monospace;
        }

        .contact-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
        }

        .contact-item i {
          font-size: 12px;
          color: #9ca3af;
        }

        .verified-badge {
          font-size: 10px;
          color: #10b981;
          display: flex;
          align-items: center;
          gap: 3px;
          margin-top: 2px;
        }

        .verified-badge-sm {
          font-size: 10px;
          color: #10b981;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          margin-left: 8px;
        }

        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .role-badge.farmer { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .role-badge.vendor { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .role-badge.admin { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .role-badge.default { background: rgba(107, 114, 128, 0.1); color: #6c757d; }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-badge.danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .status-badge.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .status-badge.info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

        .ban-reason-tooltip {
          display: inline-block;
          margin-left: 6px;
          cursor: help;
        }

        .ban-reason-tooltip i {
          font-size: 12px;
          color: #ef4444;
        }

        .date-info {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #4b5563;
        }

        .date-info i {
          font-size: 12px;
          color: #9ca3af;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .action-btn {
          padding: 6px 10px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
        }

        .action-btn.view { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .action-btn.view:hover { background: #4f46e5; color: white; }
        .action-btn.ban { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .action-btn.ban:hover { background: #ef4444; color: white; }
        .action-btn.unban { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .action-btn.unban:hover { background: #10b981; color: white; }
        .action-btn.delete { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .action-btn.delete:hover { background: #ef4444; color: white; }

        .role-select {
          padding: 6px 10px;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          font-size: 12px;
          background: white;
          cursor: pointer;
        }

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 24px;
        }

        .empty-state-icon {
          font-size: 80px;
          color: #cbd5e1;
          margin-bottom: 24px;
        }

        .empty-state h3 {
          font-size: 24px;
          margin-bottom: 12px;
          color: #1f2937;
        }

        .empty-state p {
          color: #6c757d;
          margin-bottom: 32px;
        }

        .btn-clear-filters {
          padding: 12px 32px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          animation: fadeIn 0.2s ease;
        }

        .modal-container {
          background: white;
          border-radius: 28px;
          width: 90%;
          max-width: 700px;
          max-height: 85vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
        }

        .modal-container.modal-lg {
          max-width: 800px;
        }

        .modal-header {
          padding: 24px 28px 20px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
        }

        .modal-header.warning .modal-icon-wrapper {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }

        .modal-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-icon-wrapper i {
          font-size: 24px;
        }

        .modal-header h2 {
          font-size: 20px;
          margin: 0 0 4px 0;
        }

        .modal-header p {
          margin: 0;
          color: #6c757d;
          font-size: 13px;
        }

        .modal-close {
          position: absolute;
          right: 20px;
          top: 20px;
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #9ca3af;
          transition: all 0.3s ease;
        }

        .modal-close:hover {
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 28px;
        }

        .modal-footer {
          padding: 16px 28px 28px;
          border-top: 1px solid #e9ecef;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .user-profile-header {
          display: flex;
          align-items: center;
          gap: 24px;
          padding-bottom: 24px;
          margin-bottom: 24px;
          border-bottom: 1px solid #e9ecef;
        }

        .user-avatar-large {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 600;
          color: white;
          overflow: hidden;
        }

        .user-avatar-large img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .user-profile-info h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
        }

        .user-meta {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }

        .user-id-full {
          font-size: 12px;
          color: #6c757d;
          font-family: monospace;
        }

        .user-avatar-small {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 18px;
          overflow: hidden;
        }

        .user-avatar-small img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ban-user-info {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 16px;
          margin-bottom: 20px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }

        .detail-section {
          background: #f8f9fa;
          border-radius: 16px;
          padding: 20px;
        }

        .detail-section.full-width {
          grid-column: span 2;
        }

        .detail-section h4 {
          margin: 0 0 16px 0;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        .detail-section h4 i {
          margin-right: 8px;
          color: #667eea;
        }

        .detail-item {
          margin-bottom: 12px;
        }

        .detail-item label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #6c757d;
          margin-bottom: 4px;
          text-transform: uppercase;
        }

        .detail-item p {
          margin: 0;
          font-size: 14px;
          color: #1f2937;
        }

        .ban-reason {
          color: #ef4444;
        }

        .user-bio {
          line-height: 1.6;
          color: #4b5563;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .form-textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
          resize: vertical;
        }

        .form-textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }

        .form-hint {
          display: block;
          margin-top: 6px;
          font-size: 11px;
          color: #9ca3af;
        }

        .warning-message {
          background: #fef3c7;
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: #92400e;
        }

        .btn-secondary {
          padding: 10px 20px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
        }

        .btn-primary {
          padding: 10px 24px;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-primary.danger {
          background: #ef4444;
          color: white;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Responsive */
        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .users-container {
            padding: 0 16px;
          }

          .hero-section {
            padding: 32px 24px;
          }

          .hero-content {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }

          .hero-text {
            flex-direction: column;
          }

          .hero-title {
            font-size: 24px;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .controls-bar {
            flex-direction: column;
          }

          .controls-left {
            width: 100%;
            flex-direction: column;
          }

          .search-box {
            width: 100%;
          }

          .filter-group {
            width: 100%;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .detail-section.full-width {
            grid-column: span 1;
          }

          .user-profile-header {
            flex-direction: column;
            text-align: center;
          }

          .user-meta {
            justify-content: center;
          }

          .action-buttons {
            flex-wrap: wrap;
          }

          .action-btn span {
            display: none;
          }
        }
      `}</style>
    </AdminLayout>
  )
}