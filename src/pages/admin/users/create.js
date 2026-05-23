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
      
      console.log('Fetching roles from admin_roles...')
      
      // Try direct query
      const { data, error } = await supabase
        .from('admin_roles')
        .select('role_id, role_name, description')

      console.log('Query result:', { data, error })

      if (error) {
        console.error('Supabase error:', error)
        
        // If RLS error, try using the API endpoint as fallback
        if (error.message.includes('row-level security') || error.code === '42501') {
          console.log('RLS policy blocking, trying API fallback...')
          const response = await fetch('/api/get-roles')
          const apiData = await response.json()
          
          if (apiData.success && apiData.roles) {
            setRoles(apiData.roles)
            setRoleError(null)
            return
          }
        }
        
        setRoleError(`Database error: ${error.message}`)
        setRoles([])
        return
      }

      if (!data || data.length === 0) {
        setRoleError('No roles found. Please add roles to admin_roles table.')
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

      // Prepare admin user data
      const adminData = {
        admin_id: authData.user.id,
        full_name: formData.full_name,
        email: formData.email,
        password_hash: 'managed_by_auth',
        is_active: formData.is_active,
        is_super_admin: formData.is_super_admin,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      if (formData.role_id && formData.role_id !== '') {
        adminData.role_id = formData.role_id
      }

      console.log('Inserting admin user:', adminData)

      const { error: adminError } = await supabase
        .from('admin_users')
        .insert(adminData)

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
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}></div>
            <p>Loading roles from database...</p>
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
          {/* Debug Info */}
          <div className="alert alert-secondary small mb-3">
            <strong>Database Status:</strong> Found {roles.length} roles in admin_roles table
            {roles.length > 0 && (
              <div className="mt-2">
                <strong>Available Roles:</strong>
                <ul className="mb-0 mt-1">
                  {roles.map(role => (
                    <li key={role.role_id}>{role.role_name} - {role.description}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Role Error Message */}
          {roleError && (
            <div className="alert alert-warning">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {roleError}
              <button className="btn btn-sm btn-primary ms-3" onClick={fetchRoles}>
                <i className="bi bi-arrow-repeat me-1"></i>Retry
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