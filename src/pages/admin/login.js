import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import ReCAPTCHA from 'react-google-recaptcha'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Require reCAPTCHA
      if (!captchaToken) {
        throw new Error('Please verify the reCAPTCHA before logging in.')
      }

      // Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          throw new Error('Invalid email or password')
        }
        throw authError
      }

      // Query admin_users table
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select(`
          admin_id,
          full_name,
          email,
          is_active,
          is_super_admin,
          admin_roles (
            role_name
          )
        `)
        .eq('email', email.toLowerCase())
        .maybeSingle()

      if (adminError) {
        console.error('Admin query error:', adminError)
        throw new Error('Database error occurred')
      }

      if (!adminData) {
        throw new Error('Not authorized as admin. Please contact system administrator.')
      }

      if (!adminData.is_active) {
        throw new Error('Admin account is disabled. Please contact support.')
      }

      // Safe role extraction
      const role = adminData.admin_roles?.[0]?.role_name || adminData.admin_roles?.role_name
      if (!role) {
        throw new Error('No valid role assigned. Contact support.')
      }

      // Store session
      localStorage.setItem('adminSession', JSON.stringify({
        user: authData.user,
        admin: adminData,
        role,
        loggedInAt: new Date().toISOString()
      }))

      // Sync cookie for server-side checks
      document.cookie = `admin-session=1; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`

      // Redirect to dashboard
      try {
        await router.push('/admin/dashboard')
      } catch (routerError) {
        console.log('Router push failed, using window.location')
        window.location.href = '/admin/dashboard'
      }

    } catch (err) {
      console.error('Login error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6">Smart Farmer Admin</h1>
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded mb-3"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded mb-3"
            required
          />

          {/* reCAPTCHA widget */}
          <ReCAPTCHA
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
            onChange={(token) => setCaptchaToken(token)}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:bg-gray-400 mt-3"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}
