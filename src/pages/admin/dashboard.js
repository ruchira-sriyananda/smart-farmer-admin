import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
)

export default function AdminDashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [greeting, setGreeting] = useState('')
  const [userRole, setUserRole] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  // Data States
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFarmers: 0,
    totalVendors: 0,
    verifiedUsers: 0,
    pendingVerification: 0,
    totalPosts: 0,
    totalBarterListings: 0,
    totalAds: 0,
    newUsersToday: 0,
    newPostsToday: 0,
    activeBarterTrades: 0
  })

  const [onlineUsers, setOnlineUsers] = useState([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [recentUsers, setRecentUsers] = useState([])
  const [recentPosts, setRecentPosts] = useState([])
  const [recentBarterListings, setRecentBarterListings] = useState([])
  const [userGrowthData, setUserGrowthData] = useState([0, 0, 0, 0])
  const [roleDistribution, setRoleDistribution] = useState({})
  const [weeklyActivity, setWeeklyActivity] = useState([0, 0, 0, 0, 0, 0, 0])
  const [topContributors, setTopContributors] = useState([])

  // Role-based permissions
  const permissions = {
    SUPER_ADMIN: {
      canViewAllUsers: true,
      canViewAllPosts: true,
      canViewAllBarter: true,
      canViewAnalytics: true,
      canManageAds: true,
      canViewOnlineUsers: true,
      canViewStats: true,
      canModerateContent: true
    },
    CONTENT_ADMIN: {
      canViewAllUsers: false,
      canViewAllPosts: true,
      canViewAllBarter: false,
      canViewAnalytics: true,
      canManageAds: false,
      canViewOnlineUsers: true,
      canViewStats: true,
      canModerateContent: true
    },
    SECURITY_ADMIN: {
      canViewAllUsers: true,
      canViewAllPosts: false,
      canViewAllBarter: false,
      canViewAnalytics: false,
      canManageAds: false,
      canViewOnlineUsers: true,
      canViewStats: true,
      canModerateContent: false
    },
    SUPPORT_ADMIN: {
      canViewAllUsers: true,
      canViewAllPosts: false,
      canViewAllBarter: false,
      canViewAnalytics: false,
      canManageAds: false,
      canViewOnlineUsers: true,
      canViewStats: true,
      canModerateContent: false
    }
  }

  // Set greeting based on time
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 18) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')
  }, [])

  // Get user role from session
  useEffect(() => {
    const storedSession = localStorage.getItem('adminSession')
    if (storedSession) {
      const parsed = JSON.parse(storedSession)
      setUserRole(parsed.role || 'SUPPORT_ADMIN')
      setIsSuperAdmin(parsed.admin?.is_super_admin || false)
    }
  }, [])

  // Get current user's permissions
  const getPermissions = () => {
    if (isSuperAdmin) return permissions.SUPER_ADMIN
    return permissions[userRole] || permissions.SUPPORT_ADMIN
  }

  // Navigation handlers for View All buttons
  const handleViewAllUsers = () => {
    router.push('/admin/mobile-users')
  }

  const handleViewAllPosts = () => {
    router.push('/admin/posts')
  }

  const handleViewAllBarter = () => {
    router.push('/admin/barter')
  }

  const handleViewAllAds = () => {
    router.push('/admin/advertisements')
  }

  const handleViewAnalytics = () => {
    router.push('/admin/analytics')
  }

  const handleManageUsers = () => {
    router.push('/admin/mobile-users')
  }

  const handleModeratePosts = () => {
    router.push('/admin/mobile-posts')
  }

  const handleBarterOversight = () => {
    router.push('/admin/mobile-barter')
  }

  const handleManageAds = () => {
    router.push('/admin/advertisements')
  }

  // Fetch all data based on role
  const fetchAllData = async () => {
    const perms = getPermissions()
    
    const promises = []
    
    promises.push(fetchStats())
    promises.push(fetchOnlineUsers())
    promises.push(fetchUserGrowth())
    promises.push(fetchRoleDistribution())
    promises.push(fetchWeeklyActivity())
    
    if (perms.canViewAllUsers) {
      promises.push(fetchRecentUsers())
    }
    
    if (perms.canViewAllPosts) {
      promises.push(fetchRecentPosts())
      promises.push(fetchTopContributors())
    }
    
    if (perms.canViewAllBarter) {
      promises.push(fetchRecentBarterListings())
    }
    
    await Promise.all(promises)
    setLoading(false)
  }

  const fetchStats = async () => {
    try {
      const { data: roles } = await supabase.from('roles').select('role_id, role_name')
      const roleMap = {}
      roles?.forEach(r => { roleMap[r.role_name] = r.role_id })

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [
        { count: totalUsers },
        { count: farmersCount },
        { count: vendorsCount },
        { count: verifiedCount },
        { count: pendingCount },
        { count: postsCount },
        { count: barterCount },
        { count: adsCount },
        { count: newUsersCount },
        { count: newPostsCount },
        { count: activeBarterCount }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['FARMER'] || ''),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['VENDOR'] || ''),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', false),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }),
        supabase.from('mobile_advertisements').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE')
      ])

      setStats({
        totalUsers: totalUsers || 0,
        totalFarmers: farmersCount || 0,
        totalVendors: vendorsCount || 0,
        verifiedUsers: verifiedCount || 0,
        pendingVerification: pendingCount || 0,
        totalPosts: postsCount || 0,
        totalBarterListings: barterCount || 0,
        totalAds: adsCount || 0,
        newUsersToday: newUsersCount || 0,
        newPostsToday: newPostsCount || 0,
        activeBarterTrades: activeBarterCount || 0
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchOnlineUsers = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('user_sessions')
        .select('user_id, login_time')
        .eq('session_status', 'ACTIVE')
        .gte('login_time', fiveMinutesAgo)

      if (data && data.length > 0) {
        const userIds = data.map(s => s.user_id)
        const { data: usersData } = await supabase
          .from('users')
          .select('user_id, full_name, profile_image')
          .in('user_id', userIds)
        
        const onlineUsersWithDetails = data.map(session => ({
          ...session,
          user: usersData?.find(u => u.user_id === session.user_id)
        })).filter(item => item.user)
        
        setOnlineUsers(onlineUsersWithDetails)
        setOnlineCount(onlineUsersWithDetails.length)
      } else {
        setOnlineUsers([])
        setOnlineCount(0)
      }
    } catch (err) {
      console.error('Error fetching online users:', err)
    }
  }

  const fetchRecentUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('user_id, full_name, email, profile_image, is_verified, created_at, role_id')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!error && data) {
        const { data: rolesData } = await supabase.from('roles').select('role_id, role_name')
        const roleMap = {}
        rolesData?.forEach(r => { roleMap[r.role_id] = r.role_name })
        
        const usersWithRoles = data.map(user => ({
          ...user,
          role_name: roleMap[user.role_id] || 'PENDING'
        }))
        
        setRecentUsers(usersWithRoles)
      }
    } catch (err) { console.error('Error:', err) }
  }

  const fetchRecentPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('post_id, title, content, image_url, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(3)

      if (!error && data) {
        const userIds = [...new Set(data.map(p => p.user_id))]
        const { data: usersData } = await supabase
          .from('users')
          .select('user_id, full_name')
          .in('user_id', userIds)
        
        const userMap = {}
        usersData?.forEach(u => { userMap[u.user_id] = u.full_name })
        
        const postsWithUsers = data.map(post => ({
          ...post,
          author_name: userMap[post.user_id] || 'Anonymous'
        }))
        
        setRecentPosts(postsWithUsers)
      }
    } catch (err) { console.error('Error:', err) }
  }

  const fetchRecentBarterListings = async () => {
    try {
      const { data, error } = await supabase
        .from('barter_listings')
        .select('listing_id, title, description, quantity, unit, status, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(4)

      if (!error && data) {
        const userIds = [...new Set(data.map(l => l.user_id))]
        const { data: usersData } = await supabase
          .from('users')
          .select('user_id, full_name')
          .in('user_id', userIds)
        
        const userMap = {}
        usersData?.forEach(u => { userMap[u.user_id] = u.full_name })
        
        const listingsWithUsers = data.map(listing => ({
          ...listing,
          owner_name: userMap[listing.user_id] || 'Anonymous'
        }))
        
        setRecentBarterListings(listingsWithUsers)
      }
    } catch (err) { console.error('Error:', err) }
  }

  const fetchUserGrowth = async () => {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())

      const weeklyCounts = [0, 0, 0, 0]
      
      data?.forEach(user => {
        const daysSince = Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
        const weekIndex = Math.floor(daysSince / 7)
        if (weekIndex >= 0 && weekIndex < 4) weeklyCounts[3 - weekIndex]++
      })

      setUserGrowthData(weeklyCounts)
    } catch (err) { console.error('Error:', err) }
  }

  const fetchRoleDistribution = async () => {
    try {
      const { data: users } = await supabase.from('users').select('role_id')
      const { data: roles } = await supabase.from('roles').select('role_id, role_name')
      
      const roleMap = {}
      roles?.forEach(r => { roleMap[r.role_id] = r.role_name })
      
      const distribution = {}
      users?.forEach(user => {
        const roleName = roleMap[user.role_id] || 'PENDING'
        distribution[roleName] = (distribution[roleName] || 0) + 1
      })
      
      setRoleDistribution(distribution)
    } catch (err) { console.error('Error:', err) }
  }

  const fetchWeeklyActivity = async () => {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data } = await supabase
        .from('posts')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())

      const activityByDay = [0, 0, 0, 0, 0, 0, 0]
      
      data?.forEach(post => {
        const dayIndex = new Date(post.created_at).getDay()
        const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1
        if (adjustedIndex >= 0 && adjustedIndex < 7) activityByDay[adjustedIndex]++
      })

      setWeeklyActivity(activityByDay)
    } catch (err) { console.error('Error:', err) }
  }

  const fetchTopContributors = async () => {
    try {
      const { data } = await supabase
        .from('posts')
        .select('user_id')
      
      if (data && data.length > 0) {
        const userCounts = {}
        data.forEach(post => {
          if (post.user_id) {
            userCounts[post.user_id] = (userCounts[post.user_id] || 0) + 1
          }
        })
        
        const sorted = Object.entries(userCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, count]) => ({ user_id: id, post_count: count }))
        
        if (sorted.length > 0) {
          const userIds = sorted.map(s => s.user_id)
          const { data: usersData } = await supabase
            .from('users')
            .select('user_id, full_name')
            .in('user_id', userIds)
          
          const userMap = {}
          usersData?.forEach(u => { userMap[u.user_id] = u.full_name })
          
          const contributorsWithNames = sorted.map(s => ({
            ...s,
            full_name: userMap[s.user_id] || 'Unknown'
          }))
          
          setTopContributors(contributorsWithNames)
        }
      }
    } catch (err) { console.error('Error:', err) }
  }

  useEffect(() => {
    const init = async () => {
      const storedSession = localStorage.getItem('adminSession')
      if (!storedSession) { router.push('/admin/login'); return }
      setSession(JSON.parse(storedSession))
      await fetchAllData()
    }
    init()

    const interval = setInterval(() => {
      fetchStats()
      fetchOnlineUsers()
      setLastUpdate(new Date())
    }, 30000)

    return () => clearInterval(interval)
  }, [router, userRole])

  const refreshData = async () => {
    setRefreshing(true)
    await fetchAllData()
    setLastUpdate(new Date())
    setRefreshing(false)
  }

  // Chart configurations
  const userGrowthChart = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [{
      label: 'New Users',
      data: userGrowthData,
      borderColor: '#4f46e5',
      backgroundColor: 'rgba(79, 70, 229, 0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#4f46e5',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  }

  const weeklyActivityChart = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Posts Created',
      data: weeklyActivity,
      backgroundColor: 'rgba(79, 70, 229, 0.8)',
      borderRadius: 10,
      barPercentage: 0.65
    }]
  }

  const roleDistributionChart = {
    labels: Object.keys(roleDistribution),
    datasets: [{
      data: Object.values(roleDistribution),
      backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
      borderWidth: 0,
      borderRadius: 10
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10, font: { size: 11 } } },
      tooltip: { backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#9ca3af', padding: 10, cornerRadius: 8 }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: '#e5e7eb' }, ticks: { stepSize: 1 } },
      x: { grid: { display: false } }
    }
  }

  const getRoleBadge = (roleName) => {
    const badges = {
      'ADMIN': <span className="badge-admin"><i className="bi bi-shield-fill me-1"></i>Admin</span>,
      'FARMER': <span className="badge-farmer"><i className="bi bi-tree-fill me-1"></i>Farmer</span>,
      'VENDOR': <span className="badge-vendor"><i className="bi bi-shop me-1"></i>Vendor</span>
    }
    return badges[roleName] || <span className="badge-pending"><i className="bi bi-clock me-1"></i>{roleName || 'Pending'}</span>
  }

  const perms = getPermissions()

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading dashboard data...</p>
        </div>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
          }
          .loading-spinner {
            width: 48px;
            height: 48px;
            border: 3px solid #e9ecef;
            border-top-color: #4f46e5;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Farmers Platform Dashboard">
      <div className="dashboard-wrapper">
        {/* Welcome Section with Role Badge */}
        <div className="welcome-section">
          <div className="welcome-text">
            <div className="greeting">{greeting} 👋</div>
            <h1 className="welcome-title">
              Welcome back, <span className="user-name">{session?.admin?.full_name?.split(' ')[0] || 'Admin'}</span>
            </h1>
            <p className="welcome-subtitle">
              {isSuperAdmin ? 'Super Administrator' : userRole} - Here's your platform overview
            </p>
          </div>
          <div className="header-actions">
            <div className="role-badge-header">
              <i className="bi bi-shield-check"></i>
              <span>{userRole}</span>
            </div>
            <div className="live-badge">
              <span className="live-dot"></span>
              <span>LIVE DATA</span>
            </div>
            <div className="last-update">
              <i className="bi bi-clock"></i> Updated: {lastUpdate.toLocaleTimeString()}
            </div>
            <button className="refresh-btn" onClick={refreshData} disabled={refreshing}>
              <i className={`bi bi-arrow-repeat ${refreshing ? 'spin' : ''}`}></i>
            </button>
          </div>
        </div>

        {/* Main Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card primary" onClick={handleViewAllUsers}>
            <div className="stat-card-icon"><i className="bi bi-people-fill"></i></div>
            <div className="stat-card-content">
              <span className="stat-label">Total Users</span>
              <h2 className="stat-value">{stats.totalUsers.toLocaleString()}</h2>
              <span className="stat-change positive"><i className="bi bi-arrow-up"></i> +{stats.newUsersToday} today</span>
            </div>
          </div>
          <div className="stat-card success">
            <div className="stat-card-icon"><i className="bi bi-tree-fill"></i></div>
            <div className="stat-card-content">
              <span className="stat-label">Farmers</span>
              <h2 className="stat-value">{stats.totalFarmers.toLocaleString()}</h2>
              <span className="stat-change positive"><i className="bi bi-check-circle"></i> Active growers</span>
            </div>
          </div>
          <div className="stat-card info">
            <div className="stat-card-icon"><i className="bi bi-shop"></i></div>
            <div className="stat-card-content">
              <span className="stat-label">Vendors</span>
              <h2 className="stat-value">{stats.totalVendors.toLocaleString()}</h2>
              <span className="stat-change positive"><i className="bi bi-store"></i> Suppliers</span>
            </div>
          </div>
          <div className="stat-card warning">
            <div className="stat-card-icon"><i className="bi bi-arrow-left-right"></i></div>
            <div className="stat-card-content">
              <span className="stat-label">Active Barter</span>
              <h2 className="stat-value">{stats.activeBarterTrades}</h2>
              <span className="stat-change positive"><i className="bi bi-graph-up"></i> Active trades</span>
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="secondary-stats">
          <div className="stat-card-mini" onClick={handleViewAllUsers}>
            <div className="stat-mini-icon verified"><i className="bi bi-check2-circle"></i></div>
            <div className="stat-mini-info">
              <div className="stat-mini-value">{stats.verifiedUsers.toLocaleString()}</div>
              <div className="stat-mini-label">Verified Users</div>
              <div className="stat-mini-trend">{stats.totalUsers > 0 ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100) : 0}% of total</div>
            </div>
          </div>
          <div className="stat-card-mini" onClick={handleViewAllUsers}>
            <div className="stat-mini-icon pending"><i className="bi bi-hourglass-split"></i></div>
            <div className="stat-mini-info">
              <div className="stat-mini-value">{stats.pendingVerification}</div>
              <div className="stat-mini-label">Pending Approval</div>
              <div className="stat-mini-trend">Awaiting verification</div>
            </div>
          </div>
          <div className="stat-card-mini" onClick={handleViewAllPosts}>
            <div className="stat-mini-icon posts"><i className="bi bi-file-post"></i></div>
            <div className="stat-mini-info">
              <div className="stat-mini-value">{stats.totalPosts.toLocaleString()}</div>
              <div className="stat-mini-label">Total Posts</div>
              <div className="stat-mini-trend text-success">+{stats.newPostsToday} today</div>
            </div>
          </div>
          <div className="stat-card-mini" onClick={handleViewAllAds}>
            <div className="stat-mini-icon ads"><i className="bi bi-megaphone"></i></div>
            <div className="stat-mini-info">
              <div className="stat-mini-value">{stats.totalAds}</div>
              <div className="stat-mini-label">Active Ads</div>
              <div className="stat-mini-trend">Live campaigns</div>
            </div>
          </div>
          <div className="stat-card-mini" onClick={handleViewAllBarter}>
            <div className="stat-mini-icon barter"><i className="bi bi-box-seam"></i></div>
            <div className="stat-mini-info">
              <div className="stat-mini-value">{stats.totalBarterListings}</div>
              <div className="stat-mini-label">Barter Listings</div>
              <div className="stat-mini-trend">Available for trade</div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="charts-row">
          <div className="chart-card">
            <div className="chart-header">
              <h5>📈 User Growth Trend</h5>
              <p>New user registrations over the last 30 days</p>
            </div>
            <div className="chart-body"><Line data={userGrowthChart} options={chartOptions} /></div>
          </div>
          <div className="chart-card">
            <div className="chart-header">
              <h5>📊 Platform Activity</h5>
              <p>Daily posts and community engagement</p>
            </div>
            <div className="chart-body"><Bar data={weeklyActivityChart} options={chartOptions} /></div>
          </div>
        </div>

        {/* User Distribution & Top Contributors */}
        <div className="two-columns">
          <div className="card-distribution">
            <div className="card-header-custom">
              <h5><i className="bi bi-pie-chart"></i> User Distribution</h5>
              <p>Breakdown by user role</p>
            </div>
            <div className="donut-container">
              {Object.keys(roleDistribution).length > 0 ? (
                <Doughnut data={roleDistributionChart} options={chartOptions} />
              ) : (
                <div className="no-data-message">No role data available</div>
              )}
            </div>
            <div className="legend-stats">
              {Object.entries(roleDistribution).map(([role, count]) => (
                <div key={role} className="legend-item">
                  <span className="legend-dot" style={{ background: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 4)] }}></span>
                  <span className="legend-name">{role}</span>
                  <span className="legend-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Top Contributors */}
          {(perms.canViewAllPosts || perms.canModerateContent) && (
            <div className="card-contributors">
              <div className="card-header-custom">
                <h5><i className="bi bi-trophy"></i> Top Contributors</h5>
                <p>Most active users by post count</p>
              </div>
              <div className="contributors-list">
                {topContributors.map((contributor, idx) => (
                  <div key={idx} className="contributor-item">
                    <div className="contributor-rank">#{idx + 1}</div>
                    <div className="contributor-info">
                      <div className="contributor-name">{contributor.full_name}</div>
                      <div className="contributor-stats">{contributor.post_count} posts</div>
                    </div>
                    <i className="bi bi-award-fill"></i>
                  </div>
                ))}
                {topContributors.length === 0 && (
                  <div className="empty-contributors"><i className="bi bi-people"></i><p>No contributors yet</p></div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Online Users */}
        <div className="online-section">
          <div className="online-header">
            <h5><i className="bi bi-wifi"></i> Currently Online</h5>
            <p>{onlineCount} active users right now</p>
          </div>
          <div className="online-list">
            {onlineUsers.length > 0 ? (
              onlineUsers.slice(0, 8).map((user, idx) => (
                <div key={idx} className="online-item">
                  <div className="online-avatar">
                    {user.user?.profile_image ? (
                      <img src={user.user.profile_image} alt={user.user.full_name} />
                    ) : (
                      <span>{user.user?.full_name?.charAt(0) || 'U'}</span>
                    )}
                    <span className="online-status-dot"></span>
                  </div>
                  <div className="online-info">
                    <div className="online-name">{user.user?.full_name || 'User'}</div>
                    <div className="online-time">Active {new Date(user.login_time).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-online"><i className="bi bi-person-slash"></i><p>No users online</p></div>
            )}
          </div>
        </div>

        {/* Recent Users Table */}
        {perms.canViewAllUsers && (
          <div className="recent-table">
            <div className="table-header">
              <h5><i className="bi bi-people"></i> Recent Users</h5>
              <button className="view-all" onClick={handleViewAllUsers}>View All <i className="bi bi-arrow-right"></i></button>
            </div>
            <div className="table-responsive">
              <table className="custom-table">
                <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
                <tbody>
                  {recentUsers.map((user) => (
                    <tr key={user.user_id}>
                      <td className="user-cell">
                        <div className="user-avatar-sm">{user.profile_image ? <img src={user.profile_image} alt={user.full_name} /> : <span>{user.full_name?.charAt(0)}</span>}</div>
                        <div><div className="user-name-sm">{user.full_name}</div><div className="user-email">{user.email}</div></div>
                      </td>
                      <td>{getRoleBadge(user.role_name)}</td>
                      <td>{user.is_verified ? <span className="status-verified"><i className="bi bi-check-circle"></i> Verified</span> : <span className="status-pending"><i className="bi bi-clock"></i> Pending</span>}</td>
                      <td className="date-cell">{new Date(user.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Posts */}
        {(perms.canViewAllPosts || perms.canModerateContent) && (
          <div className="recent-posts-section">
            <div className="section-header">
              <h5><i className="bi bi-file-post"></i> Recent Posts</h5>
              <button className="view-all" onClick={handleViewAllPosts}>View All <i className="bi bi-arrow-right"></i></button>
            </div>
            <div className="posts-grid">
              {recentPosts.map((post) => (
                <div key={post.post_id} className="post-card">
                  {post.image_url && <div className="post-card-image"><img src={post.image_url} alt={post.title} /></div>}
                  <div className="post-card-content">
                    <h6>{post.title}</h6>
                    <p>{post.content?.substring(0, 80)}...</p>
                    <div className="post-card-meta">
                      <span><i className="bi bi-person-circle"></i> {post.author_name}</span>
                      <span><i className="bi bi-calendar3"></i> {new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
              {recentPosts.length === 0 && <div className="no-data-card"><i className="bi bi-inbox"></i><p>No posts available</p></div>}
            </div>
          </div>
        )}

        {/* Recent Barter Listings */}
        {perms.canViewAllBarter && (
          <div className="recent-barter-section">
            <div className="section-header">
              <h5><i className="bi bi-arrow-left-right"></i> Recent Barter Listings</h5>
              <button className="view-all" onClick={handleViewAllBarter}>View All <i className="bi bi-arrow-right"></i></button>
            </div>
            <div className="barter-grid">
              {recentBarterListings.map((listing) => (
                <div key={listing.listing_id} className="barter-card">
                  <div className="barter-card-header">
                    <h6>{listing.title}</h6>
                    <span className={`barter-status ${listing.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{listing.status}</span>
                  </div>
                  <p>{listing.description?.substring(0, 80)}...</p>
                  <div className="barter-card-meta">
                    <span><i className="bi bi-box"></i> {listing.quantity} {listing.unit}</span>
                    <span><i className="bi bi-person"></i> {listing.owner_name}</span>
                  </div>
                </div>
              ))}
              {recentBarterListings.length === 0 && <div className="no-data-card"><i className="bi bi-inbox"></i><p>No barter listings available</p></div>}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="quick-actions">
          <h5><i className="bi bi-lightning-charge"></i> Quick Actions</h5>
          <div className="actions-grid">
            {perms.canViewAllUsers && (
              <button className="action-item" onClick={handleManageUsers}>
                <i className="bi bi-people"></i><span>Manage Users</span>
              </button>
            )}
            {(perms.canViewAllPosts || perms.canModerateContent) && (
              <button className="action-item" onClick={handleModeratePosts}>
                <i className="bi bi-file-post"></i><span>Moderate Posts</span>
              </button>
            )}
            {perms.canViewAllBarter && (
              <button className="action-item" onClick={handleBarterOversight}>
                <i className="bi bi-arrow-left-right"></i><span>Barter Oversight</span>
              </button>
            )}
            {perms.canManageAds && (
              <button className="action-item" onClick={handleManageAds}>
                <i className="bi bi-megaphone"></i><span>Manage Ads</span>
              </button>
            )}
            {perms.canViewAnalytics && (
              <button className="action-item" onClick={handleViewAnalytics}>
                <i className="bi bi-graph-up"></i><span>Analytics</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .dashboard-wrapper { max-width: 1400px; margin: 0 auto; padding: 0 24px; }
        .welcome-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 20px; }
        .greeting { font-size: 14px; color: #6c757d; margin-bottom: 4px; }
        .welcome-title { font-size: 28px; font-weight: 700; margin: 0 0 8px 0; color: #1f2937; }
        .user-name { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .welcome-subtitle { color: #6c757d; margin: 0; font-size: 14px; }
        .header-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .role-badge-header { display: flex; align-items: center; gap: 6px; background: #e9ecef; padding: 6px 14px; border-radius: 30px; font-size: 13px; font-weight: 600; color: #495057; }
        .live-badge { display: flex; align-items: center; gap: 8px; background: rgba(16,185,129,0.1); padding: 6px 14px; border-radius: 30px; font-size: 13px; font-weight: 600; color: #10b981; }
        .live-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite; }
        .last-update { font-size: 13px; color: #6c757d; }
        .refresh-btn { width: 36px; height: 36px; border-radius: 10px; background: #f8f9fa; border: 1px solid #e9ecef; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s ease; }
        .refresh-btn:hover { background: #e9ecef; transform: rotate(15deg); }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 24px; }
        .stat-card { background: white; border-radius: 24px; padding: 20px; display: flex; align-items: center; gap: 16px; transition: all 0.3s ease; cursor: pointer; }
        .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); }
        .stat-card.primary .stat-card-icon { background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); color: #667eea; }
        .stat-card.success .stat-card-icon { background: rgba(16,185,129,0.1); color: #10b981; }
        .stat-card.info .stat-card-icon { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .stat-card.warning .stat-card-icon { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .stat-card-icon { width: 56px; height: 56px; border-radius: 18px; display: flex; align-items: center; justify-content: center; }
        .stat-card-icon i { font-size: 28px; }
        .stat-card-content { flex: 1; }
        .stat-label { font-size: 13px; color: #6c757d; margin-bottom: 4px; display: block; }
        .stat-value { font-size: 28px; font-weight: 700; margin: 0 0 4px 0; color: #1f2937; }
        .stat-change { font-size: 12px; }
        .stat-change.positive { color: #10b981; }
        .secondary-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 28px; }
        .stat-card-mini { background: white; border-radius: 18px; padding: 14px; display: flex; align-items: center; gap: 12px; transition: all 0.3s ease; cursor: pointer; }
        .stat-card-mini:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); }
        .stat-mini-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .stat-mini-icon.verified { background: rgba(16,185,129,0.1); color: #10b981; }
        .stat-mini-icon.pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .stat-mini-icon.posts { background: rgba(79,70,229,0.1); color: #4f46e5; }
        .stat-mini-icon.ads { background: rgba(236,72,153,0.1); color: #ec4899; }
        .stat-mini-icon.barter { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .stat-mini-icon i { font-size: 20px; }
        .stat-mini-info { flex: 1; }
        .stat-mini-value { font-size: 18px; font-weight: 700; color: #1f2937; }
        .stat-mini-label { font-size: 11px; color: #6c757d; }
        .stat-mini-trend { font-size: 10px; margin-top: 2px; }
        .text-success { color: #10b981; }
        .charts-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 28px; }
        .chart-card { background: white; border-radius: 24px; padding: 20px; transition: all 0.3s ease; }
        .chart-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .chart-header { margin-bottom: 20px; }
        .chart-header h5 { font-size: 16px; font-weight: 600; margin: 0 0 4px 0; color: #1f2937; }
        .chart-header p { font-size: 12px; color: #6c757d; margin: 0; }
        .chart-body { height: 280px; }
        .two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
        .card-distribution, .card-contributors { background: white; border-radius: 24px; padding: 20px; }
        .card-header-custom { margin-bottom: 20px; }
        .card-header-custom h5 { font-size: 16px; font-weight: 600; margin: 0 0 4px 0; color: #1f2937; }
        .card-header-custom h5 i { margin-right: 8px; color: #4f46e5; }
        .card-header-custom p { font-size: 12px; color: #6c757d; margin: 0; }
        .donut-container { height: 200px; margin-bottom: 20px; }
        .no-data-message { display: flex; align-items: center; justify-content: center; height: 200px; color: #6c757d; }
        .legend-stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin-top: 16px; }
        .legend-item { display: flex; align-items: center; gap: 8px; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
        .legend-name { font-size: 13px; color: #4b5563; }
        .legend-count { font-weight: 600; color: #1f2937; }
        .contributors-list { display: flex; flex-direction: column; gap: 12px; }
        .contributor-item { display: flex; align-items: center; gap: 14px; padding: 12px; background: #f8f9fa; border-radius: 14px; transition: all 0.3s ease; }
        .contributor-item:hover { background: #e9ecef; }
        .contributor-rank { width: 40px; font-weight: 700; color: #4f46e5; font-size: 18px; }
        .contributor-info { flex: 1; }
        .contributor-name { font-weight: 600; color: #1f2937; }
        .contributor-stats { font-size: 11px; color: #6c757d; }
        .contributor-item i { color: #f59e0b; font-size: 20px; }
        .empty-contributors { text-align: center; padding: 40px; color: #9ca3af; }
        .online-section { background: white; border-radius: 24px; padding: 20px; margin-bottom: 28px; }
        .online-header { margin-bottom: 20px; }
        .online-header h5 { font-size: 16px; font-weight: 600; margin: 0 0 4px 0; color: #1f2937; }
        .online-header p { font-size: 12px; color: #6c757d; margin: 0; }
        .online-list { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .online-item { display: flex; align-items: center; gap: 12px; padding: 12px; background: #f8f9fa; border-radius: 14px; transition: all 0.3s ease; }
        .online-item:hover { background: #e9ecef; }
        .online-avatar { position: relative; width: 44px; height: 44px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; overflow: hidden; }
        .online-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .online-status-dot { position: absolute; bottom: 2px; right: 2px; width: 10px; height: 10px; background: #10b981; border-radius: 50%; border: 2px solid white; animation: pulse 2s infinite; }
        .online-info { flex: 1; }
        .online-name { font-weight: 600; color: #1f2937; font-size: 14px; }
        .online-time { font-size: 10px; color: #6c757d; }
        .empty-online { text-align: center; padding: 40px; color: #9ca3af; }
        .recent-table { background: white; border-radius: 24px; padding: 20px; margin-bottom: 28px; }
        .table-header, .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .table-header h5, .section-header h5 { font-size: 16px; font-weight: 600; margin: 0; color: #1f2937; }
        .table-header h5 i, .section-header h5 i { margin-right: 8px; color: #4f46e5; }
        .view-all { background: none; border: none; color: #4f46e5; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.3s ease; }
        .view-all:hover { gap: 10px; color: #7c3aed; }
        .custom-table { width: 100%; border-collapse: collapse; }
        .custom-table th { text-align: left; padding: 12px 16px; background: #f8f9fa; font-weight: 600; font-size: 13px; color: #495057; border-radius: 12px; }
        .custom-table td { padding: 16px; border-bottom: 1px solid #e9ecef; }
        .user-cell { display: flex; align-items: center; gap: 12px; }
        .user-avatar-sm { width: 40px; height: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; overflow: hidden; }
        .user-avatar-sm img { width: 100%; height: 100%; object-fit: cover; }
        .user-name-sm { font-weight: 600; color: #1f2937; margin-bottom: 4px; }
        .user-email { font-size: 11px; color: #6c757d; }
        .status-verified, .status-pending { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; }
        .status-verified { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .date-cell { font-size: 13px; color: #6c757d; }
        .badge-admin, .badge-farmer, .badge-vendor, .badge-pending { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .badge-admin { background: rgba(239,68,68,0.1); color: #ef4444; }
        .badge-farmer { background: rgba(16,185,129,0.1); color: #10b981; }
        .badge-vendor { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .badge-pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .recent-posts-section { background: white; border-radius: 24px; padding: 20px; margin-bottom: 28px; }
        .posts-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .post-card { background: #f8f9fa; border-radius: 16px; overflow: hidden; transition: all 0.3s ease; cursor: pointer; }
        .post-card:hover { transform: translateY(-4px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
        .post-card-image { height: 160px; overflow: hidden; }
        .post-card-image img { width: 100%; height: 100%; object-fit: cover; }
        .post-card-content { padding: 16px; }
        .post-card-content h6 { margin: 0 0 8px 0; font-size: 14px; font-weight: 600; }
        .post-card-content p { margin: 0 0 12px 0; font-size: 12px; color: #6c757d; line-height: 1.4; }
        .post-card-meta { display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
        .post-card-meta i { margin-right: 4px; }
        .recent-barter-section { background: white; border-radius: 24px; padding: 20px; margin-bottom: 28px; }
        .barter-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .barter-card { background: #f8f9fa; border-radius: 16px; padding: 16px; transition: all 0.3s ease; cursor: pointer; }
        .barter-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .barter-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .barter-card-header h6 { margin: 0; font-size: 14px; font-weight: 600; }
        .barter-card p { margin: 0 0 12px 0; font-size: 12px; color: #6c757d; line-height: 1.4; }
        .barter-card-meta { display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
        .barter-card-meta i { margin-right: 4px; }
        .barter-status { padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
        .barter-status.active { background: #d1fae5; color: #065f46; }
        .barter-status.inactive { background: #fee2e2; color: #991b1b; }
        .no-data-card { grid-column: span 3; text-align: center; padding: 60px 20px; color: #9ca3af; }
        .no-data-card i { font-size: 48px; margin-bottom: 12px; display: block; }
        .quick-actions { background: white; border-radius: 24px; padding: 20px; margin-bottom: 28px; }
        .quick-actions h5 { margin: 0 0 20px 0; font-size: 16px; font-weight: 600; }
        .quick-actions h5 i { margin-right: 8px; color: #4f46e5; }
        .actions-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
        .action-item { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px; background: #f8f9fa; border: none; border-radius: 16px; color: #495057; transition: all 0.3s ease; cursor: pointer; }
        .action-item:hover { background: #e9ecef; transform: translateY(-2px); }
        .action-item i { font-size: 24px; color: #4f46e5; }
        .action-item span { font-size: 12px; font-weight: 500; }
        @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.1); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        @media (max-width: 1200px) {
          .stats-grid { grid-template-columns: repeat(2,1fr); }
          .secondary-stats { grid-template-columns: repeat(3,1fr); }
          .charts-row, .two-columns { grid-template-columns: 1fr; }
          .online-list { grid-template-columns: repeat(2,1fr); }
          .posts-grid { grid-template-columns: repeat(2,1fr); }
          .barter-grid { grid-template-columns: repeat(2,1fr); }
          .actions-grid { grid-template-columns: repeat(3,1fr); }
        }
        @media (max-width: 768px) {
          .dashboard-wrapper { padding: 0 16px; }
          .stats-grid, .secondary-stats { grid-template-columns: 1fr; }
          .welcome-section { flex-direction: column; align-items: flex-start; }
          .online-list, .posts-grid, .barter-grid { grid-template-columns: 1fr; }
          .actions-grid { grid-template-columns: repeat(2,1fr); }
        }
      `}</style>
    </AdminLayout>
  )
}