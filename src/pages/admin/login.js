import { useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import ReCAPTCHA from 'react-google-recaptcha'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const recaptchaRef = useRef(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Execute invisible reCAPTCHA
      const token = await recaptchaRef.current.executeAsync()
      recaptchaRef.current.reset()
      if (!token) throw new Error('reCAPTCHA verification failed. Please try again.')

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

      // Query admin_users table (get role_id)
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select(`
          admin_id,
          full_name,
          email,
          is_active,
          is_super_admin,
          role_id
        `)
        .eq('email', email.toLowerCase())
        .maybeSingle()

      if (adminError) throw new Error('Database error occurred')
      if (!adminData) throw new Error('Not authorized as admin.')
      if (!adminData.is_active) throw new Error('Admin account is disabled.')

      // ✅ Fetch role name explicitly using role_id
      let role = null
      if (adminData.role_id) {
        const { data: roleData, error: roleError } = await supabase
          .from('admin_roles')
          .select('role_name')
          .eq('role_id', adminData.role_id)
          .maybeSingle()

        if (roleError) throw new Error('Role lookup failed.')
        role = roleData?.role_name || null
      }

      if (!role) {
        throw new Error(role)
      }

      // Store session with role included
      localStorage.setItem('adminSession', JSON.stringify({
        user: authData.user,
        admin: adminData,
        role,
        loggedInAt: new Date().toISOString()
      }))

      document.cookie = `admin-session=1; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`

      await router.push('/admin/dashboard')
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message)
    } finally {
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

          {/* Invisible reCAPTCHA */}
          <ReCAPTCHA
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
            size="invisible"
            ref={recaptchaRef}
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
