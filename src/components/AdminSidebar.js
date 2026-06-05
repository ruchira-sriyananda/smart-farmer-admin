import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

export default function AdminSidebar() {
  const router = useRouter()
  const [userRole, setUserRole] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [hoveredItem, setHoveredItem] = useState(null)
  const [notifications, setNotifications] = useState(3)

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

  // Menu items with permissions (Removed Reports and Backup)
  const menuItems = [
    { 
      path: '/admin/dashboard', 
      icon: 'bi-speedometer2', 
      label: 'Dashboard', 
      color: 'primary',
      roles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
      description: 'Overview & Analytics',
      badge: null
    },
    { 
      path: '/admin/users', 
      icon: 'bi-people', 
      label: 'User Management', 
      color: 'success',
      roles: ['SUPER_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
      description: 'Manage all users',
      badge: null
    },
    { 
      path: '/admin/posts', 
      icon: 'bi-file-post', 
      label: 'Content Moderation', 
      color: 'info',
      roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
      description: 'Manage posts & comments',
      badge: null
    },
    { 
      path: '/admin/analytics', 
      icon: 'bi-graph-up', 
      label: 'Analytics', 
      color: 'warning',
      roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
      description: 'Platform statistics',
      badge: 'new'
    },
    { 
      path: '/admin/security', 
      icon: 'bi-shield-lock', 
      label: 'Security', 
      color: 'dark',
      roles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
      description: 'Security monitoring',
      badge: null
    },
    { 
      path: '/admin/barter', 
      icon: 'bi-arrow-left-right', 
      label: 'Barter System', 
      color: 'success',
      roles: ['SUPER_ADMIN'],
      description: 'Manage barter trades',
      badge: null
    },
    { 
      path: '/admin/advertisements', 
      icon: 'bi-megaphone', 
      label: 'Advertisements', 
      color: 'info',
      roles: ['SUPER_ADMIN'],
      description: 'Manage ads & campaigns',
      badge: null
    },
    { 
      path: '/admin/ai-chatbot', 
      icon: 'bi-robot', 
      label: 'AI Chatbot', 
      color: 'primary',
      roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
      description: 'Chatbot monitoring',
      badge: null
    },
    { 
      path: '/admin/settings', 
      icon: 'bi-gear', 
      label: 'Settings', 
      color: 'secondary',
      roles: ['SUPER_ADMIN'],
      description: 'System configuration',
      badge: null
    },
    { 
      path: '/admin/activity-logs', 
      icon: 'bi-clock-history', 
      label: 'Activity Logs', 
      color: 'secondary',
      roles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
      description: 'View all activities',
      badge: null
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

  const getIconGradient = (color) => {
    const gradients = {
      primary: 'linear-gradient(135deg, #667eea20, #764ba220)',
      success: 'linear-gradient(135deg, #10b98120, #05966920)',
      info: 'linear-gradient(135deg, #0dcaf020, #0b5ed720)',
      danger: 'linear-gradient(135deg, #ef444420, #dc262620)',
      warning: 'linear-gradient(135deg, #f59e0b20, #d9770620)',
      dark: 'linear-gradient(135deg, #1f293720, #11182720)',
      secondary: 'linear-gradient(135deg, #6c757d20, #49505720)'
    }
    return gradients[color] || gradients.primary
  }

  const isActive = (path) => {
    return router.pathname === path
  }

  return (
    <>
      {/* Toggle Button for Mobile */}
      <button 
        className="sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
      >
        <i className={`bi ${collapsed ? 'bi-x-lg' : 'bi-list'}`}></i>
      </button>

      {/* Sidebar Overlay for Mobile */}
      {collapsed && (
        <div className="sidebar-overlay" onClick={() => setCollapsed(false)}></div>
      )}

      {/* Sidebar */}
      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        {/* Logo Section with Animation */}
        <div className="logo-section">
          <div className="logo-wrapper">
            <div className="logo-icon">
              <i className="bi bi-tractor"></i>
            </div>
            <div className="logo-text">
              <h5 className="logo-title">Smart Farmer</h5>
              <span className="logo-badge">Admin Portal</span>
            </div>
          </div>
        </div>

        {/* User Profile Section */}
        <div className="user-section">
          <div className="user-avatar">
            <i className="bi bi-person-circle"></i>
            <div className="user-status online"></div>
          </div>
          <div className="user-info">
            <div className="user-name">Admin User</div>
            <div className="user-role">
              <i className="bi bi-shield-check"></i>
              <span>{userRole || 'Loading...'}</span>
            </div>
          </div>
          {isSuperAdmin && (
            <div className="super-admin-badge">
              <i className="bi bi-star-fill"></i>
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
              <div className="nav-icon-wrapper" style={{ background: getIconGradient(item.color) }}>
                <i className={`bi ${item.icon}`} style={{ color: getIconColor(item.color) }}></i>
              </div>
              <div className="nav-content">
                <div className="nav-label-wrapper">
                  <span className="nav-label">{item.label}</span>
                  {item.badge && (
                    <span className="nav-badge">{item.badge}</span>
                  )}
                </div>
                <span className="nav-description">{item.description}</span>
              </div>
              {isActive(item.path) && <div className="active-indicator"></div>}
              
              {/* Tooltip on hover when collapsed */}
              {collapsed && hoveredItem === item.path && (
                <div className="nav-tooltip">
                  <div className="tooltip-icon" style={{ background: getIconGradient(item.color) }}>
                    <i className={`bi ${item.icon}`} style={{ color: getIconColor(item.color) }}></i>
                  </div>
                  <div className="tooltip-content">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </div>
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Footer Section with System Info */}
        <div className="sidebar-footer">
          <div className="system-status">
            <div className="status-indicator">
              <div className="status-dot"></div>
              <div className="status-pulse"></div>
            </div>
            <div className="status-text">
              <span className="status-label">System Status</span>
              <span className="status-value">Operational</span>
            </div>
          </div>
          <div className="footer-divider"></div>
          <div className="version-info">
            <i className="bi bi-code-square"></i>
            <span>v3.0.0</span>
          </div>
        </div>

        {/* Collapse Toggle Button (Desktop) */}
        <button 
          className="collapse-toggle"
          onClick={() => setCollapsed(!collapsed)}
        >
          <i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
        </button>
      </div>

      <style jsx>{`
        /* Modern Sidebar Styles */
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          width: 280px;
          height: 100vh;
          background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
          backdrop-filter: blur(10px);
          color: #e2e8f0;
          z-index: 1000;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          overflow-y: auto;
          overflow-x: hidden;
          box-shadow: 4px 0 20px rgba(0, 0, 0, 0.1);
        }

        .sidebar.collapsed {
          width: 88px;
        }

        /* Scrollbar Styling */
        .sidebar::-webkit-scrollbar {
          width: 4px;
        }

        .sidebar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .sidebar::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 4px;
        }

        /* Logo Section */
        .logo-section {
          padding: 28px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 20px;
        }

        .logo-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .logo-icon::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s;
        }

        .logo-icon:hover::before {
          left: 100%;
        }

        .logo-icon i {
          font-size: 24px;
          color: white;
        }

        .logo-text {
          flex: 1;
        }

        .logo-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 4px 0;
          background: linear-gradient(135deg, #fff, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .logo-badge {
          font-size: 10px;
          opacity: 0.6;
          display: block;
        }

        /* User Section */
        .user-section {
          padding: 0 20px 20px;
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
        }

        .user-avatar {
          position: relative;
          width: 48px;
          height: 48px;
        }

        .user-avatar i {
          font-size: 48px;
          color: #94a3b8;
        }

        .user-status {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 12px;
          height: 12px;
          background: #10b981;
          border: 2px solid #1e293b;
          border-radius: 50%;
        }

        .user-status.online {
          animation: pulse 2s infinite;
        }

        .user-info {
          flex: 1;
        }

        .user-name {
          font-size: 14px;
          font-weight: 600;
          color: white;
          margin-bottom: 4px;
        }

        .user-role {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          opacity: 0.7;
        }

        .user-role i {
          font-size: 11px;
        }

        .super-admin-badge {
          position: absolute;
          top: -5px;
          right: 15px;
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .super-admin-badge i {
          font-size: 12px;
          color: white;
        }

        /* Navigation Menu */
        .nav-menu {
          padding: 0 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          width: 100%;
          background: transparent;
          border: none;
          border-radius: 14px;
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
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15));
          color: white;
          border: 1px solid rgba(102, 126, 234, 0.3);
        }

        .nav-item.active::before {
          content: '';
          position: absolute;
          left: -12px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 40px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 0 3px 3px 0;
        }

        .nav-icon-wrapper {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          transition: all 0.3s ease;
        }

        .nav-icon-wrapper i {
          font-size: 20px;
          transition: all 0.3s ease;
        }

        .nav-item:hover .nav-icon-wrapper i {
          transform: scale(1.1);
        }

        .nav-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nav-label-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-label {
          font-size: 14px;
          font-weight: 500;
        }

        .nav-badge {
          font-size: 9px;
          padding: 2px 6px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border-radius: 10px;
          color: white;
          text-transform: uppercase;
          font-weight: 700;
        }

        .nav-description {
          font-size: 10px;
          opacity: 0.5;
          transition: all 0.3s ease;
        }

        .active-indicator {
          width: 3px;
          height: 30px;
          background: linear-gradient(135deg, #667eea, #764ba2);
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
          border-radius: 12px;
          white-space: nowrap;
          z-index: 1100;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(102, 126, 234, 0.3);
          animation: fadeIn 0.2s ease;
        }

        .tooltip-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
        }

        .tooltip-icon i {
          font-size: 16px;
        }

        .tooltip-content {
          display: flex;
          flex-direction: column;
        }

        .tooltip-content strong {
          font-size: 13px;
          color: white;
        }

        .tooltip-content small {
          font-size: 10px;
          color: #94a3b8;
        }

        /* Sidebar Footer */
        .sidebar-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(180deg, transparent, rgba(0,0,0,0.2));
        }

        .system-status {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .status-indicator {
          position: relative;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .status-dot {
          width: 10px;
          height: 10px;
          background-color: #10b981;
          border-radius: 50%;
          position: relative;
          z-index: 2;
        }

        .status-pulse {
          position: absolute;
          width: 30px;
          height: 30px;
          background-color: #10b981;
          border-radius: 50%;
          opacity: 0.4;
          animation: pulse-ring 2s infinite;
        }

        .status-text {
          flex: 1;
        }

        .status-label {
          display: block;
          font-size: 10px;
          opacity: 0.5;
          margin-bottom: 2px;
        }

        .status-value {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #10b981;
        }

        .footer-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 12px 0;
        }

        .version-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 11px;
          opacity: 0.5;
        }

        .version-info i {
          font-size: 12px;
        }

        /* Collapse Toggle Button */
        .collapse-toggle {
          position: absolute;
          bottom: 20px;
          right: -12px;
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none;
          border-radius: 12px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          z-index: 1100;
        }

        .collapse-toggle:hover {
          transform: scale(1.1);
        }

        /* Sidebar Overlay for Mobile */
        .sidebar-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
          animation: fadeIn 0.3s ease;
        }

        /* Sidebar Toggle Button for Mobile */
        .sidebar-toggle {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 56px;
          height: 56px;
          border-radius: 28px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none;
          color: white;
          font-size: 24px;
          z-index: 1100;
          display: none;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .sidebar-toggle:hover {
          transform: scale(1.05);
        }

        /* Animations */
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @keyframes pulse-ring {
          0% {
            transform: scale(0.8);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Collapsed State Styles */
        .sidebar.collapsed .logo-wrapper {
          justify-content: center;
        }

        .sidebar.collapsed .logo-text,
        .sidebar.collapsed .user-info,
        .sidebar.collapsed .nav-description,
        .sidebar.collapsed .status-text,
        .sidebar.collapsed .version-info span,
        .sidebar.collapsed .footer-divider {
          display: none;
        }

        .sidebar.collapsed .user-section {
          justify-content: center;
          padding: 0 20px 20px;
        }

        .sidebar.collapsed .nav-item {
          justify-content: center;
          padding: 12px;
        }

        .sidebar.collapsed .nav-icon-wrapper {
          margin: 0;
        }

        .sidebar.collapsed .system-status {
          justify-content: center;
        }

        .sidebar.collapsed .collapse-toggle {
          right: -12px;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
            width: 280px;
            z-index: 1001;
          }

          .sidebar.collapsed {
            transform: translateX(0);
          }

          .sidebar-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .collapse-toggle {
            display: none;
          }

          .sidebar.collapsed .logo-text,
          .sidebar.collapsed .user-info,
          .sidebar.collapsed .nav-description,
          .sidebar.collapsed .status-text,
          .sidebar.collapsed .version-info span {
            display: block;
          }

          .sidebar.collapsed .user-section {
            justify-content: flex-start;
          }

          .sidebar.collapsed .nav-item {
            justify-content: flex-start;
          }

          .sidebar.collapsed .system-status {
            justify-content: flex-start;
          }
        }

        /* Desktop hover effect */
        @media (min-width: 769px) {
          .sidebar:not(.collapsed):hover {
            width: 280px;
          }
        }
      `}</style>
    </>
  )
}