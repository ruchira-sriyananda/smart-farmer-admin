import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function UserManagement() {
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [showFilter, setShowFilter] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [currentAdmin, setCurrentAdmin] = useState(null)
  const [currentAdminRole, setCurrentAdminRole] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState(null)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [userActivities, setUserActivities] = useState([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    superAdmins: 0,
    newThisMonth: 0
  })

  useEffect(() => {
    fetchCurrentAdmin()
    fetchUsers()
    fetchStats()
  }, [])

  const fetchCurrentAdmin = async () => {
    const session = localStorage.getItem('adminSession')
    if (session) {
      const parsed = JSON.parse(session)
      setCurrentAdmin(parsed.admin)
      setCurrentAdminRole(parsed.role || 'SUPPORT_ADMIN')
      setIsSuperAdmin(parsed.admin?.is_super_admin || false)
    }
  }

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('created_at, is_active, is_super_admin')

      if (!error && data) {
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const newThisMonth = data.filter(u => new Date(u.created_at) >= firstDayOfMonth).length

        setStats(prev => ({
          ...prev,
          newThisMonth
        }))
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data: usersData, error: usersError } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false })

      if (usersError) throw usersError

      if (usersData && usersData.length > 0) {
        const roleIds = [...new Set(usersData.map(u => u.role_id).filter(id => id))]
        
        let rolesMap = {}
        if (roleIds.length > 0) {
          const { data: rolesData, error: rolesError } = await supabase
            .from('admin_roles')
            .select('role_id, role_name, description')
            .in('role_id', roleIds)

          if (!rolesError && rolesData) {
            rolesMap = rolesData.reduce((acc, role) => {
              acc[role.role_id] = role
              return acc
            }, {})
          }
        }

        const usersWithRoles = usersData.map(user => ({
          ...user,
          admin_roles: rolesMap[user.role_id] || null
        }))

        setUsers(usersWithRoles)
        
        setStats(prev => ({
          ...prev,
          total: usersWithRoles.length,
          active: usersWithRoles.filter(u => u.is_active).length,
          inactive: usersWithRoles.filter(u => !u.is_active).length,
          superAdmins: usersWithRoles.filter(u => u.is_super_admin).length
        }))
      } else {
        setUsers([])
        setStats(prev => ({ ...prev, total: 0, active: 0, inactive: 0, superAdmins: 0 }))
      }
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserActivities = async (userId) => {
    setLoadingActivities(true)
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .eq('admin_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && data) {
        setUserActivities(data)
        setShowActivityModal(true)
      }
    } catch (err) {
      console.error('Error fetching activities:', err)
    } finally {
      setLoadingActivities(false)
    }
  }

  const isCurrentUser = (userId) => {
    return currentAdmin?.admin_id === userId
  }

  const canDeleteUser = (user) => {
    return isSuperAdmin && !isCurrentUser(user.admin_id)
  }

  const canDeactivateUser = (user) => {
    if (isSuperAdmin && !isCurrentUser(user.admin_id)) return true
    return false
  }

  const canEditUser = (user) => {
    if (isSuperAdmin) return true
    return isCurrentUser(user.admin_id)
  }

  const handleStatusToggle = (user) => {
    if (!canDeactivateUser(user)) {
      alert('You do not have permission to change this user\'s status')
      return
    }
    setSelectedUser(user)
    setShowStatusModal(true)
  }

  const confirmStatusChange = async () => {
    if (!selectedUser) return
    
    setDeleting(true)
    const newStatus = !selectedUser.is_active
    
    const { error } = await supabase
      .from('admin_users')
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('admin_id', selectedUser.admin_id)

    setDeleting(false)
    
    if (!error) {
      fetchUsers()
      setShowStatusModal(false)
      setSelectedUser(null)
      alert(`User ${newStatus ? 'activated' : 'deactivated'} successfully!`)
    } else {
      alert('Error updating user status: ' + error.message)
    }
  }

  const handleDeleteClick = (user) => {
    if (!canDeleteUser(user)) {
      alert('You do not have permission to delete this user')
      return
    }
    setSelectedUser(user)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!selectedUser) return
    
    setDeleting(true)
    setDeleteProgress('Deleting user account...')
    
    try {
      setDeleteProgress('Removing from admin records...')
      
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          adminId: selectedUser.admin_id,
          userId: selectedUser.admin_id,
          userEmail: selectedUser.email,
          isAdminUser: true
        })
      })

      const result = await response.json()

      if (result.success) {
        setDeleteProgress('Cleaning up associated data...')
        await new Promise(resolve => setTimeout(resolve, 500))
        
        alert(`✅ ${result.message}\n\nCleaned up: ${result.deletedTables?.join(', ') || 'All related data'}`)
        fetchUsers()
        setShowDeleteModal(false)
        setSelectedUser(null)
      } else {
        alert('❌ Error deleting user: ' + result.error)
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('❌ Error deleting user: ' + err.message)
    } finally {
      setDeleting(false)
      setDeleteProgress(null)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === 'all' || user.admin_roles?.role_name === selectedRole
    const matchesStatus = selectedStatus === 'all' || 
                          (selectedStatus === 'active' && user.is_active) ||
                          (selectedStatus === 'inactive' && !user.is_active)
    return matchesSearch && matchesRole && matchesStatus
  })

  const getRoleBadge = (roleName) => {
    const badges = {
      'SUPER_ADMIN': <span className="role-badge super-admin"><i className="bi bi-star-fill"></i>Super Admin</span>,
      'CONTENT_ADMIN': <span className="role-badge content-admin"><i className="bi bi-file-post"></i>Content Admin</span>,
      'SECURITY_ADMIN': <span className="role-badge security-admin"><i className="bi bi-shield-lock"></i>Security Admin</span>,
      'SUPPORT_ADMIN': <span className="role-badge support-admin"><i className="bi bi-headset"></i>Support Admin</span>
    }
    return badges[roleName] || <span className="role-badge default"><i className="bi bi-person"></i>{roleName || 'No Role'}</span>
  }

  const getActivityIcon = (type) => {
    const icons = {
      'LOGIN': 'bi-box-arrow-in-right',
      'LOGOUT': 'bi-box-arrow-right',
      'USER_MANAGEMENT': 'bi-people',
      'CONTENT_MODERATION': 'bi-file-post',
      'SETTINGS_UPDATE': 'bi-gear',
      'PROFILE_UPDATE': 'bi-person-gear'
    }
    return icons[type] || 'bi-activity'
  }

  const getActivityColor = (type) => {
    const colors = {
      'LOGIN': 'success',
      'LOGOUT': 'warning',
      'USER_MANAGEMENT': 'primary',
      'CONTENT_MODERATION': 'info',
      'SETTINGS_UPDATE': 'secondary',
      'PROFILE_UPDATE': 'success'
    }
    return colors[type] || 'secondary'
  }

  const uniqueRoles = [...new Set(users.map(u => u.admin_roles?.role_name).filter(Boolean))]

  if (loading) {
    return (
      <AdminLayout title="User Management">
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-animation">
              <div className="loading-circle"></div>
              <div className="loading-circle delay-1"></div>
              <div className="loading-circle delay-2"></div>
            </div>
            <h3>Loading users...</h3>
            <p>Please wait while we fetch user data</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout title="User Management">
        <div className="error-container">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <h3>Failed to Load Users</h3>
          <p>{error}</p>
          <button className="retry-btn" onClick={fetchUsers}>
            <i className="bi bi-arrow-repeat"></i> Try Again
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="User Management">
      <div className="user-management-container">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-content">
            <div className="hero-text">
              <div className="hero-icon-wrapper">
                <i className="bi bi-people-fill"></i>
              </div>
              <div>
                <h1 className="hero-title">User Management</h1>
                <p className="hero-subtitle">Manage system administrators and their permissions</p>
              </div>
            </div>
            <div className="hero-actions">
              {isSuperAdmin && (
                <button className="btn-create" onClick={() => router.push('/admin/users/create')}>
                  <i className="bi bi-person-plus-fill"></i>
                  Add Admin
                </button>
              )}
              <button className="btn-mobile" onClick={() => router.push('/admin/mobile-users')}>
                <i className="bi bi-phone"></i>
                Mobile Users
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-wrapper">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon total">
                <i className="bi bi-people"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Admins</span>
                <h3>{stats.total}</h3>
                <span className="stat-trend">All administrators</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon active">
                <i className="bi bi-check-circle"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Active</span>
                <h3 className="text-success">{stats.active}</h3>
                <span className="stat-trend">Currently active</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon inactive">
                <i className="bi bi-x-circle"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Inactive</span>
                <h3 className="text-danger">{stats.inactive}</h3>
                <span className="stat-trend">Deactivated accounts</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon super">
                <i className="bi bi-star"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Super Admins</span>
                <h3 className="text-warning">{stats.superAdmins}</h3>
                <span className="stat-trend">Full access</span>
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
                placeholder="Search by name or email..." 
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
              <button className={`filter-btn ${showFilter ? 'active' : ''}`} onClick={() => setShowFilter(!showFilter)}>
                <i className="bi bi-funnel"></i>
                Filters
                {(selectedRole !== 'all' || selectedStatus !== 'all') && <span className="filter-badge"></span>}
              </button>
              
              {showFilter && (
                <div className="filter-dropdown">
                  <div className="filter-section">
                    <label>Role</label>
                    <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                      <option value="all">All Roles</option>
                      {uniqueRoles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-section">
                    <label>Status</label>
                    <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <button className="reset-filters" onClick={() => {
                    setSelectedRole('all')
                    setSelectedStatus('all')
                  }}>
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="controls-right">
            <div className="info-text">
              <i className="bi bi-info-circle"></i>
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </div>
        </div>

        {/* Role Info Banner */}
        <div className="role-banner">
          <div className="role-icon">
            <i className="bi bi-shield-check"></i>
          </div>
          <div className="role-info">
            <strong>Your Role: {currentAdminRole}</strong>
            <span>
              {isSuperAdmin 
                ? 'You have full access to manage all users and system settings.' 
                : 'You can only edit your own profile. Contact a Super Admin for elevated permissions.'}
            </span>
          </div>
        </div>

        {/* Users Table */}
        <div className="users-table-container">
          <div className="table-header">
            <div className="table-title">
              <i className="bi bi-person-badge"></i>
              <span>Administrators List</span>
            </div>
          </div>
          
          <div className="table-responsive">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => {
                    const isSelf = isCurrentUser(user.admin_id)
                    const showDelete = canDeleteUser(user)
                    const showDeactivate = canDeactivateUser(user)
                    const showEdit = canEditUser(user)
                    
                    return (
                      <tr key={user.admin_id} className={`user-row ${isSelf ? 'current-user' : ''}`}>
                        <td className="user-cell">
                          <div className="user-avatar-wrapper">
                            <div className="user-avatar">
                              {user.profile_image ? (
                                <img src={user.profile_image} alt={user.full_name} />
                              ) : (
                                <span>{user.full_name?.charAt(0) || 'A'}</span>
                              )}
                              {user.is_super_admin && (
                                <div className="super-badge">
                                  <i className="bi bi-star-fill"></i>
                                </div>
                              )}
                            </div>
                            <div className="user-details">
                              <div className="user-name">
                                {user.full_name}
                                {isSelf && <span className="self-badge">You</span>}
                              </div>
                              <div className="user-id">ID: {user.admin_id?.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="contact-cell">
                          <div className="contact-item">
                            <i className="bi bi-envelope"></i>
                            <span>{user.email}</span>
                          </div>
                          {user.phone_number && (
                            <div className="contact-item">
                              <i className="bi bi-telephone"></i>
                              <span>{user.phone_number}</span>
                            </div>
                          )}
                        </td>
                        <td className="role-cell">
                          {getRoleBadge(user.admin_roles?.role_name)}
                        </td>
                        <td className="status-cell">
                          <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                            <span className="status-dot"></span>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="date-cell">
                          {user.last_login ? (
                            <div className="date-info">
                              <i className="bi bi-clock"></i>
                              <span>{new Date(user.last_login).toLocaleDateString()}</span>
                            </div>
                          ) : (
                            <span className="text-muted">Never</span>
                          )}
                        </td>
                        <td className="date-cell">
                          <div className="date-info">
                            <i className="bi bi-calendar3"></i>
                            <span>{new Date(user.created_at).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="actions-cell">
                          <div className="action-buttons">
                            <button 
                              className="action-btn view" 
                              onClick={() => router.push(`/admin/users/${user.admin_id}`)}
                              title="View Details"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            
                            <button 
                              className="action-btn activity" 
                              onClick={() => fetchUserActivities(user.admin_id)}
                              title="View Activity"
                            >
                              <i className="bi bi-clock-history"></i>
                            </button>
                            
                            {showEdit && (
                              <button 
                                className="action-btn edit" 
                                onClick={() => router.push(`/admin/users/${user.admin_id}/edit`)}
                                title="Edit User"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                            )}
                            
                            {showDeactivate && (
                              <button 
                                className={`action-btn ${user.is_active ? 'deactivate' : 'activate'}`}
                                onClick={() => handleStatusToggle(user)}
                                title={user.is_active ? 'Deactivate' : 'Activate'}
                              >
                                <i className={`bi ${user.is_active ? 'bi-ban' : 'bi-check-circle'}`}></i>
                              </button>
                            )}
                            
                            {showDelete && (
                              <button 
                                className="action-btn delete"
                                onClick={() => handleDeleteClick(user)}
                                title="Delete User"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr className="empty-row">
                    <td colSpan="7">
                      <div className="empty-state">
                        <i className="bi bi-people"></i>
                        <h4>No users found</h4>
                        <p>No administrators match your search criteria.</p>
                        <button className="btn-clear" onClick={() => {
                          setSearchTerm('')
                          setSelectedRole('all')
                          setSelectedStatus('all')
                        }}>
                          <i className="bi bi-arrow-repeat"></i> Clear Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Status Confirmation Modal */}
      {showStatusModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header warning">
              <div className="modal-icon">
                <i className={`bi ${selectedUser.is_active ? 'bi-ban' : 'bi-check-circle'}`}></i>
              </div>
              <h3>{selectedUser.is_active ? 'Deactivate Admin' : 'Activate Admin'}</h3>
              <button className="modal-close" onClick={() => setShowStatusModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to <strong>{selectedUser.is_active ? 'deactivate' : 'activate'}</strong>
                <br />
                <span className="user-highlight">{selectedUser.full_name}</span>?
              </p>
              {selectedUser.is_active && (
                <div className="warning-message">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  Deactivated users will lose access to the admin panel immediately.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowStatusModal(false)}>Cancel</button>
              <button className={`btn-primary ${selectedUser.is_active ? 'danger' : 'success'}`} onClick={confirmStatusChange} disabled={deleting}>
                {deleting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Processing...
                  </>
                ) : (
                  selectedUser.is_active ? 'Deactivate' : 'Activate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header danger">
              <div className="modal-icon">
                <i className="bi bi-trash-fill"></i>
              </div>
              <h3>Delete Admin User</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to permanently delete <br />
                <span className="user-highlight">{selectedUser.full_name}</span>?
              </p>
              
              {deleteProgress && (
                <div className="delete-progress">
                  <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                  {deleteProgress}
                </div>
              )}
              
              <div className="warning-message danger">
                <i className="bi bi-exclamation-triangle-fill"></i>
                <strong>This will permanently remove:</strong>
                <ul>
                  <li>User from admin_users table</li>
                  <li>User from authentication system</li>
                  <li>All activity logs by this user</li>
                  <li>All admin sessions</li>
                  <li>References in security alerts</li>
                </ul>
              </div>
              <div className="warning-message info">
                <i className="bi bi-info-circle-fill"></i>
                This action cannot be undone. All associated data will be permanently deleted.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button 
                className="btn-primary danger" 
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Deleting...
                  </>
                ) : (
                  'Delete Permanently'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {showActivityModal && (
        <div className="modal-overlay" onClick={() => setShowActivityModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header info">
              <div className="modal-icon">
                <i className="bi bi-clock-history"></i>
              </div>
              <h3>User Activity Log</h3>
              <button className="modal-close" onClick={() => setShowActivityModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              {loadingActivities ? (
                <div className="loading-activities">
                  <div className="spinner-border text-primary"></div>
                  <p>Loading activities...</p>
                </div>
              ) : userActivities.length > 0 ? (
                <div className="activity-timeline">
                  {userActivities.map((activity, idx) => (
                    <div key={idx} className="timeline-item">
                      <div className={`timeline-icon bg-${getActivityColor(activity.activity_type)}`}>
                        <i className={`bi ${getActivityIcon(activity.activity_type)}`}></i>
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <span className="timeline-type">{activity.activity_type}</span>
                          <span className="timeline-date">{new Date(activity.created_at).toLocaleString()}</span>
                        </div>
                        <p className="timeline-description">{activity.activity_description}</p>
                        {activity.ip_address && (
                          <div className="timeline-meta">
                            <i className="bi bi-ip"></i>
                            <span>IP: {activity.ip_address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-activities">
                  <i className="bi bi-inbox"></i>
                  <p>No activity records found for this user.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowActivityModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .user-management-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* Loading Screen */
        .loading-screen {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 500px;
        }

        .loading-content {
          text-align: center;
        }

        .loading-animation {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 24px;
        }

        .loading-circle {
          width: 12px;
          height: 12px;
          background: #667eea;
          border-radius: 50%;
          animation: bounce 1.4s ease-in-out infinite;
        }

        .delay-1 { animation-delay: 0.2s; }
        .delay-2 { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
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

        .hero-actions {
          display: flex;
          gap: 12px;
        }

        .btn-create, .btn-mobile {
          padding: 10px 24px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
        }

        .btn-create {
          background: white;
          color: #667eea;
        }

        .btn-mobile {
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
        }

        .btn-create:hover, .btn-mobile:hover {
          transform: translateY(-2px);
        }

        /* Stats Section */
        .stats-wrapper {
          margin-bottom: 32px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
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

        .stat-icon.total { background: linear-gradient(135deg, #667eea20, #764ba220); color: #667eea; }
        .stat-icon.active { background: rgba(16,185,129,0.1); color: #10b981; }
        .stat-icon.inactive { background: rgba(239,68,68,0.1); color: #ef4444; }
        .stat-icon.super { background: rgba(245,158,11,0.1); color: #f59e0b; }

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
        }

        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }
        .text-warning { color: #f59e0b; }

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
          position: relative;
        }

        .filter-btn {
          padding: 10px 20px;
          background: #f8f9fa;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          position: relative;
        }

        .filter-btn.active {
          border-color: #667eea;
          background: rgba(102,126,234,0.05);
          color: #667eea;
        }

        .filter-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
        }

        .filter-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 8px;
          background: white;
          border-radius: 16px;
          padding: 20px;
          min-width: 240px;
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
          z-index: 100;
          animation: fadeInDown 0.2s ease;
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .filter-section {
          margin-bottom: 16px;
        }

        .filter-section label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .filter-section select {
          width: 100%;
          padding: 8px 12px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
        }

        .reset-filters {
          width: 100%;
          padding: 8px;
          background: #f8f9fa;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
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

        /* Role Banner */
        .role-banner {
          background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
          border-radius: 16px;
          padding: 16px 20px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .role-icon {
          width: 48px;
          height: 48px;
          background: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .role-icon i {
          font-size: 24px;
          color: #667eea;
        }

        .role-info strong {
          display: block;
          font-size: 14px;
          color: #1e40af;
        }

        .role-info span {
          font-size: 12px;
          color: #3b82f6;
        }

        /* Users Table */
        .users-table-container {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .table-header {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
          background: #f8f9fa;
        }

        .table-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: #1f2937;
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

        .user-row.current-user {
          background: rgba(102,126,234,0.05);
        }

        /* User Cell */
        .user-avatar-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          position: relative;
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 16px;
          overflow: hidden;
        }

        .user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .super-badge {
          position: absolute;
          bottom: -2px;
          right: -2px;
          background: #f59e0b;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          border: 2px solid white;
        }

        .user-details {
          flex: 1;
        }

        .user-name {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 2px;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .self-badge {
          font-size: 10px;
          background: #10b981;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .user-id {
          font-size: 10px;
          color: #9ca3af;
          font-family: monospace;
        }

        /* Contact Cell */
        .contact-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .contact-item i {
          font-size: 12px;
          color: #9ca3af;
        }

        /* Role Badges */
        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .role-badge.super-admin { background: rgba(239,68,68,0.1); color: #ef4444; }
        .role-badge.content-admin { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .role-badge.security-admin { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .role-badge.support-admin { background: rgba(16,185,129,0.1); color: #10b981; }
        .role-badge.default { background: rgba(107,114,128,0.1); color: #6c757d; }

        /* Status Badge */
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.active {
          background: rgba(16,185,129,0.1);
          color: #10b981;
        }

        .status-badge.inactive {
          background: rgba(239,68,68,0.1);
          color: #ef4444;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Date Cell */
        .date-info {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #6c757d;
        }

        .date-info i {
          font-size: 11px;
        }

        .text-muted {
          color: #9ca3af;
          font-size: 12px;
        }

        /* Action Buttons */
        .action-buttons {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-btn.view { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .action-btn.activity { background: rgba(107,114,128,0.1); color: #6c757d; }
        .action-btn.edit { background: rgba(16,185,129,0.1); color: #10b981; }
        .action-btn.deactivate { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .action-btn.activate { background: rgba(16,185,129,0.1); color: #10b981; }
        .action-btn.delete { background: rgba(239,68,68,0.1); color: #ef4444; }

        .action-btn:hover {
          transform: translateY(-2px);
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-state i {
          font-size: 48px;
          color: #cbd5e1;
          margin-bottom: 16px;
        }

        .empty-state h4 {
          margin-bottom: 8px;
          color: #1f2937;
        }

        .empty-state p {
          color: #6c757d;
          margin-bottom: 20px;
        }

        .btn-clear {
          padding: 8px 20px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 500;
          cursor: pointer;
        }

        /* Error Container */
        .error-container {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 24px;
          max-width: 500px;
          margin: 40px auto;
        }

        .error-container i {
          font-size: 48px;
          color: #dc3545;
          margin-bottom: 16px;
        }

        .error-container h3 {
          margin-bottom: 8px;
        }

        .retry-btn {
          margin-top: 20px;
          padding: 10px 24px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 500;
          cursor: pointer;
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
          border-radius: 24px;
          width: 90%;
          max-width: 500px;
          max-height: 85vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
        }

        .modal-container.modal-lg {
          max-width: 700px;
        }

        .modal-header {
          padding: 24px 24px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          border-bottom: 1px solid #e9ecef;
        }

        .modal-header.warning .modal-icon { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .modal-header.danger .modal-icon { background: rgba(239,68,68,0.1); color: #ef4444; }
        .modal-header.info .modal-icon { background: rgba(59,130,246,0.1); color: #3b82f6; }

        .modal-icon {
          width: 48px;
          height: 48px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-icon i {
          font-size: 24px;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
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
        }

        .modal-body {
          padding: 24px;
        }

        .modal-footer {
          padding: 16px 24px 24px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          border-top: 1px solid #e9ecef;
        }

        .user-highlight {
          font-weight: 600;
          color: #1f2937;
          display: inline-block;
          margin-top: 4px;
        }

        .warning-message {
          background: #fef3c7;
          padding: 12px;
          border-radius: 12px;
          margin-bottom: 12px;
          font-size: 13px;
          color: #856404;
        }

        .warning-message.danger {
          background: #f8d7da;
          color: #721c24;
        }

        .warning-message.info {
          background: #d1ecf1;
          color: #0c5460;
        }

        .warning-message ul {
          margin-top: 8px;
          padding-left: 20px;
        }

        .delete-progress {
          background: #e7f1ff;
          padding: 12px;
          border-radius: 12px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
        }

        /* Activity Timeline */
        .activity-timeline {
          max-height: 500px;
          overflow-y: auto;
        }

        .timeline-item {
          display: flex;
          gap: 16px;
          padding: 16px 0;
          border-bottom: 1px solid #e9ecef;
        }

        .timeline-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }

        .bg-success { background: #10b981; }
        .bg-warning { background: #f59e0b; }
        .bg-primary { background: #4f46e5; }
        .bg-info { background: #0dcaf0; }
        .bg-secondary { background: #6c757d; }

        .timeline-content {
          flex: 1;
        }

        .timeline-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .timeline-type {
          font-weight: 600;
          font-size: 14px;
          color: #1f2937;
        }

        .timeline-date {
          font-size: 11px;
          color: #9ca3af;
        }

        .timeline-description {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: #4b5563;
        }

        .timeline-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #9ca3af;
        }

        .empty-activities {
          text-align: center;
          padding: 60px 20px;
          color: #9ca3af;
        }

        .empty-activities i {
          font-size: 48px;
          margin-bottom: 16px;
          display: block;
        }

        .loading-activities {
          text-align: center;
          padding: 60px;
        }

        /* Buttons */
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

        .btn-primary.danger { background: #ef4444; color: white; }
        .btn-primary.success { background: #10b981; color: white; }

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
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .user-management-container {
            padding: 0 16px;
          }

          .hero-section {
            padding: 32px 24px;
          }

          .hero-content {
            flex-direction: column;
            text-align: center;
            gap: 20px;
          }

          .hero-text {
            flex-direction: column;
          }

          .hero-title {
            font-size: 24px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
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

          .filter-btn {
            width: 100%;
            justify-content: center;
          }

          .action-buttons {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </AdminLayout>
  )
}