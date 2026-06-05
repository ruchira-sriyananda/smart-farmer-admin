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

export default function BarterTransactions() {
  const router = useRouter()
  const [barterListings, setBarterListings] = useState([])
  const [pendingListings, setPendingListings] = useState([])
  const [barterRequests, setBarterRequests] = useState([])
  const [filteredListings, setFilteredListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [listingFilter, setListingFilter] = useState('all')
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [selectedListing, setSelectedListing] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [selectedRequests, setSelectedRequests] = useState([])
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState('')
  const [emailSettings, setEmailSettings] = useState({ enable_notifications: false })
  
  // Quick rejection reasons
  const quickReasons = [
    { id: 1, reason: 'Inappropriate content', icon: 'bi-emoji-frown', color: '#ef4444' },
    { id: 2, reason: 'Spam or promotional', icon: 'bi-megaphone', color: '#f59e0b' },
    { id: 3, reason: 'Misleading information', icon: 'bi-info-circle', color: '#f59e0b' },
    { id: 4, reason: 'Duplicate listing', icon: 'bi-files', color: '#6c757d' },
    { id: 5, reason: 'Invalid quantity/unit', icon: 'bi-box', color: '#6c757d' },
    { id: 6, reason: 'Missing required details', icon: 'bi-file-text', color: '#6c757d' },
    { id: 7, reason: 'Prohibited item', icon: 'bi-x-octagon', color: '#dc2626' },
    { id: 8, reason: 'Terms violation', icon: 'bi-shield-exclamation', color: '#dc2626' }
  ]

  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
    activeListings: 0,
    pendingApproval: 0,
    totalListings: 0,
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    successRate: 0,
    monthlyGrowth: 0
  })
  const [trendData, setTrendData] = useState({
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    transactions: [0, 0, 0, 0],
    completion: [0, 0, 0, 0]
  })

  useEffect(() => {
    fetchData()
    fetchEmailSettings()
    
    const subscription = supabase
      .channel('barter_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'barter_listings' },
        () => fetchData()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'barter_requests' },
        () => fetchData()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [listingFilter])

  const fetchEmailSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['enable_notifications', 'smtp_host', 'smtp_user', 'smtp_password'])
      
      if (!error && data) {
        const settingsMap = {}
        data.forEach(setting => {
          settingsMap[setting.setting_key] = setting.setting_value === 'true' || setting.setting_value === true
        })
        setEmailSettings(settingsMap)
      }
    } catch (err) {
      console.error('Error fetching email settings:', err)
    }
  }

  const sendEmailNotification = async (type, recipient, data) => {
    if (!emailSettings.enable_notifications) {
      console.log('Email notifications are disabled')
      return false
    }

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          to: recipient,
          data
        })
      })
      
      const result = await response.json()
      return result.success
    } catch (error) {
      console.error('Failed to send email:', error)
      return false
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const { data: listingsData, error: listingsError } = await supabase
        .from('barter_listings')
        .select(`
          *,
          users!barter_listings_user_id_fkey (
            user_id,
            full_name,
            email,
            profile_image,
            phone_number,
            district
          )
        `)
        .order('created_at', { ascending: false })

      if (!listingsError && listingsData) {
        setBarterListings(listingsData)
        
        const pending = listingsData.filter(l => l.status === 'PENDING_APPROVAL')
        setPendingListings(pending)
        
        let filtered = [...listingsData]
        if (listingFilter === 'pending') {
          filtered = filtered.filter(l => l.status === 'PENDING_APPROVAL')
        } else if (listingFilter === 'active') {
          filtered = filtered.filter(l => l.status === 'ACTIVE')
        } else if (listingFilter === 'completed') {
          filtered = filtered.filter(l => l.status === 'COMPLETED')
        } else if (listingFilter === 'rejected') {
          filtered = filtered.filter(l => l.status === 'REJECTED')
        } else if (listingFilter === 'cancelled') {
          filtered = filtered.filter(l => l.status === 'CANCELLED')
        }
        setFilteredListings(filtered)
      }

      const { data: requestsData, error: requestsError } = await supabase
        .from('barter_requests')
        .select(`
          *,
          requester:users!barter_requests_requester_id_fkey (
            user_id,
            full_name,
            email,
            profile_image,
            phone_number
          ),
          listing:barter_listings!barter_requests_listing_id_fkey (
            listing_id,
            title,
            description,
            quantity,
            unit,
            status,
            image_url,
            user_id,
            owner:users!barter_listings_user_id_fkey (
              full_name,
              email
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (!requestsError && requestsData) {
        setBarterRequests(requestsData)
      }

      calculateStatsFromData(listingsData || [], requestsData || [])
      calculateTrendsFromListings(listingsData || [])
      
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStatsFromData = (listingsData, requestsData) => {
    const activeListings = listingsData.filter(l => l.status === 'ACTIVE').length
    const pendingApproval = listingsData.filter(l => l.status === 'PENDING_APPROVAL').length
    const totalListings = listingsData.length
    const totalRequests = requestsData.length
    const pendingRequests = requestsData.filter(r => r.request_status === 'PENDING').length
    const approvedRequests = requestsData.filter(r => r.request_status === 'APPROVED').length
    const rejectedRequests = requestsData.filter(r => r.request_status === 'REJECTED').length
    
    const completed = requestsData.filter(r => r.request_status === 'COMPLETED').length
    const pending = requestsData.filter(r => r.request_status === 'PENDING').length
    const cancelled = requestsData.filter(r => r.request_status === 'CANCELLED' || r.request_status === 'REJECTED').length
    const total = completed + pending + cancelled
    
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0
    
    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    
    const recentRequests = requestsData.filter(r => new Date(r.created_at) >= thirtyDaysAgo)
    const previousRequests = requestsData.filter(r => 
      new Date(r.created_at) >= sixtyDaysAgo && new Date(r.created_at) < thirtyDaysAgo
    )
    
    const monthlyGrowth = previousRequests.length > 0 
      ? Math.round(((recentRequests.length - previousRequests.length) / previousRequests.length) * 100)
      : 0

    setStats({
      total,
      completed,
      pending,
      cancelled,
      activeListings,
      pendingApproval,
      totalListings,
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      successRate,
      monthlyGrowth
    })
  }

  const calculateTrendsFromListings = (listingsData) => {
    const weeks = [
      { name: 'Week 1', count: 0, completed: 0 },
      { name: 'Week 2', count: 0, completed: 0 },
      { name: 'Week 3', count: 0, completed: 0 },
      { name: 'Week 4', count: 0, completed: 0 }
    ]
    
    const now = new Date()
    
    listingsData.forEach(listing => {
      const daysSince = Math.floor((now - new Date(listing.created_at)) / (1000 * 60 * 60 * 24))
      const weekIndex = Math.floor(daysSince / 7)
      
      if (weekIndex >= 0 && weekIndex < 4) {
        weeks[3 - weekIndex].count++
        if (listing.status === 'COMPLETED') {
          weeks[3 - weekIndex].completed++
        }
      }
    })
    
    setTrendData({
      labels: weeks.map(w => w.name),
      transactions: weeks.map(w => w.count),
      completion: weeks.map(w => w.count > 0 ? Math.round((w.completed / w.count) * 100) : 0)
    })
  }

  const approveListing = async () => {
    setActionLoading(true)
    
    const { error } = await supabase
      .from('barter_listings')
      .update({ 
        status: 'ACTIVE',
        approved_at: new Date().toISOString(),
        approved_by: JSON.parse(localStorage.getItem('adminSession'))?.admin?.admin_id
      })
      .eq('listing_id', selectedListing.listing_id)

    if (!error) {
      // Send email notification to user
      if (selectedListing.users?.email) {
        await sendEmailNotification('barter_approved', selectedListing.users.email, {
          userName: selectedListing.users.full_name,
          title: selectedListing.title,
          quantity: selectedListing.quantity,
          unit: selectedListing.unit,
          description: selectedListing.description,
          approvedAt: new Date().toISOString()
        })
      }
      
      fetchData()
      setShowApprovalModal(false)
      setSelectedListing(null)
      alert('Listing approved successfully! Email notification sent to user.')
    } else {
      alert('Error approving listing: ' + error.message)
    }
    setActionLoading(false)
  }

  const rejectListing = async () => {
    const finalReason = customReason || rejectReason
    if (!finalReason) {
      alert('Please select a reason for rejection')
      return
    }
    
    setActionLoading(true)
    
    const { error } = await supabase
      .from('barter_listings')
      .update({ 
        status: 'REJECTED',
        rejection_reason: finalReason,
        rejected_at: new Date().toISOString(),
        rejected_by: JSON.parse(localStorage.getItem('adminSession'))?.admin?.admin_id
      })
      .eq('listing_id', selectedListing.listing_id)

    if (!error) {
      // Send email notification to user
      if (selectedListing.users?.email) {
        await sendEmailNotification('barter_rejected', selectedListing.users.email, {
          userName: selectedListing.users.full_name,
          title: selectedListing.title,
          reason: finalReason,
          rejectedAt: new Date().toISOString()
        })
      }
      
      fetchData()
      setShowApprovalModal(false)
      setSelectedListing(null)
      setRejectReason('')
      setCustomReason('')
      alert('Listing rejected successfully! Email notification sent to user.')
    } else {
      alert('Error rejecting listing: ' + error.message)
    }
    setActionLoading(false)
  }

  const openApprovalModal = (listing) => {
    setSelectedListing(listing)
    setShowApprovalModal(true)
    setRejectReason('')
    setCustomReason('')
  }

  const viewFullDetails = (listing) => {
    setSelectedTransaction(listing)
    setShowDetailsModal(true)
  }

  const viewImage = (imageUrl) => {
    setSelectedImage(imageUrl)
    setShowImageModal(true)
  }

  const viewRequests = async (listingId) => {
    const { data: requests, error } = await supabase
      .from('barter_requests')
      .select(`
        *,
        requester:users!barter_requests_requester_id_fkey (
          user_id,
          full_name,
          email,
          profile_image,
          phone_number,
          district
        )
      `)
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })

    if (!error && requests) {
      setSelectedRequests(requests)
      setShowRequestModal(true)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      'PENDING_APPROVAL': <span className="status-badge pending-approval"><i className="bi bi-clock-history"></i> Pending Approval</span>,
      'ACTIVE': <span className="status-badge active"><i className="bi bi-check-circle-fill"></i> Active</span>,
      'REJECTED': <span className="status-badge rejected"><i className="bi bi-x-circle-fill"></i> Rejected</span>,
      'COMPLETED': <span className="status-badge completed"><i className="bi bi-check-circle-fill"></i> Completed</span>,
      'CANCELLED': <span className="status-badge cancelled"><i className="bi bi-x-circle-fill"></i> Cancelled</span>
    }
    return badges[status] || <span className="status-badge default">{status}</span>
  }

  const getRequestStatusBadge = (status) => {
    const badges = {
      'PENDING': <span className="status-badge pending"><i className="bi bi-clock-fill"></i> Pending</span>,
      'APPROVED': <span className="status-badge approved"><i className="bi bi-check-circle-fill"></i> Approved</span>,
      'REJECTED': <span className="status-badge rejected"><i className="bi bi-x-circle-fill"></i> Rejected</span>,
      'COMPLETED': <span className="status-badge completed"><i className="bi bi-check-circle-fill"></i> Completed</span>,
      'CANCELLED': <span className="status-badge cancelled"><i className="bi bi-x-circle-fill"></i> Cancelled</span>
    }
    return badges[status] || <span className="status-badge default">{status}</span>
  }

  const transactionsChart = {
    labels: trendData.labels,
    datasets: [{
      label: 'New Listings',
      data: trendData.transactions,
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

  const completionChart = {
    labels: trendData.labels,
    datasets: [{
      label: 'Completion Rate (%)',
      data: trendData.completion,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#10b981',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6
    }]
  }

  const distributionChart = {
    labels: ['Active Listings', 'Pending Approval', 'Completed', 'Rejected/Cancelled'],
    datasets: [{
      data: [stats.activeListings, stats.pendingApproval, stats.completed, stats.cancelled],
      backgroundColor: ['#4f46e5', '#f59e0b', '#10b981', '#ef4444'],
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

  const doughnutOptions = {
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
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Barter System">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading barter data...</p>
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
    <AdminLayout title="Barter System">
      <div className="barter-container">
        {/* Header */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="bi bi-arrow-left-right"></i>
            </div>
            <div>
              <h1 className="header-title">Barter System</h1>
              <p className="header-subtitle">Manage barter listings with approval workflow</p>
            </div>
          </div>
          <div className="header-actions">
            {emailSettings.enable_notifications && (
              <div className="email-badge">
                <i className="bi bi-envelope-fill"></i>
                Email Notifications Active
              </div>
            )}
            <button className="refresh-btn" onClick={fetchData}>
              <i className="bi bi-arrow-repeat"></i> Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card pending-approval">
            <div className="stat-icon"><i className="bi bi-clock-history"></i></div>
            <div className="stat-info">
              <span className="stat-label">Pending Approval</span>
              <h2 className="stat-value text-warning">{stats.pendingApproval}</h2>
              <span className="stat-change">Awaiting review</span>
            </div>
          </div>
          <div className="stat-card active">
            <div className="stat-icon"><i className="bi bi-check-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Active Listings</span>
              <h2 className="stat-value text-success">{stats.activeListings}</h2>
              <span className="stat-change">Live trades</span>
            </div>
          </div>
          <div className="stat-card completed">
            <div className="stat-icon"><i className="bi bi-check-circle-fill"></i></div>
            <div className="stat-info">
              <span className="stat-label">Completed</span>
              <h2 className="stat-value text-success">{stats.completed.toLocaleString()}</h2>
              <span className="stat-change">{stats.successRate}% success rate</span>
            </div>
          </div>
          <div className="stat-card cancelled">
            <div className="stat-icon"><i className="bi bi-x-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Rejected/Cancelled</span>
              <h2 className="stat-value text-danger">{stats.cancelled.toLocaleString()}</h2>
              <span className="stat-change">Failed trades</span>
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="secondary-stats">
          <div className="secondary-card">
            <div className="secondary-icon"><i className="bi bi-chat-dots"></i></div>
            <div className="secondary-info">
              <span className="secondary-label">Total Requests</span>
              <strong className="secondary-value">{stats.totalRequests}</strong>
            </div>
          </div>
          <div className="secondary-card">
            <div className="secondary-icon"><i className="bi bi-hourglass-split"></i></div>
            <div className="secondary-info">
              <span className="secondary-label">Pending Requests</span>
              <strong className="secondary-value text-warning">{stats.pendingRequests}</strong>
            </div>
          </div>
          <div className="secondary-card">
            <div className="secondary-icon"><i className="bi bi-check-circle"></i></div>
            <div className="secondary-info">
              <span className="secondary-label">Approved Requests</span>
              <strong className="secondary-value text-success">{stats.approvedRequests}</strong>
            </div>
          </div>
          <div className="secondary-card">
            <div className="secondary-icon"><i className="bi bi-x-circle"></i></div>
            <div className="secondary-info">
              <span className="secondary-label">Rejected Requests</span>
              <strong className="secondary-value text-danger">{stats.rejectedRequests}</strong>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-section">
          <div className="chart-card">
            <div className="chart-header">
              <h5>📈 Listing Trends</h5>
              <p>New barter listings over the last 4 weeks</p>
            </div>
            <div className="chart-body">
              <Line data={transactionsChart} options={chartOptions} />
            </div>
          </div>
          <div className="chart-card">
            <div className="chart-header">
              <h5>📊 Completion Rate</h5>
              <p>Success rate of barter transactions (%)</p>
            </div>
            <div className="chart-body">
              <Line data={completionChart} options={chartOptions} />
            </div>
          </div>
          <div className="chart-card">
            <div className="chart-header">
              <h5>🥧 Distribution</h5>
              <p>Overview of barter activity</p>
            </div>
            <div className="chart-body">
              <Doughnut data={distributionChart} options={doughnutOptions} />
            </div>
          </div>
        </div>

        {/* Barter Listings with Filter */}
        <div className="listings-section">
          <div className="section-header">
            <h5><i className="bi bi-box-seam me-2"></i> Barter Listings</h5>
            <div className="filter-buttons">
              <button className={`filter-btn ${listingFilter === 'all' ? 'active' : ''}`} onClick={() => setListingFilter('all')}>
                All ({barterListings.length})
              </button>
              <button className={`filter-btn ${listingFilter === 'pending' ? 'active' : ''}`} onClick={() => setListingFilter('pending')}>
                Pending ({stats.pendingApproval})
              </button>
              <button className={`filter-btn ${listingFilter === 'active' ? 'active' : ''}`} onClick={() => setListingFilter('active')}>
                Active ({stats.activeListings})
              </button>
              <button className={`filter-btn ${listingFilter === 'completed' ? 'active' : ''}`} onClick={() => setListingFilter('completed')}>
                Completed ({barterListings.filter(l => l.status === 'COMPLETED').length})
              </button>
              <button className={`filter-btn ${listingFilter === 'rejected' ? 'active' : ''}`} onClick={() => setListingFilter('rejected')}>
                Rejected ({barterListings.filter(l => l.status === 'REJECTED').length})
              </button>
            </div>
          </div>
          <div className="listings-grid">
            {filteredListings.length > 0 ? (
              filteredListings.slice(0, 6).map((listing) => (
                <div key={listing.listing_id} className="listing-card">
                  <div className="listing-header">
                    <div className="listing-user">
                      <div className="user-avatar">
                        {listing.users?.profile_image ? (
                          <img src={listing.users.profile_image} alt={listing.users.full_name} />
                        ) : (
                          <span>{listing.users?.full_name?.charAt(0) || 'U'}</span>
                        )}
                      </div>
                      <div className="user-info">
                        <div className="user-name">{listing.users?.full_name || 'Anonymous'}</div>
                        <div className="listing-date">{new Date(listing.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    {getStatusBadge(listing.status)}
                  </div>
                  <div className="listing-body">
                    <h6 className="listing-title">{listing.title}</h6>
                    <p className="listing-description">{listing.description?.substring(0, 80)}...</p>
                    <div className="listing-details">
                      <span className="detail-item">
                        <i className="bi bi-box"></i>
                        {listing.quantity} {listing.unit}
                      </span>
                      <span className="detail-item">
                        <i className="bi bi-geo-alt"></i>
                        {listing.users?.district || 'Location not specified'}
                      </span>
                    </div>
                    {listing.rejection_reason && (
                      <div className="rejection-reason">
                        <i className="bi bi-exclamation-triangle-fill"></i>
                        Rejected: {listing.rejection_reason}
                      </div>
                    )}
                  </div>
                  <div className="listing-footer">
                    {listing.status === 'PENDING_APPROVAL' ? (
                      <div className="approval-buttons">
                        <button className="btn-approve" onClick={() => openApprovalModal(listing)}>
                          <i className="bi bi-check-lg"></i> Approve
                        </button>
                        <button className="btn-reject" onClick={() => openApprovalModal(listing)}>
                          <i className="bi bi-x-lg"></i> Reject
                        </button>
                        <button className="btn-view" onClick={() => viewFullDetails(listing)}>
                          <i className="bi bi-eye"></i> Details
                        </button>
                      </div>
                    ) : (
                      <div className="action-buttons">
                        <button className="btn-view-listing" onClick={() => viewFullDetails(listing)}>
                          <i className="bi bi-eye"></i> View Details
                        </button>
                        {listing.status === 'ACTIVE' && (
                          <button className="btn-view-requests" onClick={() => viewRequests(listing.listing_id)}>
                            <i className="bi bi-chat-dots"></i> Requests ({barterRequests.filter(r => r.listing_id === listing.listing_id).length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <i className="bi bi-inbox"></i>
                <h4>No Listings Found</h4>
                <p>No {listingFilter === 'all' ? '' : listingFilter} listings available.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Barter Requests */}
        <div className="requests-section">
          <div className="section-header">
            <h5><i className="bi bi-chat-dots me-2"></i> Recent Barter Requests</h5>
            <span className="section-badge">{barterRequests.length} total</span>
          </div>
          <div className="requests-list">
            {barterRequests.slice(0, 10).map((request) => (
              <div key={request.request_id} className="request-item">
                <div className="request-info">
                  <div className="requester">
                    <i className="bi bi-person-circle"></i>
                    <span>{request.requester?.full_name || 'Anonymous'}</span>
                  </div>
                  <div className="request-details">
                    <span className="offered-item">
                      <i className="bi bi-box"></i>
                      Offered: {request.offered_item}
                    </span>
                    <span className="listing-title">
                      <i className="bi bi-tag"></i>
                      For: {request.listing?.title}
                    </span>
                  </div>
                  <div className="request-time">
                    <i className="bi bi-calendar3"></i>
                    {new Date(request.created_at).toLocaleString()}
                  </div>
                </div>
                {getRequestStatusBadge(request.request_status)}
              </div>
            ))}
            {barterRequests.length === 0 && (
              <div className="empty-state-small">
                <i className="bi bi-chat-dots"></i>
                <p>No barter requests yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval/Rejection Modal */}
      {showApprovalModal && selectedListing && (
        <div className="modal-overlay" onClick={() => setShowApprovalModal(false)}>
          <div className="modal-container modal-approval" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header warning">
              <div className="modal-icon">
                <i className="bi bi-shield-check"></i>
              </div>
              <h3>Review Barter Listing</h3>
              <button className="modal-close" onClick={() => setShowApprovalModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="listing-summary">
                <h4>{selectedListing.title}</h4>
                <p>{selectedListing.description}</p>
                <div className="summary-details">
                  <span><i className="bi bi-box"></i> {selectedListing.quantity} {selectedListing.unit}</span>
                  <span><i className="bi bi-person"></i> {selectedListing.users?.full_name}</span>
                </div>
              </div>

              {!rejectReason && !customReason ? (
                <div className="approval-section">
                  <p className="mb-3">Would you like to approve or reject this listing?</p>
                  <div className="approval-buttons-modal">
                    <button className="btn-approve-modal" onClick={approveListing} disabled={actionLoading}>
                      <i className="bi bi-check-lg"></i> Approve Listing
                    </button>
                    <button className="btn-reject-modal" onClick={() => {}}>
                      <i className="bi bi-x-lg"></i> Reject with Reason
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rejection-section">
                  <label className="form-label">Select rejection reason:</label>
                  <div className="quick-reasons">
                    {quickReasons.map((reason) => (
                      <button
                        key={reason.id}
                        className={`quick-reason-btn ${rejectReason === reason.reason ? 'selected' : ''}`}
                        onClick={() => {
                          setRejectReason(reason.reason)
                          setCustomReason('')
                        }}
                      >
                        <i className={`bi ${reason.icon}`}></i>
                        <span>{reason.reason}</span>
                      </button>
                    ))}
                  </div>
                  <div className="custom-reason">
                    <label className="form-label">Or provide custom reason:</label>
                    <textarea
                      className="form-textarea"
                      rows="3"
                      placeholder="Enter custom rejection reason..."
                      value={customReason}
                      onChange={(e) => {
                        setCustomReason(e.target.value)
                        setRejectReason('')
                      }}
                    />
                  </div>
                </div>
              )}

              {(rejectReason || customReason) && (
                <div className="modal-footer">
                  <button className="btn-secondary" onClick={() => {
                    setRejectReason('')
                    setCustomReason('')
                  }}>Back</button>
                  <button className="btn-primary danger" onClick={rejectListing} disabled={actionLoading}>
                    {actionLoading ? (
                      <><span className="spinner-border spinner-border-sm me-2"></span>Rejecting...</>
                    ) : (
                      'Confirm Rejection'
                    )}
                  </button>
                </div>
              )}
            </div>
            {!rejectReason && !customReason && (
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setShowApprovalModal(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Details Modal */}
      {showDetailsModal && selectedTransaction && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header info">
              <div className="modal-icon"><i className="bi bi-info-circle-fill"></i></div>
              <h3>Complete Barter Details</h3>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="modal-body">
              {selectedTransaction.image_url && (
                <div className="image-section">
                  <div className="image-container" onClick={() => viewImage(selectedTransaction.image_url)}>
                    <img src={selectedTransaction.image_url} alt={selectedTransaction.title} />
                    <div className="image-overlay"><i className="bi bi-zoom-in"></i><span>Click to enlarge</span></div>
                  </div>
                </div>
              )}
              <div className="details-card">
                <h4><i className="bi bi-box-seam"></i> Listing Information</h4>
                <div className="details-grid">
                  <div className="detail-item"><label>Title</label><div className="value">{selectedTransaction.title}</div></div>
                  <div className="detail-item"><label>Status</label><div className="value">{getStatusBadge(selectedTransaction.status)}</div></div>
                  <div className="detail-item"><label>Quantity</label><div className="value">{selectedTransaction.quantity} {selectedTransaction.unit}</div></div>
                  <div className="detail-item"><label>Created Date</label><div className="value">{new Date(selectedTransaction.created_at).toLocaleString()}</div></div>
                  <div className="detail-item full-width"><label>Description</label><div className="value description">{selectedTransaction.description || 'No description provided'}</div></div>
                  {selectedTransaction.rejection_reason && (
                    <div className="detail-item full-width"><label>Rejection Reason</label><div className="value rejection-box">{selectedTransaction.rejection_reason}</div></div>
                  )}
                </div>
              </div>
              <div className="details-card">
                <h4><i className="bi bi-person-badge"></i> Seller Information</h4>
                <div className="seller-info">
                  <div className="seller-avatar">
                    {selectedTransaction.users?.profile_image ? (
                      <img src={selectedTransaction.users.profile_image} alt={selectedTransaction.users.full_name} />
                    ) : (
                      <span>{selectedTransaction.users?.full_name?.charAt(0) || 'U'}</span>
                    )}
                  </div>
                  <div className="seller-details">
                    <div><strong>Name:</strong> {selectedTransaction.users?.full_name || 'Anonymous'}</div>
                    <div><strong>Email:</strong> {selectedTransaction.users?.email || 'Not provided'}</div>
                    <div><strong>Phone:</strong> {selectedTransaction.users?.phone_number || 'Not provided'}</div>
                    <div><strong>District:</strong> {selectedTransaction.users?.district || 'Not specified'}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
              {selectedTransaction.status === 'PENDING_APPROVAL' && (
                <button className="btn-primary" onClick={() => {
                  setShowDetailsModal(false)
                  openApprovalModal(selectedTransaction)
                }}>Review Listing</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && (
        <div className="modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="modal-container modal-image" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon"><i className="bi bi-image-fill"></i></div>
              <h3>Product Image</h3>
              <button className="modal-close" onClick={() => setShowImageModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="modal-body image-modal-body">
              <img src={selectedImage} alt="Barter Listing" />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowImageModal(false)}>Close</button>
              <a href={selectedImage} download className="btn-primary" target="_blank" rel="noopener noreferrer">
                <i className="bi bi-download"></i> Download
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Requests Modal */}
      {showRequestModal && (
        <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header info">
              <div className="modal-icon"><i className="bi bi-chat-dots-fill"></i></div>
              <h3>Barter Requests</h3>
              <button className="modal-close" onClick={() => setShowRequestModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="modal-body">
              {selectedRequests.map((request) => (
                <div key={request.request_id} className="request-detail-card">
                  <div className="request-header">
                    <div className="requester-info">
                      <div className="requester-avatar">
                        {request.requester?.profile_image ? (
                          <img src={request.requester.profile_image} alt={request.requester.full_name} />
                        ) : (
                          <span>{request.requester?.full_name?.charAt(0) || 'U'}</span>
                        )}
                      </div>
                      <div>
                        <div className="requester-name">{request.requester?.full_name || 'Anonymous'}</div>
                        <div className="requester-contact">{request.requester?.email} | {request.requester?.phone_number || 'No phone'}</div>
                      </div>
                    </div>
                    {getRequestStatusBadge(request.request_status)}
                  </div>
                  <div className="offered-section"><strong>Offered Item:</strong> {request.offered_item}</div>
                  <div className="request-footer">
                    <div className="request-date"><i className="bi bi-calendar3"></i>{new Date(request.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRequestModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .barter-container { max-width: 1400px; margin: 0 auto; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; flex-wrap: wrap; gap: 16px; }
        .header-content { display: flex; align-items: center; gap: 20px; }
        .header-icon { width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; display: flex; align-items: center; justify-content: center; }
        .header-icon i { font-size: 28px; color: white; }
        .header-title { font-size: 24px; font-weight: 700; color: #1f2937; margin: 0 0 4px 0; }
        .header-subtitle { color: #6c757d; margin: 0; font-size: 14px; }
        .header-actions { display: flex; gap: 12px; align-items: center; }
        .email-badge { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: rgba(16,185,129,0.1); color: #10b981; border-radius: 12px; font-size: 13px; font-weight: 500; }
        .refresh-btn { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; color: #495057; font-weight: 500; transition: all 0.3s ease; }
        .refresh-btn:hover { background: #e9ecef; transform: translateY(-1px); }
        
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; }
        .stat-card { background: white; border-radius: 20px; padding: 20px; display: flex; align-items: center; gap: 16px; transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); }
        .stat-card.pending-approval .stat-icon { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .stat-card.active .stat-icon { background: rgba(16,185,129,0.1); color: #10b981; }
        .stat-card.completed .stat-icon { background: rgba(16,185,129,0.1); color: #10b981; }
        .stat-card.cancelled .stat-icon { background: rgba(239,68,68,0.1); color: #ef4444; }
        .stat-icon { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
        .stat-icon i { font-size: 24px; }
        .stat-info { flex: 1; }
        .stat-label { font-size: 13px; color: #6c757d; margin-bottom: 4px; display: block; }
        .stat-value { font-size: 28px; font-weight: 700; margin: 0; color: #1f2937; }
        .text-warning { color: #f59e0b; }
        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }
        
        .secondary-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 28px; }
        .secondary-card { background: white; border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 12px; transition: all 0.3s ease; }
        .secondary-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); }
        .secondary-icon { width: 44px; height: 44px; background: #f8f9fa; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #4f46e5; }
        .secondary-icon i { font-size: 22px; }
        .secondary-info { flex: 1; }
        .secondary-label { font-size: 11px; color: #6c757d; display: block; }
        .secondary-value { font-size: 18px; font-weight: 700; color: #1f2937; }
        
        .charts-section { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 28px; }
        .chart-card { background: white; border-radius: 20px; padding: 20px; transition: all 0.3s ease; }
        .chart-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .chart-header { margin-bottom: 20px; }
        .chart-header h5 { font-size: 16px; font-weight: 600; margin: 0 0 4px 0; color: #1f2937; }
        .chart-header p { font-size: 12px; color: #6c757d; margin: 0; }
        .chart-body { height: 250px; }
        
        .listings-section { background: white; border-radius: 24px; padding: 20px; margin-bottom: 28px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
        .filter-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
        .filter-btn { padding: 6px 16px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 20px; font-size: 12px; cursor: pointer; transition: all 0.3s ease; }
        .filter-btn.active { background: #4f46e5; color: white; border-color: #4f46e5; }
        
        .listings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
        .listing-card { background: #f8f9fa; border-radius: 16px; overflow: hidden; transition: all 0.3s ease; }
        .listing-card:hover { transform: translateY(-4px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
        .listing-header { padding: 16px; background: white; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center; }
        .listing-user { display: flex; align-items: center; gap: 12px; }
        .user-avatar { width: 40px; height: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; overflow: hidden; }
        .user-name { font-weight: 600; color: #1f2937; font-size: 14px; }
        .listing-date { font-size: 10px; color: #9ca3af; }
        
        .status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
        .status-badge.pending-approval { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .status-badge.active { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-badge.rejected { background: rgba(239,68,68,0.1); color: #ef4444; }
        .status-badge.completed { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-badge.cancelled { background: rgba(239,68,68,0.1); color: #ef4444; }
        .status-badge.pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .status-badge.approved { background: rgba(16,185,129,0.1); color: #10b981; }
        
        .listing-body { padding: 16px; }
        .listing-title { font-size: 16px; font-weight: 600; margin: 0 0 8px 0; color: #1f2937; }
        .listing-description { font-size: 12px; color: #6c757d; margin: 0 0 12px 0; line-height: 1.4; }
        .listing-details { display: flex; gap: 16px; font-size: 11px; color: #9ca3af; }
        .rejection-reason { background: #fee2e2; padding: 8px 12px; border-radius: 8px; font-size: 11px; color: #991b1b; margin-top: 8px; display: flex; align-items: center; gap: 6px; }
        
        .listing-footer { padding: 12px 16px; border-top: 1px solid #e9ecef; display: flex; gap: 8px; }
        .approval-buttons { display: flex; gap: 8px; width: 100%; }
        .action-buttons { display: flex; gap: 8px; width: 100%; }
        .btn-approve, .btn-reject, .btn-view, .btn-view-listing, .btn-view-requests { flex: 1; padding: 8px 12px; border: none; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; }
        .btn-approve { background: rgba(16,185,129,0.1); color: #10b981; }
        .btn-approve:hover { background: #10b981; color: white; }
        .btn-reject { background: rgba(239,68,68,0.1); color: #ef4444; }
        .btn-reject:hover { background: #ef4444; color: white; }
        .btn-view, .btn-view-listing { background: rgba(79,70,229,0.1); color: #4f46e5; }
        .btn-view:hover, .btn-view-listing:hover { background: #4f46e5; color: white; }
        .btn-view-requests { background: rgba(16,185,129,0.1); color: #10b981; }
        .btn-view-requests:hover { background: #10b981; color: white; }
        
        .requests-section { background: white; border-radius: 24px; padding: 20px; margin-bottom: 28px; }
        .requests-list { max-height: 400px; overflow-y: auto; }
        .request-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #e9ecef; transition: all 0.3s ease; }
        .request-item:hover { background: #f8f9fa; }
        .request-info { flex: 1; }
        .requester { font-size: 13px; font-weight: 600; color: #1f2937; margin-bottom: 4px; }
        .request-details { display: flex; gap: 16px; font-size: 11px; color: #6c757d; margin-bottom: 4px; flex-wrap: wrap; }
        .request-time { font-size: 10px; color: #9ca3af; }
        
        .empty-state { text-align: center; padding: 60px 20px; grid-column: span 3; }
        .empty-state i { font-size: 48px; color: #cbd5e1; margin-bottom: 16px; display: block; }
        .empty-state-small { text-align: center; padding: 40px 20px; color: #9ca3af; }
        
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1100; animation: fadeIn 0.2s ease; }
        .modal-container { background: white; border-radius: 24px; width: 90%; max-width: 550px; animation: slideUp 0.3s ease; overflow: hidden; }
        .modal-container.modal-lg { max-width: 800px; }
        .modal-container.modal-image { max-width: 800px; }
        .modal-container.modal-approval { max-width: 500px; }
        
        .modal-header { padding: 24px 24px 16px; display: flex; align-items: center; gap: 12px; position: relative; border-bottom: 1px solid #e9ecef; }
        .modal-header.warning .modal-icon { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .modal-header.info .modal-icon { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .modal-icon { width: 48px; height: 48px; border-radius: 24px; display: flex; align-items: center; justify-content: center; }
        .modal-icon i { font-size: 24px; }
        .modal-header h3 { margin: 0; font-size: 18px; font-weight: 600; }
        .modal-close { position: absolute; right: 20px; top: 20px; background: none; border: none; font-size: 18px; cursor: pointer; color: #9ca3af; }
        
        .modal-body { padding: 24px; max-height: 70vh; overflow-y: auto; }
        .listing-summary { background: #f8f9fa; padding: 16px; border-radius: 12px; margin-bottom: 20px; }
        .listing-summary h4 { margin: 0 0 8px 0; color: #1f2937; }
        .listing-summary p { margin: 0 0 12px 0; color: #6c757d; font-size: 13px; }
        .summary-details { display: flex; gap: 16px; font-size: 12px; color: #9ca3af; }
        
        .approval-section { text-align: center; padding: 20px 0; }
        .approval-buttons-modal { display: flex; gap: 16px; justify-content: center; margin-top: 20px; }
        .btn-approve-modal { padding: 12px 24px; background: #10b981; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; }
        .btn-reject-modal { padding: 12px 24px; background: #ef4444; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; }
        
        .quick-reasons { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
        .quick-reason-btn { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 10px; cursor: pointer; transition: all 0.3s ease; width: 100%; }
        .quick-reason-btn:hover { background: #e9ecef; }
        .quick-reason-btn.selected { background: #fef3c7; border-color: #f59e0b; }
        .custom-reason { margin-top: 20px; }
        .form-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #374151; }
        .form-textarea { width: 100%; padding: 12px; border: 2px solid #e9ecef; border-radius: 12px; font-size: 14px; resize: vertical; }
        
        .image-section { margin-bottom: 24px; text-align: center; }
        .image-container { position: relative; display: inline-block; max-width: 100%; cursor: pointer; border-radius: 12px; overflow: hidden; }
        .image-container img { max-width: 100%; max-height: 300px; border-radius: 12px; transition: transform 0.3s ease; }
        .image-container:hover img { transform: scale(1.05); }
        .image-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease; color: white; }
        .image-container:hover .image-overlay { opacity: 1; }
        .image-overlay i { font-size: 32px; margin-bottom: 8px; }
        .image-modal-body { text-align: center; padding: 20px; }
        .image-modal-body img { max-width: 100%; max-height: 70vh; border-radius: 8px; }
        
        .details-card { background: #f8f9fa; border-radius: 16px; padding: 20px; margin-bottom: 20px; }
        .details-card h4 { font-size: 16px; font-weight: 600; margin: 0 0 16px 0; color: #1f2937; }
        .details-card h4 i { margin-right: 8px; color: #4f46e5; }
        .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .detail-item.full-width { grid-column: span 2; }
        .detail-item label { font-size: 11px; font-weight: 600; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; display: block; }
        .detail-item .value { font-size: 14px; color: #1f2937; }
        .rejection-box { background: #fee2e2; padding: 12px; border-radius: 8px; color: #991b1b; }
        
        .seller-info { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
        .seller-avatar { width: 70px; height: 70px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 24px; overflow: hidden; }
        .seller-details { flex: 1; }
        .seller-details div { margin-bottom: 6px; font-size: 13px; }
        
        .request-detail-card { background: #f8f9fa; border-radius: 16px; padding: 16px; margin-bottom: 16px; }
        .request-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 12px; }
        .requester-info { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .requester-avatar { width: 44px; height: 44px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; overflow: hidden; }
        .requester-name { font-weight: 600; color: #1f2937; }
        .requester-contact { font-size: 11px; color: #6c757d; }
        .offered-section { margin-bottom: 12px; padding: 8px 12px; background: white; border-radius: 8px; font-size: 13px; }
        .request-date { font-size: 11px; color: #9ca3af; }
        
        .modal-footer { padding: 16px 24px 24px; display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid #e9ecef; }
        .btn-secondary { padding: 10px 20px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 10px; cursor: pointer; font-weight: 500; }
        .btn-primary { padding: 10px 24px; background: #4f46e5; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; }
        .btn-primary.danger { background: #ef4444; }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        @media (max-width: 1200px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .secondary-stats { grid-template-columns: repeat(2, 1fr); }
          .charts-section { grid-template-columns: 1fr; }
          .listings-grid { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
          .quick-reasons { grid-template-columns: 1fr; }
        }
        
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: 1fr; }
          .secondary-stats { grid-template-columns: 1fr; }
          .charts-section { grid-template-columns: 1fr; }
          .page-header { flex-direction: column; align-items: flex-start; }
          .listings-grid { grid-template-columns: 1fr; }
          .details-grid { grid-template-columns: 1fr; }
          .detail-item.full-width { grid-column: span 1; }
          .seller-info { flex-direction: column; text-align: center; }
          .filter-buttons { width: 100%; }
          .filter-btn { flex: 1; text-align: center; }
          .approval-buttons-modal { flex-direction: column; }
        }
      `}</style>
    </AdminLayout>
  )
}