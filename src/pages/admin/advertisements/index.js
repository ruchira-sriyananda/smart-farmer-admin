import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import AdminLayout from '@/components/AdminLayout'

// Initialize supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function Advertisements() {
  const router = useRouter()
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [showPackageListModal, setShowPackageListModal] = useState(false)
  const [selectedAd, setSelectedAd] = useState(null)
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [packages, setPackages] = useState([])
  const [editingPackage, setEditingPackage] = useState(null)
  const [subscriptions, setSubscriptions] = useState([])
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    package_id: '',
    target_audience: 'ALL',
    status: 'PENDING'
  })

  const [packageFormData, setPackageFormData] = useState({
    package_name: '',
    description: '',
    price: '',
    duration_days: 30,
    ad_type: 'STANDARD',
    features: [],
    is_active: true,
    display_order: 0
  })

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    pending: 0,
    rejected: 0,
    clicks: 0,
    impressions: 0,
    ctr: 0,
    revenue: 0,
    totalSubscriptions: 0
  })

  useEffect(() => {
    fetchAllData()
    
    const subscription = supabase
      .channel('advertisements_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'mobile_advertisements' },
        () => fetchAllData()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'subscription_packages' },
        () => fetchPackages()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [filter, dateRange])

  const fetchAllData = async () => {
    await Promise.all([
      fetchAds(),
      fetchPackages(),
      fetchSubscriptions()
    ])
  }

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_packages')
        .select('*')
        .order('display_order', { ascending: true })

      if (error) throw error
      setPackages(data || [])
    } catch (err) {
      console.error('Error fetching packages:', err)
      setPackages([])
    }
  }

  const fetchSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setSubscriptions(data || [])
    } catch (err) {
      console.error('Error fetching subscriptions:', err)
      setSubscriptions([])
    }
  }

  const fetchAds = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch advertisements
      let query = supabase
        .from('mobile_advertisements')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter.toUpperCase())
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

      const { data: adsData, error: adsError } = await query

      if (adsError) throw adsError

      if (adsData && adsData.length > 0) {
        // Get unique package IDs
        const packageIds = [...new Set(adsData.map(ad => ad.package_id).filter(id => id))]
        
        // Fetch package details
        let packagesData = []
        if (packageIds.length > 0) {
          const { data: pkgs, error: pkgError } = await supabase
            .from('subscription_packages')
            .select('*')
            .in('package_id', packageIds)
          
          if (!pkgError && pkgs) {
            packagesData = pkgs
          }
        }
        
        // Create package map
        const packageMap = {}
        packagesData.forEach(pkg => {
          packageMap[pkg.package_id] = pkg
        })
        
        // Merge data
        const adsWithPackages = adsData.map(ad => ({
          ...ad,
          subscription_packages: packageMap[ad.package_id] || null
        }))
        
        setAds(adsWithPackages)
        calculateStats(adsWithPackages)
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

  const calculateStats = (adsData) => {
    const now = new Date()
    const active = adsData.filter(ad => ad.status === 'ACTIVE' && ad.end_date && new Date(ad.end_date) > now).length
    const expired = adsData.filter(ad => ad.status === 'EXPIRED' || (ad.end_date && new Date(ad.end_date) <= now)).length
    const pending = adsData.filter(ad => ad.status === 'PENDING').length
    const rejected = adsData.filter(ad => ad.status === 'REJECTED').length
    const totalClicks = adsData.reduce((sum, ad) => sum + (ad.clicks || 0), 0)
    const totalImpressions = adsData.reduce((sum, ad) => sum + (ad.impressions || 0), 0)
    const totalRevenue = adsData.reduce((sum, ad) => sum + (ad.amount_paid || 0), 0)
    
    setStats({
      total: adsData.length,
      active: active,
      expired: expired,
      pending: pending,
      rejected: rejected,
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0,
      revenue: totalRevenue,
      totalSubscriptions: packages.length
    })
  }

  const createPackage = async () => {
    if (!packageFormData.package_name || !packageFormData.price) {
      alert('Please fill in all required fields')
      return
    }

    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('subscription_packages')
        .insert({
          package_name: packageFormData.package_name,
          description: packageFormData.description,
          price: parseFloat(packageFormData.price),
          duration_days: parseInt(packageFormData.duration_days),
          ad_type: packageFormData.ad_type,
          features: packageFormData.features,
          is_active: packageFormData.is_active,
          display_order: parseInt(packageFormData.display_order)
        })

      if (error) throw error

      alert('Package created successfully!')
      setShowPackageModal(false)
      resetPackageForm()
      fetchPackages()
    } catch (err) {
      console.error('Error creating package:', err)
      alert('Error creating package: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const updatePackage = async () => {
    if (!packageFormData.package_name || !packageFormData.price) {
      alert('Please fill in all required fields')
      return
    }

    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('subscription_packages')
        .update({
          package_name: packageFormData.package_name,
          description: packageFormData.description,
          price: parseFloat(packageFormData.price),
          duration_days: parseInt(packageFormData.duration_days),
          ad_type: packageFormData.ad_type,
          features: packageFormData.features,
          is_active: packageFormData.is_active,
          display_order: parseInt(packageFormData.display_order)
        })
        .eq('package_id', editingPackage.package_id)

      if (error) throw error

      alert('Package updated successfully!')
      setShowPackageModal(false)
      resetPackageForm()
      setEditingPackage(null)
      fetchPackages()
    } catch (err) {
      console.error('Error updating package:', err)
      alert('Error updating package: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const deletePackage = async (packageId) => {
    if (!confirm('Are you sure you want to delete this package? This may affect existing subscriptions.')) return
    
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('subscription_packages')
        .delete()
        .eq('package_id', packageId)

      if (error) throw error

      alert('Package deleted successfully!')
      fetchPackages()
    } catch (err) {
      console.error('Error deleting package:', err)
      alert('Error deleting package: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const approveAd = async (adId) => {
    setActionLoading(true)
    
    try {
      const ad = ads.find(a => a.ad_id === adId)
      const pkg = packages.find(p => p.package_id === ad.package_id)
      
      const startDate = new Date()
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + (pkg?.duration_days || 30))

      const { error } = await supabase
        .from('mobile_advertisements')
        .update({ 
          status: 'ACTIVE',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        })
        .eq('ad_id', adId)

      if (error) throw error

      alert('Ad approved successfully!')
      fetchAds()
    } catch (err) {
      console.error('Error approving ad:', err)
      alert('Error approving ad: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const rejectAd = async (adId) => {
    const reason = prompt('Please provide a reason for rejection:')
    if (!reason) return
    
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('mobile_advertisements')
        .update({ 
          status: 'REJECTED',
          rejection_reason: reason
        })
        .eq('ad_id', adId)

      if (error) throw error

      alert('Ad rejected successfully!')
      fetchAds()
    } catch (err) {
      console.error('Error rejecting ad:', err)
      alert('Error rejecting ad: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const pauseAd = async (adId) => {
    if (!confirm('Are you sure you want to pause this ad?')) return
    
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('mobile_advertisements')
        .update({ 
          status: 'EXPIRED'
        })
        .eq('ad_id', adId)

      if (error) throw error

      alert('Ad paused successfully!')
      fetchAds()
    } catch (err) {
      console.error('Error pausing ad:', err)
      alert('Error pausing ad: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const deleteAd = async (adId) => {
    if (!confirm('Are you sure you want to delete this ad permanently?')) return
    
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('mobile_advertisements')
        .delete()
        .eq('ad_id', adId)

      if (error) throw error

      alert('Ad deleted successfully!')
      fetchAds()
    } catch (err) {
      console.error('Error deleting ad:', err)
      alert('Error deleting ad: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const resetPackageForm = () => {
    setPackageFormData({
      package_name: '',
      description: '',
      price: '',
      duration_days: 30,
      ad_type: 'STANDARD',
      features: [],
      is_active: true,
      display_order: 0
    })
  }

  const editPackage = (pkg) => {
    setEditingPackage(pkg)
    setPackageFormData({
      package_name: pkg.package_name,
      description: pkg.description || '',
      price: pkg.price,
      duration_days: pkg.duration_days,
      ad_type: pkg.ad_type,
      features: pkg.features || [],
      is_active: pkg.is_active,
      display_order: pkg.display_order
    })
    setShowPackageModal(true)
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

  // Rest of your component remains the same...
  // (The JSX return statement and styles remain unchanged)
  
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
              <p className="header-subtitle">Manage campaigns, track performance, and configure subscription packages</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="filter-toggle-btn" onClick={() => setShowFilters(!showFilters)}>
              <i className="bi bi-funnel-fill"></i>
              <span>Filters</span>
            </button>
            <button className="btn-packages" onClick={() => setShowPackageListModal(true)}>
              <i className="bi bi-tags"></i>
              Packages ({packages.length})
            </button>
            <button className="btn-subscription" onClick={() => router.push('/admin/advertisements/subscriptions')}>
              <i className="bi bi-credit-card"></i>
              Subscriptions
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
            <div className="stat-icon pending"><i className="bi bi-hourglass-split"></i></div>
            <div className="stat-info">
              <span className="stat-label">Pending Approval</span>
              <h2 className="stat-value text-pending">{stats.pending}</h2>
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
                    <i className={`bi ${ad.subscription_packages?.ad_type === 'PREMIUM' ? 'bi-star-fill' : 
                                      ad.subscription_packages?.ad_type === 'FEATURED' ? 'bi-gem' : 'bi-megaphone'}`}></i>
                    <span>{ad.subscription_packages?.package_name || ad.ad_type || 'STANDARD'}</span>
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
                  
                  <div className="package-info">
                    <i className="bi bi-box"></i>
                    <span>Package: {ad.subscription_packages?.package_name || 'Not Assigned'}</span>
                    <span className="package-price">${ad.subscription_packages?.price || ad.amount_paid || 0}</span>
                  </div>
                  
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
                    {ad.start_date && (
                      <div className="meta-item">
                        <i className="bi bi-play-circle"></i>
                        {new Date(ad.start_date).toLocaleDateString()}
                      </div>
                    )}
                    {ad.end_date && (
                      <div className="meta-item">
                        <i className="bi bi-stop-circle"></i>
                        {new Date(ad.end_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="ad-footer">
                  <button className="btn-view" onClick={() => router.push(`/admin/advertisements/${ad.ad_id}`)}>
                    <i className="bi bi-eye"></i> View
                  </button>
                  {ad.status === 'PENDING' && (
                    <>
                      <button className="btn-approve" onClick={() => approveAd(ad.ad_id)} disabled={actionLoading}>
                        <i className="bi bi-check-lg"></i> Approve
                      </button>
                      <button className="btn-reject" onClick={() => rejectAd(ad.ad_id)} disabled={actionLoading}>
                        <i className="bi bi-x-lg"></i> Reject
                      </button>
                    </>
                  )}
                  {ad.status === 'ACTIVE' && (
                    <button className="btn-pause" onClick={() => pauseAd(ad.ad_id)} disabled={actionLoading}>
                      <i className="bi bi-pause-circle"></i> Pause
                    </button>
                  )}
                  <button className="btn-delete" onClick={() => deleteAd(ad.ad_id)} disabled={actionLoading}>
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <i className="bi bi-megaphone-slash"></i>
              <h4>No Advertisements Found</h4>
              <p>Mobile users will create ads here after purchasing packages.</p>
            </div>
          )}
        </div>
      </div>

      {/* Packages List Modal - Same as before */}
      {showPackageListModal && (
        <div className="modal-overlay" onClick={() => setShowPackageListModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header packages">
              <div className="modal-icon"><i className="bi bi-tags-fill"></i></div>
              <h3>Subscription Packages</h3>
              <button className="modal-close" onClick={() => setShowPackageListModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="packages-header">
                <button className="btn-add-package" onClick={() => {
                  setShowPackageListModal(false)
                  setEditingPackage(null)
                  resetPackageForm()
                  setShowPackageModal(true)
                }}>
                  <i className="bi bi-plus-lg"></i> Add New Package
                </button>
              </div>
              <div className="packages-grid">
                {packages.map((pkg) => (
                  <div key={pkg.package_id} className="package-card">
                    <div className="package-header">
                      <div className="package-name">
                        <i className="bi bi-box-seam"></i>
                        <h4>{pkg.package_name}</h4>
                      </div>
                      <span className={`package-status ${pkg.is_active ? 'active' : 'inactive'}`}>
                        {pkg.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="package-price">
                      <span className="currency">$</span>
                      <span className="amount">{pkg.price}</span>
                      <span className="period">/{pkg.duration_days} days</span>
                    </div>
                    <p className="package-description">{pkg.description}</p>
                    <div className="package-features">
                      {pkg.features?.map((feature, idx) => (
                        <div key={idx} className="feature-item">
                          <i className="bi bi-check-circle-fill"></i>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <div className="package-actions">
                      <button className="btn-edit-package" onClick={() => {
                        setShowPackageListModal(false)
                        editPackage(pkg)
                      }}>
                        <i className="bi bi-pencil"></i> Edit
                      </button>
                      <button className="btn-delete-package" onClick={() => deletePackage(pkg.package_id)}>
                        <i className="bi bi-trash"></i> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPackageListModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Package Create/Edit Modal */}
      {showPackageModal && (
        <div className="modal-overlay" onClick={() => {
          setShowPackageModal(false)
          setEditingPackage(null)
          resetPackageForm()
        }}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header packages">
              <div className="modal-icon"><i className="bi bi-box-seam"></i></div>
              <h3>{editingPackage ? 'Edit Package' : 'Create Package'}</h3>
              <button className="modal-close" onClick={() => {
                setShowPackageModal(false)
                setEditingPackage(null)
                resetPackageForm()
              }}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Package Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Basic, Premium, Featured"
                  value={packageFormData.package_name}
                  onChange={(e) => setPackageFormData({...packageFormData, package_name: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  placeholder="Describe what this package includes..."
                  value={packageFormData.description}
                  onChange={(e) => setPackageFormData({...packageFormData, description: e.target.value})}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Price ($) *</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="29.99"
                    step="0.01"
                    value={packageFormData.price}
                    onChange={(e) => setPackageFormData({...packageFormData, price: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Duration (Days) *</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="30"
                    value={packageFormData.duration_days}
                    onChange={(e) => setPackageFormData({...packageFormData, duration_days: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ad Type</label>
                  <select
                    className="form-select"
                    value={packageFormData.ad_type}
                    onChange={(e) => setPackageFormData({...packageFormData, ad_type: e.target.value})}
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="PREMIUM">Premium</option>
                    <option value="FEATURED">Featured</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Display Order</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0"
                    value={packageFormData.display_order}
                    onChange={(e) => setPackageFormData({...packageFormData, display_order: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Features (comma separated)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Standard placement, Basic targeting, Email support"
                  value={packageFormData.features.join(', ')}
                  onChange={(e) => setPackageFormData({
                    ...packageFormData, 
                    features: e.target.value.split(',').map(f => f.trim()).filter(f => f)
                  })}
                />
                <small className="form-hint">Separate each feature with a comma</small>
              </div>
              
              <div className="form-group">
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={packageFormData.is_active}
                    onChange={(e) => setPackageFormData({...packageFormData, is_active: e.target.checked})}
                  />
                  <span>Active (visible to users)</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => {
                setShowPackageModal(false)
                setEditingPackage(null)
                resetPackageForm()
              }}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={editingPackage ? updatePackage : createPackage} 
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                ) : (
                  editingPackage ? 'Update Package' : 'Create Package'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles - Same as before */}
      <style jsx>{`
        /* Add all your CSS styles here (same as previous version) */
        .ads-container {
          max-width: 1400px;
          margin: 0 auto;
        }
        /* ... rest of your styles ... */
      `}</style>
    </AdminLayout>
  )
}