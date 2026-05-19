import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'
import ReCAPTCHA from 'react-google-recaptcha'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null) // ✅ moved here
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // ✅ Captcha validation first
      if (!captchaToken) {
        setError('Please verify you are not a robot')
        setLoading(false)
        return
      }

      // Sign in with Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) throw authError

      // Check admin_users table by email
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select(`
          admin_id,
          full_name,
          email,
          is_active,
          is_super_admin,
          admin_roles!inner (
            role_id,
            role_name,
            description
          )
        `)
        .eq('email', email)
        .single()

      if (adminError || !adminData) {
        throw new Error('Unauthorized: Admin access required')
      }

      if (!adminData.is_active) {
        throw new Error('Account is disabled')
      }

      // Store admin session
      localStorage.setItem('adminSession', JSON.stringify({
        admin_id: adminData.admin_id,
        full_name: adminData.full_name,
        email: adminData.email,
        role: adminData.admin_roles.role_name,
        is_super_admin: adminData.is_super_admin
      }))

      router.push('/admin/dashboard')
    } catch (err) {
      setError(err.message)
      // Log failed attempt
      await supabase.from('audit_logs').insert({
        action: 'FAILED_LOGIN',
        admin_id: null,
        ip_address: await getClientIP(),
        details: { email }
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6">Smart Farmer Admin</h1>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
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
          <ReCAPTCHA
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
            onChange={(token) => setCaptchaToken(token)}
          />
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

async function getClientIP() {
  const res = await fetch('https://api.ipify.org?format=json')
  const data = await res.json()
  return data.ip
}
