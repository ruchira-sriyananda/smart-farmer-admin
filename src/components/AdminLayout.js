import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import AdminSidebar from './AdminSidebar'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

export default function AdminLayout({ children, title = "Dashboard" }) {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const storedSession = localStorage.getItem('adminSession')
    if (!storedSession) {
      router.push('/admin/login')
      return
    }
    
    try {
      const parsedSession = JSON.parse(storedSession)
      console.log('Session loaded:', parsedSession) // Debug log
      setSession(parsedSession)
    } catch (err) {
      console.error('Error parsing session:', err)
      router.push('/admin/login')
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [router])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  // Get user initials for avatar
  const getInitials = () => {
    const name = session.admin?.full_name || session.user?.email || 'Admin'
    return name.charAt(0).toUpperCase()
  }

  // Get display name
  const getDisplayName = () => {
    return session.admin?.full_name || session.user?.email?.split('@')[0] || 'Admin'
  }

  // Get user email
  const getUserEmail = () => {
    return session.admin?.email || session.user?.email || 'admin@smartfarmer.com'
  }

  // Get user role
  const getUserRole = () => {
    return session.role || session.admin?.role || 'Administrator'
  }

  return (
    <div className="d-flex">
      <AdminSidebar />
      
      <div style={{ marginLeft: '880px', width: '100%' }}>
        {/* Top Navbar with Working Profile Dropdown */}
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

            {/* Custom Profile Dropdown - No Bootstrap JS dependency */}
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

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="position-absolute end-0 mt-2" style={{ width: '280px', zIndex: 1050 }}>
                  <div className="card border-0 shadow-lg rounded-3 overflow-hidden">
                    {/* Profile Header */}
                    <div className="bg-primary text-white px-4 py-3 text-center">
                      <div className="bg-white rounded-circle d-flex align-items-center justify-content-center mx-auto mb-2" style={{ width: '60px', height: '60px' }}>
                        <span className="text-primary fw-bold fs-3">{getInitials()}</span>
                      </div>
                      <h6 className="mb-1 fw-bold">{getDisplayName()}</h6>
                      <p className="small mb-0 opacity-75">{getUserEmail()}</p>
                    </div>

                    {/* User Info */}
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

                    {/* Menu Items */}
                    <div className="p-2">
                      <button 
                        className="dropdown-item-custom" 
                        onClick={() => {
                          setShowDropdown(false)
                          router.push('/admin/profile')
                        }}
                      >
                        <i className="bi bi-person me-3"></i>
                        <div>
                          <div className="fw-semibold small">My Profile</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>View your profile information</div>
                        </div>
                      </button>

                      <button 
                        className="dropdown-item-custom" 
                        onClick={() => {
                          setShowDropdown(false)
                          router.push('/admin/settings/security')
                        }}
                      >
                        <i className="bi bi-shield-lock me-3"></i>
                        <div>
                          <div className="fw-semibold small">Security Settings</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>Manage 2FA and security</div>
                        </div>
                      </button>

                      <button 
                        className="dropdown-item-custom" 
                        onClick={() => {
                          setShowDropdown(false)
                          router.push('/admin/security/logs')
                        }}
                      >
                        <i className="bi bi-activity me-3"></i>
                        <div>
                          <div className="fw-semibold small">Activity Logs</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>View your activity history</div>
                        </div>
                      </button>

                      <hr className="my-2" />

                      <button 
                        className="dropdown-item-custom" 
                        onClick={() => {
                          setShowDropdown(false)
                          router.push('/admin/settings')
                        }}
                      >
                        <i className="bi bi-gear me-3"></i>
                        <div>
                          <div className="fw-semibold small">System Settings</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>Configure system preferences</div>
                        </div>
                      </button>

                      <button 
                        className="dropdown-item-custom" 
                        onClick={() => {
                          setShowDropdown(false)
                          router.push('/admin/help')
                        }}
                      >
                        <i className="bi bi-question-circle me-3"></i>
                        <div>
                          <div className="fw-semibold small">Help & Support</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>Get help and documentation</div>
                        </div>
                      </button>

                      <hr className="my-2" />

                      {/* Session Info */}
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
        
        {/* Page Content */}
        <div className="p-4">{children}</div>
      </div>

      <style jsx global>{`
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
        
        .bg-gradient-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
      `}</style>
    </div>
  )
}