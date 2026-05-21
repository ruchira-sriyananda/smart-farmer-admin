import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminSidebar from './AdminSidebar'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

export default function AdminLayout({ children, title = "Dashboard" }) {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const storedSession = localStorage.getItem('adminSession')
    if (!storedSession) {
      router.push('/admin/login')
    } else {
      setSession(JSON.parse(storedSession))
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('adminSession')
    router.push('/admin/login')
  }

  if (!session) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary"></div>
      </div>
    )
  }

  return (
    <div className="d-flex">
      <AdminSidebar />
      
      <div style={{ marginLeft: '280px', width: '100%' }}>
        <nav className="navbar navbar-light bg-white shadow-sm px-4 py-2 sticky-top">
          <div>
            <h5 className="mb-0 fw-bold text-primary">{title}</h5>
            <small className="text-muted">{currentTime.toLocaleString()}</small>
          </div>
          
          <div className="d-flex align-items-center gap-3">
            <div className="bg-success bg-opacity-10 rounded-pill px-3 py-1">
              <i className="bi bi-shield-check text-success me-1"></i>
              <small className="text-success">Secure</small>
            </div>
            
            <div className="dropdown">
              <button className="btn btn-link text-decoration-none dropdown-toggle p-0" data-bs-toggle="dropdown">
                <div className="d-flex align-items-center gap-2">
                  <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center text-white" style={{ width: '40px', height: '40px' }}>
                    {session.admin?.full_name?.charAt(0) || 'A'}
                  </div>
                  <div className="text-start d-none d-md-block">
                    <div className="fw-bold small">{session.admin?.full_name}</div>
                    <small className="text-muted">{session.role}</small>
                  </div>
                </div>
              </button>
              <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0">
                <li><button className="dropdown-item" onClick={() => router.push('/admin/profile')}>
                  <i className="bi bi-person me-2"></i>Profile
                </button></li>
                <li><button className="dropdown-item" onClick={() => router.push('/admin/settings')}>
                  <i className="bi bi-gear me-2"></i>Settings
                </button></li>
                <li><hr className="dropdown-divider" /></li>
                <li><button className="dropdown-item text-danger" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2"></i>Logout
                </button></li>
              </ul>
            </div>
          </div>
        </nav>
        
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}