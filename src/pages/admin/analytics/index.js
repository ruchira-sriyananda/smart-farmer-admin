import { useEffect, useState } from 'react'
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
  Filler,
  RadialLinearScale
} from 'chart.js'
import { Line, Bar, Doughnut, PolarArea } from 'react-chartjs-2'

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
  Filler,
  RadialLinearScale
)

export default function AnalyticsDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('month')
  const [analytics, setAnalytics] = useState({
    userGrowth: { labels: [], values: [] },
    userStats: {
      total: 0,
      active: 0,
      newToday: 0,
      newThisWeek: 0,
      newThisMonth: 0,
      verified: 0,
      pending: 0,
      farmers: 0,
      vendors: 0,
      admins: 0
    },
    contentStats: {
      posts: 0,
      comments: 0,
      barterListings: 0,
      activeBarter: 0,
      messages: 0,
      ads: 0
    },
    postActivity: [],
    userActivity: [],
    topContributors: [],
    popularCategories: [],
    activityHeatmap: [],
    funnelData: {
      registered: 0,
      verified: 0,
      active: 0
    },
    advancedDistribution: {}
  })

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      
      const monthAgo = new Date()
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      
      let startDate = monthAgo
      if (dateRange === 'week') startDate = weekAgo
      if (dateRange === 'today') startDate = today

      const [
        totalUsers,
        activeUsers,
        newToday,
        newThisWeek,
        newThisMonth,
        verifiedUsers,
        pendingUsers,
        posts,
        comments,
        barterListings,
        activeBarter,
        messages,
        ads,
        userGrowthData,
        weeklyActivity,
        topContributorsData,
        popularCategoriesData,
        heatmapData,
        advancedDist
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('user_sessions').select('*', { count: 'exact', head: true }).eq('session_status', 'ACTIVE'),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo.toISOString()),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', false),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('comments').select('*', { count: 'exact', head: true }),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }),
        supabase.from('barter_listings').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('advertisements').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        fetchUserGrowth(startDate),
        fetchWeeklyActivity(startDate),
        fetchTopContributors(),
        fetchPopularCategories(),
        fetchEngagementHeatmap(startDate),
        fetchAdvancedDistribution(startDate)
      ])

      const { data: roles } = await supabase.from('roles').select('role_id, role_name')
      const roleMap = {}
      roles?.forEach(r => { roleMap[r.role_name] = r.role_id })

      let farmersCount = 0
      let vendorsCount = 0
      let adminsCount = 0
      
      if (roleMap['FARMER']) {
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['FARMER'])
        farmersCount = count || 0
      }
      if (roleMap['VENDOR']) {
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role_id', roleMap['VENDOR'])
        vendorsCount = count || 0
      }
      if (roleMap['ADMIN']) {
        const { count } = await supabase.from('admin_users').select('*', { count: 'exact', head: true })
        adminsCount = count || 0
      }

      setAnalytics({
        userStats: {
          total: totalUsers.count || 0,
          active: activeUsers.count || 0,
          newToday: newToday.count || 0,
          newThisWeek: newThisWeek.count || 0,
          newThisMonth: newThisMonth.count || 0,
          verified: verifiedUsers.count || 0,
          pending: pendingUsers.count || 0,
          farmers: farmersCount,
          vendors: vendorsCount,
          admins: adminsCount
        },
        contentStats: {
          posts: posts.count || 0,
          comments: comments.count || 0,
          barterListings: barterListings.count || 0,
          activeBarter: activeBarter.count || 0,
          messages: messages.count || 0,
          ads: ads.count || 0
        },
        userGrowth: userGrowthData,
        postActivity: weeklyActivity,
        topContributors: topContributorsData,
        popularCategories: popularCategoriesData,
        activityHeatmap: heatmapData,
        funnelData: {
          registered: totalUsers.count || 0,
          verified: verifiedUsers.count || 0,
          active: activeUsers.count || 0
        },
        advancedDistribution: advancedDist
      })
    } catch (err) {
      console.error('Error fetching analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserGrowth = async (startDate) => {
    const { data } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    const dailyCounts = {}
    data?.forEach(user => {
      const date = new Date(user.created_at).toLocaleDateString()
      dailyCounts[date] = (dailyCounts[date] || 0) + 1
    })

    return {
      labels: Object.keys(dailyCounts).slice(-14),
      values: Object.values(dailyCounts).slice(-14)
    }
  }

  const fetchWeeklyActivity = async (startDate) => {
    const { data } = await supabase
      .from('posts')
      .select('created_at')
      .gte('created_at', startDate.toISOString())

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const activityByDay = [0, 0, 0, 0, 0, 0, 0]
    
    data?.forEach(post => {
      const dayIndex = new Date(post.created_at).getDay()
      activityByDay[dayIndex]++
    })

    return { labels: days, values: activityByDay }
  }

  const fetchTopContributors = async () => {
    const { data } = await supabase
      .from('posts')
      .select('user_id, users(full_name)')
      .limit(100)

    const userCounts = {}
    data?.forEach(post => {
      if (post.user_id) {
        userCounts[post.user_id] = (userCounts[post.user_id] || 0) + 1
      }
    })

    const sorted = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({
        user_id: id,
        name: data.find(p => p.user_id === id)?.users?.full_name || 'Unknown',
        count
      }))

    return sorted
  }

  const fetchPopularCategories = async () => {
    const { data } = await supabase
      .from('posts')
      .select('category_id, post_categories(category_name)')
      .not('category_id', 'is', null)

    const categoryCounts = {}
    data?.forEach(post => {
      const categoryName = post.post_categories?.category_name || 'Uncategorized'
      categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1
    })

    return Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }

  const fetchEngagementHeatmap = async (startDate) => {
    try {
      const { data } = await supabase
        .from('admin_activity_logs')
        .select('created_at')
        .gte('created_at', startDate.toISOString())

      // 7 days x 24 hours matrix
      const heatmap = Array(7).fill(0).map(() => Array(24).fill(0))

      data?.forEach(log => {
        const date = new Date(log.created_at)
        const day = date.getDay() // 0-6 (Sun-Sat)
        const hour = date.getHours() // 0-23
        heatmap[day][hour]++
      })

      return heatmap
    } catch (err) {
      console.error('Heatmap error:', err)
      return []
    }
  }

  const fetchAdvancedDistribution = async (startDate) => {
    try {
      const { data } = await supabase
        .from('admin_activity_logs')
        .select('activity_type')
        .gte('created_at', startDate.toISOString())

      const counts = {}
      data?.forEach(log => {
        counts[log.activity_type] = (counts[log.activity_type] || 0) + 1
      })
      return counts
    } catch (err) {
      console.error('Distribution error:', err)
      return {}
    }
  }

  const exportAnalyticsCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Users', analytics.userStats.total],
      ['Active Users', analytics.userStats.active],
      ['Total Posts', analytics.contentStats.posts],
      ['Verified Users', analytics.userStats.verified],
      ['Farmers', analytics.userStats.farmers],
      ['Vendors', analytics.userStats.vendors]
    ]

    const csvContent = "data:text/csv;charset=utf-8,"
      + rows.map(e => e.join(",")).join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `analytics_report_${new Date().toLocaleDateString()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const userGrowthChart = {
    labels: analytics.userGrowth.labels || [],
    datasets: [{
      label: 'New Users',
      data: analytics.userGrowth.values || [],
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

  const activityChart = {
    labels: analytics.postActivity.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Posts Created',
      data: analytics.postActivity.values || [0, 0, 0, 0, 0, 0, 0],
      backgroundColor: 'rgba(79, 70, 229, 0.8)',
      borderRadius: 8,
      barPercentage: 0.65
    }]
  }

  const categoryChart = {
    labels: analytics.popularCategories.map(c => c.name),
    datasets: [{
      data: analytics.popularCategories.map(c => c.count),
      backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
      borderWidth: 0,
      borderRadius: 8
    }]
  }

  const contributorChart = {
    labels: analytics.topContributors.map(c => c.name.substring(0, 15)),
    datasets: [{
      data: analytics.topContributors.map(c => c.count),
      backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
      borderWidth: 0,
      borderRadius: 8
    }]
  }

  const distributionChart = {
    labels: Object.keys(analytics.advancedDistribution),
    datasets: [{
      data: Object.values(analytics.advancedDistribution),
      backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#ec4899'],
      borderWidth: 0,
      borderRadius: 8
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, boxWidth: 10, font: { size: 11 } }
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#fff',
        bodyColor: '#9ca3af',
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#e5e7eb' },
        ticks: { stepSize: 1 }
      },
      x: {
        grid: { display: false }
      }
    }
  }

  // Predictive calculation
  const growthValues = Array.isArray(analytics.userGrowth?.values) ? analytics.userGrowth.values : []
  const dailyAvg = growthValues.reduce((a, b) => a + b, 0) / (growthValues.length || 1)
  const predictedNextMonth = Math.round(analytics.userStats.total + (dailyAvg * 30))

  const HeatmapChart = ({ data }) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const hours = Array.from({length: 24}, (_, i) => i)

    const getMax = () => {
      let max = 0
      data?.forEach(row => row.forEach(val => { if(val > max) max = val }))
      return max || 1
    }

    const max = getMax()

    return (
      <div className="heatmap-wrapper">
        <div className="heatmap-header">
          <div className="empty-corner"></div>
          {hours.map(h => <div key={h} className="hour-label">{h}h</div>)}
        </div>
        {days.map((day, dayIdx) => (
          <div key={day} className="heatmap-row">
            <div className="day-label">{day}</div>
            {hours.map(hour => {
              const value = data[dayIdx]?.[hour] || 0
              const opacity = (value / max) * 0.9 + 0.1
              return (
                <div
                  key={hour}
                  className="heatmap-cell"
                  style={{ background: `rgba(79, 70, 229, ${value > 0 ? opacity : 0.05})` }}
                  title={`${day} ${hour}h: ${value} activities`}
                ></div>
              )
            })}
          </div>
        ))}
        <style jsx>{`
          .heatmap-wrapper { display: flex; flex-direction: column; gap: 4px; overflow-x: auto; padding: 10px; }
          .heatmap-header { display: flex; gap: 4px; margin-bottom: 4px; }
          .empty-corner { width: 40px; flex-shrink: 0; }
          .hour-label { width: 100%; min-width: 15px; font-size: 8px; text-align: center; color: #94a3b8; }
          .heatmap-row { display: flex; gap: 4px; align-items: center; }
          .day-label { width: 40px; font-size: 10px; font-weight: 600; color: #64748b; flex-shrink: 0; }
          .heatmap-cell { width: 100%; height: 20px; min-width: 15px; border-radius: 4px; transition: transform 0.2s; cursor: pointer; }
          .heatmap-cell:hover { transform: scale(1.2); z-index: 2; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        `}</style>
      </div>
    )
  }

  const FunnelChart = ({ registered, verified, active }) => {
    const steps = [
      { label: 'Registered', value: registered, color: '#4f46e5' },
      { label: 'Verified', value: verified, color: '#10b981' },
      { label: 'Active', value: active, color: '#f59e0b' }
    ]

    return (
      <div className="funnel-container">
        {steps.map((step, idx) => {
          const prevValue = idx === 0 ? step.value : steps[idx-1].value
          const dropOff = prevValue > 0 ? Math.round((1 - step.value / prevValue) * 100) : 0
          const width = (step.value / registered) * 100

          return (
            <div key={step.label} className="funnel-step-wrapper">
              {idx > 0 && <div className="drop-off-label">-{dropOff}% drop-off</div>}
              <div className="funnel-step" style={{ width: `${width}%`, background: step.color }}>
                <span className="step-label">{step.label}</span>
                <span className="step-value">{step.value.toLocaleString()}</span>
              </div>
            </div>
          )
        })}
        <style jsx>{`
          .funnel-container { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px; }
          .funnel-step-wrapper { width: 100%; display: flex; flex-direction: column; align-items: center; }
          .funnel-step { height: 50px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; border-radius: 12px; color: white; font-weight: 600; min-width: 150px; }
          .drop-off-label { font-size: 11px; color: #ef4444; margin: 4px 0; font-weight: 700; }
          .step-label { font-size: 13px; }
          .step-value { font-size: 16px; }
        `}</style>
      </div>
    )
  }

  if (loading) {
    return (
      <AdminLayout title="Analytics Dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading analytics data...</p>
        </div>
        <style jsx>{`
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
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Analytics Dashboard">
      <div className="analytics-container">
        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="bi bi-graph-up"></i>
            </div>
            <div>
              <h1 className="header-title">Analytics Dashboard</h1>
              <p className="header-subtitle">Platform insights and decision-making metrics</p>
            </div>
          </div>
          <div className="date-range-selector">
            <button className={`range-btn ${dateRange === 'today' ? 'active' : ''}`} onClick={() => setDateRange('today')}>Today</button>
            <button className={`range-btn ${dateRange === 'week' ? 'active' : ''}`} onClick={() => setDateRange('week')}>This Week</button>
            <button className={`range-btn ${dateRange === 'month' ? 'active' : ''}`} onClick={() => setDateRange('month')}>This Month</button>
          </div>
          <button className="export-btn" onClick={exportAnalyticsCSV}>
            <i className="bi bi-download"></i> Export Data
          </button>
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon primary"><i className="bi bi-people-fill"></i></div>
            <div className="metric-info">
              <span className="metric-label">Total Users</span>
              <h2 className="metric-value">{analytics.userStats.total.toLocaleString()}</h2>
              <span className="metric-trend positive"><i className="bi bi-arrow-up"></i> +{analytics.userStats.newThisMonth} this month</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon success"><i className="bi bi-person-check-fill"></i></div>
            <div className="metric-info">
              <span className="metric-label">Active Users</span>
              <h2 className="metric-value">{analytics.userStats.active.toLocaleString()}</h2>
              <span className="metric-trend positive">Currently online</span>
            </div>
          </div>
          <div className="metric-card predictive">
            <div className="metric-icon warning"><i className="bi bi-graph-up-arrow"></i></div>
            <div className="metric-info">
              <span className="metric-label">Predicted Users (30d)</span>
              <h2 className="metric-value">{predictedNextMonth.toLocaleString()}</h2>
              <span className="metric-trend">Expected base</span>
            </div>
          </div>
        </div>

        <div className="charts-section">
          <div className="chart-card full-width">
            <div className="chart-header">
              <h5>📈 User Growth Trend</h5>
              <p>New user registrations over time</p>
            </div>
            <div className="chart-body"><Line data={userGrowthChart} options={chartOptions} /></div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h5>🔥 User Engagement Heatmap</h5>
              <p>Activity density by day and hour</p>
            </div>
            <div className="chart-body">
              <HeatmapChart data={analytics.activityHeatmap} />
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h5>📊 Verification Funnel</h5>
              <p>Conversion from registered to active</p>
            </div>
            <div className="chart-body">
              <FunnelChart
                registered={analytics.funnelData.registered}
                verified={analytics.funnelData.verified}
                active={analytics.funnelData.active}
              />
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h5>⚙️ Advanced Activity Distribution</h5>
              <p>System-wide action breakdown</p>
            </div>
            <div className="chart-body">
              <Doughnut data={distributionChart} options={chartOptions} />
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h5>📊 Weekly Activity</h5>
              <p>Posts created per day</p>
            </div>
            <div className="chart-body"><Bar data={activityChart} options={chartOptions} /></div>
          </div>
        </div>

        <div className="distribution-section">
          <div className="dist-card">
            <div className="dist-header">
              <h5><i className="bi bi-pie-chart"></i> Popular Categories</h5>
              <p>Most discussed topics</p>
            </div>
            <div className="dist-body">
              <div className="dist-chart"><Doughnut data={categoryChart} options={chartOptions} /></div>
              <div className="dist-list">
                {Array.isArray(analytics.popularCategories) && analytics.popularCategories.map((cat, idx) => (
                  <div key={idx} className="dist-item">
                    <span className="dist-color" style={{ background: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx] }}></span>
                    <span className="dist-name">{cat.name}</span>
                    <span className="dist-value">{cat.count} posts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dist-card">
            <div className="dist-header">
              <h5>🏆 Top Contributors</h5>
              <p>Most active community members</p>
            </div>
            <div className="dist-body">
              <div className="contributor-list-vertical">
                {Array.isArray(analytics.topContributors) && analytics.topContributors.map((c, idx) => (
                  <div key={idx} className="contributor-item-vertical">
                    <div className="rank">#{idx+1}</div>
                    <div className="name">{c.name}</div>
                    <div className="count">{c.count} posts</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="distribution-section">
          <div className="dist-card">
            <div className="dist-header">
              <h5><i className="bi bi-pie-chart"></i> Popular Categories</h5>
              <p>Most discussed topics</p>
            </div>
            <div className="dist-body">
              <div className="dist-chart"><Doughnut data={categoryChart} options={chartOptions} /></div>
              <div className="dist-list">
                {Array.isArray(analytics.popularCategories) && analytics.popularCategories.map((cat, idx) => (
                  <div key={idx} className="dist-item">
                    <span className="dist-color" style={{ background: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx] }}></span>
                    <span className="dist-name">{cat.name}</span>
                    <span className="dist-value">{cat.count} posts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="dist-card">
            <div className="dist-header">
              <h5><i className="bi bi-star"></i> Community Leaders</h5>
              <p>Top contributors by posts</p>
            </div>
            <div className="dist-body">
              <div className="polar-container"><PolarArea data={contributorChart} options={chartOptions} /></div>
            </div>
          </div>
        </div>

        <div className="stats-summary">
          <div className="summary-card">
            <h5>User Statistics</h5>
            <div className="summary-grid">
              <div className="summary-item">
                <span>Verified Users</span>
                <strong>{analytics.userStats.verified.toLocaleString()}</strong>
                <small>{Math.round((analytics.userStats.verified / analytics.userStats.total) * 100)}% of total</small>
              </div>
              <div className="summary-item">
                <span>Pending Verification</span>
                <strong>{analytics.userStats.pending.toLocaleString()}</strong>
                <small>Awaiting approval</small>
              </div>
              <div className="summary-item">
                <span>New Today</span>
                <strong>+{analytics.userStats.newToday}</strong>
                <small>New registrations</small>
              </div>
              <div className="summary-item">
                <span>This Week</span>
                <strong>+{analytics.userStats.newThisWeek}</strong>
                <small>New users</small>
              </div>
            </div>
          </div>
          <div className="summary-card">
            <h5>Content Statistics</h5>
            <div className="summary-grid">
              <div className="summary-item">
                <span>Total Comments</span>
                <strong>{analytics.contentStats.comments.toLocaleString()}</strong>
                <small>Community engagement</small>
              </div>
              <div className="summary-item">
                <span>Barter Listings</span>
                <strong>{analytics.contentStats.barterListings}</strong>
                <small>Available trades</small>
              </div>
              <div className="summary-item">
                <span>Active Barter</span>
                <strong className="text-success">{analytics.contentStats.activeBarter}</strong>
                <small>Live trades</small>
              </div>
              <div className="summary-item">
                <span>Active Ads</span>
                <strong className="text-info">{analytics.contentStats.ads}</strong>
                <small>Live campaigns</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .analytics-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .header-icon {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-icon i {
          font-size: 28px;
          color: white;
        }

        .header-title {
          font-size: 24px;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 4px 0;
        }

        .header-subtitle {
          color: #6c757d;
          margin: 0;
          font-size: 14px;
        }

        .date-range-selector {
          display: flex;
          gap: 8px;
          background: white;
          padding: 4px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .range-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          background: transparent;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .range-btn.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .export-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          color: #475569;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .export-btn:hover {
          border-color: #4f46e5;
          color: #4f46e5;
          transform: translateY(-1px);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }

        .metric-card.predictive {
          background: #fdf2f2;
          border: 1px solid #fecaca;
        }

        .metric-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.3s ease;
        }

        .contributor-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          width: 100%;
        }

        .contributor-card {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .rank { font-weight: 800; font-size: 20px; color: #4f46e5; width: 30px; }
        .name { flex: 1; font-weight: 600; color: #1e293b; }
        .count { font-size: 12px; color: #64748b; }

        .metric-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .metric-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .metric-icon.primary { background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); color: #667eea; }
        .metric-icon.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .metric-icon.info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

        .metric-icon i { font-size: 24px; }

        .metric-info { flex: 1; }
        .metric-label { font-size: 13px; color: #6c757d; margin-bottom: 4px; display: block; }
        .metric-value { font-size: 28px; font-weight: 700; margin: 0 0 4px 0; color: #1f2937; }
        .metric-trend { font-size: 11px; }
        .metric-trend.positive { color: #10b981; }

        .secondary-metrics {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 16px;
          margin-bottom: 28px;
        }

        .secondary-card {
          background: white;
          border-radius: 16px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s ease;
        }

        .secondary-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        }

        .secondary-icon {
          width: 40px;
          height: 40px;
          background: #f8f9fa;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4f46e5;
        }

        .secondary-icon i { font-size: 20px; }
        .secondary-info { flex: 1; }
        .secondary-label { font-size: 11px; color: #6c757d; display: block; }
        .secondary-value { font-size: 16px; font-weight: 700; color: #1f2937; }

        .charts-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }

        .chart-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          transition: all 0.3s ease;
        }

        .chart-card.full-width {
          grid-column: span 2;
        }

        .chart-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        }

        .chart-header { margin-bottom: 20px; }
        .chart-header h5 { font-size: 16px; font-weight: 600; margin: 0 0 4px 0; color: #1f2937; }
        .chart-header p { font-size: 12px; color: #6c757d; margin: 0; }
        .chart-body { height: 280px; }

        .contributor-summary {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 10px;
        }

        .contributor-summary-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 12px;
        }

        .contributor-rank { width: 40px; font-weight: 700; color: #4f46e5; font-size: 18px; }
        .contributor-name { flex: 1; font-weight: 500; color: #1f2937; }
        .contributor-count { font-size: 13px; font-weight: 600; color: #10b981; }

        .distribution-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }

        .dist-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
        }

        .dist-header { margin-bottom: 20px; }
        .dist-header h5 { font-size: 16px; font-weight: 600; margin: 0 0 4px 0; color: #1f2937; }
        .dist-header h5 i { margin-right: 8px; color: #4f46e5; }
        .dist-header p { font-size: 12px; color: #6c757d; margin: 0; }

        .dist-body {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }

        .dist-chart { flex: 1; min-width: 200px; height: 200px; }
        .polar-container { flex: 1; height: 280px; }
        .dist-list { flex: 1; display: flex; flex-direction: column; gap: 12px; justify-content: center; }

        .dist-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .dist-color { width: 12px; height: 12px; border-radius: 50%; }
        .dist-name { flex: 1; font-size: 13px; color: #4b5563; }
        .dist-value { font-size: 13px; font-weight: 600; color: #1f2937; }

        .contributor-list-vertical { display: flex; flex-direction: column; gap: 12px; width: 100%; }
        .contributor-item-vertical { display: flex; align-items: center; gap: 12px; padding: 12px; background: #f8f9fa; border-radius: 12px; }

        .distribution-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }

        .dist-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
        }

        .dist-header { margin-bottom: 20px; }
        .dist-header h5 { font-size: 16px; font-weight: 600; margin: 0 0 4px 0; color: #1f2937; }
        .dist-header h5 i { margin-right: 8px; color: #4f46e5; }
        .dist-header p { font-size: 12px; color: #6c757d; margin: 0; }

        .dist-body {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }

        .dist-chart { flex: 1; min-width: 200px; height: 200px; }
        .dist-list { flex: 1; display: flex; flex-direction: column; gap: 12px; justify-content: center; }

        .dist-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .dist-color { width: 12px; height: 12px; border-radius: 50%; }
        .dist-name { flex: 1; font-size: 13px; color: #4b5563; }
        .dist-value { font-size: 13px; font-weight: 600; color: #1f2937; }

        .stats-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .summary-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
        }

        .summary-card h5 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
          color: #1f2937;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
        }

        .summary-item span {
          font-size: 11px;
          color: #6c757d;
          margin-bottom: 2px;
        }

        .summary-item strong {
          font-size: 20px;
          font-weight: 700;
          color: #1f2937;
        }

        .summary-item small {
          font-size: 10px;
          color: #9ca3af;
          margin-top: 2px;
        }

        .text-success { color: #10b981; }
        .text-info { color: #3b82f6; }

        @media (max-width: 1200px) {
          .metrics-grid { grid-template-columns: repeat(2, 1fr); }
          .secondary-metrics { grid-template-columns: repeat(3, 1fr); }
          .charts-section { grid-template-columns: 1fr; }
          .chart-card.full-width { grid-column: span 1; }
          .distribution-section { grid-template-columns: 1fr; }
          .stats-summary { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .metrics-grid { grid-template-columns: 1fr; }
          .secondary-metrics { grid-template-columns: repeat(2, 1fr); }
          .page-header { flex-direction: column; align-items: flex-start; }
          .dist-body { flex-direction: column; }
          .dist-chart { height: 250px; }
          .polar-container { height: 250px; }
          .summary-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </AdminLayout>
  )
}