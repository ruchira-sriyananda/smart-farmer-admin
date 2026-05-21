import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function UserDetails() {
  const router = useRouter()
  const { id } = router.query
  const [user, setUser] = useState(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (id) {
      fetchUserDetails()
      fetchUserActivities()
    }
  }, [id])

  const fetchUserDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select(`
          *,
          admin_roles (
            role_id,
            role_name,
            description
          )
        `)
        .eq('admin_id', id)
        .single()

      if (!error && data) {
        setUser(data)
      }
    } catch (err) {
      console.error('Error fetching user:', err)
    }
  }

  const fetchUserActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .eq('admin_id', id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && data) {
        setActivities(data)
      }
    } catch (err) {
      console.error('Error fetching activities:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusToggle = async () => {
    setUpdating(true)
    const { error } = await supabase
      .from('admin_users')
      .update({ 
        is_active: !user.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('admin_id', id)

    if (!error) {
      fetchUserDetails()
    }
    setUpdating(false)
  }

  const handleRoleChange = async (newRoleId) => {
    setUpdating(true)
    const { error } = await supabase
      .from('admin_users')
      .update({ 
        role_id: newRoleId,
        updated_at: new Date().toISOString()
      })
      .eq('admin_id', id)

    if (!error) {
      fetchUserDetails()
    }
    setUpdating(false)
  }

  if (loading) {
    return (
      <AdminLayout title="User Details">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  if (!user) {
    return (
      <AdminLayout title="User Details">
        <div className="alert alert-danger">User not found</div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title={`User: ${user.full_name}`}>
      <div className="row g-4">
        {/* User Profile Card */}
        <div className="col-md-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center">
              <div className="bg-gradient-primary rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: '100px', height: '100px' }}>
                <span className="text-white fw-bold fs-1">{user.full_name?.charAt(0).toUpperCase()}</span>
              </div>
              <h4 className="mb-1">{user.full_name}</h4>
              <p className="text-muted mb-2">{user.email}</p>
              <div className="mb-3">
                {user.is_super_admin && (
                  <span className="badge bg-danger me-1">Super Admin</span>
                )}
                <span className={`badge ${user.is_active ? 'bg-success' : 'bg-secondary'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="d-grid gap-2">
                <button 
                  className={`btn ${user.is_active ? 'btn-warning' : 'btn-success'}`}
                  onClick={handleStatusToggle}
                  disabled={updating}
                >
                  {updating ? (
                    <span className="spinner-border spinner-border-sm me-2"></span>
                  ) : (
                    <i className={`bi ${user.is_active ? 'bi-ban' : 'bi-check-circle'} me-2`}></i>
                  )}
                  {user.is_active ? 'Deactivate Account' : 'Activate Account'}
                </button>
                <button 
                  className="btn btn-outline-primary"
                  onClick={() => router.push(`/admin/users/${id}/edit`)}
                >
                  <i className="bi bi-pencil me-2"></i>Edit Profile
                </button>
              </div>
            </div>
          </div>

          {/* User Stats */}
          <div className="card border-0 shadow-sm mt-4">
            <div className="card-body">
              <h6 className="fw-bold mb-3">Account Statistics</h6>
              <div className="mb-2">
                <small className="text-muted d-block">Account Created</small>
                <strong>{new Date(user.created_at).toLocaleString()}</strong>
              </div>
              <div className="mb-2">
                <small className="text-muted d-block">Last Login</small>
                <strong>{user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</strong>
              </div>
              <div className="mb-2">
                <small className="text-muted d-block">Total Activities</small>
                <strong>{activities.length} actions</strong>
              </div>
            </div>
          </div>
        </div>

        {/* User Details */}
        <div className="col-md-8">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-info-circle me-2 text-primary"></i>
                User Information
              </h5>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label text-muted">Full Name</label>
                  <div className="border rounded p-2 bg-light">{user.full_name}</div>
                </div>
                <div className="col-md-6">
                  <label className="form-label text-muted">Email Address</label>
                  <div className="border rounded p-2 bg-light">{user.email}</div>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label text-muted">Role</label>
                  <div className="d-flex align-items-center gap-2">
                    <div className="border rounded p-2 bg-light flex-grow-1">
                      {user.admin_roles?.role_name || 'No Role Assigned'}
                    </div>
                    <div className="dropdown">
                      <button className="btn btn-outline-secondary btn-sm" data-bs-toggle="dropdown">
                        <i className="bi bi-arrow-repeat"></i>
                      </button>
                      <ul className="dropdown-menu">
                        <li><button className="dropdown-item" onClick={() => handleRoleChange(null)}>No Role</button></li>
                        <li><hr className="dropdown-divider" /></li>
                        <li><button className="dropdown-item" onClick={() => handleRoleChange('CONTENT_ADMIN')}>Content Admin</button></li>
                        <li><button className="dropdown-item" onClick={() => handleRoleChange('SECURITY_ADMIN')}>Security Admin</button></li>
                        <li><button className="dropdown-item" onClick={() => handleRoleChange('SUPPORT_ADMIN')}>Support Admin</button></li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label text-muted">Role Description</label>
                  <div className="border rounded p-2 bg-light">
                    {user.admin_roles?.description || 'No role description available'}
                  </div>
                </div>
              </div>

              {user.is_super_admin && (
                <div className="alert alert-warning">
                  <i className="bi bi-star-fill me-2"></i>
                  This user has Super Admin privileges and has full access to all system features.
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card border-0 shadow-sm mt-4">
            <div className="card-header bg-white border-0 pt-4">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-clock-history me-2 text-primary"></i>
                Recent Activity
              </h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="bg-light">
                    <tr>
                      <th>Activity</th>
                      <th>IP Address</th>
                      <th>Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map(activity => (
                      <tr key={activity.log_id}>
                        <td>{activity.activity_description}</td>
                        <td><code>{activity.ip_address || 'N/A'}</code></td>
                        <td>{new Date(activity.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {activities.length === 0 && (
                      <tr>
                        <td colSpan="3" className="text-center py-4 text-muted">
                          No activity recorded for this user
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .bg-gradient-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
      `}</style>
    </AdminLayout>
  )
}