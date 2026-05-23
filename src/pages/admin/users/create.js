import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function CreateUser() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState([])
  const [fetchingRoles, setFetchingRoles] = useState(true)
  const [roleError, setRoleError] = useState(null)
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

  // Fetch roles from admin_roles table
  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    try {
      setFetchingRoles(true)
      setRoleError(null)
      
      // First, check if admin_roles table exists and get data
      const { data, error, count } = await supabase
        .from('admin_roles')
        .select('*')

      console.log('Supabase response:', { data, error, count })

      if (error) {
        console.error('Error fetching roles:', error)
        setRoleError(`Database error: ${error.message}`)
        return
      }

      if (!data || data.length === 0) {
        console.warn('No roles found in admin_roles table')
        setRoleError('No roles found in database. Please add roles to admin_roles table.')
        setRoles([])
        return
      }

      console.log('Roles fetched successfully:', data)
      setRoles(data)
      
    } catch (err) {
      console.error('Error in fetchRoles:', err)
      setRoleError(err.message)
    } finally {
      setFetchingRoles(false)
    }
  }

  // Function to manually add default roles if none exist
  const addDefaultRoles = async () => {
    setLoading(true)
    try {
      const defaultRoles = [
        { role_name: 'SUPER_ADMIN', description: 'Full system access - all permissions' },
        { role_name: 'CONTENT_ADMIN', description: 'Manage content, posts, and comments' },
        { role_name: 'SECURITY_ADMIN', description: 'Manage security settings and monitor threats' },
        { role_name: 'SUPPORT_ADMIN', description: 'Handle user support and tickets' }
      ]

      for (const role of defaultRoles) {
        const { error } = await supabase
          .from('admin_roles')
          .insert(role)
        
        if (error) console.error('Error inserting role:', error)
      }

      // Refresh roles
      await fetchRoles()
      alert('Default roles added successfully!')
    } catch (err) {
      console.error('Error adding default roles:', err)
      alert('Error adding default roles: ' + err.message)
    } finally {
      setLoading(false)
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
    
    if (!formData.role_id && !formData.is_super_admin) {
      newErrors.role_id = 'Please select a role or mark as Super Admin'
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
            full_name: formData.full_name
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

      router.push('/admin/users')
    } catch (err) {
      console.error('Error:', err)
      setErrors({ submit: err.message })
    } finally {
      setLoading(false)
    }
  }

  if (fetchingRoles) {
    return (
      <AdminLayout title="Create New User">
        <div className="d-flex justify-content-center py-5">
          <div className="text-center">
            <div className="spinner-border text-primary mb-3"></div>
            <p>Loading roles...</p>
          </div>
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
          {/* Role Error Message */}
          {roleError && (
            <div className="alert alert-warning">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {roleError}
              <button className="btn btn-sm btn-primary ms-3" onClick={addDefaultRoles}>
                <i className="bi bi-plus-circle me-1"></i>Add Default Roles
              </button>
            </div>
          )}

          {/* Submit Error */}
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
                <label className="form-label fw-semibold">Role</label>
                <select 
                  className={`form-select ${errors.role_id ? 'is-invalid' : ''}`}
                  value={formData.role_id}
                  onChange={(e) => setFormData({...formData, role_id: e.target.value})}
                  disabled={roles.length === 0}
                >
                  <option value="">Select a Role</option>
                  {roles.map(role => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.role_name} - {role.description}
                    </option>
                  ))}
                </select>
                {errors.role_id && <div className="invalid-feedback">{errors.role_id}</div>}
                {roles.length === 0 && !roleError && (
                  <div className="text-warning small mt-1">
                    <i className="bi bi-info-circle me-1"></i>
                    Loading roles... If this persists, click "Add Default Roles" above.
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