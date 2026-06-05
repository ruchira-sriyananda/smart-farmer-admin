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
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

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

    // Check screen size
    const handleResize = () => {
      const width = window.innerWidth
      setIsMobile(width < 768)
      setIsTablet(width >= 768 && width < 1024)
      
      // Auto collapse on mobile
      if (width < 768) {
        setCollapsed(true)
      } else {
        setCollapsed(false)
      }
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
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
      color: 'danger',
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
      secondary: '#94a3b8'
    }
    return colors[color] || colors.primary
  }

  const getIconBackground = (color) => {
    const backgrounds = {
      primary: 'rgba(79, 70, 229, 0.15)',
      success: 'rgba(16, 185, 129, 0.15)',
      info: 'rgba(13, 202, 240, 0.15)',
      danger: 'rgba(239, 68, 68, 0.15)',
      warning: 'rgba(245, 158, 11, 0.15)',
      secondary: 'rgba(148, 163, 184, 0.15)'
    }
    return backgrounds[color] || backgrounds.primary
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

  const toggleSidebar = () => {
    setCollapsed(!collapsed)
  }

  return (
    <>
      {/* Mobile & Tablet Toggle Button */}
      <button 
        className={`sidebar-toggle ${collapsed ? 'active' : ''}`}
        onClick={toggleSidebar}
        aria-label="Toggle Sidebar"
      >
        <i className={`bi ${collapsed ? 'bi-x-lg' : 'bi-list'}`}></i>
      </button>

      {/* Sidebar Overlay for Mobile/Tablet */}
      {collapsed && (isMobile || isTablet) && (
        <div className="sidebar-overlay" onClick={toggleSidebar}></div>
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''} ${isTablet ? 'tablet' : ''}`}>
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
                  onClick={() => {
                    router.push(item.path)
                    // Close sidebar on mobile after navigation
                    if (isMobile || isTablet) {
                      setCollapsed(true)
                    }
                  }}
                  onMouseEnter={() => !isMobile && setHoveredItem(item.path)}
                  onMouseLeave={() => !isMobile && setHoveredItem(null)}
                >
                  <span 
                    className="menu-icon" 
                    style={{ 
                      backgroundColor: getIconBackground(item.color),
                      color: getIconColor(item.color)
                    }}
                  >
                    <i className={`bi ${item.icon}`}></i>
                  </span>
                  <span className="menu-text">
                    <span className="menu-label">{item.label}</span>
                    <span className="menu-description">{item.description}</span>
                  </span>
                  {isActive(item.path) && <span className="menu-active"></span>}
                </button>

                {/* Tooltip for collapsed mode - Desktop only */}
                {!isMobile && collapsed && hoveredItem === item.path && (
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

        {/* Collapse Toggle (Desktop only) */}
        {!isMobile && !isTablet && (
          <button 
            className="collapse-toggle"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
          </button>
        )}
      </aside>

      <style jsx>{`
        /* ============================================
           ADMIN SIDEBAR - FULLY RESPONSIVE
           ============================================ */

        /* Base Sidebar Container */
        .admin-sidebar {
          position: fixed;
          left: 0;
          top: 0;
          width: 280px;
          height: 100vh;
          background: #0f172a;
          color: #94a3b8;
          z-index: 1000;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow-y: auto;
          overflow-x: hidden;
          box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
        }

        /* Scrollbar */
        .admin-sidebar::-webkit-scrollbar {
          width: 4px;
        }

        .admin-sidebar::-webkit-scrollbar-track {
          background: #1e293b;
        }

        .admin-sidebar::-webkit-scrollbar-thumb {
          background: #475569;
          border-radius: 2px;
        }

        .admin-sidebar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }

        /* Collapsed State */
        .admin-sidebar.collapsed {
          width: 80px;
        }

        /* Brand Section */
        .brand-section {
          padding: 24px 20px;
          border-bottom: 1px solid #1e293b;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s ease;
        }

        .brand-logo {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .brand-logo i {
          font-size: 20px;
          color: white;
        }

        .brand-info {
          flex: 1;
          min-width: 0;
          transition: opacity 0.3s ease;
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
          color: #94a3b8;
        }

        /* Profile Section */
        .profile-section {
          padding: 20px;
          border-bottom: 1px solid #1e293b;
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          transition: all 0.3s ease;
        }

        .profile-avatar {
          flex-shrink: 0;
        }

        .profile-avatar i {
          font-size: 44px;
          color: #64748b;
          transition: all 0.3s ease;
        }

        .profile-details {
          flex: 1;
          min-width: 0;
          transition: opacity 0.3s ease;
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
          color: #94a3b8;
        }

        .profile-email {
          font-size: 10px;
          margin: 0;
          color: #64748b;
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
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          position: relative;
        }

        .menu-link:hover {
          background: #1e293b;
          color: white;
        }

        .menu-link.active {
          background: #1e293b;
          color: white;
        }

        .menu-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          font-size: 18px;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        .menu-text {
          flex: 1;
          min-width: 0;
          transition: opacity 0.3s ease;
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
          color: #64748b;
        }

        .menu-link:hover .menu-description,
        .menu-link.active .menu-description {
          color: #94a3b8;
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

        /* Tooltip for collapsed mode - Desktop only */
        .menu-tooltip {
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
          gap: 4px;
          border: 1px solid #334155;
          animation: fadeIn 0.2s ease;
        }

        .menu-tooltip strong {
          font-size: 12px;
          color: white;
        }

        .menu-tooltip span {
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
          border-top: 1px solid #1e293b;
          background: #0f172a;
          transition: all 0.3s ease;
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
          box-shadow: 0 0 6px #10b981;
          animation: pulse 2s infinite;
        }

        .status-label {
          font-size: 11px;
          color: #94a3b8;
        }

        .footer-divider {
          height: 1px;
          background: #1e293b;
          margin: 12px 0;
        }

        .version-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 10px;
          color: #64748b;
        }

        .version-info i {
          font-size: 11px;
        }

        /* Collapse Toggle - Desktop only */
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

        /* Mobile & Tablet Toggle Button */
        .sidebar-toggle {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 56px;
          height: 56px;
          border-radius: 28px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border: none;
          color: white;
          font-size: 24px;
          z-index: 1100;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          transition: all 0.3s ease;
          display: none;
        }

        .sidebar-toggle:hover {
          transform: scale(1.05);
        }

        .sidebar-toggle.active {
          background: #ef4444;
        }

        /* Sidebar Overlay */
        .sidebar-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 999;
          animation: fadeIn 0.3s ease;
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
          opacity: 0;
          visibility: hidden;
          width: 0;
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
           MOBILE STYLES (< 768px)
           ============================================ */

        @media (max-width: 767px) {
          .admin-sidebar {
            transform: translateX(-100%);
            width: 280px;
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

          /* When sidebar is open on mobile, show all content */
          .admin-sidebar.collapsed .brand-info,
          .admin-sidebar.collapsed .profile-details,
          .admin-sidebar.collapsed .menu-text,
          .admin-sidebar.collapsed .status-label,
          .admin-sidebar.collapsed .version-info span,
          .admin-sidebar.collapsed .footer-divider {
            opacity: 1;
            visibility: visible;
            width: auto;
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

          /* Adjust menu items for touch */
          .menu-link {
            padding: 12px 14px;
          }

          .menu-icon {
            width: 40px;
            height: 40px;
          }

          .menu-label {
            font-size: 14px;
          }
        }

        /* ============================================
           TABLET STYLES (768px - 1023px)
           ============================================ */

        @media (min-width: 768px) and (max-width: 1023px) {
          .admin-sidebar {
            width: 240px;
          }

          .admin-sidebar.collapsed {
            width: 70px;
          }

          .sidebar-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .admin-sidebar:not(.collapsed) .brand-title {
            font-size: 14px;
          }

          .admin-sidebar:not(.collapsed) .profile-name {
            font-size: 13px;
          }

          .admin-sidebar:not(.collapsed) .menu-label {
            font-size: 12px;
          }

          .admin-sidebar:not(.collapsed) .menu-description {
            font-size: 9px;
          }

          /* Adjust collapsed state on tablet */
          .admin-sidebar.collapsed .brand-info,
          .admin-sidebar.collapsed .profile-details,
          .admin-sidebar.collapsed .menu-text,
          .admin-sidebar.collapsed .status-label,
          .admin-sidebar.collapsed .version-info span {
            opacity: 0;
            visibility: hidden;
          }

          .admin-sidebar.collapsed .brand-section {
            justify-content: center;
            padding: 24px;
          }

          .admin-sidebar.collapsed .profile-section {
            justify-content: center;
          }

          .admin-sidebar.collapsed .menu-link {
            justify-content: center;
          }

          /* Touch-friendly tap targets */
          .menu-link {
            min-height: 44px;
          }
        }

        /* ============================================
           DESKTOP STYLES (>= 1024px)
           ============================================ */

        @media (min-width: 1024px) {
          .admin-sidebar:not(.collapsed):hover {
            width: 280px;
          }

          /* Smooth transitions on hover */
          .admin-sidebar:not(.collapsed):hover .brand-info,
          .admin-sidebar:not(.collapsed):hover .profile-details,
          .admin-sidebar:not(.collapsed):hover .menu-text {
            opacity: 1;
            visibility: visible;
          }
        }

        /* ============================================
           ANIMATIONS
           ============================================ */

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

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* ============================================
           ACCESSIBILITY & UTILITIES
           ============================================ */

        /* Reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          .admin-sidebar,
          .sidebar-toggle,
          .menu-link,
          .collapse-toggle {
            transition: none;
          }
          
          .status-dot {
            animation: none;
          }
        }

        /* Focus styles for accessibility */
        .menu-link:focus-visible {
          outline: 2px solid #4f46e5;
          outline-offset: 2px;
        }

        .sidebar-toggle:focus-visible,
        .collapse-toggle:focus-visible {
          outline: 2px solid white;
          outline-offset: 2px;
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .admin-sidebar {
            background: #000;
          }
          
          .brand-logo {
            background: #fff;
          }
          
          .brand-logo i {
            color: #000;
          }
          
          .menu-icon {
            border: 1px solid currentColor;
          }
        }
      `}</style>
    </>
  )
}