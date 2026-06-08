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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [rateLimitError, setRateLimitError] = useState(false)
  const [emailSettings, setEmailSettings] = useState({ enable_notifications: false })
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
  const [touched, setTouched] = useState({})

  // Fetch roles
  useEffect(() => {
    fetchRoles()
    fetchEmailSettings()
  }, [])

  const fetchRoles = async () => {
    try {
      setFetchingRoles(true)
      setRoleError(null)
      
      const { data, error } = await supabase
        .from('admin_roles')
        .select('role_id, role_name, description')

      if (error) throw error

      if (!data || data.length === 0) {
        setRoleError('No roles found. Please add roles to admin_roles table.')
        setRoles([])
        return
      }

      setRoles(data)
      
    } catch (err) {
      console.error('Error:', err)
      setRoleError(err.message)
    } finally {
      setFetchingRoles(false)
    }
  }

  const fetchEmailSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['enable_notifications', 'smtp_host', 'smtp_user', 'smtp_password', 'site_name'])

      if (!error && data) {
        const settings = {}
        data.forEach(setting => {
          settings[setting.setting_key] = setting.setting_value
        })
        setEmailSettings({
          enable_notifications: settings.enable_notifications === 'true',
          smtp_host: settings.smtp_host || '',
          smtp_user: settings.smtp_user || '',
          smtp_password: settings.smtp_password || '',
          site_name: settings.site_name || 'Smart Farmer'
        })
      }
    } catch (err) {
      console.error('Error fetching email settings:', err)
    }
  }

  // Send welcome email to new admin
  const sendWelcomeEmail = async (email, fullName, password, roleName, siteName) => {
    if (!emailSettings.enable_notifications) {
      console.log('Email notifications are disabled')
      return false
    }

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'admin_welcome',
          to: email,
          data: {
            userName: fullName,
            email: email,
            password: password,
            role: roleName,
            siteName: siteName || emailSettings.site_name,
            loginUrl: `${window.location.origin}/admin/login`
          }
        })
      })

      const result = await response.json()
      if (result.success) {
        console.log('Welcome email sent successfully to', email)
        return true
      } else {
        console.error('Failed to send welcome email:', result.error)
        return false
      }
    } catch (error) {
      console.error('Error sending welcome email:', error)
      return false
    }
  }

  // Calculate password strength
  const calculatePasswordStrength = (password) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++
    if (password.match(/[0-9]/)) strength++
    if (password.match(/[^a-zA-Z0-9]/)) strength++
    return strength
  }

  const handlePasswordChange = (e) => {
    const password = e.target.value
    setFormData({ ...formData, password })
    setPasswordStrength(calculatePasswordStrength(password))
  }

  const getPasswordStrengthColor = () => {
    if (passwordStrength === 0) return 'bg-secondary'
    if (passwordStrength === 1) return 'bg-danger'
    if (passwordStrength === 2) return 'bg-warning'
    if (passwordStrength === 3) return 'bg-info'
    return 'bg-success'
  }

  const getPasswordStrengthText = () => {
    if (passwordStrength === 0) return 'Enter a password'
    if (passwordStrength === 1) return 'Weak'
    if (passwordStrength === 2) return 'Fair'
    if (passwordStrength === 3) return 'Good'
    return 'Strong'
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
      case 'password':
        if (!value) return 'Password is required'
        if (value.length < 8) return 'Password must be at least 8 characters'
        return ''
      case 'confirm_password':
        if (value !== formData.password) return 'Passwords do not match'
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
    if (!formData.password) newErrors.password = 'Password is required'
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters'
    if (formData.password !== formData.confirm_password) newErrors.confirm_password = 'Passwords do not match'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Get role name by ID
  const getRoleName = (roleId) => {
    const role = roles.find(r => r.role_id === roleId)
    return role ? role.role_name : 'No Role Assigned'
  }

  // Create user with proper error handling
  const createUser = async () => {
    try {
      // First, check if user already exists in auth
      const { data: existingUser, error: searchError } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', formData.email)
        .maybeSingle()

      if (existingUser) {
        throw new Error('A user with this email already exists')
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.full_name },
          emailRedirectTo: undefined,
        }
      })

      if (authError) {
        if (authError.message.includes('rate limit') || authError.status === 429) {
          throw new Error('Too many signup attempts. Please wait a minute before trying again.')
        }
        if (authError.message.includes('already registered')) {
          throw new Error('This email is already registered. Please use a different email.')
        }
        throw authError
      }

      if (!authData.user) {
        throw new Error('Failed to create user account')
      }

      return authData
    } catch (err) {
      throw err
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      const firstError = document.querySelector('.error')
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    
    setLoading(true)
    setRateLimitError(false)
    setErrors({})

    try {
      // Create auth user
      const authData = await createUser()

      // Get role name for email
      const roleName = getRoleName(formData.role_id)

      // Prepare admin data
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

      // Add role if selected
      if (formData.role_id && formData.role_id !== '') {
        adminData.role_id = formData.role_id
      }

      // Insert into admin_users
      const { error: adminError } = await supabase
        .from('admin_users')
        .insert(adminData)
        .select()

      if (adminError) {
        console.error('Admin insert error:', adminError)
        
        if (adminError.message.includes('row-level security')) {
          throw new Error('Permission denied: Unable to create admin user due to security policies. Please contact your system administrator.')
        }
        throw adminError
      }

      // Send welcome email with credentials
      const emailSent = await sendWelcomeEmail(
        formData.email,
        formData.full_name,
        formData.password,
        roleName,
        emailSettings.site_name
      )

      if (emailSent) {
        alert('✅ User created successfully! Welcome email has been sent to the new administrator.')
      } else {
        alert('⚠️ User created successfully, but welcome email could not be sent. Please check email settings.')
      }

      // Success - redirect
      router.push('/admin/users')
      
    } catch (err) {
      console.error('Error:', err)
      
      if (err.message.includes('rate limit')) {
        setErrors({ submit: 'Too many attempts. Please wait a few minutes before trying again.' })
      } else if (err.message.includes('already registered')) {
        setErrors({ submit: 'This email is already registered. Please use a different email address.' })
      } else if (err.message.includes('row-level security')) {
        setErrors({ submit: 'Unable to create admin user. Please ensure you have proper permissions.' })
      } else {
        setErrors({ submit: err.message })
      }
    } finally {
      setLoading(false)
    }
  }

  if (fetchingRoles) {
    return (
      <AdminLayout title="Create New User">
        <div className="skeleton-loader">
          <div className="skeleton-card">
            <div className="skeleton-header"></div>
            <div className="skeleton-body">
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
            </div>
          </div>
        </div>
        <style jsx>{`
          .skeleton-loader {
            min-height: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .skeleton-card {
            width: 100%;
            max-width: 800px;
            background: white;
            border-radius: 24px;
            padding: 24px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          }
          .skeleton-header {
            height: 32px;
            width: 200px;
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 8px;
            margin-bottom: 24px;
          }
          .skeleton-body {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .skeleton-line {
            height: 48px;
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 12px;
          }
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Create New Administrator">
      <div className="create-user-container">
        {/* Email Notification Status */}
        <div className={`email-status-banner ${emailSettings.enable_notifications ? 'enabled' : 'disabled'}`}>
          <i className={`bi ${emailSettings.enable_notifications ? 'bi-envelope-check-fill' : 'bi-envelope-slash-fill'}`}></i>
          <div>
            <strong>Email Notifications {emailSettings.enable_notifications ? 'Enabled' : 'Disabled'}</strong>
            <p>{emailSettings.enable_notifications ? 'New admin will receive welcome email with login credentials' : 'Enable email notifications in settings to send welcome emails'}</p>
          </div>
        </div>

        {rateLimitError && (
          <div className="alert-rate-limit">
            <i className="bi bi-hourglass-split"></i>
            <div>
              <strong>Rate Limit Active</strong>
              <p>Please wait a moment before creating another user. The system is automatically retrying...</p>
            </div>
          </div>
        )}

        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="bi bi-person-plus-fill"></i>
            </div>
            <div className="header-text">
              <h1 className="header-title">Add New Administrator</h1>
              <p className="header-subtitle">Create a new admin user with specific role and permissions</p>
            </div>
          </div>
          <button className="back-button" onClick={() => router.back()}>
            <i className="bi bi-arrow-left"></i>
            <span>Back</span>
          </button>
        </div>

        <div className="form-card">
          {errors.submit && errors.submit.includes('row-level security') && (
            <div className="alert-rls-error">
              <i className="bi bi-shield-exclamation"></i>
              <div>
                <strong>Permission Error</strong>
                <p>You don't have permission to create admin users. Please contact your system administrator.</p>
              </div>
            </div>
          )}

          {roleError && (
            <div className="alert-warning-card">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <div>
                <strong>Warning</strong>
                <p>{roleError}</p>
              </div>
              <button className="retry-btn" onClick={fetchRoles}>
                <i className="bi bi-arrow-repeat"></i> Retry
              </button>
            </div>
          )}

          {errors.submit && !errors.submit.includes('row-level security') && (
            <div className="alert-error-card">
              <i className="bi bi-x-circle-fill"></i>
              <div>
                <strong>Error</strong>
                <p>{errors.submit}</p>
              </div>
            </div>
          )}

          {!roleError && roles.length > 0 && (
            <div className="info-card">
              <i className="bi bi-shield-check"></i>
              <div>
                <strong>{roles.length} Roles Available</strong>
                <p>Select a role to assign permissions to this administrator</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
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

              <div className="form-group">
                <label className="form-label">
                  <i className="bi bi-envelope"></i>
                  Email Address
                  <span className="required">*</span>
                </label>
                <div className="input-wrapper">
                  <input
                    type="email"
                    name="email"
                    className={`form-input ${errors.email && touched.email ? 'error' : ''}`}
                    placeholder="admin@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={() => handleBlur('email')}
                  />
                  {errors.email && touched.email && (
                    <div className="error-message">
                      <i className="bi bi-exclamation-circle"></i>
                      {errors.email}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <i className="bi bi-lock"></i>
                  Password
                  <span className="required">*</span>
                </label>
                <div className="input-wrapper">
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      className={`form-input ${errors.password && touched.password ? 'error' : ''}`}
                      placeholder="Enter password"
                      value={formData.password}
                      onChange={handlePasswordChange}
                      onBlur={() => handleBlur('password')}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                  {formData.password && (
                    <div className="password-strength">
                      <div className="strength-bar">
                        <div className={`strength-fill ${getPasswordStrengthColor()}`} style={{ width: `${(passwordStrength / 4) * 100}%` }}></div>
                      </div>
                      <span className="strength-text">{getPasswordStrengthText()}</span>
                    </div>
                  )}
                  {errors.password && touched.password && (
                    <div className="error-message">
                      <i className="bi bi-exclamation-circle"></i>
                      {errors.password}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <i className="bi bi-shield-lock"></i>
                  Confirm Password
                  <span className="required">*</span>
                </label>
                <div className="input-wrapper">
                  <div className="password-input-wrapper">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirm_password"
                      className={`form-input ${errors.confirm_password && touched.confirm_password ? 'error' : ''}`}
                      placeholder="Confirm password"
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
                    <option value="">Select a Role</option>
                    {roles.map(role => (
                      <option key={role.role_id} value={role.role_id}>
                        {role.role_name} - {role.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <i className="bi bi-check-circle"></i>
                  Account Status
                </label>
                <div className="toggle-wrapper">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="toggle-label">
                    {formData.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="super-admin-card">
              <div className="super-admin-checkbox">
                <label className="checkbox-wrapper">
                  <input
                    type="checkbox"
                    name="is_super_admin"
                    checked={formData.is_super_admin}
                    onChange={handleChange}
                  />
                  <span className="checkbox-custom">
                    <i className="bi bi-star-fill"></i>
                  </span>
                  <span className="checkbox-label">
                    <strong>Super Administrator</strong>
                    <span className="checkbox-description">
                      Grants unrestricted access to all system features and settings
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="action-buttons">
              <button type="button" className="btn-cancel" onClick={() => router.push('/admin/users')}>
                <i className="bi bi-x-lg"></i>
                Cancel
              </button>
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Creating User...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg"></i>
                    Create Administrator
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .create-user-container {
          max-width: 900px;
          margin: 0 auto;
        }

        .email-status-banner {
          padding: 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .email-status-banner.enabled {
          background: #d1fae5;
          border-left: 4px solid #10b981;
        }

        .email-status-banner.disabled {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
        }

        .email-status-banner i {
          font-size: 24px;
        }

        .email-status-banner.enabled i {
          color: #10b981;
        }

        .email-status-banner.disabled i {
          color: #f59e0b;
        }

        .email-status-banner strong {
          display: block;
          margin-bottom: 4px;
        }

        .email-status-banner p {
          margin: 0;
          font-size: 12px;
        }

        .alert-rate-limit {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .alert-rate-limit i {
          font-size: 24px;
          color: #ffc107;
        }

        .alert-rls-error {
          background: #f8d7da;
          border-left: 4px solid #dc3545;
          padding: 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .alert-rls-error i {
          font-size: 24px;
          color: #dc3545;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
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

        .header-text {
          flex: 1;
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

        .form-card {
          background: white;
          border-radius: 28px;
          padding: 32px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        }

        .alert-warning-card {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .alert-warning-card i {
          font-size: 24px;
          color: #ffc107;
        }

        .alert-warning-card div {
          flex: 1;
        }

        .alert-warning-card strong {
          display: block;
          margin-bottom: 4px;
        }

        .alert-warning-card p {
          margin: 0;
          font-size: 13px;
          color: #856404;
        }

        .retry-btn {
          padding: 6px 12px;
          background: #ffc107;
          border: none;
          border-radius: 8px;
          color: #856404;
          font-size: 12px;
          font-weight: 500;
        }

        .alert-error-card {
          background: #f8d7da;
          border-left: 4px solid #dc3545;
          padding: 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .alert-error-card i {
          font-size: 24px;
          color: #dc3545;
        }

        .info-card {
          background: #e7f1ff;
          border-left: 4px solid #0d6efd;
          padding: 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .info-card i {
          font-size: 24px;
          color: #0d6efd;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-bottom: 24px;
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

        .password-strength {
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .strength-bar {
          flex: 1;
          height: 4px;
          background: #e9ecef;
          border-radius: 2px;
          overflow: hidden;
        }

        .strength-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .strength-text {
          font-size: 11px;
          color: #6c757d;
        }

        .error-message {
          margin-top: 6px;
          font-size: 12px;
          color: #dc3545;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .toggle-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 26px;
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
          background-color: #e9ecef;
          transition: 0.3s;
          border-radius: 26px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        .toggle-switch input:checked + .toggle-slider {
          background-color: #10b981;
        }

        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }

        .toggle-label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .super-admin-card {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 32px;
        }

        .checkbox-wrapper {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
        }

        .checkbox-wrapper input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
        }

        .checkbox-custom {
          width: 24px;
          height: 24px;
          background: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .checkbox-wrapper input:checked + .checkbox-custom {
          background: #f59e0b;
          color: white;
        }

        .checkbox-label {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .checkbox-label strong {
          color: #92400e;
          font-size: 14px;
        }

        .checkbox-description {
          font-size: 12px;
          color: #b45309;
        }

        .action-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 16px;
          padding-top: 24px;
          border-top: 1px solid #e9ecef;
        }

        .btn-cancel {
          padding: 12px 28px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 14px;
          color: #6c757d;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .btn-cancel:hover {
          background: #e9ecef;
          transform: translateY(-1px);
        }

        .btn-submit {
          padding: 12px 32px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 14px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .btn-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }

        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
          .page-header {
            flex-direction: column;
          }
          .header-content {
            width: 100%;
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