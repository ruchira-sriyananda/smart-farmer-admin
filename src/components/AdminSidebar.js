import { useRouter } from 'next/router'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

export default function AdminSidebar({ children }) {
  const router = useRouter()

  const menuItems = [
    { path: '/admin/dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
    { path: '/admin/users', icon: 'bi-people', label: 'Users' },
    { path: '/admin/posts', icon: 'bi-file-post', label: 'Posts' },
    { path: '/admin/reports', icon: 'bi-flag', label: 'Reports' },
    { path: '/admin/analytics', icon: 'bi-graph-up', label: 'Analytics' },
    { path: '/admin/security', icon: 'bi-shield-lock', label: 'Security' },
    { path: '/admin/settings', icon: 'bi-gear', label: 'Settings' },
  ]

  return (
    <div className="d-flex">
      {/* Sidebar */}
      <div className="bg-dark text-white vh-100 position-fixed" style={{ width: '260px' }}>
        <div className="p-3">
          <h5 className="text-white mb-3">
            <i className="bi bi-tractor me-2"></i>
            Smart Farmer
          </h5>
          <hr className="border-secondary" />
          <nav>
            {menuItems.map(item => (
              <button
                key={item.path}
                className="btn btn-link text-white text-decoration-none w-100 text-start mb-2"
                onClick={() => router.push(item.path)}
                style={{ borderRadius: '8px' }}
              >
                <i className={`bi ${item.icon} me-2`}></i>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ marginLeft: '260px', width: '100%' }}>
        {children}
      </div>
    </div>
  )
}