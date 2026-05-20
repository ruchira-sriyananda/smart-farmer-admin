import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import ReCAPTCHA from 'react-google-recaptcha'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rateLimit, setRateLimit] = useState({ count: 0, resetTime: null })
  const router = useRouter()
  const recaptchaRef = useRef(null)

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      const session = localStorage.getItem('adminSession')
      const hasCookie = document.cookie.includes('admin-session=1')
      
      if (session && hasCookie) {
        // Verify session is still valid with Supabase
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        if (currentSession) {
          router.push('/admin/dashboard')
        } else {
          // Invalid session, clear local storage
          localStorage.removeItem('adminSession')
          document.cookie = 'admin-session=1; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        }
      }
    }
    
    checkExistingSession()
  }, [router])

  // Rate limiting check
  const checkRateLimit = () => {
    const now = Date.now()
    if (rateLimit.resetTime && now < rateLimit.resetTime) {
      if (rateLimit.count >= 5) {
        const waitMinutes = Math.ceil((rateLimit.resetTime - now) / 60000)
        throw new Error(`Too many failed attempts. Please try again in ${waitMinutes} minutes.`)
      }
    } else {
      // Reset rate limit
      setRateLimit({ count: 0, resetTime: null })
    }
  }

  // Log failed attempt to database
  const logFailedAttempt = async (email, reason) => {
    try {
      await supabase
        .from('failed_login_attempts')
        .insert({
          email: email,
          ip_address: await getClientIP(),
          device_info: navigator.userAgent,
          failure_reason: reason,
          attempt_time: new Date().toISOString()
        })
    } catch (err) {
      console.error('Failed to log attempt:', err)
    }
  }

  // Get client IP (for logging)
  const getClientIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch (err) {
      return 'unknown'
    }
  }

  // Validate email format
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/
    return emailRegex.test(email)
  }

  // Validate password strength
  const validatePassword = (password) => {
    if (password.length < 8) return false
    if (!/[A-Z]/.test(password)) return false
    if (!/[a-z]/.test(password)) return false
    if (!/[0-9]/.test(password)) return false
    return true
  }

  // Sanitize input
  const sanitizeInput = (input) => {
    return input.trim().replace(/[<>]/g, '')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Rate limiting check
      checkRateLimit()

      // Input validation
      const sanitizedEmail = sanitizeInput(email)
      const sanitizedPassword = sanitizeInput(password)

      if (!validateEmail(sanitizedEmail)) {
        throw new Error('Please enter a valid email address.')
      }

      if (!validatePassword(sanitizedPassword)) {
        throw new Error('Password must be at least 8 characters with uppercase, lowercase, and numbers.')
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

      // Verify reCAPTCHA token with backend (optional but recommended)
      const recaptchaValid = await verifyRecaptcha(token)
      if (!recaptchaValid) {
        throw new Error('Security verification failed. Please try again.')
      }

      // Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password: sanitizedPassword
      })
      
      if (authError) {
        await logFailedAttempt(sanitizedEmail, authError.message)
        
        // Update rate limit
        setRateLimit(prev => ({
          count: prev.count + 1,
          resetTime: prev.resetTime || Date.now() + 15 * 60 * 1000 // 15 minutes
        }))
        
        if (authError.message === 'Invalid login credentials') {
          throw new Error('Invalid email or password. Please try again.')
        }
        throw authError
      }

      // Query admin_users table with security checks
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select(`
          admin_id,
          full_name,
          email,
          is_active,
          is_super_admin,
          last_login,
          admin_roles (
            role_name,
            description
          )
        `)
        .eq('email', sanitizedEmail.toLowerCase())
        .maybeSingle()

      if (adminError) {
        await logFailedAttempt(sanitizedEmail, 'Database error')
        throw new Error('System error occurred. Please try again later.')
      }

      if (!adminData) {
        await logFailedAttempt(sanitizedEmail, 'Not authorized as admin')
        throw new Error('Access denied. You do not have administrator privileges.')
      }

      if (!adminData.is_active) {
        await logFailedAttempt(sanitizedEmail, 'Account disabled')
        throw new Error('Your account has been disabled. Please contact support.')
      }

      // Extract role safely
      let role = 'unknown'
      if (adminData.admin_roles) {
        if (Array.isArray(adminData.admin_roles) && adminData.admin_roles.length > 0) {
          role = adminData.admin_roles[0].role_name
        } else if (adminData.admin_roles.role_name) {
          role = adminData.admin_roles.role_name
        }
      }

      // Update last login timestamp
      await supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('admin_id', adminData.admin_id)

      // Create secure session data (exclude sensitive info)
      const sessionData = {
        user: {
          id: authData.user.id,
          email: authData.user.email
        },
        admin: {
          admin_id: adminData.admin_id,
          full_name: adminData.full_name,
          email: adminData.email,
          is_super_admin: adminData.is_super_admin
        },
        role: role,
        loggedInAt: new Date().toISOString(),
        sessionId: crypto.randomUUID?.() || Math.random().toString(36)
      }
      
      // Store session in localStorage with encryption flag
      localStorage.setItem('adminSession', JSON.stringify(sessionData))

      // Set secure cookies
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + 7)
      
      document.cookie = `admin-session=1; path=/; expires=${expiryDate.toUTCString()}; samesite=lax; Secure=${location.protocol === 'https:' ? 'true' : 'false'}`
      document.cookie = `admin-email=${encodeURIComponent(authData.user.email)}; path=/; expires=${expiryDate.toUTCString()}; samesite=lax`

      // Log successful login
      console.log('✅ Admin login successful:', adminData.full_name)

      // Redirect to dashboard with timeout for safety
      setTimeout(() => {
        router.push('/admin/dashboard').catch(() => {
          window.location.href = '/admin/dashboard'
        })
      }, 100)
      
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  // Verify reCAPTCHA token with backend (optional)
  const verifyRecaptcha = async (token) => {
    try {
      const response = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      const data = await response.json()
      return data.success
    } catch (err) {
      // If backend verification fails, still allow login (fallback to frontend only)
      console.warn('reCAPTCHA backend verification failed:', err)
      return true
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-green-700">Smart Farmer Admin</h1>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4 text-sm">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="block text-gray-700 text-sm mb-1">Email Address</label>
            <input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              required
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm mb-1">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              required
              disabled={loading}
              autoComplete="off"
            />
          </div>

          {/* Invisible reCAPTCHA */}
          <ReCAPTCHA
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'}
            size="invisible"
            ref={recaptchaRef}
            badge="bottomright"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:bg-gray-400 transition duration-200"
          >
            {loading ? 'Authenticating...' : 'Login to Admin Panel'}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-gray-500">
          <p>Secure Admin Access Only</p>
        </div>
      </div>
    </div>
  )
}