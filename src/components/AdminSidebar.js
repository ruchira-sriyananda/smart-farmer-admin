import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

export default function AdminSidebar() {
  const router = useRouter()
  const [userRole, setUserRole] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [hoveredItem, setHoveredItem] = useState(null)

  useEffect(() => {
    const getRole = () => {
      const session = localStorage.getItem('adminSession')
      if (session) {
        const parsed = JSON.parse(session)
        setUserRole(parsed.role || 'SUPPORT_ADMIN')
        setIsSuperAdmin(parsed.admin?.is_super_admin || false)
      }
    }
    getRole()
  }, [])

  // Menu items with permissions
  const menuItems = [
    { 
      path: '/admin/dashboard', 
      icon: 'bi-speedometer2', 
      label: 'Dashboard', 
      color: 'primary',
      roles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
      description: 'Overview & Analytics'
    },
    { 
      path: '/admin/users', 
      icon: 'bi-people', 
      label: 'User Management', 
      color: 'success',
      roles: ['SUPER_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
      description: 'Manage all users'
    },
    { 
      path: '/admin/posts', 
      icon: 'bi-file-post', 
      label: 'Content Moderation', 
      color: 'info',
      roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
      description: 'Manage posts & comments'
    },
    { 
      path: '/admin/reports', 
      icon: 'bi-flag', 
      label: 'Reports', 
      color: 'danger',
      roles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SUPPORT_ADMIN'],
      description: 'User reports & flags'
    },
    { 
      path: '/admin/analytics', 
      icon: 'bi-graph-up', 
      label: 'Analytics', 
      color: 'warning',
      roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
      description: 'Platform statistics'
    },
    { 
      path: '/admin/security', 
      icon: 'bi-shield-lock', 
      label: 'Security', 
      color: 'dark',
      roles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
      description: 'Security monitoring'
    },
    { 
      path: '/admin/barter', 
      icon: 'bi-arrow-left-right', 
      label: 'Barter System', 
      color: 'success',
      roles: ['SUPER_ADMIN'],
      description: 'Manage barter trades'
    },
    { 
      path: '/admin/advertisements', 
      icon: 'bi-megaphone', 
      label: 'Advertisements', 
      color: 'info',
      roles: ['SUPER_ADMIN'],
      description: 'Manage ads & campaigns'
    },
    { 
      path: '/admin/ai-chatbot', 
      icon: 'bi-robot', 
      label: 'AI Chatbot', 
      color: 'primary',
      roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
      description: 'Chatbot monitoring'
    },
    { 
      path: '/admin/settings', 
      icon: 'bi-gear', 
      label: 'Settings', 
      color: 'secondary',
      roles: ['SUPER_ADMIN'],
      description: 'System configuration'
    },
    { 
      path: '/admin/activity-logs', 
      icon: 'bi-clock-history', 
      label: 'Activity Logs', 
      color: 'secondary',
      roles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
      description: 'View all activities'
    },
    { 
      path: '/admin/backup', 
      icon: 'bi-database', 
      label: 'Backup', 
      color: 'info',
      roles: ['SUPER_ADMIN'],
      description: 'Database backup'
    }
  ]

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter(item => {
    if (isSuperAdmin) return true
    return item.roles.includes(userRole)
  })

  const getIconColor = (color) => {
    const colors = {
      primary: '#4f46e5',
      success: '#10b981',
      info: '#0dcaf0',
      danger: '#ef4444',
      warning: '#f59e0b',
      dark: '#1f2937',
      secondary: '#6c757d'
    }
    return colors[color] || colors.primary
  }

  const isActive = (path) => {
    return router.pathname === path
  }

  return (
    <>
      {/* Toggle Button for Mobile */}
      <button 
        className="sidebar-toggle d-md-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <i className={`bi ${collapsed ? 'bi-list' : 'bi-x-lg'}`}></i>
      </button>

      {/* Sidebar */}
      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        {/* Logo Section */}
        <div className="logo-section">
          <div className="logo-icon">
            <i className="bi bi-tractor"></i>
          </div>
          <div className="logo-text">
            <h5 className="mb-0">Smart Farmer</h5>
            <small>Admin Portal</small>
          </div>
        </div>

        {/* User Role Badge */}
        <div className="role-badge-container">
          <div className="role-badge">
            <i className="bi bi-shield-check"></i>
            <span>{userRole || 'Loading...'}</span>
          </div>
          {isSuperAdmin && (
            <div className="super-badge">
              <i className="bi bi-star-fill"></i>
              <span>Super Admin</span>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="nav-menu">
          {filteredMenuItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => router.push(item.path)}
              onMouseEnter={() => setHoveredItem(item.path)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <div className="nav-icon" style={{ color: getIconColor(item.color) }}>
                <i className={`bi ${item.icon}`}></i>
              </div>
              <div className="nav-content">
                <span className="nav-label">{item.label}</span>
                <span className="nav-description">{item.description}</span>
              </div>
              {isActive(item.path) && <div className="active-indicator"></div>}
              
              {/* Tooltip on hover when collapsed */}
              {collapsed && hoveredItem === item.path && (
                <div className="nav-tooltip">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Footer Section */}
        <div className="sidebar-footer">
          <div className="system-status">
            <div className="status-dot"></div>
            <span>System Online</span>
          </div>
          <div className="version">v2.0.0</div>
        </div>
      </div>

      <style jsx>{`
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          width: 280px;
          height: 100vh;
          background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
          color: #e2e8f0;
          z-index: 1000;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow-y: auto;
          overflow-x: hidden;
        }

        .sidebar.collapsed {
          width: 80px;
        }

        .sidebar.collapsed .logo-text,
        .sidebar.collapsed .nav-description,
        .sidebar.collapsed .role-badge span,
        .sidebar.collapsed .super-badge span,
        .sidebar.collapsed .system-status span,
        .sidebar.collapsed .version {
          display: none;
        }

        .sidebar.collapsed .logo-icon {
          margin: 0 auto;
        }

        .sidebar.collapsed .role-badge {
          justify-content: center;
          padding: 8px;
        }

        .sidebar.collapsed .nav-item {
          justify-content: center;
          padding: 12px;
        }

        .sidebar.collapsed .nav-icon {
          margin: 0;
        }

        /* Logo Section */
        .logo-section {
          padding: 24px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .logo-icon {
          width: 45px;
          height: 45px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-icon i {
          font-size: 24px;
          color: white;
        }

        .logo-text h5 {
          font-size: 16px;
          font-weight: 700;
          margin: 0;
          color: white;
        }

        .logo-text small {
          font-size: 11px;
          opacity: 0.7;
        }

        /* Role Badge */
        .role-badge-container {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .role-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
        }

        .role-badge i {
          font-size: 14px;
        }

        .super-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
        }

        .super-badge i {
          font-size: 12px;
        }

        /* Navigation Menu */
        .nav-menu {
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          width: 100%;
          background: transparent;
          border: none;
          border-radius: 12px;
          color: #94a3b8;
          transition: all 0.3s ease;
          cursor: pointer;
          position: relative;
          text-align: left;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.08);
          color: white;
          transform: translateX(4px);
        }

        .nav-item.active {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
          color: white;
        }

        .nav-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 0 3px 3px 0;
        }

        .nav-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.3s ease;
        }

        .nav-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .nav-label {
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .nav-description {
          font-size: 10px;
          opacity: 0.6;
          margin-top: 2px;
        }

        .active-indicator {
          width: 4px;
          height: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 2px;
        }

        /* Tooltip for collapsed mode */
        .nav-tooltip {
          position: absolute;
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          margin-left: 12px;
          background: #1e293b;
          padding: 8px 12px;
          border-radius: 8px;
          white-space: nowrap;
          z-index: 1100;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
        }

        .nav-tooltip strong {
          font-size: 13px;
          color: white;
        }

        .nav-tooltip small {
          font-size: 10px;
          color: #94a3b8;
        }

        /* Sidebar Footer */
        .sidebar-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 16px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 11px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .system-status {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background-color: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .version {
          opacity: 0.5;
        }

        /* Sidebar Toggle Button */
        .sidebar-toggle {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 48px;
          height: 48px;
          border-radius: 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: white;
          font-size: 20px;
          z-index: 1100;
          display: none;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          cursor: pointer;
        }

        /* Animations */
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
          }
        }

        /* Scrollbar Styling */
        .sidebar::-webkit-scrollbar {
          width: 4px;
        }

        .sidebar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .sidebar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
            width: 260px;
          }

          .sidebar.collapsed {
            transform: translateX(0);
            width: 260px;
          }

          .sidebar.collapsed .logo-text,
          .sidebar.collapsed .nav-description,
          .sidebar.collapsed .role-badge span,
          .sidebar.collapsed .super-badge span,
          .sidebar.collapsed .system-status span,
          .sidebar.collapsed .version {
            display: flex;
          }

          .sidebar.collapsed .logo-icon {
            margin: 0;
          }

          .sidebar.collapsed .role-badge {
            justify-content: flex-start;
            padding: 8px 12px;
          }

          .sidebar.collapsed .nav-item {
            justify-content: flex-start;
            padding: 12px 16px;
          }

          .sidebar.collapsed .nav-icon {
            margin-right: 14px;
          }

          .sidebar-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }
      `}</style>
    </>
  )
}