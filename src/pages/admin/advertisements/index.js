import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function Advertisements() {
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    clicks: 0
  })

  useEffect(() => {
    fetchAds()
    
    const subscription = supabase
      .channel('ads_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'system_analytics' },
        () => fetchAds()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [])

  const fetchAds = async () => {
    try {
      const { data, error } = await supabase
        .from('system_analytics')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(30)

      if (!error && data) {
        setAds(data)
        calculateStats(data)
      }
    } catch (err) {
      console.error('Error fetching ads:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data) => {
    setStats({
      total: data.reduce((sum, a) => sum + (a.total_ads || 0), 0),
      active: data.reduce((sum, a) => sum + (a.active_ads || 0), 0),
      expired: data.reduce((sum, a) => sum + (a.expired_ads || 0), 0),
      clicks: data.reduce((sum, a) => sum + (a.ad_clicks || 0), 0)
    })
  }

  if (loading) {
    return (
      <AdminLayout title="Advertisements">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Advertisements">
      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <div className="card border-0 bg-primary bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Total Ads</h6>
              <h2 className="fw-bold">{stats.total}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-success bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Active Ads</h6>
              <h2 className="fw-bold text-success">{stats.active}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-secondary bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Expired Ads</h6>
              <h2 className="fw-bold">{stats.expired}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-info bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Total Clicks</h6>
              <h2 className="fw-bold text-info">{stats.clicks}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="bg-light">
                <tr>
                  <th>Date</th>
                  <th>Total Ads</th>
                  <th>Active</th>
                  <th>Expired</th>
                  <th>Clicks</th>
                  <th>CTR</th>
                </tr>
              </thead>
              <tbody>
                {ads.map(ad => (
                  <tr key={ad.analytics_id}>
                    <td>{new Date(ad.generated_at).toLocaleDateString()}</td>
                    <td>{ad.total_ads || 0}</td>
                    <td className="text-success">{ad.active_ads || 0}</td>
                    <td className="text-secondary">{ad.expired_ads || 0}</td>
                    <td>{ad.ad_clicks || 0}</td>
                    <td>
                      {ad.active_ads > 0 && ad.ad_clicks > 0 
                        ? ((ad.ad_clicks / (ad.active_ads * 1000)) * 100).toFixed(2) 
                        : 0}%
                    </td>
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