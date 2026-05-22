import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminSidebar from './AdminSidebar'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

export default function AdminLayout({ children, title = "Dashboard" }) {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef(null)
  const notificationRef = useRef(null)

  useEffect(() => {
    const storedSession = localStorage.getItem('adminSession')
    if (!storedSession) {
      router.push('/admin/login')
      return
    }
    
    try {
      const parsedSession = JSON.parse(storedSession)
      setSession(parsedSession)
    } catch (err) {
      console.error('Error parsing session:', err)
      router.push('/admin/login')
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    
    fetchNotifications()
    subscribeToNotifications()
    
    return () => {
      clearInterval(timer)
      supabase.removeAllChannels()
    }
  }, [router])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select(`
          *,
          admin_users (
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && data) {
        const formattedNotifications = data.map(activity => ({
          id: activity.log_id,
          title: getNotificationTitle(activity.activity_type),
          message: activity.activity_description,
          time: formatTimeAgo(activity.created_at),
          read: false,
          type: getNotificationType(activity.activity_type),
          icon: getNotificationIcon(activity.activity_type),
          created_at: activity.created_at
        }))
        setNotifications(formattedNotifications)
        setUnreadCount(formattedNotifications.filter(n => !n.read).length)
      }
    } catch (err) {
      console.error('Error fetching notifications:', err)
    }
  }

  const subscribeToNotifications = () => {
    const subscription = supabase
      .channel('admin_activity_logs_changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'admin_activity_logs' },
        async (payload) => {
          const { data, error } = await supabase
            .from('admin_activity_logs')
            .select(`
              *,
              admin_users (
                full_name
              )
            `)
            .eq('log_id', payload.new.log_id)
            .single()
          
          if (!error && data) {
            const newNotification = {
              id: data.log_id,
              title: getNotificationTitle(data.activity_type),
              message: data.activity_description,
              time: 'Just now',
              read: false,
              type: getNotificationType(data.activity_type),
              icon: getNotificationIcon(data.activity_type),
              created_at: data.created_at
            }
            setNotifications(prev => [newNotification, ...prev.slice(0, 9)])
            setUnreadCount(prev => prev + 1)
          }
        }
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }

  const getNotificationTitle = (type) => {
    const titles = {
      'LOGIN': 'New Login',
      'LOGOUT': 'User Logout',
      'USER_MANAGEMENT': 'User Management',
      'CONTENT_MODERATION': 'Content Moderation',
      'REPORT_HANDLING': 'Report Update',
      'SECURITY_ALERT': 'Security Alert'
    }
    return titles[type] || 'New Activity'
  }

  const getNotificationType = (type) => {
    const types = {
      'LOGIN': 'info',
      'LOGOUT': 'secondary',
      'USER_MANAGEMENT': 'primary',
      'CONTENT_MODERATION': 'warning',
      'REPORT_HANDLING': 'danger',
      'SECURITY_ALERT': 'danger'
    }
    return types[type] || 'info'
  }

  const getNotificationIcon = (type) => {
    const icons = {
      'LOGIN': 'box-arrow-in-right',
      'LOGOUT': 'box-arrow-right',
      'USER_MANAGEMENT': 'people',
      'CONTENT_MODERATION': 'file-post',
      'REPORT_HANDLING': 'flag',
      'SECURITY_ALERT': 'shield-exclamation'
    }
    return icons[type] || 'bell'
  }

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  const markAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const clearAllNotifications = () => {
    setNotifications([])
    setUnreadCount(0)
  }

  const handleLogout = async () => {
    localStorage.removeItem('adminSession')
    document.cookie = 'admin-session=; path=/; max-age=0'
    router.push('/admin/login')
  }

  const getInitials = () => {
    const name = session?.admin?.full_name || session?.user?.email || 'Admin'
    return name.charAt(0).toUpperCase()
  }

  const getDisplayName = () => {
    return session?.admin?.full_name || session?.user?.email?.split('@')[0] || 'Admin'
  }

  const getUserEmail = () => {
    return session?.admin?.email || session?.user?.email || 'admin@smartfarmer.com'
  }

  const getUserRole = () => {
    return session?.role || session?.admin?.role || 'Administrator'
  }

  if (!session) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="d-flex">
      <AdminSidebar />
      
      <div style={{ marginLeft: '280px', width: '100%' }}>
        {/* Top Navbar */}
        <nav className="navbar navbar-light bg-white shadow-sm px-4 py-2 sticky-top">
          <div>
            <h5 className="mb-0 fw-bold text-primary">{title}</h5>
            <small className="text-muted">{currentTime.toLocaleString()}</small>
          </div>
          
          <div className="d-flex align-items-center gap-3">
            {/* Security Status */}
            <div className="bg-success bg-opacity-10 rounded-pill px-3 py-1 d-none d-md-block">
              <i className="bi bi-shield-check text-success me-1"></i>
              <small className="text-success">Secure Connection</small>
            </div>

            {/* Notifications Dropdown */}
            <div className="position-relative" ref={notificationRef}>
              <button
                className="btn btn-link text-decoration-none p-0 position-relative"
                onClick={() => setShowNotifications(!showNotifications)}
                style={{ outline: 'none' }}
              >
                <div className="bg-light rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                  <i className="bi bi-bell fs-5 text-secondary"></i>
                </div>
                {unreadCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '10px' }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="position-absolute end-0 mt-2" style={{ width: '380px', zIndex: 1050 }}>
                  <div className="card border-0 shadow-lg rounded-3 overflow-hidden">
                    <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                      <h6 className="mb-0 fw-bold">
                        <i className="bi bi-bell me-2 text-primary"></i>
                        Notifications
                        {unreadCount > 0 && (
                          <span className="badge bg-primary ms-2">{unreadCount} new</span>
                        )}
                      </h6>
                      <div className="dropdown">
                        <button className="btn btn-sm btn-link text-decoration-none p-0" data-bs-toggle="dropdown">
                          <i className="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul className="dropdown-menu dropdown-menu-end">
                          <li><button className="dropdown-item small" onClick={markAllAsRead}>Mark all as read</button></li>
                          <li><hr className="dropdown-divider" /></li>
                          <li><button className="dropdown-item small text-danger" onClick={clearAllNotifications}>Clear all</button></li>
                        </ul>
                      </div>
                    </div>

                    <div className="notifications-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div 
                            key={notification.id} 
                            className={`notification-item p-3 border-bottom ${!notification.read ? 'bg-light' : ''}`}
                            onClick={() => markAsRead(notification.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="d-flex gap-3">
                              <div className={`flex-shrink-0 bg-${notification.type} bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center`} style={{ width: '40px', height: '40px' }}>
                                <i className={`bi bi-${notification.icon} text-${notification.type} fs-5`}></i>
                              </div>
                              <div className="flex-grow-1">
                                <div className="d-flex justify-content-between align-items-start">
                                  <h6 className="mb-1 small fw-bold">{notification.title}</h6>
                                  <small className="text-muted" style={{ fontSize: '10px' }}>{notification.time}</small>
                                </div>
                                <p className="mb-0 small text-muted">{notification.message}</p>
                              </div>
                              {!notification.read && (
                                <div className="flex-shrink-0">
                                  <div className="bg-primary rounded-circle" style={{ width: '8px', height: '8px' }}></div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-5">
                          <i className="bi bi-bell-slash fs-1 text-muted"></i>
                          <p className="text-muted mt-2 mb-0">No notifications</p>
                          <small className="text-muted">New activities will appear here</small>
                        </div>
                      )}
                    </div>

                    <div className="card-footer bg-white py-2 text-center border-top">
                      <button 
                        className="btn btn-link btn-sm text-decoration-none p-0"
                        onClick={() => {
                          setShowNotifications(false)
                          router.push('/admin/security/logs')
                        }}
                      >
                        View All Activity <i className="bi bi-arrow-right ms-1"></i>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="position-relative" ref={dropdownRef}>
              <button
                className="btn btn-link text-decoration-none p-0 d-flex align-items-center"
                onClick={() => setShowDropdown(!showDropdown)}
                style={{ outline: 'none' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center text-white fw-bold" style={{ width: '40px', height: '40px' }}>
                    {getInitials()}
                  </div>
                  <div className="text-start d-none d-md-block">
                    <div className="fw-bold small">{getDisplayName()}</div>
                    <small className="text-muted">{getUserRole()}</small>
                  </div>
                  <i className="bi bi-chevron-down text-muted" style={{ fontSize: '12px' }}></i>
                </div>
              </button>

              {showDropdown && (
                <div className="position-absolute end-0 mt-2" style={{ width: '280px', zIndex: 1050 }}>
                  <div className="card border-0 shadow-lg rounded-3 overflow-hidden">
                    <div className="bg-primary text-white px-4 py-3 text-center">
                      <div className="bg-white rounded-circle d-flex align-items-center justify-content-center mx-auto mb-2" style={{ width: '60px', height: '60px' }}>
                        <span className="text-primary fw-bold fs-3">{getInitials()}</span>
                      </div>
                      <h6 className="mb-1 fw-bold">{getDisplayName()}</h6>
                      <p className="small mb-0 opacity-75">{getUserEmail()}</p>
                    </div>

                    <div className="px-4 py-3 border-bottom">
                      <div className="row text-center">
                        <div className="col-6">
                          <small className="text-muted d-block">Role</small>
                          <strong>{getUserRole()}</strong>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Status</small>
                          <span className="badge bg-success">Active</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      <button className="dropdown-item-custom" onClick={() => { setShowDropdown(false); router.push('/admin/profile'); }}>
                        <i className="bi bi-person me-3"></i>
                        <div>
                          <div className="fw-semibold small">My Profile</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>View your profile information</div>
                        </div>
                      </button>

                      <button className="dropdown-item-custom" onClick={() => { setShowDropdown(false); router.push('/admin/settings/security'); }}>
                        <i className="bi bi-shield-lock me-3"></i>
                        <div>
                          <div className="fw-semibold small">Security Settings</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>Manage 2FA and security</div>
                        </div>
                      </button>

                      <button className="dropdown-item-custom" onClick={() => { setShowDropdown(false); router.push('/admin/security/logs'); }}>
                        <i className="bi bi-activity me-3"></i>
                        <div>
                          <div className="fw-semibold small">Activity Logs</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>View your activity history</div>
                        </div>
                      </button>

                      <hr className="my-2" />

                      <button className="dropdown-item-custom" onClick={() => { setShowDropdown(false); router.push('/admin/settings'); }}>
                        <i className="bi bi-gear me-3"></i>
                        <div>
                          <div className="fw-semibold small">System Settings</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>Configure system preferences</div>
                        </div>
                      </button>

                      <hr className="my-2" />

                      <div className="px-3 py-2">
                        <small className="text-muted d-block" style={{ fontSize: '9px' }}>
                          <i className="bi bi-hdd me-1"></i> 
                          Session ID: {session.sessionId?.slice(0, 8) || 'ACTIVE'}...
                        </small>
                        <small className="text-muted d-block mt-1" style={{ fontSize: '9px' }}>
                          <i className="bi bi-clock me-1"></i> 
                          Logged in: {new Date(session.loggedInAt).toLocaleString()}
                        </small>
                      </div>

                      <hr className="my-2" />

                      <div className="px-2 pb-2">
                        <button onClick={handleLogout} className="btn btn-danger w-100 py-2 rounded-2 d-flex align-items-center justify-content-center gap-2" style={{ fontSize: '13px' }}>
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
        
        {/* Page Content */}
        <div className="p-4">{children}</div>
      </div>

      <style jsx>{`
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
        
        .notifications-list::-webkit-scrollbar {
          width: 4px;
        }
        
        .notifications-list::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        
        .notifications-list::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 4px;
        }
        
        .notification-item {
          transition: background-color 0.2s ease;
        }
        
        .notification-item:hover {
          background-color: #f8f9fa;
        }
      `}</style>
    </div>
  )
}