import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function UserManagement() {
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
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
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    superAdmins: 0
  })

  useEffect(() => {
    fetchCurrentAdmin()
    fetchUsers()
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

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch all admin_users
      const { data: usersData, error: usersError } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false })

      if (usersError) throw usersError

      if (usersData && usersData.length > 0) {
        // Get role IDs for mapping
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
        
        setStats({
          total: usersWithRoles.length,
          active: usersWithRoles.filter(u => u.is_active).length,
          inactive: usersWithRoles.filter(u => !u.is_active).length,
          superAdmins: usersWithRoles.filter(u => u.is_super_admin).length
        })
      } else {
        setUsers([])
        setStats({ total: 0, active: 0, inactive: 0, superAdmins: 0 })
      }
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isCurrentUser = (userId) => {
    return currentAdmin?.admin_id === userId
  }

  const canDeleteUser = (user) => {
    // Only Super Admin can delete, and cannot delete themselves
    return isSuperAdmin && !isCurrentUser(user.admin_id)
  }

  const canDeactivateUser = (user) => {
    // Super Admin can deactivate anyone except themselves
    if (isSuperAdmin && !isCurrentUser(user.admin_id)) return true
    // Other admins cannot deactivate anyone (including themselves)
    return false
  }

  const canEditUser = (user) => {
    // Super Admin can edit anyone
    if (isSuperAdmin) return true
    // Other admins can only edit themselves
    return isCurrentUser(user.admin_id)
  }

  const handleStatusToggle = (user) => {
    // Check permission before showing modal
    if (!canDeactivateUser(user)) {
      alert('You do not have permission to change this user\'s status')
      return
    }
    setSelectedUser(user)
    setShowStatusModal(true)
  }

  const confirmStatusChange = async () => {
    if (!selectedUser) return
    
    const newStatus = !selectedUser.is_active
    const { error } = await supabase
      .from('admin_users')
      .update({ is_active: newStatus })
      .eq('admin_id', selectedUser.admin_id)

    if (!error) {
      fetchUsers()
      setShowStatusModal(false)
      setSelectedUser(null)
    } else {
      alert('Error updating user status: ' + error.message)
    }
  }

  const handleDeleteClick = (user) => {
    // Check permission before showing modal
    if (!canDeleteUser(user)) {
      alert('You do not have permission to delete this user')
      return
    }
    setSelectedUser(user)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!selectedUser) return
    
    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('admin_id', selectedUser.admin_id)

    if (!error) {
      fetchUsers()
      setShowDeleteModal(false)
      setSelectedUser(null)
    } else {
      alert('Error deleting user: ' + error.message)
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
      'SUPER_ADMIN': <span className="badge-super-admin"><i className="bi bi-star-fill me-1"></i>Super Admin</span>,
      'CONTENT_ADMIN': <span className="badge-content-admin"><i className="bi bi-file-post me-1"></i>Content Admin</span>,
      'SECURITY_ADMIN': <span className="badge-security-admin"><i className="bi bi-shield-lock me-1"></i>Security Admin</span>,
      'SUPPORT_ADMIN': <span className="badge-support-admin"><i className="bi bi-headset me-1"></i>Support Admin</span>
    }
    return badges[roleName] || <span className="badge-default"><i className="bi bi-person me-1"></i>{roleName || 'No Role'}</span>
  }

  const uniqueRoles = [...new Set(users.map(u => u.admin_roles?.role_name).filter(Boolean))]

  if (loading) {
    return (
      <AdminLayout title="User Management">
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
        <style jsx>{`
          .error-container {
            text-align: center;
            padding: 60px 20px;
            background: white;
            border-radius: 24px;
            margin: 40px auto;
            max-width: 500px;
          }
          .error-container i {
            font-size: 48px;
            color: #dc3545;
            margin-bottom: 16px;
          }
          .error-container h3 {
            margin-bottom: 8px;
            color: #1f2937;
          }
          .error-container p {
            color: #6c757d;
            margin-bottom: 24px;
          }
          .retry-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            padding: 10px 24px;
            border-radius: 12px;
            color: white;
            font-weight: 500;
          }
        `}</style>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="User Management">
      <div className="user-management-container">
        {/* Header Section */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="bi bi-people-fill"></i>
              <span className="header-badge">{stats.total}</span>
            </div>
            <div>
              <h1 className="header-title">Administrators</h1>
              <p className="header-subtitle">Manage system administrators and their permissions</p>
            </div>
          </div>
          {isSuperAdmin && (
            <button className="create-btn" onClick={() => router.push('/admin/users/create')}>
              <i className="bi bi-person-plus-fill"></i>
              <span>Add Admin</span>
            </button>
          )}
        </div>

        {/* Role Info Banner */}
        <div className="role-info-banner">
          <i className="bi bi-shield-check"></i>
          <div>
            <strong>Your Role: {currentAdminRole}</strong>
            <span>
              {isSuperAdmin 
                ? 'You have full access to manage all users.' 
                : 'You can only edit your own profile.'}
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card stat-total">
            <div className="stat-icon"><i className="bi bi-people-fill"></i></div>
            <div className="stat-info">
              <span className="stat-label">Total Admins</span>
              <h2 className="stat-value">{stats.total}</h2>
            </div>
          </div>
          <div className="stat-card stat-active">
            <div className="stat-icon"><i className="bi bi-check-circle-fill"></i></div>
            <div className="stat-info">
              <span className="stat-label">Active</span>
              <h2 className="stat-value">{stats.active}</h2>
            </div>
          </div>
          <div className="stat-card stat-inactive">
            <div className="stat-icon"><i className="bi bi-x-circle-fill"></i></div>
            <div className="stat-info">
              <span className="stat-label">Inactive</span>
              <h2 className="stat-value">{stats.inactive}</h2>
            </div>
          </div>
          <div className="stat-card stat-super">
            <div className="stat-icon"><i className="bi bi-star-fill"></i></div>
            <div className="stat-info">
              <span className="stat-label">Super Admins</span>
              <h2 className="stat-value">{stats.superAdmins}</h2>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="search-filter-bar">
          <div className="search-wrapper">
            <i className="bi bi-search"></i>
            <input
              type="text"
              className="search-input"
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
          <button className="filter-btn" onClick={() => setShowFilter(!showFilter)}>
            <i className="bi bi-funnel-fill"></i>
            <span>Filter</span>
            {(selectedRole !== 'all' || selectedStatus !== 'all') && (
              <span className="filter-badge"></span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilter && (
          <div className="filter-panel">
            <div className="filter-group">
              <label className="filter-label">Role</label>
              <select className="filter-select" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                <option value="all">All Roles</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Status</label>
              <select className="filter-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button className="filter-reset" onClick={() => {
              setSelectedRole('all')
              setSelectedStatus('all')
            }}>
              <i className="bi bi-arrow-repeat"></i> Reset
            </button>
          </div>
        )}

        {/* Users Table */}
        <div className="users-table-container">
          <div className="table-header-info">
            <span className="result-count">
              <i className="bi bi-database"></i>
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
            </span>
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
                  <th>Created</th>
                  <th className="actions-col">Actions</th>
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
                      <tr key={user.admin_id} className={`user-row ${isSelf ? 'current-user-row' : ''}`}>
                        <td className="user-cell-wrapper">
                          <div className="user-cell">
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
                              {isSelf && (
                                <div className="current-badge">
                                  <i className="bi bi-person-check-fill"></i>
                                </div>
                              )}
                            </div>
                            <div className="user-info">
                              <div className="user-name">
                                {user.full_name}
                                {isSelf && <span className="current-label">(You)</span>}
                              </div>
                              <div className="user-id">ID: {user.admin_id?.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="contact-cell">
                          <div className="contact-email">
                            <i className="bi bi-envelope"></i>
                            {user.email}
                          </div>
                          {user.phone_number && (
                            <div className="contact-phone">
                              <i className="bi bi-telephone"></i>
                              {user.phone_number}
                            </div>
                          )}
                        </td>
                        <td>{getRoleBadge(user.admin_roles?.role_name)}</td>
                        <td>
                          <div className="status-cell">
                            <span className={`status-badge ${user.is_active ? 'status-active' : 'status-inactive'}`}>
                              <span className="status-dot"></span>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </td>
                        <td className="date-cell">
                          {user.last_login ? (
                            <>
                              <i className="bi bi-clock"></i>
                              {new Date(user.last_login).toLocaleDateString()}
                              <small>{new Date(user.last_login).toLocaleTimeString()}</small>
                            </>
                          ) : (
                            <span className="text-muted">Never</span>
                          )}
                        </td>
                        <td className="date-cell">
                          <i className="bi bi-calendar3"></i>
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              className="action-btn view-btn" 
                              onClick={() => router.push(`/admin/users/${user.admin_id}`)}
                              title="View Details"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            
                            {showEdit && (
                              <button 
                                className="action-btn edit-btn" 
                                onClick={() => router.push(`/admin/users/${user.admin_id}/edit`)}
                                title="Edit User"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                            )}
                            
                            {showDeactivate && (
                              <button 
                                className={`action-btn status-btn ${user.is_active ? 'deactivate' : 'activate'}`}
                                onClick={() => handleStatusToggle(user)}
                                title={user.is_active ? 'Deactivate' : 'Activate'}
                              >
                                <i className={`bi ${user.is_active ? 'bi-ban' : 'bi-check-circle'}`}></i>
                              </button>
                            )}
                            
                            {showDelete && (
                              <button 
                                className="action-btn delete-btn"
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
                        <p>Click "Add Admin" to create your first administrator.</p>
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
              <button className={`btn-primary ${selectedUser.is_active ? 'danger' : 'success'}`} onClick={confirmStatusChange}>
                {selectedUser.is_active ? 'Deactivate' : 'Activate'}
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
              <h3>Delete Admin</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to permanently delete <br />
                <span className="user-highlight">{selectedUser.full_name}</span>?
              </p>
              <div className="warning-message danger">
                <i className="bi bi-exclamation-triangle-fill"></i>
                This action cannot be undone. All data associated with this user will be lost.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn-primary danger" onClick={confirmDelete}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .user-management-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .header-icon {
          position: relative;
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-icon i {
          font-size: 28px;
          color: white;
        }

        .header-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: #ef4444;
          color: white;
          font-size: 12px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 12px;
        }

        .header-title {
          font-size: 24px;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 4px 0;
        }

        .header-subtitle {
          color: #6c757d;
          margin: 0;
          font-size: 14px;
        }

        .create-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 14px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .create-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }

        .role-info-banner {
          background: #e7f1ff;
          border-radius: 12px;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .role-info-banner i {
          font-size: 24px;
          color: #4f46e5;
        }

        .role-info-banner strong {
          display: block;
          font-size: 14px;
        }

        .role-info-banner span {
          font-size: 12px;
          color: #6c757d;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 28px;
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
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-total .stat-icon { background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); color: #667eea; }
        .stat-active .stat-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-inactive .stat-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .stat-super .stat-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }

        .stat-icon i { font-size: 24px; }

        .stat-info { flex: 1; }
        .stat-label { font-size: 13px; color: #6c757d; margin-bottom: 4px; display: block; }
        .stat-value { font-size: 28px; font-weight: 700; color: #1f2937; margin: 0; }

        .search-filter-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .search-wrapper {
          flex: 1;
          position: relative;
        }

        .search-wrapper i {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .search-input {
          width: 100%;
          padding: 12px 40px 12px 44px;
          border: 2px solid #e9ecef;
          border-radius: 14px;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .search-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .clear-search {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #9ca3af;
        }

        .filter-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 20px;
          background: white;
          border: 2px solid #e9ecef;
          border-radius: 14px;
          font-weight: 500;
          color: #495057;
          position: relative;
        }

        .filter-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 10px;
          height: 10px;
          background: #667eea;
          border-radius: 50%;
        }

        .filter-panel {
          background: white;
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 20px;
          display: flex;
          gap: 16px;
          align-items: flex-end;
          flex-wrap: wrap;
          border: 1px solid #e9ecef;
        }

        .filter-group {
          flex: 1;
          min-width: 150px;
        }

        .filter-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #6c757d;
          margin-bottom: 6px;
        }

        .filter-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          font-size: 14px;
        }

        .filter-reset {
          padding: 10px 16px;
          background: #f8f9fa;
          border: none;
          border-radius: 10px;
          color: #6c757d;
          font-size: 13px;
        }

        .users-table-container {
          background: white;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .table-header-info {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
          background: #fafbfc;
        }

        .result-count {
          font-size: 13px;
          color: #6c757d;
        }

        .result-count i {
          margin-right: 6px;
        }

        .users-table {
          width: 100%;
          border-collapse: collapse;
        }

        .users-table th {
          text-align: left;
          padding: 16px 20px;
          background: #f8f9fa;
          font-weight: 600;
          font-size: 13px;
          color: #495057;
          border-bottom: 1px solid #e9ecef;
        }

        .users-table td {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
          vertical-align: middle;
        }

        .user-row:hover {
          background: #fafbfc;
        }

        .current-user-row {
          background: #e7f1ff;
        }

        .user-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          position: relative;
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
          bottom: -4px;
          right: -4px;
          background: #f59e0b;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          border: 2px solid white;
        }

        .current-badge {
          position: absolute;
          top: -4px;
          left: -4px;
          background: #10b981;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          border: 2px solid white;
        }

        .user-info {
          flex: 1;
        }

        .user-name {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
        }

        .current-label {
          font-size: 11px;
          font-weight: normal;
          color: #10b981;
          margin-left: 6px;
        }

        .user-id {
          font-size: 11px;
          color: #9ca3af;
          font-family: monospace;
        }

        .contact-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .contact-email, .contact-phone {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
        }

        .contact-email i, .contact-phone i {
          color: #9ca3af;
          font-size: 12px;
        }

        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 500;
        }

        .badge-super-admin { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .badge-content-admin { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .badge-security-admin { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .badge-support-admin { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .badge-default { background: #f8f9fa; color: #6c757d; }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-active {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .status-inactive {
          background: rgba(239, 68, 68, 0.1);
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

        .date-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 12px;
          color: #6c757d;
        }

        .date-cell i {
          font-size: 11px;
          margin-right: 4px;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
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

        .view-btn { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .edit-btn { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-btn.deactivate { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .status-btn.activate { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .delete-btn { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

        .action-btn:hover {
          transform: translateY(-2px);
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-state i {
          font-size: 48px;
          color: #cbd5e1;
          margin-bottom: 16px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
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
          max-width: 450px;
          animation: slideUp 0.3s ease;
        }

        .modal-header {
          padding: 24px 24px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
        }

        .modal-header.warning .modal-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .modal-header.danger .modal-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

        .modal-icon {
          width: 48px;
          height: 48px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-icon i { font-size: 24px; }

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
          padding: 0 24px 24px;
        }

        .modal-body p {
          margin: 0 0 16px;
          line-height: 1.5;
          color: #4b5563;
        }

        .user-highlight {
          font-weight: 600;
          color: #1f2937;
          display: inline-block;
          margin-top: 4px;
        }

        .warning-message {
          background: #fff3cd;
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #856404;
        }

        .warning-message.danger {
          background: #f8d7da;
          color: #721c24;
        }

        .modal-footer {
          padding: 16px 24px 24px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
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

        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .filter-panel {
            flex-direction: column;
            align-items: stretch;
          }
          .users-table {
            display: block;
            overflow-x: auto;
          }
          .action-buttons {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </AdminLayout>
  )
}