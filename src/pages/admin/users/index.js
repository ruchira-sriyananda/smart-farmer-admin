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
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    superAdmins: 0
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // First, fetch all admin_users
      const { data: usersData, error: usersError } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false })

      if (usersError) throw usersError

      if (usersData && usersData.length > 0) {
        // Get role IDs from users
        const roleIds = [...new Set(usersData.map(u => u.role_id).filter(id => id))]
        
        // Fetch roles separately if there are role IDs
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

        // Combine users with their roles
        const usersWithRoles = usersData.map(user => ({
          ...user,
          admin_roles: rolesMap[user.role_id] || null
        }))

        setUsers(usersWithRoles)
        
        // Calculate stats
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

  const handleStatusToggle = async (userId, currentStatus) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    if (confirm(`Are you sure you want to ${action} this user?`)) {
      const { error } = await supabase
        .from('admin_users')
        .update({ is_active: !currentStatus })
        .eq('admin_id', userId)

      if (!error) {
        fetchUsers()
      } else {
        alert('Error updating user status: ' + error.message)
      }
    }
  }

  const handleDeleteUser = async (userId, userName) => {
    if (confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('admin_id', userId)

      if (!error) {
        fetchUsers()
      } else {
        alert('Error deleting user: ' + error.message)
      }
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
      'SUPER_ADMIN': <span className="badge bg-danger px-3 py-1 rounded-pill"><i className="bi bi-star-fill me-1"></i>Super Admin</span>,
      'CONTENT_ADMIN': <span className="badge bg-info px-3 py-1 rounded-pill"><i className="bi bi-file-post me-1"></i>Content Admin</span>,
      'SECURITY_ADMIN': <span className="badge bg-warning px-3 py-1 rounded-pill"><i className="bi bi-shield-lock me-1"></i>Security Admin</span>,
      'SUPPORT_ADMIN': <span className="badge bg-success px-3 py-1 rounded-pill"><i className="bi bi-headset me-1"></i>Support Admin</span>
    }
    return badges[roleName] || <span className="badge bg-secondary px-3 py-1 rounded-pill">{roleName || 'No Role'}</span>
  }

  if (loading) {
    return (
      <AdminLayout title="User Management">
        <div className="d-flex justify-content-center align-items-center min-vh-50">
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}></div>
            <p className="text-muted">Loading users...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout title="User Management">
        <div className="alert alert-danger m-4">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Error loading users: {error}
          <button className="btn btn-sm btn-outline-danger ms-3" onClick={fetchUsers}>Retry</button>
        </div>
      </AdminLayout>
    )
  }

  // Get unique roles for filter
  const uniqueRoles = [...new Set(users.map(u => u.admin_roles?.role_name).filter(Boolean))]

  return (
    <AdminLayout title="User Management">
      {/* Stats Cards */}
      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-primary bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Total Admins</h6>
                  <h3 className="mb-0 fw-bold">{stats.total}</h3>
                </div>
                <i className="bi bi-people-fill fs-1 text-primary"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-success bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Active Admins</h6>
                  <h3 className="mb-0 fw-bold text-success">{stats.active}</h3>
                </div>
                <i className="bi bi-check-circle-fill fs-1 text-success"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-secondary bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Inactive Admins</h6>
                  <h3 className="mb-0 fw-bold text-secondary">{stats.inactive}</h3>
                </div>
                <i className="bi bi-person-x-fill fs-1 text-secondary"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm bg-warning bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Super Admins</h6>
                  <h3 className="mb-0 fw-bold text-warning">{stats.superAdmins}</h3>
                </div>
                <i className="bi bi-star-fill fs-1 text-warning"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <div className="input-group">
                <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-3">
              <select className="form-select" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                <option value="all">All Roles</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <select className="form-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary w-100" onClick={() => router.push('/admin/users/create')}>
                <i className="bi bi-person-plus me-2"></i>Add User
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="bg-light">
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.admin_id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                            <span className="text-primary fw-bold">{user.full_name?.charAt(0) || 'A'}</span>
                          </div>
                          <div>
                            <div className="fw-semibold">{user.full_name}</div>
                            {user.is_super_admin && <small className="text-warning">Super Admin</small>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>{user.email}</div>
                        {user.phone_number && <small className="text-muted">{user.phone_number}</small>}
                      </td>
                      <td>{getRoleBadge(user.admin_roles?.role_name)}</td>
                      <td>
                        <span className={`badge ${user.is_active ? 'bg-success' : 'bg-secondary'} rounded-pill`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="btn-group">
                          <button 
                            className="btn btn-sm btn-outline-primary" 
                            onClick={() => router.push(`/admin/users/${user.admin_id}`)}
                            title="View Details"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          <button 
                            className="btn btn-sm btn-outline-secondary" 
                            onClick={() => router.push(`/admin/users/${user.admin_id}/edit`)}
                            title="Edit User"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button 
                            className={`btn btn-sm ${user.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                            onClick={() => handleStatusToggle(user.admin_id, user.is_active)}
                            title={user.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <i className={`bi ${user.is_active ? 'bi-ban' : 'bi-check-circle'}`}></i>
                          </button>
                          <button 
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteUser(user.admin_id, user.full_name)}
                            title="Delete User"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      {searchTerm || selectedRole !== 'all' || selectedStatus !== 'all' ? 
                        'No matching users found' : 
                        'No users found. Click "Add User" to create one.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}