// Master definition of all interactive tour steps
// Filtered dynamically based on user role and permissions

export const tourSteps = [
  // ==========================================
  // MODULE 1: HEADER & GLOBAL CONTROLS
  // ==========================================
  {
    id: 'header-title',
    module: 'header',
    targetSelector: '[data-tour="header-title"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'bottom',
    stepKey: 'headerTitle'
  },
  {
    id: 'header-security',
    module: 'header',
    targetSelector: '[data-tour="header-security"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'bottom',
    stepKey: 'headerSecurity'
  },
  {
    id: 'header-notifications',
    module: 'header',
    targetSelector: '[data-tour="header-notifications"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'bottom-end',
    stepKey: 'headerNotifications'
  },
  {
    id: 'header-tour-btn',
    module: 'header',
    targetSelector: '[data-tour="header-tour-btn"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'bottom-end',
    stepKey: 'headerTourBtn'
  },
  {
    id: 'header-profile',
    module: 'header',
    targetSelector: '[data-tour="header-profile"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'bottom-end',
    stepKey: 'headerProfile'
  },

  // ==========================================
  // MODULE 2: NAVIGATION SIDEBAR
  // ==========================================
  {
    id: 'sidebar-brand',
    module: 'sidebar',
    targetSelector: '[data-tour="sidebar-brand"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'right-start',
    stepKey: 'sidebarBrand'
  },
  {
    id: 'sidebar-profile',
    module: 'sidebar',
    targetSelector: '[data-tour="sidebar-profile"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'right-start',
    stepKey: 'sidebarProfile'
  },
  {
    id: 'sidebar-nav',
    module: 'sidebar',
    targetSelector: '[data-tour="sidebar-nav"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'right',
    stepKey: 'sidebarNav'
  },

  // ==========================================
  // MODULE 3: DASHBOARD PAGE
  // ==========================================
  {
    id: 'dashboard-welcome',
    module: 'dashboard',
    targetSelector: '[data-tour="dashboard-welcome"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'bottom',
    stepKey: 'dashboardWelcome'
  },
  {
    id: 'dashboard-stats',
    module: 'dashboard',
    targetSelector: '[data-tour="dashboard-stats"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'bottom',
    stepKey: 'dashboardStats'
  },
  {
    id: 'dashboard-online',
    module: 'dashboard',
    targetSelector: '[data-tour="dashboard-online"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'left',
    stepKey: 'dashboardOnline'
  },
  {
    id: 'dashboard-charts',
    module: 'dashboard',
    targetSelector: '[data-tour="dashboard-charts"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
    placement: 'top',
    stepKey: 'dashboardCharts'
  },
  {
    id: 'dashboard-recent-users',
    module: 'dashboard',
    targetSelector: '[data-tour="dashboard-recent-users"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'top',
    stepKey: 'dashboardRecentUsers'
  },
  {
    id: 'dashboard-recent-posts',
    module: 'dashboard',
    targetSelector: '[data-tour="dashboard-recent-posts"]',
    pageRoute: '/admin/dashboard',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
    placement: 'top',
    stepKey: 'dashboardRecentPosts'
  },

  // ==========================================
  // MODULE 4: USER MANAGEMENT PAGE
  // ==========================================
  {
    id: 'users-header',
    module: 'users',
    targetSelector: '[data-tour="users-header"]',
    pageRoute: '/admin/users',
    requiredRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'bottom',
    stepKey: 'usersHeader'
  },
  {
    id: 'users-create-btn',
    module: 'users',
    targetSelector: '[data-tour="users-create-btn"]',
    pageRoute: '/admin/users',
    requiredRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
    placement: 'left',
    hasSafeDemo: true,
    stepKey: 'usersCreateBtn'
  },
  {
    id: 'users-search-filter',
    module: 'users',
    targetSelector: '[data-tour="users-search-filter"]',
    pageRoute: '/admin/users',
    requiredRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'bottom',
    stepKey: 'usersSearchFilter'
  },
  {
    id: 'users-table',
    module: 'users',
    targetSelector: '[data-tour="users-table"]',
    pageRoute: '/admin/users',
    requiredRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'top',
    stepKey: 'usersTable'
  },
  {
    id: 'users-actions',
    module: 'users',
    targetSelector: '[data-tour="users-actions"]',
    pageRoute: '/admin/users',
    requiredRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'left',
    hasSafeDemo: true,
    stepKey: 'usersActions'
  },

  // ==========================================
  // MODULE 5: CONTENT MODERATION PAGE
  // ==========================================
  {
    id: 'posts-header',
    module: 'posts',
    targetSelector: '[data-tour="posts-header"]',
    pageRoute: '/admin/posts',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
    placement: 'bottom',
    stepKey: 'postsHeader'
  },
  {
    id: 'posts-tabs',
    module: 'posts',
    targetSelector: '[data-tour="posts-tabs"]',
    pageRoute: '/admin/posts',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
    placement: 'bottom',
    stepKey: 'postsTabs'
  },
  {
    id: 'posts-grid',
    module: 'posts',
    targetSelector: '[data-tour="posts-grid"]',
    pageRoute: '/admin/posts',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
    placement: 'top',
    stepKey: 'postsGrid'
  },
  {
    id: 'posts-moderate-action',
    module: 'posts',
    targetSelector: '[data-tour="posts-moderate-action"]',
    pageRoute: '/admin/posts',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
    placement: 'left',
    hasSafeDemo: true,
    stepKey: 'postsModerateAction'
  },

  // ==========================================
  // MODULE 6: ANALYTICS & REPORTS PAGE
  // ==========================================
  {
    id: 'analytics-header',
    module: 'analytics',
    targetSelector: '[data-tour="analytics-header"]',
    pageRoute: '/admin/analytics',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
    placement: 'bottom',
    stepKey: 'analyticsHeader'
  },
  {
    id: 'analytics-overview',
    module: 'analytics',
    targetSelector: '[data-tour="analytics-overview"]',
    pageRoute: '/admin/analytics',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
    placement: 'bottom',
    stepKey: 'analyticsOverview'
  },
  {
    id: 'analytics-charts',
    module: 'analytics',
    targetSelector: '[data-tour="analytics-charts"]',
    pageRoute: '/admin/analytics',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
    placement: 'top',
    stepKey: 'analyticsCharts'
  },

  // ==========================================
  // MODULE 7: SECURITY & SYSTEM LOGS PAGE
  // ==========================================
  {
    id: 'security-header',
    module: 'security',
    targetSelector: '[data-tour="security-header"]',
    pageRoute: '/admin/security',
    requiredRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
    placement: 'bottom',
    stepKey: 'securityHeader'
  },
  {
    id: 'security-alerts',
    module: 'security',
    targetSelector: '[data-tour="security-alerts"]',
    pageRoute: '/admin/security',
    requiredRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
    placement: 'bottom',
    stepKey: 'securityAlerts'
  },
  {
    id: 'security-sessions',
    module: 'security',
    targetSelector: '[data-tour="security-sessions"]',
    pageRoute: '/admin/security',
    requiredRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
    placement: 'top',
    stepKey: 'securitySessions'
  },
  {
    id: 'security-logs-link',
    module: 'security',
    targetSelector: '[data-tour="security-logs-link"]',
    pageRoute: '/admin/security',
    requiredRoles: ['SUPER_ADMIN', 'SECURITY_ADMIN'],
    placement: 'top',
    stepKey: 'securityLogsLink'
  },

  // ==========================================
  // MODULE 8: BARTER SYSTEM PAGE
  // ==========================================
  {
    id: 'barter-header',
    module: 'barter',
    targetSelector: '[data-tour="barter-header"]',
    pageRoute: '/admin/barter',
    requiredRoles: ['SUPER_ADMIN'],
    placement: 'bottom',
    stepKey: 'barterHeader'
  },
  {
    id: 'barter-list',
    module: 'barter',
    targetSelector: '[data-tour="barter-list"]',
    pageRoute: '/admin/barter',
    requiredRoles: ['SUPER_ADMIN'],
    placement: 'top',
    stepKey: 'barterList'
  },
  {
    id: 'barter-actions',
    module: 'barter',
    targetSelector: '[data-tour="barter-actions"]',
    pageRoute: '/admin/barter',
    requiredRoles: ['SUPER_ADMIN'],
    placement: 'left',
    hasSafeDemo: true,
    stepKey: 'barterActions'
  },

  // ==========================================
  // MODULE 9: ADVERTISEMENTS PAGE
  // ==========================================
  {
    id: 'ads-header',
    module: 'advertisements',
    targetSelector: '[data-tour="ads-header"]',
    pageRoute: '/admin/advertisements',
    requiredRoles: ['SUPER_ADMIN'],
    placement: 'bottom',
    stepKey: 'adsHeader'
  },
  {
    id: 'ads-campaigns',
    module: 'advertisements',
    targetSelector: '[data-tour="ads-campaigns"]',
    pageRoute: '/admin/advertisements',
    requiredRoles: ['SUPER_ADMIN'],
    placement: 'top',
    stepKey: 'adsCampaigns'
  },
  {
    id: 'ads-create',
    module: 'advertisements',
    targetSelector: '[data-tour="ads-create"]',
    pageRoute: '/admin/advertisements',
    requiredRoles: ['SUPER_ADMIN'],
    placement: 'left',
    hasSafeDemo: true,
    stepKey: 'adsCreate'
  },

  // ==========================================
  // MODULE 10: SYSTEM SETTINGS PAGE
  // ==========================================
  {
    id: 'settings-header',
    module: 'settings',
    targetSelector: '[data-tour="settings-header"]',
    pageRoute: '/admin/settings',
    requiredRoles: ['SUPER_ADMIN'],
    placement: 'bottom',
    stepKey: 'settingsHeader'
  },
  {
    id: 'settings-general',
    module: 'settings',
    targetSelector: '[data-tour="settings-general"]',
    pageRoute: '/admin/settings',
    requiredRoles: ['SUPER_ADMIN'],
    placement: 'top',
    stepKey: 'settingsGeneral'
  },
  {
    id: 'settings-security',
    module: 'settings',
    targetSelector: '[data-tour="settings-security"]',
    pageRoute: '/admin/settings',
    requiredRoles: ['SUPER_ADMIN'],
    placement: 'top',
    stepKey: 'settingsSecurity'
  },
  {
    id: 'settings-tour-restart',
    module: 'settings',
    targetSelector: '[data-tour="settings-tour-restart"]',
    pageRoute: '/admin/settings',
    requiredRoles: ['SUPER_ADMIN'],
    placement: 'top',
    stepKey: 'settingsTourRestart'
  },

  // ==========================================
  // MODULE 11: ADMIN PROFILE PAGE
  // ==========================================
  {
    id: 'profile-card',
    module: 'profile',
    targetSelector: '[data-tour="profile-card"]',
    pageRoute: '/admin/profile',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'bottom',
    stepKey: 'profileCard'
  },
  {
    id: 'profile-edit',
    module: 'profile',
    targetSelector: '[data-tour="profile-edit"]',
    pageRoute: '/admin/profile',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'top',
    stepKey: 'profileEdit'
  },
  {
    id: 'profile-tour-restart',
    module: 'profile',
    targetSelector: '[data-tour="profile-tour-restart"]',
    pageRoute: '/admin/profile',
    requiredRoles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN'],
    placement: 'top',
    stepKey: 'profileTourRestart'
  }
]
