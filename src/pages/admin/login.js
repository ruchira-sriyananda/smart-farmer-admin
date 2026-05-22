import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import ReCAPTCHA from 'react-google-recaptcha'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const router = useRouter()
  const recaptchaRef = useRef(null)

  useEffect(() => {
    // Check for saved email
    const savedEmail = localStorage.getItem('rememberedEmail')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
    
    // Check if user is already logged in
    const checkExistingSession = async () => {
      const session = localStorage.getItem('adminSession')
      if (session) {
        const sessionData = JSON.parse(session)
        // Verify session is still valid
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        if (currentSession) {
          router.push('/admin/dashboard')
        }
      }
    }
    checkExistingSession()
  }, [router])

  // Get real client IP address
  const getClientIP = async () => {
    try {
      const services = [
        'https://api.ipify.org?format=json',
        'https://api.my-ip.io/ip.json',
        'https://ipapi.co/json/'
      ]
      
      for (const service of services) {
        try {
          const response = await fetch(service)
          const data = await response.json()
          const ip = data.ip || data
          if (ip && ip !== 'unknown') {
            return ip
          }
        } catch (e) {
          continue
        }
      }
      return 'unknown'
    } catch (err) {
      console.error('Error getting IP:', err)
      return 'unknown'
    }
  }

  // Log activity to database
  const logActivity = async (adminId, type, description, ip) => {
    try {
      await supabase
        .from('admin_activity_logs')
        .insert({
          admin_id: adminId,
          activity_type: type,
          activity_description: description,
          ip_address: ip,
          created_at: new Date().toISOString()
        })
    } catch (err) {
      console.error('Error logging activity:', err)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const clientIP = await getClientIP()

    try {
      // Validate inputs
      if (!email || !password) {
        throw new Error('Please enter both email and password')
      }

      // Execute reCAPTCHA
      let token
      try {
        token = await recaptchaRef.current.executeAsync()
        recaptchaRef.current.reset()
      } catch (recaptchaError) {
        console.error('reCAPTCHA error:', recaptchaError)
        throw new Error('Security verification failed. Please refresh and try again.')
      }

      if (!token) {
        throw new Error('Security verification failed. Please try again.')
      }

      // Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })
      
      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          throw new Error('Invalid email or password')
        }
        throw authError
      }

      if (!authData.user) {
        throw new Error('Authentication failed')
      }

      // Query admin_users table with role information
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select(`
          admin_id,
          full_name,
          email,
          is_active,
          is_super_admin,
          role_id,
          created_at,
          last_login
        `)
        .eq('email', email.toLowerCase().trim())
        .maybeSingle()

      if (adminError) {
        console.error('Admin query error:', adminError)
        throw new Error('Database error occurred')
      }

      if (!adminData) {
        await logActivity(null, 'LOGIN_FAILED', `Failed login attempt for non-admin user: ${email}`, clientIP)
        throw new Error('Access denied. You do not have administrator privileges.')
      }

      if (!adminData.is_active) {
        await logActivity(adminData.admin_id, 'LOGIN_FAILED', `Login attempt on disabled account: ${email}`, clientIP)
        throw new Error('Your account has been disabled. Please contact support.')
      }

      // Get role name from admin_roles table
      let role = 'SUPER_ADMIN'
      if (adminData.role_id) {
        const { data: roleData, error: roleError } = await supabase
          .from('admin_roles')
          .select('role_name')
          .eq('role_id', adminData.role_id)
          .single()
        
        if (!roleError && roleData) {
          role = roleData.role_name
        }
      } else if (adminData.is_super_admin) {
        role = 'SUPER_ADMIN'
      }

      // Update last login timestamp
      await supabase
        .from('admin_users')
        .update({ 
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('admin_id', adminData.admin_id)

      // Log successful login
      await logActivity(adminData.admin_id, 'LOGIN', `Admin logged in successfully from IP: ${clientIP}`, clientIP)

      // Save email if remember me is checked
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email)
      } else {
        localStorage.removeItem('rememberedEmail')
      }

      // Create complete session data
      const sessionData = {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          created_at: authData.user.created_at,
          user_metadata: authData.user.user_metadata
        },
        admin: {
          admin_id: adminData.admin_id,
          full_name: adminData.full_name,
          email: adminData.email,
          is_active: adminData.is_active,
          is_super_admin: adminData.is_super_admin,
          role_id: adminData.role_id,
          created_at: adminData.created_at,
          last_login: new Date().toISOString()
        },
        role: role,
        sessionId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        loggedInAt: new Date().toISOString(),
        ipAddress: clientIP,
        userAgent: navigator.userAgent
      }

      console.log('Session created:', {
        admin: sessionData.admin.full_name,
        role: sessionData.role,
        email: sessionData.admin.email,
        ip: sessionData.ipAddress
      })

      // Store session in localStorage
      localStorage.setItem('adminSession', JSON.stringify(sessionData))
      
      // Set secure cookie for middleware
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + 7)
      document.cookie = `admin-session=1; path=/; expires=${expiryDate.toUTCString()}; samesite=lax; ${window.location.protocol === 'https:' ? 'secure;' : ''}`

      // Redirect to dashboard
      await router.push('/admin/dashboard')
      
    } catch (err) {
      console.error('Login error:', err)
      
      // Log failed attempt
      try {
        await supabase
          .from('failed_login_attempts')
          .insert({
            email: email,
            ip_address: clientIP,
            failure_reason: err.message,
            device_info: navigator.userAgent,
            attempt_time: new Date().toISOString()
          })
      } catch (logErr) {
        console.error('Error logging failed attempt:', logErr)
      }
      
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-gradient-primary">
      <style jsx global>{`
        .bg-gradient-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .card-shadow {
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .input-group-text {
          background-color: transparent;
          border-right: none;
        }
        .form-control {
          border-left: none;
        }
        .form-control:focus {
          border-color: #ced4da;
          box-shadow: none;
        }
        .input-group:focus-within {
          box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
          border-radius: 0.375rem;
        }
        .input-group:focus-within .input-group-text {
          border-color: #86b7fe;
        }
        .btn-gradient {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn-gradient:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }
        .btn-gradient:active {
          transform: translateY(0);
        }
        .btn-gradient:disabled {
          opacity: 0.7;
          transform: none;
        }
      `}</style>

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5 col-xl-4">
            {/* Brand Logo */}
            <div className="text-center mb-4">
              <div className="bg-white rounded-circle d-inline-flex p-3 shadow-lg mb-3">
                <i className="bi bi-tractor fs-1 text-primary"></i>
              </div>
              <h2 className="text-white fw-bold mb-2">Smart Farmer</h2>
              <p className="text-white-50">Administrator Access Portal</p>
            </div>

            {/* Login Card */}
            <div className="card card-shadow border-0 rounded-4">
              <div className="card-body p-5">
                <div className="text-center mb-4">
                  <i className="bi bi-shield-lock fs-1 text-primary"></i>
                  <h4 className="mt-2 fw-bold">Secure Admin Login</h4>
                  <p className="text-muted small">Enter your credentials to access the dashboard</p>
                </div>

                {error && (
                  <div className="alert alert-danger alert-dismissible fade show" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {error}
                    <button type="button" className="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                  </div>
                )}

                <form onSubmit={handleLogin}>
                  {/* Email Field */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      <i className="bi bi-envelope me-1"></i> Email Address
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-white">
                        <i className="bi bi-envelope-fill text-muted"></i>
                      </span>
                      <input
                        type="email"
                        className="form-control py-2"
                        placeholder="admin@smartfarmer.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      <i className="bi bi-lock me-1"></i> Password
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-white">
                        <i className="bi bi-key-fill text-muted"></i>
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        className="form-control py-2"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary bg-white"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex="-1"
                      >
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                  </div>

                  {/* Remember Me & Forgot Password */}
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <label className="form-check-label small" htmlFor="rememberMe">
                        Remember me
                      </label>
                    </div>
                    <a href="#" className="text-decoration-none small text-primary">
                      Forgot Password?
                    </a>
                  </div>

                  {/* reCAPTCHA */}
                  <ReCAPTCHA
                    sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'}
                    size="invisible"
                    ref={recaptchaRef}
                  />

                  {/* Login Button */}
                  <button
                    type="submit"
                    className="btn btn-gradient w-100 py-2 text-white fw-bold"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-box-arrow-in-right me-2"></i>
                        Login to Dashboard
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="position-relative my-4">
                  <hr />
                  <span className="position-absolute top-50 start-50 translate-middle bg-white px-3 text-muted small">
                    Secure Access
                  </span>
                </div>

                {/* Security Badges */}
                <div className="text-center">
                  <div className="d-flex justify-content-center gap-3 mb-3">
                    <i className="bi bi-shield-check text-success fs-5" title="SSL Secure"></i>
                    <i className="bi bi-lock-fill text-primary fs-5" title="256-bit Encryption"></i>
                    <i className="bi bi-check-circle-fill text-info fs-5" title="2FA Ready"></i>
                    <i className="bi bi-incognito text-warning fs-5" title="IP Logging Enabled"></i>
                  </div>
                  <p className="text-muted small mb-0">
                    <i className="bi bi-shield-lock me-1"></i>
                    Your connection is secure and encrypted. All activities are logged.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-4">
              <p className="text-white-50 small">
                <i className="bi bi-c-circle me-1"></i>
                2024 Smart Farmer Platform. All rights reserved.
              </p>
              <p className="text-white-50 small">
                <i className="bi bi-shield-check me-1"></i>
                Protected by reCAPTCHA and enterprise-grade security
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}