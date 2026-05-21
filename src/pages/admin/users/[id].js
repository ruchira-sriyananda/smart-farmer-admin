import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function UserDetails() {
  const router = useRouter()
  const { id } = router.query
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchUserDetails()
    }
  }, [id])

  const fetchUserDetails = async () => {
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
        .eq('admin_id', id)
        .single()

      if (!error && data) {
        setUser(data)
      }
    } catch (err) {
      console.error('Error fetching user:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusToggle = async () => {
    const { error } = await supabase
      .from('admin_users')
      .update({ is_active: !user.is_active })
      .eq('admin_id', id)

    if (!error) {
      fetchUserDetails()
    }
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
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start mb-4">
            <div className="d-flex align-items-center">
              <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '60px', height: '60px' }}>
                <span className="text-primary fw-bold fs-2">{user.full_name?.charAt(0)}</span>
              </div>
              <div>
                <h4 className="mb-1">{user.full_name}</h4>
                <p className="text-muted mb-0">{user.email}</p>
              </div>
            </div>
            <button className="btn btn-outline-secondary" onClick={() => router.back()}>
              <i className="bi bi-arrow-left me-2"></i>Back
            </button>
          </div>

          <div className="row g-4">
            <div className="col-md-6">
              <div className="border rounded p-3">
                <small className="text-muted d-block mb-1">Role</small>
                <strong>{user.admin_roles?.role_name || 'No Role'}</strong>
              </div>
            </div>
            <div className="col-md-6">
              <div className="border rounded p-3">
                <small className="text-muted d-block mb-1">Status</small>
                <span className={`badge ${user.is_active ? 'bg-success' : 'bg-danger'} fs-6`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="col-md-6">
              <div className="border rounded p-3">
                <small className="text-muted d-block mb-1">Last Login</small>
                <strong>{user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</strong>
              </div>
            </div>
            <div className="col-md-6">
              <div className="border rounded p-3">
                <small className="text-muted d-block mb-1">Account Created</small>
                <strong>{new Date(user.created_at).toLocaleString()}</strong>
              </div>
            </div>
          </div>

          <div className="mt-4 d-flex gap-2">
            <button className="btn btn-primary" onClick={() => router.push(`/admin/users/${id}/edit`)}>
              <i className="bi bi-pencil me-2"></i>Edit User
            </button>
            <button className={`btn ${user.is_active ? 'btn-warning' : 'btn-success'}`} onClick={handleStatusToggle}>
              <i className={`bi ${user.is_active ? 'bi-ban' : 'bi-check-circle'} me-2`}></i>
              {user.is_active ? 'Deactivate' : 'Activate'} User
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}