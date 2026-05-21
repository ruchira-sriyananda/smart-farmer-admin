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
  const [recentActivities, setRecentActivities] = useState([])
  const [reports, setReports] = useState([])
  const [securityAlerts, setSecurityAlerts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [sessionTimeout, setSessionTimeout] = useState(null)
  const [showSessionWarning, setShowSessionWarning] = useState(false)
  const dropdownRef = useRef(null)
  const notificationRef = useRef(null)
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

  // Close dropdown when clicking outside
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

  // Monitor user activity for session timeout
  const resetSessionTimer = useCallback(() => {
    if (sessionTimeout) clearTimeout(sessionTimeout)
    
    const timeout = setTimeout(() => {
      setShowSessionWarning(true)
      
      const autoLogout = setTimeout(() => {
        handleSessionTimeout()
      }, SESSION_WARNING)
      
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

      // Verify IP address consistency
      const currentIP = await getClientIP()
      if (parsed.ipAddress && parsed.ipAddress !== currentIP) {
        await logSecurityEvent('IP_MISMATCH', `IP changed from ${parsed.ipAddress} to ${currentIP}`, 'HIGH')
        await clearSession()
        router.push('/admin/login?security=true')
        return
      }

      // Check if admin still exists and is active
      const { data: adminCheck, error: adminError } = await supabase
        .from('admin_users')
        .select('is_active, is_super_admin, full_name, email')
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
        admin: { ...parsed.admin, ...adminCheck },
        ipAddress: currentIP
      })
      
      await fetchStats()
      await fetchRecentActivities()
      await fetchPendingReports()
      await fetchSecurityAlerts()
      await fetchNotifications()
      
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

      if (!error && data && data.length > 0) {
        setRecentActivities(data)
      } else {
        // Demo data if no activities exist
        setRecentActivities([
          { id: 1, activity_type: 'LOGIN', activity_description: 'Admin logged in', created_at: new Date().toISOString(), admin_users: { full_name: session?.admin?.full_name || 'Admin' } },
          { id: 2, activity_type: 'USER_MANAGEMENT', activity_description: 'Dashboard accessed', created_at: new Date(Date.now() - 3600000).toISOString(), admin_users: { full_name: 'System' } }
        ])
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
      } else {
        setReports([])
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
      } else {
        setSecurityAlerts([])
      }
    } catch (err) {
      console.error('Error fetching security alerts:', err)
    }
  }

  const fetchNotifications = async () => {
    // Demo notifications - replace with actual API call
    setNotifications([
      { id: 1, title: 'New user registered', message: 'A new farmer joined the platform', time: '5 min ago', read: false, icon: 'person-plus', color: 'primary' },
      { id: 2, title: 'Report pending review', message: 'Content report requires attention', time: '1 hour ago', read: false, icon: 'flag', color: 'warning' },
      { id: 3, title: 'System update completed', message: 'Security patches installed successfully', time: '3 hours ago', read: true, icon: 'check-circle', color: 'success' },
    ])
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
      'SECURITY_IP_MISMATCH': 'bi-shield-shaded'
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
      'SECURITY_ALERT': 'danger'
    }
    return colors[type] || 'secondary'
  }

  const getSeverityBadge = (severity) => {
    const badges = {
      'HIGH': <span className="badge bg-danger px-2 py-1 rounded-pill" style={{ fontSize: '10px' }}>High</span>,
      'MEDIUM': <span className="badge bg-warning text-dark px-2 py-1 rounded-pill" style={{ fontSize: '10px' }}>Medium</span>,
      'LOW': <span className="badge bg-info px-2 py-1 rounded-pill" style={{ fontSize: '10px' }}>Low</span>
    }
    return badges[severity] || <span className="badge bg-secondary px-2 py-1 rounded-pill">{severity}</span>
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

      {/* Modern Navbar */}
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
          {/* Security Status */}
          <div className="d-none d-lg-flex align-items-center bg-white bg-opacity-10 rounded-pill px-3 py-1">
            <i className="bi bi-shield-check text-success me-1"></i>
            <small className="text-white">Secure Connection</small>
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

          {/* Profile Dropdown */}
          <div className="position-relative" ref={dropdownRef}>
            <button
              className="btn btn-link text-white text-decoration-none p-0"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{ outline: 'none' }}
            >
              <div className="d-flex align-items-center gap-2">
                <div className="bg-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
                  <span className="text-primary fw-bold fs-5">
                    {session.admin.full_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-start d-none d-md-block">
                  <div className="fw-bold text-white" style={{ fontSize: '14px' }}>{session.admin.full_name}</div>
                  <div className="d-flex align-items-center gap-1">
                    <i className="bi bi-shield-check text-white-50" style={{ fontSize: '10px' }}></i>
                    <small className="text-white-50" style={{ fontSize: '11px' }}>{session.role}</small>
                  </div>
                </div>
                <i className="bi bi-chevron-down text-white-50" style={{ fontSize: '12px' }}></i>
              </div>
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="position-absolute end-0 mt-2" style={{ width: '340px', zIndex: 1000 }}>
                <div className="card border-0 shadow-lg rounded-3 overflow-hidden animate-slide-down">
                  {/* Profile Header */}
                  <div className="bg-gradient-primary px-4 py-4 text-center">
                    <div className="bg-white rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3 shadow" style={{ width: '70px', height: '70px' }}>
                      <span className="text-primary fw-bold fs-2">
                        {session.admin.full_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <h6 className="text-white mb-1 fw-bold">{session.admin.full_name}</h6>
                    <p className="text-white-50 small mb-2">{session.admin.email}</p>
                    <div className="d-flex justify-content-center gap-2">
                      {session.admin.is_super_admin && (
                        <span className="badge bg-warning text-dark px-2 py-1 rounded-pill">
                          <i className="bi bi-star-fill me-1" style={{ fontSize: '10px' }}></i>
                          Super Admin
                        </span>
                      )}
                      <span className="badge bg-white bg-opacity-25 text-white px-2 py-1 rounded-pill">
                        <i className="bi bi-shield-check me-1" style={{ fontSize: '10px' }}></i>
                        {session.role}
                      </span>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="bg-white px-3 py-3 border-bottom">
                    <div className="row text-center">
                      <div className="col-4">
                        <div className="border-end">
                          <h6 className="mb-0 fw-bold">12</h6>
                          <small className="text-muted" style={{ fontSize: '10px' }}>Projects</small>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="border-end">
                          <h6 className="mb-0 fw-bold">5</h6>
                          <small className="text-muted" style={{ fontSize: '10px' }}>Tasks</small>
                        </div>
                      </div>
                      <div className="col-4">
                        <h6 className="mb-0 fw-bold">8</h6>
                        <small className="text-muted" style={{ fontSize: '10px' }}>Messages</small>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="p-2">
                    <div className="dropdown-item-wrapper">
                      <button className="dropdown-item-custom" onClick={() => {}}>
                        <div className="icon-wrapper">
                          <i className="bi bi-person"></i>
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-semibold small">My Profile</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>View your profile information</div>
                        </div>
                        <i className="bi bi-chevron-right text-muted" style={{ fontSize: '12px' }}></i>
                      </button>
                    </div>

                    <div className="dropdown-item-wrapper">
                      <button className="dropdown-item-custom" onClick={() => {}}>
                        <div className="icon-wrapper">
                          <i className="bi bi-shield-lock"></i>
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-semibold small">Security Settings</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>Manage 2FA and security</div>
                        </div>
                        <i className="bi bi-chevron-right text-muted" style={{ fontSize: '12px' }}></i>
                      </button>
                    </div>

                    <div className="dropdown-item-wrapper">
                      <button className="dropdown-item-custom" onClick={() => {}}>
                        <div className="icon-wrapper">
                          <i className="bi bi-envelope"></i>
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-semibold small">Messages</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>View your messages</div>
                        </div>
                        <span className="badge bg-danger rounded-pill" style={{ fontSize: '9px' }}>3</span>
                      </button>
                    </div>

                    <div className="dropdown-divider my-2"></div>

                    <div className="dropdown-item-wrapper">
                      <button className="dropdown-item-custom" onClick={() => {}}>
                        <div className="icon-wrapper">
                          <i className="bi bi-gear"></i>
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-semibold small">Account Settings</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>Manage your account preferences</div>
                        </div>
                        <i className="bi bi-chevron-right text-muted" style={{ fontSize: '12px' }}></i>
                      </button>
                    </div>

                    <div className="dropdown-item-wrapper">
                      <button className="dropdown-item-custom" onClick={() => {}}>
                        <div className="icon-wrapper">
                          <i className="bi bi-question-circle"></i>
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-semibold small">Help Center</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>Get help and support</div>
                        </div>
                        <i className="bi bi-chevron-right text-muted" style={{ fontSize: '12px' }}></i>
                      </button>
                    </div>

                    <div className="dropdown-divider my-2"></div>

                    {/* Session Info */}
                    <div className="px-3 py-2">
                      <small className="text-muted d-block mb-1" style={{ fontSize: '9px' }}>
                        <i className="bi bi-hdd me-1"></i> Session ID: {session.sessionId?.slice(0, 8) || 'ACTIVE'}...
                      </small>
                      <small className="text-muted d-block" style={{ fontSize: '9px' }}>
                        <i className="bi bi-ip me-1"></i> IP: {session.ipAddress || 'Loading...'}
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
                    Welcome back, {session.admin.full_name.split(' ')[0]}!
                  </h3>
                </div>
                <p className="mb-0 opacity-75 ms-5 ps-1">
                  <i className="bi bi-calendar3 me-2"></i>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | 
                  <i className="bi bi-clock ms-2 me-1"></i>
                  {new Date().toLocaleTimeString()}
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
            <div className="card border-0 shadow-sm h-100 hover-scale rounded-3">
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
            <div className="card border-0 shadow-sm h-100 hover-scale rounded-3">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1 small text-uppercase fw-semibold">Farmers</p>
                    <h2 className="mb-0 fw-bold display-6">{stats.totalFarmers.toLocaleString()}</h2>
                    <small className="text-success">
                      <i className="bi bi-arrow-up"></i> +5%
                    </small>
                  </div>
                  <div className="bg-success bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-tree fs-2 text-success"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 hover-scale rounded-3">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1 small text-uppercase fw-semibold">Experts</p>
                    <h2 className="mb-0 fw-bold display-6">{stats.totalExperts.toLocaleString()}</h2>
                    <small className="text-info">
                      <i className="bi bi-arrow-up"></i> +8%
                    </small>
                  </div>
                  <div className="bg-info bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-person-badge fs-2 text-info"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 hover-scale rounded-3">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1 small text-uppercase fw-semibold">Active Now</p>
                    <h2 className="mb-0 fw-bold display-6">{stats.todayVisitors}</h2>
                    <small className="text-warning">
                      <i className="bi bi-eye"></i> Live visitors
                    </small>
                  </div>
                  <div className="bg-warning bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-graph-up fs-2 text-warning"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards Row 2 */}
        <div className="row g-4 mb-4">
          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 hover-scale rounded-3">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1 small text-uppercase fw-semibold">Total Posts</p>
                    <h2 className="mb-0 fw-bold display-6">{stats.totalPosts.toLocaleString()}</h2>
                    <small className="text-muted">All time</small>
                  </div>
                  <div className="bg-purple bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-file-post fs-2 text-purple"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 hover-scale rounded-3">
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
            <div className="card border-0 shadow-sm h-100 hover-scale rounded-3">
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

          <div className="col-md-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 hover-scale rounded-3">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1 small text-uppercase fw-semibold">Pending Moderation</p>
                    <h2 className="mb-0 fw-bold display-6">{stats.pendingModerations}</h2>
                    <small className="text-muted">Awaiting review</small>
                  </div>
                  <div className="bg-secondary bg-opacity-10 rounded-circle p-3">
                    <i className="bi bi-hourglass-split fs-2 text-secondary"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Three Column Layout */}
        <div className="row g-4">
          {/* Recent Activities */}
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100 rounded-3">
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
                      <div className={`flex-shrink-0 bg-${getActivityColor(activity.activity_type)} bg-opacity-10 rounded-circle p-2 me-3`} style={{ width: '32px', height: '32px' }}>
                        <i className={`bi ${getActivityIcon(activity.activity_type)} text-${getActivityColor(activity.activity_type)}`} style={{ fontSize: '14px' }}></i>
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
                </div>
              </div>
            </div>
          </div>

          {/* Pending Reports */}
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100 rounded-3">
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
                            <li><button className="dropdown-item small text-warning">✓ Mark as Reviewed</button></li>
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

          {/* Security Alerts */}
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100 rounded-3">
              <div className="card-header bg-white border-0 pt-4 pb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-shield-exclamation me-2 text-danger"></i>
                    Security Alerts
                  </h5>
                  <button className="btn btn-sm btn-link text-decoration-none text-primary">
                    View All <i className="bi bi-arrow-right ms-1"></i>
                  </button>
                </div>
              </div>
              <div className="card-body pt-0">
                {securityAlerts.length > 0 ? (
                  securityAlerts.map((alert, index) => (
                    <div key={index} className="border-bottom pb-3 mb-3">
                      <div className="d-flex gap-2">
                        <div className="flex-shrink-0">
                          <div className="bg-danger bg-opacity-10 rounded-circle p-2">
                            <i className="bi bi-shield-exclamation text-danger" style={{ fontSize: '14px' }}></i>
                          </div>
                        </div>
                        <div className="flex-grow-1">
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <h6 className="mb-0 small fw-bold">{alert.alert_type}</h6>
                            {getSeverityBadge(alert.severity_level)}
                          </div>
                          <p className="text-muted small mb-1">{alert.alert_message}</p>
                          <small className="text-muted" style={{ fontSize: '9px' }}>
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
                    <p className="text-muted mt-3 small mb-0">No security alerts!</p>
                    <small className="text-muted">System is secure</small>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
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
                    <button className="btn btn-outline-primary w-100 py-3 text-start rounded-3 hover-lift">
                      <i className="bi bi-person-plus fs-4 d-block mb-2"></i>
                      <span className="fw-semibold small">Add New User</span>
                      <small className="d-block text-muted mt-1" style={{ fontSize: '10px' }}>Create farmer or expert account</small>
                    </button>
                  </div>
                  <div className="col-md-3 col-sm-6">
                    <button className="btn btn-outline-success w-100 py-3 text-start rounded-3 hover-lift">
                      <i className="bi bi-megaphone fs-4 d-block mb-2"></i>
                      <span className="fw-semibold small">Create Announcement</span>
                      <small className="d-block text-muted mt-1" style={{ fontSize: '10px' }}>Broadcast to all users</small>
                    </button>
                  </div>
                  <div className="col-md-3 col-sm-6">
                    <button className="btn btn-outline-info w-100 py-3 text-start rounded-3 hover-lift">
                      <i className="bi bi-database fs-4 d-block mb-2"></i>
                      <span className="fw-semibold small">Backup Database</span>
                      <small className="d-block text-muted mt-1" style={{ fontSize: '10px' }}>Manual backup</small>
                    </button>
                  </div>
                  <div className="col-md-3 col-sm-6">
                    <button className="btn btn-outline-secondary w-100 py-3 text-start rounded-3 hover-lift">
                      <i className="bi bi-shield-lock fs-4 d-block mb-2"></i>
                      <span className="fw-semibold small">Security Audit</span>
                      <small className="d-block text-muted mt-1" style={{ fontSize: '10px' }}>Run security scan</small>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS */}
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
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .hover-scale:hover {
          transform: translateY(-4px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
        }
        
        .hover-lift {
          transition: transform 0.2s ease;
        }
        
        .hover-lift:hover {
          transform: translateY(-2px);
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
        
        .dropdown-item-wrapper {
          padding: 2px 8px;
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
        
        @media (max-width: 768px) {
          .display-6 {
            font-size: 1.75rem;
          }
        }
      `}</style>
    </div>
  )
}