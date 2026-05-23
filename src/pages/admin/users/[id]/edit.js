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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    role_id: '',
    is_active: true,
    is_super_admin: false,
    new_password: '',
    confirm_password: ''
  })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [message, setMessage] = useState({ type: '', text: '' })
  const [originalUser, setOriginalUser] = useState(null)

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

      if (!error && data) {
        setOriginalUser(data)
        setFormData({
          full_name: data.full_name || '',
          email: data.email || '',
          phone_number: data.phone_number || '',
          role_id: data.role_id || '',
          is_active: data.is_active,
          is_super_admin: data.is_super_admin,
          new_password: '',
          confirm_password: ''
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
        .order('role_name')

      if (!error && data) {
        setRoles(data)
      }
    } catch (err) {
      console.error('Error fetching roles:', err)
    }
  }

  const validateField = (name, value) => {
    switch (name) {
      case 'full_name':
        if (!value.trim()) return 'Full name is required'
        if (value.length < 3) return 'Name must be at least 3 characters'
        return ''
      case 'email':
        if (!value.trim()) return 'Email is required'
        if (!/\S+@\S+\.\S+/.test(value)) return 'Email is invalid'
        return ''
      case 'new_password':
        if (value && value.length < 8) return 'Password must be at least 8 characters'
        return ''
      case 'confirm_password':
        if (formData.new_password && value !== formData.new_password) return 'Passwords do not match'
        return ''
      default:
        return ''
    }
  }

  const handleBlur = (field) => {
    setTouched({ ...touched, [field]: true })
    const error = validateField(field, formData[field])
    if (error) {
      setErrors({ ...errors, [field]: error })
    } else {
      const newErrors = { ...errors }
      delete newErrors[field]
      setErrors(newErrors)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value
    setFormData({ ...formData, [name]: newValue })
    
    if (touched[name]) {
      const error = validateField(name, newValue)
      if (error) {
        setErrors({ ...errors, [name]: error })
      } else {
        const newErrors = { ...errors }
        delete newErrors[name]
        setErrors(newErrors)
      }
    }
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid'
    if (formData.new_password && formData.new_password.length < 8) newErrors.new_password = 'Password must be at least 8 characters'
    if (formData.new_password && formData.new_password !== formData.confirm_password) newErrors.confirm_password = 'Passwords do not match'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
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

  const logActivity = async (description) => {
    const session = JSON.parse(localStorage.getItem('adminSession') || '{}')
    await supabase
      .from('admin_activity_logs')
      .insert({
        admin_id: session?.admin?.admin_id,
        activity_type: 'USER_MANAGEMENT',
        activity_description: description,
        ip_address: await getClientIP(),
        created_at: new Date().toISOString()
      })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      const firstError = document.querySelector('.error')
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    
    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      const updateData = {
        full_name: formData.full_name,
        phone_number: formData.phone_number || null,
        role_id: formData.role_id || null,
        is_active: formData.is_active,
        is_super_admin: formData.is_super_admin,
        updated_at: new Date().toISOString()
      }

      // Only update password if provided
      if (formData.new_password) {
        // Update auth password
        const { error: authError } = await supabase.auth.updateUser({
          password: formData.new_password
        })
        if (authError) throw authError
      }

      const { error } = await supabase
        .from('admin_users')
        .update(updateData)
        .eq('admin_id', id)

      if (error) throw error

      await logActivity(`Updated user: ${formData.email}`)

      setMessage({ type: 'success', text: 'User updated successfully!' })
      
      setTimeout(() => {
        router.push('/admin/users')
      }, 1500)
    } catch (err) {
      setMessage({ type: 'danger', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = () => {
    if (!originalUser) return false
    return (
      formData.full_name !== originalUser.full_name ||
      formData.phone_number !== (originalUser.phone_number || '') ||
      formData.role_id !== (originalUser.role_id || '') ||
      formData.is_active !== originalUser.is_active ||
      formData.is_super_admin !== originalUser.is_super_admin ||
      formData.new_password !== ''
    )
  }

  if (loading) {
    return (
      <AdminLayout title="Edit User">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading user data...</p>
        </div>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
          }
          .loading-spinner {
            width: 48px;
            height: 48px;
            border: 3px solid #e9ecef;
            border-top-color: #4f46e5;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title={`Edit User: ${originalUser?.full_name || 'User'}`}>
      <div className="edit-user-container">
        {/* Header */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="bi bi-pencil-square"></i>
            </div>
            <div>
              <h1 className="header-title">Edit Administrator</h1>
              <p className="header-subtitle">Update user information and permissions</p>
            </div>
          </div>
          <button className="back-button" onClick={() => router.back()}>
            <i className="bi bi-arrow-left"></i>
            <span>Back</span>
          </button>
        </div>

        {/* Message Toast */}
        {message.text && (
          <div className={`message-toast ${message.type}`}>
            <i className={`bi bi-${message.type === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill'}`}></i>
            <span>{message.text}</span>
            <button className="close-toast" onClick={() => setMessage({ type: '', text: '' })}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        )}

        <div className="content-grid">
          {/* Main Form Card */}
          <div className="form-card">
            <div className="card-header">
              <div className="card-header-icon">
                <i className="bi bi-person-badge"></i>
              </div>
              <div>
                <h3 className="card-title">User Information</h3>
                <p className="card-subtitle">Update the administrator's personal details</p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                {/* Full Name Field */}
                <div className="form-group">
                  <label className="form-label">
                    <i className="bi bi-person"></i>
                    Full Name
                    <span className="required">*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      type="text"
                      name="full_name"
                      className={`form-input ${errors.full_name && touched.full_name ? 'error' : ''}`}
                      placeholder="Enter full name"
                      value={formData.full_name}
                      onChange={handleChange}
                      onBlur={() => handleBlur('full_name')}
                    />
                    {errors.full_name && touched.full_name && (
                      <div className="error-message">
                        <i className="bi bi-exclamation-circle"></i>
                        {errors.full_name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Email Field (Read Only) */}
                <div className="form-group">
                  <label className="form-label">
                    <i className="bi bi-envelope"></i>
                    Email Address
                  </label>
                  <div className="readonly-field">
                    <i className="bi bi-envelope-fill"></i>
                    <span>{formData.email}</span>
                    <small className="readonly-badge">Cannot be changed</small>
                  </div>
                </div>

                {/* Phone Number Field */}
                <div className="form-group">
                  <label className="form-label">
                    <i className="bi bi-telephone"></i>
                    Phone Number
                  </label>
                  <div className="input-wrapper">
                    <input
                      type="tel"
                      name="phone_number"
                      className="form-input"
                      placeholder="+94 XX XXX XXXX"
                      value={formData.phone_number || ''}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div className="form-group">
                  <label className="form-label">
                    <i className="bi bi-badge"></i>
                    Role
                  </label>
                  <div className="input-wrapper">
                    <select
                      name="role_id"
                      className="form-select"
                      value={formData.role_id}
                      onChange={handleChange}
                    >
                      <option value="">No Role</option>
                      {roles.map(role => (
                        <option key={role.role_id} value={role.role_id}>
                          {role.role_name} - {role.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Password Change Section */}
              <div className="password-section">
                <div className="section-header">
                  <div className="section-icon">
                    <i className="bi bi-shield-lock"></i>
                  </div>
                  <div>
                    <h4 className="section-title">Change Password</h4>
                    <p className="section-subtitle">Leave blank to keep current password</p>
                  </div>
                </div>

                <div className="form-grid">
                  {/* New Password */}
                  <div className="form-group">
                    <label className="form-label">
                      <i className="bi bi-key"></i>
                      New Password
                    </label>
                    <div className="input-wrapper">
                      <div className="password-input-wrapper">
                        <input
                          type={showPassword ? "text" : "password"}
                          name="new_password"
                          className={`form-input ${errors.new_password && touched.new_password ? 'error' : ''}`}
                          placeholder="Enter new password"
                          value={formData.new_password}
                          onChange={handleChange}
                          onBlur={() => handleBlur('new_password')}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                        </button>
                      </div>
                      {errors.new_password && touched.new_password && (
                        <div className="error-message">
                          <i className="bi bi-exclamation-circle"></i>
                          {errors.new_password}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="form-group">
                    <label className="form-label">
                      <i className="bi bi-shield-check"></i>
                      Confirm Password
                    </label>
                    <div className="input-wrapper">
                      <div className="password-input-wrapper">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirm_password"
                          className={`form-input ${errors.confirm_password && touched.confirm_password ? 'error' : ''}`}
                          placeholder="Confirm new password"
                          value={formData.confirm_password}
                          onChange={handleChange}
                          onBlur={() => handleBlur('confirm_password')}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                        </button>
                      </div>
                      {errors.confirm_password && touched.confirm_password && (
                        <div className="error-message">
                          <i className="bi bi-exclamation-circle"></i>
                          {errors.confirm_password}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status & Permissions Section */}
              <div className="permissions-section">
                <div className="section-header">
                  <div className="section-icon">
                    <i className="bi bi-shield-check"></i>
                  </div>
                  <div>
                    <h4 className="section-title">Status & Permissions</h4>
                    <p className="section-subtitle">Control account access and privileges</p>
                  </div>
                </div>

                <div className="permissions-grid">
                  {/* Account Status Toggle */}
                  <div className="permission-card">
                    <div className="permission-icon">
                      <i className={`bi ${formData.is_active ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                    </div>
                    <div className="permission-info">
                      <div className="permission-title">Account Status</div>
                      <div className="permission-description">
                        {formData.is_active 
                          ? 'User can access the admin panel' 
                          : 'User cannot access the admin panel'}
                      </div>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_active}
                        onChange={handleChange}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  {/* Super Admin Toggle */}
                  <div className="permission-card super-admin-card">
                    <div className="permission-icon">
                      <i className="bi bi-star-fill"></i>
                    </div>
                    <div className="permission-info">
                      <div className="permission-title">Super Administrator</div>
                      <div className="permission-description">
                        {formData.is_super_admin 
                          ? 'Has unrestricted access to all features' 
                          : 'Access limited by role permissions'}
                      </div>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        name="is_super_admin"
                        checked={formData.is_super_admin}
                        onChange={handleChange}
                      />
                      <span className="toggle-slider super"></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="action-buttons">
                <button type="button" className="btn-cancel" onClick={() => router.back()}>
                  <i className="bi bi-x-lg"></i>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-submit" 
                  disabled={saving || !hasChanges()}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-save"></i>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* User Stats Sidebar */}
          <div className="stats-sidebar">
            <div className="info-card">
              <div className="info-card-header">
                <i className="bi bi-info-circle"></i>
                <span>Account Information</span>
              </div>
              <div className="info-card-body">
                <div className="info-item">
                  <span className="info-label">User ID</span>
                  <code className="info-value">{originalUser?.admin_id?.slice(0, 8)}...</code>
                </div>
                <div className="info-item">
                  <span className="info-label">Created</span>
                  <span className="info-value">
                    {originalUser?.created_at ? new Date(originalUser.created_at).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Last Updated</span>
                  <span className="info-value">
                    {originalUser?.updated_at ? new Date(originalUser.updated_at).toLocaleString() : 'Never'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Last Login</span>
                  <span className="info-value">
                    {originalUser?.last_login ? new Date(originalUser.last_login).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>
            </div>

            <div className="warning-card">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <div>
                <strong>Important Note</strong>
                <p>Changes to user permissions will take effect immediately on their next login.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .edit-user-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Header */
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .header-icon {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-icon i {
          font-size: 28px;
          color: white;
        }

        .header-title {
          font-size: 24px;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 4px 0;
        }

        .header-subtitle {
          color: #6c757d;
          margin: 0;
          font-size: 14px;
        }

        .back-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          color: #495057;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .back-button:hover {
          background: #e9ecef;
          transform: translateX(-2px);
        }

        /* Message Toast */
        .message-toast {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border-radius: 14px;
          margin-bottom: 24px;
          animation: slideDown 0.3s ease;
        }

        .message-toast.success {
          background: #d1fae5;
          color: #065f46;
          border-left: 4px solid #10b981;
        }

        .message-toast.danger {
          background: #fee2e2;
          color: #991b1b;
          border-left: 4px solid #ef4444;
        }

        .close-toast {
          margin-left: auto;
          background: none;
          border: none;
          cursor: pointer;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Content Grid */
        .content-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }

        /* Form Card */
        .form-card {
          background: white;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 24px 28px;
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border-bottom: 1px solid #e9ecef;
        }

        .card-header-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-header-icon i {
          font-size: 24px;
          color: #667eea;
        }

        .card-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 4px 0;
          color: #1f2937;
        }

        .card-subtitle {
          font-size: 13px;
          color: #6c757d;
          margin: 0;
        }

        /* Form Elements */
        .form-grid {
          padding: 28px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .form-label i {
          color: #667eea;
        }

        .required {
          color: #dc3545;
          margin-left: 4px;
        }

        .input-wrapper {
          position: relative;
        }

        .form-input, .form-select {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-input.error, .form-select.error {
          border-color: #dc3545;
        }

        .readonly-field {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #f8f9fa;
          border-radius: 12px;
          color: #495057;
        }

        .readonly-field i {
          color: #9ca3af;
        }

        .readonly-badge {
          margin-left: auto;
          font-size: 11px;
          color: #9ca3af;
        }

        .password-input-wrapper {
          position: relative;
        }

        .password-input-wrapper input {
          padding-right: 45px;
        }

        .password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #6c757d;
          cursor: pointer;
        }

        .error-message {
          margin-top: 6px;
          font-size: 12px;
          color: #dc3545;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Password Section */
        .password-section {
          border-top: 1px solid #e9ecef;
          padding: 24px 28px;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .section-icon {
          width: 40px;
          height: 40px;
          background: rgba(245, 158, 11, 0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .section-icon i {
          font-size: 20px;
          color: #f59e0b;
        }

        .section-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 2px 0;
          color: #1f2937;
        }

        .section-subtitle {
          font-size: 12px;
          color: #6c757d;
          margin: 0;
        }

        /* Permissions Section */
        .permissions-section {
          border-top: 1px solid #e9ecef;
          padding: 24px 28px;
        }

        .permissions-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .permission-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 16px;
          transition: all 0.3s ease;
        }

        .permission-card:hover {
          background: #f1f3f5;
        }

        .permission-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .permission-card .permission-icon {
          background: rgba(79, 70, 229, 0.1);
          color: #4f46e5;
        }

        .permission-card.super-admin-card .permission-icon {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }

        .permission-icon i {
          font-size: 24px;
        }

        .permission-info {
          flex: 1;
        }

        .permission-title {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
        }

        .permission-description {
          font-size: 12px;
          color: #6c757d;
        }

        /* Toggle Switch */
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 52px;
          height: 28px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #cbd5e1;
          transition: 0.3s;
          border-radius: 28px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 22px;
          width: 22px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        .toggle-switch input:checked + .toggle-slider {
          background-color: #10b981;
        }

        .toggle-switch input:checked + .toggle-slider.super {
          background-color: #f59e0b;
        }

        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }

        /* Action Buttons */
        .action-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 16px;
          padding: 20px 28px;
          border-top: 1px solid #e9ecef;
          background: #fafbfc;
        }

        .btn-cancel {
          padding: 12px 24px;
          background: white;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          color: #6c757d;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .btn-cancel:hover {
          background: #f8f9fa;
          transform: translateY(-1px);
        }

        .btn-submit {
          padding: 12px 28px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .btn-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }

        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Stats Sidebar */
        .stats-sidebar {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .info-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .info-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          font-weight: 600;
          color: #1f2937;
        }

        .info-card-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }

        .info-label {
          color: #6c757d;
        }

        .info-value {
          font-weight: 500;
          color: #1f2937;
        }

        .warning-card {
          background: #fff3cd;
          border-radius: 16px;
          padding: 16px;
          display: flex;
          gap: 12px;
          border-left: 4px solid #ffc107;
        }

        .warning-card i {
          font-size: 20px;
          color: #ffc107;
        }

        .warning-card strong {
          display: block;
          margin-bottom: 4px;
          font-size: 13px;
        }

        .warning-card p {
          margin: 0;
          font-size: 12px;
          color: #856404;
        }

        /* Responsive */
        @media (max-width: 968px) {
          .content-grid {
            grid-template-columns: 1fr;
          }
          
          .form-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .permission-card {
            flex-wrap: wrap;
          }
          
          .action-buttons {
            flex-direction: column;
          }
          
          .btn-cancel, .btn-submit {
            width: 100%;
          }
        }
      `}</style>
    </AdminLayout>
  )
}