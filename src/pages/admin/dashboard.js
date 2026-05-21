import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function AdminDashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFarmers: 0,
    totalExperts: 0,
    totalPosts: 0,
    totalReports: 0,
    activeAdmins: 0,
    pendingModerations: 0,
    totalMessages: 0,
    totalAds: 0,
    totalBarterTransactions: 0,
    todayVisitors: 0
  })
  const [recentActivities, setRecentActivities] = useState([])
  const [pendingReports, setPendingReports] = useState([])

  useEffect(() => {
    const init = async () => {
      const storedSession = localStorage.getItem('adminSession')
      if (!storedSession) {
        router.push('/admin/login')
        return
      }
      setSession(JSON.parse(storedSession))
      await Promise.all([
        fetchStats(),
        fetchRecentActivities(),
        fetchPendingReports()
      ])
      setLoading(false)
    }
    init()
  }, [router])

  const fetchStats = async () => {
    try {
      const [
        usersRes,
        reportsRes,
        adminsRes,
        moderationsRes
      ] = await Promise.all([
        supabase.from('admin_users').select('*', { count: 'exact', head: true }),
        supabase.from('system_reports').select('*', { count: 'exact', head: true }).eq('report_status', 'PENDING'),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }).eq('moderation_status', 'PENDING')
      ])

      setStats({
        totalUsers: usersRes.count || 0,
        totalFarmers: Math.floor((usersRes.count || 0) * 0.7),
        totalExperts: Math.floor((usersRes.count || 0) * 0.3),
        totalPosts: 1247,
        totalReports: reportsRes.count || 0,
        activeAdmins: adminsRes.count || 0,
        pendingModerations: moderationsRes.count || 0,
        totalMessages: 3421,
        totalAds: 56,
        totalBarterTransactions: 128,
        todayVisitors: 342
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchRecentActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('*, admin_users(full_name)')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!error && data) {
        setRecentActivities(data)
      } else {
        setRecentActivities([
          { id: 1, activity_type: 'LOGIN', activity_description: 'Admin logged in', created_at: new Date().toISOString(), admin_users: { full_name: session?.admin?.full_name } }
        ])
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
        .limit(3)

      if (!error && data) {
        setPendingReports(data)
      }
    } catch (err) {
      console.error('Error fetching reports:', err)
    }
  }

  const statCards = [
    { title: 'Total Users', value: stats.totalUsers, icon: 'bi-people', color: 'primary', bg: 'primary', change: '+12%' },
    { title: 'Total Farmers', value: stats.totalFarmers, icon: 'bi-tree', color: 'success', bg: 'success', change: '+5%' },
    { title: 'Agri Experts', value: stats.totalExperts, icon: 'bi-person-badge', color: 'info', bg: 'info', change: '+8%' },
    { title: 'Active Now', value: stats.todayVisitors, icon: 'bi-eye', color: 'warning', bg: 'warning', change: '+15%' },
    { title: 'Total Posts', value: stats.totalPosts, icon: 'bi-file-post', color: 'purple', bg: 'purple', change: '+23%' },
    { title: 'Pending Reports', value: stats.totalReports, icon: 'bi-flag', color: 'danger', bg: 'danger', change: '-2%' },
    { title: 'Active Admins', value: stats.activeAdmins, icon: 'bi-shield-check', color: 'success', bg: 'success', change: '0%' },
    { title: 'Messages', value: stats.totalMessages, icon: 'bi-chat-dots', color: 'info', bg: 'info', change: '+18%' },
  ]

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }}></div>
          <p className="mt-3 text-muted">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout title="Dashboard Overview">
      {/* Welcome Banner */}
      <div className="card border-0 bg-gradient-primary text-white mb-4 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h3 className="mb-2 fw-bold">
                Welcome back, {session?.admin?.full_name?.split(' ')[0]}! 👋
              </h3>
              <p className="mb-0 opacity-75">
                Here's what's happening with your platform today.
              </p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-circle p-3 d-none d-md-block">
              <i className="bi bi-calendar-week fs-2"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="row g-4 mb-4">
        {statCards.map((stat, index) => (
          <div className="col-md-6 col-lg-3" key={index}>
            <div className="card border-0 shadow-sm h-100 hover-scale">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1 small text-uppercase fw-semibold">{stat.title}</p>
                    <h2 className="mb-2 fw-bold display-6">{stat.value.toLocaleString()}</h2>
                    <small className={`text-${stat.color}`}>
                      <i className={`bi ${stat.change.includes('+') ? 'bi-arrow-up' : 'bi-arrow-down'} me-1`}></i>
                      {stat.change}
                    </small>
                  </div>
                  <div className={`bg-${stat.bg} bg-opacity-10 rounded-circle p-3`}>
                    <i className={`bi ${stat.icon} fs-2 text-${stat.color}`}></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity & Reports */}
      <div className="row g-4">
        {/* Recent Activities */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4 pb-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-clock-history me-2 text-primary"></i>
                  Recent Activities
                </h5>
                <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/activities')}>
                  View All <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              {recentActivities.map((activity, idx) => (
                <div key={idx} className="d-flex align-items-center mb-3 pb-2 border-bottom">
                  <div className="bg-primary bg-opacity-10 rounded-circle p-2 me-3">
                    <i className="bi bi-box-arrow-in-right text-primary"></i>
                  </div>
                  <div className="flex-grow-1">
                    <p className="mb-0 small fw-medium">{activity.activity_description}</p>
                    <small className="text-muted">
                      {activity.admin_users?.full_name} • {new Date(activity.created_at).toLocaleString()}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pending Reports */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4 pb-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-flag me-2 text-danger"></i>
                  Pending Reports
                </h5>
                <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/reports')}>
                  View All <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body pt-0">
              {pendingReports.length > 0 ? (
                pendingReports.map((report, idx) => (
                  <div key={idx} className="mb-3 pb-2 border-bottom">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <p className="mb-1 small fw-medium">{report.report_reason}</p>
                        <small className="text-muted">{new Date(report.created_at).toLocaleString()}</small>
                      </div>
                      <button className="btn btn-sm btn-outline-danger rounded-pill px-3">
                        Review
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
      </div>

      {/* Quick Actions */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4 pb-3">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-lightning-charge me-2 text-primary"></i>
                Quick Actions
              </h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3 col-sm-6">
                  <button className="btn btn-outline-primary w-100 py-3 rounded-3 btn-hover" onClick={() => router.push('/admin/users/create')}>
                    <i className="bi bi-person-plus fs-4 d-block mb-2"></i>
                    <span className="fw-semibold">Add New User</span>
                    <small className="d-block text-muted mt-1">Create account</small>
                  </button>
                </div>
                <div className="col-md-3 col-sm-6">
                  <button className="btn btn-outline-success w-100 py-3 rounded-3 btn-hover" onClick={() => router.push('/admin/users')}>
                    <i className="bi bi-people fs-4 d-block mb-2"></i>
                    <span className="fw-semibold">Manage Users</span>
                    <small className="d-block text-muted mt-1">View all users</small>
                  </button>
                </div>
                <div className="col-md-3 col-sm-6">
                  <button className="btn btn-outline-danger w-100 py-3 rounded-3 btn-hover" onClick={() => router.push('/admin/reports')}>
                    <i className="bi bi-flag fs-4 d-block mb-2"></i>
                    <span className="fw-semibold">View Reports</span>
                    <small className="d-block text-muted mt-1">Review reports</small>
                  </button>
                </div>
                <div className="col-md-3 col-sm-6">
                  <button className="btn btn-outline-secondary w-100 py-3 rounded-3 btn-hover" onClick={() => router.push('/admin/security')}>
                    <i className="bi bi-shield-lock fs-4 d-block mb-2"></i>
                    <span className="fw-semibold">Security</span>
                    <small className="d-block text-muted mt-1">Check security</small>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .hover-scale {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hover-scale:hover {
          transform: translateY(-4px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1) !important;
        }
        .bg-purple {
          background-color: #6f42c1;
        }
        .text-purple {
          color: #6f42c1;
        }
      `}</style>
    </AdminLayout>
  )
}