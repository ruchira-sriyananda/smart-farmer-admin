import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchUsers()
  }, [])

  const checkAuth = async () => {
    const session = localStorage.getItem('adminSession')
    if (!session) {
      router.push('/admin/login')
    }
  }

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select(`
          *,
          admin_roles (
            role_name
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

  const handleBanUser = async (userId, currentStatus) => {
    if (confirm(`Are you sure you want to ${currentStatus ? 'ban' : 'unban'} this user?`)) {
      const { error } = await supabase
        .from('admin_users')
        .update({ is_active: !currentStatus })
        .eq('admin_id', userId)

      if (!error) {
        fetchUsers()
      }
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === 'all' || user.admin_roles?.role_name === selectedRole
    return matchesSearch && matchesRole
  })

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="spinner-border text-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-vh-100 bg-light">
      {/* Header */}
      <nav className="navbar navbar-dark bg-gradient-primary shadow-sm px-4 py-2">
        <div className="d-flex align-items-center">
          <button className="btn btn-link text-white me-3" onClick={() => router.push('/admin/dashboard')}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h5 className="text-white mb-0">User Management</h5>
        </div>
      </nav>

      <div className="container-fluid px-4 py-4">
        {/* Filters */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <i className="bi bi-search"></i>
                  </span>
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
                <button className="btn btn-primary w-100" onClick={() => router.push('/admin/users/create')}>
                  <i className="bi bi-person-plus me-2"></i>Add New User
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.admin_id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '35px', height: '35px' }}>
                            <span className="text-primary fw-bold">{user.full_name?.charAt(0)}</span>
                          </div>
                          <span className="fw-medium">{user.full_name}</span>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className="badge bg-info">{user.admin_roles?.role_name || 'No Role'}</span>
                      </td>
                      <td>
                        <span className={`badge ${user.is_active ? 'bg-success' : 'bg-danger'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                      <td>
                        <div className="dropdown">
                          <button className="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown">
                            <i className="bi bi-three-dots"></i>
                          </button>
                          <ul className="dropdown-menu">
                            <li><button className="dropdown-item" onClick={() => router.push(`/admin/users/${user.admin_id}`)}>
                              <i className="bi bi-eye me-2"></i>View Details
                            </button></li>
                            <li><button className="dropdown-item" onClick={() => router.push(`/admin/users/${user.admin_id}/edit`)}>
                              <i className="bi bi-pencil me-2"></i>Edit User
                            </button></li>
                            <li><hr className="dropdown-divider" /></li>
                            <li><button className="dropdown-item text-danger" onClick={() => handleBanUser(user.admin_id, user.is_active)}>
                              <i className={`bi ${user.is_active ? 'bi-ban' : 'bi-check-circle'} me-2`}></i>
                              {user.is_active ? 'Ban User' : 'Unban User'}
                            </button></li>
                          </ul>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .bg-gradient-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
      `}</style>
    </div>
  )
}