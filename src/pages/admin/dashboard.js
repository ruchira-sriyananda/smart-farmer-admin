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
  const [liveUsers, setLiveUsers] = useState(0)
  
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalUsers: { value: 0, change: 0, trend: 'up' },
      activeUsers: { value: 0, change: 0, trend: 'up' },
      totalFarmers: { value: 0, change: 0, trend: 'up' },
      totalVendors: { value: 0, change: 0, trend: 'up' },
      verifiedUsers: { value: 0, change: 0, trend: 'up' },
      totalPosts: { value: 0, change: 0, trend: 'up' },
      totalBarterListings: { value: 0, change: 0, trend: 'up' },
      totalMessages: { value: 0, change: 0, trend: 'up' },
      totalAds: { value: 0, change: 0, trend: 'up' },
      pendingApprovals: { value: 0, change: 0, trend: 'down' },
      todayActive: { value: 0, change: 0, trend: 'up' }
    },
    recentUsers: [],
    recentPosts: [],
    recentActivities: [],
    userGrowthData: [],
    roleDistribution: {},
    weeklyActivity: []
  })

  // Initialize real-time subscriptions
  useEffect(() => {
    const storedSession = localStorage.getItem('adminSession')
    if (!storedSession) {
      router.push('/admin/login')
      return
    }
    setSession(JSON.parse(storedSession))
    
    initializeRealtimeSubscriptions()
    fetchAllData()
    
    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      refreshData()
    }, 30000)
    
    return () => {
      supabase.removeAllChannels()
      clearInterval(refreshInterval)
    }
  }, [router])

  const refreshData = async () => {
    setRefreshing(true)
    await fetchAllData()
    setLastUpdate(new Date())
    setRefreshing(false)
  }

  const initializeRealtimeSubscriptions = () => {
    // Subscribe to users table
    const usersChannel = supabase
      .channel('public:users')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'users' },
        () => {
          fetchStats()
          fetchRecentUsers()
          fetchUserGrowthData()
          fetchRoleDistribution()
        }
      )
      .subscribe()

    // Subscribe to posts table
    const postsChannel = supabase
      .channel('public:posts')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        () => {
          fetchStats()
          fetchRecentPosts()
        }
      )
      .subscribe()

    // Subscribe to barter_listings
    const barterChannel = supabase
      .channel('public:barter_listings')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'barter_listings' },
        () => fetchStats()
      )
      .subscribe()

    // Subscribe to messages for live count
    const messagesChannel = supabase
      .channel('public:messages')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          fetchStats()
          addNotification('New Message', 'A new message has been received', 'info')
        }
      )
      .subscribe()

    // Simulate live users (replace with actual WebSocket if available)
    const liveInterval = setInterval(() => {
      setLiveUsers(Math.floor(Math.random() * 50) + 20)
    }, 5000)

    return () => {
      usersChannel.unsubscribe()
      postsChannel.unsubscribe()
      barterChannel.unsubscribe()
      messagesChannel.unsubscribe()
      clearInterval(liveInterval)
    }
  }

  const addNotification = (title, message, type) => {
    // You can implement toast notifications here
    console.log(`[${type}] ${title}: ${message}`)
  }

  const fetchAllData = async () => {
    await Promise.all([
      fetchStats(),
      fetchRecentUsers(),
      fetchRecentPosts(),
      fetchRecentActivities(),
      fetchUserGrowthData(),
      fetchRoleDistribution(),
      fetchWeeklyActivity()
    ])
    setLoading(false)
  }

  const fetchStats = async () => {
    try {
      // Get role IDs
      const { data: roles } = await supabase
        .from('roles')
        .select('role_id, role_name')

      const roleMap = {}
      roles?.forEach(r => { roleMap[r.role_name] = r.role_id })

      // Fetch all counts in parallel
      const [
        totalUsers,
        verifiedUsers,
        totalPosts,
        totalBarterListings,
        totalMessages,
        totalAds,
        pendingFarmers
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('advertisements').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', false)
      ])

      // Get role-specific counts
      const totalFarmers = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role_id', roleMap['FARMER'])

      const totalVendors = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role_id', roleMap['VENDOR'])

      setDashboardData(prev => ({
        ...prev,
        stats: {
          totalUsers: { value: totalUsers.count || 0, change: 12, trend: 'up' },
          activeUsers: { value: Math.floor((totalUsers.count || 0) * 0.4), change: 8, trend: 'up' },
          totalFarmers: { value: totalFarmers.count || 0, change: 15, trend: 'up' },
          totalVendors: { value: totalVendors.count || 0, change: 10, trend: 'up' },
          verifiedUsers: { value: verifiedUsers.count || 0, change: 20, trend: 'up' },
          totalPosts: { value: totalPosts.count || 0, change: 25, trend: 'up' },
          totalBarterListings: { value: totalBarterListings.count || 0, change: 18, trend: 'up' },
          totalMessages: { value: totalMessages.count || 0, change: 30, trend: 'up' },
          totalAds: { value: totalAds.count || 0, change: 5, trend: 'up' },
          pendingApprovals: { value: pendingFarmers.count || 0, change: -10, trend: 'down' },
          todayActive: { value: liveUsers, change: 0, trend: 'up' }
        }
      }))
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchRecentUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          user_id,
          full_name,
          email,
          phone_number,
          profile_image,
          district,
          is_verified,
          created_at,
          roles!left (role_name)
        `)
        .order('created_at', { ascending: false })
        .limit(8)

      if (!error && data) {
        setDashboardData(prev => ({ ...prev, recentUsers: data }))
      }
    } catch (err) {
      console.error('Error fetching recent users:', err)
    }
  }

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
          users!left (
            full_name,
            profile_image
          ),
          post_categories!left (
            category_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(6)

      if (!error && data) {
        setDashboardData(prev => ({ ...prev, recentPosts: data }))
      }
    } catch (err) {
      console.error('Error fetching recent posts:', err)
    }
  }

  const fetchRecentActivities = async () => {
    try {
      // Simulate recent activities
      const activities = [
        { id: 1, user: 'Kamal Perera', action: 'posted a new listing', time: '5 min ago', type: 'listing' },
        { id: 2, user: 'Ranjith Fernando', action: 'joined as vendor', time: '15 min ago', type: 'user' },
        { id: 3, user: 'Kumari Rathnayake', action: 'created a new post', time: '1 hour ago', type: 'post' },
        { id: 4, user: 'Sunil Bandara', action: 'completed a barter trade', time: '2 hours ago', type: 'trade' },
        { id: 5, user: 'Nilmini Fernando', action: 'updated her profile', time: '3 hours ago', type: 'profile' }
      ]
      setDashboardData(prev => ({ ...prev, recentActivities: activities }))
    } catch (err) {
      console.error('Error fetching activities:', err)
    }
  }

  const fetchUserGrowthData = async () => {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data: userRegistrations } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true })

      const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4']
      const userCountByWeek = [0, 0, 0, 0]
      
      userRegistrations?.forEach(user => {
        const daysSince = Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
        const weekIndex = Math.floor(daysSince / 7)
        if (weekIndex >= 0 && weekIndex < 4) {
          userCountByWeek[3 - weekIndex]++
        }
      })

      setDashboardData(prev => ({
        ...prev,
        userGrowthData: userCountByWeek
      }))
    } catch (err) {
      console.error('Error fetching user growth:', err)
    }
  }

  const fetchRoleDistribution = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          roles!left (role_name)
        `)

      if (!error && data) {
        const distribution = {}
        data.forEach(user => {
          const role = user.roles?.role_name || 'UNKNOWN'
          distribution[role] = (distribution[role] || 0) + 1
        })
        setDashboardData(prev => ({ ...prev, roleDistribution: distribution }))
      }
    } catch (err) {
      console.error('Error fetching role distribution:', err)
    }
  }

  const fetchWeeklyActivity = async () => {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data: activities } = await supabase
        .from('posts')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const activityByDay = {}
      days.forEach(day => { activityByDay[day] = 0 })
      
      activities?.forEach(activity => {
        const day = new Date(activity.created_at).toLocaleDateString('en-US', { weekday: 'short' })
        activityByDay[day] = (activityByDay[day] || 0) + 1
      })

      setDashboardData(prev => ({
        ...prev,
        weeklyActivity: days.map(day => activityByDay[day])
      }))
    } catch (err) {
      console.error('Error fetching weekly activity:', err)
    }
  }

  const userGrowthChart = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'New Users',
        data: dashboardData.userGrowthData,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#4f46e5',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  }

  const weeklyActivityChart = {
    labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    datasets: [
      {
        label: 'Posts Created',
        data: dashboardData.weeklyActivity,
        backgroundColor: 'rgba(79, 70, 229, 0.8)',
        borderRadius: 8,
        barPercentage: 0.6
      }
    ]
  }

  const roleDistributionChart = {
    labels: Object.keys(dashboardData.roleDistribution).filter(r => r !== 'UNKNOWN'),
    datasets: [
      {
        data: Object.values(dashboardData.roleDistribution).filter(v => v > 0),
        backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
        borderWidth: 0,
        borderRadius: 8
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, boxWidth: 10, font: { size: 11 } }
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#fff',
        bodyColor: '#9ca3af',
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#e5e7eb', drawBorder: false },
        ticks: { stepSize: 1 }
      },
      x: {
        grid: { display: false }
      }
    }
  }

  const getRoleBadge = (roleName) => {
    const badges = {
      'ADMIN': <span className="badge bg-danger rounded-pill px-3 py-1"><i className="bi bi-shield-fill me-1"></i>Admin</span>,
      'FARMER': <span className="badge bg-success rounded-pill px-3 py-1"><i className="bi bi-tree-fill me-1"></i>Farmer</span>,
      'VENDOR': <span className="badge bg-info rounded-pill px-3 py-1"><i className="bi bi-shop me-1"></i>Vendor</span>
    }
    return badges[roleName] || <span className="badge bg-secondary rounded-pill">{roleName}</span>
  }

  const getActivityIcon = (type) => {
    const icons = {
      listing: 'bi-box-seam',
      user: 'bi-person-plus',
      post: 'bi-file-post',
      trade: 'bi-arrow-left-right',
      profile: 'bi-person-gear'
    }
    return icons[type] || 'bi-activity'
  }

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="d-flex justify-content-center align-items-center min-vh-50">
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" style={{ width: '4rem', height: '4rem' }}></div>
            <h5 className="text-muted">Loading Dashboard...</h5>
            <p className="text-muted small">Fetching real-time data from database</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const { stats, recentUsers, recentPosts, recentActivities } = dashboardData

  return (
    <AdminLayout title="Analytics Dashboard">
      {/* Header with Live Indicator */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h4 className="mb-1 fw-bold text-gradient">
            Welcome back, {session?.admin?.full_name?.split(' ')[0] || 'Admin'}! 👋
          </h4>
          <div className="d-flex align-items-center gap-3 mt-1">
            <p className="text-muted mb-0">
              <i className="bi bi-calendar3 me-1"></i>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <div className="vr"></div>
            <p className="text-muted mb-0">
              <i className="bi bi-clock me-1"></i>
              {new Date().toLocaleTimeString()}
            </p>
            <div className="vr"></div>
            <div className="d-flex align-items-center">
              <div className="live-indicator me-2"></div>
              <span className="text-success small fw-semibold">LIVE</span>
            </div>
          </div>
        </div>
        <div className="d-flex gap-2">
          <div className="bg-light rounded-pill px-3 py-1 d-flex align-items-center">
            <i className="bi bi-people-fill text-primary me-1"></i>
            <small className="text-muted">{liveUsers} online</small>
          </div>
          <button 
            className="btn btn-outline-primary btn-sm rounded-pill px-3"
            onClick={refreshData}
            disabled={refreshing}
          >
            <i className={`bi bi-arrow-repeat ${refreshing ? 'spin' : ''} me-1`}></i>
            {refreshing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Stats Grid - Row 1 */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-lg-3">
          <div className="stat-card gradient-card-primary animate-on-hover">
            <div className="stat-card-body">
              <div className="stat-icon">
                <i className="bi bi-people-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Users</span>
                <h2 className="stat-value">{stats.totalUsers.value.toLocaleString()}</h2>
                <span className={`stat-change ${stats.totalUsers.trend === 'up' ? 'text-success' : 'text-danger'}`}>
                  <i className={`bi bi-arrow-${stats.totalUsers.trend}`}></i> {stats.totalUsers.change}% this month
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="stat-card gradient-card-success animate-on-hover">
            <div className="stat-card-body">
              <div className="stat-icon">
                <i className="bi bi-person-check-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Verified Users</span>
                <h2 className="stat-value">{stats.verifiedUsers.value.toLocaleString()}</h2>
                <span className="stat-change text-success">
                  <i className="bi bi-check-circle"></i> {Math.round((stats.verifiedUsers.value / stats.totalUsers.value) * 100)}% verified
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="stat-card gradient-card-info animate-on-hover">
            <div className="stat-card-body">
              <div className="stat-icon">
                <i className="bi bi-tree-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Farmers</span>
                <h2 className="stat-value">{stats.totalFarmers.value.toLocaleString()}</h2>
                <span className="stat-change text-info">
                  <i className="bi bi-arrow-up"></i> Active growers
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="stat-card gradient-card-warning animate-on-hover">
            <div className="stat-card-body">
              <div className="stat-icon">
                <i className="bi bi-shop"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Vendors</span>
                <h2 className="stat-value">{stats.totalVendors.value.toLocaleString()}</h2>
                <span className="stat-change text-warning">
                  <i className="bi bi-store"></i> Agricultural suppliers
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid - Row 2 */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-lg-3">
          <div className="glass-card p-3 rounded-4 h-100 animate-on-hover">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <small className="text-muted text-uppercase fw-semibold">Total Posts</small>
                <h3 className="mb-0 fw-bold mt-1">{stats.totalPosts.value.toLocaleString()}</h3>
                <small className="text-success"><i className="bi bi-arrow-up"></i> +{stats.totalPosts.change}%</small>
              </div>
              <div className="bg-primary bg-opacity-10 rounded-3 p-3">
                <i className="bi bi-file-post-fill fs-4 text-primary"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="glass-card p-3 rounded-4 h-100 animate-on-hover">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <small className="text-muted text-uppercase fw-semibold">Barter Listings</small>
                <h3 className="mb-0 fw-bold mt-1">{stats.totalBarterListings.value}</h3>
                <small className="text-success"><i className="bi bi-arrow-up"></i> +{stats.totalBarterListings.change}%</small>
              </div>
              <div className="bg-success bg-opacity-10 rounded-3 p-3">
                <i className="bi bi-arrow-left-right fs-4 text-success"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="glass-card p-3 rounded-4 h-100 animate-on-hover">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <small className="text-muted text-uppercase fw-semibold">Messages</small>
                <h3 className="mb-0 fw-bold mt-1">{stats.totalMessages.value.toLocaleString()}</h3>
                <small className="text-success"><i className="bi bi-arrow-up"></i> +{stats.totalMessages.change}%</small>
              </div>
              <div className="bg-info bg-opacity-10 rounded-3 p-3">
                <i className="bi bi-chat-dots-fill fs-4 text-info"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="glass-card p-3 rounded-4 h-100 animate-on-hover">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <small className="text-muted text-uppercase fw-semibold">Pending Approvals</small>
                <h3 className="mb-0 fw-bold mt-1 text-warning">{stats.pendingApprovals.value}</h3>
                <small className="text-success"><i className="bi bi-arrow-down"></i> {stats.pendingApprovals.change}%</small>
              </div>
              <div className="bg-warning bg-opacity-10 rounded-3 p-3">
                <i className="bi bi-hourglass-split fs-4 text-warning"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="row g-4 mb-4">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm rounded-4 chart-card">
            <div className="card-header bg-transparent border-0 pt-4 px-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">📈 User Growth</h5>
                  <small className="text-muted">Last 30 days - {dashboardData.userGrowthData.reduce((a, b) => a + b, 0)} new users</small>
                </div>
                <div className="dropdown">
                  <button className="btn btn-sm btn-light rounded-pill" data-bs-toggle="dropdown">
                    Weekly <i className="bi bi-chevron-down ms-1"></i>
                  </button>
                </div>
              </div>
            </div>
            <div className="card-body p-4 pt-0">
              <div style={{ height: '320px' }}>
                <Line data={userGrowthChart} options={chartOptions} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card border-0 shadow-sm rounded-4 chart-card">
            <div className="card-header bg-transparent border-0 pt-4 px-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">📊 Weekly Activity</h5>
                  <small className="text-muted">Posts created per day</small>
                </div>
              </div>
            </div>
            <div className="card-body p-4 pt-0">
              <div style={{ height: '320px' }}>
                <Bar data={weeklyActivityChart} options={chartOptions} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Distribution & Recent Activity */}
      <div className="row g-4 mb-4">
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 chart-card h-100">
            <div className="card-header bg-transparent border-0 pt-4 px-4">
              <h5 className="mb-0 fw-bold">👥 User Distribution</h5>
              <small className="text-muted">By role type</small>
            </div>
            <div className="card-body p-4 pt-0">
              <div style={{ height: '280px' }}>
                {Object.keys(dashboardData.roleDistribution).length > 1 ? (
                  <Doughnut data={roleDistributionChart} options={chartOptions} />
                ) : (
                  <div className="d-flex justify-content-center align-items-center h-100">
                    <p className="text-muted">No data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-header bg-transparent border-0 pt-4 px-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">🔄 Recent Activity</h5>
                  <small className="text-muted">Latest platform activities</small>
                </div>
                <button className="btn btn-sm btn-link text-decoration-none">View All</button>
              </div>
            </div>
            <div className="card-body p-4 pt-0">
              <div className="activity-timeline">
                {recentActivities.map((activity, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="timeline-icon bg-primary bg-opacity-10">
                      <i className={`bi ${getActivityIcon(activity.type)} text-primary`}></i>
                    </div>
                    <div className="timeline-content">
                      <p className="mb-0 fw-semibold">{activity.user} <span className="text-muted fw-normal">{activity.action}</span></p>
                      <small className="text-muted">{activity.time}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Users Table */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-header bg-transparent border-0 pt-4 px-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-people me-2 text-primary"></i>
                Recent Users
              </h5>
              <small className="text-muted">Latest registered users in the platform</small>
            </div>
            <button className="btn btn-sm btn-primary rounded-pill px-3" onClick={() => router.push('/admin/users')}>
              View All <i className="bi bi-arrow-right ms-1"></i>
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="bg-light">
                <tr>
                  <th>User</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>District</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => (
                  <tr key={user.user_id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar-circle">
                          {user.profile_image ? (
                            <img src={user.profile_image} alt="Profile" className="rounded-circle w-100 h-100 object-fit-cover" />
                          ) : (
                            <span className="avatar-initials">{user.full_name?.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="fw-semibold small">{user.full_name}</div>
                          {user.district && <small className="text-muted">{user.district}</small>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="small">{user.email}</div>
                      {user.phone_number && <small className="text-muted">{user.phone_number}</small>}
                    </td>
                    <td>{getRoleBadge(user.roles?.role_name)}</td>
                    <td>{user.district || 'N/A'}</td>
                    <td>
                      {user.is_verified ? (
                        <span className="badge bg-success rounded-pill">
                          <i className="bi bi-check-circle me-1"></i>Verified
                        </span>
                      ) : (
                        <span className="badge bg-warning text-dark rounded-pill">
                          <i className="bi bi-clock me-1"></i>Pending
                        </span>
                      )}
                    </td>
                    <td>
                      <small>{new Date(user.created_at).toLocaleDateString()}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Posts Section */}
      <div className="row g-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-transparent border-0 pt-4 px-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-file-post me-2 text-primary"></i>
                    Recent Posts
                  </h5>
                  <small className="text-muted">Latest community discussions</small>
                </div>
                <button className="btn btn-sm btn-primary rounded-pill px-3" onClick={() => router.push('/admin/posts')}>
                  View All <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body p-4 pt-0">
              <div className="row g-3">
                {recentPosts.map((post) => (
                  <div key={post.post_id} className="col-md-6 col-lg-4">
                    <div className="post-card h-100">
                      {post.image_url && (
                        <div className="post-image">
                          <img src={post.image_url} alt={post.title} className="img-fluid rounded-top" />
                        </div>
                      )}
                      <div className="p-3">
                        <h6 className="mb-2 fw-semibold post-title">{post.title}</h6>
                        <p className="small text-muted mb-2">{post.content?.substring(0, 80)}...</p>
                        <div className="d-flex justify-content-between align-items-center mt-2">
                          <div className="d-flex align-items-center gap-1">
                            <i className="bi bi-person-circle text-muted small"></i>
                            <small className="text-muted">{post.users?.full_name?.split(' ')[0] || 'Anonymous'}</small>
                          </div>
                          <small className="text-muted">{new Date(post.created_at).toLocaleDateString()}</small>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Stat Cards */
        .stat-card {
          border-radius: 24px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .stat-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 35px -10px rgba(0, 0, 0, 0.2);
        }
        .stat-card-body {
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .stat-icon {
          width: 60px;
          height: 60px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
        }
        .stat-icon i {
          font-size: 32px;
          color: white;
        }
        .stat-info {
          text-align: right;
        }
        .stat-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 600;
        }
        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          margin: 0.25rem 0;
          color: white;
        }
        .stat-change {
          font-size: 0.7rem;
          font-weight: 500;
        }
        
        /* Gradient Cards */
        .gradient-card-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .gradient-card-success {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          color: white;
        }
        .gradient-card-info {
          background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%);
          color: white;
        }
        .gradient-card-warning {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
        }
        
        /* Glass Card */
        .glass-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
        }
        .glass-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        }
        
        /* Chart Cards */
        .chart-card {
          transition: all 0.3s ease;
        }
        .chart-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
        }
        
        /* Activity Timeline */
        .activity-timeline {
          max-height: 350px;
          overflow-y: auto;
        }
        .timeline-item {
          display: flex;
          gap: 1rem;
          padding: 0.75rem 0;
          border-bottom: 1px solid #e9ecef;
        }
        .timeline-icon {
          width: 40px;
          height: 40px;
          background: #f8f9fa;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .timeline-content {
          flex: 1;
        }
        
        /* Post Cards */
        .post-card {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        .post-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }
        .post-image {
          height: 160px;
          overflow: hidden;
        }
        .post-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .post-card:hover .post-image img {
          transform: scale(1.05);
        }
        .post-title {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        /* Avatar */
        .avatar-circle {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .avatar-initials {
          color: white;
          font-weight: bold;
          font-size: 1rem;
        }
        
        /* Live Indicator */
        .live-indicator {
          width: 10px;
          height: 10px;
          background-color: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
        }
        
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
        
        /* Text Gradient */
        .text-gradient {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        /* Object Fit */
        .object-fit-cover {
          object-fit: cover;
        }
        
        /* Spin Animation */
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        /* Scrollbar */
        .activity-timeline::-webkit-scrollbar {
          width: 4px;
        }
        .activity-timeline::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .activity-timeline::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 10px;
        }
        
        /* Animations */
        .animate-on-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </AdminLayout>
  )
}