import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function CreateUser() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState([])
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    role_id: '',
    is_active: true,
    is_super_admin: false
  })
  const [errors, setErrors] = useState({})

  // Fetch roles on component mount
  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('role_id, role_name, description')
        .order('role_name')

      if (error) {
        console.error('Error fetching roles:', error)
        return
      }

      console.log('Roles fetched:', data) // Debug log
      setRoles(data || [])
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid'
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }
    
    if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match'
    }
    
    if (!formData.role_id) {
      newErrors.role_id = 'Please select a role'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setLoading(true)

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { 
            full_name: formData.full_name,
            role: formData.role_id
          }
        }
      })

      if (authError) throw authError

      // Add to admin_users
      const { error: adminError } = await supabase
        .from('admin_users')
        .insert({
          admin_id: authData.user.id,
          full_name: formData.full_name,
          email: formData.email,
          password_hash: 'managed_by_auth',
          role_id: formData.role_id || null,
          is_active: formData.is_active,
          is_super_admin: formData.is_super_admin,
          created_at: new Date().toISOString()
        })

      if (adminError) throw adminError

      // Log activity
      const session = JSON.parse(localStorage.getItem('adminSession'))
      await supabase
        .from('admin_activity_logs')
        .insert({
          admin_id: session?.admin?.admin_id,
          activity_type: 'USER_MANAGEMENT',
          activity_description: `Created new admin user: ${formData.email}`,
          created_at: new Date().toISOString()
        })

      router.push('/admin/users')
    } catch (err) {
      setErrors({ submit: err.message })
    } finally {
      setLoading(false)
    }
  }

  if (loading && roles.length === 0) {
    return (
      <AdminLayout title="Create New User">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Create New Admin User">
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-0 pt-4">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold">
              <i className="bi bi-person-plus me-2 text-primary"></i>
              Add New Administrator
            </h5>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => router.back()}>
              <i className="bi bi-arrow-left me-1"></i>Back
            </button>
          </div>
        </div>
        <div className="card-body">
          {errors.submit && (
            <div className="alert alert-danger">{errors.submit}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">Full Name *</label>
                <input
                  type="text"
                  className={`form-control ${errors.full_name ? 'is-invalid' : ''}`}
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                />
                {errors.full_name && <div className="invalid-feedback">{errors.full_name}</div>}
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">Email Address *</label>
                <input
                  type="email"
                  className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
                {errors.email && <div className="invalid-feedback">{errors.email}</div>}
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">Password *</label>
                <input
                  type="password"
                  className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
                {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                <small className="text-muted">Minimum 8 characters</small>
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">Confirm Password *</label>
                <input
                  type="password"
                  className={`form-control ${errors.confirm_password ? 'is-invalid' : ''}`}
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({...formData, confirm_password: e.target.value})}
                />
                {errors.confirm_password && <div className="invalid-feedback">{errors.confirm_password}</div>}
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label fw-semibold">Role *</label>
                <select 
                  className={`form-select ${errors.role_id ? 'is-invalid' : ''}`}
                  value={formData.role_id}
                  onChange={(e) => setFormData({...formData, role_id: e.target.value})}
                >
                  <option value="">Select a Role</option>
                  {roles.map(role => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.role_name} - {role.description}
                    </option>
                  ))}
                </select>
                {errors.role_id && <div className="invalid-feedback">{errors.role_id}</div>}
                {roles.length === 0 && (
                  <div className="text-warning small mt-1">
                    No roles found. Please add roles to the database first.
                  </div>
                )}
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

              <div className="col-12 mb-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="isSuperAdmin"
                    checked={formData.is_super_admin}
                    onChange={(e) => setFormData({...formData, is_super_admin: e.target.checked})}
                  />
                  <label className="form-check-label" htmlFor="isSuperAdmin">
                    <i className="bi bi-star-fill text-warning me-1"></i>
                    Super Admin (Full system access)
                  </label>
                  <div className="text-muted small mt-1">
                    Super admins have unrestricted access to all features and settings.
                  </div>
                </div>
              </div>
            </div>

            <hr className="my-4" />

            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-primary px-4" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Creating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-2"></i>Create User
                  </>
                )}
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => router.push('/admin/users')}>
                <i className="bi bi-x-circle me-2"></i>Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  )
}