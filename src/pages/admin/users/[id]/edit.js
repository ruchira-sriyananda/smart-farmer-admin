import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function EditUser() {
  const router = useRouter()
  const { id } = router.query
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState([])
  const [message, setMessage] = useState({ type: '', text: '' })
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role_id: '',
    is_active: true,
    is_super_admin: false,
    phone_number: ''
  })

  useEffect(() => {
    if (id) {
      fetchUser()
      fetchRoles()
    }
  }, [id])

  const fetchUser = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('admin_id', id)
        .single()

      if (error) throw error

      if (data) {
        setFormData({
          full_name: data.full_name || '',
          email: data.email || '',
          role_id: data.role_id || '',
          is_active: data.is_active || false,
          is_super_admin: data.is_super_admin || false,
          phone_number: data.phone_number || ''
        })
      }
    } catch (err) {
      console.error('Error fetching user:', err)
      setMessage({ type: 'danger', text: 'Error loading user data' })
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_roles')
        .select('role_id, role_name, description')

      if (!error && data) {
        setRoles(data)
      }
    } catch (err) {
      console.error('Error fetching roles:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      // Get current session for activity logging
      const sessionData = JSON.parse(localStorage.getItem('adminSession') || '{}')
      
      // Get client IP for logging
      const clientIP = await getClientIP()

      // Update user in database
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({
          full_name: formData.full_name,
          role_id: formData.role_id || null,
          is_active: formData.is_active,
          is_super_admin: formData.is_super_admin,
          phone_number: formData.phone_number,
          updated_at: new Date().toISOString()
        })
        .eq('admin_id', id)

      if (updateError) throw updateError

      // Log the activity
      await supabase
        .from('admin_activity_logs')
        .insert({
          admin_id: sessionData?.admin?.admin_id,
          activity_type: 'USER_MANAGEMENT',
          activity_description: `Updated user: ${formData.email}`,
          ip_address: clientIP,
          created_at: new Date().toISOString()
        })

      // Update session storage if this is the current user
      if (sessionData?.admin?.admin_id === id) {
        sessionData.admin.full_name = formData.full_name
        localStorage.setItem('adminSession', JSON.stringify(sessionData))
      }

      setMessage({ type: 'success', text: 'User updated successfully!' })
      
      // Redirect after 1.5 seconds
      setTimeout(() => {
        router.push(`/admin/users/${id}`)
      }, 1500)
      
    } catch (err) {
      console.error('Error saving user:', err)
      setMessage({ type: 'danger', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const getClientIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch {
      return 'unknown'
    }
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
    <AdminLayout title={`Edit User: ${formData.full_name}`}>
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-0 pt-4">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold">
              <i className="bi bi-pencil-square me-2 text-primary"></i>
              Edit User Information
            </h5>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => router.back()}>
              <i className="bi bi-arrow-left me-1"></i>Back
            </button>
          </div>
        </div>
        <div className="card-body">
          {message.text && (
            <div className={`alert alert-${message.type} alert-dismissible fade show`} role="alert">
              <i className={`bi bi-${message.type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2`}></i>
              {message.text}
              <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })}></button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                />
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">Email</label>
                <input
                  type="email"
                  className="form-control bg-light"
                  disabled
                  value={formData.email}
                />
                <small className="text-muted">Email cannot be changed</small>
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">Phone Number</label>
                <input
                  type="tel"
                  className="form-control"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                  placeholder="+94 XX XXX XXXX"
                />
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">Role</label>
                <select 
                  className="form-select"
                  value={formData.role_id}
                  onChange={(e) => setFormData({...formData, role_id: e.target.value})}
                >
                  <option value="">Select Role</option>
                  {roles.map(role => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.role_name} - {role.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6 mb-3">
                <div className="form-check form-switch mt-4 pt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="isActive"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  />
                  <label className="form-check-label" htmlFor="isActive">
                    Active Account
                  </label>
                </div>
              </div>

              <div className="col-md-6 mb-3">
                <div className="form-check form-switch mt-4 pt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="isSuperAdmin"
                    checked={formData.is_super_admin}
                    onChange={(e) => setFormData({...formData, is_super_admin: e.target.checked})}
                  />
                  <label className="form-check-label" htmlFor="isSuperAdmin">
                    <i className="bi bi-star-fill text-warning me-1"></i>
                    Super Admin Privileges
                  </label>
                </div>
              </div>
            </div>

            <hr className="my-4" />

            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-primary px-4" disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-save me-2"></i>Save Changes
                  </>
                )}
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => router.push(`/admin/users/${id}`)}>
                <i className="bi bi-x-circle me-2"></i>Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  )
}