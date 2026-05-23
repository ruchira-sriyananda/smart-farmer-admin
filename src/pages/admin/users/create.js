import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function CreateUser() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState([])
  const [fetchingRoles, setFetchingRoles] = useState(true)
  const [roleError, setRoleError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
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
  const fetchRoles = useCallback(async () => {
    try {
      setFetchingRoles(true)
      setRoleError(null)
      
      console.log('Fetching roles from admin_roles...')
      
      // Direct query to admin_roles table
      const { data, error, count } = await supabase
        .from('admin_roles')
        .select('*')

      console.log('Response:', { data, error, count })

      if (error) {
        console.error('Error fetching roles:', error)
        setRoleError(`Database error: ${error.message}`)
        setRoles([])
        return
      }

      if (!data || data.length === 0) {
        console.warn('No roles found - table might be empty')
        setRoleError('No roles found in admin_roles table. Please add roles first.')
        setRoles([])
        return
      }

      console.log('Roles fetched successfully:', data.length, 'roles found')
      setRoles(data)
      
    } catch (err) {
      console.error('Error in fetchRoles:', err)
      setRoleError(err.message)
    } finally {
      setFetchingRoles(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles, retryCount])

  const retryFetch = () => {
    setRetryCount(prev => prev + 1)
    setFetchingRoles(true)
  }

  // Function to manually add default roles via API
  const addDefaultRoles = async () => {
    setLoading(true)
    try {
      // Try direct insert via Supabase
      const defaultRoles = [
        { role_name: 'SUPER_ADMIN', description: 'Full system access - all permissions' },
        { role_name: 'CONTENT_ADMIN', description: 'Manage content, posts, and comments' },
        { role_name: 'SECURITY_ADMIN', description: 'Manage security settings and monitor threats' },
        { role_name: 'SUPPORT_ADMIN', description: 'Handle user support and tickets' }
      ]

      let inserted = 0
      for (const role of defaultRoles) {
        const { error } = await supabase
          .from('admin_roles')
          .insert({
            role_name: role.role_name,
            description: role.description
          })
        
        if (error) {
          console.error('Error inserting role:', role.role_name, error)
        } else {
          inserted++
        }
      }

      if (inserted > 0) {
        alert(`${inserted} default roles added successfully!`)
        await fetchRoles()
      } else {
        alert('Failed to add roles. Please add them manually in Supabase SQL editor.')
      }
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

      // Only add role_id if selected and not super admin
      if (formData.role_id && formData.role_id !== '' && !formData.is_super_admin) {
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
            <button className="btn btn-sm btn-outline-secondary mt-2" onClick={retryFetch}>
              <i className="bi bi-arrow-repeat me-1"></i>Retry
            </button>
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
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {roleError}
                </div>
                <div>
                  <button className="btn btn-sm btn-outline-primary me-2" onClick={retryFetch}>
                    <i className="bi bi-arrow-repeat me-1"></i>Retry
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={addDefaultRoles} disabled={loading}>
                    <i className="bi bi-plus-circle me-1"></i>Add Default Roles
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="alert alert-danger">{errors.submit}</div>
          )}

          {/* Success message if roles exist */}
          {!roleError && roles.length > 0 && (
            <div className="alert alert-success small">
              <i className="bi bi-check-circle-fill me-2"></i>
              Found {roles.length} roles in database. Select a role for this user.
            </div>
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