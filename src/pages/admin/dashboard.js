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
  
  // Real data states
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalFarmers, setTotalFarmers] = useState(0)
  const [totalVendors, setTotalVendors] = useState(0)
  const [onlineCount, setOnlineCount] = useState(0)
  const [verifiedUsers, setVerifiedUsers] = useState(0)
  const [pendingVerification, setPendingVerification] = useState(0)
  const [totalPosts, setTotalPosts] = useState(0)
  const [totalBarterListings, setTotalBarterListings] = useState(0)
  const [totalMessages, setTotalMessages] = useState(0)
  const [totalAds, setTotalAds] = useState(0)
  const [activeBarterTrades, setActiveBarterTrades] = useState(0)
  const [newUsersToday, setNewUsersToday] = useState(0)
  const [newPostsToday, setNewPostsToday] = useState(0)
  
  const [onlineUsers, setOnlineUsers] = useState([])
  const [recentUsers, setRecentUsers] = useState([])
  const [recentPosts, setRecentPosts] = useState([])
  const [userGrowthData, setUserGrowthData] = useState([0, 0, 0, 0])
  const [roleDistribution, setRoleDistribution] = useState({})
  const [weeklyActivity, setWeeklyActivity] = useState([0, 0, 0, 0, 0, 0, 0])

  // Set greeting based on time
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 18) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')
  }, [])

  // Fetch online users
  const fetchOnlineUsers = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data, error, count } = await supabase
        .from('online_users')
        .select('*')
        .gte('last_activity', fiveMinutesAgo)

      if (!error) {
        setOnlineUsers(data || [])
        setOnlineCount(count || 0)
      }
    } catch (err) {
      console.error('Error fetching online users:', err)
    }
  }

  // Fetch all stats from database - NO FAKE DATA
  const fetchAllStats = async () => {
    try {
      // Get role IDs
      const { data: roles } = await supabase.from('roles').select('role_id, role_name')
      const roleMap = {}
      roles?.forEach(r => { roleMap[r.role_name] = r.role_id })

      // Get today's date range
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Execute all queries in parallel
      const [
        totalUsersRes,
        farmersRes,
        vendorsRes,
        verifiedRes,
        pendingRes,
        postsRes,
        barterRes,
        messagesRes,
        adsRes,
        newUsersRes,
        newPostsRes,
        activeBarterRes,
        userGrowthRes,
        weeklyActivityRes,
        roleDistRes,
        recentUsersRes,
        recentPostsRes
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['FARMER']),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['VENDOR']),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', false),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('advertisements').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('users').select('created_at').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('posts').select('created_at').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('users').select('roles!left(role_name)'),
        supabase.from('users').select('user_id, full_name, email, profile_image, district, is_verified, created_at, roles!left(role_name)').order('created_at', { ascending: false }).limit(6),
        supabase.from('posts').select('post_id, title, content, image_url, created_at, users!left(full_name, profile_image)').order('created_at', { ascending: false }).limit(4)
      ])

      // Set main stats
      setTotalUsers(totalUsersRes.count || 0)
      setTotalFarmers(farmersRes.count || 0)
      setTotalVendors(vendorsRes.count || 0)
      setVerifiedUsers(verifiedRes.count || 0)
      setPendingVerification(pendingRes.count || 0)
      setTotalPosts(postsRes.count || 0)
      setTotalBarterListings(barterRes.count || 0)
      setTotalMessages(messagesRes.count || 0)
      setTotalAds(adsRes.count || 0)
      setNewUsersToday(newUsersRes.count || 0)
      setNewPostsToday(newPostsRes.count || 0)
      setActiveBarterTrades(activeBarterRes.count || 0)

      // Set recent data
      if (recentUsersRes.data) setRecentUsers(recentUsersRes.data)
      if (recentPostsRes.data) setRecentPosts(recentPostsRes.data)

      // Calculate user growth (last 30 days by week)
      if (userGrowthRes.data) {
        const weeks = [0, 0, 0, 0]
        userGrowthRes.data.forEach(user => {
          const daysAgo = Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
          const weekIndex = Math.floor(daysAgo / 7)
          if (weekIndex >= 0 && weekIndex < 4) weeks[3 - weekIndex]++
        })
        setUserGrowthData(weeks)
      }

      // Calculate weekly activity
      if (weeklyActivityRes.data) {
        const days = [0, 0, 0, 0, 0, 0, 0]
        weeklyActivityRes.data.forEach(post => {
          const dayIndex = new Date(post.created_at).getDay()
          const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1
          if (adjustedIndex >= 0 && adjustedIndex < 7) days[adjustedIndex]++
        })
        setWeeklyActivity(days)
      }

      // Calculate role distribution
      if (roleDistRes.data) {
        const distribution = {}
        roleDistRes.data.forEach(user => {
          const role = user.roles?.role_name || 'PENDING'
          distribution[role] = (distribution[role] || 0) + 1
        })
        setRoleDistribution(distribution)
      }

    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  // Refresh all data
  const refreshData = async () => {
    setRefreshing(true)
    await Promise.all([fetchAllStats(), fetchOnlineUsers()])
    setLastUpdate(new Date())
    setRefreshing(false)
  }

  // Initial load and real-time subscriptions
  useEffect(() => {
    const init = async () => {
      const storedSession = localStorage.getItem('adminSession')
      if (!storedSession) { 
        router.push('/admin/login')
        return 
      }
      setSession(JSON.parse(storedSession))
      
      await Promise.all([fetchAllStats(), fetchOnlineUsers()])
      setLoading(false)
      
      // Subscribe to real-time changes
      const usersChannel = supabase
        .channel('users_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
          fetchAllStats()
        })
        .subscribe()

      const postsChannel = supabase
        .channel('posts_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
          fetchAllStats()
        })
        .subscribe()

      const onlineChannel = supabase
        .channel('online_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'online_users' }, () => fetchOnlineUsers())
        .subscribe()

      // Auto-refresh every 30 seconds
      const interval = setInterval(() => refreshData(), 30000)
      
      return () => {
        usersChannel.unsubscribe()
        postsChannel.unsubscribe()
        onlineChannel.unsubscribe()
        clearInterval(interval)
      }
    }
    
    init()
  }, [router])

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
      label: 'Posts Created',
      data: weeklyActivity,
      backgroundColor: 'rgba(79, 70, 229, 0.8)',
      borderRadius: 10,
      barPercentage: 0.65
    }]
  }

  const roleDistributionChart = {
    labels: Object.keys(roleDistribution).filter(r => r !== 'PENDING'),
    datasets: [{
      data: Object.values(roleDistribution).filter(v => v > 0),
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
          <p className="loading-text">Loading real-time data from database...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Analytics Dashboard">
      <style jsx global>{`
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .greeting-section h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .greeting-section p {
          color: #6c757d;
          margin: 4px 0 0 0;
          font-size: 14px;
        }
        
        .header-stats {
          display: flex;
          gap: 20px;
          align-items: center;
        }
        
        .live-badge {
          background: rgba(16, 185, 129, 0.1);
          padding: 6px 14px;
          border-radius: 30px;
          display: flex;
          align-items: center;
          gap: 8px;
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
        
        .sync-btn {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          padding: 6px 18px;
          border-radius: 30px;
          font-size: 13px;
          transition: all 0.3s ease;
        }
        
        .sync-btn:hover { background: #e9ecef; transform: translateY(-1px); }
        
        /* Hero Stats */
        .hero-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }
        
        .stat-card-hero {
          border-radius: 24px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .stat-card-hero:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15); }
        
        .stat-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .stat-success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; }
        .stat-info { background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%); color: white; }
        .stat-warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; }
        
        .stat-icon-large {
          width: 64px;
          height: 64px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .stat-icon-large i { font-size: 32px; }
        
        .stat-content { flex: 1; }
        .stat-label { font-size: 13px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; }
        .stat-number { font-size: 32px; font-weight: 700; margin: 4px 0; }
        .stat-trend { font-size: 12px; opacity: 0.9; display: flex; align-items: center; gap: 4px; }
        
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
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: all 0.3s ease;
        }
        
        .stat-card-mini:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08); }
        
        .stat-mini-icon {
          font-size: 28px;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
        }
        
        .stat-mini-icon.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-mini-icon.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .stat-mini-icon.primary { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .stat-mini-icon.info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        
        .stat-mini-value { font-size: 24px; font-weight: 700; color: #1f2937; }
        .stat-mini-label { font-size: 13px; color: #6c757d; }
        .stat-mini-change { font-size: 11px; color: #10b981; margin-top: 4px; }
        
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
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        
        .chart-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
        
        .chart-header { margin-bottom: 20px; }
        .chart-header h5 { font-size: 16px; font-weight: 600; margin: 0; color: #1f2937; }
        .chart-header p { font-size: 12px; color: #6c757d; margin: 4px 0 0 0; }
        .chart-body { height: 280px; }
        
        /* Two Columns */
        .two-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }
        
        .card-modern {
          background: white;
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        
        .card-header-custom { margin-bottom: 20px; }
        .card-header-custom h5 { font-size: 16px; font-weight: 600; margin: 0; }
        .card-header-custom h5 i { margin-right: 8px; color: #4f46e5; }
        .card-header-custom p { font-size: 12px; color: #6c757d; margin: 4px 0 0 0; }
        
        .donut-container { height: 200px; margin-bottom: 20px; }
        
        .legend-stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; }
        .legend-item { display: flex; align-items: center; gap: 8px; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
        .legend-name { font-size: 13px; color: #4b5563; }
        .legend-count { font-weight: 600; color: #1f2937; }
        
        /* Online Users */
        .online-list { max-height: 280px; overflow-y: auto; }
        .online-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 16px;
          transition: all 0.3s ease;
        }
        .online-item:hover { background: #f8f9fa; }
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
        .online-info { flex: 1; }
        .online-name { font-weight: 600; color: #1f2937; }
        .online-role { font-size: 11px; color: #6c757d; }
        
        /* Recent Table */
        .recent-table {
          background: white;
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 28px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .table-header h5 { font-size: 16px; font-weight: 600; margin: 0; }
        .table-header h5 i { margin-right: 8px; color: #4f46e5; }
        
        .view-all-btn {
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
        
        .view-all-btn:hover { gap: 10px; }
        
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
        }
        
        .custom-table td {
          padding: 16px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .user-cell { display: flex; align-items: center; gap: 12px; }
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
        .user-name { font-weight: 600; color: #1f2937; margin-bottom: 4px; }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 500;
        }
        .status-verified { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        
        .badge-admin, .badge-farmer, .badge-vendor, .badge-pending {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 500;
        }
        .badge-admin { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .badge-farmer { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .badge-vendor { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .badge-pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        
        /* Loading */
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
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .spin { animation: spin 1s linear infinite; }
        
        @media (max-width: 1200px) {
          .hero-stats, .secondary-stats { grid-template-columns: repeat(2, 1fr); }
          .charts-row, .two-columns { grid-template-columns: 1fr; }
        }
        
        @media (max-width: 768px) {
          .hero-stats, .secondary-stats { grid-template-columns: 1fr; }
          .dashboard-header { flex-direction: column; }
        }
      `}</style>

      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <div className="greeting-section">
            <h1>{greeting}, {session?.admin?.full_name?.split(' ')[0] || 'Admin'}! 👋</h1>
            <p>Real-time platform analytics from database</p>
          </div>
          <div className="header-stats">
            <div className="live-badge">
              <span className="live-dot"></span>
              <span>LIVE DATA</span>
            </div>
            <button className="sync-btn" onClick={refreshData} disabled={refreshing}>
              <i className={`bi bi-arrow-repeat ${refreshing ? 'spin' : ''}`}></i>
              {refreshing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>

        {/* Hero Stats Cards - ALL DATA FROM DATABASE */}
        <div className="hero-stats">
          <div className="stat-card-hero stat-primary">
            <div className="stat-icon-large">
              <i className="bi bi-people-fill"></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Users</span>
              <h2 className="stat-number">{totalUsers.toLocaleString()}</h2>
              <span className="stat-trend"><i className="bi bi-person-plus"></i> {newUsersToday} new today</span>
            </div>
          </div>
          <div className="stat-card-hero stat-success">
            <div className="stat-icon-large">
              <i className="bi bi-tree-fill"></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Farmers</span>
              <h2 className="stat-number">{totalFarmers.toLocaleString()}</h2>
              <span className="stat-trend"><i className="bi bi-check-circle"></i> {Math.round((verifiedUsers / totalUsers) * 100)}% verified</span>
            </div>
          </div>
          <div className="stat-card-hero stat-info">
            <div className="stat-icon-large">
              <i className="bi bi-shop"></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Vendors</span>
              <h2 className="stat-number">{totalVendors.toLocaleString()}</h2>
              <span className="stat-trend"><i className="bi bi-megaphone"></i> {totalAds} active ads</span>
            </div>
          </div>
          <div className="stat-card-hero stat-warning">
            <div className="stat-icon-large">
              <i className="bi bi-wifi"></i>
            </div>
            <div className="stat-content">
              <span className="stat-label">Online Now</span>
              <h2 className="stat-number">{onlineCount}</h2>
              <span className="stat-trend"><i className="bi bi-person-check"></i> Active users</span>
            </div>
          </div>
        </div>

        {/* Secondary Stats Grid */}
        <div className="secondary-stats">
          <div className="stat-card-mini">
            <i className="bi bi-check2-circle stat-mini-icon success"></i>
            <div>
              <div className="stat-mini-value">{verifiedUsers.toLocaleString()}</div>
              <div className="stat-mini-label">Verified Users</div>
              <div className="stat-mini-change">{Math.round((verifiedUsers / totalUsers) * 100)}% of total</div>
            </div>
          </div>
          <div className="stat-card-mini">
            <i className="bi bi-hourglass-split stat-mini-icon warning"></i>
            <div>
              <div className="stat-mini-value">{pendingVerification}</div>
              <div className="stat-mini-label">Pending Approval</div>
              <div className="stat-mini-change">Awaiting verification</div>
            </div>
          </div>
          <div className="stat-card-mini">
            <i className="bi bi-file-post stat-mini-icon primary"></i>
            <div>
              <div className="stat-mini-value">{totalPosts.toLocaleString()}</div>
              <div className="stat-mini-label">Total Posts</div>
              <div className="stat-mini-change text-success">{newPostsToday} new today</div>
            </div>
          </div>
          <div className="stat-card-mini">
            <i className="bi bi-arrow-left-right stat-mini-icon info"></i>
            <div>
              <div className="stat-mini-value">{activeBarterTrades}</div>
              <div className="stat-mini-label">Active Barter Trades</div>
              <div className="stat-mini-change">{totalBarterListings} total listings</div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="charts-row">
          <div className="chart-card">
            <div className="chart-header">
              <h5><i className="bi bi-graph-up"></i> User Growth Trend</h5>
              <p>New user registrations over the last 30 days</p>
            </div>
            <div className="chart-body">
              <Line data={userGrowthChart} options={chartOptions} />
            </div>
          </div>
          <div className="chart-card">
            <div className="chart-header">
              <h5><i className="bi bi-bar-chart-steps"></i> Platform Activity</h5>
              <p>Daily posts and community engagement</p>
            </div>
            <div className="chart-body">
              <Bar data={weeklyActivityChart} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* User Distribution & Online Users */}
        <div className="two-columns">
          <div className="card-modern">
            <div className="card-header-custom">
              <h5><i className="bi bi-pie-chart"></i> User Distribution</h5>
              <p>Breakdown by user role type</p>
            </div>
            <div className="donut-container">
              {Object.keys(roleDistribution).length > 0 ? (
                <Doughnut data={roleDistributionChart} options={chartOptions} />
              ) : (
                <div className="text-center py-5">No data available</div>
              )}
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
          <div className="card-modern">
            <div className="card-header-custom">
              <h5><i className="bi bi-wifi"></i> Live Activity</h5>
              <p>{onlineCount} users currently online</p>
            </div>
            <div className="online-list">
              {onlineUsers.length > 0 ? (
                onlineUsers.map((user, idx) => (
                  <div key={idx} className="online-item">
                    <div className="online-avatar">
                      <span>{user.user_name?.charAt(0) || 'U'}</span>
                      <span className="online-status-dot"></span>
                    </div>
                    <div className="online-info">
                      <div className="online-name">{user.user_name || 'User'}</div>
                      <div className="online-role">{user.user_role || 'Member'}</div>
                    </div>
                    <i className="bi bi-check-circle-fill" style={{ color: '#10b981' }}></i>
                  </div>
                ))
              ) : (
                <div className="text-center py-5">
                  <i className="bi bi-person-slash fs-1 text-muted"></i>
                  <p className="text-muted mt-2">No users currently online</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Users Table */}
        <div className="recent-table">
          <div className="table-header">
            <h5><i className="bi bi-people"></i> Recent Registrations</h5>
            <button className="view-all-btn" onClick={() => router.push('/admin/users')}>
              View All <i className="bi bi-arrow-right"></i>
            </button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => (
                  <tr key={user.user_id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar-sm">{user.full_name?.charAt(0)}</div>
                        <div>
                          <div className="user-name">{user.full_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted">{user.email}</td>
                    <td>{getRoleBadge(user.roles?.role_name)}</td>
                    <td>{user.district || '—'}</td>
                    <td>
                      {user.is_verified ? (
                        <span className="status-badge status-verified"><i className="bi bi-check-circle"></i> Verified</span>
                      ) : (
                        <span className="status-badge status-pending"><i className="bi bi-clock"></i> Pending</span>
                      )}
                    </td>
                    <td className="text-muted">{new Date(user.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}