// pages/admin/advertisements/index.js
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
  const [showCreateCampaign, setShowCreateCampaign] = useState(false)
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [showPackageListModal, setShowPackageListModal] = useState(false)
  const [showViewAdModal, setShowViewAdModal] = useState(false)
  const [selectedAd, setSelectedAd] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [packages, setPackages] = useState([])
  const [editingPackage, setEditingPackage] = useState(null)
  const [formSuccess, setFormSuccess] = useState(null)
  const [formError, setFormError] = useState(null)
  
  // Campaign form data
  const [campaignForm, setCampaignForm] = useState({
    title: '',
    description: '',
    image_url: '',
    package_id: '',
    target_audience: 'ALL'
  })

  // Package form data
  const [packageForm, setPackageForm] = useState({
    package_name: '',
    description: '',
    price: '',
    duration_days: 30,
    ad_type: 'STANDARD',
    features: '',
    is_active: true
  })

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    pending: 0,
    revenue: 0
  })

  useEffect(() => {
    fetchAllData()
  }, [filter])

  const fetchAllData = async () => {
    await Promise.all([fetchAds(), fetchPackages()])
  }

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_packages')
        .select('*')
        .order('price', { ascending: true })

      if (error) throw error
      setPackages(data || [])
    } catch (err) {
      console.error('Error fetching packages:', err)
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

      const { data, error } = await query

      if (error) throw error

      // Fetch package details for each ad
      const adsWithPackages = await Promise.all(
        (data || []).map(async (ad) => {
          if (ad.package_id) {
            const { data: pkgData } = await supabase
              .from('subscription_packages')
              .select('*')
              .eq('package_id', ad.package_id)
              .single()
            return { ...ad, package_details: pkgData }
          }
          return ad
        })
      )
      
      setAds(adsWithPackages)
      calculateStats(adsWithPackages)
    } catch (err) {
      console.error('Error fetching ads:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (adsData) => {
    const now = new Date()
    const active = adsData.filter(ad => ad.status === 'ACTIVE' && new Date(ad.end_date) > now).length
    const expired = adsData.filter(ad => ad.status === 'EXPIRED' || (ad.end_date && new Date(ad.end_date) <= now)).length
    const pending = adsData.filter(ad => ad.status === 'PENDING').length
    const revenue = adsData.reduce((sum, ad) => sum + (ad.amount_paid || 0), 0)
    
    setStats({
      total: adsData.length,
      active: active,
      expired: expired,
      pending: pending,
      revenue: revenue
    })
  }

  // Create Campaign
  const createCampaign = async () => {
    if (!campaignForm.title || !campaignForm.package_id) {
      setFormError('Please fill in all required fields')
      setTimeout(() => setFormError(null), 3000)
      return
    }

    setActionLoading(true)
    setFormError(null)
    setFormSuccess(null)
    
    try {
      const selectedPackage = packages.find(p => p.package_id === campaignForm.package_id)
      const startDate = new Date()
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + (selectedPackage?.duration_days || 30))

      const { data, error } = await supabase
        .from('mobile_advertisements')
        .insert([{
          title: campaignForm.title,
          description: campaignForm.description,
          image_url: campaignForm.image_url,
          package_id: campaignForm.package_id,
          target_audience: campaignForm.target_audience,
          ad_type: selectedPackage?.ad_type || 'STANDARD',
          amount_paid: selectedPackage?.price || 0,
          status: 'PENDING',
          payment_status: 'PENDING',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          created_at: new Date().toISOString()
        }])
        .select()

      if (error) throw error

      setFormSuccess('Campaign created successfully! Waiting for approval.')
      setTimeout(() => setFormSuccess(null), 3000)
      
      // Reset form and close modal
      setCampaignForm({
        title: '',
        description: '',
        image_url: '',
        package_id: '',
        target_audience: 'ALL'
      })
      setShowCreateCampaign(false)
      fetchAds()
    } catch (err) {
      console.error('Error creating campaign:', err)
      setFormError(err.message)
      setTimeout(() => setFormError(null), 3000)
    } finally {
      setActionLoading(false)
    }
  }

  // Create Package
  const createPackage = async () => {
    if (!packageForm.package_name || !packageForm.price) {
      setFormError('Please fill in all required fields')
      setTimeout(() => setFormError(null), 3000)
      return
    }

    setActionLoading(true)
    
    try {
      const featuresArray = packageForm.features.split(',').map(f => f.trim()).filter(f => f)
      
      const { error } = await supabase
        .from('subscription_packages')
        .insert([{
          package_name: packageForm.package_name,
          description: packageForm.description,
          price: parseFloat(packageForm.price),
          duration_days: parseInt(packageForm.duration_days),
          ad_type: packageForm.ad_type,
          features: featuresArray,
          is_active: packageForm.is_active,
          created_at: new Date().toISOString()
        }])

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

  // Update Package
  const updatePackage = async () => {
    if (!packageForm.package_name || !packageForm.price) {
      alert('Please fill in all required fields')
      return
    }

    setActionLoading(true)
    
    try {
      const featuresArray = packageForm.features.split(',').map(f => f.trim()).filter(f => f)
      
      const { error } = await supabase
        .from('subscription_packages')
        .update({
          package_name: packageForm.package_name,
          description: packageForm.description,
          price: parseFloat(packageForm.price),
          duration_days: parseInt(packageForm.duration_days),
          ad_type: packageForm.ad_type,
          features: featuresArray,
          is_active: packageForm.is_active,
          updated_at: new Date().toISOString()
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

  // Delete Package
  const deletePackage = async (packageId) => {
    if (!confirm('Are you sure you want to delete this package?')) return
    
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

  // Approve Ad
  const approveAd = async (adId) => {
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('mobile_advertisements')
        .update({ 
          status: 'ACTIVE',
          updated_at: new Date().toISOString()
        })
        .eq('ad_id', adId)

      if (error) throw error
      alert('Campaign approved successfully!')
      fetchAds()
    } catch (err) {
      console.error('Error approving ad:', err)
      alert('Error approving ad: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Reject Ad
  const rejectAd = async (adId) => {
    const reason = prompt('Please provide a reason for rejection:')
    if (!reason) return
    
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('mobile_advertisements')
        .update({ 
          status: 'REJECTED',
          rejection_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('ad_id', adId)

      if (error) throw error
      alert('Campaign rejected!')
      fetchAds()
    } catch (err) {
      console.error('Error rejecting ad:', err)
      alert('Error rejecting ad: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Delete Ad
  const deleteAd = async (adId) => {
    if (!confirm('Delete this campaign permanently?')) return
    
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('mobile_advertisements')
        .delete()
        .eq('ad_id', adId)

      if (error) throw error
      alert('Campaign deleted!')
      fetchAds()
    } catch (err) {
      console.error('Error deleting ad:', err)
      alert('Error deleting ad: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const resetPackageForm = () => {
    setPackageForm({
      package_name: '',
      description: '',
      price: '',
      duration_days: 30,
      ad_type: 'STANDARD',
      features: '',
      is_active: true
    })
  }

  const editPackage = (pkg) => {
    setEditingPackage(pkg)
    setPackageForm({
      package_name: pkg.package_name,
      description: pkg.description || '',
      price: pkg.price,
      duration_days: pkg.duration_days,
      ad_type: pkg.ad_type,
      features: pkg.features?.join(', ') || '',
      is_active: pkg.is_active
    })
    setShowPackageModal(true)
  }

  const viewAdDetails = (ad) => {
    setSelectedAd(ad)
    setShowViewAdModal(true)
  }

  const getStatusBadge = (status, endDate) => {
    const now = new Date()
    const isExpired = endDate && new Date(endDate) <= now
    
    const styles = {
      ACTIVE: { class: 'status-active', icon: 'bi-check-circle-fill', text: 'Active' },
      PENDING: { class: 'status-pending', icon: 'bi-clock-fill', text: 'Pending' },
      EXPIRED: { class: 'status-expired', icon: 'bi-clock-history', text: 'Expired' },
      REJECTED: { class: 'status-rejected', icon: 'bi-x-circle-fill', text: 'Rejected' }
    }
    
    let statusObj = styles[status] || styles.PENDING
    if (isExpired && status === 'ACTIVE') {
      statusObj = styles.EXPIRED
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

  if (loading) {
    return (
      <AdminLayout title="Advertisements">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Advertisements">
      <div className="ads-page">
        {/* Header */}
        <div className="page-header">
          <div className="header-left">
            <h1 className="page-title">
              <i className="bi bi-megaphone-fill"></i>
              Advertisement Management
            </h1>
            <p className="page-subtitle">Manage campaigns, packages, and track performance</p>
          </div>
          <div className="header-right">
            <button className="btn-packages" onClick={() => setShowPackageListModal(true)}>
              <i className="bi bi-tags"></i>
              Packages ({packages.length})
            </button>
            <button className="btn-create" onClick={() => setShowCreateCampaign(true)}>
              <i className="bi bi-plus-circle"></i>
              Create Campaign
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-icon blue">
              <i className="bi bi-megaphone"></i>
            </div>
            <div className="stat-details">
              <span className="stat-label">Total Campaigns</span>
              <h2 className="stat-number">{stats.total}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">
              <i className="bi bi-check-circle"></i>
            </div>
            <div className="stat-details">
              <span className="stat-label">Active</span>
              <h2 className="stat-number">{stats.active}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">
              <i className="bi bi-hourglass-split"></i>
            </div>
            <div className="stat-details">
              <span className="stat-label">Pending</span>
              <h2 className="stat-number">{stats.pending}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red">
              <i className="bi bi-currency-dollar"></i>
            </div>
            <div className="stat-details">
              <span className="stat-label">Revenue</span>
              <h2 className="stat-number">${stats.revenue}</h2>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="search-bar">
          <div className="search-input-wrapper">
            <i className="bi bi-search"></i>
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-wrapper">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Campaigns Grid */}
        {filteredAds.length > 0 ? (
          <div className="campaigns-grid">
            {filteredAds.map((ad) => (
              <div key={ad.ad_id} className="campaign-card">
                {ad.image_url && (
                  <div className="campaign-image">
                    <img src={ad.image_url} alt={ad.title} />
                    <div className="image-overlay">
                      <button className="btn-quick-view" onClick={() => viewAdDetails(ad)}>
                        <i className="bi bi-eye"></i> Quick View
                      </button>
                    </div>
                  </div>
                )}
                <div className="campaign-content">
                  <div className="campaign-header">
                    <div className="package-tag">
                      <i className="bi bi-box"></i>
                      {ad.package_details?.package_name || 'Standard'}
                    </div>
                    {getStatusBadge(ad.status, ad.end_date)}
                  </div>
                  <h3 className="campaign-title">{ad.title}</h3>
                  <p className="campaign-description">{ad.description?.substring(0, 100)}...</p>
                  <div className="campaign-metrics">
                    <div className="metric">
                      <i className="bi bi-eye"></i>
                      <span>{ad.impressions || 0} views</span>
                    </div>
                    <div className="metric">
                      <i className="bi bi-mouse"></i>
                      <span>{ad.clicks || 0} clicks</span>
                    </div>
                    <div className="metric">
                      <i className="bi bi-currency-dollar"></i>
                      <span>${ad.amount_paid || 0}</span>
                    </div>
                  </div>
                  <div className="campaign-footer">
                    <span className="campaign-date">
                      <i className="bi bi-calendar3"></i>
                      {new Date(ad.created_at).toLocaleDateString()}
                    </span>
                    <div className="campaign-actions">
                      <button className="action-view" onClick={() => viewAdDetails(ad)}>
                        <i className="bi bi-eye"></i>
                      </button>
                      {ad.status === 'PENDING' && (
                        <>
                          <button className="action-approve" onClick={() => approveAd(ad.ad_id)}>
                            <i className="bi bi-check-lg"></i>
                          </button>
                          <button className="action-reject" onClick={() => rejectAd(ad.ad_id)}>
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </>
                      )}
                      <button className="action-delete" onClick={() => deleteAd(ad.ad_id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <i className="bi bi-megaphone-slash"></i>
            <h3>No Campaigns Found</h3>
            <p>Create your first advertising campaign to get started</p>
            <button className="btn-create-first" onClick={() => setShowCreateCampaign(true)}>
              <i className="bi bi-plus-circle"></i> Create Campaign
            </button>
          </div>
        )}

        {/* Create Campaign Modal */}
        {showCreateCampaign && (
          <div className="modal" onClick={() => setShowCreateCampaign(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New Campaign</h2>
                <button className="close-btn" onClick={() => setShowCreateCampaign(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="modal-body">
                {formError && <div className="alert error">{formError}</div>}
                {formSuccess && <div className="alert success">{formSuccess}</div>}
                
                <div className="form-group">
                  <label>Campaign Title *</label>
                  <input
                    type="text"
                    placeholder="Enter campaign title"
                    value={campaignForm.title}
                    onChange={(e) => setCampaignForm({...campaignForm, title: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    rows="4"
                    placeholder="Describe your campaign"
                    value={campaignForm.description}
                    onChange={(e) => setCampaignForm({...campaignForm, description: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>Image URL</label>
                  <input
                    type="text"
                    placeholder="https://example.com/image.jpg"
                    value={campaignForm.image_url}
                    onChange={(e) => setCampaignForm({...campaignForm, image_url: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>Select Package *</label>
                  <select
                    value={campaignForm.package_id}
                    onChange={(e) => setCampaignForm({...campaignForm, package_id: e.target.value})}
                  >
                    <option value="">Choose a package</option>
                    {packages.map(pkg => (
                      <option key={pkg.package_id} value={pkg.package_id}>
                        {pkg.package_name} - ${pkg.price} / {pkg.duration_days} days
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Target Audience</label>
                  <select
                    value={campaignForm.target_audience}
                    onChange={(e) => setCampaignForm({...campaignForm, target_audience: e.target.value})}
                  >
                    <option value="ALL">All Users</option>
                    <option value="FARMERS">Farmers</option>
                    <option value="VENDORS">Vendors</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setShowCreateCampaign(false)}>Cancel</button>
                <button className="btn-submit" onClick={createCampaign} disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Ad Modal */}
        {showViewAdModal && selectedAd && (
          <div className="modal" onClick={() => setShowViewAdModal(false)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Campaign Details</h2>
                <button className="close-btn" onClick={() => setShowViewAdModal(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="modal-body">
                {selectedAd.image_url && (
                  <div className="ad-image-full">
                    <img src={selectedAd.image_url} alt={selectedAd.title} />
                  </div>
                )}
                <div className="ad-details">
                  <div className="detail-row">
                    <strong>Title:</strong>
                    <span>{selectedAd.title}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Description:</strong>
                    <span>{selectedAd.description}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Package:</strong>
                    <span>{selectedAd.package_details?.package_name || 'Standard'}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Status:</strong>
                    <span>{getStatusBadge(selectedAd.status, selectedAd.end_date)}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Target Audience:</strong>
                    <span>{selectedAd.target_audience}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Impressions:</strong>
                    <span>{selectedAd.impressions || 0}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Clicks:</strong>
                    <span>{selectedAd.clicks || 0}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Amount Paid:</strong>
                    <span>${selectedAd.amount_paid || 0}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Created:</strong>
                    <span>{new Date(selectedAd.created_at).toLocaleString()}</span>
                  </div>
                  {selectedAd.start_date && (
                    <div className="detail-row">
                      <strong>Start Date:</strong>
                      <span>{new Date(selectedAd.start_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {selectedAd.end_date && (
                    <div className="detail-row">
                      <strong>End Date:</strong>
                      <span>{new Date(selectedAd.end_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {selectedAd.rejection_reason && (
                    <div className="detail-row">
                      <strong>Rejection Reason:</strong>
                      <span className="rejection-reason">{selectedAd.rejection_reason}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Packages List Modal */}
        {showPackageListModal && (
          <div className="modal" onClick={() => setShowPackageListModal(false)}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Subscription Packages</h2>
                <button className="close-btn" onClick={() => setShowPackageListModal(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="modal-body">
                <div className="packages-actions">
                  <button className="btn-add-package" onClick={() => {
                    setShowPackageListModal(false)
                    setEditingPackage(null)
                    resetPackageForm()
                    setShowPackageModal(true)
                  }}>
                    <i className="bi bi-plus-lg"></i> Add Package
                  </button>
                </div>
                <div className="packages-list">
                  {packages.map((pkg) => (
                    <div key={pkg.package_id} className="package-item">
                      <div className="package-info">
                        <h3>{pkg.package_name}</h3>
                        <p>{pkg.description}</p>
                        <div className="package-price">${pkg.price} / {pkg.duration_days} days</div>
                        <div className="package-features">
                          {pkg.features?.map((feature, idx) => (
                            <span key={idx} className="feature-tag">{feature}</span>
                          ))}
                        </div>
                      </div>
                      <div className="package-actions">
                        <button className="btn-edit" onClick={() => {
                          setShowPackageListModal(false)
                          editPackage(pkg)
                        }}>
                          <i className="bi bi-pencil"></i> Edit
                        </button>
                        <button className="btn-delete" onClick={() => deletePackage(pkg.package_id)}>
                          <i className="bi bi-trash"></i> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Package Create/Edit Modal */}
        {showPackageModal && (
          <div className="modal" onClick={() => {
            setShowPackageModal(false)
            setEditingPackage(null)
            resetPackageForm()
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingPackage ? 'Edit Package' : 'Create Package'}</h2>
                <button className="close-btn" onClick={() => {
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
                    placeholder="e.g., Basic, Premium, Featured"
                    value={packageForm.package_name}
                    onChange={(e) => setPackageForm({...packageForm, package_name: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    rows="3"
                    placeholder="Describe what this package includes"
                    value={packageForm.description}
                    onChange={(e) => setPackageForm({...packageForm, description: e.target.value})}
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="29.99"
                      value={packageForm.price}
                      onChange={(e) => setPackageForm({...packageForm, price: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Duration (Days) *</label>
                    <input
                      type="number"
                      placeholder="30"
                      value={packageForm.duration_days}
                      onChange={(e) => setPackageForm({...packageForm, duration_days: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Ad Type</label>
                    <select
                      value={packageForm.ad_type}
                      onChange={(e) => setPackageForm({...packageForm, ad_type: e.target.value})}
                    >
                      <option value="STANDARD">Standard</option>
                      <option value="PREMIUM">Premium</option>
                      <option value="FEATURED">Featured</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      value={packageForm.is_active}
                      onChange={(e) => setPackageForm({...packageForm, is_active: e.target.value === 'true'})}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Features (comma separated)</label>
                  <input
                    type="text"
                    placeholder="Standard placement, Basic targeting, Email support"
                    value={packageForm.features}
                    onChange={(e) => setPackageForm({...packageForm, features: e.target.value})}
                  />
                  <small>Separate each feature with a comma</small>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => {
                  setShowPackageModal(false)
                  setEditingPackage(null)
                  resetPackageForm()
                }}>Cancel</button>
                <button className="btn-submit" onClick={editingPackage ? updatePackage : createPackage} disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : (editingPackage ? 'Update Package' : 'Create Package')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .ads-page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px;
        }

        /* Header */
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 20px;
        }

        .page-title {
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 8px 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .page-title i {
          color: #667eea;
        }

        .page-subtitle {
          color: #6c757d;
          margin: 0;
          font-size: 14px;
        }

        .header-right {
          display: flex;
          gap: 12px;
        }

        .btn-packages {
          padding: 10px 20px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .btn-packages:hover {
          background: #059669;
          transform: translateY(-2px);
        }

        .btn-create {
          padding: 10px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .btn-create:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102,126,234,0.3);
        }

        /* Stats */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 32px;
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
          box-shadow: 0 8px 20px rgba(0,0,0,0.08);
        }

        .stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .stat-icon.blue { background: rgba(79,70,229,0.1); color: #4f46e5; }
        .stat-icon.green { background: rgba(16,185,129,0.1); color: #10b981; }
        .stat-icon.orange { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .stat-icon.red { background: rgba(239,68,68,0.1); color: #ef4444; }

        .stat-details {
          flex: 1;
        }

        .stat-label {
          font-size: 13px;
          color: #6c757d;
          display: block;
          margin-bottom: 4px;
        }

        .stat-number {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          color: #1f2937;
        }

        /* Search Bar */
        .search-bar {
          display: flex;
          gap: 16px;
          margin-bottom: 32px;
        }

        .search-input-wrapper {
          flex: 1;
          position: relative;
        }

        .search-input-wrapper i {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .search-input-wrapper input {
          width: 100%;
          padding: 12px 16px 12px 44px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .search-input-wrapper input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }

        .filter-wrapper select {
          padding: 12px 20px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          background: white;
          cursor: pointer;
        }

        /* Campaigns Grid */
        .campaigns-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 24px;
        }

        .campaign-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .campaign-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }

        .campaign-image {
          position: relative;
          height: 200px;
          overflow: hidden;
        }

        .campaign-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .campaign-card:hover .campaign-image img {
          transform: scale(1.05);
        }

        .image-overlay {
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

        .campaign-card:hover .image-overlay {
          opacity: 1;
        }

        .btn-quick-view {
          padding: 8px 20px;
          background: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .campaign-content {
          padding: 20px;
        }

        .campaign-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .package-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background: #f3f4f6;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          color: #6c757d;
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

        .status-active { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .status-expired { background: rgba(107,114,128,0.1); color: #6c757d; }
        .status-rejected { background: rgba(239,68,68,0.1); color: #ef4444; }

        .campaign-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 8px 0;
          color: #1f2937;
        }

        .campaign-description {
          font-size: 14px;
          color: #6c757d;
          margin-bottom: 16px;
          line-height: 1.5;
        }

        .campaign-metrics {
          display: flex;
          gap: 16px;
          padding: 12px 0;
          border-top: 1px solid #e9ecef;
          border-bottom: 1px solid #e9ecef;
          margin-bottom: 12px;
        }

        .metric {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #6c757d;
        }

        .campaign-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .campaign-date {
          font-size: 12px;
          color: #9ca3af;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .campaign-actions {
          display: flex;
          gap: 8px;
        }

        .campaign-actions button {
          padding: 6px 10px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .action-view { background: rgba(79,70,229,0.1); color: #4f46e5; }
        .action-view:hover { background: #4f46e5; color: white; }
        .action-approve { background: rgba(16,185,129,0.1); color: #10b981; }
        .action-approve:hover { background: #10b981; color: white; }
        .action-reject { background: rgba(239,68,68,0.1); color: #ef4444; }
        .action-reject:hover { background: #ef4444; color: white; }
        .action-delete { background: rgba(239,68,68,0.1); color: #ef4444; }
        .action-delete:hover { background: #ef4444; color: white; }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 24px;
        }

        .empty-state i {
          font-size: 64px;
          color: #cbd5e1;
          margin-bottom: 16px;
          display: block;
        }

        .empty-state h3 {
          margin-bottom: 8px;
          color: #1f2937;
        }

        .empty-state p {
          color: #6c757d;
          margin-bottom: 24px;
        }

        .btn-create-first {
          padding: 12px 32px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        /* Modals */
        .modal {
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

        .modal-content {
          background: white;
          border-radius: 24px;
          width: 90%;
          max-width: 550px;
          max-height: 85vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
        }

        .modal-large {
          max-width: 700px;
        }

        .modal-header {
          padding: 24px 28px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e9ecef;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 22px;
        }

        .close-btn {
          width: 36px;
          height: 36px;
          background: #f8f9fa;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .close-btn:hover {
          background: #e9ecef;
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 28px;
        }

        .modal-footer {
          padding: 16px 28px 24px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          border-top: 1px solid #e9ecef;
        }

        /* Forms */
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

        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        small {
          display: block;
          font-size: 11px;
          color: #6c757d;
          margin-top: 4px;
        }

        .alert {
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 20px;
        }

        .alert.error {
          background: rgba(239,68,68,0.1);
          color: #ef4444;
          border: 1px solid rgba(239,68,68,0.2);
        }

        .alert.success {
          background: rgba(16,185,129,0.1);
          color: #10b981;
          border: 1px solid rgba(16,185,129,0.2);
        }

        .btn-cancel {
          padding: 10px 24px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
        }

        .btn-submit {
          padding: 10px 28px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Packages List */
        .packages-actions {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 24px;
        }

        .btn-add-package {
          padding: 10px 20px;
          background: #4f46e5;
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .packages-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-height: 500px;
          overflow-y: auto;
        }

        .package-item {
          background: #f8f9fa;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          transition: all 0.3s ease;
        }

        .package-item:hover {
          background: #f3f4f6;
        }

        .package-info h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
        }

        .package-info p {
          margin: 0 0 8px 0;
          color: #6c757d;
          font-size: 14px;
        }

        .package-price {
          font-size: 20px;
          font-weight: 700;
          color: #4f46e5;
          margin-bottom: 8px;
        }

        .package-features {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .feature-tag {
          background: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          color: #374151;
        }

        .package-actions {
          display: flex;
          gap: 8px;
        }

        .btn-edit, .btn-delete {
          padding: 6px 12px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }

        .btn-edit {
          background: rgba(79,70,229,0.1);
          color: #4f46e5;
        }

        .btn-edit:hover {
          background: #4f46e5;
          color: white;
        }

        .btn-delete {
          background: rgba(239,68,68,0.1);
          color: #ef4444;
        }

        .btn-delete:hover {
          background: #ef4444;
          color: white;
        }

        /* View Ad Modal */
        .ad-image-full {
          width: 100%;
          max-height: 300px;
          overflow: hidden;
          border-radius: 12px;
          margin-bottom: 24px;
        }

        .ad-image-full img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ad-details {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .detail-row {
          display: flex;
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
        }

        .detail-row strong {
          width: 140px;
          color: #374151;
        }

        .detail-row span {
          flex: 1;
          color: #6c757d;
        }

        .rejection-reason {
          color: #ef4444 !important;
        }

        /* Loading */
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 3px solid #e9ecef;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
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
        @media (max-width: 768px) {
          .ads-page {
            padding: 16px;
          }
          .stats-row {
            grid-template-columns: repeat(2, 1fr);
          }
          .campaigns-grid {
            grid-template-columns: 1fr;
          }
          .search-bar {
            flex-direction: column;
          }
          .form-row {
            grid-template-columns: 1fr;
          }
          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .package-item {
            flex-direction: column;
            gap: 16px;
          }
          .detail-row {
            flex-direction: column;
          }
          .detail-row strong {
            width: auto;
            margin-bottom: 4px;
          }
        }
      `}</style>
    </AdminLayout>
  )
}