import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function EditUser() {
  const router = useRouter()
  const { id } = router.query
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role_id: '',
    is_active: true,
    is_super_admin: false
  })

  useEffect(() => {
    if (id) {
      fetchUser()
    }
  }, [id])

  const fetchUser = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('admin_id', id)
        .single()

      if (!error && data) {
        setFormData({
          full_name: data.full_name,
          email: data.email,
          role_id: data.role_id || '',
          is_active: data.is_active,
          is_super_admin: data.is_super_admin
        })
      }
    } catch (err) {
      console.error('Error fetching user:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    const { error } = await supabase
      .from('admin_users')
      .update({
        full_name: formData.full_name,
        role_id: formData.role_id || null,
        is_active: formData.is_active,
        is_super_admin: formData.is_super_admin
      })
      .eq('admin_id', id)

    if (!error) {
      router.push(`/admin/users/${id}`)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <AdminLayout title="Edit User">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Edit User">
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h5 className="mb-4 fw-bold">Edit User</h5>

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-control"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control bg-light"
                disabled
                value={formData.email}
              />
              <small className="text-muted">Email cannot be changed</small>
            </div>

            <div className="mb-3">
              <label className="form-label">Role</label>
              <select 
                className="form-select"
                value={formData.role_id}
                onChange={(e) => setFormData({...formData, role_id: e.target.value})}
              >
                <option value="">Select Role</option>
                <option value="CONTENT_ADMIN">Content Admin</option>
                <option value="SECURITY_ADMIN">Security Admin</option>
                <option value="SUPPORT_ADMIN">Support Admin</option>
              </select>
            </div>

            <div className="mb-3 form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="isActive"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              />
              <label className="form-check-label" htmlFor="isActive">
                Active Account
              </label>
            </div>

            <div className="mb-3 form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="isSuperAdmin"
                checked={formData.is_super_admin}
                onChange={(e) => setFormData({...formData, is_super_admin: e.target.checked})}
              />
              <label className="form-check-label" htmlFor="isSuperAdmin">
                Super Admin (Full Access)
              </label>
            </div>

            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  )
}