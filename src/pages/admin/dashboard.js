import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function AdminDashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      totalPosts: 0,
      approvedPosts: 0,
      pendingPosts: 0,
      rejectedPosts: 0,
      pendingReports: 0,
      resolvedReports: 0,
      totalReports: 0,
      totalMessages: 0,
      totalAds: 0,
      activeAds: 0,
      totalBarter: 0,
      completedBarter: 0,
      pendingBarter: 0,
      pendingModerations: 0,
      totalAdmins: 0,
      superAdmins: 0,
      totalAlerts: 0,
      resolvedAlerts: 0,
      systemUptime: 99.9,
      responseTime: 2.4,
      satisfactionRate: 94
    },
    recentActivities: [],
    pendingReportsList: [],
    securityAlertsList: [],
    userGrowthData: [],
    recentUsers: [],
    weeklyActivityData: [],
    categoryDistribution: []
  })

  // Fetch all data from Supabase
  useEffect(() => {
    const storedSession = localStorage.getItem('adminSession')
    if (!storedSession) {
      router.push('/admin/login')
      return
    }
    setSession(JSON.parse(storedSession))
    fetchAllDashboardData()
    
    // Set up real-time subscriptions
    setupRealtimeSubscriptions()
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => refreshData(), 60000)
    return () => clearInterval(interval)
  }, [router])

  const setupRealtimeSubscriptions = () => {
    supabase
      .channel('admin_users_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_users' }, () => fetchStats())
      .subscribe()

    supabase
      .channel('reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_reports' }, () => {
        fetchStats()
        fetchPendingReports()
      })
      .subscribe()

    supabase
      .channel('alerts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_alerts' }, () => {
        fetchStats()
        fetchSecurityAlerts()
      })
      .subscribe()

    supabase
      .channel('activities_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_activity_logs' }, (payload) => {
        setDashboardData(prev => ({
          ...prev,
          recentActivities: [payload.new, ...prev.recentActivities.slice(0, 9)]
        }))
      })
      .subscribe()
  }

  const refreshData = async () => {
    setRefreshing(true)
    await fetchAllDashboardData()
    setLastUpdate(new Date())
    setRefreshing(false)
  }

  const fetchAllDashboardData = async () => {
    await Promise.all([
      fetchStats(),
      fetchRecentActivities(),
      fetchPendingReports(),
      fetchSecurityAlerts(),
      fetchUserGrowth(),
      fetchRecentUsers(),
      fetchWeeklyActivity(),
      fetchCategoryDistribution()
    ])
    setLoading(false)
  }

  const fetchStats = async () => {
    try {
      // Admin Users Stats
      const { count: totalUsers } = await supabase.from('admin_users').select('*', { count: 'exact', head: true })
      const { count: activeUsers } = await supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_active', true)
      const { count: superAdmins } = await supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_super_admin', true)
      const { count: totalAdmins } = await supabase.from('admin_users').select('*', { count: 'exact', head: true })

      // Content Moderation Stats
      const { count: totalPosts } = await supabase.from('content_moderation').select('*', { count: 'exact', head: true })
      const { count: approvedPosts } = await supabase.from('content_moderation').select('*', { count: 'exact', head: true }).eq('moderation_status', 'APPROVED')
      const { count: pendingPosts } = await supabase.from('content_moderation').select('*', { count: 'exact', head: true }).eq('moderation_status', 'PENDING')
      const { count: rejectedPosts } = await supabase.from('content_moderation').select('*', { count: 'exact', head: true }).eq('moderation_status', 'REJECTED')

      // Reports Stats
      const { count: totalReports } = await supabase.from('system_reports').select('*', { count: 'exact', head: true })
      const { count: pendingReports } = await supabase.from('system_reports').select('*', { count: 'exact', head: true }).eq('report_status', 'PENDING')
      const { count: resolvedReports } = await supabase.from('system_reports').select('*', { count: 'exact', head: true }).eq('report_status', 'RESOLVED')

      // Security Alerts Stats
      const { count: totalAlerts } = await supabase.from('security_alerts').select('*', { count: 'exact', head: true })
      const { count: resolvedAlerts } = await supabase.from('security_alerts').select('*', { count: 'exact', head: true }).eq('resolved', true)

      // Get analytics data
      const { data: analyticsData } = await supabase
        .from('system_analytics')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(1)

      const analytics = analyticsData?.[0] || {}

      setDashboardData(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          totalUsers: totalUsers || 0,
          activeUsers: activeUsers || 0,
          inactiveUsers: (totalUsers || 0) - (activeUsers || 0),
          totalPosts: totalPosts || 0,
          approvedPosts: approvedPosts || 0,
          pendingPosts: pendingPosts || 0,
          rejectedPosts: rejectedPosts || 0,
          pendingReports: pendingReports || 0,
          resolvedReports: resolvedReports || 0,
          totalReports: totalReports || 0,
          totalMessages: analytics.total_messages || 0,
          totalAds: analytics.total_ads || 0,
          activeAds: analytics.active_ads || 0,
          totalBarter: analytics.total_barter_transactions || 0,
          completedBarter: analytics.completed_barter || 0,
          pendingBarter: analytics.pending_barter || 0,
          pendingModerations: pendingPosts || 0,
          totalAdmins: totalAdmins || 0,
          superAdmins: superAdmins || 0,
          totalAlerts: totalAlerts || 0,
          resolvedAlerts: resolvedAlerts || 0
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
        setDashboardData(prev => ({ ...prev, recentActivities: data }))
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
        setDashboardData(prev => ({ ...prev, pendingReportsList: data }))
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
        setDashboardData(prev => ({ ...prev, securityAlertsList: data }))
      }
    } catch (err) {
      console.error('Error fetching alerts:', err)
    }
  }

  const fetchUserGrowth = async () => {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data, error } = await supabase
        .from('admin_users')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true })

      if (!error && data) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const counts = new Array(7).fill(0)
        
        data.forEach(user => {
          const day = new Date(user.created_at).getDay()
          counts[day]++
        })
        
        const maxCount = Math.max(...counts, 1)
        
        setDashboardData(prev => ({
          ...prev,
          userGrowthData: days.map((day, index) => ({ 
            day, 
            fullDay: fullDays[index],
            count: counts[index],
            percentage: (counts[index] / maxCount) * 100
          }))
        }))
      }
    } catch (err) {
      console.error('Error fetching user growth:', err)
    }
  }

  const fetchRecentUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('admin_id, full_name, email, created_at, is_active, is_super_admin')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!error && data) {
        setDashboardData(prev => ({ ...prev, recentUsers: data }))
      }
    } catch (err) {
      console.error('Error fetching recent users:', err)
    }
  }

  const fetchWeeklyActivity = async () => {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())

      if (!error && data) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const counts = new Array(7).fill(0)
        
        data.forEach(activity => {
          const day = new Date(activity.created_at).getDay()
          counts[day]++
        })
        
        const maxCount = Math.max(...counts, 1)
        
        setDashboardData(prev => ({
          ...prev,
          weeklyActivityData: days.map((day, index) => ({
            day,
            count: counts[index],
            percentage: (counts[index] / maxCount) * 100
          }))
        }))
      }
    } catch (err) {
      console.error('Error fetching weekly activity:', err)
    }
  }

  const fetchCategoryDistribution = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('activity_type')

      if (!error && data) {
        const distribution = {}
        data.forEach(activity => {
          const type = activity.activity_type || 'OTHER'
          distribution[type] = (distribution[type] || 0) + 1
        })
        
        const total = data.length || 1
        const categories = Object.entries(distribution).slice(0, 4).map(([name, count]) => ({
          name: name.replace('_', ' '),
          count,
          percentage: (count / total) * 100
        }))
        
        setDashboardData(prev => ({
          ...prev,
          categoryDistribution: categories
        }))
      }
    } catch (err) {
      console.error('Error fetching category distribution:', err)
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
      fetchStats()
      fetchPendingReports()
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
      fetchStats()
      fetchSecurityAlerts()
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}></div>
            <h5 className="text-muted">Loading dashboard data...</h5>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const { stats, recentActivities, pendingReportsList, securityAlertsList, userGrowthData, recentUsers, weeklyActivityData, categoryDistribution } = dashboardData

  return (
    <AdminLayout title="Dashboard">
      {/* Header with Refresh */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-1 fw-bold text-dark">Dashboard Overview</h4>
          <p className="text-muted mb-0">
            Welcome back, {session?.admin?.full_name?.split(' ')[0] || 'Admin'}
          </p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <small className="text-muted">
            <i className="bi bi-clock me-1"></i>
            Updated: {lastUpdate.toLocaleTimeString()}
          </small>
          <button 
            className="btn btn-sm btn-outline-secondary rounded-pill px-3"
            onClick={refreshData}
            disabled={refreshing}
          >
            <i className={`bi bi-arrow-repeat ${refreshing ? 'spinner-border spinner-border-sm me-1' : 'me-1'}`}></i>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats Cards - Row 1 */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-xl-3">
          <div className="stats-card">
            <div className="stats-card-body">
              <div className="stats-icon bg-primary bg-opacity-10">
                <i className="bi bi-people-fill text-primary"></i>
              </div>
              <div className="stats-info">
                <span className="stats-label">Total Users</span>
                <h2 className="stats-value">{stats.totalUsers.toLocaleString()}</h2>
                <div className="stats-badges">
                  <span className="stats-badge bg-success">
                    <i className="bi bi-check-circle me-1"></i>{stats.activeUsers} Active
                  </span>
                  <span className="stats-badge bg-secondary">
                    <i className="bi bi-circle me-1"></i>{stats.inactiveUsers} Inactive
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="stats-card">
            <div className="stats-card-body">
              <div className="stats-icon bg-info bg-opacity-10">
                <i className="bi bi-file-post-fill text-info"></i>
              </div>
              <div className="stats-info">
                <span className="stats-label">Content Overview</span>
                <h2 className="stats-value">{stats.totalPosts.toLocaleString()}</h2>
                <div className="stats-badges">
                  <span className="stats-badge bg-success">
                    <i className="bi bi-check-lg me-1"></i>{stats.approvedPosts} Approved
                  </span>
                  <span className="stats-badge bg-warning">
                    <i className="bi bi-hourglass me-1"></i>{stats.pendingPosts} Pending
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="stats-card">
            <div className="stats-card-body">
              <div className="stats-icon bg-danger bg-opacity-10">
                <i className="bi bi-flag-fill text-danger"></i>
              </div>
              <div className="stats-info">
                <span className="stats-label">Reports</span>
                <h2 className="stats-value">{stats.totalReports.toLocaleString()}</h2>
                <div className="stats-badges">
                  <span className="stats-badge bg-danger">
                    <i className="bi bi-flag me-1"></i>{stats.pendingReports} Pending
                  </span>
                  <span className="stats-badge bg-success">
                    <i className="bi bi-check-circle me-1"></i>{stats.resolvedReports} Resolved
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="stats-card">
            <div className="stats-card-body">
              <div className="stats-icon bg-warning bg-opacity-10">
                <i className="bi bi-shield-lock-fill text-warning"></i>
              </div>
              <div className="stats-info">
                <span className="stats-label">Security Alerts</span>
                <h2 className="stats-value">{stats.totalAlerts.toLocaleString()}</h2>
                <div className="stats-badges">
                  <span className="stats-badge bg-warning">
                    <i className="bi bi-exclamation-triangle me-1"></i>{stats.totalAlerts - stats.resolvedAlerts} Active
                  </span>
                  <span className="stats-badge bg-success">
                    <i className="bi bi-shield-check me-1"></i>{stats.resolvedAlerts} Resolved
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Row 2 */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-3">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small text-uppercase">Messages</span>
                  <h3 className="mb-0 fw-bold mt-1">{stats.totalMessages.toLocaleString()}</h3>
                </div>
                <div className="bg-light rounded-circle p-3">
                  <i className="bi bi-chat-dots fs-4 text-secondary"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-3">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small text-uppercase">Active Ads</span>
                  <h3 className="mb-0 fw-bold mt-1">{stats.activeAds}</h3>
                </div>
                <div className="bg-light rounded-circle p-3">
                  <i className="bi bi-megaphone fs-4 text-secondary"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-3">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small text-uppercase">Barter Trades</span>
                  <h3 className="mb-0 fw-bold mt-1">{stats.totalBarter.toLocaleString()}</h3>
                </div>
                <div className="bg-light rounded-circle p-3">
                  <i className="bi bi-arrow-left-right fs-4 text-secondary"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-3">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small text-uppercase">Admin Staff</span>
                  <h3 className="mb-0 fw-bold mt-1">{stats.totalAdmins}</h3>
                </div>
                <div className="bg-light rounded-circle p-3">
                  <i className="bi bi-person-badge fs-4 text-secondary"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="row g-4 mb-4">
        {/* User Growth Chart */}
        <div className="col-lg-6">
          <div className="chart-card">
            <div className="chart-card-header">
              <div>
                <h6 className="mb-0 fw-bold">User Growth</h6>
                <small className="text-muted">Last 7 days registration trend</small>
              </div>
            </div>
            <div className="chart-card-body">
              <div className="chart-bars">
                {userGrowthData.map((item, idx) => (
                  <div key={idx} className="chart-bar-item">
                    <div className="chart-bar-label">{item.day}</div>
                    <div className="chart-bar-container">
                      <div 
                        className="chart-bar-fill bg-primary"
                        style={{ height: `${item.percentage}%` }}
                      >
                        <span className="chart-bar-value">{item.count}</span>
                      </div>
                    </div>
                    <div className="chart-bar-full">{item.fullDay}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Activity Chart */}
        <div className="col-lg-6">
          <div className="chart-card">
            <div className="chart-card-header">
              <div>
                <h6 className="mb-0 fw-bold">Platform Activity</h6>
                <small className="text-muted">Weekly activity distribution</small>
              </div>
            </div>
            <div className="chart-card-body">
              <div className="chart-bars horizontal">
                {weeklyActivityData.map((item, idx) => (
                  <div key={idx} className="chart-bar-item-horizontal">
                    <div className="chart-bar-label-horizontal">{item.day}</div>
                    <div className="chart-bar-container-horizontal">
                      <div 
                        className="chart-bar-fill-horizontal bg-info"
                        style={{ width: `${item.percentage}%` }}
                      >
                        <span className="chart-bar-value-horizontal">{item.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Health & Category Distribution */}
      <div className="row g-4 mb-4">
        {/* System Health */}
        <div className="col-lg-5">
          <div className="chart-card">
            <div className="chart-card-header">
              <h6 className="mb-0 fw-bold">System Health</h6>
              <small className="text-muted">Real-time performance metrics</small>
            </div>
            <div className="chart-card-body">
              <div className="health-metric">
                <div className="health-metric-header">
                  <span>API Response Time</span>
                  <span className="fw-bold">{stats.responseTime}s</span>
                </div>
                <div className="progress-bar-custom">
                  <div className="progress-fill bg-primary" style={{ width: '95%' }}></div>
                </div>
              </div>
              <div className="health-metric">
                <div className="health-metric-header">
                  <span>User Satisfaction</span>
                  <span className="fw-bold">{stats.satisfactionRate}%</span>
                </div>
                <div className="progress-bar-custom">
                  <div className="progress-fill bg-success" style={{ width: `${stats.satisfactionRate}%` }}></div>
                </div>
              </div>
              <div className="health-metric">
                <div className="health-metric-header">
                  <span>System Uptime</span>
                  <span className="fw-bold">{stats.systemUptime}%</span>
                </div>
                <div className="progress-bar-custom">
                  <div className="progress-fill bg-info" style={{ width: `${stats.systemUptime}%` }}></div>
                </div>
              </div>
              <div className="health-metric">
                <div className="health-metric-header">
                  <span>Database Health</span>
                  <span className="fw-bold">98.5%</span>
                </div>
                <div className="progress-bar-custom">
                  <div className="progress-fill bg-warning" style={{ width: '98.5%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="col-lg-7">
          <div className="chart-card">
            <div className="chart-card-header">
              <h6 className="mb-0 fw-bold">Activity Distribution</h6>
              <small className="text-muted">By module type</small>
            </div>
            <div className="chart-card-body">
              {categoryDistribution.map((cat, idx) => (
                <div key={idx} className="distribution-item">
                  <div className="distribution-header">
                    <span>{cat.name}</span>
                    <span className="fw-bold">{cat.count.toLocaleString()}</span>
                  </div>
                  <div className="progress-bar-custom">
                    <div 
                      className={`progress-fill ${idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-success' : idx === 2 ? 'bg-warning' : 'bg-info'}`} 
                      style={{ width: `${cat.percentage}%` }}
                    ></div>
                  </div>
                  <small className="text-muted">{cat.percentage.toFixed(1)}% of total</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Users Table */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="data-table-card">
            <div className="data-table-header">
              <div>
                <h6 className="mb-0 fw-bold">Recent User Registrations</h6>
                <small className="text-muted">Latest 5 users joined the platform</small>
              </div>
              <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/users')}>
                View All <i className="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
            <div className="data-table-body">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Joined Date</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map(user => (
                    <tr key={user.admin_id}>
                      <td className="fw-semibold">{user.full_name}</td>
                      <td className="text-muted">{user.email}</td>
                      <td className="text-muted">{formatDate(user.created_at).split(',')[0]}</td>
                      <td>
                        {user.is_super_admin ? (
                          <span className="badge bg-primary bg-opacity-10 text-primary">Super Admin</span>
                        ) : (
                          <span className="badge bg-secondary bg-opacity-10 text-secondary">Admin</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${user.is_active ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities & Security Alerts */}
      <div className="row g-4">
        {/* Recent Activities */}
        <div className="col-lg-6">
          <div className="data-table-card">
            <div className="data-table-header">
              <div>
                <h6 className="mb-0 fw-bold">Recent Activities</h6>
                <small className="text-muted">Latest platform activities</small>
              </div>
              <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/security/logs')}>
                View All <i className="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
            <div className="data-table-body p-0">
              {recentActivities.map((activity, idx) => (
                <div key={idx} className="activity-item">
                  <div className="activity-icon">
                    <i className="bi bi-activity text-secondary"></i>
                  </div>
                  <div className="activity-content">
                    <p className="mb-1">{activity.activity_description}</p>
                    <small className="text-muted">
                      {activity.admin_users?.full_name || 'System'} • {formatDate(activity.created_at)}
                    </small>
                  </div>
                </div>
              ))}
              {recentActivities.length === 0 && (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-inbox fs-1"></i>
                  <p className="mt-2 mb-0">No recent activities</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security Alerts */}
        <div className="col-lg-6">
          <div className="data-table-card">
            <div className="data-table-header">
              <div>
                <h6 className="mb-0 fw-bold">Security Alerts</h6>
                <small className="text-muted">Active security events</small>
              </div>
              <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/security')}>
                View All <i className="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
            <div className="data-table-body p-0">
              {securityAlertsList.map((alert, idx) => (
                <div key={idx} className="alert-item-dashboard">
                  <div className="alert-icon-dashboard">
                    <i className="bi bi-shield-exclamation text-warning"></i>
                  </div>
                  <div className="alert-content-dashboard">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className={`badge ${alert.severity_level === 'HIGH' ? 'bg-danger' : alert.severity_level === 'MEDIUM' ? 'bg-warning' : 'bg-info'} bg-opacity-10 text-${alert.severity_level === 'HIGH' ? 'danger' : alert.severity_level === 'MEDIUM' ? 'warning' : 'info'}`}>
                        {alert.severity_level}
                      </span>
                      <span className="text-muted small">{alert.alert_type}</span>
                    </div>
                    <p className="mb-1 small">{alert.alert_message}</p>
                    <div className="d-flex justify-content-between align-items-center mt-1">
                      <small className="text-muted">{formatDate(alert.created_at)}</small>
                      <button 
                        className="btn btn-sm btn-link text-success p-0"
                        onClick={() => dismissAlert(alert.alert_id)}
                      >
                        <i className="bi bi-check-lg me-1"></i>Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {securityAlertsList.length === 0 && (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-shield-check fs-1 text-success"></i>
                  <p className="mt-2 mb-0">No active security alerts</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Stats Cards */
        .stats-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;
          overflow: hidden;
          border: 1px solid rgba(0, 0, 0, 0.05);
        }
        
        .stats-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
        }
        
        .stats-card-body {
          padding: 1.5rem;
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }
        
        .stats-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .stats-icon i {
          font-size: 28px;
        }
        
        .stats-info {
          flex: 1;
        }
        
        .stats-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6c757d;
          font-weight: 600;
        }
        
        .stats-value {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 0.25rem 0;
          color: #1a1a2e;
        }
        
        .stats-badges {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.5rem;
        }
        
        .stats-badge {
          font-size: 0.7rem;
          padding: 0.25rem 0.6rem;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          background: #f8f9fa;
          color: #495057;
        }
        
        .stats-badge.bg-success {
          background: #e8f5e9 !important;
          color: #2e7d32;
        }
        
        .stats-badge.bg-warning {
          background: #fff3e0 !important;
          color: #e65100;
        }
        
        .stats-badge.bg-danger {
          background: #ffebee !important;
          color: #c62828;
        }
        
        .stats-badge.bg-secondary {
          background: #f5f5f5 !important;
          color: #616161;
        }
        
        /* Chart Cards */
        .chart-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          border: 1px solid rgba(0, 0, 0, 0.05);
          overflow: hidden;
        }
        
        .chart-card-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #eef2f6;
        }
        
        .chart-card-body {
          padding: 1.5rem;
        }
        
        /* Vertical Bar Chart */
        .chart-bars {
          display: flex;
          justify-content: space-around;
          align-items: flex-end;
          gap: 1rem;
          min-height: 280px;
        }
        
        .chart-bar-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
        
        .chart-bar-label {
          font-size: 0.75rem;
          color: #6c757d;
          font-weight: 500;
        }
        
        .chart-bar-container {
          width: 100%;
          height: 180px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          background: #f8f9fa;
          border-radius: 8px;
          position: relative;
        }
        
        .chart-bar-fill {
          width: 100%;
          border-radius: 8px;
          transition: height 0.5s ease;
          position: relative;
          min-height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .chart-bar-value {
          font-size: 0.7rem;
          font-weight: 600;
          color: white;
          position: absolute;
          top: -20px;
        }
        
        .chart-bar-full {
          font-size: 0.65rem;
          color: #6c757d;
          text-align: center;
        }
        
        /* Horizontal Bar Chart */
        .chart-bars.horizontal {
          flex-direction: column;
          gap: 1rem;
        }
        
        .chart-bar-item-horizontal {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .chart-bar-label-horizontal {
          width: 45px;
          font-size: 0.75rem;
          font-weight: 500;
          color: #495057;
        }
        
        .chart-bar-container-horizontal {
          flex: 1;
          height: 32px;
          background: #f8f9fa;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .chart-bar-fill-horizontal {
          height: 100%;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 0.75rem;
          transition: width 0.5s ease;
        }
        
        .chart-bar-value-horizontal {
          font-size: 0.7rem;
          font-weight: 600;
          color: white;
        }
        
        /* Health Metrics */
        .health-metric {
          margin-bottom: 1.25rem;
        }
        
        .health-metric-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.85rem;
          color: #495057;
        }
        
        .progress-bar-custom {
          background: #eef2f6;
          border-radius: 10px;
          height: 8px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          border-radius: 10px;
          transition: width 0.5s ease;
        }
        
        /* Distribution Items */
        .distribution-item {
          margin-bottom: 1.25rem;
        }
        
        .distribution-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.85rem;
          color: #495057;
        }
        
        /* Data Table Card */
        .data-table-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          border: 1px solid rgba(0, 0, 0, 0.05);
          overflow: hidden;
        }
        
        .data-table-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #eef2f6;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .data-table-body {
          padding: 1rem 1.5rem;
        }
        
        /* Custom Table */
        .custom-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .custom-table th {
          text-align: left;
          padding: 0.75rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6c757d;
          border-bottom: 1px solid #eef2f6;
        }
        
        .custom-table td {
          padding: 0.75rem 0.5rem;
          border-bottom: 1px solid #f0f0f0;
          font-size: 0.85rem;
        }
        
        .custom-table tr:last-child td {
          border-bottom: none;
        }
        
        /* Activity Items */
        .activity-item {
          display: flex;
          gap: 1rem;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #f0f0f0;
          transition: background 0.2s ease;
        }
        
        .activity-item:hover {
          background: #fafbfc;
        }
        
        .activity-icon {
          width: 36px;
          height: 36px;
          background: #f8f9fa;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .activity-icon i {
          font-size: 18px;
        }
        
        .activity-content {
          flex: 1;
        }
        
        .activity-content p {
          font-size: 0.85rem;
          margin-bottom: 0.25rem;
        }
        
        /* Alert Items */
        .alert-item-dashboard {
          display: flex;
          gap: 1rem;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .alert-icon-dashboard {
          width: 36px;
          height: 36px;
          background: #fff8e7;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .alert-content-dashboard {
          flex: 1;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
          .stats-card-body {
            flex-direction: column;
          }
          
          .stats-icon {
            width: 48px;
            height: 48px;
          }
          
          .stats-icon i {
            font-size: 24px;
          }
          
          .stats-value {
            font-size: 1.5rem;
          }
          
          .chart-bars {
            min-height: 220px;
          }
          
          .chart-bar-container {
            height: 140px;
          }
          
          .data-table-header {
            flex-direction: column;
            gap: 0.5rem;
            align-items: flex-start;
          }
        }
      `}</style>
    </AdminLayout>
  )
}