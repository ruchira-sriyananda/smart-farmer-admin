import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function UserManagement() {
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select(`
          *,
          admin_roles (
            role_name,
            description
          )
        `)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setUsers(data)
      }
    } catch (err) {
      console.error('Error fetching users:', err)
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
      }
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return

    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('admin_id', selectedUser.admin_id)

    if (!error) {
      setShowDeleteModal(false)
      fetchUsers()
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
      'SUPER_ADMIN': <span className="badge bg-danger">Super Admin</span>,
      'CONTENT_ADMIN': <span className="badge bg-info">Content Admin</span>,
      'SECURITY_ADMIN': <span className="badge bg-warning">Security Admin</span>,
      'SUPPORT_ADMIN': <span className="badge bg-success">Support Admin</span>
    }
    return badges[roleName] || <span className="badge bg-secondary">{roleName}</span>
  }

  if (loading) {
    return (
      <AdminLayout title="User Management">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="User Management">
      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-0 bg-primary bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Total Users</h6>
                  <h3 className="mb-0 fw-bold">{users.length}</h3>
                </div>
                <i className="bi bi-people fs-1 text-primary"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-success bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Active Users</h6>
                  <h3 className="mb-0 fw-bold">{users.filter(u => u.is_active).length}</h3>
                </div>
                <i className="bi bi-check-circle fs-1 text-success"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-warning bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Inactive Users</h6>
                  <h3 className="mb-0 fw-bold">{users.filter(u => !u.is_active).length}</h3>
                </div>
                <i className="bi bi-ban fs-1 text-warning"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-info bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Super Admins</h6>
                  <h3 className="mb-0 fw-bold">{users.filter(u => u.is_super_admin).length}</h3>
                </div>
                <i className="bi bi-star fs-1 text-info"></i>
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
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="CONTENT_ADMIN">Content Admin</option>
                <option value="SECURITY_ADMIN">Security Admin</option>
                <option value="SUPPORT_ADMIN">Support Admin</option>
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
                {filteredUsers.map(user => (
                  <tr key={user.admin_id}>
                    <td>
                      <div className="d-flex align-items-center">
                        <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '36px', height: '36px' }}>
                          <span className="text-primary fw-bold">{user.full_name?.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="fw-medium">{user.full_name}</div>
                          {user.is_super_admin && <small className="text-warning">Super Admin</small>}
                        </div>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>{getRoleBadge(user.admin_roles?.role_name)}</td>
                    <td>
                      <span className={`badge ${user.is_active ? 'bg-success' : 'bg-secondary'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-sm btn-outline-primary" onClick={() => router.push(`/admin/users/${user.admin_id}`)}>
                          <i className="bi bi-eye"></i>
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => router.push(`/admin/users/${user.admin_id}/edit`)}>
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleStatusToggle(user.admin_id, user.is_active)}>
                          <i className={`bi ${user.is_active ? 'bi-ban' : 'bi-check-circle'}`}></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">Confirm Delete</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete user <strong>{selectedUser?.full_name}</strong>?</p>
                <p className="text-danger small mb-0">This action cannot be undone!</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleDeleteUser}>Delete User</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}