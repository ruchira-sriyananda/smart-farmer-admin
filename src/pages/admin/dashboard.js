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
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFarmers: 0,
    totalVendors: 0,
    totalAdmins: 0,
    verifiedUsers: 0,
    pendingVerification: 0,
    totalPosts: 0,
    totalBarterListings: 0,
    totalMessages: 0,
    totalAds: 0,
    newUsersToday: 0,
    newPostsToday: 0,
    activeBarterTrades: 0
  })
  
  const [onlineUsers, setOnlineUsers] = useState([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [recentUsers, setRecentUsers] = useState([])
  const [recentPosts, setRecentPosts] = useState([])
  const [userGrowthData, setUserGrowthData] = useState([])
  const [roleDistribution, setRoleDistribution] = useState({})
  const [weeklyActivity, setWeeklyActivity] = useState([])
  const [topContributors, setTopContributors] = useState([])
  const [pendingActions, setPendingActions] = useState({ reports: 0, verifications: 0, moderation: 0 })

  // Set greeting
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 18) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')
  }, [])

  // Fetch all real data
  const fetchAllData = async () => {
    await Promise.all([
      fetchStats(),
      fetchOnlineUsers(),
      fetchRecentUsers(),
      fetchRecentPosts(),
      fetchUserGrowth(),
      fetchRoleDistribution(),
      fetchWeeklyActivity(),
      fetchTopContributors(),
      fetchPendingActions()
    ])
    setLoading(false)
  }

  // Fetch all statistics from database
  const fetchStats = async () => {
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

      // Parallel queries for all stats
      const [
        totalUsers,
        farmersCount,
        vendorsCount,
        adminsCount,
        verifiedCount,
        pendingCount,
        postsCount,
        barterCount,
        messagesCount,
        adsCount,
        newUsersToday,
        newPostsToday,
        activeBarter
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['FARMER']),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['VENDOR']),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['ADMIN']),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', false),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('advertisements').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE')
      ])

      setStats({
        totalUsers: totalUsers.count || 0,
        totalFarmers: farmersCount.count || 0,
        totalVendors: vendorsCount.count || 0,
        totalAdmins: adminsCount.count || 0,
        verifiedUsers: verifiedCount.count || 0,
        pendingVerification: pendingCount.count || 0,
        totalPosts: postsCount.count || 0,
        totalBarterListings: barterCount.count || 0,
        totalMessages: messagesCount.count || 0,
        totalAds: adsCount.count || 0,
        newUsersToday: newUsersToday.count || 0,
        newPostsToday: newPostsToday.count || 0,
        activeBarterTrades: activeBarter.count || 0
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  // Fetch online users (real-time)
  const fetchOnlineUsers = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data, error, count } = await supabase
        .from('online_users')
        .select('user_id, user_name, user_role, user_email, last_activity')
        .gte('last_activity', fiveMinutesAgo)
        .order('last_activity', { ascending: false })

      if (!error) {
        setOnlineUsers(data || [])
        setOnlineCount(count || 0)
      }
    } catch (err) {
      console.error('Error fetching online users:', err)
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
          profile_image,
          district,
          is_verified,
          created_at,
          roles!left (role_name)
        `)
        .order('created_at', { ascending: false })
        .limit(6)

      if (!error && data) setRecentUsers(data)
    } catch (err) { console.error('Error:', err) }
  }

  // Fetch recent posts
  const fetchRecentPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          post_id,
          title,
          content,
          image_url,
          created_at,
          users!left (full_name, profile_image)
        `)
        .order('created_at', { ascending: false })
        .limit(4)

      if (!error && data) setRecentPosts(data)
    } catch (err) { console.error('Error:', err) }
  }

  // Fetch user growth (last 30 days - REAL data)
  const fetchUserGrowth = async () => {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true })

      const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4']
      const weeklyCounts = [0, 0, 0, 0]
      
      data?.forEach(user => {
        const daysSince = Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
        const weekIndex = Math.floor(daysSince / 7)
        if (weekIndex >= 0 && weekIndex < 4) weeklyCounts[3 - weekIndex]++
      })

      setUserGrowthData(weeklyCounts)
    } catch (err) { console.error('Error:', err) }
  }

  // Fetch role distribution
  const fetchRoleDistribution = async () => {
    try {
      const { data } = await supabase.from('users').select('roles!left (role_name)')
      if (data) {
        const distribution = {}
        data.forEach(user => {
          const role = user.roles?.role_name || 'PENDING'
          distribution[role] = (distribution[role] || 0) + 1
        })
        setRoleDistribution(distribution)
      }
    } catch (err) { console.error('Error:', err) }
  }

  // Fetch weekly activity
  const fetchWeeklyActivity = async () => {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data } = await supabase
        .from('posts')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const activityByDay = [0, 0, 0, 0, 0, 0, 0]
      
      data?.forEach(post => {
        const dayIndex = new Date(post.created_at).getDay()
        const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1
        if (adjustedIndex >= 0 && adjustedIndex < 7) activityByDay[adjustedIndex]++
      })

      setWeeklyActivity(activityByDay)
    } catch (err) { console.error('Error:', err) }
  }

  // Fetch top contributors
  const fetchTopContributors = async () => {
    try {
      const { data } = await supabase
        .from('posts')
        .select('user_id, users!inner(full_name)')
        .then(async (posts) => {
          const userCounts = {}
          posts.data?.forEach(post => {
            userCounts[post.user_id] = (userCounts[post.user_id] || 0) + 1
          })
          const sorted = Object.entries(userCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, count]) => ({ user_id: id, post_count: count }))
          
          // Get user names
          const { data: users } = await supabase
            .from('users')
            .select('user_id, full_name')
            .in('user_id', sorted.map(s => s.user_id))
          
          return sorted.map(s => ({
            ...s,
            full_name: users?.find(u => u.user_id === s.user_id)?.full_name || 'Unknown'
          }))
        })

      setTopContributors(data || [])
    } catch (err) { console.error('Error:', err) }
  }

  // Fetch pending actions
  const fetchPendingActions = async () => {
    try {
      const [reports, verifications, moderation] = await Promise.all([
        supabase.from('system_reports').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', false).eq('role_id', (await supabase.from('roles').select('role_id').eq('role_name', 'FARMER').single()).data?.role_id),
        supabase.from('content_moderation').select('*', { count: 'exact', head: true }).eq('status', 'PENDING')
      ])

      setPendingActions({
        reports: reports.count || 0,
        verifications: verifications.count || 0,
        moderation: moderation.count || 0
      })
    } catch (err) { console.error('Error:', err) }
  }

  // Refresh all data
  const refreshData = async () => {
    setRefreshing(true)
    await fetchAllData()
    setLastUpdate(new Date())
    setRefreshing(false)
  }

  // Real-time subscriptions
  useEffect(() => {
    const init = async () => {
      const storedSession = localStorage.getItem('adminSession')
      if (!storedSession) { router.push('/admin/login'); return }
      setSession(JSON.parse(storedSession))
      
      await fetchAllData()
      
      // Subscribe to real-time changes
      const usersChannel = supabase
        .channel('users_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
          fetchStats(), fetchUserGrowth(), fetchRoleDistribution(), fetchRecentUsers()
        })
        .subscribe()

      const postsChannel = supabase
        .channel('posts_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
          fetchStats(), fetchWeeklyActivity(), fetchRecentPosts(), fetchTopContributors()
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
    labels: Object.keys(roleDistribution),
    datasets: [{
      data: Object.values(roleDistribution),
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
          <p className="loading-text">Loading real-time data...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Decision Analytics Dashboard">
      <style jsx global>{`
        /* Dashboard Container */
        .dashboard-container { padding: 0; }
        
        /* Header */
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
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
        }
        
        .header-stat {
          text-align: center;
          padding: 8px 20px;
          background: #f8f9fa;
          border-radius: 16px;
        }
        
        .header-stat-label {
          font-size: 12px;
          color: #6c757d;
        }
        
        .header-stat-value {
          font-size: 20px;
          font-weight: 700;
          color: #1f2937;
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
        
        /* KPI Cards */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }
        
        .kpi-card {
          background: white;
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .kpi-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1); }
        
        .kpi-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .kpi-icon { width: 48px; height: 48px; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
        .kpi-icon i { font-size: 24px; }
        
        .kpi-value { font-size: 32px; font-weight: 700; color: #1f2937; margin-bottom: 8px; }
        .kpi-label { font-size: 14px; color: #6c757d; margin-bottom: 8px; }
        .kpi-trend { font-size: 12px; display: flex; align-items: center; gap: 4px; }
        
        /* Action Cards */
        .action-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }
        
        .action-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: all 0.3s ease;
        }
        
        .action-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08); }
        
        .action-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .action-icon { width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
        .action-icon i { font-size: 22px; }
        
        .action-title { font-weight: 600; color: #1f2937; }
        .action-count { font-size: 28px; font-weight: 700; margin: 8px 0; }
        .action-btn { width: 100%; padding: 8px; border-radius: 12px; border: none; font-size: 13px; font-weight: 500; transition: all 0.3s ease; }
        
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
        
        /* Top Contributors */
        .contributor-list { display: flex; flex-direction: column; gap: 12px; }
        .contributor-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 14px;
        }
        .contributor-rank {
          width: 30px;
          font-weight: 700;
          color: #4f46e5;
        }
        .contributor-info { flex: 1; }
        .contributor-name { font-weight: 600; color: #1f2937; }
        .contributor-stats { font-size: 11px; color: #6c757d; }
        
        /* Recent Users Table */
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
          .kpi-grid, .action-grid, .charts-row, .two-columns { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <div className="greeting-section">
            <h1>{greeting}, {session?.admin?.full_name?.split(' ')[0] || 'Admin'}!</h1>
            <p>Here's your decision intelligence dashboard with real-time platform data</p>
          </div>
          <div className="header-stats">
            <div className="header-stat">
              <div className="header-stat-label">Last Updated</div>
              <div className="header-stat-value">{lastUpdate.toLocaleTimeString()}</div>
            </div>
            <div className="live-badge">
              <span className="live-dot"></span>
              <span>LIVE DATA</span>
            </div>
            <button className="sync-btn" onClick={refreshData} disabled={refreshing}>
              <i className={`bi bi-arrow-repeat ${refreshing ? 'spin' : ''}`}></i>
              {refreshing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>

        {/* KPI Cards - Decision Making Metrics */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-header">
              <div className="kpi-icon" style={{ background: 'rgba(79, 70, 229, 0.1)' }}>
                <i className="bi bi-people-fill" style={{ color: '#4f46e5' }}></i>
              </div>
              <span className="kpi-trend text-success"><i className="bi bi-graph-up"></i> +{Math.round((stats.newUsersToday / Math.max(stats.totalUsers, 1)) * 100)}%</span>
            </div>
            <div className="kpi-value">{stats.totalUsers.toLocaleString()}</div>
            <div className="kpi-label">Total Users</div>
            <div className="kpi-trend text-muted">{stats.newUsersToday} new today</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-header">
              <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                <i className="bi bi-tree-fill" style={{ color: '#10b981' }}></i>
              </div>
              <span className="kpi-trend text-success"><i className="bi bi-arrow-up"></i> +12%</span>
            </div>
            <div className="kpi-value">{stats.totalFarmers.toLocaleString()}</div>
            <div className="kpi-label">Active Farmers</div>
            <div className="kpi-trend text-muted">{stats.verifiedUsers} verified</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-header">
              <div className="kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                <i className="bi bi-shop" style={{ color: '#3b82f6' }}></i>
              </div>
              <span className="kpi-trend text-success"><i className="bi bi-arrow-up"></i> +8%</span>
            </div>
            <div className="kpi-value">{stats.totalVendors.toLocaleString()}</div>
            <div className="kpi-label">Active Vendors</div>
            <div className="kpi-trend text-muted">{stats.totalAds} active ads</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-header">
              <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                <i className="bi bi-arrow-left-right" style={{ color: '#f59e0b' }}></i>
              </div>
              <span className="kpi-trend text-success"><i className="bi bi-graph-up"></i> +15%</span>
            </div>
            <div className="kpi-value">{stats.activeBarterTrades}</div>
            <div className="kpi-label">Active Barter Trades</div>
            <div className="kpi-trend text-muted">{stats.totalBarterListings} total listings</div>
          </div>
        </div>

        {/* Action Cards - Decisions Needed */}
        <div className="action-grid">
          <div className="action-card">
            <div className="action-header">
              <div className="action-icon" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                <i className="bi bi-flag" style={{ color: '#ef4444' }}></i>
              </div>
              <div>
                <div className="action-title">Pending Reports</div>
                <div className="action-count">{pendingActions.reports}</div>
              </div>
            </div>
            <button className="action-btn" style={{ background: '#ef4444', color: 'white' }} onClick={() => router.push('/admin/reports')}>
              Review Reports <i className="bi bi-arrow-right"></i>
            </button>
          </div>
          <div className="action-card">
            <div className="action-header">
              <div className="action-icon" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                <i className="bi bi-person-check" style={{ color: '#f59e0b' }}></i>
              </div>
              <div>
                <div className="action-title">Verifications Pending</div>
                <div className="action-count">{pendingActions.verifications}</div>
              </div>
            </div>
            <button className="action-btn" style={{ background: '#f59e0b', color: 'white' }} onClick={() => router.push('/admin/users?filter=pending')}>
              Verify Users <i className="bi bi-arrow-right"></i>
            </button>
          </div>
          <div className="action-card">
            <div className="action-header">
              <div className="action-icon" style={{ background: 'rgba(79, 70, 229, 0.1)' }}>
                <i className="bi bi-file-post" style={{ color: '#4f46e5' }}></i>
              </div>
              <div>
                <div className="action-title">Content to Moderate</div>
                <div className="action-count">{pendingActions.moderation}</div>
              </div>
            </div>
            <button className="action-btn" style={{ background: '#4f46e5', color: 'white' }} onClick={() => router.push('/admin/posts/moderation')}>
              Moderate Content <i className="bi bi-arrow-right"></i>
            </button>
          </div>
        </div>

        {/* Charts Section */}
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
              <Doughnut data={roleDistributionChart} options={chartOptions} />
            </div>
            <div className="legend-stats">
              {Object.entries(roleDistribution).map(([role, count]) => (
                <div key={role} className="legend-item">
                  <span className={`legend-dot ${role.toLowerCase()}`} style={{ background: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 4)] }}></span>
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
                    <i className="bi bi-check-circle-fill online-check" style={{ color: '#10b981' }}></i>
                  </div>
                ))
              ) : (
                <div className="empty-online text-center py-5">
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
                          <div className="text-muted small">{user.email}</div>
                        </div>
                      </div>
                    </td>
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