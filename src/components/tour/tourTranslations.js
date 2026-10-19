// Multilingual translations for SmartFarmer Web Admin Panel Tour (All 9 Modules)
// Languages supported: English (en), Sinhala (si), Tamil (ta)

export const tourTranslations = {
  en: {
    // UI Controls
    next: 'Next',
    back: 'Back',
    skipFeature: 'Skip Feature',
    skipTour: 'Skip Tour',
    finish: 'Finish Tour',
    restartTour: 'Restart Tour',
    interactiveTour: 'Interactive Tour',
    language: 'Language',
    stepCount: 'Step {current} of {total}',
    moduleCount: 'Module {current} of {total}',
    safeModeBadge: '🔒 Safe Mode Demonstration',
    roleTag: 'Role: {role}',
    welcomeTitle: 'Welcome to SmartFarmer Web Admin!',
    welcomeDesc: 'Let us take you on an interactive feature tour customized for your role ({role}). This guided tour will show you all 9 administrative modules, tools, and workflows across the entire platform.',
    startTourBtn: 'Start Interactive Tour',
    maybeLaterBtn: 'Dismiss / Later',
    completedTitle: 'Tour Completed!',
    completedDesc: 'You have explored all 9 administrative modules available for your role ({role}). You can restart this tour anytime from the profile menu or settings.',
    gotItBtn: 'Got it, let\'s begin!',

    // Modules
    modules: {
      header: 'Header & Overview',
      sidebar: 'Navigation Menu',
      dashboard: 'Admin Dashboard',
      users: 'User Management',
      posts: 'Content Moderation',
      analytics: 'Analytics & Platform Reports',
      security: 'Security & System',
      barter: 'Barter System',
      advertisements: 'Advertisements Manager',
      settings: 'System Settings',
      logs: 'Activity Logs',
      profile: 'Admin Profile'
    },

    // Step Content
    steps: {
      // Header steps
      headerTitle: {
        title: 'Dashboard Header & Time Counter',
        description: 'The header displays the current active section title along with real-time system clock and date. It gives you instant context on where you are in the portal.'
      },
      headerSecurity: {
        title: 'Security Connection Status',
        description: 'Indicates that your admin session is encrypted and protected with active SSL and real-time security monitoring.'
      },
      headerNotifications: {
        title: 'Real-Time Notification Bell',
        description: 'Click here to inspect incoming system activity, security alerts, content moderation flags, and new user registrations in real time.'
      },
      headerTourBtn: {
        title: 'Interactive Feature Tour Button',
        description: 'You can click this compass button anytime to restart or re-take this guided walkthrough whenever you need a refresher.'
      },
      headerProfile: {
        title: 'Admin Profile & Role Badge',
        description: 'Click your profile avatar to view your current role permissions, access account settings, activity logs, or log out securely.'
      },

      // Sidebar steps
      sidebarBrand: {
        title: 'SmartFarmer Brand & Administration Portal',
        description: 'This is the main brand header. Clicking the logo or title takes you back to your primary administrative dashboard.'
      },
      sidebarProfile: {
        title: 'Your Admin Role Credentials',
        description: 'Displays your logged-in administrator name, email, and exact role level (e.g. Super Admin, Content Admin, Security Admin, or Support Admin).'
      },
      sidebarNav: {
        title: 'Role-Based Navigation Menu (All 9 Modules)',
        description: 'Every menu item here covers the 9 core modules dynamically filtered based on your administrator role and permissions.'
      },

      // Dashboard steps
      dashboardWelcome: {
        title: 'Welcome Banner & System Overview',
        description: 'Provides a greeting tailored to the time of day, system refresh controls, and quick system status indicators.'
      },
      dashboardStats: {
        title: 'Key Platform Metrics',
        description: 'Real-time counters showing total registered users, farmers, vendors, active posts, barter trades, and advertisement campaigns.'
      },
      dashboardOnline: {
        title: 'Real-Time Heartbeat & Online Active Admins',
        description: 'Monitors online active administrators and users currently browsing or operating on the platform.'
      },
      dashboardCharts: {
        title: 'Platform Analytics & Growth Trends',
        description: 'Interactive graphical charts displaying user registration growth, weekly activity breakdown, and post engagement levels over time.'
      },
      dashboardRecentUsers: {
        title: 'Recent Registrations & Quick User Inspection',
        description: 'Provides quick access to newly registered users, verification statuses, and direct links to inspect user profiles.'
      },
      dashboardRecentPosts: {
        title: 'Recent Community Posts & Content Feed',
        description: 'View recently created marketplace posts, farmer discussions, and content submissions awaiting moderation review.'
      },

      // User Management steps
      usersHeader: {
        title: 'User Management Center',
        description: 'Central hub for reviewing, managing, creating, editing, and monitoring all administrator and mobile user accounts.'
      },
      usersCreateBtn: {
        title: 'Create New Administrator / User Account',
        description: 'Click here to add a new administrator user, assign custom role permissions, and send credentials.',
        safeDemo: 'Safe Demonstration: Clicking this takes you to the user creation form. No user will be created during this preview step.'
      },
      usersSearchFilter: {
        title: 'Search & Role/Status Filtering',
        description: 'Search users by full name or email, and filter by specific roles or account status (Active vs. Inactive).'
      },
      usersTable: {
        title: 'Administrator & User List Table',
        description: 'Displays detailed user records, including role badges, email verification badges, creation timestamps, and active status indicators.'
      },
      usersActions: {
        title: 'User Operations (View, Edit, Ban, Delete)',
        description: 'Use action buttons to view user details, modify account permissions, toggle account suspension/ban status, or delete accounts.',
        safeDemo: 'Safe Demonstration: Action buttons like Delete or Suspension prompt for multi-step confirmation before executing. No production data will be changed.'
      },

      // Content Moderation steps
      postsHeader: {
        title: 'Content Moderation Center',
        description: 'Review user posts, marketplace listings, agricultural questions, and reported community content to maintain platform safety.'
      },
      postsTabs: {
        title: 'Content Moderation Status Tabs',
        description: 'Switch between All Posts, Pending Moderation, Approved, Rejected, and Flagged Content reported by users.'
      },
      postsGrid: {
        title: 'Post Items & Report Details',
        description: 'Inspect post images, text, author info, category, location, and reason for user flags or moderation holds.'
      },
      postsModerateAction: {
        title: 'Approve, Reject & Moderate Content',
        description: 'Approve compliant posts to make them visible, reject posts violating guidelines, or remove spam content cleanly.',
        safeDemo: 'Safe Demonstration: Moderation decisions trigger status updates in the database. During this tour, clicking moderation controls is purely for demonstration.'
      },

      // Analytics steps
      analyticsHeader: {
        title: 'Platform Analytics & Business Intelligence',
        description: 'Deep insights into user activity, regional farmer engagement, trade statistics, and system usage metrics.'
      },
      analyticsOverview: {
        title: 'Summary Performance Cards',
        description: 'Overview of user retention rates, content creation velocity, trade success rates, and active daily sessions.'
      },
      analyticsCharts: {
        title: 'Interactive Data Visualizations',
        description: 'Comprehensive charts showing trends over days, weeks, or months to help guide administrative and business decisions.'
      },

      // Security steps
      securityHeader: {
        title: 'Security Control & Threat Monitoring',
        description: 'Monitor active administrator sessions, IP lookup data, failed login attempts, and platform security events.'
      },
      securityAlerts: {
        title: 'Real-Time Security Alerts & Anomaly Detection',
        description: 'Highlights suspicious login attempts, unauthorized permission requests, or unusual activity patterns.'
      },
      securitySessions: {
        title: 'Active Administrator Sessions',
        description: 'View active logged-in admin devices, IP addresses, location data, and enforce remote session termination if necessary.'
      },
      securityLogsLink: {
        title: 'System Activity Logs Navigation',
        description: 'Access complete audit trails of all administrative actions, system modifications, user deletions, and config changes.'
      },

      // Barter steps
      barterHeader: {
        title: 'Barter System Management',
        description: 'Oversee crop and equipment trade transactions between registered farmers and agricultural vendors.'
      },
      barterList: {
        title: 'Active Barter Trade Listings',
        description: 'View items listed for exchange, trade value estimates, locations, and negotiation statuses.'
      },
      barterActions: {
        title: 'Barter Trade Resolution & Moderation',
        description: 'Resolve trade disputes, approve high-value exchanges, or flag invalid trade items.',
        safeDemo: 'Safe Demonstration: Trade status updates notify affected farmers. No trade statuses are altered during this tour.'
      },

      // Advertisements steps
      adsHeader: {
        title: 'Advertisements & Promotions Manager',
        description: 'Manage sponsor banners, agricultural product promotions, vendor ads, and campaign budgets.'
      },
      adsCampaigns: {
        title: 'Active Ad Campaigns & Metrics',
        description: 'Track ad impressions, click-through rates (CTR), campaign placement locations, and duration timelines.'
      },
      adsCreate: {
        title: 'Create & Publish New Advertisement',
        description: 'Upload banner graphics, target farmer demographic groups, set campaign schedules, and publish promotional ads.',
        safeDemo: 'Safe Demonstration: Creating campaigns publishes ads live to mobile users. Demo mode ensures no live ad is published.'
      },

      // Settings steps
      settingsHeader: {
        title: 'System Configuration & Preferences',
        description: 'Configure platform settings, language options, email templates, security protocols, and operational limits.'
      },
      settingsGeneral: {
        title: 'Language & General System Preferences',
        description: 'Set default platform languages (English, Sinhala, Tamil), pagination sizes, and portal preferences.'
      },
      settingsSecurity: {
        title: 'Security Requirements & Verification Controls',
        description: 'Enable email verification enforcement, password complexity rules, and session timeout parameters.'
      },
      settingsTourRestart: {
        title: 'Restart Interactive Onboarding Tour',
        description: 'Click here anytime to re-trigger this role-specific interactive tour for yourself or after role changes.'
      },

      // Activity Logs steps
      logsHeader: {
        title: 'Activity Logs & System Audit Center',
        description: 'Track and monitor all administrative actions, system events, login records, and security logs in real-time.'
      },
      logsStats: {
        title: 'Activity Statistics & Metrics',
        description: 'Summary cards displaying total system activities, unique IP addresses, 24-hour logs, and most active administrators.'
      },
      logsFilters: {
        title: 'Advanced Search & Date Range Filters',
        description: 'Filter logs by activity type, search by admin name or IP address, and select specific date ranges (Today, Last 7 Days, Last 30 Days).'
      },
      logsTable: {
        title: 'Detailed Audit Trail Table',
        description: 'Chronological record of system activities with timestamps, admin details, activity badges, and an inspection modal for full event payloads.'
      },

      // Profile steps
      profileCard: {
        title: 'Admin Profile Information',
        description: 'View your personal profile details, registered admin email, profile picture, and role level.'
      },
      profileEdit: {
        title: 'Update Profile & Change Password',
        description: 'Update your display name, upload a profile photo, or securely change your admin account password.'
      },
      profileTourRestart: {
        title: 'Take Tour Again',
        description: 'Restart the feature tour whenever you want to explore administrative tools and workflow guides again.'
      }
    }
  },

  si: {
    // UI Controls in Sinhala
    next: 'ඊළඟ (Next)',
    back: 'පසුපසට (Back)',
    skipFeature: 'මෙම විශේෂාංගය මඟහරින්න',
    skipTour: 'සංචාරය මඟහරින්න',
    finish: 'අවසන් කරන්න',
    restartTour: 'නැවත ආරම්භ කරන්න',
    interactiveTour: 'අන්තර්ක්‍රියාකාරී සංචාරය',
    language: 'භාෂාව (Language)',
    stepCount: 'පියවර {current} / {total}',
    moduleCount: 'මොඩියුලය {current} / {total}',
    safeModeBadge: '🔒 ආරක්ෂිත ආදර්ශන මාදිලිය',
    roleTag: 'භූමිකාව: {role}',
    welcomeTitle: 'SmartFarmer පරිපාලක පද්ධතියට සාදරයෙන් පිළිගනිමු!',
    welcomeDesc: 'ඔබේ පරිපාලක භූමිකාවට ({role}) අනුකූලව සකස් කරන ලද අන්තර්ක්‍රියාකාරී විශේෂාංග සංචාරය ආරම්භ කරමු. මෙමගින් සියලුම මොඩියුල 9 සහ මෙවලම් පහසුවෙන් තේරුම් ගත හැක.',
    startTourBtn: 'සංචාරය ආරම්භ කරන්න',
    maybeLaterBtn: 'පසුව බලන්න',
    completedTitle: 'සංචාරය සාර්ථකව අවසන් විය!',
    completedDesc: 'ඔබගේ පරිපාලක භූමිකාවට ({role}) අදාළ මොඩියුල 9 හි සියලුම විශේෂාංග ඔබ අධ්‍යයනය කර ඇත.',
    gotItBtn: 'තේරුණා, ආරම්භ කරමු!',

    modules: {
      header: 'ශීර්ෂය සහ දළ විශ්ලේෂණය',
      sidebar: 'ප්‍රධාන මෙනුව',
      dashboard: 'පරිපාලක පුවරුව (Dashboard)',
      users: 'පරිශීලක කළමනාකරණය',
      posts: 'අන්තර්ගත සමාලෝචනය',
      analytics: 'විශ්ලේෂණ සහ වාර්තා',
      security: 'ආරක්ෂාව සහ පද්ධතිය',
      barter: 'හුවමාරු පද්ධතිය (Barter)',
      advertisements: 'දැන්වීම් කළමනාකරණය',
      settings: 'පද්ධති සැකසුම්',
      logs: 'ක්‍රියාකාරකම් ලොග් (Activity Logs)',
      profile: 'පරිපාලක ගිණුම'
    },

    steps: {
      headerTitle: { title: 'ශීර්ෂය සහ වේලාව', description: 'දැනට ඔබ සිටින අංශයේ නම සහ පද්ධති වේලාව මෙහි සජීවීව දර්ශනය වේ.' },
      headerSecurity: { title: 'ආරක්ෂිත සම්බන්ධතා තත්ත්වය', description: 'ඔබගේ පරිපාලක සැසිය SSL ආරක්ෂණයෙන් ආරක්ෂිත බව පෙන්වයි.' },
      headerNotifications: { title: 'සජීවී නිවේදන', description: 'පද්ධති ක්‍රියාකාරකම් සහ ආරක්ෂක අනතුරු ඇඟවීම් මෙතැනින් පරීක්ෂා කළ හැක.' },
      headerTourBtn: { title: 'සංචාරක බොත්තම', description: 'මෙම මාර්ගෝපදේශ සංචාරය නැවත ආරම්භ කිරීමට මෙම බොත්තම ක්ලික් කරන්න.' },
      headerProfile: { title: 'පරිපාලක ගිණුම', description: 'ඔබගේ ගිණුම් තොරතුරු සහ Logout විකල්ප ලබා ගැනීමට මෙතැන ක්ලික් කරන්න.' },

      sidebarBrand: { title: 'SmartFarmer පරිපාලක පෝටලය', description: 'ලාංඡනය ක්ලික් කිරීමෙන් ඔබගේ ප්‍රධාන Dashboard එකට පිවිසිය හැක.' },
      sidebarProfile: { title: 'ඔබගේ පරිපාලක ශ්‍රේණිය', description: 'ඔබගේ නම, විද්‍යුත් තැපෑල සහ පරිපාලක මට්ටම මෙහි දැක්වේ.' },
      sidebarNav: { title: 'මෙනු මොඩියුල 9', description: 'පද්ධතියේ ප්‍රධාන මොඩියුල 9 සඳහා ප්‍රවේශ වන මෙනුවයි.' },

      dashboardWelcome: { title: 'සාදරයෙන් පිළිගැනීමේ පුවරුව', description: 'දිනයේ වේලාවට අනුව පිළිගැනීමේ පණිවිඩය.' },
      dashboardStats: { title: 'ප්‍රධාන සංඛ්‍යාලේඛන', description: 'ලියාපදිංචි පරිශීලකයින්, ගොවීන්, වෙළෙන්දන් සහ සක්‍රීය සටහන්.' },
      dashboardOnline: { title: 'සජීවී පරිපාලකයින්', description: 'දැනට පද්ධතියේ සක්‍රීයව පසුවන පරිපාලකයින් නිරීක්ෂණය කරයි.' },
      dashboardCharts: { title: 'වර්ධන ප්‍රස්ථාර', description: 'පරිශීලක වර්ධනය සහ සතිපතා ක්‍රියාකාරකම් ප්‍රස්ථාර.' },
      dashboardRecentUsers: { title: 'නව ලියාපදිංචි කිරීම්', description: 'නවතමයෙන් එකතු වූ පරිශීලකයින්ගේ තොරතුරු.' },
      dashboardRecentPosts: { title: 'මෑතකාලීන ප්‍රජා සටහන්', description: 'ගොවීන් විසින් එකතු කරන ලද නවතම සටහන්.' },

      usersHeader: { title: 'පරිශීලක කළමනාකරණය', description: 'පරිපාලකයින් සහ පරිශීලකයින් කළමනාකරණය කිරීමේ මධ්‍යස්ථානය.' },
      usersCreateBtn: { title: 'නව පරිපාලක ගිණුමක් සෑදීම', description: 'නව පරිපාලකයෙකු එකතු කර අදාළ බලතල පවරන්න.', safeDemo: 'ආරක්ෂිත ආදර්ශනය: කිසිදු දත්තයක් වෙනස් නොවේ.' },
      usersSearchFilter: { title: 'සෙවීම සහ පෙරා වෙන් කිරීම', description: 'නම හෝ Email මගින් පරිශීලකයින් සෙවීම.' },
      usersTable: { title: 'පරිශීලක ලැයිස්තුව', description: 'පරිශීලකයින්ගේ භූමිකාව සහ තත්ත්වය අඩංගු වගුව.' },
      usersActions: { title: 'ක්‍රියාකාරකම්', description: 'ගිණුම් තොරතුරු බැලීම, වෙනස් කිරීම් කිරීම හෝ ඉවත් කිරීම.', safeDemo: 'ආරක්ෂිත ආදර්ශනය: නිෂ්පාදන දත්ත වෙනස් නොවේ.' },

      postsHeader: { title: 'අන්තර්ගත සමාලෝචනය', description: 'පරිශීලක සටහන් සහ වාර්තා වූ අන්තර්ගතයන් පරීක්ෂා කිරීම.' },
      postsTabs: { title: 'අන්තර්ගත තත්ත්ව වර්ගීකරණය', description: 'බලපොරොත්තුවෙන් පවතින සහ අනුමත වූ සටහන්.' },
      postsGrid: { title: 'සටහන් විස්තර', description: 'ඡායාරූප, විස්තර සහ වාර්තා වීමට හේතු පරීක්ෂා කරන්න.' },
      postsModerateAction: { title: 'අනුමත කිරීම සහ ඉවත් කිරීම', description: 'සුදුසු සටහන් අනුමත කිරීම සහ නීති උල්ලංඝනය කරන සටහන් ඉවත් කිරීම.', safeDemo: 'ආරක්ෂිත ආදර්ශනය: දත්ත වෙනස් නොවේ.' },

      analyticsHeader: { title: 'පද්ධති විශ්ලේෂණ', description: 'පරිශීලක ක්‍රියාකාරකම් සහ හුවමාරු දත්ත විශ්ලේෂණය.' },
      analyticsOverview: { title: 'කාර්යසාධන දර්ශක', description: 'දෛනික භාවිතය සහ හුවමාරු සංඛ්‍යාලේඛන.' },
      analyticsCharts: { title: 'දත්ත ප්‍රස්ථාර', description: 'दीර්ඝකාලීන වර්ධන ප්‍රස්ථාර.' },

      securityHeader: { title: 'ආරක්ෂක පාලනය', description: 'සක්‍රීය පරිපාලක සැසි සහ ආරක්ෂක පද්ධති නිරීක්ෂණය.' },
      securityAlerts: { title: 'ආරක්ෂක අනතුරු ඇඟවීම්', description: 'සැක සහිත ක්‍රියාකාරකම් පිළිබඳ අනතුරු ඇඟවීම්.' },
      securitySessions: { title: 'සක්‍රීය පරිපාලක සැසි', description: 'සක්‍රීය පරිපාලක උපකරණ නිරීක්ෂණය.' },
      securityLogsLink: { title: 'ක්‍රියාකාරකම් ලොග් වෙත පිවිසීම', description: 'සම්පූර්ණ පද්ධති ක්‍රියාකාරකම් ලොග් වෙත යාම.' },

      barterHeader: { title: 'ගොවි හුවමාරු කළමනාකරණය', description: 'බෝග සහ උපකරණ හුවමාරු නිරීක්ෂණය.' },
      barterList: { title: 'සක්‍රීය හුවමාරු ලැයිස්තුව', description: 'හුවමාරුව සඳහා ඉදිරිපත් කර ඇති භාණ්ඩ.' },
      barterActions: { title: 'හුවමාරු ආරවුල් විසඳීම', description: 'හුවමාරු ගැටලු විසඳීම.', safeDemo: 'ආරක්ෂිත ආදර්ශනය: දත්ත වෙනස් නොවේ.' },

      adsHeader: { title: 'දැන්වීම් කළමනාකරණය', description: 'ව්‍යාපාරික දැන්වීම් සහ ප්‍රචාරණ කළමනාකරණය.' },
      adsCampaigns: { title: 'සක්‍රීය දැන්වීම්', description: 'දැන්වීම් නැරඹුම් සහ ක්ලික් කිරීම් නිරීක්ෂණය.' },
      adsCreate: { title: 'නව දැන්වීමක් පළ කිරීම', description: 'නව ප්‍රචාරණ දැන්වීම් සෑදීම.', safeDemo: 'ආරක්ෂිත ආදර්ශනය: දත්ත වෙනස් නොවේ.' },

      settingsHeader: { title: 'පද්ධති සැකසුම්', description: 'භාෂා සැකසුම් සහ පද්ධති සීමාවන් සකස් කිරීම.' },
      settingsGeneral: { title: 'භාෂාව සහ සාමාන්‍ය සැකසුම්', description: 'පද්ධතියේ ප්‍රධාන භාෂාව තෝරාගැනීම.' },
      settingsSecurity: { title: 'ආරක්ෂක සැකසුම්', description: 'Email තහවුරු කිරීම සහ මුරපද රීති.' },
      settingsTourRestart: { title: 'සංචාරය නැවත ආරම්භ කිරීම', description: 'සංචාරය නැවත ලබාගැනීමට මෙතැන ක්ලික් කරන්න.' },

      logsHeader: { title: 'ක්‍රියාකාරකම් ලොග් මධ්‍යස්ථානය', description: 'සියලුම පරිපාලක ක්‍රියාකාරකම් සහ සිදුවීම් ලොග් නිරීක්ෂණය කරන්න.' },
      logsStats: { title: 'ලොග් සංඛ්‍යාලේඛන', description: 'මුළු ක්‍රියාකාරකම්, IP ලිපින සහ පැය 24 ලොග් සාරාංශය.' },
      logsFilters: { title: 'උසස් සෙවීම සහ පෙරහන්', description: 'ක්‍රියාකාරකම් වර්ගය, නම හෝ IP මගින් ලොග් සෙවීම.' },
      logsTable: { title: 'විගණන ලැයිස්තු වගුව', description: 'වේලාව, පරිපාලක සහ ක්‍රියාකාරකම් විස්තර සහිත ලොග් වගුව.' },

      profileCard: { title: 'පරිපාලක ගිණුම් විස්තර', description: 'ඔබගේ පෞද්ගලික තොරතුරු.' },
      profileEdit: { title: 'ගිණුම යාවත්කාලීන කිරීම', description: 'ඔබගේ නම සහ මුරපදය වෙනස් කිරීම.' },
      profileTourRestart: { title: 'සංචාරය නැවත ලබාගන්න', description: 'විශේෂාංග නැවත අධ්‍යයනය කරන්න.' }
    }
  },

  ta: {
    // UI Controls in Tamil
    next: 'அடுத்து (Next)',
    back: 'பின்னால் (Back)',
    skipFeature: 'இந்த அம்சத்தைத் தவிர்க்கவும்',
    skipTour: 'சுற்றுலாவைத் தவிர்க்கவும்',
    finish: 'முடிக்கவும்',
    restartTour: 'மீண்டும் தொடங்கவும்',
    interactiveTour: 'ஊடாடும் சுற்றுலா',
    language: 'மொழி (Language)',
    stepCount: 'படி {current} / {total}',
    moduleCount: 'தொகுதி {current} / {total}',
    safeModeBadge: '🔒 பாதுகாப்பான மாதிரி முறைமை',
    roleTag: 'பங்கு: {role}',
    welcomeTitle: 'SmartFarmer நிர்வாக போர்ட்டலுக்கு வரவேற்கிறோம்!',
    welcomeDesc: 'உங்கள் நிர்வாகி பங்குக்கு ({role}) ஏற்ப அமைக்கப்பட்ட ஊடாடும் அம்ச சுற்றுலாவைத் தொடங்குவோம். இது அனைத்து 9 தொகுதிகளையும் கருவிகளையும் எளிதாகப் புரிந்து கொள்ள உதவும்.',
    startTourBtn: 'சுற்றுலாவைத் தொடங்குங்கள்',
    maybeLaterBtn: 'பின்னர் பார்க்கவும்',
    completedTitle: 'சுற்றுலா வெற்றிகரமாக முடிந்தது!',
    completedDesc: 'உங்கள் நிர்வாகி பங்குக்கு உரிய அனைத்து 9 தொகுதிகளையும் நீங்கள் வெற்றிகரமாக ஆய்வு செய்துள்ளீர்கள்.',
    gotItBtn: 'புரிந்தது, தொடங்குவோம்!',

    modules: {
      header: 'தலைப்பு மற்றும் மேலோட்டம்',
      sidebar: 'முதன்மை மெனு',
      dashboard: 'நிர்வாக பலகை (Dashboard)',
      users: 'பயனர் மேலாண்மை',
      posts: 'உள்ளடக்க மதிப்பாய்வு',
      analytics: 'பகுப்பாய்வு மற்றும் அறிக்கைகள்',
      security: 'பாதுகாப்பு மற்றும் அமைப்பு',
      barter: 'பண்டமாற்று முறைமை (Barter)',
      advertisements: 'விளம்பர மேலாண்மை',
      settings: 'அமைப்புகள்',
      logs: 'செயல்பாட்டு பதிவுகள் (Activity Logs)',
      profile: 'நிர்வாகி சுயவிவரம்'
    },

    steps: {
      headerTitle: { title: 'தலைப்பு மற்றும் நேரக் காட்டி', description: 'தற்போதைய பகுதி தலைப்பு மற்றும் நேரடி அமைப்பு நேரம் இங்கு காட்டப்படும்.' },
      headerSecurity: { title: 'பாதுகாப்பான இணைப்பு நிலை', description: 'உங்கள் நிர்வாக அமர்வு SSL பாதுகாப்பால் பாதுகாக்கப்படுகிறது.' },
      headerNotifications: { title: 'நேரடி அறிவிப்புகள்', description: 'அமைப்பின் நடவடிக்கைகள் மற்றும் பாதுகாப்பு எச்சரிக்கைகள்.' },
      headerTourBtn: { title: 'சுற்றுலா பொத்தான்', description: 'இந்த வழிகாட்டி சுற்றுலாவை மீண்டும் தொடங்க பொத்தானைக் கிளிக் செய்யவும்.' },
      headerProfile: { title: 'நிர்வாகி சுயவிவரம்', description: 'உங்கள் கணக்கு விவரங்கள் மற்றும் வெளியேறும் விருப்பங்கள்.' },

      sidebarBrand: { title: 'SmartFarmer நிர்வாக போர்ட்டல்', description: 'முதன்மை சின்னம் மூலம் டாஷ்போர்டிற்குச் செல்லலாம்.' },
      sidebarProfile: { title: 'உங்கள் நிர்வாக நிலை', description: 'உங்கள் பெயர், மின்னஞ்சல் மற்றும் நிர்வாக நிலை.' },
      sidebarNav: { title: '9 முதன்மை தொகுதிகள் மெனு', description: 'அனைத்து 9 தொகுதிகளையும் அணுகும் மெனு.' },

      dashboardWelcome: { title: 'வரவேற்பு பலகை', description: 'நேரத்திற்கு ஏற்ற வாழ்த்து மற்றும் அமைப்பு நிலை.' },
      dashboardStats: { title: 'முக்கிய புள்ளிவிவரங்கள்', description: 'பதிவுசெய்த பயனர்கள் மற்றும் விவசாயிகளின் நேரடி எண்ணிக்கை.' },
      dashboardOnline: { title: 'நேரடி ஆன்லைன் நிர்வாகிகள்', description: 'தற்போது அமைப்பில் உள்ள ஆன்லைன் நிர்வாகிகளைக் கண்காணிக்கும்.' },
      dashboardCharts: { title: 'வளர்ச்சி வரைபடங்கள்', description: 'பயனர் வளர்ச்சி மற்றும் வாராந்திர செயல்பாடுகளின் வரைபடங்கள்.' },
      dashboardRecentUsers: { title: 'புதிய பதிவுகள்', description: 'சமீபத்தில் இணைந்த பயனர்களின் விவரங்கள்.' },
      dashboardRecentPosts: { title: 'சமீபத்திய இடுகைகள்', description: 'விவசாயிகளால் சேர்க்கப்பட்ட புதிய உள்ளடக்கங்கள்.' },

      usersHeader: { title: 'பயனர் மேலாண்மை மையம்', description: 'நிர்வாகிகளையும் பயனர் கணக்குகளையும் நிர்வகிக்கும் மையம்.' },
      usersCreateBtn: { title: 'புதிய நிர்வாகி கணக்கை உருவாக்குதல்', description: 'புதிய நிர்வாகியைச் சேர்த்து அதிகாரங்களை வழங்கவும்.', safeDemo: 'பாதுகாப்பான மாதிரி: தரவு மாற்றப்படாது.' },
      usersSearchFilter: { title: 'தேடல் மற்றும் வடிகட்டி', description: 'பெயர் அல்லது மின்னஞ்சல் மூலம் பயனர்களைத் தேடலாம்.' },
      usersTable: { title: 'பயனர் பட்டியல்', description: 'பயனர்களின் நிலை மற்றும் பதிவு தேதிகள் அடங்கிய பட்டியல்.' },
      usersActions: { title: 'செயல்பாடுகள்', description: 'கணக்கு விவரங்களைப் பார்க்க மற்றும் திருத்த.', safeDemo: 'பாதுகாப்பான மாதிரி: தரவு மாற்றப்படாது.' },

      postsHeader: { title: 'உள்ளடக்க மதிப்பாய்வு மையம்', description: 'பயனர் இடுகைகள் மற்றும் புகார்களை மதிப்பாய்வு செய்தல்.' },
      postsTabs: { title: 'உள்ளடக்க நிலை வகைகள்', description: 'நிலுவையில் உள்ள மற்றும் அனுமதிக்கப்பட்ட இடுகைகள்.' },
      postsGrid: { title: 'இடுகை விவரங்கள்', description: 'படங்கள், விளக்கங்கள் மற்றும் புகார்களின் காரணங்கள்.' },
      postsModerateAction: { title: 'அனுமதித்தல் மற்றும் நீக்குதல்', description: 'சரியான இடுகைகளை அனுமதித்து விதியை மீறும் இடுகைகளை நீக்குங்கள்.', safeDemo: 'பாதுகாப்பான மாதிரி: தரவு மாற்றப்படாது.' },

      analyticsHeader: { title: 'பகுப்பாய்வு மற்றும் அறிக்கைகள்', description: 'பயனர் நடவடிக்கைகள் மற்றும் வர்த்தகப் புள்ளிவிவரங்கள்.' },
      analyticsOverview: { title: 'செயல்திறன் குறிகாட்டிகள்', description: 'தினசரி பயன்பாடு மற்றும் பரிமாற்றங்களின் புள்ளிவிவரங்கள்.' },
      analyticsCharts: { title: 'வரைபடங்கள்', description: 'நீண்டகால வளர்ச்சி வரைபடங்கள்.' },

      securityHeader: { title: 'பாதுகாப்பு மற்றும் கண்காணிப்பு', description: 'செயலில் உள்ள நிர்வாக அமர்வுகள் மற்றும் IP முகவரிகள்.' },
      securityAlerts: { title: 'பாதுகாப்பு எச்சரிக்கைகள்', description: 'சந்தேகத்திற்கிடமான நடவடிக்கைகள் குறித்த எச்சரிக்கைகள்.' },
      securitySessions: { title: 'செயலில் உள்ள அமர்வுகள்', description: 'செயலில் உள்ள நிர்வாக சாதனங்களைக் கண்காணித்தல்.' },
      securityLogsLink: { title: 'செயல்பாட்டு பதிவுகள் இணைப்பு', description: 'அமைப்பின் செயல்பாட்டு பதிவுகளுக்குச் செல்லுதல்.' },

      barterHeader: { title: 'பண்டமாற்று முறைமை மேலாண்மை', description: 'விவசாயிகளுக்கிடையேயான பரிமாற்றங்களைக் கண்காணித்தல்.' },
      barterList: { title: 'செயலில் உள்ள பரிமாற்றங்கள்', description: 'பரிமாற்றத்திற்கு சமர்ப்பிக்கப்பட்ட பொருட்கள்.' },
      barterActions: { title: 'சிக்கல்களைத் தீர்த்தல்', description: 'பரிமாற்றச் சிக்கல்களைத் தீர்க்க.', safeDemo: 'பாதுகாப்பான மாதிரி: தரவு மாற்றப்படாது.' },

      adsHeader: { title: 'விளம்பர மேலாண்மை', description: 'வணிக விளம்பரங்கள் மற்றும் விவசாய பிரச்சாரங்கள்.' },
      adsCampaigns: { title: 'செயலில் உள்ள விளம்பரங்கள்', description: 'விளம்பர பார்வைகள் மற்றும் கிளிக் எண்ணிக்கைகள்.' },
      adsCreate: { title: 'புதிய விளம்பரத்தை வெளியிடல்', description: 'புதிய விளம்பரங்களை உருவாக்குதல்.', safeDemo: 'பாதுகாப்பான மாதிரி: தரவு மாற்றப்படாது.' },

      settingsHeader: { title: 'அமைப்புகள்', description: 'மொழி அமைப்புகள் மற்றும் கட்டுப்பாடுகளை சரிசெய்தல்.' },
      settingsGeneral: { title: 'மொழி மற்றும் பொது அமைப்புகள்', description: 'அமைப்பின் முதன்மை மொழியைத் தேர்வு செய்யவும்.' },
      settingsSecurity: { title: 'பாதுகாப்பு அமைப்புகள்', description: 'மின்னஞ்சல் உறுதிப்படுத்தல் மற்றும் விதிகள்.' },
      settingsTourRestart: { title: 'சுற்றுலாவை மீண்டும் தொடங்குதல்', description: 'வ வழிகாட்டி சுற்றுலாவை மீண்டும் தொடங்க.' },

      logsHeader: { title: 'செயல்பாட்டு பதிவுகள் மையம்', description: 'அனைத்து நிர்வாக நடவடிக்கைகள் மற்றும் பதிவுகளைக் கண்காணிக்கவும்.' },
      logsStats: { title: 'பதிவு புள்ளிவிவரங்கள்', description: 'மொத்த செயல்பாடுகள் மற்றும் 24 மணிநேர பதிவுகள்.' },
      logsFilters: { title: 'தேடல் மற்றும் வடிகட்டிகள்', description: 'செயல்வகை அல்லது IP மூலம் பதிவுகளைத் தேடவும்.' },
      logsTable: { title: 'தணிக்கை பட்டியல் அட்டவணை', description: 'நேரம் மற்றும் நிர்வாகி விவரங்களைக் கொண்ட பதிவுகள்.' },

      profileCard: { title: 'நிர்வாகி சுயவிவர விவரங்கள்', description: 'உங்கள் தனிப்பட்ட விவரங்கள்.' },
      profileEdit: { title: 'கடவுச்சொல்லை மாற்றுதல்', description: 'உங்கள் பெயர் மற்றும் கடவுச்சொல்லை மாற்றவும்.' },
      profileTourRestart: { title: 'சுற்றுலாவை மீண்டும் பெறுக', description: 'நிர்வாக அம்சங்களை மீண்டும் கற்றுக்கொள்ளுங்கள்.' }
    }
  }
}
