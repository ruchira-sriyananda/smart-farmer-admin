import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

export default function AdminSidebar() {
  const router = useRouter()
  const [userRole, setUserRole] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [hoveredItem, setHoveredItem] = useState(null)
  const [adminName, setAdminName] = useState('Administrator')
  const [adminEmail, setAdminEmail] = useState('')

  useEffect(() => {
    const getRole = () => {
      const session = localStorage.getItem('adminSession')
      if (session) {
        const parsed = JSON.parse(session)
        setUserRole(parsed.role || 'SUPPORT_ADMIN')
        setIsSuperAdmin(parsed.admin?.is_super_admin || false)
        if (parsed.admin?.full_name) {
          setAdminName(parsed.admin.full_name)
        }
        if (parsed.admin?.email) {
          setAdminEmail(parsed.admin.email)
        }
      }
    }
    getRole()
  }, [])

  // Menu items with permissions (Reports and Backup removed)
  const menuItems = [
    { 
      path: '/admin/dashboard', 
      icon: 'bi-speedometer2', 
      label: 'Dashboard', 
      color: 'primary',
      roles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
      description: 'System overview and key metrics'
    },
    { 
      path: '/admin/users', 
      icon: 'bi-people', 
      label: 'User Management', 
      color: 'success',
      roles: ['SUPER_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
      description: 'Manage user accounts and permissions'
    },
    { 
      path: '/admin/posts', 
      icon: 'bi-file-post', 
      label: 'Content Moderation', 
      color: 'info',
      roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
      description: 'Review and moderate user content'
    },
    { 
      path: '/admin/analytics', 
      icon: 'bi-graph-up', 
      label: 'Analytics', 
      color: 'warning',
      roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
      description: 'Platform analytics and reports'
    },
    { 
      path: '/admin/security', 
      icon: 'bi-shield-lock', 
      label: 'Security', 
      color: 'dark',
      roles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
      description: 'Security monitoring and settings'
    },
    { 
      path: '/admin/barter', 
      icon: 'bi-arrow-left-right', 
      label: 'Barter System', 
      color: 'success',
      roles: ['SUPER_ADMIN'],
      description: 'Manage barter transactions'
    },
    { 
      path: '/admin/advertisements', 
      icon: 'bi-megaphone', 
      label: 'Advertisements', 
      color: 'info',
      roles: ['SUPER_ADMIN'],
      description: 'Manage ad campaigns'
    },
    { 
      path: '/admin/ai-chatbot', 
      icon: 'bi-robot', 
      label: 'AI Chatbot', 
      color: 'primary',
      roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
      description: 'Chatbot monitoring and logs'
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
      description: 'View system activity'
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

  const formatRoleName = (role) => {
    const roleMap = {
      'SUPER_ADMIN': 'Super Administrator',
      'CONTENT_ADMIN': 'Content Administrator',
      'SECURITY_ADMIN': 'Security Administrator',
      'SUPPORT_ADMIN': 'Support Administrator'
    }
    return roleMap[role] || role
  }

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        className="sidebar-toggle d-md-none"
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Toggle Sidebar"
      >
        <i className={`bi ${collapsed ? 'bi-x-lg' : 'bi-list'}`}></i>
      </button>

      {/* Sidebar Overlay */}
      {collapsed && (
        <div className="sidebar-overlay d-md-none" onClick={() => setCollapsed(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''}`}>
        {/* Brand Section */}
        <div className="brand-section">
          <div className="brand-logo">
            <i className="bi bi-tractor"></i>
          </div>
          <div className="brand-info">
            <h1 className="brand-title">Smart Farmer</h1>
            <p className="brand-subtitle">Administration Portal</p>
          </div>
        </div>

        {/* Profile Section */}
        <div className="profile-section">
          <div className="profile-avatar">
            <i className="bi bi-person-circle"></i>
          </div>
          <div className="profile-details">
            <h3 className="profile-name">{adminName}</h3>
            <p className="profile-role">{formatRoleName(userRole)}</p>
            {adminEmail && <p className="profile-email">{adminEmail}</p>}
          </div>
          {isSuperAdmin && (
            <div className="super-admin-tag">
              <i className="bi bi-star-fill"></i>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="navigation-menu">
          <ul className="menu-list">
            {filteredMenuItems.map((item) => (
              <li key={item.path} className="menu-item">
                <button
                  className={`menu-link ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => router.push(item.path)}
                  onMouseEnter={() => setHoveredItem(item.path)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <span className="menu-icon" style={{ color: getIconColor(item.color) }}>
                    <i className={`bi ${item.icon}`}></i>
                  </span>
                  <span className="menu-text">
                    <span className="menu-label">{item.label}</span>
                    <span className="menu-description">{item.description}</span>
                  </span>
                  {isActive(item.path) && <span className="menu-active"></span>}
                </button>

                {/* Tooltip for collapsed mode */}
                {collapsed && hoveredItem === item.path && (
                  <div className="menu-tooltip">
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer Section */}
        <div className="sidebar-footer">
          <div className="system-status">
            <div className="status-indicator">
              <span className="status-dot"></span>
              <span className="status-label">System Operational</span>
            </div>
          </div>
          <div className="footer-divider"></div>
          <div className="version-info">
            <i className="bi bi-code-square"></i>
            <span>Version 3.0.0</span>
          </div>
        </div>

        {/* Collapse Toggle (Desktop) */}
        <button 
          className="collapse-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
        </button>
      </aside>

      <style jsx>{`
        /* ============================================
           ADMIN SIDEBAR - PROFESSIONAL DESIGN
           ============================================ */

        /* Sidebar Container */
        .admin-sidebar {
          position: fixed;
          left: 0;
          top: 0;
          width: 280px;
          height: 100vh;
          background: #1a1f2e;
          color: #a0aec0;
          z-index: 1000;
          transition: width 0.3s ease;
          overflow-y: auto;
          overflow-x: hidden;
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
        }

        .admin-sidebar.collapsed {
          width: 80px;
        }

        /* Scrollbar */
        .admin-sidebar::-webkit-scrollbar {
          width: 4px;
        }

        .admin-sidebar::-webkit-scrollbar-track {
          background: #2d3748;
        }

        .admin-sidebar::-webkit-scrollbar-thumb {
          background: #4a5568;
          border-radius: 2px;
        }

        /* Brand Section */
        .brand-section {
          padding: 24px 20px;
          border-bottom: 1px solid #2d3748;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-logo i {
          font-size: 20px;
          color: white;
        }

        .brand-title {
          font-size: 16px;
          font-weight: 600;
          color: white;
          margin: 0 0 4px 0;
        }

        .brand-subtitle {
          font-size: 11px;
          margin: 0;
          opacity: 0.7;
        }

        /* Profile Section */
        .profile-section {
          padding: 20px;
          border-bottom: 1px solid #2d3748;
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
        }

        .profile-avatar i {
          font-size: 44px;
          color: #718096;
        }

        .profile-details {
          flex: 1;
          min-width: 0;
        }

        .profile-name {
          font-size: 14px;
          font-weight: 600;
          color: white;
          margin: 0 0 4px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .profile-role {
          font-size: 11px;
          margin: 0 0 2px 0;
          opacity: 0.7;
        }

        .profile-email {
          font-size: 10px;
          margin: 0;
          opacity: 0.5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .super-admin-tag {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 22px;
          height: 22px;
          background: #f59e0b;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .super-admin-tag i {
          font-size: 11px;
          color: white;
        }

        /* Navigation Menu */
        .navigation-menu {
          padding: 16px 12px;
        }

        .menu-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .menu-item {
          position: relative;
        }

        .menu-link {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 10px 14px;
          width: 100%;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: #a0aec0;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          position: relative;
        }

        .menu-link:hover {
          background: #2d3748;
          color: white;
        }

        .menu-link.active {
          background: #2d3748;
          color: white;
        }

        .menu-link.active .menu-icon i {
          color: #4f46e5;
        }

        .menu-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        .menu-text {
          flex: 1;
          min-width: 0;
        }

        .menu-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 2px;
        }

        .menu-description {
          display: block;
          font-size: 10px;
          opacity: 0.6;
        }

        .menu-active {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 24px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border-radius: 0 2px 2px 0;
        }

        /* Tooltip for collapsed mode */
        .menu-tooltip {
          position: absolute;
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          margin-left: 12px;
          background: #2d3748;
          padding: 8px 12px;
          border-radius: 8px;
          white-space: nowrap;
          z-index: 1100;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .menu-tooltip strong {
          font-size: 12px;
          color: white;
        }

        .menu-tooltip span {
          font-size: 10px;
          color: #a0aec0;
        }

        /* Sidebar Footer */
        .sidebar-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 16px 20px;
          border-top: 1px solid #2d3748;
          background: #1a1f2e;
        }

        .system-status {
          margin-bottom: 12px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          display: inline-block;
        }

        .status-label {
          font-size: 11px;
          opacity: 0.7;
        }

        .footer-divider {
          height: 1px;
          background: #2d3748;
          margin: 12px 0;
        }

        .version-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 10px;
          opacity: 0.5;
        }

        .version-info i {
          font-size: 11px;
        }

        /* Collapse Toggle */
        .collapse-toggle {
          position: absolute;
          bottom: 20px;
          right: -10px;
          width: 20px;
          height: 20px;
          background: #4f46e5;
          border: none;
          border-radius: 10px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 1100;
          font-size: 10px;
        }

        .collapse-toggle:hover {
          background: #7c3aed;
          transform: scale(1.1);
        }

        /* Mobile Toggle */
        .sidebar-toggle {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 48px;
          height: 48px;
          border-radius: 24px;
          background: #4f46e5;
          border: none;
          color: white;
          font-size: 20px;
          z-index: 1100;
          display: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .sidebar-toggle:hover {
          background: #7c3aed;
        }

        /* Sidebar Overlay */
        .sidebar-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
        }

        /* ============================================
           COLLAPSED STATE STYLES
           ============================================ */

        .admin-sidebar.collapsed .brand-info,
        .admin-sidebar.collapsed .profile-details,
        .admin-sidebar.collapsed .menu-text,
        .admin-sidebar.collapsed .status-label,
        .admin-sidebar.collapsed .version-info span,
        .admin-sidebar.collapsed .footer-divider {
          display: none;
        }

        .admin-sidebar.collapsed .brand-section {
          justify-content: center;
          padding: 24px;
        }

        .admin-sidebar.collapsed .profile-section {
          justify-content: center;
          padding: 20px;
        }

        .admin-sidebar.collapsed .profile-avatar i {
          font-size: 36px;
        }

        .admin-sidebar.collapsed .menu-link {
          justify-content: center;
          padding: 10px;
        }

        .admin-sidebar.collapsed .menu-icon {
          margin: 0;
        }

        .admin-sidebar.collapsed .system-status {
          justify-content: center;
        }

        .admin-sidebar.collapsed .sidebar-footer {
          text-align: center;
        }

        /* ============================================
           RESPONSIVE STYLES
           ============================================ */

        @media (max-width: 768px) {
          .admin-sidebar {
            transform: translateX(-100%);
            width: 280px;
            z-index: 1001;
          }

          .admin-sidebar.collapsed {
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

          /* Show hidden content on mobile when expanded */
          .admin-sidebar.collapsed .brand-info,
          .admin-sidebar.collapsed .profile-details,
          .admin-sidebar.collapsed .menu-text,
          .admin-sidebar.collapsed .status-label,
          .admin-sidebar.collapsed .version-info span,
          .admin-sidebar.collapsed .footer-divider {
            display: block;
          }

          .admin-sidebar.collapsed .brand-section {
            justify-content: flex-start;
            padding: 24px 20px;
          }

          .admin-sidebar.collapsed .profile-section {
            justify-content: flex-start;
          }

          .admin-sidebar.collapsed .menu-link {
            justify-content: flex-start;
            padding: 10px 14px;
          }

          .admin-sidebar.collapsed .menu-icon {
            margin-right: 14px;
          }

          .admin-sidebar.collapsed .system-status {
            justify-content: flex-start;
          }

          .admin-sidebar.collapsed .sidebar-footer {
            text-align: left;
          }
        }

        /* Desktop styles */
        @media (min-width: 769px) {
          .admin-sidebar:not(.collapsed):hover {
            width: 280px;
          }
        }
      `}</style>
    </>
  )
}