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
      totalFarmers: { value: 0, change: 0, trend: 'up' },
      totalVendors: { value: 0, change: 0, trend: 'up' },
      verifiedUsers: { value: 0, change: 0, trend: 'up' },
      totalPosts: { value: 0, change: 0, trend: 'up' },
      totalBarterListings: { value: 0, change: 0, trend: 'up' },
      totalBarterRequests: { value: 0, change: 0, trend: 'up' },
      totalMessages: { value: 0, change: 0, trend: 'up' },
      totalAds: { value: 0, change: 0, trend: 'up' },
      pendingModerations: { value: 0, change: 0, trend: 'down' },
      todayActive: { value: 0, change: 0, trend: 'up' }
    },
    recentUsers: [],
    recentPosts: [],
    userGrowthData: [],
    roleDistribution: {}
  })

  useEffect(() => {
    const storedSession = localStorage.getItem('adminSession')
    if (!storedSession) {
      router.push('/admin/login')
      return
    }
    setSession(JSON.parse(storedSession))
    
    initializeRealtimeSubscriptions()
    fetchAllData()
    
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
    // Subscribe to users table changes
    supabase
      .channel('users_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'users' },
        () => {
          fetchStats()
          fetchRecentUsers()
        }
      )
      .subscribe()

    // Subscribe to posts table changes
    supabase
      .channel('posts_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        () => fetchStats()
      )
      .subscribe()

    // Subscribe to barter_listings changes
    supabase
      .channel('barter_listings_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'barter_listings' },
        () => fetchStats()
      )
      .subscribe()
  }

  const fetchAllData = async () => {
    await Promise.all([
      fetchStats(),
      fetchRecentUsers(),
      fetchRecentPosts(),
      fetchUserGrowthData(),
      fetchRoleDistribution()
    ])
    setLoading(false)
  }

  const fetchStats = async () => {
    try {
      // Get current date for comparison
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)

      // Fetch counts from users table
      const [
        totalUsers,
        activeUsers,
        totalFarmers,
        totalVendors,
        verifiedUsers,
        totalPosts,
        totalBarterListings,
        totalBarterRequests,
        totalMessages,
        totalAds,
        todayActive
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', getRoleId('FARMER')),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', getRoleId('VENDOR')),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }),
        supabase.from('barter_requests').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('advertisements').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('user_sessions').select('*', { count: 'exact', head: true }).eq('session_status', 'ACTIVE')
      ])

      // Calculate user growth (last month vs current)
      const previousMonthUsers = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', lastMonth.toISOString())
      
      const userChange = previousMonthUsers.count > 0 
        ? Math.round(((totalUsers.count - previousMonthUsers.count) / previousMonthUsers.count) * 100)
        : 0

      setDashboardData(prev => ({
        ...prev,
        stats: {
          totalUsers: { value: totalUsers.count || 0, change: Math.abs(userChange), trend: userChange >= 0 ? 'up' : 'down' },
          activeUsers: { value: activeUsers.count || 0, change: 0, trend: 'up' },
          totalFarmers: { value: totalFarmers.count || 0, change: 0, trend: 'up' },
          totalVendors: { value: totalVendors.count || 0, change: 0, trend: 'up' },
          verifiedUsers: { value: verifiedUsers.count || 0, change: 0, trend: 'up' },
          totalPosts: { value: totalPosts.count || 0, change: 0, trend: 'up' },
          totalBarterListings: { value: totalBarterListings.count || 0, change: 0, trend: 'up' },
          totalBarterRequests: { value: totalBarterRequests.count || 0, change: 0, trend: 'up' },
          totalMessages: { value: totalMessages.count || 0, change: 0, trend: 'up' },
          totalAds: { value: totalAds.count || 0, change: 0, trend: 'up' },
          pendingModerations: { value: 0, change: 0, trend: 'down' },
          todayActive: { value: todayActive.count || 0, change: 0, trend: 'up' }
        }
      }))
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const getRoleId = async (roleName) => {
    const { data } = await supabase
      .from('roles')
      .select('role_id')
      .eq('role_name', roleName)
      .single()
    return data?.role_id
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
          roles!left (
            role_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10)

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
          visibility_status,
          created_at,
          users!left (
            full_name,
            email,
            profile_image
          ),
          post_categories!left (
            category_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!error && data) {
        setDashboardData(prev => ({ ...prev, recentPosts: data }))
      }
    } catch (err) {
      console.error('Error fetching recent posts:', err)
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
          roles!left (
            role_name
          )
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

  const roleDistributionChart = {
    labels: Object.keys(dashboardData.roleDistribution),
    datasets: [
      {
        data: Object.values(dashboardData.roleDistribution),
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

  const getRoleBadge = (roleName) => {
    const badges = {
      'ADMIN': <span className="badge bg-danger rounded-pill">Admin</span>,
      'FARMER': <span className="badge bg-success rounded-pill">Farmer</span>,
      'VENDOR': <span className="badge bg-info rounded-pill">Vendor</span>
    }
    return badges[roleName] || <span className="badge bg-secondary rounded-pill">{roleName}</span>
  }

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="d-flex justify-content-center align-items-center min-vh-50">
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}></div>
            <p className="text-muted">Loading dashboard data...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const { stats, recentUsers, recentPosts } = dashboardData

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
        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-secondary btn-sm rounded-pill px-3"
            onClick={refreshData}
            disabled={refreshing}
          >
            <i className={`bi bi-arrow-repeat ${refreshing ? 'spin' : ''} me-1`}></i>
            {refreshing ? 'Updating...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats Cards - Row 1 */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-lg-3">
          <div className="stat-card gradient-card-primary">
            <div className="stat-card-body">
              <div className="stat-icon">
                <i className="bi bi-people-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Total App Users</span>
                <h2 className="stat-value">{stats.totalUsers.value.toLocaleString()}</h2>
                <span className={`stat-change ${stats.totalUsers.trend === 'up' ? 'text-success' : 'text-danger'}`}>
                  <i className={`bi bi-arrow-${stats.totalUsers.trend}`}></i> {stats.totalUsers.change}% this month
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="stat-card gradient-card-success">
            <div className="stat-card-body">
              <div className="stat-icon">
                <i className="bi bi-person-check-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Verified Users</span>
                <h2 className="stat-value">{stats.verifiedUsers.value.toLocaleString()}</h2>
                <span className="stat-change text-success">
                  <i className="bi bi-check-circle"></i> Verified accounts
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="stat-card gradient-card-info">
            <div className="stat-card-body">
              <div className="stat-icon">
                <i className="bi bi-tree-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Farmers</span>
                <h2 className="stat-value">{stats.totalFarmers.value.toLocaleString()}</h2>
                <span className="stat-change text-info">
                  <i className="bi bi-person"></i> Registered farmers
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="stat-card gradient-card-warning">
            <div className="stat-card-body">
              <div className="stat-icon">
                <i className="bi bi-shop"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Vendors</span>
                <h2 className="stat-value">{stats.totalVendors.value.toLocaleString()}</h2>
                <span className="stat-change text-warning">
                  <i className="bi bi-store"></i> Agricultural vendors
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Row 2 */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-lg-3">
          <div className="stat-card glass-card">
            <div className="stat-card-body">
              <div className="stat-icon-sm bg-primary">
                <i className="bi bi-file-post-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label-sm">Total Posts</span>
                <h4 className="stat-value-sm">{stats.totalPosts.value.toLocaleString()}</h4>
                <small className="text-success">Community content</small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="stat-card glass-card">
            <div className="stat-card-body">
              <div className="stat-icon-sm bg-success">
                <i className="bi bi-arrow-left-right"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label-sm">Barter Listings</span>
                <h4 className="stat-value-sm">{stats.totalBarterListings.value}</h4>
                <small className="text-success">Active trades</small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="stat-card glass-card">
            <div className="stat-card-body">
              <div className="stat-icon-sm bg-info">
                <i className="bi bi-chat-dots-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label-sm">Messages</span>
                <h4 className="stat-value-sm">{stats.totalMessages.value.toLocaleString()}</h4>
                <small className="text-info">Total conversations</small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="stat-card glass-card">
            <div className="stat-card-body">
              <div className="stat-icon-sm bg-warning">
                <i className="bi bi-megaphone-fill"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label-sm">Active Ads</span>
                <h4 className="stat-value-sm">{stats.totalAds.value}</h4>
                <small className="text-warning">Live campaigns</small>
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
              <h5 className="mb-0 fw-bold">User Growth</h5>
              <small className="text-muted">Last 30 days - {dashboardData.userGrowthData.reduce((a, b) => a + b, 0)} new users</small>
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
              <h5 className="mb-0 fw-bold">User Distribution by Role</h5>
              <small className="text-muted">Breakdown of user types</small>
            </div>
            <div className="card-body">
              <div style={{ height: '300px' }}>
                {Object.keys(dashboardData.roleDistribution).length > 0 ? (
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
      </div>

      {/* Recent Users Table */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-header bg-transparent border-0 pt-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-people me-2 text-primary"></i>
                Recent Users
              </h5>
              <small className="text-muted">Latest registered app users</small>
            </div>
            <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/users')}>
              View All Users <i className="bi bi-arrow-right ms-1"></i>
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="bg-light">
                <tr>
                  <th>User</th>
                  <th>Email/Phone</th>
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
                        <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px' }}>
                          {user.profile_image ? (
                            <img src={user.profile_image} alt="Profile" className="rounded-circle w-100 h-100 object-fit-cover" />
                          ) : (
                            <i className="bi bi-person text-primary"></i>
                          )}
                        </div>
                        <div>
                          <div className="fw-semibold small">{user.full_name}</div>
                          {user.district && <small className="text-muted">{user.district}</small>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div className="small">{user.email}</div>
                        {user.phone_number && <small className="text-muted">{user.phone_number}</small>}
                      </div>
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
                {recentUsers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Posts Section */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-header bg-transparent border-0 pt-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-file-post me-2 text-primary"></i>
                Recent Posts
              </h5>
              <small className="text-muted">Latest community posts</small>
            </div>
            <button className="btn btn-sm btn-link text-decoration-none" onClick={() => router.push('/admin/posts')}>
              View All Posts <i className="bi bi-arrow-right ms-1"></i>
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="bg-light">
                <tr>
                  <th>Post</th>
                  <th>Author</th>
                  <th>Category</th>
                  <th>Visibility</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentPosts.map((post) => (
                  <tr key={post.post_id}>
                    <td>
                      <div>
                        <div className="fw-semibold small">{post.title}</div>
                        <small className="text-muted">{post.content?.substring(0, 60)}...</small>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-1">
                        <i className="bi bi-person-circle"></i>
                        <small>{post.users?.full_name || 'Unknown'}</small>
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-secondary rounded-pill">{post.post_categories?.category_name || 'General'}</span>
                    </td>
                    <td>
                      {post.visibility_status === 'PUBLIC' ? (
                        <span className="badge bg-success rounded-pill">Public</span>
                      ) : (
                        <span className="badge bg-secondary rounded-pill">Private</span>
                      )}
                    </td>
                    <td>
                      <small>{new Date(post.created_at).toLocaleDateString()}</small>
                    </td>
                  </tr>
                ))}
                {recentPosts.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-muted">
                      No posts found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
        .text-gradient {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .object-fit-cover {
          object-fit: cover;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AdminLayout>
  )
}