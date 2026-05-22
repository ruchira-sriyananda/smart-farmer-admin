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
  const [onlineCount, setOnlineCount] = useState(0)
  const [greeting, setGreeting] = useState('')
  const [userGrowthPeriod, setUserGrowthPeriod] = useState('week') // week, month, year
  const [userGrowthData, setUserGrowthData] = useState({ labels: [], values: [] })
  const [peakHoursData, setPeakHoursData] = useState({ labels: [], values: [] })
  
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalUsers: 0,
      totalFarmers: 0,
      totalVendors: 0,
      verifiedUsers: 0,
      pendingVerification: 0,
      totalPosts: 0,
      totalBarterListings: 0,
      totalMessages: 0,
      totalAds: 0
    },
    recentUsers: [],
    roleDistribution: { FARMER: 0, VENDOR: 0, ADMIN: 0 }
  })

  // Set greeting based on time
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 18) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')
  }, [])

  // Fetch online users count
  const fetchOnlineCount = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { count, error } = await supabase
        .from('online_users')
        .select('*', { count: 'exact', head: true })
        .gte('last_activity', fiveMinutesAgo)

      if (!error) setOnlineCount(count || 0)
    } catch (err) {
      console.error('Error fetching online count:', err)
    }
  }

  // Fetch user growth based on period
  const fetchUserGrowth = async (period) => {
    try {
      let startDate, labels = [], values = []
      const now = new Date()

      if (period === 'week') {
        startDate = new Date(now.setDate(now.getDate() - 7))
        for (let i = 6; i >= 0; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }))
          values.push(0)
        }
      } else if (period === 'month') {
        startDate = new Date(now.setMonth(now.getMonth() - 1))
        const daysInMonth = 30
        for (let i = daysInMonth - 1; i >= 0; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          labels.push(date.getDate().toString())
          values.push(0)
        }
      } else {
        startDate = new Date(now.setFullYear(now.getFullYear() - 1))
        for (let i = 11; i >= 0; i--) {
          const date = new Date()
          date.setMonth(date.getMonth() - i)
          labels.push(date.toLocaleDateString('en-US', { month: 'short' }))
          values.push(0)
        }
      }

      const { data } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', startDate.toISOString())

      data?.forEach(user => {
        const userDate = new Date(user.created_at)
        let index = -1
        
        if (period === 'week') {
          const dayDiff = Math.floor((new Date() - userDate) / (1000 * 60 * 60 * 24))
          if (dayDiff >= 0 && dayDiff < 7) index = 6 - dayDiff
        } else if (period === 'month') {
          const dayDiff = Math.floor((new Date() - userDate) / (1000 * 60 * 60 * 24))
          if (dayDiff >= 0 && dayDiff < 30) index = 29 - dayDiff
        } else {
          const monthDiff = (new Date().getFullYear() - userDate.getFullYear()) * 12 + (new Date().getMonth() - userDate.getMonth())
          if (monthDiff >= 0 && monthDiff < 12) index = 11 - monthDiff
        }
        
        if (index >= 0 && index < values.length) values[index]++
      })

      setUserGrowthData({ labels, values })
    } catch (err) {
      console.error('Error fetching user growth:', err)
    }
  }

  // Fetch peak online hours
  const fetchPeakHours = async () => {
    try {
      const labels = ['12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm']
      const values = new Array(24).fill(0)

      const { data } = await supabase
        .from('online_users')
        .select('last_activity')
        .gte('last_activity', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      data?.forEach(record => {
        const hour = new Date(record.last_activity).getHours()
        values[hour]++
      })

      setPeakHoursData({ labels, values })
    } catch (err) {
      console.error('Error fetching peak hours:', err)
    }
  }

  // Fetch all stats
  const fetchStats = async () => {
    try {
      const { data: roles } = await supabase.from('roles').select('role_id, role_name')
      const roleMap = {}
      roles?.forEach(r => { roleMap[r.role_name] = r.role_id })

      const [
        totalUsers, farmersCount, vendorsCount, verifiedCount, pendingCount, 
        postsCount, barterCount, messagesCount, adsCount
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['FARMER']),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['VENDOR']),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', false),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('advertisements').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE')
      ])

      setDashboardData(prev => ({
        ...prev,
        stats: {
          totalUsers: totalUsers.count || 0,
          totalFarmers: farmersCount.count || 0,
          totalVendors: vendorsCount.count || 0,
          verifiedUsers: verifiedCount.count || 0,
          pendingVerification: pendingCount.count || 0,
          totalPosts: postsCount.count || 0,
          totalBarterListings: barterCount.count || 0,
          totalMessages: messagesCount.count || 0,
          totalAds: adsCount.count || 0
        }
      }))
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  // Fetch recent users
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

      if (!error && data) setDashboardData(prev => ({ ...prev, recentUsers: data }))
    } catch (err) { console.error('Error:', err) }
  }

  // Fetch role distribution
  const fetchRoleDistribution = async () => {
    try {
      const { data } = await supabase.from('users').select('roles!left (role_name)')
      if (data) {
        const distribution = {}
        data.forEach(user => {
          const role = user.roles?.role_name || 'UNKNOWN'
          distribution[role] = (distribution[role] || 0) + 1
        })
        setDashboardData(prev => ({ ...prev, roleDistribution: distribution }))
      }
    } catch (err) { console.error('Error:', err) }
  }

  useEffect(() => {
    const init = async () => {
      const storedSession = localStorage.getItem('adminSession')
      if (!storedSession) { router.push('/admin/login'); return }
      setSession(JSON.parse(storedSession))
      
      await Promise.all([
        fetchStats(),
        fetchRecentUsers(),
        fetchRoleDistribution(),
        fetchOnlineCount(),
        fetchUserGrowth(userGrowthPeriod),
        fetchPeakHours()
      ])
      setLoading(false)
    }
    init()

    const interval = setInterval(() => {
      fetchStats()
      fetchOnlineCount()
      setLastUpdate(new Date())
    }, 30000)

    return () => clearInterval(interval)
  }, [router])

  const refreshData = async () => {
    setRefreshing(true)
    await Promise.all([
      fetchStats(), 
      fetchRecentUsers(), 
      fetchRoleDistribution(), 
      fetchOnlineCount(),
      fetchUserGrowth(userGrowthPeriod),
      fetchPeakHours()
    ])
    setLastUpdate(new Date())
    setRefreshing(false)
  }

  const handlePeriodChange = (period) => {
    setUserGrowthPeriod(period)
    fetchUserGrowth(period)
  }

  const userGrowthChart = {
    labels: userGrowthData.labels,
    datasets: [{
      label: 'New Users',
      data: userGrowthData.values,
      borderColor: '#4f46e5',
      backgroundColor: 'rgba(79, 70, 229, 0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#4f46e5',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6
    }]
  }

  const peakHoursChart = {
    labels: peakHoursData.labels,
    datasets: [{
      label: 'Active Users',
      data: peakHoursData.values,
      backgroundColor: 'rgba(79, 70, 229, 0.7)',
      borderRadius: 8,
      barPercentage: 0.7
    }]
  }

  const roleDistributionChart = {
    labels: Object.keys(dashboardData.roleDistribution).filter(r => r !== 'UNKNOWN'),
    datasets: [{
      data: Object.values(dashboardData.roleDistribution).filter(v => v > 0),
      backgroundColor: ['#4f46e5', '#10b981', '#f59e0b'],
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
    scales: { y: { beginAtZero: true, grid: { color: '#e5e7eb' } }, x: { grid: { display: false } } }
  }

  const getRoleBadge = (roleName) => {
    const badges = {
      'ADMIN': <span className="badge-admin"><i className="bi bi-shield-fill me-1"></i>Admin</span>,
      'FARMER': <span className="badge-farmer"><i className="bi bi-tree-fill me-1"></i>Farmer</span>,
      'VENDOR': <span className="badge-vendor"><i className="bi bi-shop me-1"></i>Vendor</span>
    }
    return badges[roleName] || <span className="badge-secondary">{roleName || 'User'}</span>
  }

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading dashboard...</p>
        </div>
      </AdminLayout>
    )
  }

  const { stats, recentUsers } = dashboardData

  return (
    <AdminLayout title="Analytics Dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <div className="greeting-badge">
            <span className="greeting-icon">👋</span>
            <span className="greeting-text">{greeting},</span>
            <span className="user-name">{session?.admin?.full_name?.split(' ')[0] || 'Admin'}</span>
          </div>
          <div className="date-time">
            <i className="bi bi-calendar3"></i>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            <span className="separator">|</span>
            <i className="bi bi-clock"></i>
            {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div className="header-right">
          <div className="live-badge">
            <span className="live-dot"></span>
            <span>LIVE</span>
          </div>
          <button className="sync-btn" onClick={refreshData} disabled={refreshing}>
            <i className={`bi bi-arrow-repeat ${refreshing ? 'spin' : ''}`}></i>
            {refreshing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Hero Stats Cards */}
      <div className="hero-stats">
        <div className="stat-card-hero stat-primary">
          <div className="stat-icon-large"><i className="bi bi-people-fill"></i></div>
          <div className="stat-content">
            <span className="stat-label">Total Users</span>
            <h2 className="stat-number">{stats.totalUsers.toLocaleString()}</h2>
          </div>
        </div>
        <div className="stat-card-hero stat-success">
          <div className="stat-icon-large"><i className="bi bi-tree-fill"></i></div>
          <div className="stat-content">
            <span className="stat-label">Farmers</span>
            <h2 className="stat-number">{stats.totalFarmers.toLocaleString()}</h2>
          </div>
        </div>
        <div className="stat-card-hero stat-info">
          <div className="stat-icon-large"><i className="bi bi-shop"></i></div>
          <div className="stat-content">
            <span className="stat-label">Vendors</span>
            <h2 className="stat-number">{stats.totalVendors.toLocaleString()}</h2>
          </div>
        </div>
        <div className="stat-card-hero stat-warning">
          <div className="stat-icon-large"><i className="bi bi-wifi"></i></div>
          <div className="stat-content">
            <span className="stat-label">Online Now</span>
            <h2 className="stat-number">{onlineCount}</h2>
          </div>
        </div>
      </div>

      {/* User Growth with Period Selector */}
      <div className="chart-card-full">
        <div className="chart-header">
          <div>
            <h5>📈 User Growth Trend</h5>
            <p>Track user registration over time</p>
          </div>
          <div className="period-selector">
            <button className={`period-btn ${userGrowthPeriod === 'week' ? 'active' : ''}`} onClick={() => handlePeriodChange('week')}>Weekly</button>
            <button className={`period-btn ${userGrowthPeriod === 'month' ? 'active' : ''}`} onClick={() => handlePeriodChange('month')}>Monthly</button>
            <button className={`period-btn ${userGrowthPeriod === 'year' ? 'active' : ''}`} onClick={() => handlePeriodChange('year')}>Yearly</button>
          </div>
        </div>
        <div className="chart-body-large">
          <Line data={userGrowthChart} options={chartOptions} />
        </div>
        <div className="chart-summary">
          <div className="summary-item">
            <span className="summary-label">Total New Users</span>
            <span className="summary-value">{userGrowthData.values.reduce((a, b) => a + b, 0)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Period Average</span>
            <span className="summary-value">{(userGrowthData.values.reduce((a, b) => a + b, 0) / userGrowthData.values.length || 0).toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Peak Hours Chart */}
      <div className="chart-card-full">
        <div className="chart-header">
          <div>
            <h5>⏰ Most Active Hours</h5>
            <p>User activity distribution by hour (last 7 days)</p>
          </div>
        </div>
        <div className="chart-body-large">
          <Bar data={peakHoursChart} options={chartOptions} />
        </div>
      </div>

      {/* User Distribution & Secondary Stats */}
      <div className="two-columns">
        <div className="distribution-card">
          <div className="card-header-custom">
            <h5><i className="bi bi-pie-chart"></i> User Distribution</h5>
            <p>Breakdown by role type from database</p>
          </div>
          <div className="distribution-body">
            <div className="donut-container">
              <Doughnut data={roleDistributionChart} options={chartOptions} />
            </div>
            <div className="legend-stats">
              {Object.entries(dashboardData.roleDistribution).map(([role, count]) => (
                <div key={role} className="legend-item">
                  <span className={`legend-dot ${role.toLowerCase()}`}></span>
                  <span className="legend-name">{role}</span>
                  <span className="legend-count">{count}</span>
                  <span className="legend-percent">{Math.round((count / stats.totalUsers) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="secondary-stats-grid">
          <div className="stat-card-mini">
            <i className="bi bi-check2-circle stat-mini-icon success"></i>
            <div>
              <div className="stat-mini-value">{stats.verifiedUsers.toLocaleString()}</div>
              <div className="stat-mini-label">Verified Users</div>
              <div className="stat-mini-change">{Math.round((stats.verifiedUsers / stats.totalUsers) * 100)}% of total</div>
            </div>
          </div>
          <div className="stat-card-mini">
            <i className="bi bi-hourglass-split stat-mini-icon warning"></i>
            <div>
              <div className="stat-mini-value">{stats.pendingVerification}</div>
              <div className="stat-mini-label">Pending Approval</div>
              <div className="stat-mini-change">Awaiting verification</div>
            </div>
          </div>
          <div className="stat-card-mini">
            <i className="bi bi-file-post stat-mini-icon primary"></i>
            <div>
              <div className="stat-mini-value">{stats.totalPosts.toLocaleString()}</div>
              <div className="stat-mini-label">Total Posts</div>
            </div>
          </div>
          <div className="stat-card-mini">
            <i className="bi bi-chat-dots stat-mini-icon info"></i>
            <div>
              <div className="stat-mini-value">{stats.totalMessages.toLocaleString()}</div>
              <div className="stat-mini-label">Messages</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Users Table */}
      <div className="recent-table">
        <div className="table-header">
          <div>
            <h5><i className="bi bi-people"></i> Recent Users</h5>
            <p>Latest registered members from mobile app</p>
          </div>
          <button className="view-all-btn" onClick={() => router.push('/admin/users')}>
            View All <i className="bi bi-arrow-right"></i>
          </button>
        </div>
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr><th>User</th><th>Contact</th><th>Role</th><th>Location</th><th>Status</th><th>Joined</th></tr>
            </thead>
            <tbody>
              {recentUsers.map((user) => (
                <tr key={user.user_id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar-sm">
                        {user.profile_image ? <img src={user.profile_image} alt={user.full_name} /> : <span>{user.full_name?.charAt(0)}</span>}
                      </div>
                      <div><div className="user-name">{user.full_name}</div>{user.district && <div className="user-location">{user.district}</div>}</div>
                    </div>
                  </td>
                  <td><div className="contact-cell"><div className="contact-email">{user.email}</div>{user.phone_number && <div className="contact-phone">{user.phone_number}</div>}</div></td>
                  <td>{getRoleBadge(user.roles?.role_name)}</td>
                  <td>{user.district || '—'}</td>
                  <td>{user.is_verified ? <span className="status-badge verified"><i className="bi bi-check-circle"></i> Verified</span> : <span className="status-badge pending"><i className="bi bi-clock"></i> Pending</span>}</td>
                  <td className="date-cell">{new Date(user.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx global>{`
        .dashboard-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; flex-wrap: wrap; gap: 16px; }
        .greeting-badge { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .greeting-icon { font-size: 28px; }
        .greeting-text { font-size: 24px; font-weight: 500; color: #6c757d; }
        .user-name { font-size: 24px; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .date-time { color: #6c757d; font-size: 14px; display: flex; align-items: center; gap: 12px; }
        .date-time i { margin-right: 6px; }
        .separator { color: #dee2e6; }
        .header-right { display: flex; align-items: center; gap: 16px; }
        .live-badge { background: rgba(16, 185, 129, 0.1); padding: 6px 14px; border-radius: 30px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #10b981; }
        .live-dot { width: 8px; height: 8px; background-color: #10b981; border-radius: 50%; animation: pulse 2s infinite; }
        .sync-btn { background: #f8f9fa; border: 1px solid #e9ecef; padding: 6px 18px; border-radius: 30px; font-size: 13px; font-weight: 500; color: #495057; transition: all 0.3s ease; cursor: pointer; }
        .sync-btn:hover { background: #e9ecef; transform: translateY(-1px); }
        
        .hero-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 28px; }
        .stat-card-hero { border-radius: 24px; padding: 24px; display: flex; align-items: center; gap: 20px; transition: all 0.3s ease; cursor: pointer; }
        .stat-card-hero:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1); }
        .stat-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .stat-success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; }
        .stat-info { background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%); color: white; }
        .stat-warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; }
        .stat-icon-large { width: 64px; height: 64px; background: rgba(255, 255, 255, 0.2); border-radius: 20px; display: flex; align-items: center; justify-content: center; }
        .stat-icon-large i { font-size: 32px; }
        .stat-content { flex: 1; }
        .stat-label { font-size: 13px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; }
        .stat-number { font-size: 32px; font-weight: 700; margin: 4px 0; }
        
        .chart-card-full { background: white; border-radius: 24px; padding: 24px; margin-bottom: 28px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); transition: all 0.3s ease; }
        .chart-card-full:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
        .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
        .chart-header h5 { font-size: 16px; font-weight: 600; margin-bottom: 4px; color: #1f2937; }
        .chart-header p { font-size: 12px; color: #6c757d; margin: 0; }
        .period-selector { display: flex; gap: 8px; }
        .period-btn { background: #f8f9fa; border: 1px solid #e9ecef; padding: 6px 16px; border-radius: 30px; font-size: 13px; font-weight: 500; color: #495057; cursor: pointer; transition: all 0.3s ease; }
        .period-btn.active { background: #4f46e5; border-color: #4f46e5; color: white; }
        .period-btn:hover:not(.active) { background: #e9ecef; }
        .chart-body-large { height: 320px; }
        .chart-summary { display: flex; justify-content: center; gap: 32px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e9ecef; }
        .summary-item { text-align: center; }
        .summary-label { font-size: 12px; color: #6c757d; display: block; margin-bottom: 4px; }
        .summary-value { font-size: 20px; font-weight: 700; color: #1f2937; }
        
        .two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
        .distribution-card, .secondary-stats-grid { background: white; border-radius: 24px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); }
        .card-header-custom { margin-bottom: 20px; }
        .card-header-custom h5 { font-size: 16px; font-weight: 600; margin-bottom: 4px; color: #1f2937; }
        .card-header-custom h5 i { margin-right: 8px; color: #4f46e5; }
        .card-header-custom p { font-size: 12px; color: #6c757d; margin: 0; }
        .donut-container { height: 220px; margin-bottom: 20px; }
        .legend-stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; }
        .legend-item { display: flex; align-items: center; gap: 8px; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
        .legend-dot.farmer { background: #10b981; }
        .legend-dot.vendor { background: #3b82f6; }
        .legend-dot.admin { background: #ef4444; }
        .legend-name { font-size: 13px; color: #4b5563; }
        .legend-count { font-weight: 600; color: #1f2937; margin: 0 4px; }
        .legend-percent { font-size: 11px; color: #6c757d; }
        
        .secondary-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; align-content: start; }
        .stat-card-mini { background: #f8f9fa; border-radius: 20px; padding: 20px; display: flex; align-items: center; gap: 16px; transition: all 0.3s ease; }
        .stat-card-mini:hover { transform: translateY(-2px); background: white; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); }
        .stat-mini-icon { font-size: 24px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 16px; }
        .stat-mini-icon.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-mini-icon.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .stat-mini-icon.primary { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .stat-mini-icon.info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .stat-mini-value { font-size: 24px; font-weight: 700; color: #1f2937; }
        .stat-mini-label { font-size: 13px; color: #6c757d; }
        .stat-mini-change { font-size: 11px; color: #10b981; margin-top: 4px; }
        
        .recent-table { background: white; border-radius: 24px; padding: 24px; margin-bottom: 28px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); }
        .table-header, .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
        .table-header h5, .section-header h5 { font-size: 16px; font-weight: 600; margin: 0; color: #1f2937; }
        .table-header h5 i, .section-header h5 i { margin-right: 8px; color: #4f46e5; }
        .table-header p, .section-header p { font-size: 12px; color: #6c757d; margin: 4px 0 0 0; }
        .view-all-btn { background: none; border: none; color: #4f46e5; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; transition: all 0.3s ease; cursor: pointer; }
        .view-all-btn:hover { gap: 10px; }
        
        .custom-table { width: 100%; border-collapse: collapse; }
        .custom-table th { text-align: left; padding: 12px 16px; background: #f8f9fa; font-weight: 600; font-size: 13px; color: #495057; }
        .custom-table td { padding: 16px; border-bottom: 1px solid #e9ecef; }
        .user-cell { display: flex; align-items: center; gap: 12px; }
        .user-avatar-sm { width: 40px; height: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; overflow: hidden; }
        .user-avatar-sm img { width: 100%; height: 100%; object-fit: cover; }
        .user-name { font-weight: 600; color: #1f2937; margin-bottom: 4px; }
        .user-location { font-size: 11px; color: #6c757d; }
        .contact-cell { display: flex; flex-direction: column; gap: 4px; }
        .contact-email { font-size: 13px; color: #1f2937; }
        .contact-phone { font-size: 11px; color: #6c757d; }
        .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 30px; font-size: 12px; font-weight: 500; }
        .status-badge.verified { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-badge.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .date-cell { color: #6c757d; font-size: 13px; }
        
        .badge-admin, .badge-farmer, .badge-vendor, .badge-secondary { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 30px; font-size: 12px; font-weight: 500; }
        .badge-admin { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .badge-farmer { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .badge-vendor { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .badge-secondary { background: #f8f9fa; color: #6c757d; }
        
        .loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; }
        .loading-spinner { width: 48px; height: 48px; border: 3px solid #e9ecef; border-top-color: #4f46e5; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
        .loading-text { color: #6c757d; font-size: 14px; }
        
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        
        @media (max-width: 1200px) { .hero-stats { grid-template-columns: repeat(2, 1fr); } .two-columns { grid-template-columns: 1fr; } }
        @media (max-width: 768px) { .hero-stats { grid-template-columns: 1fr; } .dashboard-header { flex-direction: column; } .period-selector { width: 100%; } .period-btn { flex: 1; text-align: center; } }
      `}</style>
    </AdminLayout>
  )
}