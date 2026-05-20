import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

export default function AdminDashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    totalReports: 0,
    activeAdmins: 0
  })

  useEffect(() => {
    const validateSession = async () => {
      try {
        const storedSession = localStorage.getItem('adminSession')
        
        if (!storedSession) {
          router.push('/admin/login')
          return
        }

        const parsed = JSON.parse(storedSession)

        // Validate required fields
        if (!parsed?.admin?.admin_id || !parsed?.role || !parsed?.user?.id) {
          console.error('Invalid session structure')
          await clearSession()
          router.push('/admin/login')
          return
        }

        // Verify session with Supabase
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !currentSession) {
          console.error('Invalid Supabase session')
          await clearSession()
          router.push('/admin/login')
          return
        }

        // Verify user is still admin in database
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
          .eq('admin_id', parsed.admin.admin_id)
          .eq('is_active', true)
          .maybeSingle()

        if (adminError || !adminData) {
          console.error('Admin no longer authorized')
          await clearSession()
          router.push('/admin/login')
          return
        }

        // Update session with latest data
        const updatedSession = {
          ...parsed,
          admin: {
            ...parsed.admin,
            full_name: adminData.full_name,
            email: adminData.email,
            is_super_admin: adminData.is_super_admin
          }
        }
        
        setSession(updatedSession)
        
        // Fetch dashboard stats
        await fetchStats()
        
      } catch (err) {
        console.error('Session validation error:', err)
        await clearSession()
        router.push('/admin/login')
      } finally {
        setLoading(false)
      }
    }

    validateSession()
  }, [router])

  const clearSession = async () => {
    localStorage.removeItem('adminSession')
    document.cookie = 'admin-session=; path=/; max-age=0; samesite=lax'
    document.cookie = 'admin-email=; path=/; max-age=0; samesite=lax'
    await supabase.auth.signOut()
  }

  const fetchStats = async () => {
    try {
      // Fetch real-time stats from database
      const [usersRes, postsRes, reportsRes, adminsRes] = await Promise.all([
        supabase.from('admin_users').select('*', { count: 'exact', head: true }),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }),
        supabase.from('system_reports').select('*', { count: 'exact', head: true }).eq('report_status', 'PENDING'),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_active', true)
      ])

      setStats({
        totalUsers: usersRes.count || 0,
        totalPosts: postsRes.count || 0,
        totalReports: reportsRes.count || 0,
        activeAdmins: adminsRes.count || 0
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const handleLogout = async () => {
    try {
      // Log logout activity
      if (session) {
        await supabase
          .from('admin_activity_logs')
          .insert({
            admin_id: session.admin.admin_id,
            activity_type: 'LOGOUT',
            activity_description: 'Admin logged out',
            ip_address: await getClientIP(),
            created_at: new Date().toISOString()
          })
      }
      
      await clearSession()
      router.push('/admin/login')
    } catch (err) {
      console.error('Logout error:', err)
      router.push('/admin/login')
    }
  }

  const getClientIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch (err) {
      return 'unknown'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with Profile */}
      <header className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Smart Farmer Admin Panel</h1>
              <p className="text-sm text-gray-500 mt-1">Administration Dashboard</p>
            </div>
            
            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg p-2"
              >
                <div className="bg-green-600 rounded-full w-10 h-10 flex items-center justify-center text-white font-bold">
                  {session.admin.full_name?.charAt(0).toUpperCase() || 'A'}
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{session.admin.full_name}</p>
                  <p className="text-xs text-gray-500">{session.role}</p>
                </div>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-20">
                  <div className="p-4 border-b">
                    <p className="font-medium text-gray-900">{session.admin.full_name}</p>
                    <p className="text-sm text-gray-500">{session.admin.email}</p>
                    {session.admin.is_super_admin && (
                      <span className="inline-block mt-1 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                        Super Admin
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false)
                        // Navigate to profile page (to be implemented)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      👤 Profile Settings
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false)
                        // Navigate to security page
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      🔐 Security
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={() => {
                        setShowProfileMenu(false)
                        handleLogout()
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      🚪 Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-green-500 to-green-700 rounded-lg shadow-lg p-6 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-2">
            Welcome back, {session.admin.full_name.split(' ')[0]}!
          </h2>
          <p className="text-green-100">
            You are logged in as <strong>{session.role}</strong>. Last login: {session.loggedInAt ? new Date(session.loggedInAt).toLocaleString() : 'First login'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Posts</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalPosts}</p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Pending Reports</p>
                <p className="text-3xl font-bold text-red-600">{stats.totalReports}</p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Active Admins</p>
                <p className="text-3xl font-bold text-gray-900">{stats.activeAdmins}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="bg-blue-50 text-blue-700 p-3 rounded-lg hover:bg-blue-100 transition text-left">
              👥 Manage Users
            </button>
            <button className="bg-purple-50 text-purple-700 p-3 rounded-lg hover:bg-purple-100 transition text-left">
              📝 Content Moderation
            </button>
            <button className="bg-red-50 text-red-700 p-3 rounded-lg hover:bg-red-100 transition text-left">
              📊 View Reports
            </button>
            <button className="bg-gray-50 text-gray-700 p-3 rounded-lg hover:bg-gray-100 transition text-left">
              ⚙️ System Settings
            </button>
          </div>
        </div>
      </main>

      {/* Click outside to close profile menu */}
      {showProfileMenu && (
        <div 
          className="fixed inset-0 z-10"
          onClick={() => setShowProfileMenu(false)}
        />
      )}
    </div>
  )
}