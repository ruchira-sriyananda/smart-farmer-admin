import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function Advertisements() {
  const router = useRouter()
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [selectedAd, setSelectedAd] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [subscriptionPlans, setSubscriptionPlans] = useState([])
  const [selectedPlan, setSelectedPlan] = useState(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    ad_type: 'PREMIUM',
    duration_days: 30,
    target_audience: 'ALL',
    status: 'ACTIVE'
  })

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    clicks: 0,
    impressions: 0,
    ctr: 0,
    revenue: 0,
    activeSubscriptions: 0
  })

  useEffect(() => {
    fetchAds()
    fetchSubscriptionPlans()
    
    const subscription = supabase
      .channel('ads_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'advertisements' },
        () => fetchAds()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [])

  const fetchAds = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Build the query based on filters
      let query = supabase
        .from('advertisements')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        if (filter === 'expired') {
          // For expired, we need to check both status and date
          const now = new Date().toISOString()
          query = query.or(`status.eq.EXPIRED,end_date.lt.${now}`)
        } else {
          query = query.eq('status', filter.toUpperCase())
        }
      }

      if (dateRange !== 'all') {
        const now = new Date()
        let startDate = new Date()
        
        switch(dateRange) {
          case 'today':
            startDate.setHours(0, 0, 0, 0)
            break
          case 'week':
            startDate.setDate(startDate.getDate() - 7)
            break
          case 'month':
            startDate.setMonth(startDate.getMonth() - 1)
            break
        }
        
        query = query.gte('created_at', startDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      // Fetch user information separately
      if (data && data.length > 0) {
        // Get unique user IDs
        const userIds = [...new Set(data.map(ad => ad.user_id).filter(id => id))]
        
        if (userIds.length > 0) {
          // Fetch admin users from the correct table (likely 'users' or 'profiles')
          // Based on your schema, try 'users' first, if not then 'admin_users'
          let adminUsers = []
          let usersError = null
          
          // Try to fetch from 'users' table first
          const { data: usersData, error: usersErrorResponse } = await supabase
            .from('users')
            .select('id, full_name, email')
            .in('id', userIds)
          
          if (!usersErrorResponse && usersData) {
            adminUsers = usersData
          } else {
            // Fallback to 'admin_users' table
            const { data: adminUsersData, error: adminUsersError } = await supabase
              .from('admin_users')
              .select('admin_id, full_name, email')
              .in('admin_id', userIds)
            
            if (!adminUsersError && adminUsersData) {
              adminUsers = adminUsersData
            }
          }
          
          // Create a map for easy lookup
          const userMap = {}
          adminUsers.forEach(user => {
            // Handle different ID field names
            const userId = user.id || user.admin_id
            userMap[userId] = user
          })
          
          // Merge user data into ads
          const adsWithUsers = data.map(ad => ({
            ...ad,
            user_details: userMap[ad.user_id] || { full_name: 'Unknown User' }
          }))
          
          setAds(adsWithUsers)
          calculateStats(adsWithUsers)
        } else {
          setAds(data)
          calculateStats(data)
        }
      } else {
        setAds([])
        calculateStats([])
      }
    } catch (err) {
      console.error('Error fetching ads:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchSubscriptionPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('ad_packages')
        .select('*')
        .order('price', { ascending: true })

      if (!error && data && data.length > 0) {
        setSubscriptionPlans(data)
      } else {
        // Default plans if no data in database
        setSubscriptionPlans([
          { package_id: 'basic', package_name: 'Basic', price: 49, duration_days: 30, features: ['Standard placement', 'Basic targeting', '30 days duration'] },
          { package_id: 'premium', package_name: 'Premium', price: 99, duration_days: 30, features: ['Premium placement', 'Advanced targeting', '30 days duration', 'Priority support'] },
          { package_id: 'featured', package_name: 'Featured', price: 199, duration_days: 30, features: ['Featured placement', 'Advanced targeting', '30 days duration', 'Priority support', 'Analytics dashboard'] }
        ])
      }
    } catch (err) {
      console.error('Error fetching subscription plans:', err)
    }
  }

  const calculateStats = (adsData) => {
    const now = new Date()
    const active = adsData.filter(ad => ad.status === 'ACTIVE' && new Date(ad.end_date) > now).length
    const expired = adsData.filter(ad => ad.status === 'EXPIRED' || (ad.end_date && new Date(ad.end_date) <= now)).length
    const totalClicks = adsData.reduce((sum, ad) => sum + (ad.clicks || 0), 0)
    const totalImpressions = adsData.reduce((sum, ad) => sum + (ad.impressions || 0), 0)
    const totalRevenue = adsData.reduce((sum, ad) => sum + (ad.amount_paid || 0), 0)
    const activeSubscriptions = adsData.filter(ad => ad.subscription_active === true && ad.status === 'ACTIVE').length
    
    setStats({
      total: adsData.length,
      active: active,
      expired: expired,
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0,
      revenue: totalRevenue,
      activeSubscriptions: activeSubscriptions
    })
  }

  const createAd = async () => {
    setActionLoading(true)
    const session = JSON.parse(localStorage.getItem('adminSession'))
    
    try {
      const startDate = new Date()
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + formData.duration_days)

      const { error } = await supabase
        .from('advertisements')
        .insert({
          title: formData.title,
          description: formData.description,
          image_url: formData.image_url,
          ad_type: formData.ad_type,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: formData.status,
          target_audience: formData.target_audience,
          user_id: session?.admin?.admin_id || session?.user?.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      alert('Advertisement created successfully!')
      setShowCreateModal(false)
      resetForm()
      fetchAds()
    } catch (err) {
      console.error('Error creating ad:', err)
      alert('Error creating ad: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const updateAdStatus = async (adId, newStatus) => {
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('advertisements')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('ad_id', adId)

      if (error) throw error

      alert(`Ad ${newStatus.toLowerCase()} successfully!`)
      fetchAds()
    } catch (err) {
      console.error('Error updating ad:', err)
      alert('Error updating ad: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const deleteAd = async (adId) => {
    if (!confirm('Are you sure you want to delete this advertisement?')) return
    
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('ad_id', adId)

      if (error) throw error

      alert('Advertisement deleted successfully!')
      fetchAds()
    } catch (err) {
      console.error('Error deleting ad:', err)
      alert('Error deleting ad: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      ad_type: 'PREMIUM',
      duration_days: 30,
      target_audience: 'ALL',
      status: 'ACTIVE'
    })
  }

  const getStatusBadge = (status, endDate) => {
    const now = new Date()
    const isExpired = endDate && new Date(endDate) <= now
    
    if (isExpired && status !== 'EXPIRED') {
      return <span className="status-badge expired"><i className="bi bi-clock-history"></i> Expired</span>
    }
    
    const badges = {
      'ACTIVE': <span className="status-badge active"><i className="bi bi-check-circle-fill"></i> Active</span>,
      'PENDING': <span className="status-badge pending"><i className="bi bi-clock-fill"></i> Pending</span>,
      'EXPIRED': <span className="status-badge expired"><i className="bi bi-clock-history"></i> Expired</span>,
      'REJECTED': <span className="status-badge rejected"><i className="bi bi-x-circle-fill"></i> Rejected</span>
    }
    return badges[status] || <span className="status-badge default">{status}</span>
  }

  if (loading) {
    return (
      <AdminLayout title="Advertisements">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading advertisements...</p>
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

  if (error && ads.length === 0) {
    return (
      <AdminLayout title="Advertisements">
        <div className="error-container">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <h3>Failed to Load Advertisements</h3>
          <p>{error}</p>
          <button className="retry-btn" onClick={fetchAds}>Retry</button>
        </div>
        <style jsx>{`
          .error-container {
            text-align: center;
            padding: 60px 20px;
            background: white;
            border-radius: 24px;
            max-width: 500px;
            margin: 40px auto;
          }
          .error-container i {
            font-size: 48px;
            color: #dc3545;
            margin-bottom: 16px;
          }
          .error-container h3 {
            margin-bottom: 8px;
            color: #1f2937;
          }
          .error-container p {
            color: #6c757d;
            margin-bottom: 24px;
          }
          .retry-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            padding: 10px 24px;
            border-radius: 12px;
            color: white;
            font-weight: 500;
            cursor: pointer;
          }
        `}</style>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Advertisements Management">
      <div className="ads-container">
        {/* Header */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="bi bi-megaphone-fill"></i>
            </div>
            <div>
              <h1 className="header-title">Advertisements</h1>
              <p className="header-subtitle">Manage campaigns, track performance, and configure subscriptions</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="filter-toggle-btn" onClick={() => setShowFilters(!showFilters)}>
              <i className="bi bi-funnel-fill"></i>
              <span>Filters</span>
            </button>
            <button className="btn-subscription" onClick={() => router.push('/admin/advertisements/subscriptions')}>
              <i className="bi bi-credit-card"></i>
              Subscriptions
            </button>
            <button className="btn-create" onClick={() => setShowCreateModal(true)}>
              <i className="bi bi-plus-circle-fill"></i>
              Create Ad
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="filters-panel">
            <div className="filters-row">
              <div className="filter-group">
                <label className="filter-label">Status</label>
                <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">All Ads</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="expired">Expired</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="filter-group">
                <label className="filter-label">Date Range</label>
                <select className="filter-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
              <button className="reset-filters" onClick={() => {
                setFilter('all')
                setDateRange('all')
              }}>
                <i className="bi bi-arrow-repeat"></i> Reset
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary"><i className="bi bi-megaphone"></i></div>
            <div className="stat-info">
              <span className="stat-label">Total Ads</span>
              <h2 className="stat-value">{stats.total}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon success"><i className="bi bi-check-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Active Ads</span>
              <h2 className="stat-value text-success">{stats.active}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon warning"><i className="bi bi-clock-history"></i></div>
            <div className="stat-info">
              <span className="stat-label">Expired Ads</span>
              <h2 className="stat-value text-warning">{stats.expired}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon info"><i className="bi bi-eye"></i></div>
            <div className="stat-info">
              <span className="stat-label">Total Clicks</span>
              <h2 className="stat-value">{stats.clicks.toLocaleString()}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><i className="bi bi-graph-up"></i></div>
            <div className="stat-info">
              <span className="stat-label">CTR</span>
              <h2 className="stat-value">{stats.ctr}%</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon revenue"><i className="bi bi-currency-dollar"></i></div>
            <div className="stat-info">
              <span className="stat-label">Revenue</span>
              <h2 className="stat-value">${stats.revenue.toLocaleString()}</h2>
            </div>
          </div>
        </div>

        {/* Ads Grid */}
        <div className="ads-grid">
          {ads.length > 0 ? (
            ads.map((ad) => (
              <div key={ad.ad_id} className="ad-card">
                <div className="ad-card-header">
                  <div className="ad-type">
                    <i className={`bi ${ad.ad_type === 'PREMIUM' ? 'bi-star-fill' : ad.ad_type === 'FEATURED' ? 'bi-gem' : 'bi-megaphone'}`}></i>
                    <span>{ad.ad_type || 'STANDARD'}</span>
                  </div>
                  {getStatusBadge(ad.status, ad.end_date)}
                </div>
                
                {ad.image_url && (
                  <div className="ad-image">
                    <img src={ad.image_url} alt={ad.title} />
                  </div>
                )}
                
                <div className="ad-body">
                  <h6 className="ad-title">{ad.title}</h6>
                  <p className="ad-description">{ad.description?.substring(0, 100)}...</p>
                  
                  <div className="ad-stats">
                    <div className="ad-stat">
                      <i className="bi bi-eye"></i>
                      <span>{ad.impressions || 0} views</span>
                    </div>
                    <div className="ad-stat">
                      <i className="bi bi-mouse"></i>
                      <span>{ad.clicks || 0} clicks</span>
                    </div>
                    <div className="ad-stat">
                      <i className="bi bi-graph-up"></i>
                      <span>{ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : 0}% CTR</span>
                    </div>
                  </div>
                  
                  <div className="ad-meta">
                    <div className="meta-item">
                      <i className="bi bi-calendar3"></i>
                      {new Date(ad.created_at).toLocaleDateString()}
                    </div>
                    <div className="meta-item">
                      <i className="bi bi-person"></i>
                      {ad.user_details?.full_name || 'Admin'}
                    </div>
                  </div>
                </div>
                
                <div className="ad-footer">
                  <button className="btn-view" onClick={() => router.push(`/admin/advertisements/${ad.ad_id}`)}>
                    <i className="bi bi-eye"></i> View
                  </button>
                  <button className="btn-edit" onClick={() => {
                    setSelectedAd(ad)
                    setShowEditModal(true)
                  }}>
                    <i className="bi bi-pencil"></i> Edit
                  </button>
                  {ad.status === 'ACTIVE' ? (
                    <button className="btn-pause" onClick={() => updateAdStatus(ad.ad_id, 'EXPIRED')}>
                      <i className="bi bi-pause-circle"></i> Pause
                    </button>
                  ) : ad.status !== 'EXPIRED' && (
                    <button className="btn-activate" onClick={() => updateAdStatus(ad.ad_id, 'ACTIVE')}>
                      <i className="bi bi-play-circle"></i> Activate
                    </button>
                  )}
                  <button className="btn-delete" onClick={() => deleteAd(ad.ad_id)}>
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <i className="bi bi-megaphone-slash"></i>
              <h4>No Advertisements Found</h4>
              <p>Create your first ad campaign to get started.</p>
              <button className="btn-create-empty" onClick={() => setShowCreateModal(true)}>
                <i className="bi bi-plus-circle"></i> Create Ad
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Ad Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header info">
              <div className="modal-icon"><i className="bi bi-plus-circle-fill"></i></div>
              <h3>Create Advertisement</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter ad title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows="4"
                  placeholder="Enter ad description..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Image URL</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://example.com/image.jpg"
                  value={formData.image_url}
                  onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ad Type</label>
                  <select
                    className="form-select"
                    value={formData.ad_type}
                    onChange={(e) => setFormData({...formData, ad_type: e.target.value})}
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="PREMIUM">Premium</option>
                    <option value="FEATURED">Featured</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Duration (Days)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.duration_days}
                    onChange={(e) => setFormData({...formData, duration_days: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Target Audience</label>
                  <select
                    className="form-select"
                    value={formData.target_audience}
                    onChange={(e) => setFormData({...formData, target_audience: e.target.value})}
                  >
                    <option value="ALL">All Users</option>
                    <option value="FARMERS">Farmers Only</option>
                    <option value="VENDORS">Vendors Only</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={createAd} disabled={actionLoading}>
                {actionLoading ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Creating...</>
                ) : (
                  'Create Ad'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .ads-container {
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

        .header-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .filter-toggle-btn, .btn-subscription, .btn-create {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .filter-toggle-btn {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          color: #495057;
        }

        .filter-toggle-btn:hover {
          background: #e9ecef;
        }

        .btn-subscription {
          background: #8b5cf6;
          border: none;
          color: white;
        }

        .btn-subscription:hover {
          background: #7c3aed;
          transform: translateY(-1px);
        }

        .btn-create {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: white;
        }

        .btn-create:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }

        .filters-panel {
          background: white;
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .filters-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .filter-group {
          flex: 1;
          min-width: 180px;
        }

        .filter-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #6c757d;
          margin-bottom: 6px;
        }

        .filter-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e9ecef;
          border-radius: 10px;
        }

        .reset-filters {
          padding: 10px 16px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          color: #6c757d;
          cursor: pointer;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }

        .stat-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.3s ease;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        }

        .stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon.primary { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .stat-icon.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-icon.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .stat-icon.info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .stat-icon.purple { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
        .stat-icon.revenue { background: rgba(16, 185, 129, 0.1); color: #10b981; }

        .stat-icon i { font-size: 24px; }

        .stat-info {
          flex: 1;
        }

        .stat-label {
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 4px;
          display: block;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 700;
          margin: 0;
          color: #1f2937;
        }

        .text-success { color: #10b981; }
        .text-warning { color: #f59e0b; }

        .ads-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
        }

        .ad-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .ad-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .ad-card-header {
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ad-type {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #8b5cf6;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
        }

        .status-badge.active { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-badge.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .status-badge.expired { background: rgba(107, 114, 128, 0.1); color: #6c757d; }
        .status-badge.rejected { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

        .ad-image {
          height: 160px;
          overflow: hidden;
        }

        .ad-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ad-body {
          padding: 16px 20px;
        }

        .ad-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 8px 0;
          color: #1f2937;
        }

        .ad-description {
          font-size: 13px;
          color: #6c757d;
          margin: 0 0 12px 0;
          line-height: 1.4;
        }

        .ad-stats {
          display: flex;
          gap: 16px;
          padding: 12px 0;
          border-top: 1px solid #e9ecef;
          border-bottom: 1px solid #e9ecef;
          margin-bottom: 12px;
        }

        .ad-stat {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #6c757d;
        }

        .ad-meta {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #9ca3af;
        }

        .ad-footer {
          padding: 12px 20px;
          border-top: 1px solid #e9ecef;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn-view, .btn-edit, .btn-pause, .btn-activate, .btn-delete {
          flex: 1;
          padding: 6px 12px;
          border: none;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .btn-view { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .btn-view:hover { background: #4f46e5; color: white; }
        .btn-edit { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .btn-edit:hover { background: #10b981; color: white; }
        .btn-pause { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .btn-pause:hover { background: #f59e0b; color: white; }
        .btn-activate { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .btn-activate:hover { background: #10b981; color: white; }
        .btn-delete { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .btn-delete:hover { background: #ef4444; color: white; }

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 24px;
          grid-column: span 3;
        }

        .empty-state i {
          font-size: 64px;
          color: #cbd5e1;
          margin-bottom: 16px;
          display: block;
        }

        .btn-create-empty {
          margin-top: 16px;
          padding: 10px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 12px;
          color: white;
          cursor: pointer;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          animation: fadeIn 0.2s ease;
        }

        .modal-container {
          background: white;
          border-radius: 24px;
          width: 90%;
          max-width: 550px;
          animation: slideUp 0.3s ease;
          overflow: hidden;
        }

        .modal-container.modal-lg {
          max-width: 700px;
        }

        .modal-header {
          padding: 24px 24px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          border-bottom: 1px solid #e9ecef;
        }

        .modal-header.info .modal-icon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

        .modal-icon {
          width: 48px;
          height: 48px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-icon i { font-size: 24px; }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .modal-close {
          position: absolute;
          right: 20px;
          top: 20px;
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #9ca3af;
        }

        .modal-body {
          padding: 24px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .form-input, .form-select, .form-textarea {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 14px;
        }

        .form-input:focus, .form-select:focus, .form-textarea:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-textarea {
          resize: vertical;
        }

        .modal-footer {
          padding: 16px 24px 24px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          border-top: 1px solid #e9ecef;
        }

        .btn-secondary {
          padding: 10px 20px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
        }

        .btn-primary {
          padding: 10px 24px;
          background: #4f46e5;
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          .ads-grid {
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .ads-grid {
            grid-template-columns: 1fr;
          }
          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .form-row {
            grid-template-columns: 1fr;
          }
          .filters-row {
            flex-direction: column;
          }
          .filter-group {
            width: 100%;
          }
        }
      `}</style>
    </AdminLayout>
  )
}