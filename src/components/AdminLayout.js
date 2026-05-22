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
  const [loadingNotifications, setLoadingNotifications] = useState(true)
  const [profileImage, setProfileImage] = useState(null)
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileRole, setProfileRole] = useState('')
  const dropdownRef = useRef(null)
  const notificationRef = useRef(null)

  useEffect(() => {
    const init = async () => {
      const storedSession = localStorage.getItem('adminSession')
      if (!storedSession) {
        router.push('/admin/login')
        return
      }
      
      try {
        const parsedSession = JSON.parse(storedSession)
        setSession(parsedSession)
        
        // Fetch fresh profile data from database
        await fetchFreshProfile(parsedSession)
        
        // Subscribe to real-time profile updates
        subscribeToProfileUpdates(parsedSession)
      } catch (err) {
        console.error('Error parsing session:', err)
        router.push('/admin/login')
      }
    }
    
    init()

    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    
    fetchRealNotifications()
    subscribeToRealTimeNotifications()
    
    return () => {
      clearInterval(timer)
      supabase.removeAllChannels()
    }
  }, [router])

  // Fetch fresh profile data from database
  const fetchFreshProfile = async (sessionData) => {
    try {
      const adminEmail = sessionData.admin?.email || sessionData.user?.email
      
      if (!adminEmail) return

      const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select('full_name, email, profile_image, admin_roles!left(role_name)')
        .eq('email', adminEmail)
        .maybeSingle()

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      if (adminUser) {
        setProfileImage(adminUser.profile_image || null)
        setProfileName(adminUser.full_name || sessionData.admin?.full_name || 'Admin')
        setProfileEmail(adminUser.email || sessionData.admin?.email || 'admin@smartfarmer.com')
        setProfileRole(sessionData.role || adminUser.admin_roles?.role_name || 'Administrator')
        
        // Update session with latest profile image
        const updatedSession = { ...sessionData }
        if (!updatedSession.admin) updatedSession.admin = {}
        updatedSession.admin.profile_image = adminUser.profile_image
        updatedSession.admin.full_name = adminUser.full_name
        localStorage.setItem('adminSession', JSON.stringify(updatedSession))
        setSession(updatedSession)
      } else {
        // Fallback to session data
        setProfileImage(sessionData.admin?.profile_image || null)
        setProfileName(sessionData.admin?.full_name || sessionData.user?.email?.split('@')[0] || 'Admin')
        setProfileEmail(sessionData.admin?.email || sessionData.user?.email || 'admin@smartfarmer.com')
        setProfileRole(sessionData.role || 'Administrator')
      }
    } catch (err) {
      console.error('Error in fetchFreshProfile:', err)
    }
  }

  // Subscribe to profile changes in real-time
  const subscribeToProfileUpdates = (sessionData) => {
    const adminEmail = sessionData.admin?.email || sessionData.user?.email
    
    if (!adminEmail) return

    const channel = supabase
      .channel('profile_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'admin_users',
          filter: `email=eq.${adminEmail}`
        },
        async (payload) => {
          // Update profile image and name in real-time
          if (payload.new.profile_image !== undefined) {
            setProfileImage(payload.new.profile_image)
          }
          if (payload.new.full_name) {
            setProfileName(payload.new.full_name)
          }
          
          // Update session storage
          const currentSession = JSON.parse(localStorage.getItem('adminSession'))
          if (currentSession) {
            if (!currentSession.admin) currentSession.admin = {}
            currentSession.admin.profile_image = payload.new.profile_image
            currentSession.admin.full_name = payload.new.full_name
            localStorage.setItem('adminSession', JSON.stringify(currentSession))
            setSession(currentSession)
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }

  // Close dropdowns when clicking outside
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

  // Fetch real notifications from admin_activity_logs table
  const fetchRealNotifications = async () => {
    try {
      setLoadingNotifications(true)
      
      const { data: activities, error } = await supabase
        .from('admin_activity_logs')
        .select(`
          log_id,
          activity_type,
          activity_description,
          created_at,
          ip_address,
          admin_users:admin_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      if (activities && activities.length > 0) {
        const formattedNotifications = activities.map(activity => ({
          id: activity.log_id,
          title: getNotificationTitle(activity.activity_type),
          message: activity.activity_description,
          time: formatTimeAgo(activity.created_at),
          read: checkIfRead(activity.log_id),
          type: getNotificationType(activity.activity_type),
          icon: getNotificationIcon(activity.activity_type),
          user: activity.admin_users?.full_name || 'System',
          createdAt: activity.created_at,
          ipAddress: activity.ip_address
        }))
        
        setNotifications(formattedNotifications)
        
        const readIds = JSON.parse(localStorage.getItem('readNotifications') || '[]')
        const unread = formattedNotifications.filter(n => !readIds.includes(n.id)).length
        setUnreadCount(unread)
      } else {
        setNotifications([])
        setUnreadCount(0)
      }
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setNotifications([])
    } finally {
      setLoadingNotifications(false)
    }
  }

  const checkIfRead = (notificationId) => {
    const readIds = JSON.parse(localStorage.getItem('readNotifications') || '[]')
    return readIds.includes(notificationId)
  }

  const subscribeToRealTimeNotifications = () => {
    const channel = supabase
      .channel('admin_activity_logs_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_activity_logs'
        },
        async (payload) => {
          const { data: newActivity, error } = await supabase
            .from('admin_activity_logs')
            .select(`
              log_id,
              activity_type,
              activity_description,
              created_at,
              ip_address,
              admin_users:admin_id (
                full_name,
                email
              )
            `)
            .eq('log_id', payload.new.log_id)
            .single()

          if (!error && newActivity) {
            const newNotification = {
              id: newActivity.log_id,
              title: getNotificationTitle(newActivity.activity_type),
              message: newActivity.activity_description,
              time: 'Just now',
              read: false,
              type: getNotificationType(newActivity.activity_type),
              icon: getNotificationIcon(newActivity.activity_type),
              user: newActivity.admin_users?.full_name || 'System',
              createdAt: newActivity.created_at,
              ipAddress: newActivity.ip_address
            }
            
            setNotifications(prev => [newNotification, ...prev.slice(0, 19)])
            setUnreadCount(prev => prev + 1)
            
            if (Notification.permission === 'granted') {
              new Notification(newNotification.title, {
                body: newNotification.message,
                icon: '/favicon.ico'
              })
            }
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }

  const getNotificationTitle = (type) => {
    const titles = {
      'LOGIN': '🔐 New Login',
      'LOGOUT': '🚪 User Logout',
      'USER_MANAGEMENT': '👥 User Management',
      'CONTENT_MODERATION': '📝 Content Moderation',
      'REPORT_HANDLING': '📋 Report Update',
      'SECURITY_ALERT': '⚠️ Security Alert',
      'PASSWORD_CHANGE': '🔑 Password Changed',
      'SETTINGS_UPDATE': '⚙️ Settings Updated',
      'BACKUP_CREATED': '💾 Backup Created',
      'EXPORT_DATA': '📊 Data Exported'
    }
    return titles[type] || '📢 New Activity'
  }

  const getNotificationType = (type) => {
    const types = {
      'LOGIN': 'info',
      'LOGOUT': 'secondary',
      'USER_MANAGEMENT': 'primary',
      'CONTENT_MODERATION': 'warning',
      'REPORT_HANDLING': 'danger',
      'SECURITY_ALERT': 'danger',
      'PASSWORD_CHANGE': 'warning',
      'SETTINGS_UPDATE': 'info',
      'BACKUP_CREATED': 'success',
      'EXPORT_DATA': 'success'
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
      'SECURITY_ALERT': 'shield-exclamation',
      'PASSWORD_CHANGE': 'key',
      'SETTINGS_UPDATE': 'gear',
      'BACKUP_CREATED': 'database',
      'EXPORT_DATA': 'download'
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
    const readIds = JSON.parse(localStorage.getItem('readNotifications') || '[]')
    if (!readIds.includes(notificationId)) {
      readIds.push(notificationId)
      localStorage.setItem('readNotifications', JSON.stringify(readIds))
      setUnreadCount(prev => Math.max(0, prev - 1))
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
    }
  }

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id)
    localStorage.setItem('readNotifications', JSON.stringify(allIds))
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const clearAllNotifications = () => {
    setNotifications([])
    setUnreadCount(0)
  }

  const deleteNotification = async (notificationId) => {
    if (session?.admin?.is_super_admin) {
      const { error } = await supabase
        .from('admin_activity_logs')
        .delete()
        .eq('log_id', notificationId)
      
      if (!error) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
      }
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem('adminSession')
    document.cookie = 'admin-session=; path=/; max-age=0'
    router.push('/admin/login')
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

            {/* Real-time Notifications Dropdown */}
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
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger animate-pulse" style={{ fontSize: '10px' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Menu */}
              {showNotifications && (
                <div className="position-absolute end-0 mt-2" style={{ width: '400px', zIndex: 1050 }}>
                  <div className="card border-0 shadow-lg rounded-3 overflow-hidden">
                    <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="mb-0 fw-bold">
                          <i className="bi bi-bell me-2 text-primary"></i>
                          Real-time Notifications
                          {unreadCount > 0 && (
                            <span className="badge bg-danger ms-2">{unreadCount} new</span>
                          )}
                        </h6>
                        <small className="text-muted">Live updates from system</small>
                      </div>
                      <div className="dropdown">
                        <button className="btn btn-sm btn-link text-decoration-none p-0" data-bs-toggle="dropdown">
                          <i className="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul className="dropdown-menu dropdown-menu-end">
                          <li><button className="dropdown-item small" onClick={markAllAsRead}>
                            <i className="bi bi-check2-all me-2"></i>Mark all as read
                          </button></li>
                          <li><hr className="dropdown-divider" /></li>
                          <li><button className="dropdown-item small text-danger" onClick={clearAllNotifications}>
                            <i className="bi bi-trash me-2"></i>Clear all
                          </button></li>
                        </ul>
                      </div>
                    </div>

                    <div className="notifications-list" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                      {loadingNotifications ? (
                        <div className="text-center py-5">
                          <div className="spinner-border text-primary spinner-border-sm mb-2"></div>
                          <p className="text-muted small mb-0">Loading notifications...</p>
                        </div>
                      ) : notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div 
                            key={notification.id} 
                            className={`notification-item p-3 border-bottom ${!notification.read ? 'bg-light' : ''}`}
                            onClick={() => markAsRead(notification.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="d-flex gap-3">
                              <div className={`flex-shrink-0 bg-${notification.type} bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center`} style={{ width: '45px', height: '45px' }}>
                                <i className={`bi bi-${notification.icon} text-${notification.type} fs-5`}></i>
                              </div>
                              <div className="flex-grow-1">
                                <div className="d-flex justify-content-between align-items-start">
                                  <h6 className="mb-1 small fw-bold">{notification.title}</h6>
                                  <small className="text-muted" style={{ fontSize: '10px' }}>{notification.time}</small>
                                </div>
                                <p className="mb-1 small text-muted">{notification.message}</p>
                                <div className="d-flex justify-content-between align-items-center">
                                  <small className="text-muted" style={{ fontSize: '9px' }}>
                                    <i className="bi bi-person-circle me-1"></i>
                                    {notification.user}
                                  </small>
                                  {notification.ipAddress && (
                                    <small className="text-muted" style={{ fontSize: '9px' }}>
                                      <i className="bi bi-ip me-1"></i>
                                      {notification.ipAddress}
                                    </small>
                                  )}
                                </div>
                              </div>
                              {!notification.read && (
                                <div className="flex-shrink-0">
                                  <div className="bg-primary rounded-circle" style={{ width: '8px', height: '8px' }}></div>
                                </div>
                              )}
                              {session?.admin?.is_super_admin && (
                                <button 
                                  className="btn btn-sm btn-link text-danger p-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteNotification(notification.id)
                                  }}
                                >
                                  <i className="bi bi-x"></i>
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-5">
                          <i className="bi bi-bell-slash fs-1 text-muted"></i>
                          <p className="text-muted mt-2 mb-0">No notifications</p>
                          <small className="text-muted">System activities will appear here</small>
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
                        View All Activity Logs <i className="bi bi-arrow-right ms-1"></i>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown with Real-time Image - ALWAYS SHOW IMAGE */}
            <div className="position-relative" ref={dropdownRef}>
              <button
                className="btn btn-link text-decoration-none p-0 d-flex align-items-center"
                onClick={() => setShowDropdown(!showDropdown)}
                style={{ outline: 'none' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ 
                    width: '40px', 
                    height: '40px',
                    background: profileImage ? 'transparent' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    overflow: 'hidden'
                  }}>
                    {profileImage ? (
                      <img 
                        src={profileImage} 
                        alt="Profile" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <i className="bi bi-person-circle fs-2 text-white"></i>
                    )}
                  </div>
                  <div className="text-start d-none d-md-block">
                    <div className="fw-bold small">{profileName}</div>
                    <small className="text-muted">{profileRole}</small>
                  </div>
                  <i className="bi bi-chevron-down text-muted" style={{ fontSize: '12px' }}></i>
                </div>
              </button>

              {showDropdown && (
                <div className="position-absolute end-0 mt-2" style={{ width: '300px', zIndex: 1050 }}>
                  <div className="card border-0 shadow-lg rounded-3 overflow-hidden">
                    <div className="bg-gradient-primary text-white px-4 py-3 text-center">
                      <div className="bg-white rounded-circle d-flex align-items-center justify-content-center mx-auto mb-2 shadow-sm" style={{ width: '70px', height: '70px', overflow: 'hidden' }}>
                        {profileImage ? (
                          <img 
                            src={profileImage} 
                            alt="Profile" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <i className="bi bi-person-circle fs-1 text-primary"></i>
                        )}
                      </div>
                      <h6 className="mb-1 fw-bold">{profileName}</h6>
                      <p className="small mb-0 opacity-75">{profileEmail}</p>
                    </div>

                    <div className="px-4 py-3 border-bottom">
                      <div className="row text-center">
                        <div className="col-6">
                          <small className="text-muted d-block">Role</small>
                          <strong>{profileRole}</strong>
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

                      <button className="dropdown-item-custom" onClick={() => { setShowDropdown(false); router.push('/admin/security/logs'); }}>
                        <i className="bi bi-activity me-3"></i>
                        <div>
                          <div className="fw-semibold small">Activity Logs</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>View all system activities</div>
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
        .bg-gradient-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
        
        .notifications-list {
          scrollbar-width: thin;
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
          background-color: #f8f9fa !important;
        }
        
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
        
        .animate-pulse {
          animation: pulse 2s infinite;
        }
      `}</style>
    </div>
  )
}