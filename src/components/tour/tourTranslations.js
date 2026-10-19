// Multilingual translations for SmartFarmer Web Admin Panel Tour
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
    welcomeDesc: 'Let us take you on an interactive feature tour customized for your role ({role}). This guided tour will show you all available tools, administrative workflows, and key features.',
    startTourBtn: 'Start Interactive Tour',
    maybeLaterBtn: 'Dismiss / Later',
    completedTitle: 'Tour Completed!',
    completedDesc: 'You have explored all the administrative features available for your role ({role}). You can restart this tour anytime from the profile menu or settings.',
    gotItBtn: 'Got it, let\'s begin!',

    // Modules
    modules: {
      header: 'Header & Overview',
      sidebar: 'Navigation Menu',
      dashboard: 'Admin Dashboard',
      users: 'User Management',
      posts: 'Content Moderation',
      analytics: 'Analytics & Platform Reports',
      security: 'Security & System Logs',
      barter: 'Barter System',
      advertisements: 'Advertisements Manager',
      settings: 'System Settings',
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
        title: 'Role-Based Navigation Menu',
        description: 'Every menu item here is dynamically filtered based on your administrator role and permissions. You only see tools you are authorized to manage.'
      },

      // Dashboard steps
      dashboardWelcome: {
        title: 'Welcome Banner & System Overview',
        description: 'Provides a greeting tailored to the time of day, system refresh controls, and quick system status indicators.'
      },
      dashboardStats: {
        title: 'Key Platform Metrics',
        description: 'Real-time counters showing total registered users, farmers, vendors, active posts, barter trades, and advertisement campaigns across the platform.'
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
        description: 'Click here to add a new administrator user, assign custom role permissions (Super Admin, Content Admin, Security Admin, Support Admin), and send credentials.',
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
        title: 'System Activity Logs',
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
    welcomeDesc: 'ඔබේ පරිපාලක භූමිකාවට ({role}) අනුකූලව සකස් කරන ලද අන්තර්ක්‍රියාකාරී විශේෂාංග සංචාරය ආරම්භ කරමු. මෙමගින් පද්ධතියේ සියලුම මෙවලම් සහ කාර්යයන් පහසුවෙන් තේරුම් ගත හැක.',
    startTourBtn: 'සංචාරය ආරම්භ කරන්න',
    maybeLaterBtn: 'පසුව බලන්න',
    completedTitle: 'සංචාරය සාර්ථකව අවසන් විය!',
    completedDesc: 'ඔබගේ පරිපාලක භූමිකාවට ({role}) අදාළ සියලුම විශේෂාංග ඔබ අධ්‍යයනය කර ඇත. අවශ්‍ය ඕනෑම අවස්ථාවක ඔබගේ Profile හෝ Settings වෙතින් මෙය නැවත ආරම්භ කළ හැක.',
    gotItBtn: 'තේරුණා, ආරම්භ කරමු!',

    modules: {
      header: 'ශීර්ෂය සහ දළ විශ්ලේෂණය',
      sidebar: 'ප්‍රධාන මෙනුව',
      dashboard: 'පරිපාලක පුවරුව (Dashboard)',
      users: 'පරිශීලක කළමනාකරණය',
      posts: 'අන්තර්ගත සමාලෝචනය',
      analytics: 'විශ්ලේෂණ සහ වාර්තා',
      security: 'ආරක්ෂාව සහ පද්ධති ලොග',
      barter: 'හුවමාරු පද්ධතිය (Barter)',
      advertisements: 'දැන්වීම් කළමනාකරණය',
      settings: 'පද්ධති සැකසුම්',
      profile: 'පරිපාලක ගිණුම'
    },

    steps: {
      headerTitle: {
        title: 'ශීර්ෂය සහ වේලාව',
        description: 'දැනට ඔබ සිටින අංශයේ නම සහ පද්ධති වේලාව මෙහි සජීවීව දර්ශනය වේ.'
      },
      headerSecurity: {
        title: 'ආරක්ෂිත සම්බන්ධතා තත්ත්වය',
        description: 'ඔබගේ පරිපාලක සැසිය SSL ආරක්ෂණයෙන් සහ සජීවී ආරක්ෂක නිරීක්ෂණයෙන් ආරක්ෂිත බව පෙන්වයි.'
      },
      headerNotifications: {
        title: 'සජීවී නිවේදන (Notifications)',
        description: 'පද්ධති ක්‍රියාකාරකම්, ආරක්ෂක අනතුරු ඇඟවීම් සහ අලුත් පරිශීලක ලියාපදිංචි කිරීම් මෙතැනින් පරීක්ෂා කළ හැක.'
      },
      headerTourBtn: {
        title: 'අන්තර්ක්‍රියාකාරී සංචාරක බොත්තම',
        description: 'ඔබට මෙම මාර්ගෝපදේශ සංචාරය නැවත ආරම්භ කිරීමට අවශ්‍ය ඕනෑම අවස්ථාවක මෙම මාර්ගමාපක බොත්තම ක්ලික් කරන්න.'
      },
      headerProfile: {
        title: 'පරිපාලක ගිණුම සහ භූමිකාව',
        description: 'ඔබගේ ගිණුම් තොරතුරු, භූමිකාවේ බලතල සහ Logout විකල්ප ලබා ගැනීමට මෙතැන ක්ලික් කරන්න.'
      },

      sidebarBrand: {
        title: 'SmartFarmer පරිපාලක පෝටලය',
        description: 'මෙය ප්‍රධාන වෙළඳනාම ශීර්ෂයයි. ලාංඡනය ක්ලික් කිරීමෙන් ඔබගේ ප්‍රධාන Dashboard එකට පිවිසිය හැක.'
      },
      sidebarProfile: {
        title: 'ඔබගේ පරිපාලක ශ්‍රේණිය',
        description: 'ඔබගේ නම, විද්‍යුත් තැපෑල සහ පරිපාලක මට්ටම (Super Admin, Content Admin, Security Admin, Support Admin) මෙහි දැක්වේ.'
      },
      sidebarNav: {
        title: 'භූමිකාව මත පදනම් වූ මෙනුව',
        description: 'ඔබගේ පරිපාලක භූමිකාවට අදාළ බලතල සහිත මෙවලම් පමණක් මෙම මෙනුවේ සක්‍රීයව දර්ශනය වේ.'
      },

      dashboardWelcome: {
        title: 'සාදරයෙන් පිළිගැනීමේ පුවරුව',
        description: 'දිනයේ වේලාවට අනුව පිළිගැනීමේ පණිවිඩය සහ පද්ධති තත්ත්ව වාර්තා මෙහි දැක්වේ.'
      },
      dashboardStats: {
        title: 'ප්‍රධාන පද්ධති සංඛ්‍යාලේඛන',
        description: 'ලියාපදිංචි පරිශීලකයින්, ගොවීන්, වෙළෙන්දන්, සක්‍රීය සටහන් සහ හුවමාරු පිළිබඳ සජීවී සංඛ්‍යා.'
      },
      dashboardOnline: {
        title: 'සජීවී පරිපාලකයින් සහ පරිශීලකයින්',
        description: 'දැනට පද්ධතියේ සක්‍රීයව පසුවන පරිපාලකයින් සහ පරිශීලකයින් සජීවීව නිරීක්ෂණය කරයි.'
      },
      dashboardCharts: {
        title: 'වර්ධන ප්‍රස්ථාර සහ විශ්ලේෂණ',
        description: 'පරිශීලක වර්ධනය, සතිපතා ක්‍රියාකාරකම් සහ අන්තර්ගත භාවිතය ප්‍රස්ථාර මගින් නිරූපණය කෙරේ.'
      },
      dashboardRecentUsers: {
        title: 'නව ලියාපදිංචි කිරීම්',
        description: 'නවතමයෙන් එකතු වූ පරිශීලකයින්ගේ තොරතුරු සහ ඔවුන්ගේ ගිණුම් පරීක්ෂා කිරීමේ පහසුකම.'
      },
      dashboardRecentPosts: {
        title: 'මෑතකාලීන ප්‍රජා සටහන්',
        description: 'ගොවීන් සහ පරිශීලකයින් විසින් එකතු කරන ලද නවතම සටහන් සහ අන්තර්ගතයන්.'
      },

      usersHeader: {
        title: 'පරිශීලක කළමනාකරණ මධ්‍යස්ථානය',
        description: 'සියලුම පරිපාලකයින් සහ ජංගම යෙදුම් පරිශීලකයින් නිරීක්ෂණය සහ කළමනාකරණය කිරීමේ මධ්‍යස්ථානය.'
      },
      usersCreateBtn: {
        title: 'නව පරිපාලක ගිණුමක් සෑදීම',
        description: 'නව පරිපාලකයෙකු එකතු කර අදාළ බලතල (Super Admin, Content Admin, Security Admin, Support Admin) පවරන්න.',
        safeDemo: 'ආරක්ෂිත ආදර්ශනය: මෙමගින් පරිශීලක සෑදීමේ පෝරමය විවෘත වේ. මෙම පූර්ව දර්ශනයේදී කිසිදු පරිශීලකයෙකු නොසෑදේ.'
      },
      usersSearchFilter: {
        title: 'සෙවීම සහ පෙරා වෙන් කිරීම',
        description: 'නම හෝ Email මගින් පරිශීලකයින් සෙවීම සහ භූමිකාව අනුව වෙන්කර බැලීම.'
      },
      usersTable: {
        title: 'පරිශීලක ලැයිස්තුව',
        description: 'පරිශීලකයින්ගේ භූමිකාව, තත්ත්වය සහ ලියාපදිංචි වූ දිනයන් අඩංගු සවිස්තරාත්මක සටහන.'
      },
      usersActions: {
        title: 'ක්‍රියාකාරකම් (තොරතුරු, සංස්කරණය, තහනම් කිරීම, ඉවත් කිරීම)',
        description: 'ගිණුම් තොරතුරු බැලීම, වෙනස් කිරීම් කිරීම, ගිණුම් අත්හිටුවීම හෝ ඉවත් කිරීම මෙතැනින් සිදු කෙරේ.',
        safeDemo: 'ආරක්ෂිත ආදර්ශනය: ඉවත් කිරීම් හෝ තහනම් කිරීම් සඳහා තහවුරු කිරීමේ පණිවිඩ ලැබෙන අතර නිෂ්පාදන දත්ත වෙනස් නොවේ.'
      },

      postsHeader: {
        title: 'අන්තර්ගත සමාලෝචන මධ්‍යස්ථානය',
        description: 'පරිශීලක සටහන්, ප්‍රශ්න සහ වාර්තා වූ අන්තර්ගතයන් පරීක්ෂා කර අනුමත කිරීම.'
      },
      postsTabs: {
        title: 'අන්තර්ගත තත්ත්ව වර්ගීකරණය',
        description: 'බලපොරොත්තුවෙන් පවතින, අනුමත වූ, ප්‍රතික්ෂේප වූ සහ වාර්තා වූ (Flagged) සටහන් වෙන්කර බලන්න.'
      },
      postsGrid: {
        title: 'සටහන් විස්තර සහ වාර්තා',
        description: 'ඡායාරූප, විස්තර, කර්තෘ සහ වාර්තා වීමට හේතු සවිස්තරාත්මකව පරීක්ෂා කරන්න.'
      },
      postsModerateAction: {
        title: 'අනුමත කිරීම, ප්‍රතික්ෂේප කිරීම සහ ඉවත් කිරීම',
        description: 'සුදුසු සටහන් අනුමත කිරීම සහ පද්ධති රීති උල්ලංඝනය කරන සටහන් ඉවත් කිරීම.',
        safeDemo: 'ආරක්ෂිත ආදර්ශනය: මෙහිදී සිදුකරන ක්ලික් කිරීම් ආදර්ශන සඳහා පමණක් වන අතර සජීවී දත්ත වෙනස් නොවේ.'
      },

      analyticsHeader: {
        title: 'පද්ධති විශ්ලේෂණ සහ වාර්තා',
        description: 'පරිශීලක ක්‍රියාකාරකම්, ගොවි හුවමාරු සහ ප්‍රදේශ අනුව දත්ත විශ්ලේෂණය.'
      },
      analyticsOverview: {
        title: 'කාර්යසාධන දර්ශක',
        description: 'දෛනික භාවිතය, සටහන් එකතු වීමේ වේගය සහ සාර්ථක හුවමාරු සංඛ්‍යාලේඛන.'
      },
      analyticsCharts: {
        title: 'අන්තර්ක්‍රියාකාරී දත්ත ප්‍රස්ථාර',
        description: 'තීරණ ගැනීමේදී උපකාරී වන දීර්ඝකාලීන වර්ධන ප්‍රස්ථාර.'
      },

      securityHeader: {
        title: 'ආරක්ෂක පාලනය සහ තර්ජන නිරීක්ෂණය',
        description: 'සක්‍රීය පරිපාලක සැසි, IP ලිපින සහ ආරක්ෂක පද්ධති නිරීක්ෂණය.'
      },
      securityAlerts: {
        title: 'සජීවී ආරක්ෂක අනතුරු ඇඟවීම්',
        description: 'අසාර්ථක ඇතුළුවීම් සහ සැක සහිත ක්‍රියාකාරකම් පිළිබඳ අනතුරු ඇඟවීම්.'
      },
      securitySessions: {
        title: 'සක්‍රීය පරිපාලක සැසි',
        description: 'සක්‍රීයව පවතින පරිපාලක උපකරණ නිරීක්ෂණය සහ අවශ්‍ය නම් ඒවා අවසන් කිරීම.'
      },
      securityLogsLink: {
        title: 'පද්ධති ක්‍රියාකාරකම් ලොග (Activity Logs)',
        description: 'පරිපාලකයින් විසින් සිදුකරන ලද සියලුම වෙනස්කම් සහ ක්‍රියාකාරකම්වල සම්පූර්ණ සටහන.'
      },

      barterHeader: {
        title: 'ගොවි භාණ්ඩ හුවමාරු කළමනාකරණය',
        description: 'ගොවීන් අතර සිදුවන බෝග සහ උපකරණ හුවමාරු නිරීක්ෂණය.'
      },
      barterList: {
        title: 'සක්‍රීය හුවමාරු ලැයිස්තුව',
        description: 'හුවමාරුව සඳහා ඉදිරිපත් කර ඇති භාණ්ඩ, වටිනාකම් සහ ස්ථාන විස්තර.'
      },
      barterActions: {
        title: 'හුවමාරු ආරවුල් විසඳීම',
        description: 'හුවමාරු ගැටලු විසඳීම සහ නීති විරෝධී භාණ්ඩ ඉවත් කිරීම.',
        safeDemo: 'ආරක්ෂිත ආදර්ශනය: කිසිදු ගොවි හුවමාරු දත්තයක් වෙනස් නොවේ.'
      },

      adsHeader: {
        title: 'දැන්වීම් කළමනාකරණය',
        description: 'ව්‍යාපාරික දැන්වීම්, කෘෂිකාර්මික ප්‍රචාරණ සහ ප්‍රවර්ධන කළමනාකරණය.'
      },
      adsCampaigns: {
        title: 'සක්‍රීය දැන්වීම් ව්‍යාපාර',
        description: 'දැන්වීම් නැරඹුම් (Impressions) සහ ක්ලික් කිරීම් නිරීක්ෂණය.'
      },
      adsCreate: {
        title: 'නව දැන්වීමක් පළ කිරීම',
        description: 'නව ප්‍රචාරණ දැන්වීම් සෑදීම සහ ඉලක්කගත ගොවි කණ්ඩායම් වෙත යැවීම.',
        safeDemo: 'ආරක්ෂිත ආදර්ශනය: ආදර්ශන මාදිලිය යටතේ සජීවී දැන්වීම් පළ නොවේ.'
      },

      settingsHeader: {
        title: 'පද්ධති සැකසුම්',
        description: 'භාෂා සැකසුම්, විද්‍යුත් තැපෑල සහ පද්ධති සීමාවන් සකස් කිරීම.'
      },
      settingsGeneral: {
        title: 'භාෂාව සහ සාමාන්‍ය සැකසුම්',
        description: 'පද්ධතියේ ප්‍රධාන භාෂාව (ඉංග්‍රීසි, සිංහල, දෙමළ) සහ පිටු සීමා සකස් කිරීම.'
      },
      settingsSecurity: {
        title: 'ආරක්ෂක සැකසුම්',
        description: 'Email තහවුරු කිරීම සහ මුරපද ආරක්ෂණ රීති සකස් කිරීම.'
      },
      settingsTourRestart: {
        title: 'සංචාරය නැවත ආරම්භ කිරීම',
        description: 'ඕනෑම අවස්ථාවක මෙම මාර්ගෝපදේශ සංචාරය නැවත ආරම්භ කිරීමට මෙතැන ක්ලික් කරන්න.'
      },

      profileCard: {
        title: 'පරිපාලක ගිණුම් විස්තර',
        description: 'ඔබගේ පෞද්ගලික තොරතුරු, ඡායාරූපය සහ පරිපාලක ශ්‍රේණිය.'
      },
      profileEdit: {
        title: 'ගිණුම සහ මුරපදය යාවත්කාලීන කිරීම',
        description: 'ඔබගේ නම, ඡායාරූපය සහ මුරපදය සුරක්ෂිතව වෙනස් කිරීම.'
      },
      profileTourRestart: {
        title: 'සංචාරය නැවත ලබාගන්න',
        description: 'පරිපාලක විශේෂාංග නැවත අධ්‍යයනය කිරීමට මෙතැනින් සංචාරය ආරම්භ කරන්න.'
      }
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
    welcomeDesc: 'உங்கள் நிர்வாகி பங்குக்கு ({role}) ஏற்ப அமைக்கப்பட்ட ஊடாடும் அம்ச சுற்றுலாவைத் தொடங்குவோம். இது அனைத்து கருவிகளையும் எளிதாகப் புரிந்து கொள்ள உதவும்.',
    startTourBtn: 'சுற்றுலாவைத் தொடங்குங்கள்',
    maybeLaterBtn: 'பின்னர் பார்க்கவும்',
    completedTitle: 'சுற்றுலா வெற்றிகரமாக முடிந்தது!',
    completedDesc: 'உங்கள் நிர்வாகி பங்குக்கு ({role}) உரிய அனைத்து அம்சங்களையும் நீங்கள் கற்றுக்கொண்டீர்கள். தேவைப்படும்போது சுயவிவரம் அல்லது அமைப்புகளில் இருந்து மீண்டும் தொடங்கலாம்.',
    gotItBtn: 'புரிந்தது, தொடங்குவோம்!',

    modules: {
      header: 'தலைப்பு மற்றும் மேலோட்டம்',
      sidebar: 'முதன்மை மெனு',
      dashboard: 'நிர்வாக பலகை (Dashboard)',
      users: 'பயனர் மேலாண்மை',
      posts: 'உள்ளடக்க மதிப்பாய்வு',
      analytics: 'பகுப்பாய்வு மற்றும் அறிக்கைகள்',
      security: 'பாதுகாப்பு மற்றும் பதிவுகள்',
      barter: 'பண்டமாற்று முறைமை (Barter)',
      advertisements: 'விளம்பர மேலாண்மை',
      settings: 'அமைப்புகள்',
      profile: 'நிர்வாகி சுயவிவரம்'
    },

    steps: {
      headerTitle: {
        title: 'தலைப்பு மற்றும் நேரக் காட்டி',
        description: 'தற்போதைய பகுதி தலைப்பு மற்றும் நேரடி அமைப்பு நேரம் இங்கு காட்டப்படும்.'
      },
      headerSecurity: {
        title: 'பாதுகாப்பான இணைப்பு நிலை',
        description: 'உங்கள் நிர்வாக அமர்வு SSL மற்றும் நேரடி பாதுகாப்பு கண்காணிப்பால் பாதுகாக்கப்படுகிறது.'
      },
      headerNotifications: {
        title: 'நேரடி அறிவிப்புகள் (Notifications)',
        description: 'அமைப்பின் நடவடிக்கைகள் மற்றும் புதிய பயனர் பதிவுகளை இங்கு பரிசீலிக்கலாம்.'
      },
      headerTourBtn: {
        title: 'ஊடாடும் சுற்றுலா பொத்தான்',
        description: 'இந்த வழிகாட்டி சுற்றுலாவை மீண்டும் தொடங்க எப்போது வேண்டுமானாலும் இந்த திசைகாட்டி பொத்தானைக் கிளிக் செய்யவும்.'
      },
      headerProfile: {
        title: 'நிர்வாகி சுயவிவரம் மற்றும் பங்கு',
        description: 'உங்கள் கணக்கு விவரங்கள் மற்றும் வெளியேறும் விருப்பங்களைப் பெற இங்கு கிளிக் செய்யவும்.'
      },

      sidebarBrand: {
        title: 'SmartFarmer நிர்வாக போர்ட்டல்',
        description: 'இது முதன்மை சின்னம். இதன் மூலம் முதன்மை டாஷ்போர்டிற்குச் செல்லலாம்.'
      },
      sidebarProfile: {
        title: 'உங்கள் நிர்வாக நிலை',
        description: 'உங்கள் பெயர், மின்னஞ்சல் மற்றும் நிர்வாக நிலை (Super Admin, Content Admin, etc.) இங்கு காட்டப்படும்.'
      },
      sidebarNav: {
        title: 'பங்கு அடிப்படையிலான மெனு',
        description: 'உங்கள் அதிகாரத்திற்கு உட்பட்ட கருவிகள் மட்டுமே இந்த மெனுவில் காட்டப்படும்.'
      },

      dashboardWelcome: {
        title: 'வரவேற்பு பலகை',
        description: 'நேரத்திற்கு ஏற்ற வாழ்த்து மற்றும் கணினி நிலை அறிக்கைகள் இங்கு காட்டப்படும்.'
      },
      dashboardStats: {
        title: 'முக்கிய புள்ளிவிவரங்கள்',
        description: 'பதிவுசெய்த பயனர்கள், விவசாயிகள் மற்றும் விளம்பரங்களின் நேரடி எண்ணிக்கைகள்.'
      },
      dashboardOnline: {
        title: 'நேரடி ஆன்லைன் பயனர்கள்',
        description: 'தற்போது அமைப்பில் உள்ள ஆன்லைன் நிர்வாகிகள் மற்றும் பயனர்களைக் கண்காணிக்கும்.'
      },
      dashboardCharts: {
        title: 'வளர்ச்சி வரைபடங்கள்',
        description: 'பயனர் வளர்ச்சி மற்றும் வாராந்திர செயல்பாடுகளின் வரைபடங்கள்.'
      },
      dashboardRecentUsers: {
        title: 'புதிய பதிவுகள்',
        description: 'சமீபத்தில் இணைந்த பயனர்களின் விவரங்கள் மற்றும் பரிசோதனை விருப்பங்கள்.'
      },
      dashboardRecentPosts: {
        title: 'சமீபத்திய இடுகைகள்',
        description: 'விவசாயிகள் மற்றும் பயனர்களால் சேர்க்கப்பட்ட புதிய உள்ளடக்கங்கள்.'
      },

      usersHeader: {
        title: 'பயனர் மேலாண்மை மையம்',
        description: 'அனைத்து நிர்வாகிகளையும் பயனர் கணக்குகளையும் நிர்வகிக்கும் மையம்.'
      },
      usersCreateBtn: {
        title: 'புதிய நிர்வாகி கணக்கை உருவாக்குதல்',
        description: 'புதிய நிர்வாகியைச் சேர்த்து அவர்களுக்குரிய அதிகாரங்களை வழங்கவும்.',
        safeDemo: 'பாதுகாப்பான மாதிரி: இதன் மூலம் பயனர் படிவம் திறக்கப்படும். மாதிரி முறையில் பயனர் உருவாக்கப்பட மாட்டார்.'
      },
      usersSearchFilter: {
        title: 'தேடல் மற்றும் வடிகட்டி',
        description: 'பெயர் அல்லது மின்னஞ்சல் மூலம் பயனர்களைத் தேடலாம்.'
      },
      usersTable: {
        title: 'பயனர் பட்டியல்',
        description: 'பயனர்களின் நிலை மற்றும் பதிவு தேதிகள் அடங்கிய விரிவான பட்டியல்.'
      },
      usersActions: {
        title: 'செயல்பாடுகள் (பார்வை, திருத்து, தடைசெய், நீக்கு)',
        description: 'கணக்கு விவரங்களைப் பார்க்க மற்றும் திருத்த இந்த பொத்தான்களைப் பயன்படுத்தவும்.',
        safeDemo: 'பாதுகாப்பான மாதிரி: நீக்குதல் அல்லது தடைசெய்தல் நடவடிக்கைகள் உற்பத்தித் தரவை மாற்றாது.'
      },

      postsHeader: {
        title: 'உள்ளடக்க மதிப்பாய்வு மையம்',
        description: 'பயனர் இடுகைகள் மற்றும் புகார்களை மதிப்பாய்வு செய்து அனுமதித்தல்.'
      },
      postsTabs: {
        title: 'உள்ளடக்க நிலை வகைகள்',
        description: 'நிலுவையில் உள்ள மற்றும் அனுமதிக்கப்பட்ட இடுகைகளைப் பிரிக்கவும்.'
      },
      postsGrid: {
        title: 'இடுகை விவரங்கள்',
        description: 'படங்கள், விளக்கங்கள் மற்றும் புகார்களின் காரணங்களை ஆராயுங்கள்.'
      },
      postsModerateAction: {
        title: 'அனுமதித்தல் மற்றும் நீக்குதல்',
        description: 'சரியான இடுகைகளை அனுமதித்து விதியை மீறும் இடுகைகளை நீக்குங்கள்.',
        safeDemo: 'பாதுகாப்பான மாதிரி: நேரடித் தரவு எதுவும் மாற்றப்படாது.'
      },

      analyticsHeader: {
        title: 'பகுப்பாய்வு மற்றும் அறிக்கைகள்',
        description: 'பயனர் நடவடிக்கைகள் மற்றும் வர்த்தகப் புள்ளிவிவரங்களின் பகுப்பாய்வு.'
      },
      analyticsOverview: {
        title: 'செயல்திறன் குறிகாட்டிகள்',
        description: 'தினசரி பயன்பாடு மற்றும் வெற்றிகரமான பரிமாற்றங்களின் புள்ளிவிவரங்கள்.'
      },
      analyticsCharts: {
        title: 'வரைபடங்கள்',
        description: 'முடிவெடுக்க உதவும் நீண்டகால வளர்ச்சி வரைபடங்கள்.'
      },

      securityHeader: {
        title: 'பாதுகாப்பு மற்றும் கண்காணிப்பு',
        description: 'செயலில் உள்ள நிர்வாக அமர்வுகள் மற்றும் IP முகவரிகளைக் கண்காணித்தல்.'
      },
      securityAlerts: {
        title: 'பாதுகாப்பு எச்சரிக்கைகள்',
        description: 'சந்தேகத்திற்கிடமான நடவடிக்கைகள் குறித்த உடனடி எச்சரிக்கைகள்.'
      },
      securitySessions: {
        title: 'செயலில் உள்ள அமர்வுகள்',
        description: 'செயலில் உள்ள நிர்வாக சாதனங்களைக் கண்காணித்தல்.'
      },
      securityLogsLink: {
        title: 'அமைப்பின் செயல்பாட்டு பதிவுகள்',
        description: 'நிர்வாகிகளால் செய்யப்பட்ட அனைத்து மாற்றங்களின் முழுமையான பதிவு.'
      },

      barterHeader: {
        title: 'பண்டமாற்று முறைமை மேலாண்மை',
        description: 'விவசாயிகளுக்கிடையேயான பயிர் மற்றும் உபகரணப் பரிமாற்றங்களைக் கண்காணித்தல்.'
      },
      barterList: {
        title: 'செயலில் உள்ள பரிமாற்றங்கள்',
        description: 'பரிமாற்றத்திற்கு சமர்ப்பிக்கப்பட்ட பொருட்கள் மற்றும் இடங்களின் விவரங்கள்.'
      },
      barterActions: {
        title: 'சிக்கல்களைத் தீர்த்தல்',
        description: 'பரிமாற்றச் சிக்கல்களைத் தீர்த்து சட்டவிரோத பொருட்களை நீக்குங்கள்.',
        safeDemo: 'பாதுகாப்பான மாதிரி: விவசாயிகள் தரவு எதுவும் மாற்றப்படாது.'
      },

      adsHeader: {
        title: 'விளம்பர மேலாண்மை',
        description: 'வணிக விளம்பரங்கள் மற்றும் விவசாய பிரச்சாரங்களை நிர்வகிக்கவும்.'
      },
      adsCampaigns: {
        title: 'செயலில் உள்ள விளம்பரங்கள்',
        description: 'விளம்பர பார்வைகள் மற்றும் கிளிக் எண்ணிக்கைகளைக் கண்காணிக்கவும்.'
      },
      adsCreate: {
        title: 'புதிய விளம்பரத்தை வெளியிடல்',
        description: 'புதிய விளம்பரங்களை உருவாக்கி இலக்கு விவசாய குழுக்களுக்கு அனுப்பவும்.',
        safeDemo: 'பாதுகாப்பான மாதிரி: மாதிரி முறையில் நேரடி விளம்பரங்கள் வெளியிடப்படாது.'
      },

      settingsHeader: {
        title: 'அமைப்புகள்',
        description: 'மொழி அமைப்புகள் மற்றும் மின்னஞ்சல் கட்டுப்பாடுகளை சரிசெய்தல்.'
      },
      settingsGeneral: {
        title: 'மொழி மற்றும் பொது அமைப்புகள்',
        description: 'அமைப்பின் முதன்மை மொழியை (ஆங்கிலம், சிங்களம், தமிழ்) தேர்வு செய்யவும்.'
      },
      settingsSecurity: {
        title: 'பாதுகாப்பு அமைப்புகள்',
        description: 'மின்னஞ்சல் உறுதிப்படுத்தல் மற்றும் கடவுச்சொல் விதிகளை அமைக்கவும்.'
      },
      settingsTourRestart: {
        title: 'சுற்றுலாவை மீண்டும் தொடங்குதல்',
        description: 'இந்த வழிகாட்டி சுற்றுலாவை மீண்டும் தொடங்க இங்கு கிளிக் செய்யவும்.'
      },

      profileCard: {
        title: 'நிர்வாகி சுயவிவர விவரங்கள்',
        description: 'உங்கள் தனிப்பட்ட விவரங்கள், புகைப்படம் மற்றும் நிலை.'
      },
      profileEdit: {
        title: 'கடவுச்சொல்லை மாற்றுதல்',
        description: 'உங்கள் பெயர் மற்றும் கடவுச்சொல்லை பாதுகாப்பாக மாற்றவும்.'
      },
      profileTourRestart: {
        title: 'சுற்றுலாவை மீண்டும் பெறுக',
        description: 'நிர்வாக அம்சங்களை மீண்டும் கற்றுக்கொள்ள சுற்றுலாவைத் தொடங்குங்கள்.'
      }
    }
  }
}
