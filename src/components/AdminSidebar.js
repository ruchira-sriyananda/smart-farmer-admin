import { useRouter } from 'next/router'

export default function AdminSidebar() {
  const router = useRouter()

  const menuItems = [
    { path: '/admin/dashboard', icon: 'bi-speedometer2', label: 'Dashboard', color: 'primary' },
    { path: '/admin/users', icon: 'bi-people', label: 'Users', color: 'success' },
    { path: '/admin/posts', icon: 'bi-file-post', label: 'Content', color: 'info' },
    { path: '/admin/reports', icon: 'bi-flag', label: 'Reports', color: 'danger' },
    { path: '/admin/analytics', icon: 'bi-graph-up', label: 'Analytics', color: 'warning' },
    { path: '/admin/security', icon: 'bi-shield-lock', label: 'Security', color: 'dark' },
    { path: '/admin/barter', icon: 'bi-arrow-left-right', label: 'Barter', color: 'success' },
    { path: '/admin/advertisements', icon: 'bi-megaphone', label: 'Ads', color: 'info' },
    { path: '/admin/ai-chatbot', icon: 'bi-robot', label: 'AI Chatbot', color: 'primary' },
    { path: '/admin/settings', icon: 'bi-gear', label: 'Settings', color: 'secondary' },
  ]

  return (
    <div className="bg-dark text-white vh-100 position-fixed" style={{ width: '280px', zIndex: 1000 }}>
      <div className="p-3">
        <div className="text-center mb-4">
          <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: '60px', height: '60px' }}>
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
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}