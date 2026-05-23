import { useEffect, useState, useCallback } from 'react'
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
  const [onlineUsers, setOnlineUsers] = useState([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [greeting, setGreeting] = useState('')
  const [debugInfo, setDebugInfo] = useState(null)
  
  // Real data from database
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalFarmers, setTotalFarmers] = useState(0)
  const [totalVendors, setTotalVendors] = useState(0)
  const [totalAdmins, setTotalAdmins] = useState(0)
  const [verifiedUsers, setVerifiedUsers] = useState(0)
  const [pendingVerification, setPendingVerification] = useState(0)
  const [totalPosts, setTotalPosts] = useState(0)
  const [totalBarterListings, setTotalBarterListings] = useState(0)
  const [totalMessages, setTotalMessages] = useState(0)
  const [totalAds, setTotalAds] = useState(0)
  const [newUsersToday, setNewUsersToday] = useState(0)
  const [newPostsToday, setNewPostsToday] = useState(0)
  
  const [dashboardData, setDashboardData] = useState({
    recentUsers: [],
    recentPosts: [],
    recentActivities: [],
    userGrowthData: [0, 0, 0, 0],
    roleDistribution: {},
    weeklyActivity: [0, 0, 0, 0, 0, 0, 0]
  })

  // Set greeting based on time
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 18) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')
  }, [])

  // Fetch online users
  const fetchOnlineUsers = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data, error, count } = await supabase
        .from('online_users')
        .select('*')
        .gte('last_activity', fiveMinutesAgo)

      if (!error) {
        setOnlineUsers(data || [])
        setOnlineCount(count || 0)
      }
    } catch (err) {
      console.error('Error fetching online users:', err)
    }
  }

  // Fetch all stats from database
  const fetchAllStats = async () => {
    try {
      // Get role IDs
      const { data: roles, error: rolesError } = await supabase.from('roles').select('role_id, role_name')
      
      if (rolesError) {
        console.error('Roles error:', rolesError)
      }
      
      const roleMap = {}
      roles?.forEach(r => { roleMap[r.role_name] = r.role_id })

      // Get today's date range
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Fetch all counts in parallel with error handling
      const [
        totalUsersRes,
        farmersRes,
        vendorsRes,
        adminsRes,
        verifiedRes,
        pendingRes,
        postsRes,
        barterRes,
        messagesRes,
        adsRes,
        newUsersRes,
        newPostsRes
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        roleMap['FARMER'] ? supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['FARMER']) : Promise.resolve({ count: 0 }),
        roleMap['VENDOR'] ? supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['VENDOR']) : Promise.resolve({ count: 0 }),
        roleMap['ADMIN'] ? supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['ADMIN']) : Promise.resolve({ count: 0 }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', false),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('advertisements').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString())
      ])

      setTotalUsers(totalUsersRes.count || 0)
      setTotalFarmers(farmersRes.count || 0)
      setTotalVendors(vendorsRes.count || 0)
      setTotalAdmins(adminsRes.count || 0)
      setVerifiedUsers(verifiedRes.count || 0)
      setPendingVerification(pendingRes.count || 0)
      setTotalPosts(postsRes.count || 0)
      setTotalBarterListings(barterRes.count || 0)
      setTotalMessages(messagesRes.count || 0)
      setTotalAds(adsRes.count || 0)
      setNewUsersToday(newUsersRes.count || 0)
      setNewPostsToday(newPostsRes.count || 0)

      console.log('Stats fetched:', {
        totalUsers: totalUsersRes.count,
        farmers: farmersRes.count,
        vendors: vendorsRes.count
      })

    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  // Fetch recent users - FIXED VERSION
  const fetchRecentUsers = async () => {
    try {
      // First, get all users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (usersError) {
        console.error('Users fetch error:', usersError)
        return
      }

      console.log('Users found:', users?.length || 0)

      if (users && users.length > 0) {
        // Get role names for each user
        const { data: roles } = await supabase.from('roles').select('role_id, role_name')
        const roleMap = {}
        roles?.forEach(r => { roleMap[r.role_id] = r.role_name })

        const usersWithRoles = users.map(user => ({
          ...user,
          roles: { role_name: roleMap[user.role_id] || 'PENDING' }
        }))

        setDashboardData(prev => ({ ...prev, recentUsers: usersWithRoles.slice(0, 6) }))
      } else {
        setDashboardData(prev => ({ ...prev, recentUsers: [] }))
      }
    } catch (err) {
      console.error('Error fetching users:', err)
      setDashboardData(prev => ({ ...prev, recentUsers: [] }))
    }
  }

  // Fetch recent posts
  const fetchRecentPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          post_id,
          title,
          content,
          image_url,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false })
        .limit(4)

      if (!error && data) {
        // Get user names for posts
        const userIds = [...new Set(data.map(p => p.user_id))]
        const { data: users } = await supabase
          .from('users')
          .select('user_id, full_name')
          .in('user_id', userIds)
        
        const userMap = {}
        users?.forEach(u => { userMap[u.user_id] = u.full_name })

        const postsWithUsers = data.map(post => ({
          ...post,
          users: { full_name: userMap[post.user_id] || 'Unknown' }
        }))

        setDashboardData(prev => ({ ...prev, recentPosts: postsWithUsers }))
      }
    } catch (err) { console.error('Error:', err) }
  }

  // Fetch user growth data from database
  const fetchUserGrowth = async () => {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true })

      const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4']
      const weeklyCounts = [0, 0, 0, 0]
      
      data?.forEach(user => {
        const daysSince = Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
        const weekIndex = Math.floor(daysSince / 7)
        if (weekIndex >= 0 && weekIndex < 4) weeklyCounts[3 - weekIndex]++
      })

      setDashboardData(prev => ({ ...prev, userGrowthData: weeklyCounts }))
    } catch (err) { console.error('Error:', err) }
  }

  // Fetch role distribution from database
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
      
      setDashboardData(prev => ({ ...prev, roleDistribution: distribution }))
    } catch (err) { console.error('Error:', err) }
  }

  // Fetch weekly activity from database
  const fetchWeeklyActivity = async () => {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data } = await supabase
        .from('posts')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const activityByDay = [0, 0, 0, 0, 0, 0, 0]
      
      data?.forEach(post => {
        const dayIndex = new Date(post.created_at).getDay()
        const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1
        if (adjustedIndex >= 0 && adjustedIndex < 7) activityByDay[adjustedIndex]++
      })

      setDashboardData(prev => ({ ...prev, weeklyActivity: activityByDay }))
    } catch (err) { console.error('Error:', err) }
  }

  useEffect(() => {
    const init = async () => {
      const storedSession = localStorage.getItem('adminSession')
      if (!storedSession) { router.push('/admin/login'); return }
      setSession(JSON.parse(storedSession))
      
      await Promise.all([
        fetchAllStats(),
        fetchRecentUsers(),
        fetchRecentPosts(),
        fetchUserGrowth(),
        fetchRoleDistribution(),
        fetchWeeklyActivity(),
        fetchOnlineUsers()
      ])
      setLoading(false)
    }
    init()

    const interval = setInterval(() => {
      fetchAllStats()
      fetchOnlineUsers()
      setLastUpdate(new Date())
    }, 30000)

    return () => clearInterval(interval)
  }, [router])

  const refreshData = async () => {
    setRefreshing(true)
    await Promise.all([
      fetchAllStats(),
      fetchRecentUsers(),
      fetchRecentPosts(),
      fetchUserGrowth(),
      fetchRoleDistribution(),
      fetchWeeklyActivity(),
      fetchOnlineUsers()
    ])
    setLastUpdate(new Date())
    setRefreshing(false)
  }

  // Chart configurations
  const userGrowthChart = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [{
      label: 'New Users',
      data: dashboardData.userGrowthData,
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
      data: dashboardData.weeklyActivity,
      backgroundColor: 'rgba(79, 70, 229, 0.8)',
      borderRadius: 10,
      barPercentage: 0.65
    }]
  }

  const roleDistributionChart = {
    labels: Object.keys(dashboardData.roleDistribution),
    datasets: [{
      data: Object.values(dashboardData.roleDistribution),
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
    scales: { y: { beginAtZero: true, grid: { color: '#e5e7eb' }, ticks: { stepSize: 1 } }, x: { grid: { display: false } } }
  }

  const getRoleBadge = (roleName) => {
    const badges = {
      'ADMIN': <span className="badge-admin"><i className="bi bi-shield-fill me-1"></i>Admin</span>,
      'FARMER': <span className="badge-farmer"><i className="bi bi-tree-fill me-1"></i>Farmer</span>,
      'VENDOR': <span className="badge-vendor"><i className="bi bi-shop me-1"></i>Vendor</span>
    }
    return badges[roleName] || <span className="badge-pending"><i className="bi bi-clock me-1"></i>Pending</span>
  }

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading dashboard...</p>
        </div>
      </AdminLayout>
    )
  }

  const { recentUsers, recentPosts } = dashboardData

  return (
    <AdminLayout title="Analytics Dashboard">
      {/* Enhanced Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <div className="greeting-badge">
            <span className="greeting-icon">👋</span>
            <span className="greeting-text">{greeting},</span>
            <span className="user-name">{session?.admin?.full_name?.split(' ')[0] || 'Admin'}</span>
          </div>
          <div className="date-time">
            <i className="bi bi-calendar3"></i>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            <span className="separator">|</span>
            <i className="bi bi-clock"></i>
            {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div className="header-right">
          <div className="live-badge">
            <span className="live-dot"></span>
            <span>LIVE</span>
          </div>
          <button className="sync-btn" onClick={refreshData} disabled={refreshing}>
            <i className={`bi bi-arrow-repeat ${refreshing ? 'spin' : ''}`}></i>
            {refreshing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Hero Stats Cards - ALL DATA FROM DATABASE */}
      <div className="hero-stats">
        <div className="stat-card-hero stat-primary">
          <div className="stat-icon-large">
            <i className="bi bi-people-fill"></i>
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Users</span>
            <h2 className="stat-number">{totalUsers.toLocaleString()}</h2>
            <span className="stat-trend"><i className="bi bi-graph-up"></i> +{Math.round((newUsersToday / Math.max(totalUsers, 1)) * 100)}% today</span>
          </div>
        </div>
        <div className="stat-card-hero stat-success">
          <div className="stat-icon-large">
            <i className="bi bi-tree-fill"></i>
          </div>
          <div className="stat-content">
            <span className="stat-label">Farmers</span>
            <h2 className="stat-number">{totalFarmers.toLocaleString()}</h2>
            <span className="stat-trend"><i className="bi bi-person-check"></i> {Math.round((totalFarmers / Math.max(totalUsers, 1)) * 100)}% of users</span>
          </div>
        </div>
        <div className="stat-card-hero stat-info">
          <div className="stat-icon-large">
            <i className="bi bi-shop"></i>
          </div>
          <div className="stat-content">
            <span className="stat-label">Vendors</span>
            <h2 className="stat-number">{totalVendors.toLocaleString()}</h2>
            <span className="stat-trend"><i className="bi bi-person-check"></i> {Math.round((totalVendors / Math.max(totalUsers, 1)) * 100)}% of users</span>
          </div>
        </div>
        <div className="stat-card-hero stat-warning">
          <div className="stat-icon-large">
            <i className="bi bi-wifi"></i>
          </div>
          <div className="stat-content">
            <span className="stat-label">Online Now</span>
            <h2 className="stat-number">{onlineCount}</h2>
            <span className="stat-trend"><i className="bi bi-person-check"></i> Active users</span>
          </div>
        </div>
      </div>

      {/* Secondary Stats Grid */}
      <div className="secondary-stats">
        <div className="stat-card-mini">
          <i className="bi bi-shield-check stat-mini-icon success"></i>
          <div>
            <div className="stat-mini-value">{verifiedUsers.toLocaleString()}</div>
            <div className="stat-mini-label">Verified Users</div>
            <div className="stat-mini-change">{Math.round((verifiedUsers / Math.max(totalUsers, 1)) * 100)}% of total</div>
          </div>
        </div>
        <div className="stat-card-mini">
          <i className="bi bi-hourglass-split stat-mini-icon warning"></i>
          <div>
            <div className="stat-mini-value">{pendingVerification}</div>
            <div className="stat-mini-label">Pending Approval</div>
            <div className="stat-mini-change">Awaiting verification</div>
          </div>
        </div>
        <div className="stat-card-mini">
          <i className="bi bi-file-post stat-mini-icon primary"></i>
          <div>
            <div className="stat-mini-value">{totalPosts.toLocaleString()}</div>
            <div className="stat-mini-label">Total Posts</div>
            <div className="stat-mini-change text-success">+{newPostsToday} new today</div>
          </div>
        </div>
        <div className="stat-card-mini">
          <i className="bi bi-arrow-left-right stat-mini-icon info"></i>
          <div>
            <div className="stat-mini-value">{totalBarterListings}</div>
            <div className="stat-mini-label">Barter Listings</div>
            <div className="stat-mini-change">Active trades</div>
          </div>
        </div>
        <div className="stat-card-mini">
          <i className="bi bi-chat-dots stat-mini-icon info"></i>
          <div>
            <div className="stat-mini-value">{totalMessages.toLocaleString()}</div>
            <div className="stat-mini-label">Messages</div>
            <div className="stat-mini-change text-success">Total conversations</div>
          </div>
        </div>
        <div className="stat-card-mini">
          <i className="bi bi-megaphone stat-mini-icon primary"></i>
          <div>
            <div className="stat-mini-value">{totalAds}</div>
            <div className="stat-mini-label">Active Ads</div>
            <div className="stat-mini-change">Live campaigns</div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h5>📈 User Growth Trend</h5>
              <p>Last 30 days user registration - {dashboardData.userGrowthData.reduce((a, b) => a + b, 0)} new users</p>
            </div>
          </div>
          <div className="chart-body">
            <Line data={userGrowthChart} options={chartOptions} />
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h5>📊 Platform Activity</h5>
              <p>Weekly posts and interactions - {dashboardData.weeklyActivity.reduce((a, b) => a + b, 0)} total this week</p>
            </div>
          </div>
          <div className="chart-body">
            <Bar data={weeklyActivityChart} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* User Distribution & Online Users */}
      <div className="two-columns">
        <div className="distribution-card">
          <div className="card-header-custom">
            <h5><i className="bi bi-pie-chart"></i> User Distribution</h5>
            <p>Breakdown by role type - {totalUsers} total users</p>
          </div>
          <div className="distribution-body">
            <div className="donut-container">
              <Doughnut data={roleDistributionChart} options={chartOptions} />
            </div>
            <div className="legend-stats">
              {Object.entries(dashboardData.roleDistribution).map(([role, count]) => (
                <div key={role} className="legend-item">
                  <span className={`legend-dot ${role.toLowerCase()}`} style={{ background: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 4)] }}></span>
                  <span className="legend-name">{role}</span>
                  <span className="legend-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="online-card">
          <div className="card-header-custom">
            <h5><i className="bi bi-wifi"></i> Online Users</h5>
            <p>Active in last 5 minutes - {onlineCount} online now</p>
          </div>
          <div className="online-list">
            {onlineUsers.length > 0 ? (
              onlineUsers.map((user, idx) => (
                <div key={idx} className="online-item">
                  <div className="online-avatar">
                    <span>{user.user_name?.charAt(0) || 'U'}</span>
                    <span className="online-status-dot"></span>
                  </div>
                  <div className="online-info">
                    <div className="online-name">{user.user_name || 'User'}</div>
                    <div className="online-role">{user.user_role || 'Member'}</div>
                  </div>
                  <i className="bi bi-check-circle-fill online-check"></i>
                </div>
              ))
            ) : (
              <div className="empty-online">
                <i className="bi bi-person-slash"></i>
                <p>No users online</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Users Table - FIXED */}
      <div className="recent-table">
        <div className="table-header">
          <div>
            <h5><i className="bi bi-people"></i> Recent Users</h5>
            <p>Latest registered members - {recentUsers.length} users found</p>
          </div>
          <button className="view-all-btn" onClick={() => router.push('/admin/users')}>
            View All <i className="bi bi-arrow-right"></i>
          </button>
        </div>
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Contact</th>
                <th>Role</th>
                <th>Location</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.length > 0 ? (
                recentUsers.map((user) => (
                  <tr key={user.user_id}>
                    <tr>
                      <div className="user-cell">
                        <div className="user-avatar-sm">
                          {user.profile_image ? (
                            <img src={user.profile_image} alt={user.full_name} />
                          ) : (
                            <span>{user.full_name?.charAt(0) || 'U'}</span>
                          )}
                        </div>
                        <div>
                          <div className="user-name">{user.full_name || 'Unknown'}</div>
                          {user.district && <div className="user-location">{user.district}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="contact-cell">
                        <div className="contact-email">{user.email || 'No email'}</div>
                        {user.phone_number && <div className="contact-phone">{user.phone_number}</div>}
                      </div>
                    </td>
                    <td>{getRoleBadge(user.roles?.role_name)}</td>
                    <td>{user.district || '—'}</td>
                    <td>
                      {user.is_verified ? (
                        <span className="status-badge verified"><i className="bi bi-check-circle"></i> Verified</span>
                      ) : (
                        <span className="status-badge pending"><i className="bi bi-clock"></i> Pending</span>
                      )}
                    </td>
                    <td className="date-cell">{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-muted">
                    No users found in database. Please add some users.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Posts Grid */}
      <div className="recent-posts">
        <div className="section-header">
          <div>
            <h5><i className="bi bi-file-post"></i> Recent Posts</h5>
            <p>Latest community discussions - {recentPosts.length} recent posts</p>
          </div>
          <button className="view-all-btn" onClick={() => router.push('/admin/posts')}>
            View All <i className="bi bi-arrow-right"></i>
          </button>
        </div>
        <div className="posts-grid">
          {recentPosts.length > 0 ? (
            recentPosts.map((post) => (
              <div key={post.post_id} className="post-card-modern">
                {post.image_url && (
                  <div className="post-image-modern">
                    <img src={post.image_url} alt={post.title} />
                  </div>
                )}
                <div className="post-content-modern">
                  <h6>{post.title}</h6>
                  <p>{post.content?.substring(0, 80)}...</p>
                  <div className="post-meta">
                    <div className="post-author">
                      <i className="bi bi-person-circle"></i>
                      <span>{post.users?.full_name?.split(' ')[0] || 'User'}</span>
                    </div>
                    <div className="post-date">
                      <i className="bi bi-calendar3"></i>
                      <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-12 text-center py-5 text-muted">
              No posts found
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .greeting-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        
        .greeting-icon {
          font-size: 28px;
        }
        
        .greeting-text {
          font-size: 24px;
          font-weight: 500;
          color: #6c757d;
        }
        
        .user-name {
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .date-time {
          color: #6c757d;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .date-time i {
          margin-right: 6px;
        }
        
        .separator {
          color: #dee2e6;
        }
        
        .header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .live-badge {
          background: rgba(16, 185, 129, 0.1);
          padding: 6px 14px;
          border-radius: 30px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #10b981;
        }
        
        .live-dot {
          width: 8px;
          height: 8px;
          background-color: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        
        .sync-btn {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          padding: 6px 18px;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 500;
          color: #495057;
          transition: all 0.3s ease;
        }
        
        .sync-btn:hover {
          background: #e9ecef;
          transform: translateY(-1px);
        }
        
        .hero-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }
        
        .stat-card-hero {
          background: white;
          border-radius: 24px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .stat-card-hero:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }
        
        .stat-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .stat-success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; }
        .stat-info { background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%); color: white; }
        .stat-warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; }
        
        .stat-icon-large {
          width: 64px;
          height: 64px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .stat-icon-large i { font-size: 32px; }
        
        .stat-content { flex: 1; }
        .stat-label { font-size: 13px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; }
        .stat-number { font-size: 32px; font-weight: 700; margin: 4px 0; }
        .stat-trend { font-size: 12px; opacity: 0.9; display: flex; align-items: center; gap: 4px; }
        
        .secondary-stats {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 16px;
          margin-bottom: 28px;
        }
        
        .stat-card-mini {
          background: white;
          border-radius: 20px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: all 0.3s ease;
        }
        
        .stat-card-mini:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08); }
        
        .stat-mini-icon {
          font-size: 24px;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
        }
        
        .stat-mini-icon.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-mini-icon.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .stat-mini-icon.primary { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .stat-mini-icon.info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        
        .stat-mini-value { font-size: 20px; font-weight: 700; color: #1f2937; }
        .stat-mini-label { font-size: 11px; color: #6c757d; }
        .stat-mini-change { font-size: 10px; margin-top: 4px; }
        .text-success { color: #10b981; }
        
        .charts-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-bottom: 28px;
        }
        
        .chart-card {
          background: white;
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: all 0.3s ease;
        }
        
        .chart-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
        
        .chart-header { margin-bottom: 20px; }
        .chart-header h5 { font-size: 16px; font-weight: 600; margin-bottom: 4px; color: #1f2937; }
        .chart-header p { font-size: 12px; color: #6c757d; margin: 0; }
        
        .chart-body { height: 300px; }
        
        .two-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }
        
        .distribution-card, .online-card {
          background: white;
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        
        .card-header-custom { margin-bottom: 20px; }
        .card-header-custom h5 { font-size: 16px; font-weight: 600; margin-bottom: 4px; color: #1f2937; }
        .card-header-custom h5 i { margin-right: 8px; color: #4f46e5; }
        .card-header-custom p { font-size: 12px; color: #6c757d; margin: 0; }
        
        .donut-container { height: 200px; margin-bottom: 20px; }
        
        .legend-stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin-top: 16px; }
        .legend-item { display: flex; align-items: center; gap: 8px; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
        .legend-name { font-size: 13px; color: #4b5563; }
        .legend-count { font-weight: 600; color: #1f2937; }
        
        .online-list {
          max-height: 280px;
          overflow-y: auto;
        }
        
        .online-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 16px;
          transition: all 0.3s ease;
        }
        
        .online-item:hover { background: #f8f9fa; }
        
        .online-avatar {
          position: relative;
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
        }
        
        .online-status-dot {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 12px;
          height: 12px;
          background: #10b981;
          border-radius: 50%;
          border: 2px solid white;
          animation: pulse 2s infinite;
        }
        
        .online-info { flex: 1; }
        .online-name { font-weight: 600; color: #1f2937; }
        .online-role { font-size: 11px; color: #6c757d; }
        .online-check { color: #10b981; font-size: 18px; }
        
        .empty-online { text-align: center; padding: 40px; color: #6c757d; }
        .empty-online i { font-size: 48px; margin-bottom: 12px; display: block; }
        
        .recent-table {
          background: white;
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 28px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        
        .table-header, .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .table-header h5, .section-header h5 { font-size: 16px; font-weight: 600; margin: 0; color: #1f2937; }
        .table-header h5 i, .section-header h5 i { margin-right: 8px; color: #4f46e5; }
        .table-header p, .section-header p { font-size: 12px; color: #6c757d; margin: 4px 0 0 0; }
        
        .view-all-btn {
          background: none;
          border: none;
          color: #4f46e5;
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.3s ease;
        }
        
        .view-all-btn:hover { gap: 10px; }
        
        .custom-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .custom-table th {
          text-align: left;
          padding: 12px 16px;
          background: #f8f9fa;
          font-weight: 600;
          font-size: 13px;
          color: #495057;
        }
        
        .custom-table td {
          padding: 16px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .user-cell { display: flex; align-items: center; gap: 12px; }
        .user-avatar-sm {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          overflow: hidden;
        }
        .user-avatar-sm img { width: 100%; height: 100%; object-fit: cover; }
        .user-name { font-weight: 600; color: #1f2937; margin-bottom: 4px; }
        .user-location { font-size: 11px; color: #6c757d; }
        
        .contact-cell { display: flex; flex-direction: column; gap: 4px; }
        .contact-email { font-size: 13px; color: #1f2937; }
        .contact-phone { font-size: 11px; color: #6c757d; }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .status-badge.verified { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-badge.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        
        .badge-admin, .badge-farmer, .badge-vendor, .badge-pending {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .badge-admin { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .badge-farmer { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .badge-vendor { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .badge-pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        
        .date-cell { color: #6c757d; font-size: 13px; }
        
        .posts-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        
        .post-card-modern {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        
        .post-card-modern:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1); }
        
        .post-image-modern {
          height: 140px;
          overflow: hidden;
        }
        
        .post-image-modern img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        
        .post-card-modern:hover .post-image-modern img { transform: scale(1.05); }
        
        .post-content-modern { padding: 16px; }
        .post-content-modern h6 { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #1f2937; }
        .post-content-modern p { font-size: 12px; color: #6c757d; margin-bottom: 12px; line-height: 1.4; }
        
        .post-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #6c757d;
        }
        
        .post-author, .post-date { display: flex; align-items: center; gap: 4px; }
        
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
        
        .loading-text { color: #6c757d; font-size: 14px; }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .spin { animation: spin 1s linear infinite; }
        
        @media (max-width: 1400px) {
          .secondary-stats { grid-template-columns: repeat(3, 1fr); }
        }
        
        @media (max-width: 1200px) {
          .hero-stats { grid-template-columns: repeat(2, 1fr); }
          .charts-row, .two-columns { grid-template-columns: 1fr; }
          .posts-grid { grid-template-columns: repeat(2, 1fr); }
          .secondary-stats { grid-template-columns: repeat(2, 1fr); }
        }
        
        @media (max-width: 768px) {
          .hero-stats { grid-template-columns: 1fr; }
          .secondary-stats { grid-template-columns: 1fr; }
          .posts-grid { grid-template-columns: 1fr; }
          .dashboard-header { flex-direction: column; }
        }
      `}</style>
    </AdminLayout>
  )
}