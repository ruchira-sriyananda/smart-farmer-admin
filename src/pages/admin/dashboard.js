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
  const [greeting, setGreeting] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  
  // Real data from Supabase
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFarmers: 0,
    totalVendors: 0,
    totalAdmins: 0,
    verifiedUsers: 0,
    pendingVerification: 0,
    totalPosts: 0,
    totalBarterListings: 0,
    totalMessages: 0,
    totalAds: 0,
    newUsersToday: 0,
    newPostsToday: 0,
    activeBarterTrades: 0,
    activeSessions: 0
  })
  
  const [onlineUsers, setOnlineUsers] = useState([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [recentUsers, setRecentUsers] = useState([])
  const [recentPosts, setRecentPosts] = useState([])
  const [userGrowthData, setUserGrowthData] = useState([])
  const [roleDistribution, setRoleDistribution] = useState({})
  const [weeklyActivity, setWeeklyActivity] = useState([])
  const [recentActivities, setRecentActivities] = useState([])
  const [pendingAlerts, setPendingAlerts] = useState(0)

  // Set greeting based on time
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 18) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')
  }, [])

  // Fetch all data from Supabase
  const fetchAllData = async () => {
    await Promise.all([
      fetchStats(),
      fetchOnlineUsers(),
      fetchRecentUsers(),
      fetchRecentPosts(),
      fetchUserGrowth(),
      fetchRoleDistribution(),
      fetchWeeklyActivity(),
      fetchRecentActivities(),
      fetchPendingAlerts()
    ])
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
        newPostsRes,
        activeBarterRes,
        activeSessionsRes
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['FARMER']),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['VENDOR']),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', false),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('advertisements').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('user_sessions').select('*', { count: 'exact', head: true }).eq('session_status', 'ACTIVE')
      ])

      setStats({
        totalUsers: totalUsersRes.count || 0,
        totalFarmers: farmersRes.count || 0,
        totalVendors: vendorsRes.count || 0,
        totalAdmins: adminsRes.count || 0,
        verifiedUsers: verifiedRes.count || 0,
        pendingVerification: pendingRes.count || 0,
        totalPosts: postsRes.count || 0,
        totalBarterListings: barterRes.count || 0,
        totalMessages: messagesRes.count || 0,
        totalAds: adsRes.count || 0,
        newUsersToday: newUsersRes.count || 0,
        newPostsToday: newPostsRes.count || 0,
        activeBarterTrades: activeBarterRes.count || 0,
        activeSessions: activeSessionsRes.count || 0
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchOnlineUsers = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data, error, count } = await supabase
        .from('online_users')
        .select('user_id, user_name, user_role')
        .gte('last_activity', fiveMinutesAgo)

      if (!error) {
        setOnlineUsers(data || [])
        setOnlineCount(count || 0)
      }
    } catch (err) {
      console.error('Error fetching online users:', err)
    }
  }

  const fetchRecentUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('user_id, full_name, email, profile_image, is_verified, created_at, roles!left(role_name)')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!error && data) setRecentUsers(data)
    } catch (err) { console.error('Error:', err) }
  }

  const fetchRecentPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('post_id, title, created_at, users!left(full_name)')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!error && data) setRecentPosts(data)
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

      const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4']
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
      const { data } = await supabase.from('users').select('roles!left(role_name)')
      if (data) {
        const distribution = {}
        data.forEach(user => {
          const role = user.roles?.role_name || 'PENDING'
          distribution[role] = (distribution[role] || 0) + 1
        })
        setRoleDistribution(distribution)
      }
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

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const activityByDay = [0, 0, 0, 0, 0, 0, 0]
      
      data?.forEach(post => {
        const dayIndex = new Date(post.created_at).getDay()
        const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1
        if (adjustedIndex >= 0 && adjustedIndex < 7) activityByDay[adjustedIndex]++
      })

      setWeeklyActivity(activityByDay)
    } catch (err) { console.error('Error:', err) }
  }

  const fetchRecentActivities = async () => {
    try {
      const { data } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
      
      setRecentActivities(data || [])
    } catch (err) { console.error('Error:', err) }
  }

  const fetchPendingAlerts = async () => {
    try {
      const { count } = await supabase
        .from('security_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false)
      
      setPendingAlerts(count || 0)
    } catch (err) { console.error('Error:', err) }
  }

  useEffect(() => {
    const init = async () => {
      const storedSession = localStorage.getItem('adminSession')
      if (!storedSession) { router.push('/admin/login'); return }
      setSession(JSON.parse(storedSession))
      
      await fetchAllData()
      
      // Real-time subscriptions
      const usersChannel = supabase
        .channel('users_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchStats())
        .subscribe()

      const postsChannel = supabase
        .channel('posts_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchStats())
        .subscribe()

      const onlineChannel = supabase
        .channel('online_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'online_users' }, () => fetchOnlineUsers())
        .subscribe()

      const interval = setInterval(() => {
        fetchStats()
        fetchOnlineUsers()
        setLastUpdate(new Date())
      }, 30000)

      return () => {
        usersChannel.unsubscribe()
        postsChannel.unsubscribe()
        onlineChannel.unsubscribe()
        clearInterval(interval)
      }
    }
    
    init()
  }, [router])

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
      label: 'Activities',
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
    <AdminLayout title="Analytics Dashboard">
      <div className="dashboard-wrapper">
        {/* Welcome Section */}
        <div className="welcome-section">
          <div className="welcome-text">
            <div className="greeting">{greeting} 👋</div>
            <h1 className="welcome-title">
              Welcome back, <span className="user-name">{session?.admin?.full_name?.split(' ')[0] || 'Admin'}</span>
            </h1>
            <p className="welcome-subtitle">
              Here's your platform performance overview for today
            </p>
          </div>
          <div className="header-actions">
            <div className="live-badge">
              <span className="live-dot"></span>
              <span>LIVE DATA</span>
            </div>
            <div className="last-update">
              <i className="bi bi-clock"></i>
              Updated: {lastUpdate.toLocaleTimeString()}
            </div>
            <button className="refresh-btn" onClick={refreshData} disabled={refreshing}>
              <i className={`bi bi-arrow-repeat ${refreshing ? 'spin' : ''}`}></i>
            </button>
          </div>
        </div>

        {/* Stats Cards Grid */}
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-card-icon">
              <i className="bi bi-people-fill"></i>
            </div>
            <div className="stat-card-content">
              <span className="stat-label">Total Users</span>
              <h2 className="stat-value">{stats.totalUsers.toLocaleString()}</h2>
              <span className="stat-change positive">
                <i className="bi bi-arrow-up"></i> +{stats.newUsersToday} today
              </span>
            </div>
          </div>
          <div className="stat-card success">
            <div className="stat-card-icon">
              <i className="bi bi-tree-fill"></i>
            </div>
            <div className="stat-card-content">
              <span className="stat-label">Farmers</span>
              <h2 className="stat-value">{stats.totalFarmers.toLocaleString()}</h2>
              <span className="stat-change positive">
                <i className="bi bi-check-circle"></i> Active growers
              </span>
            </div>
          </div>
          <div className="stat-card info">
            <div className="stat-card-icon">
              <i className="bi bi-shop"></i>
            </div>
            <div className="stat-card-content">
              <span className="stat-label">Vendors</span>
              <h2 className="stat-value">{stats.totalVendors.toLocaleString()}</h2>
              <span className="stat-change positive">
                <i className="bi bi-store"></i> Suppliers
              </span>
            </div>
          </div>
          <div className="stat-card warning">
            <div className="stat-card-icon">
              <i className="bi bi-arrow-left-right"></i>
            </div>
            <div className="stat-card-content">
              <span className="stat-label">Active Barter</span>
              <h2 className="stat-value">{stats.activeBarterTrades}</h2>
              <span className="stat-change">
                <i className="bi bi-graph-up"></i> Active trades
              </span>
            </div>
          </div>
        </div>

        {/* Secondary Stats Row */}
        <div className="secondary-stats">
          <div className="stat-card-mini">
            <div className="stat-mini-icon verified">
              <i className="bi bi-check2-circle"></i>
            </div>
            <div className="stat-mini-info">
              <div className="stat-mini-value">{stats.verifiedUsers.toLocaleString()}</div>
              <div className="stat-mini-label">Verified Users</div>
              <div className="stat-mini-trend">{Math.round((stats.verifiedUsers / stats.totalUsers) * 100)}% of total</div>
            </div>
          </div>
          <div className="stat-card-mini">
            <div className="stat-mini-icon pending">
              <i className="bi bi-hourglass-split"></i>
            </div>
            <div className="stat-mini-info">
              <div className="stat-mini-value">{stats.pendingVerification}</div>
              <div className="stat-mini-label">Pending Approval</div>
              <div className="stat-mini-trend">Awaiting verification</div>
            </div>
          </div>
          <div className="stat-card-mini">
            <div className="stat-mini-icon posts">
              <i className="bi bi-file-post"></i>
            </div>
            <div className="stat-mini-info">
              <div className="stat-mini-value">{stats.totalPosts.toLocaleString()}</div>
              <div className="stat-mini-label">Total Posts</div>
              <div className="stat-mini-trend text-success">+{stats.newPostsToday} today</div>
            </div>
          </div>
          <div className="stat-card-mini">
            <div className="stat-mini-icon messages">
              <i className="bi bi-chat-dots"></i>
            </div>
            <div className="stat-mini-info">
              <div className="stat-mini-value">{stats.totalMessages.toLocaleString()}</div>
              <div className="stat-mini-label">Messages</div>
              <div className="stat-mini-trend">Total conversations</div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-row">
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <h5>📈 User Growth Trend</h5>
                <p>New user registrations over the last 30 days</p>
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
                <p>Daily posts and engagement metrics</p>
              </div>
            </div>
            <div className="chart-body">
              <Bar data={weeklyActivityChart} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="two-columns">
          <div className="card-distribution">
            <div className="card-header-custom">
              <h5><i className="bi bi-pie-chart"></i> User Distribution</h5>
              <p>Breakdown by user role</p>
            </div>
            <div className="donut-container">
              <Doughnut data={roleDistributionChart} options={chartOptions} />
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
          <div className="card-online">
            <div className="card-header-custom">
              <h5><i className="bi bi-wifi"></i> Online Users</h5>
              <p>{onlineCount} active users right now</p>
            </div>
            <div className="online-list">
              {onlineUsers.length > 0 ? (
                onlineUsers.slice(0, 5).map((user, idx) => (
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
              {onlineUsers.length > 5 && (
                <div className="more-online">
                  +{onlineUsers.length - 5} more users online
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Users Table */}
        <div className="recent-table">
          <div className="table-header">
            <h5><i className="bi bi-people"></i> Recent Users</h5>
            <button className="view-all" onClick={() => router.push('/admin/users')}>
              View All <i className="bi bi-arrow-right"></i>
            </button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => (
                  <tr key={user.user_id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar-sm">
                          {user.profile_image ? (
                            <img src={user.profile_image} alt={user.full_name} />
                          ) : (
                            <span>{user.full_name?.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="user-name-sm">{user.full_name}</div>
                          <div className="user-email">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{getRoleBadge(user.roles?.role_name)}</td>
                    <td>
                      {user.is_verified ? (
                        <span className="status-verified"><i className="bi bi-check-circle"></i> Verified</span>
                      ) : (
                        <span className="status-pending"><i className="bi bi-clock"></i> Pending</span>
                      )}
                    </td>
                    <td className="date-cell">{new Date(user.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="recent-activity">
          <div className="activity-header">
            <h5><i className="bi bi-clock-history"></i> Recent Activity</h5>
          </div>
          <div className="activity-timeline">
            {recentActivities.map((activity, idx) => (
              <div key={idx} className="timeline-item">
                <div className="timeline-icon">
                  <i className="bi bi-activity"></i>
                </div>
                <div className="timeline-content">
                  <p className="timeline-text">{activity.activity_description}</p>
                  <span className="timeline-time">{new Date(activity.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <div className="actions-header">
            <h5><i className="bi bi-lightning-charge"></i> Quick Actions</h5>
          </div>
          <div className="actions-grid">
            <button className="action-item" onClick={() => router.push('/admin/users/create')}>
              <i className="bi bi-person-plus"></i>
              <span>Add User</span>
            </button>
            <button className="action-item" onClick={() => router.push('/admin/posts')}>
              <i className="bi bi-file-post"></i>
              <span>Moderate Content</span>
            </button>
            <button className="action-item" onClick={() => router.push('/admin/reports')}>
              <i className="bi bi-flag"></i>
              <span>View Reports</span>
            </button>
            <button className="action-item" onClick={() => router.push('/admin/security')}>
              <i className="bi bi-shield-lock"></i>
              <span>Security Check</span>
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .dashboard-wrapper {
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Welcome Section */
        .welcome-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 20px;
        }

        .greeting {
          font-size: 14px;
          color: #6c757d;
          margin-bottom: 4px;
        }

        .welcome-title {
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 8px 0;
          color: #1f2937;
        }

        .user-name {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .welcome-subtitle {
          color: #6c757d;
          margin: 0;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .live-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(16, 185, 129, 0.1);
          padding: 6px 14px;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 600;
          color: #10b981;
        }

        .live-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .last-update {
          font-size: 13px;
          color: #6c757d;
        }

        .refresh-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .refresh-btn:hover {
          background: #e9ecef;
          transform: rotate(15deg);
        }

        /* Stats Cards */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: white;
          border-radius: 24px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .stat-card.primary .stat-card-icon { background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); color: #667eea; }
        .stat-card.success .stat-card-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-card.info .stat-card-icon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .stat-card.warning .stat-card-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }

        .stat-card-icon {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-card-icon i {
          font-size: 28px;
        }

        .stat-card-content {
          flex: 1;
        }

        .stat-label {
          font-size: 13px;
          color: #6c757d;
          margin-bottom: 4px;
          display: block;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 4px 0;
          color: #1f2937;
        }

        .stat-change {
          font-size: 12px;
        }

        .stat-change.positive {
          color: #10b981;
        }

        /* Secondary Stats */
        .secondary-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }

        .stat-card-mini {
          background: white;
          border-radius: 20px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: all 0.3s ease;
        }

        .stat-card-mini:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        }

        .stat-mini-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-mini-icon.verified { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-mini-icon.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .stat-mini-icon.posts { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .stat-mini-icon.messages { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

        .stat-mini-icon i {
          font-size: 22px;
        }

        .stat-mini-info {
          flex: 1;
        }

        .stat-mini-value {
          font-size: 20px;
          font-weight: 700;
          color: #1f2937;
        }

        .stat-mini-label {
          font-size: 12px;
          color: #6c757d;
        }

        .stat-mini-trend {
          font-size: 11px;
          margin-top: 4px;
        }

        .text-success {
          color: #10b981;
        }

        /* Charts */
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
          transition: all 0.3s ease;
        }

        .chart-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        }

        .chart-header {
          margin-bottom: 20px;
        }

        .chart-header h5 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 4px 0;
          color: #1f2937;
        }

        .chart-header p {
          font-size: 12px;
          color: #6c757d;
          margin: 0;
        }

        .chart-body {
          height: 280px;
        }

        /* Two Columns */
        .two-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }

        .card-distribution, .card-online {
          background: white;
          border-radius: 24px;
          padding: 20px;
        }

        .card-header-custom {
          margin-bottom: 20px;
        }

        .card-header-custom h5 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 4px 0;
          color: #1f2937;
        }

        .card-header-custom h5 i {
          margin-right: 8px;
          color: #4f46e5;
        }

        .card-header-custom p {
          font-size: 12px;
          color: #6c757d;
          margin: 0;
        }

        .donut-container {
          height: 200px;
          margin-bottom: 20px;
        }

        .legend-stats {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
          margin-top: 16px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .legend-name {
          font-size: 13px;
          color: #4b5563;
        }

        .legend-count {
          font-weight: 600;
          color: #1f2937;
        }

        /* Online Users */
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

        .online-item:hover {
          background: #f8f9fa;
        }

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

        .online-info {
          flex: 1;
        }

        .online-name {
          font-weight: 600;
          color: #1f2937;
        }

        .online-role {
          font-size: 11px;
          color: #6c757d;
        }

        .online-check {
          color: #10b981;
          font-size: 18px;
        }

        .more-online {
          text-align: center;
          padding: 12px;
          font-size: 12px;
          color: #6c757d;
          border-top: 1px solid #e9ecef;
          margin-top: 8px;
        }

        .empty-online {
          text-align: center;
          padding: 40px;
          color: #6c757d;
        }

        .empty-online i {
          font-size: 48px;
          margin-bottom: 12px;
          display: block;
        }

        /* Recent Users Table */
        .recent-table {
          background: white;
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 28px;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .table-header h5 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #1f2937;
        }

        .table-header h5 i {
          margin-right: 8px;
          color: #4f46e5;
        }

        .view-all {
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

        .view-all:hover {
          gap: 10px;
        }

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
          border-radius: 12px;
        }

        .custom-table td {
          padding: 16px;
          border-bottom: 1px solid #e9ecef;
        }

        .user-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

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
        }

        .user-avatar-sm img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        .user-name-sm {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
        }

        .user-email {
          font-size: 11px;
          color: #6c757d;
        }

        .status-verified, .status-pending {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
        }

        .status-verified {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .status-pending {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }

        .date-cell {
          font-size: 13px;
          color: #6c757d;
        }

        .badge-admin, .badge-farmer, .badge-vendor, .badge-pending {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .badge-admin { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .badge-farmer { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .badge-vendor { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .badge-pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }

        /* Recent Activity */
        .recent-activity {
          background: white;
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 28px;
        }

        .activity-header {
          margin-bottom: 20px;
        }

        .activity-header h5 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #1f2937;
        }

        .activity-header h5 i {
          margin-right: 8px;
          color: #4f46e5;
        }

        .activity-timeline {
          max-height: 250px;
          overflow-y: auto;
        }

        .timeline-item {
          display: flex;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #e9ecef;
        }

        .timeline-icon {
          width: 36px;
          height: 36px;
          background: #f8f9fa;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4f46e5;
        }

        .timeline-content {
          flex: 1;
        }

        .timeline-text {
          margin: 0 0 4px 0;
          font-size: 13px;
          color: #1f2937;
        }

        .timeline-time {
          font-size: 11px;
          color: #6c757d;
        }

        /* Quick Actions */
        .quick-actions {
          background: white;
          border-radius: 24px;
          padding: 20px;
        }

        .actions-header {
          margin-bottom: 20px;
        }

        .actions-header h5 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #1f2937;
        }

        .actions-header h5 i {
          margin-right: 8px;
          color: #4f46e5;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .action-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          background: #f8f9fa;
          border: none;
          border-radius: 16px;
          color: #495057;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .action-item:hover {
          background: #e9ecef;
          transform: translateY(-2px);
        }

        .action-item i {
          font-size: 24px;
          color: #4f46e5;
        }

        .action-item span {
          font-size: 13px;
          font-weight: 500;
        }

        /* Animations */
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 1200px) {
          .stats-grid, .secondary-stats {
            grid-template-columns: repeat(2, 1fr);
          }
          .charts-row, .two-columns {
            grid-template-columns: 1fr;
          }
          .actions-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .stats-grid, .secondary-stats {
            grid-template-columns: 1fr;
          }
          .welcome-section {
            flex-direction: column;
            align-items: flex-start;
          }
          .actions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AdminLayout>
  )
}