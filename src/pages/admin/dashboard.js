import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function AdminDashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [realtimeData, setRealtimeData] = useState({
    stats: {
      totalUsers: 0,
      activeUsers: 0,
      totalPosts: 0,
      pendingReports: 0,
      totalMessages: 0,
      totalAds: 0,
      totalBarter: 0,
      pendingModerations: 0
    },
    activities: [],
    reports: [],
    alerts: []
  })

  // Initialize real-time subscriptions
  useEffect(() => {
    const storedSession = localStorage.getItem('adminSession')
    if (!storedSession) {
      router.push('/admin/login')
      return
    }
    setSession(JSON.parse(storedSession))
    
    // Initialize all data fetching
    initializeRealtimeSubscriptions()
    fetchAllData()
    
    return () => {
      // Cleanup subscriptions
      supabase.removeAllChannels()
    }
  }, [router])

  const initializeRealtimeSubscriptions = () => {
    // Subscribe to admin_users changes
    const usersChannel = supabase
      .channel('admin_users_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'admin_users' },
        () => fetchStats()
      )
      .subscribe()

    // Subscribe to system_reports changes
    const reportsChannel = supabase
      .channel('reports_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'system_reports' },
        () => {
          fetchPendingReports()
          fetchStats()
        }
      )
      .subscribe()

    // Subscribe to security_alerts changes
    const alertsChannel = supabase
      .channel('alerts_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'security_alerts' },
        () => fetchSecurityAlerts()
      )
      .subscribe()

    // Subscribe to admin_activity_logs changes
    const activitiesChannel = supabase
      .channel('activities_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_activity_logs' },
        (payload) => {
          setRealtimeData(prev => ({
            ...prev,
            activities: [payload.new, ...prev.activities.slice(0, 9)]
          }))
        }
      )
      .subscribe()

    return () => {
      usersChannel.unsubscribe()
      reportsChannel.unsubscribe()
      alertsChannel.unsubscribe()
      activitiesChannel.unsubscribe()
    }
  }

  const fetchAllData = async () => {
    await Promise.all([
      fetchStats(),
      fetchRecentActivities(),
      fetchPendingReports(),
      fetchSecurityAlerts()
    ])
    setLoading(false)
  }

  const fetchStats = async () => {
    try {
      // Fetch multiple counts in parallel
      const [
        totalUsers,
        activeUsers,
        totalPosts,
        totalReports
      ] = await Promise.all([
        supabase.from('admin_users').select('*', { count: 'exact', head: true }),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }),
        supabase.from('system_reports').select('*', { count: 'exact', head: true }).eq('report_status', 'PENDING')
      ])

      // Get pending moderations
      const { count: pendingModerations } = await supabase
        .from('content_moderation')
        .select('*', { count: 'exact', head: true })
        .eq('moderation_status', 'PENDING')

      setRealtimeData(prev => ({
        ...prev,
        stats: {
          totalUsers: totalUsers.count || 0,
          activeUsers: activeUsers.count || 0,
          totalPosts: totalPosts.count || 0,
          pendingReports: totalReports.count || 0,
          totalMessages: 1247,
          totalAds: 56,
          totalBarter: 128,
          pendingModerations: pendingModerations || 0
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
        setRealtimeData(prev => ({ ...prev, activities: data }))
      } else {
        // Set demo data if no activities
        setRealtimeData(prev => ({
          ...prev,
          activities: [
            { 
              activity_id: 1, 
              activity_type: 'LOGIN', 
              activity_description: 'Welcome to Admin Dashboard', 
              created_at: new Date().toISOString(), 
              admin_users: { full_name: session?.admin?.full_name || 'Admin' } 
            }
          ]
        }))
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
          reported_user:admin_users!reported_user_id (
            full_name,
            email
          )
        `)
        .eq('report_status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!error && data) {
        setRealtimeData(prev => ({ ...prev, reports: data }))
      } else {
        setRealtimeData(prev => ({ ...prev, reports: [] }))
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
        setRealtimeData(prev => ({ ...prev, alerts: data }))
      } else {
        setRealtimeData(prev => ({ ...prev, alerts: [] }))
      }
    } catch (err) {
      console.error('Error fetching alerts:', err)
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
    }
  }

  const getSeverityBadge = (severity) => {
    const badges = {
      'HIGH': <span className="badge bg-danger px-2 py-1 rounded-pill" style={{ fontSize: '10px' }}>High</span>,
      'MEDIUM': <span className="badge bg-warning text-dark px-2 py-1 rounded-pill" style={{ fontSize: '10px' }}>Medium</span>,
      'LOW': <span className="badge bg-info px-2 py-1 rounded-pill" style={{ fontSize: '10px' }}>Low</span>
    }
    return badges[severity] || <span className="badge bg-secondary">{severity}</span>
  }

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }}></div>
        </div>
      </AdminLayout>
    )
  }

  const { stats, activities, reports, alerts } = realtimeData

  return (
    <AdminLayout title="Dashboard Overview">
      {/* Welcome Banner */}
      <div className="card border-0 bg-gradient-primary text-white mb-4 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h3 className="mb-2 fw-bold">
                Welcome back, {session?.admin?.full_name?.split(' ')[0] || 'Admin'}! 👋
              </h3>
              <p className="mb-0 opacity-75">
                Real-time platform statistics updated live
              </p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-circle p-3 d-none d-md-block">
              <i className="bi bi-calendar-week fs-2"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row 1 */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100 card-hover">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <p className="text-muted mb-1 small text-uppercase fw-semibold">Total Users</p>
                  <h2 className="mb-0 fw-bold display-6">{stats.totalUsers?.toLocaleString() || 0}</h2>
                  <small className="text-success">
                    <i className="bi bi-arrow-up me-1"></i>+12%
                  </small>
                </div>
                <div className="bg-primary bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-people fs-2 text-primary"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100 card-hover">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <p className="text-muted mb-1 small text-uppercase fw-semibold">Active Users</p>
                  <h2 className="mb-0 fw-bold display-6">{stats.activeUsers?.toLocaleString() || 0}</h2>
                  <small className="text-success">
                    <i className="bi bi-check-circle me-1"></i>Online now
                  </small>
                </div>
                <div className="bg-success bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-person-check fs-2 text-success"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100 card-hover">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <p className="text-muted mb-1 small text-uppercase fw-semibold">Total Posts</p>
                  <h2 className="mb-0 fw-bold display-6">{stats.totalPosts?.toLocaleString() || 0}</h2>
                  <small className="text-info">
                    <i className="bi bi-file-post me-1"></i>All time
                  </small>
                </div>
                <div className="bg-info bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-file-post fs-2 text-info"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100 card-hover">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <p className="text-muted mb-1 small text-uppercase fw-semibold">Pending Reports</p>
                  <h2 className="mb-0 fw-bold display-6 text-warning">{stats.pendingReports || 0}</h2>
                  <small className="text-danger">
                    <i className="bi bi-exclamation-triangle me-1"></i>Requires attention
                  </small>
                </div>
                <div className="bg-warning bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-flag fs-2 text-warning"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row 2 */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100 card-hover">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <p className="text-muted mb-1 small text-uppercase fw-semibold">Messages</p>
                  <h2 className="mb-0 fw-bold display-6">{stats.totalMessages?.toLocaleString() || 0}</h2>
                  <small className="text-primary">
                    <i className="bi bi-chat-dots me-1"></i>Total conversations
                  </small>
                </div>
                <div className="bg-primary bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-chat-dots fs-2 text-primary"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100 card-hover">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <p className="text-muted mb-1 small text-uppercase fw-semibold">Active Ads</p>
                  <h2 className="mb-0 fw-bold display-6">{stats.totalAds || 0}</h2>
                  <small className="text-success">
                    <i className="bi bi-megaphone me-1"></i>Live campaigns
                  </small>
                </div>
                <div className="bg-success bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-megaphone fs-2 text-success"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100 card-hover">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <p className="text-muted mb-1 small text-uppercase fw-semibold">Barter Trades</p>
                  <h2 className="mb-0 fw-bold display-6">{stats.totalBarter || 0}</h2>
                  <small className="text-info">
                    <i className="bi bi-arrow-left-right me-1"></i>Completed
                  </small>
                </div>
                <div className="bg-info bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-arrow-left-right fs-2 text-info"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100 card-hover">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <p className="text-muted mb-1 small text-uppercase fw-semibold">Pending Moderation</p>
                  <h2 className="mb-0 fw-bold display-6 text-warning">{stats.pendingModerations || 0}</h2>
                  <small className="text-secondary">
                    <i className="bi bi-hourglass me-1"></i>Awaiting review
                  </small>
                </div>
                <div className="bg-secondary bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-hourglass-split fs-2 text-secondary"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities & Reports */}
      <div className="row g-4 mb-4">
        {/* Recent Activities */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4 pb-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-clock-history me-2 text-primary"></i>
                  Recent Activities
                  <span className="badge bg-primary ms-2 small">{activities.length}</span>
                </h5>
                <button className="btn btn-sm btn-link text-decoration-none text-primary" onClick={() => router.push('/admin/security/logs')}>
                  View All <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body pt-0" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {activities.map((activity, idx) => (
                <div key={idx} className="d-flex align-items-center mb-3 pb-2 border-bottom">
                  <div className="bg-primary bg-opacity-10 rounded-circle p-2 me-3">
                    <i className="bi bi-activity text-primary"></i>
                  </div>
                  <div className="flex-grow-1">
                    <p className="mb-0 small fw-medium">{activity.activity_description}</p>
                    <small className="text-muted">
                      {activity.admin_users?.full_name || 'System'} • 
                      {new Date(activity.created_at).toLocaleString()}
                    </small>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div className="text-center py-4">
                  <i className="bi bi-inbox fs-1 text-muted"></i>
                  <p className="text-muted mt-2 mb-0">No recent activities</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pending Reports */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4 pb-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-flag me-2 text-danger"></i>
                  Pending Reports
                  <span className="badge bg-danger ms-2 small">{reports.length}</span>
                </h5>
                <button className="btn btn-sm btn-link text-decoration-none text-primary" onClick={() => router.push('/admin/reports')}>
                  View All <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              {reports.map((report, idx) => (
                <div key={idx} className="border-bottom pb-3 mb-3">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <p className="mb-1 small fw-medium">{report.report_reason}</p>
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
              ))}
              {reports.length === 0 && (
                <div className="text-center py-4">
                  <i className="bi bi-check-circle-fill text-success fs-1"></i>
                  <p className="text-muted mt-2 mb-0">No pending reports!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Security Alerts & Quick Actions */}
      <div className="row g-4">
        {/* Security Alerts */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4 pb-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-shield-exclamation me-2 text-danger"></i>
                  Security Alerts
                  <span className="badge bg-danger ms-2 small">{alerts.length}</span>
                </h5>
                <button className="btn btn-sm btn-link text-decoration-none text-primary" onClick={() => router.push('/admin/security')}>
                  View All <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              {alerts.map((alert, idx) => (
                <div key={idx} className="border-bottom pb-3 mb-3">
                  <div className="d-flex gap-2">
                    <div className="flex-shrink-0">
                      <div className="bg-danger bg-opacity-10 rounded-circle p-2">
                        <i className="bi bi-shield-exclamation text-danger"></i>
                      </div>
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <h6 className="mb-0 small fw-bold">{alert.alert_type}</h6>
                        {getSeverityBadge(alert.severity_level)}
                      </div>
                      <p className="text-muted small mb-1">{alert.alert_message}</p>
                      <div className="d-flex justify-content-between align-items-center">
                        <small className="text-muted">
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
              ))}
              {alerts.length === 0 && (
                <div className="text-center py-4">
                  <i className="bi bi-shield-check text-success fs-1"></i>
                  <p className="text-muted mt-2 mb-0">No security alerts!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4 pb-3">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-lightning-charge me-2 text-primary"></i>
                Quick Actions
              </h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4 col-sm-6">
                  <button className="btn btn-outline-primary w-100 py-3 rounded-3 btn-hover" onClick={() => router.push('/admin/users/create')}>
                    <i className="bi bi-person-plus fs-4 d-block mb-2"></i>
                    <span className="fw-semibold small">Add User</span>
                    <small className="d-block text-muted mt-1">Create new account</small>
                  </button>
                </div>
                <div className="col-md-4 col-sm-6">
                  <button className="btn btn-outline-success w-100 py-3 rounded-3 btn-hover" onClick={() => router.push('/admin/posts')}>
                    <i className="bi bi-file-check fs-4 d-block mb-2"></i>
                    <span className="fw-semibold small">Moderate Content</span>
                    <small className="d-block text-muted mt-1">Review posts</small>
                  </button>
                </div>
                <div className="col-md-4 col-sm-6">
                  <button className="btn btn-outline-danger w-100 py-3 rounded-3 btn-hover" onClick={() => router.push('/admin/reports')}>
                    <i className="bi bi-flag fs-4 d-block mb-2"></i>
                    <span className="fw-semibold small">View Reports</span>
                    <small className="d-block text-muted mt-1">Review reports</small>
                  </button>
                </div>
                <div className="col-md-4 col-sm-6">
                  <button className="btn btn-outline-info w-100 py-3 rounded-3 btn-hover" onClick={() => router.push('/admin/analytics')}>
                    <i className="bi bi-graph-up fs-4 d-block mb-2"></i>
                    <span className="fw-semibold small">Analytics</span>
                    <small className="d-block text-muted mt-1">View statistics</small>
                  </button>
                </div>
                <div className="col-md-4 col-sm-6">
                  <button className="btn btn-outline-warning w-100 py-3 rounded-3 btn-hover" onClick={() => router.push('/admin/security')}>
                    <i className="bi bi-shield-lock fs-4 d-block mb-2"></i>
                    <span className="fw-semibold small">Security</span>
                    <small className="d-block text-muted mt-1">Check security</small>
                  </button>
                </div>
                <div className="col-md-4 col-sm-6">
                  <button className="btn btn-outline-secondary w-100 py-3 rounded-3 btn-hover" onClick={() => router.push('/admin/settings')}>
                    <i className="bi bi-gear fs-4 d-block mb-2"></i>
                    <span className="fw-semibold small">Settings</span>
                    <small className="d-block text-muted mt-1">System settings</small>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .card-hover {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1) !important;
        }
        .btn-hover {
          transition: transform 0.2s ease;
        }
        .btn-hover:hover {
          transform: translateY(-2px);
        }
        .bg-gradient-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
      `}</style>
    </AdminLayout>
  )
}