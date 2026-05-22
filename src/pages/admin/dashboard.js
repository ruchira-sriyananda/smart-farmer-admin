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
  
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalUsers: { value: 0, change: 0, trend: 'up' },
      activeUsers: { value: 0, change: 0, trend: 'up' },
      totalPosts: { value: 0, change: 0, trend: 'up' },
      pendingReports: { value: 0, change: 0, trend: 'down' },
      totalMessages: { value: 0, change: 0, trend: 'up' },
      totalAds: { value: 0, change: 0, trend: 'up' },
      totalBarter: { value: 0, change: 0, trend: 'up' },
      pendingModerations: { value: 0, change: 0, trend: 'down' }
    },
    activities: [],
    reports: [],
    alerts: [],
    chartData: {
      userGrowth: [],
      activityDistribution: {},
      weeklyActivity: [],
      reportTrends: []
    }
  })

  // Initialize real-time subscriptions
  useEffect(() => {
    const initializeDashboard = async () => {
      const storedSession = localStorage.getItem('adminSession')
      if (!storedSession) {
        router.push('/admin/login')
        return
      }
      setSession(JSON.parse(storedSession))
      
      await fetchAllData()
      initializeRealtimeSubscriptions()
      
      // Auto-refresh every 30 seconds
      const refreshInterval = setInterval(() => {
        refreshData()
      }, 30000)
      
      setLoading(false)
      
      return () => {
        supabase.removeAllChannels()
        clearInterval(refreshInterval)
      }
    }
    
    initializeDashboard()
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
      { table: 'admin_activity_logs', event: 'INSERT', callback: () => fetchRecentActivities() },
      { table: 'content_moderation', event: '*', callback: () => { fetchStats(); fetchChartData(); } },
      { table: 'system_analytics', event: '*', callback: () => fetchChartData() }
    ]

    channels.forEach(({ table, event, callback }) => {
      supabase
        .channel(`${table}_changes`)
        .on('postgres_changes', { event, schema: 'public', table }, callback)
        .subscribe()
    })
  }

  const fetchAllData = async () => {
    await Promise.all([
      fetchStats(),
      fetchRecentActivities(),
      fetchPendingReports(),
      fetchSecurityAlerts(),
      fetchChartData()
    ])
  }

  const fetchStats = async () => {
    try {
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)

      const [
        totalUsers,
        activeUsers,
        totalPosts,
        pendingReports,
        pendingModerations,
        totalMessages,
        totalAds,
        totalBarter,
        previousTotalUsers
      ] = await Promise.all([
        supabase.from('admin_users').select('*', { count: 'exact', head: true }),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }),
        supabase.from('system_reports').select('*', { count: 'exact', head: true }).eq('report_status', 'PENDING'),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }).eq('moderation_status', 'PENDING'),
        supabase.from('system_analytics').select('total_messages').single(),
        supabase.from('system_analytics').select('total_ads').single(),
        supabase.from('system_analytics').select('total_barter_transactions').single(),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }).lt('created_at', lastMonth.toISOString())
      ])

      const userChange = previousTotalUsers.count > 0 
        ? Math.round(((totalUsers.count - previousTotalUsers.count) / previousTotalUsers.count) * 100)
        : 0

      const messageCount = totalMessages.data?.total_messages || 0
      const adCount = totalAds.data?.total_ads || 0
      const barterCount = totalBarter.data?.total_barter_transactions || 0

      setDashboardData(prev => ({
        ...prev,
        stats: {
          totalUsers: { value: totalUsers.count || 0, change: Math.abs(userChange), trend: userChange >= 0 ? 'up' : 'down' },
          activeUsers: { value: activeUsers.count || 0, change: 0, trend: 'up' },
          totalPosts: { value: totalPosts.count || 0, change: 0, trend: 'up' },
          pendingReports: { value: pendingReports.count || 0, change: 0, trend: 'down' },
          totalMessages: { value: messageCount, change: 0, trend: 'up' },
          totalAds: { value: adCount, change: 0, trend: 'up' },
          totalBarter: { value: barterCount, change: 0, trend: 'up' },
          pendingModerations: { value: pendingModerations.count || 0, change: 0, trend: 'down' }
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
          admin_users!admin_activity_logs_admin_id_fkey (
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
        .select(`
          *,
          reported_user:admin_users!system_reports_reported_user_id_fkey (
            full_name,
            email
          )
        `)
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
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data: userRegistrations } = await supabase
        .from('admin_users')
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

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data: weeklyActivityData } = await supabase
        .from('admin_activity_logs')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const activityByDay = {}
      days.forEach(day => { activityByDay[day] = 0 })
      
      weeklyActivityData?.forEach(activity => {
        const day = new Date(activity.created_at).toLocaleDateString('en-US', { weekday: 'short' })
        activityByDay[day] = (activityByDay[day] || 0) + 1
      })

      const { data: activityTypes } = await supabase
        .from('admin_activity_logs')
        .select('activity_type')
        .gte('created_at', thirtyDaysAgo.toISOString())

      const distributionMap = {}
      activityTypes?.forEach(activity => {
        const type = activity.activity_type || 'OTHER'
        distributionMap[type] = (distributionMap[type] || 0) + 1
      })

      const { data: reportTrends } = await supabase
        .from('system_reports')
        .select('created_at, report_status')
        .gte('created_at', thirtyDaysAgo.toISOString())

      const reportsByDay = {}
      reportTrends?.forEach(report => {
        const day = new Date(report.created_at).toLocaleDateString('en-US', { weekday: 'short' })
        reportsByDay[day] = (reportsByDay[day] || 0) + 1
      })

      setDashboardData(prev => ({
        ...prev,
        chartData: {
          userGrowth: userCountByWeek,
          activityDistribution: distributionMap,
          weeklyActivity: days.map(day => activityByDay[day]),
          reportTrends: days.map(day => reportsByDay[day] || 0)
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
      await fetchPendingReports()
      await fetchStats()
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
      await fetchSecurityAlerts()
    }
  }

  const getSeverityBadge = (severity) => {
    const badges = {
      'HIGH': <span className="badge bg-danger px-2 py-1 rounded-pill"><i className="bi bi-exclamation-triangle me-1"></i>High</span>,
      'MEDIUM': <span className="badge bg-warning text-dark px-2 py-1 rounded-pill"><i className="bi bi-exclamation-circle me-1"></i>Medium</span>,
      'LOW': <span className="badge bg-info px-2 py-1 rounded-pill"><i className="bi bi-info-circle me-1"></i>Low</span>
    }
    return badges[severity] || <span className="badge bg-secondary">{severity}</span>
  }

  const userGrowthChart = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
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
    labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    datasets: [
      {
        label: 'Activities',
        data: dashboardData.chartData.weeklyActivity,
        backgroundColor: 'rgba(79, 70, 229, 0.8)',
        borderRadius: 8,
        barPercentage: 0.6
      },
      {
        label: 'Reports',
        data: dashboardData.chartData.reportTrends,
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderRadius: 8,
        barPercentage: 0.6
      }
    ]
  }

  const distributionChart = {
    labels: Object.keys(dashboardData.chartData.activityDistribution).slice(0, 5),
    datasets: [
      {
        data: Object.values(dashboardData.chartData.activityDistribution).slice(0, 5),
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
            <h5 className="text-muted">Loading Dashboard Data...</h5>
            <p className="text-muted small">Fetching latest statistics from database</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const { stats, activities, reports, alerts } = dashboardData

  return (
    <AdminLayout title="Analytics Dashboard">
      {/* Header with Refresh Control */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h4 className="mb-1 fw-bold text-gradient">Welcome back, {session?.admin?.full_name?.split(' ')[0] || 'Admin'}! 👋</h4>
          <p className="text-muted mb-0">
            <i className="bi bi-calendar3 me-1"></i>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | 
            <i className="bi bi-clock ms-2 me-1"></i>
            {new Date().toLocaleTimeString()} | 
            <i className="bi bi-database ms-2 me-1"></i>
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <button 
          className="btn btn-outline-secondary btn-sm rounded-pill px-3"
          onClick={refreshData}
          disabled={refreshing}
        >
          <i className={`bi bi-arrow-repeat ${refreshing ? 'spin' : ''} me-1`}></i>
          {refreshing ? 'Updating...' : 'Refresh Data'}
        </button>
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
                <span className="stat-change text-success">
                  <i className="bi bi-arrow-up"></i> Currently online
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
                <span className="stat-change text-info">
                  <i className="bi bi-database"></i> All time
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
                  <i className={`bi bi-arrow-${stats.pendingReports.trend}`}></i> Needs attention
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
                <span className="stat-label-sm">Total Messages</span>
                <h4 className="stat-value-sm">{stats.totalMessages.value.toLocaleString()}</h4>
                <small className="text-success">
                  <i className="bi bi-arrow-up"></i> +{stats.totalMessages.change}%
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
                <small className="text-success">
                  <i className="bi bi-arrow-up"></i> Live campaigns
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
                <small className="text-success">
                  <i className="bi bi-arrow-up"></i> Completed
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
                <small className="text-muted">Awaiting review</small>
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
                  <small className="text-muted">Last 30 days - {dashboardData.chartData.userGrowth.reduce((a,b) => a + b, 0)} new users</small>
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
                  <small className="text-muted">Weekly overview - Activities vs Reports</small>
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

      {/* Activity Distribution and Recent Items */}
      <div className="row g-4 mb-4">
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 chart-card">
            <div className="card-header bg-transparent border-0 pt-4">
              <h5 className="mb-0 fw-bold">Activity Distribution</h5>
              <small className="text-muted">By module type (Last 30 days)</small>
            </div>
            <div className="card-body">
              <div style={{ height: '280px' }}>
                {Object.keys(dashboardData.chartData.activityDistribution).length > 0 ? (
                  <Doughnut data={distributionChart} options={chartOptions} />
                ) : (
                  <div className="d-flex justify-content-center align-items-center h-100">
                    <p className="text-muted">No activity data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-transparent border-0 pt-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">Recent Activities</h5>
                  <small className="text-muted">Latest {activities.length} platform activities</small>
                </div>
                <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/security/logs')}>
                  View All <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <div className="activity-timeline" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {activities.length > 0 ? (
                  activities.map((activity, idx) => (
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
                  ))
                ) : (
                  <div className="text-center py-4">
                    <i className="bi bi-inbox fs-1 text-muted"></i>
                    <p className="text-muted mt-2 mb-0">No recent activities</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reports and Security Alerts */}
      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-transparent border-0 pt-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">Pending Reports</h5>
                  <small className="text-muted">{reports.length} reports awaiting review</small>
                </div>
                <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/reports')}>
                  View All <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              {reports.length > 0 ? (
                reports.map((report, idx) => (
                  <div key={idx} className="border-bottom pb-3 mb-3">
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1">
                        <p className="mb-1 fw-medium">{report.report_reason}</p>
                        <small className="text-muted">
                          <i className="bi bi-calendar me-1"></i>
                          {new Date(report.created_at).toLocaleString()}
                        </small>
                      </div>
                      <button 
                        className="btn btn-sm btn-outline-success rounded-pill px-3"
                        onClick={() => resolveReport(report.report_id)}
                      >
                        <i className="bi bi-check-lg me-1"></i>Resolve
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <i className="bi bi-check-circle-fill text-success fs-1"></i>
                  <p className="text-muted mt-2 mb-0">No pending reports!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-transparent border-0 pt-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">Security Alerts</h5>
                  <small className="text-muted">{alerts.length} active security alerts</small>
                </div>
                <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/security')}>
                  View All <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              {alerts.length > 0 ? (
                alerts.map((alert, idx) => (
                  <div key={idx} className="border-bottom pb-3 mb-3">
                    <div className="d-flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="alert-icon bg-danger bg-opacity-10">
                          <i className="bi bi-shield-exclamation text-danger"></i>
                        </div>
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <h6 className="mb-0 fw-bold">{alert.alert_type}</h6>
                          {getSeverityBadge(alert.severity_level)}
                        </div>
                        <p className="text-muted small mb-1">{alert.alert_message}</p>
                        <div className="d-flex justify-content-between align-items-center">
                          <small className="text-muted">
                            <i className="bi bi-calendar me-1"></i>
                            {new Date(alert.created_at).toLocaleString()}
                          </small>
                          <button 
                            className="btn btn-sm btn-link text-success p-0"
                            onClick={() => dismissAlert(alert.alert_id)}
                          >
                            <i className="bi bi-check-circle"></i> Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
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
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.05);
        }
        
        .chart-card {
          transition: all 0.3s ease;
        }
        
        .chart-card:hover {
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
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
        
        .alert-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
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