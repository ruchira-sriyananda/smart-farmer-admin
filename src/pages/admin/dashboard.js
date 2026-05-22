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
  const [activeTab, setActiveTab] = useState('overview')
  
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
    weeklyUserData: [],
    monthlyUserData: [],
    recentUsers: [],
    postCategories: [],
    reportCategories: []
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
      fetchUserGrowthData(),
      fetchRecentUsers(),
      fetchPostCategories(),
      fetchReportCategories()
    ])
    setLoading(false)
  }

  const fetchStats = async () => {
    try {
      const [
        { count: totalUsers },
        { count: activeUsers },
        { count: superAdmins },
        { count: totalAdmins },
        { count: totalPosts },
        { count: approvedPosts },
        { count: pendingPosts },
        { count: rejectedPosts },
        { count: totalReports },
        { count: pendingReports },
        { count: resolvedReports },
        { count: totalAlerts },
        { count: resolvedAlerts }
      ] = await Promise.all([
        supabase.from('admin_users').select('*', { count: 'exact', head: true }),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_super_admin', true),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }).eq('moderation_status', 'APPROVED'),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }).eq('moderation_status', 'PENDING'),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }).eq('moderation_status', 'REJECTED'),
        supabase.from('system_reports').select('*', { count: 'exact', head: true }),
        supabase.from('system_reports').select('*', { count: 'exact', head: true }).eq('report_status', 'PENDING'),
        supabase.from('system_reports').select('*', { count: 'exact', head: true }).eq('report_status', 'RESOLVED'),
        supabase.from('security_alerts').select('*', { count: 'exact', head: true }),
        supabase.from('security_alerts').select('*', { count: 'exact', head: true }).eq('resolved', true)
      ])

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

  const fetchUserGrowthData = async () => {
    try {
      // Weekly data (last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data: weeklyData, error: weeklyError } = await supabase
        .from('admin_users')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true })

      if (!weeklyError && weeklyData) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const weeklyCounts = new Array(7).fill(0)
        const dailyDetails = new Array(7).fill(0)
        
        weeklyData.forEach(user => {
          const day = new Date(user.created_at).getDay()
          weeklyCounts[day]++
          dailyDetails[day]++
        })
        
        setDashboardData(prev => ({
          ...prev,
          weeklyUserData: days.map((day, index) => ({ 
            day, 
            count: weeklyCounts[index],
            percentage: Math.max(...weeklyCounts) > 0 ? (weeklyCounts[index] / Math.max(...weeklyCounts)) * 100 : 0
          }))
        }))
      }

      // Monthly data (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('admin_users')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true })

      if (!monthlyError && monthlyData) {
        const monthlyCounts = new Array(30).fill(0)
        monthlyData.forEach(user => {
          const dayDiff = Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
          if (dayDiff < 30) {
            monthlyCounts[29 - dayDiff]++
          }
        })
        
        setDashboardData(prev => ({
          ...prev,
          monthlyUserData: monthlyCounts
        }))
      }

      // Overall user growth trend
      const { data: allUsers } = await supabase
        .from('admin_users')
        .select('created_at')
        .order('created_at', { ascending: true })

      if (allUsers) {
        const monthlyAggregated = {}
        allUsers.forEach(user => {
          const month = new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          monthlyAggregated[month] = (monthlyAggregated[month] || 0) + 1
        })
        
        setDashboardData(prev => ({
          ...prev,
          userGrowthData: Object.entries(monthlyAggregated).map(([month, count]) => ({ month, count }))
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

  const fetchPostCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('content_moderation')
        .select('content_type, moderation_status')
        
      if (!error && data) {
        const categories = {}
        data.forEach(item => {
          const key = item.content_type || 'other'
          categories[key] = (categories[key] || 0) + 1
        })
        
        setDashboardData(prev => ({
          ...prev,
          postCategories: Object.entries(categories).map(([name, value]) => ({ name, value }))
        }))
      }
    } catch (err) {
      console.error('Error fetching post categories:', err)
    }
  }

  const fetchReportCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('system_reports')
        .select('report_reason')
        
      if (!error && data) {
        const categories = {}
        data.forEach(report => {
          categories[report.report_reason] = (categories[report.report_reason] || 0) + 1
        })
        
        setDashboardData(prev => ({
          ...prev,
          reportCategories: Object.entries(categories).map(([name, value]) => ({ name, value }))
        }))
      }
    } catch (err) {
      console.error('Error fetching report categories:', err)
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

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    return `${diffDays} days ago`
  }

  const getMaxWeeklyCount = () => {
    return Math.max(...dashboardData.weeklyUserData.map(d => d.count), 1)
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

  const { stats, recentActivities, pendingReportsList, securityAlertsList, weeklyUserData, recentUsers } = dashboardData

  return (
    <AdminLayout title="Dashboard">
      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h4 className="mb-1 fw-bold text-dark">Dashboard</h4>
          <p className="text-muted mb-0">
            Welcome back, {session?.admin?.full_name?.split(' ')[0] || 'Admin'}
          </p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <div className="text-end">
            <small className="text-muted d-block">Last updated</small>
            <small className="text-muted">{lastUpdate.toLocaleTimeString()}</small>
          </div>
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

      {/* Tab Navigation */}
      <ul className="nav nav-tabs mb-4 border-0 gap-2">
        <li className="nav-item">
          <button 
            className={`nav-link px-4 py-2 rounded-3 ${activeTab === 'overview' ? 'bg-primary text-white' : 'bg-light text-dark'}`}
            onClick={() => setActiveTab('overview')}
          >
            <i className="bi bi-speedometer2 me-2"></i>Overview
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link px-4 py-2 rounded-3 ${activeTab === 'analytics' ? 'bg-primary text-white' : 'bg-light text-dark'}`}
            onClick={() => setActiveTab('analytics')}
          >
            <i className="bi bi-graph-up me-2"></i>Analytics
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link px-4 py-2 rounded-3 ${activeTab === 'activities' ? 'bg-primary text-white' : 'bg-light text-dark'}`}
            onClick={() => setActiveTab('activities')}
          >
            <i className="bi bi-clock-history me-2"></i>Activities
          </button>
        </li>
      </ul>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
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
                      <span className="text-muted small">Total Messages</span>
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
                      <span className="text-muted small">Active Advertisements</span>
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

          {/* User Growth Line Chart */}
          <div className="row g-4 mb-4">
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-transparent border-0 pt-4">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                      <h5 className="mb-0 fw-bold">User Growth Trend</h5>
                      <small className="text-muted">Weekly user registration analytics</small>
                    </div>
                    <div className="d-flex gap-2">
                      <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2">
                        <i className="bi bi-people me-1"></i>Total: {stats.totalUsers}
                      </span>
                      <span className="badge bg-success bg-opacity-10 text-success px-3 py-2">
                        <i className="bi bi-graph-up me-1"></i>+{stats.activeUsers} Active
                      </span>
                    </div>
                  </div>
                </div>
                <div className="card-body pt-0">
                  {/* Line Chart */}
                  <div className="position-relative" style={{ height: '320px' }}>
                    <svg width="100%" height="100%" viewBox="0 0 900 300" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                      {/* Grid lines */}
                      {[0, 60, 120, 180, 240, 300].map(y => (
                        <line key={y} x1="40" y1={y} x2="860" y2={y} stroke="#e9ecef" strokeWidth="1" strokeDasharray="4" />
                      ))}
                      
                      {/* Y-axis labels */}
                      {[0, 1, 2, 3, 4, 5].map((_, i) => {
                        const maxCount = getMaxWeeklyCount()
                        const value = Math.round(maxCount * (5 - i) / 5)
                        return (
                          <text key={i} x="35" y={i * 60 + 5} textAnchor="end" fontSize="11" fill="#6c757d">
                            {value}
                          </text>
                        )
                      })}
                      
                      {/* X-axis labels */}
                      {weeklyUserData.map((day, i) => {
                        const x = 60 + (i * (800 / 6))
                        return (
                          <text key={i} x={x} y="285" textAnchor="middle" fontSize="11" fill="#6c757d">
                            {day.day}
                          </text>
                        )
                      })}
                      
                      {/* Line Chart Data */}
                      {(() => {
                        const maxCount = getMaxWeeklyCount()
                        const points = weeklyUserData.map((day, i) => {
                          const x = 60 + (i * (800 / 6))
                          const y = 250 - (day.count / maxCount) * 240
                          return `${x},${y}`
                        }).join(' ')
                        
                        const areaPoints = weeklyUserData.map((day, i) => {
                          const x = 60 + (i * (800 / 6))
                          const y = 250 - (day.count / maxCount) * 240
                          return `${x},${y}`
                        }).join(' ') + ' 860,280 40,280'
                        
                        return (
                          <>
                            {/* Area fill */}
                            <polygon points={areaPoints} fill="rgba(13, 110, 253, 0.1)" />
                            
                            {/* Line */}
                            <polyline points={points} fill="none" stroke="#0d6efd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            
                            {/* Data points */}
                            {weeklyUserData.map((day, i) => {
                              const x = 60 + (i * (800 / 6))
                              const y = 250 - (day.count / maxCount) * 240
                              return (
                                <g key={i}>
                                  <circle cx={x} cy={y} r="4" fill="#0d6efd" stroke="#fff" strokeWidth="2" />
                                  <title>{day.count} new users on {day.day}</title>
                                </g>
                              )
                            })}
                          </>
                        )
                      })()}
                    </svg>
                  </div>
                  
                  {/* Chart Summary Stats */}
                  <div className="row g-3 mt-3 pt-2 border-top">
                    <div className="col-md-3 col-6">
                      <div className="text-center">
                        <small className="text-muted d-block">Peak Day</small>
                        <strong className="text-primary">
                          {weeklyUserData.reduce((max, day) => day.count > max.count ? day : max, { count: 0 }).day || 'N/A'}
                        </strong>
                      </div>
                    </div>
                    <div className="col-md-3 col-6">
                      <div className="text-center">
                        <small className="text-muted d-block">Weekly Average</small>
                        <strong>{(weeklyUserData.reduce((sum, day) => sum + day.count, 0) / 7).toFixed(1)}</strong>
                      </div>
                    </div>
                    <div className="col-md-3 col-6">
                      <div className="text-center">
                        <small className="text-muted d-block">Highest Count</small>
                        <strong className="text-success">{Math.max(...weeklyUserData.map(d => d.count))}</strong>
                      </div>
                    </div>
                    <div className="col-md-3 col-6">
                      <div className="text-center">
                        <small className="text-muted d-block">Total This Week</small>
                        <strong>{weeklyUserData.reduce((sum, day) => sum + day.count, 0)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Users and Quick Actions */}
          <div className="row g-4">
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
                      <thead className="table-light">
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
                            <td className="fw-semibold">
                              {user.full_name}
                              {user.is_super_admin && (
                                <span className="badge bg-primary bg-opacity-10 text-primary ms-2">Super Admin</span>
                              )}
                            </td>
                            <td className="text-muted small">{user.email}</td>
                            <td className="text-muted small">{formatRelativeTime(user.created_at)}</td>
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

            <div className="col-lg-6">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-transparent border-0 pt-4">
                  <h5 className="mb-0 fw-bold">Quick Actions</h5>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-md-4 col-sm-6">
                      <button className="btn btn-outline-primary w-100 py-3 rounded-3 text-start" onClick={() => router.push('/admin/users/create')}>
                        <i className="bi bi-person-plus fs-4 d-block mb-2"></i>
                        <span className="fw-semibold">Add User</span>
                        <small className="d-block text-muted mt-1">Create new admin</small>
                      </button>
                    </div>
                    <div className="col-md-4 col-sm-6">
                      <button className="btn btn-outline-info w-100 py-3 rounded-3 text-start" onClick={() => router.push('/admin/posts')}>
                        <i className="bi bi-file-post fs-4 d-block mb-2"></i>
                        <span className="fw-semibold">Moderate</span>
                        <small className="d-block text-muted mt-1">Review content</small>
                      </button>
                    </div>
                    <div className="col-md-4 col-sm-6">
                      <button className="btn btn-outline-danger w-100 py-3 rounded-3 text-start" onClick={() => router.push('/admin/reports')}>
                        <i className="bi bi-flag fs-4 d-block mb-2"></i>
                        <span className="fw-semibold">Reports</span>
                        <small className="d-block text-muted mt-1">Handle reports</small>
                      </button>
                    </div>
                    <div className="col-md-4 col-sm-6">
                      <button className="btn btn-outline-secondary w-100 py-3 rounded-3 text-start" onClick={() => router.push('/admin/security')}>
                        <i className="bi bi-shield-lock fs-4 d-block mb-2"></i>
                        <span className="fw-semibold">Security</span>
                        <small className="d-block text-muted mt-1">Monitor security</small>
                      </button>
                    </div>
                    <div className="col-md-4 col-sm-6">
                      <button className="btn btn-outline-success w-100 py-3 rounded-3 text-start" onClick={() => router.push('/admin/analytics')}>
                        <i className="bi bi-graph-up fs-4 d-block mb-2"></i>
                        <span className="fw-semibold">Analytics</span>
                        <small className="d-block text-muted mt-1">View insights</small>
                      </button>
                    </div>
                    <div className="col-md-4 col-sm-6">
                      <button className="btn btn-outline-dark w-100 py-3 rounded-3 text-start" onClick={() => router.push('/admin/settings')}>
                        <i className="bi bi-gear fs-4 d-block mb-2"></i>
                        <span className="fw-semibold">Settings</span>
                        <small className="d-block text-muted mt-1">Configure system</small>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="row g-4">
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-transparent border-0 pt-4">
                <h5 className="mb-0 fw-bold">Content Distribution</h5>
              </div>
              <div className="card-body">
                {dashboardData.postCategories.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Content Type</th>
                          <th>Count</th>
                          <th>Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.postCategories.map((cat, idx) => {
                          const total = dashboardData.postCategories.reduce((sum, c) => sum + c.value, 0)
                          const percent = ((cat.value / total) * 100).toFixed(1)
                          return (
                            <tr key={idx}>
                              <td className="text-capitalize">{cat.name}</td>
                              <td>{cat.value}</td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <div className="progress flex-grow-1" style={{ height: '6px' }}>
                                    <div className="progress-bar bg-primary" style={{ width: `${percent}%` }}></div>
                                  </div>
                                  <small>{percent}%</small>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted">No data available</div>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-transparent border-0 pt-4">
                <h5 className="mb-0 fw-bold">Report Categories</h5>
              </div>
              <div className="card-body">
                {dashboardData.reportCategories.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Reason</th>
                          <th>Count</th>
                          <th>Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.reportCategories.map((cat, idx) => {
                          const total = dashboardData.reportCategories.reduce((sum, c) => sum + c.value, 0)
                          const percent = ((cat.value / total) * 100).toFixed(1)
                          return (
                            <tr key={idx}>
                              <td>{cat.name}</td>
                              <td>{cat.value}</td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <div className="progress flex-grow-1" style={{ height: '6px' }}>
                                    <div className="progress-bar bg-danger" style={{ width: `${percent}%` }}></div>
                                  </div>
                                  <small>{percent}%</small>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted">No data available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activities Tab */}
      {activeTab === 'activities' && (
        <div className="row g-4">
          <div className="col-lg-7">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-transparent border-0 pt-4">
                <h5 className="mb-0 fw-bold">Recent Activities</h5>
              </div>
              <div className="card-body pt-0">
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
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

          <div className="col-lg-5">
            <div className="card border-0 shadow-sm mb-4">
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
                    <p className="mt-2 mb-0">No active alerts</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .nav-tabs .nav-link {
          border: none;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        
        .nav-tabs .nav-link:hover:not(.bg-primary) {
          background-color: #e9ecef;
        }
        
        .card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.08) !important;
        }
        
        svg {
          overflow: visible;
        }
      `}</style>
    </AdminLayout>
  )
}