import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

export default function AdminLayout({ children, title = "Dashboard" }) {
  const router = useRouter()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [session, setSession] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const checkSession = () => {
      const storedSession = localStorage.getItem('adminSession')
      if (!storedSession) {
        router.push('/admin/login')
      } else {
        setSession(JSON.parse(storedSession))
      }
    }
    checkSession()

    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [router])

  const handleLogout = async () => {
    localStorage.removeItem('adminSession')
    document.cookie = 'admin-session=; path=/; max-age=0'
    router.push('/admin/login')
  }

  const menuItems = [
    { path: '/admin/dashboard', icon: 'bi-speedometer2', label: 'Dashboard', color: 'primary' },
    { path: '/admin/users', icon: 'bi-people', label: 'User Management', color: 'success' },
    { path: '/admin/reports', icon: 'bi-flag', label: 'Reports', color: 'danger' },
    { path: '/admin/security', icon: 'bi-shield-lock', label: 'Security', color: 'warning' },
    { path: '/admin/settings', icon: 'bi-gear', label: 'Settings', color: 'info' },
  ]

  return (
    <div className="d-flex">
      {/* Sidebar */}
      <div className="bg-dark text-white vh-100 position-fixed" style={{ width: '280px', zIndex: 1000 }}>
        <div className="p-3">
          <div className="text-center mb-4">
            <div className="bg-gradient-primary rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: '60px', height: '60px' }}>
              <i className="bi bi-tractor fs-2 text-white"></i>
            </div>
            <h5 className="text-white mb-0">Smart Farmer</h5>
            <small className="text-white-50">Admin Portal</small>
          </div>
          <hr className="border-secondary" />
          <nav>
            {menuItems.map(item => (
              <button
                key={item.path}
                className={`btn w-100 text-start mb-2 d-flex align-items-center ${router.pathname === item.path ? 'bg-primary' : 'text-white'}`}
                onClick={() => router.push(item.path)}
                style={{ borderRadius: '10px', padding: '12px 16px' }}
              >
                <i className={`bi ${item.icon} me-3 fs-5`}></i>
                <span>{item.label}</span>
                {router.pathname === item.path && (
                  <i className="bi bi-check-circle-fill ms-auto text-white"></i>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
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

            {/* Profile Dropdown */}
            <div className="dropdown">
              <button
                className="btn btn-link text-decoration-none dropdown-toggle p-0"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <div className="d-flex align-items-center gap-2">
                  <div className="bg-gradient-primary rounded-circle d-flex align-items-center justify-content-center text-white fw-bold" style={{ width: '40px', height: '40px' }}>
                    {session?.admin?.full_name?.charAt(0) || 'A'}
                  </div>
                  <div className="text-start d-none d-md-block">
                    <div className="fw-bold small">{session?.admin?.full_name}</div>
                    <small className="text-muted">{session?.role}</small>
                  </div>
                </div>
              </button>
              <ul className={`dropdown-menu dropdown-menu-end shadow-sm border-0 ${showProfileMenu ? 'show' : ''}`}>
                <li className="dropdown-header text-primary fw-bold">
                  <i className="bi bi-person-circle me-2"></i>Account
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li><button className="dropdown-item" onClick={() => router.push('/admin/profile')}>
                  <i className="bi bi-person me-2"></i>My Profile
                </button></li>
                <li><button className="dropdown-item" onClick={() => router.push('/admin/security')}>
                  <i className="bi bi-shield-lock me-2"></i>Security
                </button></li>
                <li><hr className="dropdown-divider" /></li>
                <li><button className="dropdown-item text-danger" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2"></i>Logout
                </button></li>
              </ul>
            </div>
          </div>
        </nav>

        {/* Page Content */}
        <div className="p-4">
          {children}
        </div>
      </div>

      <style jsx global>{`
        .bg-gradient-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .btn-hover:hover {
          transform: translateY(-2px);
          transition: all 0.3s ease;
        }
      `}</style>
    </div>
  )
}