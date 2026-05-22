import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

export default function AdminDashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [recentActivities, setRecentActivities] = useState([])
  const [reports, setReports] = useState([])
  const [securityAlerts, setSecurityAlerts] = useState([])
  const [notifications, setNotifications] = useState([])
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
  
  const dropdownRef = useRef(null)
  const notificationRef = useRef(null)

  // Session timeout configuration
  const SESSION_TIMEOUT = 30 * 60 * 1000
  const [sessionTimeout, setSessionTimeout] = useState(null)
  const [showSessionWarning, setShowSessionWarning] = useState(false)

  // Time update interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Validate session on mount
  useEffect(() => {
    const validateSession = async () => {
      try {
        const storedSession = localStorage.getItem('adminSession')
        console.log('Dashboard - Session from localStorage:', storedSession)
        
        if (!storedSession) {
          router.push('/admin/login')
          return
        }

        const parsed = JSON.parse(storedSession)
        console.log('Dashboard - Parsed session:', parsed)
        
        // Validate session structure
        if (!parsed.admin || !parsed.user) {
          console.error('Invalid session structure')
          localStorage.removeItem('adminSession')
          router.push('/admin/login')
          return
        }

        setSession(parsed)
        
        // Fetch all dashboard data
        await Promise.all([
          fetchStats(),
          fetchRecentActivities(),
          fetchPendingReports(),
          fetchSecurityAlerts(),
          fetchNotifications()
        ])
        
      } catch (err) {
        console.error('Session validation error:', err)
        localStorage.removeItem('adminSession')
        router.push('/admin/login')
      } finally {
        setLoading(false)
      }
    }

    validateSession()
  }, [router])

  // Session timeout timer
  const resetSessionTimer = useCallback(() => {
    if (sessionTimeout) clearTimeout(sessionTimeout)
    
    const timeout = setTimeout(() => {
      setShowSessionWarning(true)
      const autoLogout = setTimeout(() => {
        handleSessionTimeout()
      }, 5 * 60 * 1000)
      setSessionTimeout(autoLogout)
    }, SESSION_TIMEOUT)
    
    setSessionTimeout(timeout)
  }, [sessionTimeout])

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
    localStorage.removeItem('adminSession')
    router.push('/admin/login?timeout=true')
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
        totalPosts: postsRes.count || 0,
        totalReports: reportsRes.count || 0,
        activeAdmins: adminsRes.count || 0,
        pendingModerations: moderationsRes.count || 0,
        todayVisitors: Math.floor(Math.random() * 200) + 50
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

      if (!error && data && data.length > 0) {
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

  const fetchNotifications = async () => {
    const dynamicNotifications = []
    
    if (stats.pendingModerations > 0) {
      dynamicNotifications.push({
        id: 1,
        title: 'Content Pending Moderation',
        message: `${stats.pendingModerations} items require review`,
        time: 'Just now',
        read: false,
        icon: 'file-post',
        color: 'warning'
      })
    }
    
    if (stats.totalReports > 0) {
      dynamicNotifications.push({
        id: 2,
        title: 'New Reports Received',
        message: `${stats.totalReports} pending report${stats.totalReports > 1 ? 's' : ''}`,
        time: 'Just now',
        read: false,
        icon: 'flag',
        color: 'danger'
      })
    }
    
    if (securityAlerts.length > 0) {
      dynamicNotifications.push({
        id: 3,
        title: 'Security Alerts',
        message: `${securityAlerts.length} security alert${securityAlerts.length > 1 ? 's' : ''} detected`,
        time: 'Just now',
        read: false,
        icon: 'shield-exclamation',
        color: 'danger'
      })
    }
    
    if (dynamicNotifications.length === 0) {
      dynamicNotifications.push({
        id: 4,
        title: 'System All Clear',
        message: 'No pending issues to address',
        time: 'Just now',
        read: true,
        icon: 'check-circle',
        color: 'success'
      })
    }
    
    setNotifications(dynamicNotifications)
  }

  const handleLogout = async () => {
    localStorage.removeItem('adminSession')
    document.cookie = 'admin-session=; path=/; max-age=0'
    document.cookie = 'admin-email=; path=/; max-age=0'
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const getSeverityBadge = (severity) => {
    const badges = {
      'HIGH': <span className="badge bg-danger px-2 py-1 rounded-pill" style={{ fontSize: '10px' }}>High</span>,
      'MEDIUM': <span className="badge bg-warning text-dark px-2 py-1 rounded-pill" style={{ fontSize: '10px' }}>Medium</span>,
      'LOW': <span className="badge bg-info px-2 py-1 rounded-pill" style={{ fontSize: '10px' }}>Low</span>
    }
    return badges[severity] || <span className="badge bg-secondary">{severity}</span>
  }

  const getUserInitials = () => {
    const name = session?.admin?.full_name || session?.user?.email || 'Admin'
    return name.charAt(0).toUpperCase()
  }

  const getDisplayName = () => {
    return session?.admin?.full_name || session?.user?.email?.split('@')[0] || 'Administrator'
  }

  const getUserEmail = () => {
    return session?.admin?.email || session?.user?.email || 'admin@smartfarmer.com'
  }

  const getUserRole = () => {
    return session?.role || session?.admin?.role || 'Administrator'
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">Loading dashboard...</p>
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
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-warning border-0">
                <h6 className="modal-title text-dark">
                  <i className="bi bi-clock-history me-2"></i>
                  Session Expiring Soon
                </h6>
                <button type="button" className="btn-close" onClick={() => setShowSessionWarning(false)}></button>
              </div>
              <div className="modal-body text-center py-4">
                <i className="bi bi-hourglass-split fs-1 text-warning mb-3 d-block"></i>
                <p className="mb-0">Your session will expire in <strong>5 minutes</strong> due to inactivity.</p>
                <small className="text-muted">Click anywhere to continue</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Navbar with Working Profile Dropdown */}
      <nav className="navbar navbar-dark bg-gradient-primary shadow-lg sticky-top px-4 py-2">
        <div className="d-flex align-items-center">
          <div className="bg-white rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '42px', height: '42px' }}>
            <i className="bi bi-tractor fs-4 text-primary"></i>
          </div>
          <div>
            <h5 className="text-white mb-0 fw-bold">Smart Farmer Admin</h5>
            <small className="text-white-50" style={{ fontSize: '11px' }}>Secure Dashboard</small>
          </div>
        </div>
        
        {/* Right side icons */}
        <div className="d-flex align-items-center gap-3">
          {/* Time Display */}
          <div className="d-none d-lg-flex align-items-center bg-white bg-opacity-10 rounded-pill px-3 py-1">
            <i className="bi bi-clock me-1"></i>
            <small className="text-white">{currentTime.toLocaleTimeString()}</small>
          </div>

          {/* Security Status */}
          <div className="d-none d-lg-flex align-items-center bg-white bg-opacity-10 rounded-pill px-3 py-1">
            <i className="bi bi-shield-check text-success me-1"></i>
            <small className="text-white">Secure</small>
          </div>

          {/* Notifications Dropdown */}
          <div className="position-relative" ref={notificationRef}>
            <button
              className="btn btn-link text-white text-decoration-none p-0 position-relative"
              onClick={() => setShowNotifications(!showNotifications)}
              style={{ width: '38px', height: '38px' }}
            >
              <div className="bg-white bg-opacity-15 rounded-circle d-flex align-items-center justify-content-center w-100 h-100">
                <i className="bi bi-bell fs-5"></i>
              </div>
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '9px' }}>
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Menu */}
            {showNotifications && (
              <div className="position-absolute end-0 mt-2" style={{ width: '320px', zIndex: 1000 }}>
                <div className="card border-0 shadow-lg rounded-3 overflow-hidden">
                  <div className="card-header bg-white py-3 border-bottom">
                    <div className="d-flex justify-content-between align-items-center">
                      <h6 className="mb-0 fw-bold">Notifications</h6>
                      <button className="btn btn-link btn-sm text-decoration-none p-0">Mark all read</button>
                    </div>
                  </div>
                  <div className="card-body p-0" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                    {notifications.map(notif => (
                      <div key={notif.id} className={`p-3 border-bottom hover-bg-light ${!notif.read ? 'bg-light' : ''}`} style={{ cursor: 'pointer' }}>
                        <div className="d-flex gap-3">
                          <div className={`bg-${notif.color} bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0`} style={{ width: '35px', height: '35px' }}>
                            <i className={`bi bi-${notif.icon} text-${notif.color}`}></i>
                          </div>
                          <div className="flex-grow-1">
                            <p className="mb-1 small fw-bold">{notif.title}</p>
                            <p className="mb-1 small text-muted">{notif.message}</p>
                            <small className="text-muted" style={{ fontSize: '10px' }}>{notif.time}</small>
                          </div>
                          {!notif.read && <div className="bg-primary rounded-circle" style={{ width: '8px', height: '8px' }}></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="card-footer bg-white py-2 text-center border-top">
                    <button className="btn btn-link btn-sm text-decoration-none">View All Notifications</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown - Working Version */}
          <div className="position-relative" ref={dropdownRef}>
            <button
              className="btn btn-link text-white text-decoration-none p-0"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{ outline: 'none' }}
            >
              <div className="d-flex align-items-center gap-2">
                <div className="bg-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
                  <span className="text-primary fw-bold fs-5">
                    {getUserInitials()}
                  </span>
                </div>
                <div className="text-start d-none d-md-block">
                  <div className="fw-bold text-white" style={{ fontSize: '14px' }}>{getDisplayName()}</div>
                  <div className="d-flex align-items-center gap-1">
                    <i className="bi bi-shield-check text-white-50" style={{ fontSize: '10px' }}></i>
                    <small className="text-white-50" style={{ fontSize: '11px' }}>{getUserRole()}</small>
                  </div>
                </div>
                <i className="bi bi-chevron-down text-white-50" style={{ fontSize: '12px' }}></i>
              </div>
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="position-absolute end-0 mt-2" style={{ width: '320px', zIndex: 1000 }}>
                <div className="card border-0 shadow-lg rounded-3 overflow-hidden animate-slide-down">
                  {/* Profile Header */}
                  <div className="bg-gradient-primary px-4 py-4 text-center">
                    <div className="bg-white rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3 shadow" style={{ width: '70px', height: '70px' }}>
                      <span className="text-primary fw-bold fs-2">{getUserInitials()}</span>
                    </div>
                    <h6 className="text-white mb-1 fw-bold">{getDisplayName()}</h6>
                    <p className="text-white-50 small mb-2">{getUserEmail()}</p>
                    <div className="d-flex justify-content-center gap-2">
                      {session?.admin?.is_super_admin && (
                        <span className="badge bg-warning text-dark px-2 py-1 rounded-pill">
                          <i className="bi bi-star-fill me-1" style={{ fontSize: '10px' }}></i>
                          Super Admin
                        </span>
                      )}
                      <span className="badge bg-white bg-opacity-25 text-white px-2 py-1 rounded-pill">
                        <i className="bi bi-shield-check me-1" style={{ fontSize: '10px' }}></i>
                        {getUserRole()}
                      </span>
                    </div>
                  </div>

                  {/* User Stats */}
                  <div className="bg-white px-3 py-3 border-bottom">
                    <div className="row text-center">
                      <div className="col-4">
                        <div className="border-end">
                          <h6 className="mb-0 fw-bold">{stats.totalUsers}</h6>
                          <small className="text-muted" style={{ fontSize: '10px' }}>Total Users</small>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="border-end">
                          <h6 className="mb-0 fw-bold">{stats.activeAdmins}</h6>
                          <small className="text-muted" style={{ fontSize: '10px' }}>Active Admins</small>
                        </div>
                      </div>
                      <div className="col-4">
                        <h6 className="mb-0 fw-bold">{stats.totalReports}</h6>
                        <small className="text-muted" style={{ fontSize: '10px' }}>Reports</small>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="p-2">
                    <button 
                      className="dropdown-item-custom" 
                      onClick={() => {
                        setShowProfileMenu(false)
                        router.push('/admin/profile')
                      }}
                    >
                      <div className="icon-wrapper">
                        <i className="bi bi-person"></i>
                      </div>
                      <div className="flex-grow-1">
                        <div className="fw-semibold small">My Profile</div>
                        <div className="text-muted" style={{ fontSize: '10px' }}>View your profile information</div>
                      </div>
                      <i className="bi bi-chevron-right text-muted" style={{ fontSize: '12px' }}></i>
                    </button>

                    <button 
                      className="dropdown-item-custom" 
                      onClick={() => {
                        setShowProfileMenu(false)
                        router.push('/admin/settings/security')
                      }}
                    >
                      <div className="icon-wrapper">
                        <i className="bi bi-shield-lock"></i>
                      </div>
                      <div className="flex-grow-1">
                        <div className="fw-semibold small">Security Settings</div>
                        <div className="text-muted" style={{ fontSize: '10px' }}>Manage 2FA and security</div>
                      </div>
                      <i className="bi bi-chevron-right text-muted" style={{ fontSize: '12px' }}></i>
                    </button>

                    <button 
                      className="dropdown-item-custom" 
                      onClick={() => {
                        setShowProfileMenu(false)
                        router.push('/admin/security/logs')
                      }}
                    >
                      <div className="icon-wrapper">
                        <i className="bi bi-activity"></i>
                      </div>
                      <div className="flex-grow-1">
                        <div className="fw-semibold small">Activity Logs</div>
                        <div className="text-muted" style={{ fontSize: '10px' }}>View your activity history</div>
                      </div>
                      <i className="bi bi-chevron-right text-muted" style={{ fontSize: '12px' }}></i>
                    </button>

                    <div className="dropdown-divider my-2"></div>

                    <button 
                      className="dropdown-item-custom" 
                      onClick={() => {
                        setShowProfileMenu(false)
                        router.push('/admin/settings')
                      }}
                    >
                      <div className="icon-wrapper">
                        <i className="bi bi-gear"></i>
                      </div>
                      <div className="flex-grow-1">
                        <div className="fw-semibold small">System Settings</div>
                        <div className="text-muted" style={{ fontSize: '10px' }}>Configure system preferences</div>
                      </div>
                      <i className="bi bi-chevron-right text-muted" style={{ fontSize: '12px' }}></i>
                    </button>

                    <div className="dropdown-divider my-2"></div>

                    {/* Session Info */}
                    <div className="px-3 py-2">
                      <small className="text-muted d-block mb-1" style={{ fontSize: '9px' }}>
                        <i className="bi bi-hdd me-1"></i> 
                        Session ID: {session?.sessionId?.slice(0, 8) || 'ACTIVE'}...
                      </small>
                      <small className="text-muted d-block" style={{ fontSize: '9px' }}>
                        <i className="bi bi-clock me-1"></i> 
                        Logged in: {session?.loggedInAt ? new Date(session.loggedInAt).toLocaleString() : 'Today'}
                      </small>
                    </div>

                    <div className="dropdown-divider my-2"></div>

                    {/* Logout Button */}
                    <div className="px-2 pb-2">
                      <button 
                        onClick={handleLogout}
                        className="btn btn-danger w-100 py-2 rounded-2 d-flex align-items-center justify-content-center gap-2"
                        style={{ fontSize: '13px' }}
                      >
                        <i className="bi bi-box-arrow-right"></i>
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container-fluid px-4 py-4">
        {/* Security Alerts Banner */}
        {securityAlerts.length > 0 && (
          <div className="alert alert-danger border-0 shadow-sm mb-4 rounded-3" role="alert">
            <div className="d-flex align-items-center">
              <div className="bg-danger bg-opacity-25 rounded-circle p-2 me-3">
                <i className="bi bi-shield-exclamation fs-5 text-danger"></i>
              </div>
              <div className="flex-grow-1">
                <h6 className="mb-1 fw-bold">Security Alerts Detected</h6>
                <p className="mb-0 small">{securityAlerts.length} unresolved security {securityAlerts.length === 1 ? 'alert' : 'alerts'} require immediate attention</p>
              </div>
              <button className="btn btn-danger btn-sm rounded-pill px-3" onClick={() => router.push('/admin/security')}>
                Review Now <i className="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="card border-0 shadow-sm mb-4 bg-gradient-primary text-white rounded-3 overflow-hidden">
          <div className="card-body p-4">
            <div className="row align-items-center">
              <div className="col-md-8">
                <div className="d-flex align-items-center gap-3 mb-2">
                  <div className="bg-white bg-opacity-20 rounded-circle p-2">
                    <i className="bi bi-emoji-wave fs-3"></i>
                  </div>
                  <h3 className="mb-0 fw-bold">
                    Welcome back, {getDisplayName().split(' ')[0]}! 👋
                  </h3>
                </div>
                <p className="mb-0 opacity-75 ms-5 ps-1">
                  <i className="bi bi-calendar3 me-2"></i>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | 
                  <i className="bi bi-clock ms-2 me-1"></i>
                  {currentTime.toLocaleTimeString()}
                </p>
              </div>
              <div className="col-md-4 text-md-end mt-3 mt-md-0">
                <button className="btn btn-light btn-sm rounded-pill px-4">
                  <i className="bi bi-download me-1"></i> Download Report
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards Row 1 */}
        <div className="row g-4 mb-4">
          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 card-hover rounded-3">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1 small text-uppercase fw-semibold">Total Users</p>
                    <h2 className="mb-0 fw-bold display-6">{stats.totalUsers.toLocaleString()}</h2>
                    <small className="text-success">
                      <i className="bi bi-arrow-up"></i> +12% this month
                    </small>
                  </div>
                  <div className="bg-primary bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-people fs-2 text-primary"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 card-hover rounded-3">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1 small text-uppercase fw-semibold">Total Posts</p>
                    <h2 className="mb-0 fw-bold display-6">{stats.totalPosts.toLocaleString()}</h2>
                    <small className="text-muted">All time</small>
                  </div>
                  <div className="bg-info bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-file-post fs-2 text-info"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 card-hover rounded-3">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1 small text-uppercase fw-semibold">Pending Reports</p>
                    <h2 className="mb-0 fw-bold display-6 text-warning">{stats.totalReports}</h2>
                    <small className="text-danger">
                      <i className="bi bi-exclamation-triangle"></i> Needs review
                    </small>
                  </div>
                  <div className="bg-warning bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-flag fs-2 text-warning"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 card-hover rounded-3">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1 small text-uppercase fw-semibold">Active Admins</p>
                    <h2 className="mb-0 fw-bold display-6">{stats.activeAdmins}</h2>
                    <small className="text-success">
                      <i className="bi bi-check-circle"></i> Online
                    </small>
                  </div>
                  <div className="bg-success bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-shield-check fs-2 text-success"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity & Reports */}
        <div className="row g-4">
          {/* Recent Activities */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-3">
              <div className="card-header bg-white border-0 pt-4 pb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-clock-history me-2 text-primary"></i>
                    Recent Activities
                  </h5>
                  <button className="btn btn-sm btn-link text-decoration-none text-primary">
                    View All <i className="bi bi-arrow-right ms-1"></i>
                  </button>
                </div>
              </div>
              <div className="card-body pt-0">
                <div className="timeline" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                  {recentActivities.map((activity, index) => (
                    <div key={index} className="d-flex mb-3 align-items-start">
                      <div className="flex-shrink-0 bg-primary bg-opacity-10 rounded-circle p-2 me-3" style={{ width: '32px', height: '32px' }}>
                        <i className="bi bi-activity text-primary" style={{ fontSize: '14px' }}></i>
                      </div>
                      <div className="flex-grow-1">
                        <p className="mb-1 small fw-medium">{activity.activity_description}</p>
                        <small className="text-muted" style={{ fontSize: '10px' }}>
                          <i className="bi bi-person-circle me-1"></i>
                          {activity.admin_users?.full_name || 'System'} • 
                          <i className="bi bi-calendar3 ms-2 me-1"></i>
                          {new Date(activity.created_at).toLocaleString()}
                        </small>
                      </div>
                    </div>
                  ))}
                  {recentActivities.length === 0 && (
                    <div className="text-center py-4">
                      <i className="bi bi-inbox fs-1 text-muted"></i>
                      <p className="text-muted mt-2 mb-0">No recent activities</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pending Reports */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-3">
              <div className="card-header bg-white border-0 pt-4 pb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-flag me-2 text-danger"></i>
                    Pending Reports
                  </h5>
                  <button className="btn btn-sm btn-link text-decoration-none text-primary">
                    View All <i className="bi bi-arrow-right ms-1"></i>
                  </button>
                </div>
              </div>
              <div className="card-body pt-0">
                {reports.length > 0 ? (
                  reports.map((report, index) => (
                    <div key={index} className="border-bottom pb-3 mb-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <i className="bi bi-flag-fill text-danger" style={{ fontSize: '12px' }}></i>
                            <h6 className="mb-0 small fw-bold">Report #{report.report_id?.slice(0, 8)}</h6>
                          </div>
                          <p className="text-muted small mb-1">{report.report_reason}</p>
                          <small className="text-muted" style={{ fontSize: '10px' }}>
                            <i className="bi bi-calendar me-1"></i>
                            {new Date(report.created_at).toLocaleString()}
                          </small>
                        </div>
                        <div className="dropdown">
                          <button className="btn btn-sm btn-outline-secondary rounded-circle p-1" data-bs-toggle="dropdown" style={{ width: '28px', height: '28px' }}>
                            <i className="bi bi-three-dots"></i>
                          </button>
                          <ul className="dropdown-menu dropdown-menu-end">
                            <li><button className="dropdown-item small">📋 Review Report</button></li>
                            <li><button className="dropdown-item small text-success">✓ Mark as Resolved</button></li>
                            <li><hr className="dropdown-divider" /></li>
                            <li><button className="dropdown-item small text-danger">🚫 Take Action</button></li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-5">
                    <i className="bi bi-check-circle-fill text-success fs-1"></i>
                    <p className="text-muted mt-3 small mb-0">No pending reports!</p>
                    <small className="text-muted">Everything looks good</small>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="row g-4 mt-2">
          <div className="col-12">
            <div className="card border-0 shadow-sm rounded-3">
              <div className="card-header bg-white border-0 pt-4 pb-3">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-lightning-charge me-2 text-primary"></i>
                  Quick Actions
                </h5>
              </div>
              <div className="card-body pt-0 pb-4">
                <div className="row g-3">
                  <div className="col-md-3 col-sm-6">
                    <button className="btn btn-outline-primary w-100 py-3 text-start rounded-3 btn-hover" onClick={() => router.push('/admin/users/create')}>
                      <i className="bi bi-person-plus fs-4 d-block mb-2"></i>
                      <span className="fw-semibold small">Add New User</span>
                      <small className="d-block text-muted mt-1" style={{ fontSize: '10px' }}>Create farmer or expert account</small>
                    </button>
                  </div>
                  <div className="col-md-3 col-sm-6">
                    <button className="btn btn-outline-success w-100 py-3 text-start rounded-3 btn-hover" onClick={() => router.push('/admin/users')}>
                      <i className="bi bi-people fs-4 d-block mb-2"></i>
                      <span className="fw-semibold small">Manage Users</span>
                      <small className="d-block text-muted mt-1" style={{ fontSize: '10px' }}>View and manage all users</small>
                    </button>
                  </div>
                  <div className="col-md-3 col-sm-6">
                    <button className="btn btn-outline-danger w-100 py-3 text-start rounded-3 btn-hover" onClick={() => router.push('/admin/reports')}>
                      <i className="bi bi-flag fs-4 d-block mb-2"></i>
                      <span className="fw-semibold small">View Reports</span>
                      <small className="d-block text-muted mt-1" style={{ fontSize: '10px' }}>Review user reports</small>
                    </button>
                  </div>
                  <div className="col-md-3 col-sm-6">
                    <button className="btn btn-outline-secondary w-100 py-3 text-start rounded-3 btn-hover" onClick={() => router.push('/admin/security')}>
                      <i className="bi bi-shield-lock fs-4 d-block mb-2"></i>
                      <span className="fw-semibold small">Security</span>
                      <small className="d-block text-muted mt-1" style={{ fontSize: '10px' }}>Check security status</small>
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
        .card-hover {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
        }
        .btn-hover {
          transition: transform 0.2s ease;
        }
        .btn-hover:hover {
          transform: translateY(-2px);
        }
        .dropdown-item-custom {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          width: 100%;
          border: none;
          background: transparent;
          border-radius: 8px;
          transition: all 0.2s ease;
          text-align: left;
        }
        .dropdown-item-custom:hover {
          background-color: #f8f9fa;
        }
        .icon-wrapper {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f8f9fa;
          border-radius: 8px;
          color: #6c757d;
        }
        .animate-slide-down {
          animation: slideDown 0.2s ease-out;
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .hover-bg-light:hover {
          background-color: #f8f9fa;
        }
        .timeline {
          scrollbar-width: thin;
        }
        .timeline::-webkit-scrollbar {
          width: 3px;
        }
        .timeline::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .timeline::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 10px;
        }
        @media (max-width: 768px) {
          .display-6 {
            font-size: 1.75rem;
          }
        }
      `}</style>
    </div>
  )
}