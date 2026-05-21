import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

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

        
        setSession(parsed)
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
    document.cookie = 'admin-session=; path=/; max-age=0'
    await supabase.auth.signOut()
  }

  const fetchStats = async () => {
    try {
      const [usersRes, reportsRes, adminsRes] = await Promise.all([
        supabase.from('admin_users').select('*', { count: 'exact', head: true }),
        supabase.from('system_reports').select('*', { count: 'exact', head: true }).eq('report_status', 'PENDING'),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_active', true)
      ])

      setStats({
        totalUsers: usersRes.count || 0,
        totalPosts: 1250,
        totalReports: reportsRes.count || 0,
        activeAdmins: adminsRes.count || 0
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const handleLogout = async () => {
    await clearSession()
    router.push('/admin/login')
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">Verifying session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-vh-100 bg-light">
      {/* Navbar */}
      <nav className="navbar navbar-dark bg-primary shadow-lg sticky-top">
        <div className="container-fluid px-4">
          <div className="d-flex align-items-center">
            <i className="bi bi-tractor fs-3 text-white me-2"></i>
            <div>
              <h4 className="text-white mb-0">Smart Farmer Admin</h4>
              <small className="text-white-50">Dashboard</small>
            </div>
          </div>
          
          {/* Profile Dropdown */}
          <div className="dropdown">
            <button
              className="btn btn-link text-white text-decoration-none dropdown-toggle"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              data-bs-toggle="dropdown"
            >
              <div className="d-flex align-items-center">
                <div className="bg-white rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '40px', height: '40px' }}>
                  <i className="bi bi-person-circle fs-3 text-primary"></i>
                </div>
                <div className="text-start">
                  <div className="fw-bold">{session.admin.full_name}</div>
                  <small>{session.role}</small>
                </div>
              </div>
            </button>
            <ul className={`dropdown-menu dropdown-menu-end ${showProfileMenu ? 'show' : ''}`}>
              <li className="dropdown-item-text">
                <strong>{session.admin.email}</strong>
              </li>
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button className="dropdown-item" onClick={() => {}}>
                  <i className="bi bi-person me-2"></i> Profile Settings
                </button>
              </li>
              <li>
                <button className="dropdown-item" onClick={() => {}}>
                  <i className="bi bi-shield-lock me-2"></i> Security
                </button>
              </li>
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button className="dropdown-item text-danger" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2"></i> Logout
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container-fluid px-4 py-4">
        {/* Welcome Banner */}
        <div className="alert alert-primary border-0 shadow-sm" role="alert">
          <div className="d-flex align-items-center">
            <i className="bi bi-emoji-smile fs-1 me-3"></i>
            <div>
              <h5 className="alert-heading mb-1">Welcome back, {session.admin.full_name.split(' ')[0]}!</h5>
              <p className="mb-0">You're logged in as <strong>{session.role}</strong>. Here's what's happening with your platform today.</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="row g-4 mb-4">
          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <p className="text-muted mb-1">Total Users</p>
                    <h2 className="mb-0">{stats.totalUsers.toLocaleString()}</h2>
                  </div>
                  <div className="bg-primary bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-people fs-1 text-primary"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <p className="text-muted mb-1">Total Posts</p>
                    <h2 className="mb-0">{stats.totalPosts.toLocaleString()}</h2>
                  </div>
                  <div className="bg-success bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-file-post fs-1 text-success"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <p className="text-muted mb-1">Pending Reports</p>
                    <h2 className="mb-0 text-warning">{stats.totalReports}</h2>
                  </div>
                  <div className="bg-warning bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-flag fs-1 text-warning"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <p className="text-muted mb-1">Active Admins</p>
                    <h2 className="mb-0">{stats.activeAdmins}</h2>
                  </div>
                  <div className="bg-info bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-shield-check fs-1 text-info"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white border-0 pt-4">
            <h5 className="mb-0">
              <i className="bi bi-lightning-charge me-2 text-primary"></i>
              Quick Actions
            </h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <button className="btn btn-outline-primary w-100 py-3">
                  <i className="bi bi-people fs-4 d-block mb-2"></i>
                  Manage Users
                </button>
              </div>
              <div className="col-md-3">
                <button className="btn btn-outline-success w-100 py-3">
                  <i className="bi bi-file-post fs-4 d-block mb-2"></i>
                  Moderate Content
                </button>
              </div>
              <div className="col-md-3">
                <button className="btn btn-outline-warning w-100 py-3">
                  <i className="bi bi-flag fs-4 d-block mb-2"></i>
                  View Reports
                </button>
              </div>
              <div className="col-md-3">
                <button className="btn btn-outline-secondary w-100 py-3">
                  <i className="bi bi-gear fs-4 d-block mb-2"></i>
                  System Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}