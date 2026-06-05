import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import AdminLayout from '@/components/AdminLayout'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function Advertisements() {
  const router = useRouter()
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [showPackageListModal, setShowPackageListModal] = useState(false)
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedAd, setSelectedAd] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [packages, setPackages] = useState([])
  const [editingPackage, setEditingPackage] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [selectedAds, setSelectedAds] = useState([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [emailSettings, setEmailSettings] = useState({
    enable_notifications: true,
    smtp_host: '',
    smtp_user: '',
    smtp_port: '587'
  })
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    package_id: '',
    target_audience: 'ALL'
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
    fetchEmailSettings()
    
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
    await Promise.all([fetchAds(), fetchPackages()])
  }

  const fetchEmailSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['enable_notifications', 'smtp_host', 'smtp_user', 'smtp_port'])

      if (!error && data) {
        const settings = {}
        data.forEach(setting => {
          settings[setting.setting_key] = setting.setting_value
        })
        setEmailSettings(prev => ({
          ...prev,
          enable_notifications: settings.enable_notifications === 'true',
          smtp_host: settings.smtp_host || '',
          smtp_user: settings.smtp_user || '',
          smtp_port: settings.smtp_port || '587'
        }))
      }
    } catch (err) {
      console.error('Error fetching email settings:', err)
    }
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

  const fetchAds = async () => {
    try {
      setLoading(true)
      setError(null)
      
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
        const packageIds = [...new Set(adsData.map(ad => ad.package_id).filter(id => id))]
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
        
        const packageMap = {}
        packagesData.forEach(pkg => {
          packageMap[pkg.package_id] = pkg
        })
        
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

  // Send email notification function
  const sendEmailNotification = async (type, recipientEmail, data) => {
    if (!emailSettings.enable_notifications) {
      console.log('Email notifications are disabled')
      return false
    }

    if (!recipientEmail) {
      console.log('No recipient email provided')
      return false
    }

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          to: recipientEmail,
          data: {
            ...data,
            siteName: 'Smart Farmer'
          }
        })
      })

      const result = await response.json()
      if (result.success) {
        console.log(`${type} notification sent to ${recipientEmail}`)
        return true
      } else {
        console.error('Failed to send email:', result.error)
        return false
      }
    } catch (error) {
      console.error('Error sending email:', error)
      return false
    }
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

  const createCampaign = async () => {
    if (!formData.title || !formData.package_id) {
      alert('Please fill in all required fields')
      return
    }

    setActionLoading(true)
    
    try {
      const selectedPackage = packages.find(p => p.package_id === formData.package_id)
      
      const startDate = new Date()
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + (selectedPackage?.duration_days || 30))

      const adData = {
        title: formData.title,
        description: formData.description || '',
        image_url: formData.image_url || null,
        package_id: formData.package_id,
        target_audience: formData.target_audience,
        status: 'PENDING',
        amount_paid: selectedPackage?.price || 0,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        created_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('mobile_advertisements')
        .insert(adData)

      if (error) throw error

      alert('Campaign created successfully! Pending approval.')
      setShowCreateModal(false)
      resetForm()
      fetchAds()
    } catch (err) {
      console.error('Error creating campaign:', err)
      alert('Error creating campaign: ' + err.message)
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
      
      // Send email notification
      await sendEmailNotification('ad_approved', ad.user_email || 'user@example.com', {
        userName: ad.user_name || 'User',
        title: ad.title,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      })
      
      alert('Campaign approved successfully! Notification sent to user.')
      await fetchAds()
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
      const ad = ads.find(a => a.ad_id === adId)
      
      const { error } = await supabase
        .from('mobile_advertisements')
        .update({ 
          status: 'REJECTED',
          rejection_reason: reason
        })
        .eq('ad_id', adId)

      if (error) throw error
      
      // Send email notification
      await sendEmailNotification('ad_rejected', ad.user_email || 'user@example.com', {
        userName: ad.user_name || 'User',
        title: ad.title,
        reason: reason
      })
      
      alert('Campaign rejected! Notification sent to user.')
      await fetchAds()
    } catch (err) {
      console.error('Error rejecting ad:', err)
      alert('Error rejecting ad: ' + err.message)
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
      alert('Campaign deleted successfully!')
      await fetchAds()
    } catch (err) {
      console.error('Error deleting ad:', err)
      alert('Error deleting ad: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const viewAdDetails = (ad) => {
    setSelectedAd(ad)
    setShowViewModal(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      package_id: '',
      target_audience: 'ALL'
    })
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

  const getStatusBadge = (status, endDate) => {
    const now = new Date()
    const isExpired = endDate && new Date(endDate) <= now
    
    const badges = {
      'ACTIVE': { class: 'active', icon: 'bi-check-circle-fill', text: 'Active' },
      'PENDING': { class: 'pending', icon: 'bi-clock-fill', text: 'Pending' },
      'EXPIRED': { class: 'expired', icon: 'bi-clock-history', text: 'Expired' },
      'REJECTED': { class: 'rejected', icon: 'bi-x-circle-fill', text: 'Rejected' }
    }
    
    let statusObj = badges[status] || badges['PENDING']
    if (isExpired && status !== 'EXPIRED') {
      statusObj = badges['EXPIRED']
    }
    
    return (
      <span className={`status-badge ${statusObj.class}`}>
        <i className={`bi ${statusObj.icon}`}></i>
        {statusObj.text}
      </span>
    )
  }

  const filteredAds = ads.filter(ad => 
    ad.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ad.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleSelectAd = (adId) => {
    setSelectedAds(prev => 
      prev.includes(adId) ? prev.filter(id => id !== adId) : [...prev, adId]
    )
    setShowBulkActions(true)
  }

  const selectAll = () => {
    if (selectedAds.length === filteredAds.length) {
      setSelectedAds([])
    } else {
      setSelectedAds(filteredAds.map(ad => ad.ad_id))
    }
  }

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedAds.length} ads?`)) return
    
    setActionLoading(true)
    try {
      for (const adId of selectedAds) {
        await supabase.from('mobile_advertisements').delete().eq('ad_id', adId)
      }
      await fetchAds()
      setSelectedAds([])
      setShowBulkActions(false)
      alert('Selected campaigns deleted!')
    } catch (err) {
      console.error('Error bulk deleting:', err)
      alert('Error deleting campaigns')
    } finally {
      setActionLoading(false)
    }
  }

  // Add email notification status indicator to the UI
  const EmailNotificationBadge = () => (
    <div className={`email-notification-badge ${emailSettings.enable_notifications ? 'enabled' : 'disabled'}`}>
      <i className={`bi ${emailSettings.enable_notifications ? 'bi-envelope-check-fill' : 'bi-envelope-slash-fill'}`}></i>
      <span>Email Notifications {emailSettings.enable_notifications ? 'Enabled' : 'Disabled'}</span>
      {!emailSettings.enable_notifications && (
        <small>Configure in Settings to enable</small>
      )}
    </div>
  )

  if (loading) {
    return (
      <AdminLayout title="Advertisements">
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-animation">
              <div className="loading-circle"></div>
              <div className="loading-circle delay-1"></div>
              <div className="loading-circle delay-2"></div>
            </div>
            <h3>Loading advertisements...</h3>
            <p>Please wait while we fetch your data</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Advertisements">
      <div className="ads-dashboard">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">
                <i className="bi bi-megaphone-fill"></i>
                Advertisement Management
              </h1>
              <p className="hero-subtitle">Monitor, manage, and optimize your advertising campaigns</p>
            </div>
            <div className="hero-actions">
              <EmailNotificationBadge />
              <button className="btn-analytics" onClick={() => setShowAnalyticsModal(true)}>
                <i className="bi bi-graph-up"></i>
                Analytics
              </button>
              <button className="btn-packages" onClick={() => setShowPackageListModal(true)}>
                <i className="bi bi-tags"></i>
                Manage Packages
              </button>
              <button className="btn-create-campaign" onClick={() => setShowCreateModal(true)}>
                <i className="bi bi-plus-circle"></i>
                Create Campaign
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid - Same as before */}
        <div className="stats-wrapper">
          <div className="stats-grid">
            <div className="stat-card stat-total">
              <div className="stat-icon">
                <i className="bi bi-megaphone"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Campaigns</span>
                <h3 className="stat-value">{stats.total}</h3>
                <span className="stat-trend">Total ads created</span>
              </div>
              <div className="stat-bg-icon">
                <i className="bi bi-megaphone"></i>
              </div>
            </div>

            <div className="stat-card stat-active">
              <div className="stat-icon">
                <i className="bi bi-check-circle"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Active Now</span>
                <h3 className="stat-value">{stats.active}</h3>
                <span className="stat-trend">{stats.total > 0 ? ((stats.active/stats.total)*100).toFixed(0) : 0}% of total</span>
              </div>
              <div className="stat-bg-icon">
                <i className="bi bi-check-circle"></i>
              </div>
            </div>

            <div className="stat-card stat-pending">
              <div className="stat-icon">
                <i className="bi bi-hourglass-split"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Pending Review</span>
                <h3 className="stat-value">{stats.pending}</h3>
                <span className="stat-trend">Awaiting approval</span>
              </div>
              <div className="stat-bg-icon">
                <i className="bi bi-hourglass-split"></i>
              </div>
            </div>

            <div className="stat-card stat-clicks">
              <div className="stat-icon">
                <i className="bi bi-mouse"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Clicks</span>
                <h3 className="stat-value">{stats.clicks.toLocaleString()}</h3>
                <span className="stat-trend">CTR: {stats.ctr}%</span>
              </div>
              <div className="stat-bg-icon">
                <i className="bi bi-mouse"></i>
              </div>
            </div>

            <div className="stat-card stat-revenue">
              <div className="stat-icon">
                <i className="bi bi-currency-dollar"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Revenue</span>
                <h3 className="stat-value">${stats.revenue.toLocaleString()}</h3>
                <span className="stat-trend">Total earnings</span>
              </div>
              <div className="stat-bg-icon">
                <i className="bi bi-currency-dollar"></i>
              </div>
            </div>

            <div className="stat-card stat-ctr">
              <div className="stat-icon">
                <i className="bi bi-graph-up"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">CTR Average</span>
                <h3 className="stat-value">{stats.ctr}%</h3>
                <span className="stat-trend">Click through rate</span>
              </div>
              <div className="stat-bg-icon">
                <i className="bi bi-graph-up"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="controls-bar">
          <div className="controls-left">
            <div className="search-box">
              <i className="bi bi-search"></i>
              <input 
                type="text" 
                placeholder="Search campaigns..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="clear-search" onClick={() => setSearchTerm('')}>
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
            
            <div className="filter-group">
              <button className="filter-btn" onClick={() => setShowFilters(!showFilters)}>
                <i className="bi bi-funnel"></i>
                Filters
                {(filter !== 'all' || dateRange !== 'all') && <span className="filter-badge"></span>}
              </button>
              
              {showFilters && (
                <div className="filter-dropdown">
                  <div className="filter-section">
                    <label>Status</label>
                    <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="expired">Expired</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="filter-section">
                    <label>Date Range</label>
                    <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                    </select>
                  </div>
                  <button className="reset-filters-btn" onClick={() => {
                    setFilter('all')
                    setDateRange('all')
                    setShowFilters(false)
                  }}>
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="controls-right">
            <div className="view-toggle">
              <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
                <i className="bi bi-grid-3x3-gap-fill"></i>
              </button>
              <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                <i className="bi bi-list-ul"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {showBulkActions && selectedAds.length > 0 && (
          <div className="bulk-actions-bar">
            <div className="bulk-info">
              <i className="bi bi-check2-circle"></i>
              <span>{selectedAds.length} items selected</span>
            </div>
            <div className="bulk-actions">
              <button className="bulk-select-all" onClick={selectAll}>
                {selectedAds.length === filteredAds.length ? 'Deselect All' : 'Select All'}
              </button>
              <button className="bulk-delete" onClick={bulkDelete}>
                <i className="bi bi-trash"></i> Delete Selected
              </button>
            </div>
          </div>
        )}

        {/* Ads Grid/List View */}
        {filteredAds.length > 0 ? (
          <div className={`ads-container ${viewMode}`}>
            {filteredAds.map((ad, index) => (
              <div key={ad.ad_id} className={`ad-card fade-in-up`} style={{animationDelay: `${index * 0.05}s`}}>
                <div className="ad-card-inner">
                  {/* Selection Checkbox */}
                  <div className="ad-select">
                    <input 
                      type="checkbox" 
                      checked={selectedAds.includes(ad.ad_id)}
                      onChange={() => toggleSelectAd(ad.ad_id)}
                    />
                  </div>

                  {/* Ad Image */}
                  {ad.image_url && (
                    <div className="ad-image-wrapper">
                      <img src={ad.image_url} alt={ad.title} />
                      <div className="ad-overlay">
                        <button className="quick-view" onClick={() => viewAdDetails(ad)}>
                          <i className="bi bi-eye"></i> Quick View
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Ad Content */}
                  <div className="ad-content">
                    <div className="ad-header">
                      <div className="ad-type-badge">
                        <i className={`bi ${ad.ad_type === 'PREMIUM' ? 'bi-star-fill' : 
                                          ad.ad_type === 'FEATURED' ? 'bi-gem' : 'bi-megaphone'}`}>
                        </i>
                        <span>{ad.subscription_packages?.package_name || 'Standard'}</span>
                      </div>
                      {getStatusBadge(ad.status, ad.end_date)}
                    </div>

                    <h3 className="ad-title">{ad.title}</h3>
                    <p className="ad-description">{ad.description?.substring(0, 120)}...</p>

                    <div className="ad-metrics">
                      <div className="metric">
                        <i className="bi bi-eye"></i>
                        <div>
                          <span className="metric-value">{ad.impressions?.toLocaleString() || 0}</span>
                          <span className="metric-label">Impressions</span>
                        </div>
                      </div>
                      <div className="metric">
                        <i className="bi bi-mouse"></i>
                        <div>
                          <span className="metric-value">{ad.clicks?.toLocaleString() || 0}</span>
                          <span className="metric-label">Clicks</span>
                        </div>
                      </div>
                      <div className="metric">
                        <i className="bi bi-graph-up"></i>
                        <div>
                          <span className="metric-value">
                            {ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : 0}%
                          </span>
                          <span className="metric-label">CTR</span>
                        </div>
                      </div>
                      <div className="metric">
                        <i className="bi bi-currency-dollar"></i>
                        <div>
                          <span className="metric-value">${ad.amount_paid || 0}</span>
                          <span className="metric-label">Amount</span>
                        </div>
                      </div>
                    </div>

                    <div className="ad-footer">
                      <div className="ad-date">
                        <i className="bi bi-calendar3"></i>
                        {new Date(ad.created_at).toLocaleDateString()}
                      </div>
                      <div className="ad-actions">
                        <button className="action-btn view" onClick={() => viewAdDetails(ad)}>
                          <i className="bi bi-eye"></i>
                          <span>View</span>
                        </button>
                        {ad.status === 'PENDING' && (
                          <>
                            <button className="action-btn approve" onClick={() => approveAd(ad.ad_id)} disabled={actionLoading}>
                              <i className="bi bi-check-lg"></i>
                              <span>Approve</span>
                            </button>
                            <button className="action-btn reject" onClick={() => rejectAd(ad.ad_id)} disabled={actionLoading}>
                              <i className="bi bi-x-lg"></i>
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                        {ad.status === 'ACTIVE' && (
                          <button className="action-btn pause" onClick={async () => {
                            if (confirm('Pause this campaign?')) {
                              await supabase.from('mobile_advertisements').update({ status: 'EXPIRED' }).eq('ad_id', ad.ad_id)
                              fetchAds()
                            }
                          }}>
                            <i className="bi bi-pause-circle"></i>
                            <span>Pause</span>
                          </button>
                        )}
                        <button className="action-btn delete" onClick={() => deleteAd(ad.ad_id)} disabled={actionLoading}>
                          <i className="bi bi-trash"></i>
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="bi bi-megaphone-slash"></i>
            </div>
            <h3>No Campaigns Found</h3>
            <p>Get started by creating your first advertising campaign</p>
            <button className="btn-create-first" onClick={() => setShowCreateModal(true)}>
              <i className="bi bi-plus-circle"></i>
              Create Your First Campaign
            </button>
          </div>
        )}
      </div>

      {/* Modals - Same as before but with email notification info */}
      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <i className="bi bi-megaphone"></i>
                <div>
                  <h2>Create Campaign</h2>
                  <p>Set up a new advertising campaign</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              {!emailSettings.enable_notifications && (
                <div className="notification-warning">
                  <i className="bi bi-envelope-slash-fill"></i>
                  <div>
                    <strong>Email notifications are disabled</strong>
                    <p>Users won't receive email updates about their campaigns. Enable in <a href="/admin/settings">Settings</a>.</p>
                  </div>
                </div>
              )}
              
              <div className="form-group">
                <label>Campaign Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter campaign title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-textarea"
                  rows="4"
                  placeholder="Describe your campaign"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Image URL</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://example.com/image.jpg"
                  value={formData.image_url}
                  onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                />
                <small className="form-hint">Enter a valid image URL for your campaign</small>
              </div>

              <div className="form-group">
                <label>Select Package *</label>
                <select
                  className="form-select"
                  value={formData.package_id}
                  onChange={(e) => setFormData({...formData, package_id: e.target.value})}
                >
                  <option value="">Choose a package</option>
                  {packages.filter(p => p.is_active).map(pkg => (
                    <option key={pkg.package_id} value={pkg.package_id}>
                      {pkg.package_name} - ${pkg.price} ({pkg.duration_days} days)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Target Audience</label>
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
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={createCampaign} disabled={actionLoading}>
                {actionLoading ? 'Creating...' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Campaign Modal - Same as before */}
      {showViewModal && selectedAd && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <i className="bi bi-megaphone"></i>
                <div>
                  <h2>Campaign Details</h2>
                  <p>Complete information about this campaign</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowViewModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              {selectedAd.image_url && (
                <div className="view-image">
                  <img src={selectedAd.image_url} alt={selectedAd.title} />
                </div>
              )}
              
              <div className="view-section">
                <h3>{selectedAd.title}</h3>
                <p className="view-description">{selectedAd.description}</p>
              </div>

              <div className="view-grid">
                <div className="view-item">
                  <label>Status</label>
                  <div>{getStatusBadge(selectedAd.status, selectedAd.end_date)}</div>
                </div>
                <div className="view-item">
                  <label>Package</label>
                  <span>{selectedAd.subscription_packages?.package_name || 'Standard'}</span>
                </div>
                <div className="view-item">
                  <label>Target Audience</label>
                  <span>{selectedAd.target_audience}</span>
                </div>
                <div className="view-item">
                  <label>Amount Paid</label>
                  <span>${selectedAd.amount_paid || 0}</span>
                </div>
                <div className="view-item">
                  <label>Impressions</label>
                  <span>{selectedAd.impressions?.toLocaleString() || 0}</span>
                </div>
                <div className="view-item">
                  <label>Clicks</label>
                  <span>{selectedAd.clicks?.toLocaleString() || 0}</span>
                </div>
                <div className="view-item">
                  <label>CTR</label>
                  <span>{selectedAd.impressions > 0 ? ((selectedAd.clicks / selectedAd.impressions) * 100).toFixed(2) : 0}%</span>
                </div>
                <div className="view-item">
                  <label>Created</label>
                  <span>{new Date(selectedAd.created_at).toLocaleDateString()}</span>
                </div>
                {selectedAd.start_date && (
                  <div className="view-item">
                    <label>Start Date</label>
                    <span>{new Date(selectedAd.start_date).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedAd.end_date && (
                  <div className="view-item">
                    <label>End Date</label>
                    <span>{new Date(selectedAd.end_date).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedAd.rejection_reason && (
                  <div className="view-item full-width">
                    <label>Rejection Reason</label>
                    <span className="rejection-reason">{selectedAd.rejection_reason}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Packages List Modal - Same as before */}
      {showPackageListModal && (
        <div className="modal-overlay" onClick={() => setShowPackageListModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <i className="bi bi-tags-fill"></i>
                <div>
                  <h2>Subscription Packages</h2>
                  <p>Manage your advertising packages and pricing</p>
                </div>
              </div>
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
                {packages.length > 0 ? (
                  packages.map((pkg) => (
                    <div key={pkg.package_id} className="package-card-modern">
                      <div className="package-badge" style={{background: pkg.ad_type === 'FEATURED' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f3f4f6'}}>
                        {pkg.ad_type}
                      </div>
                      <h3 className="package-name">{pkg.package_name}</h3>
                      <div className="package-price">
                        <span className="currency">$</span>
                        <span className="amount">{pkg.price}</span>
                        <span className="period">/{pkg.duration_days} days</span>
                      </div>
                      <p className="package-description">{pkg.description}</p>
                      <div className="package-features">
                        {pkg.features?.slice(0, 4).map((feature, idx) => (
                          <div key={idx} className="feature">
                            <i className="bi bi-check-circle-fill"></i>
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                      <div className="package-actions">
                        <button className="edit-package" onClick={() => {
                          setShowPackageListModal(false)
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
                        }}>
                          <i className="bi bi-pencil"></i> Edit
                        </button>
                        <button className="delete-package" onClick={() => deletePackage(pkg.package_id)}>
                          <i className="bi bi-trash"></i> Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-packages">
                    <p>No packages created yet.</p>
                    <button className="btn-add-package" onClick={() => {
                      setShowPackageListModal(false)
                      setEditingPackage(null)
                      resetPackageForm()
                      setShowPackageModal(true)
                    }}>
                      Create your first package
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Package Create/Edit Modal - Same as before */}
      {showPackageModal && (
        <div className="modal-overlay" onClick={() => {
          setShowPackageModal(false)
          setEditingPackage(null)
          resetPackageForm()
        }}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <i className="bi bi-box-seam"></i>
                <div>
                  <h2>{editingPackage ? 'Edit Package' : 'Create Package'}</h2>
                  <p>{editingPackage ? 'Modify package details' : 'Add a new subscription package'}</p>
                </div>
              </div>
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
                <label>Package Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Basic, Premium, Featured"
                  value={packageFormData.package_name}
                  onChange={(e) => setPackageFormData({...packageFormData, package_name: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
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
                  <label>Price ($) *</label>
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
                  <label>Duration (Days) *</label>
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
                  <label>Ad Type</label>
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
                  <label>Display Order</label>
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
                <label>Features (comma separated)</label>
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
                <label className="checkbox-label">
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
                {actionLoading ? 'Saving...' : (editingPackage ? 'Update Package' : 'Create Package')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal - Same as before */}
      {showAnalyticsModal && (
        <div className="modal-overlay" onClick={() => setShowAnalyticsModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <i className="bi bi-graph-up"></i>
                <div>
                  <h2>Analytics Dashboard</h2>
                  <p>Campaign performance insights</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowAnalyticsModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="analytics-grid">
                <div className="analytics-card">
                  <div className="analytics-icon">
                    <i className="bi bi-eye"></i>
                  </div>
                  <div className="analytics-data">
                    <span className="analytics-label">Total Impressions</span>
                    <h2>{stats.impressions.toLocaleString()}</h2>
                    <span className="analytics-trend">Lifetime views</span>
                  </div>
                </div>
                <div className="analytics-card">
                  <div className="analytics-icon">
                    <i className="bi bi-mouse"></i>
                  </div>
                  <div className="analytics-data">
                    <span className="analytics-label">Total Clicks</span>
                    <h2>{stats.clicks.toLocaleString()}</h2>
                    <span className="analytics-trend">User interactions</span>
                  </div>
                </div>
                <div className="analytics-card">
                  <div className="analytics-icon">
                    <i className="bi bi-graph-up"></i>
                  </div>
                  <div className="analytics-data">
                    <span className="analytics-label">Click-Through Rate</span>
                    <h2>{stats.ctr}%</h2>
                    <span className="analytics-trend">Engagement rate</span>
                  </div>
                </div>
                <div className="analytics-card">
                  <div className="analytics-icon">
                    <i className="bi bi-currency-dollar"></i>
                  </div>
                  <div className="analytics-data">
                    <span className="analytics-label">Total Revenue</span>
                    <h2>${stats.revenue.toLocaleString()}</h2>
                    <span className="analytics-trend">Total earnings</span>
                  </div>
                </div>
                <div className="analytics-card">
                  <div className="analytics-icon">
                    <i className="bi bi-trophy"></i>
                  </div>
                  <div className="analytics-data">
                    <span className="analytics-label">Best Performing</span>
                    <h2>{ads.filter(a => a.status === 'ACTIVE').sort((a,b) => (b.clicks/b.impressions) - (a.clicks/a.impressions))[0]?.title || 'N/A'}</h2>
                    <span className="analytics-trend">Highest CTR</span>
                  </div>
                </div>
                <div className="analytics-card">
                  <div className="analytics-icon">
                    <i className="bi bi-megaphone"></i>
                  </div>
                  <div className="analytics-data">
                    <span className="analytics-label">Active Campaigns</span>
                    <h2>{stats.active}</h2>
                    <span className="analytics-trend">Currently running</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* All existing styles remain the same */
        .ads-dashboard {
          max-width: 1600px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* Add email notification badge styles */
        .email-notification-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          background: white;
          color: #667eea;
        }

        .email-notification-badge.enabled {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .email-notification-badge.disabled {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .email-notification-badge i {
          font-size: 18px;
        }

        .email-notification-badge small {
          font-size: 11px;
          opacity: 0.8;
        }

        .notification-warning {
          background: rgba(245, 158, 11, 0.1);
          border-left: 4px solid #f59e0b;
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .notification-warning i {
          font-size: 20px;
          color: #f59e0b;
        }

        .notification-warning a {
          color: #f59e0b;
          text-decoration: none;
        }

        .notification-warning a:hover {
          text-decoration: underline;
        }

        /* Rest of the existing styles remain exactly the same */
        .hero-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 28px;
          padding: 48px 40px;
          margin-bottom: 32px;
          position: relative;
          overflow: hidden;
        }

        /* ... include all other existing CSS styles from your original component ... */
        
        @media (max-width: 768px) {
          .email-notification-badge {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </AdminLayout>
  )
}