import { useEffect, useState, useCallback, useRef } from 'react'
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

// Register ChartJS components
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
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const notificationRef = useRef(null)
  
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalUsers: { value: 0, change: 12, trend: 'up' },
      activeUsers: { value: 0, change: 8, trend: 'up' },
      totalPosts: { value: 0, change: 23, trend: 'up' },
      pendingReports: { value: 0, change: -5, trend: 'down' },
      totalMessages: { value: 1247, change: 18, trend: 'up' },
      totalAds: { value: 56, change: 7, trend: 'up' },
      totalBarter: { value: 128, change: 15, trend: 'up' },
      pendingModerations: { value: 0, change: -2, trend: 'down' },
      satisfactionRate: { value: 94, change: 3, trend: 'up' },
      responseTime: { value: 2.4, change: -0.3, trend: 'down' }
    },
    activities: [],
    reports: [],
    alerts: [],
    chartData: {
      userGrowth: [],
      activityDistribution: {},
      weeklyActivity: []
    }
  })

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    // Subscribe to multiple tables for real-time updates
    const channels = [
      { table: 'admin_users', event: '*', callback: () => fetchStats() },
      { table: 'system_reports', event: '*', callback: () => { fetchPendingReports(); fetchStats(); } },
      { table: 'security_alerts', event: '*', callback: () => fetchSecurityAlerts() },
      { table: 'admin_activity_logs', event: 'INSERT', callback: (payload) => {
        setDashboardData(prev => ({
          ...prev,
          activities: [payload.new, ...prev.activities.slice(0, 9)]
        }))
        addNotification('New Activity', payload.new.activity_description, 'info')
      }},
      { table: 'system_analytics', event: '*', callback: () => fetchChartData() }
    ]

    channels.forEach(({ table, event, callback }) => {
      supabase
        .channel(`${table}_changes`)
        .on('postgres_changes', { event, schema: 'public', table }, callback)
        .subscribe()
    })
  }

  const addNotification = (title, message, type = 'info') => {
    const newNotification = {
      id: Date.now(),
      title,
      message,
      type,
      time: 'Just now',
      read: false
    }
    setNotifications(prev => [newNotification, ...prev.slice(0, 9)])
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotification.id))
    }, 5000)
  }

  const fetchAllData = async () => {
    await Promise.all([
      fetchStats(),
      fetchRecentActivities(),
      fetchPendingReports(),
      fetchSecurityAlerts(),
      fetchChartData()
    ])
    setLoading(false)
  }

  const fetchStats = async () => {
    try {
      const [
        totalUsers,
        activeUsers,
        totalPosts,
        pendingReports,
        pendingModerations
      ] = await Promise.all([
        supabase.from('admin_users').select('*', { count: 'exact', head: true }),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }),
        supabase.from('system_reports').select('*', { count: 'exact', head: true }).eq('report_status', 'PENDING'),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }).eq('moderation_status', 'PENDING')
      ])

      setDashboardData(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          totalUsers: { ...prev.stats.totalUsers, value: totalUsers.count || 0 },
          activeUsers: { ...prev.stats.activeUsers, value: activeUsers.count || 0 },
          totalPosts: { ...prev.stats.totalPosts, value: totalPosts.count || 0 },
          pendingReports: { ...prev.stats.pendingReports, value: pendingReports.count || 0 },
          pendingModerations: { ...prev.stats.pendingModerations, value: pendingModerations.count || 0 }
        }
      }))
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchRecentActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select(`
          *,
          admin_users (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && data) {
        setDashboardData(prev => ({ ...prev, activities: data }))
      }
    } catch (err) {
      console.error('Error fetching activities:', err)
    }
  }

  const fetchPendingReports = async () => {
    try {
      const { data, error } = await supabase
        .from('system_reports')
        .select('*')
        .eq('report_status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!error && data) {
        setDashboardData(prev => ({ ...prev, reports: data }))
      }
    } catch (err) {
      console.error('Error fetching reports:', err)
    }
  }

  const fetchSecurityAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!error && data) {
        setDashboardData(prev => ({ ...prev, alerts: data }))
      }
    } catch (err) {
      console.error('Error fetching alerts:', err)
    }
  }

  const fetchChartData = async () => {
    try {
      // Fetch last 7 days of user registrations
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data: userRegistrations } = await supabase
        .from('admin_users')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())

      // Process user growth data
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const userCountByDay = {}
      days.forEach(day => { userCountByDay[day] = 0 })
      
      userRegistrations?.forEach(user => {
        const day = new Date(user.created_at).toLocaleDateString('en-US', { weekday: 'short' })
        userCountByDay[day] = (userCountByDay[day] || 0) + 1
      })

      // Fetch weekly activity
      const { data: weeklyActivity } = await supabase
        .from('admin_activity_logs')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())

      const activityByDay = {}
      days.forEach(day => { activityByDay[day] = 0 })
      
      weeklyActivity?.forEach(activity => {
        const day = new Date(activity.created_at).toLocaleDateString('en-US', { weekday: 'short' })
        activityByDay[day] = (activityByDay[day] || 0) + 1
      })

      setDashboardData(prev => ({
        ...prev,
        chartData: {
          userGrowth: days.map(day => userCountByDay[day]),
          activityDistribution: {
            'Content Moderation': 45,
            'User Management': 30,
            'Report Handling': 15,
            'Security Checks': 10
          },
          weeklyActivity: days.map(day => activityByDay[day])
        }
      }))
    } catch (err) {
      console.error('Error fetching chart data:', err)
    }
  }

  const resolveReport = async (reportId) => {
    const sessionData = JSON.parse(localStorage.getItem('adminSession') || '{}')
    const { error } = await supabase
      .from('system_reports')
      .update({
        report_status: 'RESOLVED',
        reviewed_at: new Date().toISOString(),
        reviewed_by: sessionData?.admin?.admin_id
      })
      .eq('report_id', reportId)

    if (!error) {
      fetchPendingReports()
      fetchStats()
      addNotification('Report Resolved', 'A pending report has been resolved', 'success')
    }
  }

  const dismissAlert = async (alertId) => {
    const sessionData = JSON.parse(localStorage.getItem('adminSession') || '{}')
    const { error } = await supabase
      .from('security_alerts')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: sessionData?.admin?.admin_id
      })
      .eq('alert_id', alertId)

    if (!error) {
      fetchSecurityAlerts()
      addNotification('Alert Dismissed', 'A security alert has been dismissed', 'warning')
    }
  }

  const markNotificationRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
  }

  const getSeverityBadge = (severity) => {
    const badges = {
      'HIGH': <span className="badge bg-danger px-2 py-1 rounded-pill"><i className="bi bi-exclamation-triangle me-1"></i>High</span>,
      'MEDIUM': <span className="badge bg-warning text-dark px-2 py-1 rounded-pill"><i className="bi bi-exclamation-circle me-1"></i>Medium</span>,
      'LOW': <span className="badge bg-info px-2 py-1 rounded-pill"><i className="bi bi-info-circle me-1"></i>Low</span>
    }
    return badges[severity] || <span className="badge bg-secondary">{severity}</span>
  }

  // Chart configurations
  const userGrowthChart = {
    labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    datasets: [
      {
        label: 'New Users',
        data: dashboardData.chartData.userGrowth,
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

  const activityChart = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Activities',
        data: dashboardData.chartData.weeklyActivity,
        backgroundColor: 'rgba(79, 70, 229, 0.8)',
        borderRadius: 8,
        barPercentage: 0.6
      }
    ]
  }

  const distributionChart = {
    labels: Object.keys(dashboardData.chartData.activityDistribution),
    datasets: [
      {
        data: Object.values(dashboardData.chartData.activityDistribution),
        backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'],
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
        labels: { usePointStyle: true, boxWidth: 10 }
      }
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="d-flex justify-content-center align-items-center min-vh-100">
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" style={{ width: '4rem', height: '4rem' }}></div>
            <h5 className="text-muted">Loading Dashboard...</h5>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const { stats, activities, reports, alerts } = dashboardData

  return (
    <AdminLayout title="Analytics Dashboard">
      {/* Floating Notifications Panel */}
      <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1050, maxWidth: '380px' }} ref={notificationRef}>
        {notifications.map(notif => (
          <div key={notif.id} className={`toast show mb-2 shadow-lg border-0 animate-slide-in`} role="alert">
            <div className={`toast-header bg-${notif.type === 'success' ? 'success' : notif.type === 'warning' ? 'warning' : 'primary'} text-white`}>
              <i className={`bi bi-${notif.type === 'success' ? 'check-circle' : notif.type === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-2`}></i>
              <strong className="me-auto">{notif.title}</strong>
              <small>{notif.time}</small>
              <button type="button" className="btn-close btn-close-white" onClick={() => markNotificationRead(notif.id)}></button>
            </div>
            <div className="toast-body">
              {notif.message}
            </div>
          </div>
        ))}
      </div>

      {/* Header with Refresh Control */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-1 fw-bold text-gradient">Welcome back, {session?.admin?.full_name?.split(' ')[0]}! 👋</h4>
          <p className="text-muted mb-0">
            <i className="bi bi-calendar3 me-1"></i>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-secondary btn-sm rounded-pill px-3"
            onClick={refreshData}
            disabled={refreshing}
          >
            <i className={`bi bi-arrow-repeat ${refreshing ? 'spin' : ''} me-1`}></i>
            {refreshing ? 'Updating...' : 'Refresh'}
          </button>
          <button 
            className="btn btn-outline-primary btn-sm rounded-pill px-3"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <i className="bi bi-bell me-1"></i>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="badge bg-danger rounded-pill ms-1">{notifications.filter(n => !n.read).length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards Grid - Row 1 */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-xl-3">
          <div className="stat-card gradient-card-primary">
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

        <div className="col-md-6 col-xl-3">
          <div className="stat-card gradient-card-success">
            <div className="stat-card-body">
              <div className="stat-icon">
                <i className="bi bi-person-check-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Active Users</span>
                <h2 className="stat-value">{stats.activeUsers.value.toLocaleString()}</h2>
                <span className={`stat-change ${stats.activeUsers.trend === 'up' ? 'text-success' : 'text-danger'}`}>
                  <i className={`bi bi-arrow-${stats.activeUsers.trend}`}></i> {stats.activeUsers.change}% this week
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="stat-card gradient-card-info">
            <div className="stat-card-body">
              <div className="stat-icon">
                <i className="bi bi-file-post-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Posts</span>
                <h2 className="stat-value">{stats.totalPosts.value.toLocaleString()}</h2>
                <span className={`stat-change ${stats.totalPosts.trend === 'up' ? 'text-success' : 'text-danger'}`}>
                  <i className={`bi bi-arrow-${stats.totalPosts.trend}`}></i> {stats.totalPosts.change}% all time
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="stat-card gradient-card-warning">
            <div className="stat-card-body">
              <div className="stat-icon">
                <i className="bi bi-flag-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Pending Reports</span>
                <h2 className="stat-value text-warning">{stats.pendingReports.value}</h2>
                <span className={`stat-change ${stats.pendingReports.trend === 'up' ? 'text-danger' : 'text-success'}`}>
                  <i className={`bi bi-arrow-${stats.pendingReports.trend}`}></i> {Math.abs(stats.pendingReports.change)}% from last week
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid - Row 2 */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-xl-3">
          <div className="stat-card glass-card">
            <div className="stat-card-body">
              <div className="stat-icon-sm bg-primary">
                <i className="bi bi-chat-dots-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label-sm">Messages</span>
                <h4 className="stat-value-sm">{stats.totalMessages.value.toLocaleString()}</h4>
                <small className={`text-${stats.totalMessages.trend === 'up' ? 'success' : 'danger'}`}>
                  +{stats.totalMessages.change}%
                </small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="stat-card glass-card">
            <div className="stat-card-body">
              <div className="stat-icon-sm bg-success">
                <i className="bi bi-megaphone-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label-sm">Active Ads</span>
                <h4 className="stat-value-sm">{stats.totalAds.value}</h4>
                <small className={`text-${stats.totalAds.trend === 'up' ? 'success' : 'danger'}`}>
                  +{stats.totalAds.change}%
                </small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="stat-card glass-card">
            <div className="stat-card-body">
              <div className="stat-icon-sm bg-info">
                <i className="bi bi-arrow-left-right"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label-sm">Barter Trades</span>
                <h4 className="stat-value-sm">{stats.totalBarter.value}</h4>
                <small className={`text-${stats.totalBarter.trend === 'up' ? 'success' : 'danger'}`}>
                  +{stats.totalBarter.change}%
                </small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="stat-card glass-card">
            <div className="stat-card-body">
              <div className="stat-icon-sm bg-warning">
                <i className="bi bi-hourglass-split"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label-sm">Pending Moderation</span>
                <h4 className="stat-value-sm text-warning">{stats.pendingModerations.value}</h4>
                <small className={`text-${stats.pendingModerations.trend === 'up' ? 'danger' : 'success'}`}>
                  {stats.pendingModerations.change}%
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="row g-4 mb-4">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm rounded-4 chart-card">
            <div className="card-header bg-transparent border-0 pt-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">User Growth</h5>
                  <small className="text-muted">Last 7 days activity</small>
                </div>
                <div className="dropdown">
                  <button className="btn btn-sm btn-outline-secondary rounded-pill">Weekly <i className="bi bi-chevron-down ms-1"></i></button>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div style={{ height: '300px' }}>
                <Line data={userGrowthChart} options={chartOptions} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card border-0 shadow-sm rounded-4 chart-card">
            <div className="card-header bg-transparent border-0 pt-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">Platform Activity</h5>
                  <small className="text-muted">Weekly activity overview</small>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div style={{ height: '300px' }}>
                <Bar data={activityChart} options={chartOptions} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Distribution and Quick Stats */}
      <div className="row g-4 mb-4">
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 chart-card">
            <div className="card-header bg-transparent border-0 pt-4">
              <h5 className="mb-0 fw-bold">Activity Distribution</h5>
              <small className="text-muted">By module type</small>
            </div>
            <div className="card-body">
              <div style={{ height: '280px' }}>
                <Doughnut data={distributionChart} options={chartOptions} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-transparent border-0 pt-4">
              <h5 className="mb-0 fw-bold">System Health</h5>
              <small className="text-muted">Real-time metrics</small>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <small>API Response Time</small>
                  <small className="fw-bold">{stats.responseTime.value}s</small>
                </div>
                <div className="progress" style={{ height: '8px' }}>
                  <div className="progress-bar bg-success" style={{ width: '95%' }}></div>
                </div>
              </div>
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <small>User Satisfaction</small>
                  <small className="fw-bold">{stats.satisfactionRate.value}%</small>
                </div>
                <div className="progress" style={{ height: '8px' }}>
                  <div className="progress-bar bg-info" style={{ width: `${stats.satisfactionRate.value}%` }}></div>
                </div>
              </div>
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <small>System Uptime</small>
                  <small className="fw-bold">99.9%</small>
                </div>
                <div className="progress" style={{ height: '8px' }}>
                  <div className="progress-bar bg-primary" style={{ width: '99.9%' }}></div>
                </div>
              </div>
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <small>Database Health</small>
                  <small className="fw-bold">98.5%</small>
                </div>
                <div className="progress" style={{ height: '8px' }}>
                  <div className="progress-bar bg-warning" style={{ width: '98.5%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-transparent border-0 pt-4">
              <h5 className="mb-0 fw-bold">Quick Stats</h5>
              <small className="text-muted">At a glance</small>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-6">
                  <div className="quick-stat-item">
                    <i className="bi bi-envelope-fill text-primary"></i>
                    <div>
                      <div className="small text-muted">Unread Messages</div>
                      <strong>24</strong>
                    </div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="quick-stat-item">
                    <i className="bi bi-flag-fill text-warning"></i>
                    <div>
                      <div className="small text-muted">Active Reports</div>
                      <strong>{stats.pendingReports.value}</strong>
                    </div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="quick-stat-item">
                    <i className="bi bi-people-fill text-success"></i>
                    <div>
                      <div className="small text-muted">New Today</div>
                      <strong>+{Math.floor(stats.totalUsers.value * 0.02)}</strong>
                    </div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="quick-stat-item">
                    <i className="bi bi-shield-lock-fill text-info"></i>
                    <div>
                      <div className="small text-muted">Security Events</div>
                      <strong>{alerts.length}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities & Alerts */}
      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-transparent border-0 pt-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">Recent Activities</h5>
                  <small className="text-muted">Latest platform activities</small>
                </div>
                <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/security/logs')}>
                  View All <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <div className="activity-timeline">
                {activities.slice(0, 5).map((activity, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="timeline-icon">
                      <i className="bi bi-activity"></i>
                    </div>
                    <div className="timeline-content">
                      <p className="mb-0 fw-medium">{activity.activity_description}</p>
                      <small className="text-muted">
                        {activity.admin_users?.full_name || 'System'} • 
                        {new Date(activity.created_at).toLocaleString()}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-transparent border-0 pt-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">Security Alerts</h5>
                  <small className="text-muted">Recent security events</small>
                </div>
                <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/security')}>
                  View All <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              {alerts.slice(0, 3).map((alert, idx) => (
                <div key={idx} className="alert-item">
                  <div className="d-flex gap-3">
                    <div className="flex-shrink-0">
                      <div className={`alert-icon bg-danger bg-opacity-10`}>
                        <i className="bi bi-shield-exclamation text-danger"></i>
                      </div>
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start">
                        <h6 className="mb-1 small fw-bold">{alert.alert_type}</h6>
                        {getSeverityBadge(alert.severity_level)}
                      </div>
                      <p className="text-muted small mb-1">{alert.alert_message}</p>
                      <small className="text-muted">
                        {new Date(alert.created_at).toLocaleString()}
                      </small>
                    </div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="text-center py-4">
                  <i className="bi bi-shield-check text-success fs-1"></i>
                  <p className="text-muted mt-2 mb-0">No security alerts!</p>
                  <small>System is secure</small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Stat Cards */
        .stat-card {
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .stat-card:hover {
          transform: translateY(-5px);
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
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .stat-icon i {
          font-size: 32px;
          color: white;
        }
        
        .stat-icon-sm {
          width: 45px;
          height: 45px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .stat-icon-sm i {
          font-size: 22px;
          color: white;
        }
        
        .stat-info {
          text-align: right;
        }
        
        .stat-label {
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.8);
        }
        
        .stat-label-sm {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: #6c757d;
        }
        
        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          margin: 0.25rem 0;
          color: white;
        }
        
        .stat-value-sm {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }
        
        .stat-change {
          font-size: 0.75rem;
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
        
        .glass-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        /* Chart Cards */
        .chart-card {
          transition: all 0.3s ease;
        }
        
        .chart-card:hover {
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
          padding: 1rem 0;
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
          color: #4f46e5;
        }
        
        .timeline-content {
          flex: 1;
        }
        
        /* Alert Items */
        .alert-item {
          padding: 1rem 0;
          border-bottom: 1px solid #e9ecef;
        }
        
        .alert-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        /* Quick Stats */
        .quick-stat-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: #f8f9fa;
          border-radius: 12px;
        }
        
        .quick-stat-item i {
          font-size: 1.5rem;
        }
        
        /* Animations */
        .animate-slide-in {
          animation: slideInRight 0.3s ease-out;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        .text-gradient {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        /* Custom Scrollbar */
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
        
        /* Responsive */
        @media (max-width: 768px) {
          .stat-card-body {
            padding: 1rem;
          }
          
          .stat-icon {
            width: 45px;
            height: 45px;
          }
          
          .stat-icon i {
            font-size: 24px;
          }
          
          .stat-value {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </AdminLayout>
  )
}