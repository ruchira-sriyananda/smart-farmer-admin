import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function BarterTransactions() {
  const router = useRouter()
  const [transactions, setTransactions] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [dateRange, setDateRange] = useState('month')
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
    activeListings: 0,
    totalValue: 0,
    successRate: 0
  })
  const [selectedListing, setSelectedListing] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    fetchBarterData()
    
    const subscription = supabase
      .channel('barter_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'barter_listings' },
        () => fetchBarterData()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [filter, dateRange])

  const fetchBarterData = async () => {
    try {
      setLoading(true)
      
      // Calculate date range
      const now = new Date()
      let startDate = new Date()
      if (dateRange === 'week') startDate.setDate(startDate.getDate() - 7)
      if (dateRange === 'month') startDate.setMonth(startDate.getMonth() - 1)
      if (dateRange === 'year') startDate.setFullYear(startDate.getFullYear() - 1)
      if (dateRange === 'all') startDate = new Date(0)

      // Fetch barter listings with user details
      let listingsQuery = supabase
        .from('barter_listings')
        .select(`
          *,
          users!barter_listings_user_id_fkey (
            user_id,
            full_name,
            email,
            profile_image
          )
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        listingsQuery = listingsQuery.eq('status', filter.toUpperCase())
      }

      const { data: listingsData, error: listingsError } = await listingsQuery

      if (!listingsError) {
        setListings(listingsData || [])
      }

      // Fetch barter requests for statistics
      const { data: requestsData, error: requestsError } = await supabase
        .from('barter_requests')
        .select('*')
        .gte('created_at', startDate.toISOString())

      if (!requestsError && requestsData) {
        calculateStats(requestsData)
      }

      // Fetch recent barter transactions/requests
      const { data: recentRequests, error: recentError } = await supabase
        .from('barter_requests')
        .select(`
          *,
          barter_listings!barter_requests_listing_id_fkey (
            listing_id,
            title,
            description,
            quantity,
            unit,
            users!barter_listings_user_id_fkey (
              full_name,
              email
            )
          ),
          requester:users!barter_requests_requester_id_fkey (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!recentError && recentRequests) {
        setTransactions(recentRequests)
      }

    } catch (err) {
      console.error('Error fetching barter data:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (requestsData) => {
    const completed = requestsData.filter(r => r.request_status === 'COMPLETED').length
    const pending = requestsData.filter(r => r.request_status === 'PENDING').length
    const cancelled = requestsData.filter(r => r.request_status === 'CANCELLED').length
    const total = requestsData.length
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0

    setStats({
      total: total,
      completed: completed,
      pending: pending,
      cancelled: cancelled,
      activeListings: listings.filter(l => l.status === 'ACTIVE').length,
      totalValue: requestsData.reduce((sum, r) => sum + (r.quantity || 0), 0),
      successRate: successRate
    })
  }

  const updateListingStatus = async (listingId, status) => {
    const { error } = await supabase
      .from('barter_listings')
      .update({ status: status })
      .eq('listing_id', listingId)

    if (!error) {
      fetchBarterData()
    }
  }

  const updateRequestStatus = async (requestId, status) => {
    const { error } = await supabase
      .from('barter_requests')
      .update({ request_status: status })
      .eq('request_id', requestId)

    if (!error) {
      fetchBarterData()
    }
  }

  const viewListingDetails = (listing) => {
    setSelectedListing(listing)
    setShowDetailsModal(true)
  }

  const getStatusBadge = (status) => {
    const badges = {
      'ACTIVE': <span className="status-badge active"><i className="bi bi-check-circle-fill"></i> Active</span>,
      'PENDING': <span className="status-badge pending"><i className="bi bi-clock"></i> Pending</span>,
      'COMPLETED': <span className="status-badge completed"><i className="bi bi-check-circle-fill"></i> Completed</span>,
      'CANCELLED': <span className="status-badge cancelled"><i className="bi bi-x-circle-fill"></i> Cancelled</span>,
      'EXPIRED': <span className="status-badge expired"><i className="bi bi-clock-history"></i> Expired</span>
    }
    return badges[status] || <span className="status-badge default">{status}</span>
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
              <p className="header-subtitle">Manage barter listings and transactions</p>
            </div>
          </div>
          <div className="header-actions">
            <select className="filter-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="year">Last Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-icon"><i className="bi bi-box-seam"></i></div>
            <div className="stat-info">
              <span className="stat-label">Active Listings</span>
              <h2 className="stat-value">{stats.activeListings}</h2>
              <span className="stat-change">Available for trade</span>
            </div>
          </div>
          <div className="stat-card completed">
            <div className="stat-icon"><i className="bi bi-check-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Completed Trades</span>
              <h2 className="stat-value text-success">{stats.completed}</h2>
              <span className="stat-change">Successful transactions</span>
            </div>
          </div>
          <div className="stat-card pending">
            <div className="stat-icon"><i className="bi bi-clock-history"></i></div>
            <div className="stat-info">
              <span className="stat-label">Pending Requests</span>
              <h2 className="stat-value text-warning">{stats.pending}</h2>
              <span className="stat-change">Awaiting response</span>
            </div>
          </div>
          <div className="stat-card cancelled">
            <div className="stat-icon"><i className="bi bi-x-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Cancelled/Expired</span>
              <h2 className="stat-value text-danger">{stats.cancelled}</h2>
              <span className="stat-change">Unsuccessful</span>
            </div>
          </div>
        </div>

        {/* Success Rate Card */}
        <div className="success-rate-card">
          <div className="success-rate-content">
            <div className="success-rate-info">
              <i className="bi bi-graph-up"></i>
              <div>
                <span className="success-rate-label">Success Rate</span>
                <h2 className="success-rate-value">{stats.successRate}%</h2>
              </div>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${stats.successRate}%` }}></div>
            </div>
            <div className="success-rate-stats">
              <span><i className="bi bi-check-circle"></i> {stats.completed} Completed</span>
              <span><i className="bi bi-clock"></i> {stats.pending} Pending</span>
              <span><i className="bi bi-x-circle"></i> {stats.cancelled} Cancelled</span>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button className={`filter-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            <i className="bi bi-grid"></i> All Listings
            <span className="tab-count">{listings.length}</span>
          </button>
          <button className={`filter-tab ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>
            <i className="bi bi-check-circle"></i> Active
            <span className="tab-count active">{listings.filter(l => l.status === 'ACTIVE').length}</span>
          </button>
          <button className={`filter-tab ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
            <i className="bi bi-clock"></i> Pending
            <span className="tab-count pending">{listings.filter(l => l.status === 'PENDING').length}</span>
          </button>
          <button className={`filter-tab ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>
            <i className="bi bi-check-circle-fill"></i> Completed
            <span className="tab-count completed">{listings.filter(l => l.status === 'COMPLETED').length}</span>
          </button>
        </div>

        {/* Listings Grid */}
        <div className="listings-grid">
          {listings.length > 0 ? (
            listings.map((listing) => (
              <div key={listing.listing_id} className="listing-card">
                <div className="listing-card-header">
                  <div className="listing-title">
                    <h6>{listing.title}</h6>
                    {getStatusBadge(listing.status)}
                  </div>
                </div>
                <div className="listing-card-body">
                  <p className="listing-description">{listing.description?.substring(0, 100)}...</p>
                  <div className="listing-details">
                    <div className="detail-item">
                      <i className="bi bi-box"></i>
                      <span>{listing.quantity} {listing.unit}</span>
                    </div>
                    <div className="detail-item">
                      <i className="bi bi-person"></i>
                      <span>{listing.users?.full_name || 'Anonymous'}</span>
                    </div>
                    <div className="detail-item">
                      <i className="bi bi-calendar3"></i>
                      <span>{new Date(listing.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="listing-card-footer">
                  {listing.status === 'ACTIVE' && (
                    <div className="action-buttons">
                      <button className="btn-view" onClick={() => viewListingDetails(listing)}>
                        <i className="bi bi-eye"></i> View
                      </button>
                      <button className="btn-complete" onClick={() => updateListingStatus(listing.listing_id, 'COMPLETED')}>
                        <i className="bi bi-check-lg"></i> Complete
                      </button>
                    </div>
                  )}
                  {listing.status === 'PENDING' && (
                    <div className="action-buttons">
                      <button className="btn-approve" onClick={() => updateListingStatus(listing.listing_id, 'ACTIVE')}>
                        <i className="bi bi-check-lg"></i> Approve
                      </button>
                      <button className="btn-reject" onClick={() => updateListingStatus(listing.listing_id, 'CANCELLED')}>
                        <i className="bi bi-x-lg"></i> Reject
                      </button>
                    </div>
                  )}
                  {listing.status !== 'ACTIVE' && listing.status !== 'PENDING' && (
                    <div className="completed-info">
                      <i className="bi bi-check-circle-fill"></i>
                      Completed on {new Date(listing.updated_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <i className="bi bi-inbox"></i>
              <h4>No barter listings found</h4>
              <p>There are no {filter !== 'all' ? filter : ''} listings to display.</p>
            </div>
          )}
        </div>

        {/* Recent Transactions Table */}
        <div className="recent-transactions">
          <div className="section-header">
            <h5><i className="bi bi-clock-history"></i> Recent Barter Requests</h5>
            <span className="section-badge">{transactions.length} requests</span>
          </div>
          <div className="table-responsive">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Requester</th>
                  <th>Offered Item</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 10).map((request) => (
                  <tr key={request.request_id}>
                    <td>
                      <div className="item-info">
                        <strong>{request.barter_listings?.title}</strong>
                        <small>{request.barter_listings?.quantity} {request.barter_listings?.unit}</small>
                      </div>
                    </td>
                    <td>
                      <div className="requester-info">
                        <i className="bi bi-person-circle"></i>
                        {request.requester?.full_name || 'Anonymous'}
                      </div>
                    </td>
                    <td>{request.offered_item}</td>
                    <td>{getStatusBadge(request.request_status)}</td>
                    <td className="date-cell">{new Date(request.created_at).toLocaleDateString()}</td>
                    <td>
                      {request.request_status === 'PENDING' && (
                        <div className="action-buttons-small">
                          <button className="btn-accept" onClick={() => updateRequestStatus(request.request_id, 'COMPLETED')}>
                            <i className="bi bi-check-lg"></i>
                          </button>
                          <button className="btn-decline" onClick={() => updateRequestStatus(request.request_id, 'CANCELLED')}>
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Listing Details Modal */}
      {showDetailsModal && selectedListing && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header info">
              <div className="modal-icon"><i className="bi bi-info-circle-fill"></i></div>
              <h3>Listing Details</h3>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="modal-body">
              <div className="details-section">
                <h4>{selectedListing.title}</h4>
                <div className="details-grid">
                  <div className="detail-item">
                    <label>Owner</label>
                    <div>{selectedListing.users?.full_name}</div>
                    <small>{selectedListing.users?.email}</small>
                  </div>
                  <div className="detail-item">
                    <label>Status</label>
                    {getStatusBadge(selectedListing.status)}
                  </div>
                  <div className="detail-item">
                    <label>Quantity</label>
                    <strong>{selectedListing.quantity} {selectedListing.unit}</strong>
                  </div>
                  <div className="detail-item">
                    <label>Created At</label>
                    <span>{new Date(selectedListing.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="detail-item full-width">
                  <label>Description</label>
                  <p>{selectedListing.description || 'No description provided'}</p>
                </div>
                {selectedListing.image_url && (
                  <div className="detail-item full-width">
                    <label>Image</label>
                    <img src={selectedListing.image_url} alt={selectedListing.title} className="listing-image" />
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
              {selectedListing.status === 'PENDING' && (
                <>
                  <button className="btn-approve-modal" onClick={() => {
                    updateListingStatus(selectedListing.listing_id, 'ACTIVE')
                    setShowDetailsModal(false)
                  }}>
                    <i className="bi bi-check-lg"></i> Approve
                  </button>
                  <button className="btn-reject-modal" onClick={() => {
                    updateListingStatus(selectedListing.listing_id, 'CANCELLED')
                    setShowDetailsModal(false)
                  }}>
                    <i className="bi bi-x-lg"></i> Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .barter-container {
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
        }

        .filter-select {
          padding: 8px 16px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 24px;
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
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .stat-card.total .stat-icon { background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); color: #667eea; }
        .stat-card.completed .stat-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-card.pending .stat-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .stat-card.cancelled .stat-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

        .stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon i {
          font-size: 24px;
        }

        .stat-info {
          flex: 1;
        }

        .stat-label {
          font-size: 13px;
          color: #6c757d;
          margin-bottom: 4px;
          display: block;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          color: #1f2937;
        }

        .stat-change {
          font-size: 11px;
          color: #9ca3af;
        }

        .text-success { color: #10b981; }
        .text-warning { color: #f59e0b; }
        .text-danger { color: #ef4444; }

        .success-rate-card {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 28px;
          color: white;
        }

        .success-rate-content {
          max-width: 600px;
          margin: 0 auto;
        }

        .success-rate-info {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .success-rate-info i {
          font-size: 32px;
        }

        .success-rate-label {
          font-size: 14px;
          opacity: 0.8;
          display: block;
        }

        .success-rate-value {
          font-size: 36px;
          font-weight: 700;
          margin: 0;
        }

        .progress-bar {
          height: 8px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          margin-bottom: 16px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: white;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .success-rate-stats {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .filter-tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 28px;
          background: white;
          padding: 6px;
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .filter-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          background: transparent;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #6c757d;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .filter-tab:hover {
          background: #f8f9fa;
        }

        .filter-tab.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .tab-count {
          background: rgba(0, 0, 0, 0.1);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
          margin-left: 6px;
        }

        .filter-tab.active .tab-count {
          background: rgba(255, 255, 255, 0.2);
        }

        .listings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .listing-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .listing-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .listing-card-header {
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }

        .listing-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .listing-title h6 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
        }

        .status-badge.active { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-badge.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .status-badge.completed { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-badge.cancelled { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .status-badge.expired { background: rgba(107, 114, 128, 0.1); color: #6c757d; }

        .listing-card-body {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
        }

        .listing-description {
          font-size: 13px;
          color: #6c757d;
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .listing-details {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #9ca3af;
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .listing-card-footer {
          padding: 16px 20px;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .btn-view, .btn-complete, .btn-approve, .btn-reject {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-view { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .btn-view:hover { background: #4f46e5; color: white; }
        .btn-complete, .btn-approve { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .btn-complete:hover, .btn-approve:hover { background: #10b981; color: white; }
        .btn-reject { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .btn-reject:hover { background: #ef4444; color: white; }

        .completed-info {
          text-align: center;
          font-size: 12px;
          color: #10b981;
        }

        .recent-transactions {
          background: white;
          border-radius: 24px;
          padding: 20px;
          margin-top: 20px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-header h5 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #1f2937;
        }

        .section-badge {
          background: #f8f9fa;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          color: #6c757d;
        }

        .transactions-table {
          width: 100%;
          border-collapse: collapse;
        }

        .transactions-table th {
          text-align: left;
          padding: 12px 16px;
          background: #f8f9fa;
          font-weight: 600;
          font-size: 13px;
          color: #495057;
          border-radius: 12px;
        }

        .transactions-table td {
          padding: 16px;
          border-bottom: 1px solid #e9ecef;
        }

        .item-info {
          display: flex;
          flex-direction: column;
        }

        .item-info small {
          font-size: 11px;
          color: #6c757d;
        }

        .requester-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .date-cell {
          font-size: 13px;
          color: #6c757d;
        }

        .action-buttons-small {
          display: flex;
          gap: 8px;
        }

        .btn-accept, .btn-decline {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-accept { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .btn-accept:hover { background: #10b981; color: white; }
        .btn-decline { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .btn-decline:hover { background: #ef4444; color: white; }

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 24px;
          grid-column: span 2;
        }

        .empty-state i {
          font-size: 64px;
          color: #cbd5e1;
          margin-bottom: 16px;
          display: block;
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
          max-width: 600px;
          animation: slideUp 0.3s ease;
          overflow: hidden;
          max-height: 90vh;
          overflow-y: auto;
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

        .details-section h4 {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 16px 0;
          color: #1f2937;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-item.full-width {
          grid-column: span 2;
        }

        .detail-item label {
          font-size: 11px;
          font-weight: 600;
          color: #6c757d;
          text-transform: uppercase;
        }

        .listing-image {
          max-width: 100%;
          border-radius: 12px;
          margin-top: 8px;
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

        .btn-approve-modal {
          padding: 10px 24px;
          background: #10b981;
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-reject-modal {
          padding: 10px 24px;
          background: #ef4444;
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
            grid-template-columns: repeat(2, 1fr);
          }
          .listings-grid {
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          .filter-tabs {
            flex-wrap: wrap;
          }
          .filter-tab {
            flex: auto;
          }
          .listings-grid {
            grid-template-columns: 1fr;
          }
          .details-grid {
            grid-template-columns: 1fr;
          }
          .detail-item.full-width {
            grid-column: span 1;
          }
          .success-rate-stats {
            flex-direction: column;
            gap: 8px;
          }
        }
      `}</style>
    </AdminLayout>
  )
}