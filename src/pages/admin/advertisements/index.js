import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import AdminLayout from '@/components/AdminLayout'
import toast, { Toaster } from 'react-hot-toast'

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
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [chartData, setChartData] = useState(null)
  
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
        .order(sortBy, { ascending: sortOrder === 'asc' })

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
          case 'year':
            startDate.setFullYear(startDate.getFullYear() - 1)
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
        prepareChartData(adsWithPackages)
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

  const prepareChartData = (adsData) => {
    const last7Days = [...Array(7)].map((_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - i)
      return date.toISOString().split('T')[0]
    }).reverse()

    const clicksByDay = last7Days.map(day => {
      return adsData.filter(ad => ad.created_at?.split('T')[0] === day)
        .reduce((sum, ad) => sum + (ad.clicks || 0), 0)
    })

    const impressionsByDay = last7Days.map(day => {
      return adsData.filter(ad => ad.created_at?.split('T')[0] === day)
        .reduce((sum, ad) => sum + (ad.impressions || 0), 0)
    })

    setChartData({ clicksByDay, impressionsByDay, last7Days })
  }

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
        toast.success(`Notification sent to ${recipientEmail}`)
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
      toast.error('Please fill in all required fields')
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

      toast.success('Package created successfully!')
      setShowPackageModal(false)
      resetPackageForm()
      fetchPackages()
    } catch (err) {
      console.error('Error creating package:', err)
      toast.error('Error creating package: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const updatePackage = async () => {
    if (!packageFormData.package_name || !packageFormData.price) {
      toast.error('Please fill in all required fields')
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

      toast.success('Package updated successfully!')
      setShowPackageModal(false)
      resetPackageForm()
      setEditingPackage(null)
      fetchPackages()
    } catch (err) {
      console.error('Error updating package:', err)
      toast.error('Error updating package: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const deletePackage = async (packageId) => {
    if (!confirm('⚠️ Are you sure you want to delete this package?\n\nThis may affect existing subscriptions.')) return
    
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('subscription_packages')
        .delete()
        .eq('package_id', packageId)

      if (error) throw error

      toast.success('Package deleted successfully!')
      fetchPackages()
    } catch (err) {
      console.error('Error deleting package:', err)
      toast.error('Error deleting package: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const createCampaign = async () => {
    if (!formData.title || !formData.package_id) {
      toast.error('Please fill in all required fields')
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

      toast.success('Campaign created successfully! Pending approval.')
      setShowCreateModal(false)
      resetForm()
      fetchAds()
    } catch (err) {
      console.error('Error creating campaign:', err)
      toast.error('Error creating campaign: ' + err.message)
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
      
      await sendEmailNotification('ad_approved', ad.user_email || 'user@example.com', {
        userName: ad.user_name || 'User',
        title: ad.title,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      })
      
      toast.success('Campaign approved! Notification sent.')
      await fetchAds()
    } catch (err) {
      console.error('Error approving ad:', err)
      toast.error('Error approving ad: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const rejectAd = async (adId) => {
    const reason = prompt('📝 Please provide a reason for rejection:')
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
      
      await sendEmailNotification('ad_rejected', ad.user_email || 'user@example.com', {
        userName: ad.user_name || 'User',
        title: ad.title,
        reason: reason
      })
      
      toast.success('Campaign rejected! Notification sent.')
      await fetchAds()
    } catch (err) {
      console.error('Error rejecting ad:', err)
      toast.error('Error rejecting ad: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const deleteAd = async (adId) => {
    if (!confirm('⚠️ Are you sure you want to delete this ad permanently?\n\nThis action cannot be undone.')) return
    
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('mobile_advertisements')
        .delete()
        .eq('ad_id', adId)

      if (error) throw error
      toast.success('Campaign deleted successfully!')
      await fetchAds()
    } catch (err) {
      console.error('Error deleting ad:', err)
      toast.error('Error deleting ad: ' + err.message)
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
    if (!confirm(`⚠️ Delete ${selectedAds.length} campaigns?\n\nThis action cannot be undone.`)) return
    
    setActionLoading(true)
    try {
      for (const adId of selectedAds) {
        await supabase.from('mobile_advertisements').delete().eq('ad_id', adId)
      }
      await fetchAds()
      setSelectedAds([])
      setShowBulkActions(false)
      toast.success(`${selectedAds.length} campaigns deleted!`)
    } catch (err) {
      console.error('Error bulk deleting:', err)
      toast.error('Error deleting campaigns')
    } finally {
      setActionLoading(false)
    }
  }

  const StatCard = ({ title, value, icon, color, trend, trendValue }) => (
    <div className={`stat-card ${color}`}>
      <div className="stat-card-inner">
        <div className="stat-icon-wrapper">
          <i className={`bi ${icon}`}></i>
        </div>
        <div className="stat-content">
          <span className="stat-title">{title}</span>
          <h2 className="stat-number">{value.toLocaleString()}</h2>
          {trend && (
            <div className="stat-trend">
              <i className={`bi bi-arrow-${trend === 'up' ? 'up' : 'down'}-short`}></i>
              <span>{trendValue}</span>
            </div>
          )}
        </div>
      </div>
      <div className="stat-bg-icon">
        <i className={`bi ${icon}`}></i>
      </div>
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
            <h3>Loading your campaigns...</h3>
            <p>Please wait while we fetch your data</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Advertisements">
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      
      <div className="ads-dashboard">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-content">
            <div className="hero-text">
              <div className="hero-badge">
                <i className="bi bi-megaphone-fill"></i>
                <span>Campaign Manager</span>
              </div>
              <h1 className="hero-title">
                Advertisement Management
              </h1>
              <p className="hero-subtitle">
                Create, monitor, and optimize your advertising campaigns in one place
              </p>
            </div>
            <div className="hero-actions">
              <button className="btn-analytics" onClick={() => setShowAnalyticsModal(true)}>
                <i className="bi bi-graph-up"></i>
                Analytics
              </button>
              <button className="btn-packages" onClick={() => setShowPackageListModal(true)}>
                <i className="bi bi-tags"></i>
                Packages
              </button>
              <button className="btn-create-campaign" onClick={() => setShowCreateModal(true)}>
                <i className="bi bi-plus-circle"></i>
                Create Campaign
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <StatCard title="Total Campaigns" value={stats.total} icon="bi-megaphone" color="primary" trend="up" trendValue="+12%" />
          <StatCard title="Active Now" value={stats.active} icon="bi-check-circle" color="success" trend="up" trendValue="+8%" />
          <StatCard title="Pending Review" value={stats.pending} icon="bi-hourglass-split" color="warning" trend="down" trendValue="-3%" />
          <StatCard title="Total Clicks" value={stats.clicks} icon="bi-mouse" color="info" trend="up" trendValue="+23%" />
          <StatCard title="Revenue" value={`$${stats.revenue}`} icon="bi-currency-dollar" color="danger" trend="up" trendValue="+15%" />
          <StatCard title="CTR Average" value={`${stats.ctr}%`} icon="bi-graph-up" color="purple" trend="up" trendValue="+2.1%" />
        </div>

        {/* Controls Bar */}
        <div className="controls-bar">
          <div className="controls-left">
            <div className="search-box">
              <i className="bi bi-search"></i>
              <input 
                type="text" 
                placeholder="Search by title or description..." 
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
              <button className={`filter-trigger ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                <i className="bi bi-funnel"></i>
                Filters
                {(filter !== 'all' || dateRange !== 'all') && <span className="filter-active-dot"></span>}
              </button>
              
              {showFilters && (
                <div className="filter-dropdown">
                  <div className="filter-section">
                    <label>Status</label>
                    <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                      <option value="all">All Status</option>
                      <option value="active">✅ Active</option>
                      <option value="pending">⏳ Pending</option>
                      <option value="expired">⏰ Expired</option>
                      <option value="rejected">❌ Rejected</option>
                    </select>
                  </div>
                  <div className="filter-section">
                    <label>Date Range</label>
                    <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                      <option value="year">Last Year</option>
                    </select>
                  </div>
                  <button className="reset-filters" onClick={() => {
                    setFilter('all')
                    setDateRange('all')
                    setShowFilters(false)
                  }}>
                    <i className="bi bi-arrow-repeat"></i> Reset Filters
                  </button>
                </div>
              )}
            </div>

            <div className="sort-group">
              <select 
                className="sort-select" 
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split('-')
                  setSortBy(newSortBy)
                  setSortOrder(newSortOrder)
                  fetchAds()
                }}
              >
                <option value="created_at-desc">Newest First</option>
                <option value="created_at-asc">Oldest First</option>
                <option value="clicks-desc">Most Clicks</option>
                <option value="impressions-desc">Most Impressions</option>
                <option value="amount_paid-desc">Highest Budget</option>
              </select>
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
            <div className="campaign-count">
              <i className="bi bi-camera-reels"></i>
              <span>{filteredAds.length} campaigns</span>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {showBulkActions && selectedAds.length > 0 && (
          <div className="bulk-actions-bar slide-down">
            <div className="bulk-info">
              <i className="bi bi-check2-square"></i>
              <span>{selectedAds.length} campaign{selectedAds.length !== 1 ? 's' : ''} selected</span>
            </div>
            <div className="bulk-actions">
              <button className="bulk-select-all" onClick={selectAll}>
                {selectedAds.length === filteredAds.length ? 'Deselect All' : 'Select All'}
              </button>
              <button className="bulk-delete" onClick={bulkDelete}>
                <i className="bi bi-trash"></i> Delete
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
                  <div className="ad-select">
                    <input 
                      type="checkbox" 
                      checked={selectedAds.includes(ad.ad_id)}
                      onChange={() => toggleSelectAd(ad.ad_id)}
                      id={`select-${ad.ad_id}`}
                    />
                    <label htmlFor={`select-${ad.ad_id}`}></label>
                  </div>

                  {ad.image_url && (
                    <div className="ad-image-wrapper">
                      <img src={ad.image_url} alt={ad.title} loading="lazy" />
                      <div className="ad-image-overlay">
                        <button className="quick-view-btn" onClick={() => viewAdDetails(ad)}>
                          <i className="bi bi-eye"></i> Quick View
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="ad-content">
                    <div className="ad-header">
                      <div className="ad-badges">
                        <span className="ad-type-badge">
                          <i className={`bi ${ad.subscription_packages?.ad_type === 'PREMIUM' ? 'bi-star-fill' : 
                                            ad.subscription_packages?.ad_type === 'FEATURED' ? 'bi-gem' : 'bi-megaphone'}`}>
                          </i>
                          {ad.subscription_packages?.package_name || 'Standard'}
                        </span>
                        {getStatusBadge(ad.status, ad.end_date)}
                      </div>
                    </div>

                    <h3 className="ad-title">{ad.title}</h3>
                    <p className="ad-description">{ad.description?.substring(0, 100)}...</p>

                    <div className="ad-metrics">
                      <div className="metric-item">
                        <i className="bi bi-eye"></i>
                        <div>
                          <span className="metric-value">{ad.impressions?.toLocaleString() || 0}</span>
                          <span className="metric-label">Impressions</span>
                        </div>
                      </div>
                      <div className="metric-item">
                        <i className="bi bi-mouse"></i>
                        <div>
                          <span className="metric-value">{ad.clicks?.toLocaleString() || 0}</span>
                          <span className="metric-label">Clicks</span>
                        </div>
                      </div>
                      <div className="metric-item">
                        <i className="bi bi-graph-up"></i>
                        <div>
                          <span className="metric-value">
                            {ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : 0}%
                          </span>
                          <span className="metric-label">CTR</span>
                        </div>
                      </div>
                      <div className="metric-item">
                        <i className="bi bi-currency-dollar"></i>
                        <div>
                          <span className="metric-value">${ad.amount_paid || 0}</span>
                          <span className="metric-label">Budget</span>
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
                        </button>
                        {ad.status === 'PENDING' && (
                          <>
                            <button className="action-btn approve" onClick={() => approveAd(ad.ad_id)} disabled={actionLoading}>
                              <i className="bi bi-check-lg"></i>
                            </button>
                            <button className="action-btn reject" onClick={() => rejectAd(ad.ad_id)} disabled={actionLoading}>
                              <i className="bi bi-x-lg"></i>
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
                          </button>
                        )}
                        <button className="action-btn delete" onClick={() => deleteAd(ad.ad_id)} disabled={actionLoading}>
                          <i className="bi bi-trash"></i>
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
            <div className="empty-state-illustration">
              <i className="bi bi-megaphone-slash"></i>
            </div>
            <h3>No Campaigns Found</h3>
            <p>Get started by creating your first advertising campaign</p>
            <button className="create-first-btn" onClick={() => setShowCreateModal(true)}>
              <i className="bi bi-plus-circle"></i>
              Create Your First Campaign
            </button>
          </div>
        )}
      </div>

      {/* Modals remain the same with improved styling */}
      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-wrapper">
                  <i className="bi bi-megaphone"></i>
                </div>
                <div>
                  <h2>Create New Campaign</h2>
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
                  <i className="bi bi-envelope-slash"></i>
                  <div>
                    <strong>Email notifications are disabled</strong>
                    <p>Users won't receive email updates about their campaigns.</p>
                  </div>
                </div>
              )}
              
              <div className="form-group">
                <label>Campaign Title <span className="required">*</span></label>
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
                  placeholder="Describe your campaign..."
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
                <label>Select Package <span className="required">*</span></label>
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
                  <option value="ALL">🌍 All Users</option>
                  <option value="FARMERS">🌾 Farmers Only</option>
                  <option value="VENDORS">🛒 Vendors Only</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={createCampaign} disabled={actionLoading}>
                {actionLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Creating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg"></i>
                    Create Campaign
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Campaign Modal */}
      {showViewModal && selectedAd && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-wrapper">
                  <i className="bi bi-megaphone"></i>
                </div>
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

              <div className="info-grid">
                <div className="info-item">
                  <label>Status</label>
                  <div>{getStatusBadge(selectedAd.status, selectedAd.end_date)}</div>
                </div>
                <div className="info-item">
                  <label>Package</label>
                  <span>{selectedAd.subscription_packages?.package_name || 'Standard'}</span>
                </div>
                <div className="info-item">
                  <label>Target Audience</label>
                  <span>{selectedAd.target_audience}</span>
                </div>
                <div className="info-item">
                  <label>Budget</label>
                  <span>${selectedAd.amount_paid || 0}</span>
                </div>
                <div className="info-item">
                  <label>Impressions</label>
                  <span>{selectedAd.impressions?.toLocaleString() || 0}</span>
                </div>
                <div className="info-item">
                  <label>Clicks</label>
                  <span>{selectedAd.clicks?.toLocaleString() || 0}</span>
                </div>
                <div className="info-item">
                  <label>CTR</label>
                  <span>{selectedAd.impressions > 0 ? ((selectedAd.clicks / selectedAd.impressions) * 100).toFixed(2) : 0}%</span>
                </div>
                <div className="info-item">
                  <label>Created</label>
                  <span>{new Date(selectedAd.created_at).toLocaleDateString()}</span>
                </div>
                {selectedAd.start_date && (
                  <div className="info-item">
                    <label>Start Date</label>
                    <span>{new Date(selectedAd.start_date).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedAd.end_date && (
                  <div className="info-item">
                    <label>End Date</label>
                    <span>{new Date(selectedAd.end_date).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedAd.rejection_reason && (
                  <div className="info-item full-width">
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

      {/* Packages List Modal */}
      {showPackageListModal && (
        <div className="modal-overlay" onClick={() => setShowPackageListModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-wrapper">
                  <i className="bi bi-tags"></i>
                </div>
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
                    <div key={pkg.package_id} className="package-card">
                      <div className="package-badge" style={{background: pkg.ad_type === 'FEATURED' ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#f3f4f6'}}>
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
                          <div key={idx} className="feature-item">
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
                    <i className="bi bi-box-seam"></i>
                    <p>No packages created yet</p>
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

      {/* Package Create/Edit Modal */}
      {showPackageModal && (
        <div className="modal-overlay" onClick={() => {
          setShowPackageModal(false)
          setEditingPackage(null)
          resetPackageForm()
        }}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-wrapper">
                  <i className="bi bi-box-seam"></i>
                </div>
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
                <label>Package Name <span className="required">*</span></label>
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
                  <label>Price ($) <span className="required">*</span></label>
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
                  <label>Duration (Days) <span className="required">*</span></label>
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
                {actionLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Saving...
                  </>
                ) : (
                  editingPackage ? 'Update Package' : 'Create Package'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && chartData && (
        <div className="modal-overlay" onClick={() => setShowAnalyticsModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-wrapper">
                  <i className="bi bi-graph-up"></i>
                </div>
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
              <div className="analytics-summary">
                <div className="analytics-card">
                  <div className="analytics-icon">
                    <i className="bi bi-eye"></i>
                  </div>
                  <div className="analytics-data">
                    <span className="analytics-label">Total Impressions</span>
                    <h2>{stats.impressions.toLocaleString()}</h2>
                    <span className="analytics-trend positive">↑ 15.3% vs last period</span>
                  </div>
                </div>
                
                <div className="analytics-card">
                  <div className="analytics-icon">
                    <i className="bi bi-mouse"></i>
                  </div>
                  <div className="analytics-data">
                    <span className="analytics-label">Total Clicks</span>
                    <h2>{stats.clicks.toLocaleString()}</h2>
                    <span className="analytics-trend positive">↑ 23.1% vs last period</span>
                  </div>
                </div>
                
                <div className="analytics-card">
                  <div className="analytics-icon">
                    <i className="bi bi-graph-up"></i>
                  </div>
                  <div className="analytics-data">
                    <span className="analytics-label">Click-Through Rate</span>
                    <h2>{stats.ctr}%</h2>
                    <span className="analytics-trend positive">↑ 2.1% vs last period</span>
                  </div>
                </div>
                
                <div className="analytics-card">
                  <div className="analytics-icon">
                    <i className="bi bi-currency-dollar"></i>
                  </div>
                  <div className="analytics-data">
                    <span className="analytics-label">Total Revenue</span>
                    <h2>${stats.revenue.toLocaleString()}</h2>
                    <span className="analytics-trend positive">↑ 18.7% vs last period</span>
                  </div>
                </div>
              </div>

              <div className="analytics-chart">
                <h3>Performance Overview (Last 7 Days)</h3>
                <div className="chart-bars">
                  {chartData.last7Days.map((day, i) => (
                    <div key={day} className="chart-bar-group">
                      <div className="chart-bar impressions" style={{height: `${(chartData.impressionsByDay[i] / Math.max(...chartData.impressionsByDay, 1)) * 100}%`}}>
                        <span>{chartData.impressionsByDay[i]}</span>
                      </div>
                      <div className="chart-bar clicks" style={{height: `${(chartData.clicksByDay[i] / Math.max(...chartData.clicksByDay, 1)) * 100}%`}}>
                        <span>{chartData.clicksByDay[i]}</span>
                      </div>
                      <div className="chart-label">{new Date(day).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    </div>
                  ))}
                </div>
                <div className="chart-legend">
                  <span><i className="bi bi-eye"></i> Impressions</span>
                  <span><i className="bi bi-mouse"></i> Clicks</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* Modern CSS with animations and gradients */
        .ads-dashboard {
          max-width: 1600px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* Hero Section */
        .hero-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 28px;
          padding: 48px 40px;
          margin-bottom: 32px;
          position: relative;
          overflow: hidden;
        }

        .hero-section::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          animation: pulse 10s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }

        .hero-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(10px);
          border-radius: 40px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 16px;
          color: white;
        }

        .hero-title {
          font-size: 36px;
          font-weight: 700;
          color: white;
          margin: 0 0 12px 0;
        }

        .hero-subtitle {
          font-size: 16px;
          color: rgba(255,255,255,0.9);
          margin: 0;
        }

        .hero-actions {
          display: flex;
          gap: 12px;
        }

        .btn-analytics, .btn-packages, .btn-create-campaign {
          padding: 12px 24px;
          border-radius: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: none;
          font-size: 14px;
        }

        .btn-analytics, .btn-packages {
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(10px);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
        }

        .btn-analytics:hover, .btn-packages:hover {
          background: rgba(255,255,255,0.3);
          transform: translateY(-2px);
        }

        .btn-create-campaign {
          background: white;
          color: #667eea;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .btn-create-campaign:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: white;
          border-radius: 24px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }

        .stat-card-inner {
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
          z-index: 1;
        }

        .stat-icon-wrapper {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .stat-card.primary .stat-icon-wrapper { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
        .stat-card.success .stat-icon-wrapper { background: linear-gradient(135deg, #10b981, #059669); color: white; }
        .stat-card.warning .stat-icon-wrapper { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
        .stat-card.info .stat-icon-wrapper { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; }
        .stat-card.danger .stat-icon-wrapper { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }
        .stat-card.purple .stat-icon-wrapper { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; }

        .stat-content {
          flex: 1;
        }

        .stat-title {
          font-size: 13px;
          color: #6c757d;
          font-weight: 500;
          display: block;
          margin-bottom: 8px;
        }

        .stat-number {
          font-size: 32px;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 4px 0;
        }

        .stat-trend {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #10b981;
        }

        .stat-bg-icon {
          position: absolute;
          right: 16px;
          bottom: 16px;
          font-size: 80px;
          opacity: 0.05;
          z-index: 0;
        }

        /* Controls Bar */
        .controls-bar {
          background: white;
          border-radius: 20px;
          padding: 16px 20px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .controls-left {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
          flex: 1;
        }

        .search-box {
          position: relative;
          min-width: 300px;
          flex: 1;
        }

        .search-box i {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .search-box input {
          width: 100%;
          padding: 10px 40px 10px 40px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .search-box input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }

        .clear-search {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
        }

        .filter-group {
          position: relative;
        }

        .filter-trigger {
          padding: 10px 20px;
          background: #f8f9fa;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .filter-trigger.active {
          border-color: #667eea;
          background: rgba(102,126,234,0.05);
        }

        .filter-active-dot {
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
          position: absolute;
          top: -2px;
          right: -2px;
        }

        .filter-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 8px;
          background: white;
          border-radius: 16px;
          padding: 20px;
          min-width: 260px;
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
          z-index: 100;
          animation: fadeInDown 0.2s ease;
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .filter-section {
          margin-bottom: 16px;
        }

        .filter-section label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .filter-section select {
          width: 100%;
          padding: 8px 12px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
        }

        .reset-filters {
          width: 100%;
          padding: 8px;
          background: #f8f9fa;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .reset-filters:hover {
          background: #e9ecef;
        }

        .sort-group {
          min-width: 160px;
        }

        .sort-select {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          background: white;
          cursor: pointer;
        }

        .controls-right {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .view-toggle {
          display: flex;
          gap: 4px;
          background: #f8f9fa;
          padding: 4px;
          border-radius: 12px;
        }

        .view-btn {
          padding: 8px 12px;
          border: none;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .view-btn.active {
          background: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
          color: #667eea;
        }

        .campaign-count {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #f8f9fa;
          border-radius: 12px;
          font-size: 13px;
          color: #6c757d;
        }

        /* Bulk Actions */
        .bulk-actions-bar {
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 16px;
          padding: 12px 20px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          animation: slideDown 0.3s ease;
        }

        .slide-down {
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .bulk-info {
          display: flex;
          align-items: center;
          gap: 12px;
          color: white;
        }

        .bulk-info i {
          font-size: 20px;
        }

        .bulk-actions {
          display: flex;
          gap: 12px;
        }

        .bulk-select-all, .bulk-delete {
          padding: 6px 16px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .bulk-select-all {
          background: rgba(255,255,255,0.2);
          color: white;
        }

        .bulk-delete {
          background: #ef4444;
          color: white;
        }

        /* Ads Container */
        .ads-container.grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
        }

        .ads-container.list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ad-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          animation: fadeInUp 0.5s ease backwards;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .fade-in-up {
          animation: fadeInUp 0.5s ease backwards;
        }

        .ad-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }

        .ad-card-inner {
          position: relative;
        }

        .ad-select {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 10;
        }

        .ad-select input {
          width: 20px;
          height: 20px;
          cursor: pointer;
          margin: 0;
        }

        .ad-image-wrapper {
          position: relative;
          height: 200px;
          overflow: hidden;
          background: #f8f9fa;
        }

        .ad-image-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s ease;
        }

        .ad-card:hover .ad-image-wrapper img {
          transform: scale(1.05);
        }

        .ad-image-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .ad-card:hover .ad-image-overlay {
          opacity: 1;
        }

        .quick-view-btn {
          padding: 8px 20px;
          background: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.3s ease;
        }

        .quick-view-btn:hover {
          transform: scale(1.05);
        }

        .ad-content {
          padding: 20px;
        }

        .ad-header {
          margin-bottom: 16px;
        }

        .ad-badges {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ad-type-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background: #f3f4f6;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          color: #8b5cf6;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.active { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-badge.pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .status-badge.expired { background: rgba(107,114,128,0.1); color: #6c757d; }
        .status-badge.rejected { background: rgba(239,68,68,0.1); color: #ef4444; }

        .ad-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 8px 0;
          color: #1f2937;
        }

        .ad-description {
          font-size: 14px;
          color: #6c757d;
          margin-bottom: 16px;
          line-height: 1.5;
        }

        .ad-metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          padding: 16px 0;
          border-top: 1px solid #e9ecef;
          border-bottom: 1px solid #e9ecef;
          margin-bottom: 16px;
        }

        .metric-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .metric-item i {
          font-size: 20px;
          color: #9ca3af;
        }

        .metric-item div {
          display: flex;
          flex-direction: column;
        }

        .metric-value {
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
        }

        .metric-label {
          font-size: 11px;
          color: #9ca3af;
        }

        .ad-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ad-date {
          font-size: 12px;
          color: #9ca3af;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ad-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: transparent;
        }

        .action-btn.view { background: rgba(79,70,229,0.1); color: #4f46e5; }
        .action-btn.view:hover { background: #4f46e5; color: white; }
        .action-btn.approve { background: rgba(16,185,129,0.1); color: #10b981; }
        .action-btn.approve:hover { background: #10b981; color: white; }
        .action-btn.reject { background: rgba(239,68,68,0.1); color: #ef4444; }
        .action-btn.reject:hover { background: #ef4444; color: white; }
        .action-btn.pause { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .action-btn.pause:hover { background: #f59e0b; color: white; }
        .action-btn.delete { background: rgba(239,68,68,0.1); color: #ef4444; }
        .action-btn.delete:hover { background: #ef4444; color: white; }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 24px;
        }

        .empty-state-illustration {
          font-size: 80px;
          color: #cbd5e1;
          margin-bottom: 24px;
        }

        .empty-state h3 {
          font-size: 24px;
          margin-bottom: 12px;
          color: #1f2937;
        }

        .empty-state p {
          color: #6c757d;
          margin-bottom: 32px;
        }

        .create-first-btn {
          padding: 12px 32px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
        }

        .create-first-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102,126,234,0.3);
        }

        /* Loading Screen */
        .loading-screen {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 500px;
        }

        .loading-content {
          text-align: center;
        }

        .loading-animation {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 24px;
        }

        .loading-circle {
          width: 12px;
          height: 12px;
          background: #667eea;
          border-radius: 50%;
          animation: bounce 1.4s ease-in-out infinite;
        }

        .delay-1 { animation-delay: 0.2s; }
        .delay-2 { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          animation: fadeIn 0.2s ease;
        }

        .modal-container {
          background: white;
          border-radius: 28px;
          width: 90%;
          max-width: 700px;
          max-height: 85vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
        }

        .modal-container.modal-lg {
          max-width: 900px;
        }

        .modal-header {
          padding: 28px 28px 20px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .modal-icon-wrapper {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #667eea20, #764ba220);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-icon-wrapper i {
          font-size: 28px;
          color: #667eea;
        }

        .modal-header-content h2 {
          font-size: 24px;
          margin: 0 0 4px 0;
        }

        .modal-header-content p {
          margin: 0;
          color: #6c757d;
        }

        .modal-close {
          width: 40px;
          height: 40px;
          background: #f8f9fa;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-close:hover {
          background: #e9ecef;
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 28px;
        }

        .modal-footer {
          padding: 20px 28px 28px;
          border-top: 1px solid #e9ecef;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        /* Form Styles */
        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .required {
          color: #ef4444;
        }

        .form-input, .form-select, .form-textarea {
          width: 100%;
          padding: 10px 14px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.3s ease;
          background: white;
        }

        .form-input:focus, .form-select:focus, .form-textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }

        .form-textarea {
          resize: vertical;
        }

        .form-hint {
          display: block;
          font-size: 11px;
          color: #9ca3af;
          margin-top: 4px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .checkbox-label input {
          width: auto;
          cursor: pointer;
        }

        /* Notification Warning */
        .notification-warning {
          background: rgba(245,158,11,0.1);
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

        /* View Modal Styles */
        .view-image {
          margin-bottom: 24px;
          border-radius: 16px;
          overflow: hidden;
        }

        .view-image img {
          width: 100%;
          height: auto;
          max-height: 300px;
          object-fit: cover;
        }

        .view-section {
          margin-bottom: 24px;
        }

        .view-section h3 {
          font-size: 20px;
          margin-bottom: 12px;
          color: #1f2937;
        }

        .view-description {
          color: #6c757d;
          line-height: 1.6;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .info-item {
          padding: 12px;
          background: #f8f9fa;
          border-radius: 12px;
        }

        .info-item label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #6c757d;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .info-item span {
          font-size: 16px;
          font-weight: 500;
          color: #1f2937;
        }

        .info-item.full-width {
          grid-column: span 2;
        }

        .rejection-reason {
          color: #ef4444 !important;
        }

        /* Packages Styles */
        .packages-header {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 24px;
        }

        .btn-add-package {
          padding: 10px 20px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none;
          border-radius: 12px;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
        }

        .btn-add-package:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102,126,234,0.3);
        }

        .packages-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }

        .package-card {
          background: #f9fafb;
          border: 2px solid #e9ecef;
          border-radius: 20px;
          padding: 24px;
          transition: all 0.3s ease;
        }

        .package-card:hover {
          transform: translateY(-4px);
          border-color: #667eea;
          box-shadow: 0 12px 24px rgba(102,126,234,0.1);
        }

        .package-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .package-name {
          font-size: 20px;
          margin: 0 0 8px 0;
        }

        .package-price {
          margin-bottom: 16px;
        }

        .package-price .currency {
          font-size: 18px;
          font-weight: 600;
          color: #6c757d;
        }

        .package-price .amount {
          font-size: 36px;
          font-weight: 700;
          color: #1f2937;
        }

        .package-price .period {
          font-size: 14px;
          color: #6c757d;
        }

        .package-description {
          color: #6c757d;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .package-features {
          margin-bottom: 20px;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          padding: 6px 0;
          color: #374151;
        }

        .feature-item i {
          color: #10b981;
          font-size: 14px;
        }

        .package-actions {
          display: flex;
          gap: 12px;
        }

        .edit-package, .delete-package {
          flex: 1;
          padding: 8px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .edit-package {
          background: rgba(79,70,229,0.1);
          color: #4f46e5;
        }

        .edit-package:hover {
          background: #4f46e5;
          color: white;
        }

        .delete-package {
          background: rgba(239,68,68,0.1);
          color: #ef4444;
        }

        .delete-package:hover {
          background: #ef4444;
          color: white;
        }

        .empty-packages {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-packages i {
          font-size: 48px;
          color: #cbd5e1;
          margin-bottom: 16px;
        }

        .empty-packages p {
          margin-bottom: 20px;
          color: #6c757d;
        }

        /* Analytics Styles */
        .analytics-summary {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }

        .analytics-card {
          background: #f8f9fa;
          border-radius: 20px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .analytics-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #667eea20, #764ba220);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .analytics-icon i {
          font-size: 24px;
          color: #667eea;
        }

        .analytics-data {
          flex: 1;
        }

        .analytics-label {
          font-size: 12px;
          color: #6c757d;
          display: block;
          margin-bottom: 4px;
        }

        .analytics-data h2 {
          font-size: 28px;
          margin: 0 0 4px 0;
          color: #1f2937;
        }

        .analytics-trend {
          font-size: 12px;
        }

        .analytics-trend.positive {
          color: #10b981;
        }

        .analytics-trend.negative {
          color: #ef4444;
        }

        .analytics-chart {
          margin-top: 32px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 20px;
        }

        .analytics-chart h3 {
          margin: 0 0 20px 0;
          font-size: 16px;
        }

        .chart-bars {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          justify-content: space-around;
          min-height: 200px;
          padding: 20px 0;
        }

        .chart-bar-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .chart-bar {
          width: 100%;
          max-width: 40px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 6px;
          transition: height 0.5s ease;
          position: relative;
          cursor: pointer;
        }

        .chart-bar.impressions {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
        }

        .chart-bar.clicks {
          background: linear-gradient(135deg, #10b981, #059669);
        }

        .chart-bar span {
          position: absolute;
          top: -20px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          white-space: nowrap;
        }

        .chart-label {
          font-size: 11px;
          color: #6c757d;
          text-align: center;
        }

        .chart-legend {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
        }

        .chart-legend span {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
        }

        .btn-secondary {
          padding: 10px 20px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .btn-secondary:hover {
          background: #e9ecef;
        }

        .btn-primary {
          padding: 10px 24px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102,126,234,0.3);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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

        /* Responsive */
        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          .ads-container.grid {
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .ads-dashboard {
            padding: 0 16px;
          }
          
          .hero-section {
            padding: 32px 24px;
          }
          
          .hero-content {
            flex-direction: column;
            text-align: center;
            gap: 24px;
          }
          
          .hero-title {
            font-size: 28px;
          }
          
          .hero-actions {
            flex-direction: column;
            width: 100%;
          }
          
          .btn-analytics, .btn-packages, .btn-create-campaign {
            width: 100%;
            justify-content: center;
          }
          
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          
          .controls-bar {
            flex-direction: column;
          }
          
          .controls-left {
            flex-direction: column;
            width: 100%;
          }
          
          .search-box {
            width: 100%;
          }
          
          .filter-group {
            width: 100%;
          }
          
          .filter-trigger {
            width: 100%;
            justify-content: center;
          }
          
          .sort-group {
            width: 100%;
          }
          
          .controls-right {
            width: 100%;
            justify-content: space-between;
          }
          
          .ads-container.grid {
            grid-template-columns: 1fr;
          }
          
          .ad-metrics {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .ad-footer {
            flex-direction: column;
            gap: 12px;
          }
          
          .ad-actions {
            width: 100%;
            justify-content: stretch;
          }
          
          .action-btn {
            flex: 1;
            justify-content: center;
          }
          
          .info-grid {
            grid-template-columns: 1fr;
          }
          
          .info-item.full-width {
            grid-column: span 1;
          }
          
          .form-row {
            grid-template-columns: 1fr;
          }
          
          .analytics-summary {
            grid-template-columns: 1fr;
          }
          
          .packages-grid {
            grid-template-columns: 1fr;
          }
          
          .chart-bars {
            height: 150px;
          }
          
          .chart-bar span {
            font-size: 9px;
            top: -16px;
          }
        }
      `}</style>
    </AdminLayout>
  )
}