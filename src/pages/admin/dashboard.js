import { useEffect, useState, useCallback } from 'react'
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
      resolvedAlerts: 0
    },
    recentActivities: [],
    pendingReportsList: [],
    securityAlertsList: [],
    userGrowthData: [],
    recentUsers: []
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
    // Subscribe to admin_users changes
    supabase
      .channel('admin_users_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_users' }, () => fetchStats())
      .subscribe()

    // Subscribe to system_reports changes
    supabase
      .channel('reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_reports' }, () => {
        fetchStats()
        fetchPendingReports()
      })
      .subscribe()

    // Subscribe to security_alerts changes
    supabase
      .channel('alerts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_alerts' }, () => {
        fetchStats()
        fetchSecurityAlerts()
      })
      .subscribe()

    // Subscribe to admin_activity_logs changes
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
      fetchRecentUsers()
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
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const counts = new Array(7).fill(0)
        
        data.forEach(user => {
          const day = new Date(user.created_at).getDay()
          counts[day]++
        })
        
        setDashboardData(prev => ({
          ...prev,
          userGrowthData: days.map((day, index) => ({ day, count: counts[index] }))
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
        .select('admin_id, full_name, email, created_at, is_active')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!error && data) {
        setDashboardData(prev => ({ ...prev, recentUsers: data }))
      }
    } catch (err) {
      console.error('Error fetching recent users:', err)
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
        <div className="d-flex justify-content-center align-items-center min-vh-100">
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}></div>
            <h5 className="text-muted">Loading dashboard data...</h5>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const { stats, recentActivities, pendingReportsList, securityAlertsList, userGrowthData, recentUsers } = dashboardData

  return (
    <AdminLayout title="Dashboard">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-1 fw-bold text-dark">Dashboard</h4>
          <p className="text-muted mb-0">
            Welcome back, {session?.admin?.full_name?.split(' ')[0] || 'Admin'}
          </p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <small className="text-muted">
            <i className="bi bi-clock me-1"></i>
            Last updated: {lastUpdate.toLocaleTimeString()}
          </small>
          <button 
            className="btn btn-sm btn-outline-secondary"
            onClick={refreshData}
            disabled={refreshing}
          >
            <i className={`bi bi-arrow-repeat ${refreshing ? 'spinner-border spinner-border-sm' : ''} me-1`}></i>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards - Row 1 */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="text-muted text-uppercase small fw-semibold">Total Users</span>
                  <h2 className="mt-2 mb-1 fw-bold">{stats.totalUsers.toLocaleString()}</h2>
                  <div className="d-flex gap-2">
                    <span className="badge bg-success bg-opacity-10 text-success">
                      <i className="bi bi-check-circle me-1"></i>{stats.activeUsers} Active
                    </span>
                    <span className="badge bg-secondary bg-opacity-10 text-secondary">
                      <i className="bi bi-ban me-1"></i>{stats.inactiveUsers} Inactive
                    </span>
                  </div>
                </div>
                <div className="bg-primary bg-opacity-10 rounded-3 p-3">
                  <i className="bi bi-people fs-3 text-primary"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="text-muted text-uppercase small fw-semibold">Content Overview</span>
                  <h2 className="mt-2 mb-1 fw-bold">{stats.totalPosts.toLocaleString()}</h2>
                  <div className="d-flex gap-2">
                    <span className="badge bg-success bg-opacity-10 text-success">
                      <i className="bi bi-check-lg me-1"></i>{stats.approvedPosts} Approved
                    </span>
                    <span className="badge bg-warning bg-opacity-10 text-warning">
                      <i className="bi bi-hourglass me-1"></i>{stats.pendingPosts} Pending
                    </span>
                  </div>
                </div>
                <div className="bg-info bg-opacity-10 rounded-3 p-3">
                  <i className="bi bi-file-post fs-3 text-info"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="text-muted text-uppercase small fw-semibold">Reports</span>
                  <h2 className="mt-2 mb-1 fw-bold">{stats.totalReports.toLocaleString()}</h2>
                  <div className="d-flex gap-2">
                    <span className="badge bg-danger bg-opacity-10 text-danger">
                      <i className="bi bi-flag me-1"></i>{stats.pendingReports} Pending
                    </span>
                    <span className="badge bg-success bg-opacity-10 text-success">
                      <i className="bi bi-check-circle me-1"></i>{stats.resolvedReports} Resolved
                    </span>
                  </div>
                </div>
                <div className="bg-danger bg-opacity-10 rounded-3 p-3">
                  <i className="bi bi-flag fs-3 text-danger"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="text-muted text-uppercase small fw-semibold">Security Alerts</span>
                  <h2 className="mt-2 mb-1 fw-bold">{stats.totalAlerts.toLocaleString()}</h2>
                  <div className="d-flex gap-2">
                    <span className="badge bg-warning bg-opacity-10 text-warning">
                      <i className="bi bi-exclamation-triangle me-1"></i>{stats.totalAlerts - stats.resolvedAlerts} Active
                    </span>
                    <span className="badge bg-success bg-opacity-10 text-success">
                      <i className="bi bi-shield-check me-1"></i>{stats.resolvedAlerts} Resolved
                    </span>
                  </div>
                </div>
                <div className="bg-warning bg-opacity-10 rounded-3 p-3">
                  <i className="bi bi-shield-lock fs-3 text-warning"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Row 2 */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small">Messages</span>
                  <h3 className="mb-0 fw-bold">{stats.totalMessages.toLocaleString()}</h3>
                </div>
                <i className="bi bi-chat-dots fs-3 text-secondary"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small">Active Ads</span>
                  <h3 className="mb-0 fw-bold">{stats.activeAds}</h3>
                </div>
                <i className="bi bi-megaphone fs-3 text-secondary"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small">Barter Transactions</span>
                  <h3 className="mb-0 fw-bold">{stats.totalBarter.toLocaleString()}</h3>
                </div>
                <i className="bi bi-arrow-left-right fs-3 text-secondary"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small">Admin Staff</span>
                  <h3 className="mb-0 fw-bold">{stats.totalAdmins}</h3>
                </div>
                <i className="bi bi-person-badge fs-3 text-secondary"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="row g-4">
        {/* User Growth Chart */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent border-0 pt-4">
              <h5 className="mb-0 fw-bold">User Growth (Last 7 Days)</h5>
            </div>
            <div className="card-body pt-0">
              <div className="table-responsive">
                <table className="table table-borderless">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>New Users</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userGrowthData.map((item, idx) => (
                      <tr key={idx}>
                        <td className="text-muted">{item.day}</td>
                        <td className="fw-semibold">{item.count}</td>
                        <td style={{ width: '50%' }}>
                          <div className="progress" style={{ height: '8px' }}>
                            <div 
                              className="progress-bar bg-primary" 
                              style={{ width: `${Math.min(100, (item.count / Math.max(...userGrowthData.map(d => d.count), 1)) * 100)}%` }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Users */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent border-0 pt-4">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">Recent Users</h5>
                <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/users')}>
                  View All <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Joined</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map(user => (
                      <tr key={user.admin_id}>
                        <td className="fw-semibold">{user.full_name}</td>
                        <td className="text-muted small">{user.email}</td>
                        <td className="text-muted small">{formatDate(user.created_at).split(',')[0]}</td>
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

        {/* Recent Activities */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent border-0 pt-4">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">Recent Activities</h5>
                <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/security/logs')}>
                  View All <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {recentActivities.map((activity, idx) => (
                  <div key={idx} className="d-flex align-items-start gap-3 pb-3 mb-3 border-bottom">
                    <div className="bg-light rounded-circle p-2">
                      <i className="bi bi-activity text-secondary"></i>
                    </div>
                    <div className="flex-grow-1">
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
        </div>

        {/* Pending Reports */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent border-0 pt-4">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">Pending Reports</h5>
                <span className="badge bg-danger">{stats.pendingReports}</span>
              </div>
            </div>
            <div className="card-body pt-0">
              {pendingReportsList.map((report, idx) => (
                <div key={idx} className="pb-3 mb-3 border-bottom">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <p className="mb-1 fw-semibold">{report.report_reason}</p>
                      <small className="text-muted">{formatDate(report.created_at)}</small>
                    </div>
                    <button 
                      className="btn btn-sm btn-outline-success rounded-pill"
                      onClick={() => resolveReport(report.report_id)}
                    >
                      <i className="bi bi-check-lg me-1"></i>Resolve
                    </button>
                  </div>
                </div>
              ))}
              {pendingReportsList.length === 0 && (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-check-circle fs-1 text-success"></i>
                  <p className="mt-2 mb-0">No pending reports</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security Alerts */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent border-0 pt-4">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">Security Alerts</h5>
                <span className="badge bg-warning">{securityAlertsList.length}</span>
              </div>
            </div>
            <div className="card-body pt-0">
              {securityAlertsList.map((alert, idx) => (
                <div key={idx} className="pb-3 mb-3 border-bottom">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span className={`badge bg-${alert.severity_level === 'HIGH' ? 'danger' : alert.severity_level === 'MEDIUM' ? 'warning' : 'info'} bg-opacity-10 text-${alert.severity_level === 'HIGH' ? 'danger' : alert.severity_level === 'MEDIUM' ? 'warning' : 'info'}`}>
                          {alert.severity_level}
                        </span>
                        <span className="text-muted small">{alert.alert_type}</span>
                      </div>
                      <p className="mb-1 small">{alert.alert_message}</p>
                      <small className="text-muted">{formatDate(alert.created_at)}</small>
                    </div>
                    <button 
                      className="btn btn-sm btn-outline-secondary rounded-pill"
                      onClick={() => dismissAlert(alert.alert_id)}
                    >
                      <i className="bi bi-check-lg me-1"></i>Dismiss
                    </button>
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

        {/* Quick Actions */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent border-0 pt-4">
              <h5 className="mb-0 fw-bold">Quick Actions</h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4 col-sm-6">
                  <button className="btn btn-outline-primary w-100 py-3 rounded-3 text-start" onClick={() => router.push('/admin/users/create')}>
                    <i className="bi bi-person-plus fs-4 d-block mb-2"></i>
                    <span className="fw-semibold">Add New User</span>
                    <small className="d-block text-muted mt-1">Create admin account</small>
                  </button>
                </div>
                <div className="col-md-4 col-sm-6">
                  <button className="btn btn-outline-info w-100 py-3 rounded-3 text-start" onClick={() => router.push('/admin/posts')}>
                    <i className="bi bi-file-post fs-4 d-block mb-2"></i>
                    <span className="fw-semibold">Moderate Content</span>
                    <small className="d-block text-muted mt-1">Review pending posts</small>
                  </button>
                </div>
                <div className="col-md-4 col-sm-6">
                  <button className="btn btn-outline-danger w-100 py-3 rounded-3 text-start" onClick={() => router.push('/admin/reports')}>
                    <i className="bi bi-flag fs-4 d-block mb-2"></i>
                    <span className="fw-semibold">View Reports</span>
                    <small className="d-block text-muted mt-1">Handle user reports</small>
                  </button>
                </div>
                <div className="col-md-4 col-sm-6">
                  <button className="btn btn-outline-secondary w-100 py-3 rounded-3 text-start" onClick={() => router.push('/admin/security')}>
                    <i className="bi bi-shield-lock fs-4 d-block mb-2"></i>
                    <span className="fw-semibold">Security Center</span>
                    <small className="d-block text-muted mt-1">Monitor security</small>
                  </button>
                </div>
                <div className="col-md-4 col-sm-6">
                  <button className="btn btn-outline-success w-100 py-3 rounded-3 text-start" onClick={() => router.push('/admin/analytics')}>
                    <i className="bi bi-graph-up fs-4 d-block mb-2"></i>
                    <span className="fw-semibold">View Analytics</span>
                    <small className="d-block text-muted mt-1">Detailed insights</small>
                  </button>
                </div>
                <div className="col-md-4 col-sm-6">
                  <button className="btn btn-outline-dark w-100 py-3 rounded-3 text-start" onClick={() => router.push('/admin/settings')}>
                    <i className="bi bi-gear fs-4 d-block mb-2"></i>
                    <span className="fw-semibold">System Settings</span>
                    <small className="d-block text-muted mt-1">Configure platform</small>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}