import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState({
    userGrowth: [],
    postActivity: [],
    userStats: { total: 0, active: 0, new: 0 },
    contentStats: { posts: 0, comments: 0, reports: 0 }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('system_analytics')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(30)

      if (!error && data) {
        setAnalytics(prev => ({ ...prev, userGrowth: data.reverse() }))
      }
    } catch (err) {
      console.error('Error fetching analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Analytics">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Analytics Dashboard">
      <div className="row g-4">
        <div className="col-md-6 col-lg-3">
          <div className="card border-0 bg-primary bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Total Users</h6>
              <h2 className="fw-bold">{analytics.userStats.total}</h2>
              <small className="text-success">+12% this month</small>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-lg-3">
          <div className="card border-0 bg-success bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Active Users</h6>
              <h2 className="fw-bold">{analytics.userStats.active}</h2>
              <small className="text-success">Currently online</small>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-lg-3">
          <div className="card border-0 bg-info bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Total Posts</h6>
              <h2 className="fw-bold">{analytics.contentStats.posts}</h2>
              <small className="text-info">All time</small>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-lg-3">
          <div className="card border-0 bg-warning bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Active Reports</h6>
              <h2 className="fw-bold">{analytics.contentStats.reports}</h2>
              <small className="text-warning">Pending review</small>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mt-4">
        <div className="card-body text-center py-5">
          <i className="bi bi-graph-up fs-1 text-muted"></i>
          <p className="text-muted mt-3">Detailed analytics charts coming soon</p>
        </div>
      </div>
    </AdminLayout>
  )
}