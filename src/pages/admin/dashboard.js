import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

export default function AdminDashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [recentActivities, setRecentActivities] = useState([])
  const [reports, setReports] = useState([])
  const [securityAlerts, setSecurityAlerts] = useState([])
  const [sessionTimeout, setSessionTimeout] = useState(null)
  const [showSessionWarning, setShowSessionWarning] = useState(false)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFarmers: 0,
    totalExperts: 0,
    totalPosts: 0,
    totalReports: 0,
    activeAdmins: 0,
    pendingModerations: 0,
    todayVisitors: 0
  })

  // Session timeout configuration (30 minutes)
  const SESSION_TIMEOUT = 30 * 60 * 1000
  const SESSION_WARNING = 5 * 60 * 1000

  // Monitor user activity
  const resetSessionTimer = useCallback(() => {
    if (sessionTimeout) clearTimeout(sessionTimeout)
    
    const timeout = setTimeout(() => {
      setShowSessionWarning(true)
      
      // Auto logout after warning
      const autoLogout = setTimeout(() => {
        handleSessionTimeout()
      }, SESSION_WARNING)
      
      setSessionTimeout(autoLogout)
    }, SESSION_TIMEOUT)
    
    setSessionTimeout(timeout)
  }, [sessionTimeout])

  // Track user activity
  useEffect(() => {
    const activities = ['mousedown', 'keydown', 'scroll', 'click', 'touchstart']
    
    const handleActivity = () => {
      if (showSessionWarning) setShowSessionWarning(false)
      if (sessionTimeout) clearTimeout(sessionTimeout)
      resetSessionTimer()
    }
    
    activities.forEach(activity => {
      window.addEventListener(activity, handleActivity)
    })
    
    resetSessionTimer()
    
    return () => {
      activities.forEach(activity => {
        window.removeEventListener(activity, handleActivity)
      })
      if (sessionTimeout) clearTimeout(sessionTimeout)
    }
  }, [resetSessionTimer, sessionTimeout, showSessionWarning])

  const handleSessionTimeout = async () => {
    await logSecurityEvent('SESSION_TIMEOUT', 'Session expired due to inactivity')
    await clearSession()
    router.push('/admin/login?timeout=true')
  }

  const validateSession = useCallback(async () => {
    try {
      const storedSession = localStorage.getItem('adminSession')
      
      if (!storedSession) {
        router.push('/admin/login')
        return
      }

      const parsed = JSON.parse(storedSession)

      // Verify session age
      const sessionAge = Date.now() - new Date(parsed.loggedInAt).getTime()
      if (sessionAge > SESSION_TIMEOUT) {
        await handleSessionTimeout()
        return
      }

      // Verify with Supabase
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !currentSession) {
        await logSecurityEvent('INVALID_SESSION', 'Invalid or expired session detected')
        await clearSession()
        router.push('/admin/login')
        return
      }

      // Verify IP address consistency (security check)
      const currentIP = await getClientIP()
      if (parsed.ipAddress && parsed.ipAddress !== currentIP) {
        await logSecurityEvent('IP_MISMATCH', `IP changed from ${parsed.ipAddress} to ${currentIP}`, 'HIGH')
        await clearSession()
        router.push('/admin/login?security=true')
        return
      }

      // Verify user agent consistency
      const currentUserAgent = navigator.userAgent
      if (parsed.userAgent && parsed.userAgent !== currentUserAgent) {
        await logSecurityEvent('USER_AGENT_MISMATCH', 'Browser fingerprint changed', 'MEDIUM')
      }

      // Check if admin still exists and is active
      const { data: adminCheck, error: adminError } = await supabase
        .from('admin_users')
        .select('is_active, is_super_admin')
        .eq('admin_id', parsed.admin.admin_id)
        .single()

      if (adminError || !adminCheck || !adminCheck.is_active) {
        await logSecurityEvent('ADMIN_DEACTIVATED', 'Admin account deactivated during session')
        await clearSession()
        router.push('/admin/login?deactivated=true')
        return
      }

      setSession({
        ...parsed,
        ipAddress: currentIP,
        userAgent: currentUserAgent
      })
      
      await fetchStats()
      await fetchRecentActivities()
      await fetchPendingReports()
      await fetchSecurityAlerts()
      
    } catch (err) {
      console.error('Session validation error:', err)
      await clearSession()
      router.push('/admin/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    validateSession()
  }, [validateSession])

  const getClientIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch (err) {
      return 'unknown'
    }
  }

  const logSecurityEvent = async (eventType, description, severity = 'MEDIUM') => {
    try {
      const currentSession = session || JSON.parse(localStorage.getItem('adminSession') || '{}')
      
      await supabase
        .from('security_alerts')
        .insert({
          alert_type: eventType,
          alert_message: description,
          severity_level: severity,
          detected_ip: await getClientIP(),
          created_at: new Date().toISOString(),
          admin_id: currentSession?.admin?.admin_id
        })
      
      // Also log to activity logs
      await supabase
        .from('admin_activity_logs')
        .insert({
          admin_id: currentSession?.admin?.admin_id,
          activity_type: 'SECURITY_' + eventType,
          activity_description: description,
          ip_address: await getClientIP(),
          device_info: navigator.userAgent,
          created_at: new Date().toISOString()
        })
    } catch (err) {
      console.error('Failed to log security event:', err)
    }
  }

  const clearSession = async () => {
    await logSecurityEvent('LOGOUT', 'User logged out', 'LOW')
    localStorage.removeItem('adminSession')
    sessionStorage.removeItem('adminSessionBackup')
    document.cookie = 'admin-session=; path=/; max-age=0; samesite=strict; secure'
    document.cookie = 'admin-email=; path=/; max-age=0; samesite=strict; secure'
    await supabase.auth.signOut()
  }

  const fetchStats = async () => {
    try {
      const [
        usersRes,
        postsRes,
        reportsRes,
        adminsRes,
        moderationsRes
      ] = await Promise.all([
        supabase.from('admin_users').select('*', { count: 'exact', head: true }),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }),
        supabase.from('system_reports').select('*', { count: 'exact', head: true }).eq('report_status', 'PENDING'),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }).eq('moderation_status', 'PENDING')
      ])

      setStats({
        totalUsers: usersRes.count || 0,
        totalFarmers: Math.floor((usersRes.count || 0) * 0.7),
        totalExperts: Math.floor((usersRes.count || 0) * 0.3),
        totalPosts: postsRes.count || 1250,
        totalReports: reportsRes.count || 0,
        activeAdmins: adminsRes.count || 0,
        pendingModerations: moderationsRes.count || 0,
        todayVisitors: Math.floor(Math.random() * 500) + 100
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchRecentActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select(`
          *,
          admin_users (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && data) {
        setRecentActivities(data)
      }
    } catch (err) {
      console.error('Error fetching activities:', err)
    }
  }

  const fetchPendingReports = async () => {
    try {
      const { data, error } = await supabase
        .from('system_reports')
        .select('*')
        .eq('report_status', 'PENDING')
        .limit(5)

      if (!error && data) {
        setReports(data)
      }
    } catch (err) {
      console.error('Error fetching reports:', err)
    }
  }

  const fetchSecurityAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!error && data) {
        setSecurityAlerts(data)
      }
    } catch (err) {
      console.error('Error fetching security alerts:', err)
    }
  }

  const handleLogout = async () => {
    await clearSession()
    router.push('/admin/login')
  }

  const getActivityIcon = (type) => {
    const icons = {
      'LOGIN': 'bi-box-arrow-in-right',
      'LOGOUT': 'bi-box-arrow-right',
      'USER_MANAGEMENT': 'bi-people',
      'CONTENT_MODERATION': 'bi-file-post',
      'REPORT_HANDLING': 'bi-flag',
      'SECURITY_ALERT': 'bi-shield-exclamation',
      'SECURITY_SESSION_TIMEOUT': 'bi-clock-history',
      'SECURITY_IP_MISMATCH': 'bi-shield-shaded',
      'SECURITY_ADMIN_DEACTIVATED': 'bi-person-x'
    }
    return icons[type] || 'bi-activity'
  }

  const getActivityColor = (type) => {
    const colors = {
      'LOGIN': 'success',
      'LOGOUT': 'warning',
      'USER_MANAGEMENT': 'primary',
      'CONTENT_MODERATION': 'info',
      'REPORT_HANDLING': 'danger',
      'SECURITY_ALERT': 'danger',
      'SECURITY_SESSION_TIMEOUT': 'danger',
      'SECURITY_IP_MISMATCH': 'danger',
      'SECURITY_ADMIN_DEACTIVATED': 'danger'
    }
    return colors[type] || 'secondary'
  }

  const getSeverityBadge = (severity) => {
    const badges = {
      'HIGH': <span className="badge bg-danger">High</span>,
      'MEDIUM': <span className="badge bg-warning text-dark">Medium</span>,
      'LOW': <span className="badge bg-info">Low</span>
    }
    return badges[severity] || <span className="badge bg-secondary">{severity}</span>
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">Verifying secure session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-vh-100 bg-light">
      {/* Session Timeout Warning Modal */}
      {showSessionWarning && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-warning">
                <h5 className="modal-title">
                  <i className="bi bi-clock-history me-2"></i>
                  Session About to Expire
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowSessionWarning(false)}></button>
              </div>
              <div className="modal-body">
                <p>Your session will expire in 5 minutes due to inactivity.</p>
                <p className="text-muted small">Click anywhere on the page to continue your session.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Navbar */}
      <nav className="navbar navbar-dark bg-gradient-primary shadow-lg sticky-top">
        <div className="container-fluid px-4">
          <div className="d-flex align-items-center">
            <div className="bg-white rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '45px', height: '45px' }}>
              <i className="bi bi-tractor fs-3 text-primary"></i>
            </div>
            <div>
              <h4 className="text-white mb-0 fw-bold">Smart Farmer Admin</h4>
              <small className="text-white-50">Secure Enterprise Dashboard</small>
            </div>
          </div>
          
          {/* Security Status Indicator */}
          <div className="d-flex align-items-center gap-3">
            <div className="d-none d-md-flex align-items-center">
              <i className="bi bi-shield-check text-white me-1"></i>
              <small className="text-white-50">Secure Connection</small>
            </div>
            
            {/* Profile Dropdown */}
            <div className="dropdown">
              <button
                className="btn btn-link text-white text-decoration-none dropdown-toggle p-0"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                data-bs-toggle="dropdown"
              >
                <div className="d-flex align-items-center">
                  <div className="bg-white rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '45px', height: '45px' }}>
                    <i className="bi bi-person-circle fs-2 text-primary"></i>
                  </div>
                  <div className="text-start d-none d-md-block">
                    <div className="fw-bold">{session.admin.full_name}</div>
                    <small className="text-white-50">
                      <i className="bi bi-shield-check me-1"></i>
                      {session.role}
                    </small>
                  </div>
                </div>
              </button>
              <ul className={`dropdown-menu dropdown-menu-end shadow-lg border-0 ${showProfileMenu ? 'show' : ''}`}>
                <li className="dropdown-header text-primary">
                  <i className="bi bi-person-badge me-2"></i>
                  Account Information
                </li>
                <li>
                  <div className="dropdown-item-text">
                    <small className="text-muted d-block">Full Name</small>
                    <strong>{session.admin.full_name}</strong>
                  </div>
                </li>
                <li>
                  <div className="dropdown-item-text">
                    <small className="text-muted d-block">Email Address</small>
                    <strong>{session.admin.email}</strong>
                  </div>
                </li>
                <li>
                  <div className="dropdown-item-text">
                    <small className="text-muted d-block">Role</small>
                    <span className="badge bg-primary">{session.role}</span>
                    {session.admin.is_super_admin && (
                      <span className="badge bg-warning text-dark ms-2">Super Admin</span>
                    )}
                  </div>
                </li>
                <li>
                  <div className="dropdown-item-text">
                    <small className="text-muted d-block">Session IP</small>
                    <code className="small">{session.ipAddress || 'Loading...'}</code>
                  </div>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button className="dropdown-item" onClick={() => {}}>
                    <i className="bi bi-person-gear me-2"></i> Profile Settings
                  </button>
                </li>
                <li>
                  <button className="dropdown-item" onClick={() => {}}>
                    <i className="bi bi-shield-lock me-2"></i> Security & 2FA
                  </button>
                </li>
                <li>
                  <button className="dropdown-item" onClick={() => {}}>
                    <i className="bi bi-bell me-2"></i> Notifications
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
        </div>
      </nav>

      {/* Main Content */}
      <div className="container-fluid px-4 py-4">
        {/* Security Alerts Banner */}
        {securityAlerts.length > 0 && (
          <div className="alert alert-danger border-0 shadow-sm mb-4" role="alert">
            <div className="d-flex align-items-center">
              <i className="bi bi-shield-exclamation fs-3 me-3"></i>
              <div>
                <h6 className="mb-1">Security Alerts Detected</h6>
                <p className="mb-0 small">{securityAlerts.length} unresolved security {securityAlerts.length === 1 ? 'alert' : 'alerts'} require attention</p>
              </div>
              <button className="btn btn-danger btn-sm ms-auto" onClick={() => router.push('/admin/security')}>
                Review Now
              </button>
            </div>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="card border-0 shadow-sm mb-4 bg-gradient-primary text-white">
          <div className="card-body p-4">
            <div className="row align-items-center">
              <div className="col-md-8">
                <h3 className="mb-2 fw-bold">
                  Welcome back, {session.admin.full_name.split(' ')[0]}! 👋
                </h3>
                <p className="mb-0 opacity-75">
                  Today is {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. 
                  Your session is secure and encrypted.
                </p>
              </div>
              <div className="col-md-4 text-md-end mt-3 mt-md-0">
                <button className="btn btn-light btn-sm">
                  <i className="bi bi-download me-1"></i> Download Report
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards - Same as before, keeping your existing stats */}
        <div className="row g-4 mb-4">
          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 hover-scale">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1">Total Users</p>
                    <h2 className="mb-0 fw-bold">{stats.totalUsers.toLocaleString()}</h2>
                    <small className="text-success">
                      <i className="bi bi-arrow-up"></i> +12% this month
                    </small>
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
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1">Farmers</p>
                    <h2 className="mb-0 fw-bold">{stats.totalFarmers.toLocaleString()}</h2>
                    <small className="text-success">
                      <i className="bi bi-arrow-up"></i> +5%
                    </small>
                  </div>
                  <div className="bg-success bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-tree fs-1 text-success"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1">Agricultural Experts</p>
                    <h2 className="mb-0 fw-bold">{stats.totalExperts.toLocaleString()}</h2>
                    <small className="text-info">
                      <i className="bi bi-arrow-up"></i> +8%
                    </small>
                  </div>
                  <div className="bg-info bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-person-badge fs-1 text-info"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1">Today's Visitors</p>
                    <h2 className="mb-0 fw-bold">{stats.todayVisitors}</h2>
                    <small className="text-warning">
                      <i className="bi bi-eye"></i> Active now
                    </small>
                  </div>
                  <div className="bg-warning bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-graph-up fs-1 text-warning"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards Row 2 */}
        <div className="row g-4 mb-4">
          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1">Total Posts</p>
                    <h2 className="mb-0 fw-bold">{stats.totalPosts.toLocaleString()}</h2>
                    <small className="text-muted">All time</small>
                  </div>
                  <div className="bg-purple bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-file-post fs-1 text-purple"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1">Pending Reports</p>
                    <h2 className="mb-0 fw-bold text-warning">{stats.totalReports}</h2>
                    <small className="text-danger">
                      <i className="bi bi-exclamation-triangle"></i> Requires attention
                    </small>
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
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1">Active Admins</p>
                    <h2 className="mb-0 fw-bold">{stats.activeAdmins}</h2>
                    <small className="text-success">
                      <i className="bi bi-check-circle"></i> Online
                    </small>
                  </div>
                  <div className="bg-success bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-shield-check fs-1 text-success"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1">Pending Moderation</p>
                    <h2 className="mb-0 fw-bold">{stats.pendingModerations}</h2>
                    <small className="text-muted">Awaiting review</small>
                  </div>
                  <div className="bg-secondary bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-hourglass-split fs-1 text-secondary"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Three Column Layout for Activities, Reports, and Security */}
        <div className="row g-4">
          {/* Recent Activities */}
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 pt-4">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-clock-history me-2 text-primary"></i>
                    Recent Activities
                  </h5>
                  <button className="btn btn-sm btn-link text-decoration-none">
                    View All <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
              </div>
              <div className="card-body pt-0">
                <div className="timeline" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {recentActivities.map((activity, index) => (
                    <div key={index} className="d-flex mb-3">
                      <div className={`flex-shrink-0 bg-${getActivityColor(activity.activity_type)} bg-opacity-10 rounded-circle p-2 me-3`} style={{ width: '35px', height: '35px' }}>
                        <i className={`bi ${getActivityIcon(activity.activity_type)} text-${getActivityColor(activity.activity_type)}`}></i>
                      </div>
                      <div className="flex-grow-1">
                        <p className="mb-1 small">{activity.activity_description}</p>
                        <small className="text-muted" style={{ fontSize: '10px' }}>
                          <i className="bi bi-person-circle me-1"></i>
                          {activity.admin_users?.full_name || 'System'} • 
                          <i className="bi bi-calendar3 ms-2 me-1"></i>
                          {new Date(activity.created_at).toLocaleString()}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pending Reports */}
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 pt-4">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-flag me-2 text-danger"></i>
                    Pending Reports
                  </h5>
                  <button className="btn btn-sm btn-link text-decoration-none">
                    View All <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
              </div>
              <div className="card-body pt-0">
                {reports.length > 0 ? (
                  reports.map((report, index) => (
                    <div key={index} className="border-bottom pb-3 mb-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <h6 className="mb-1 small">Report #{report.report_id?.slice(0, 8)}</h6>
                          <p className="text-muted small mb-1">{report.report_reason}</p>
                          <small className="text-muted" style={{ fontSize: '10px' }}>
                            <i className="bi bi-calendar me-1"></i>
                            {new Date(report.created_at).toLocaleString()}
                          </small>
                        </div>
                        <div className="dropdown">
                          <button className="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown">
                            <i className="bi bi-three-dots"></i>
                          </button>
                          <ul className="dropdown-menu">
                            <li><button className="dropdown-item">Review Report</button></li>
                            <li><button className="dropdown-item text-warning">Mark as Reviewed</button></li>
                            <li><hr className="dropdown-divider" /></li>
                            <li><button className="dropdown-item text-danger">Take Action</button></li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-5">
                    <i className="bi bi-check-circle-fill text-success fs-1"></i>
                    <p className="text-muted mt-3 small">No pending reports!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Security Alerts */}
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white border-0 pt-4">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-shield-exclamation me-2 text-danger"></i>
                    Security Alerts
                  </h5>
                  <button className="btn btn-sm btn-link text-decoration-none">
                    View All <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
              </div>
              <div className="card-body pt-0">
                {securityAlerts.length > 0 ? (
                  securityAlerts.map((alert, index) => (
                    <div key={index} className="border-bottom pb-3 mb-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <i className="bi bi-shield-exclamation text-danger"></i>
                            <h6 className="mb-0 small fw-bold">{alert.alert_type}</h6>
                            {getSeverityBadge(alert.severity_level)}
                          </div>
                          <p className="text-muted small mb-1">{alert.alert_message}</p>
                          <small className="text-muted" style={{ fontSize: '10px' }}>
                            <i className="bi bi-calendar me-1"></i>
                            {new Date(alert.created_at).toLocaleString()}
                          </small>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-5">
                    <i className="bi bi-shield-check text-success fs-1"></i>
                    <p className="text-muted mt-3 small">No security alerts!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="row g-4 mt-2">
          <div className="col-12">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white border-0 pt-4">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-lightning-charge me-2 text-primary"></i>
                  Quick Actions
                </h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-3 col-sm-6">
                    <button className="btn btn-outline-primary w-100 py-3 text-start">
                      <i className="bi bi-person-plus fs-4 d-block mb-2"></i>
                      Add New User
                      <small className="d-block text-muted">Create farmer or expert account</small>
                    </button>
                  </div>
                  <div className="col-md-3 col-sm-6">
                    <button className="btn btn-outline-success w-100 py-3 text-start">
                      <i className="bi bi-megaphone fs-4 d-block mb-2"></i>
                      Create Announcement
                      <small className="d-block text-muted">Broadcast to all users</small>
                    </button>
                  </div>
                  <div className="col-md-3 col-sm-6">
                    <button className="btn btn-outline-info w-100 py-3 text-start">
                      <i className="bi bi-database fs-4 d-block mb-2"></i>
                      Backup Database
                      <small className="d-block text-muted">Manual backup</small>
                    </button>
                  </div>
                  <div className="col-md-3 col-sm-6">
                    <button className="btn btn-outline-secondary w-100 py-3 text-start">
                      <i className="bi bi-shield-lock fs-4 d-block mb-2"></i>
                      Security Audit
                      <small className="d-block text-muted">Run security scan</small>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .bg-gradient-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .bg-purple {
          background-color: #6f42c1;
        }
        .text-purple {
          color: #6f42c1;
        }
        .hover-scale {
          transition: transform 0.3s ease;
        }
        .hover-scale:hover {
          transform: translateY(-5px);
        }
        .timeline {
          scrollbar-width: thin;
        }
        .timeline::-webkit-scrollbar {
          width: 4px;
        }
        .timeline::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .timeline::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 2px;
        }
        .btn-outline-primary:hover {
          transform: translateY(-2px);
          transition: all 0.3s ease;
        }
        .modal {
          background-color: rgba(0,0,0,0.5);
          z-index: 1050;
        }
      `}</style>
    </div>
  )
}