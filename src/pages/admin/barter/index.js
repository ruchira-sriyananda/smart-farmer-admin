import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function BarterTransactions() {
  const router = useRouter()
  const [listings, setListings] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('listings')
  const [selectedItem, setSelectedItem] = useState(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [actionType, setActionType] = useState('')
  const [actionComment, setActionComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [stats, setStats] = useState({
    totalListings: 0,
    activeListings: 0,
    pendingRequests: 0,
    completedTrades: 0,
    totalValue: 0
  })

  useEffect(() => {
    fetchData()
    
    // Real-time subscriptions
    const listingsSubscription = supabase
      .channel('barter_listings_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'barter_listings' },
        () => fetchData()
      )
      .subscribe()

    const requestsSubscription = supabase
      .channel('barter_requests_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'barter_requests' },
        () => fetchData()
      )
      .subscribe()

    return () => {
      listingsSubscription.unsubscribe()
      requestsSubscription.unsubscribe()
    }
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      await Promise.all([
        fetchListings(),
        fetchRequests(),
        fetchStats()
      ])
    } catch (err) {
      console.error('Error fetching barter data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchListings = async () => {
    const { data, error } = await supabase
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

    if (!error && data) {
      setListings(data)
    }
  }

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('barter_requests')
      .select(`
        *,
        listing:barter_listings!listing_id (
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
        requester:users!requester_id (
          user_id,
          full_name,
          email,
          profile_image
        )
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setRequests(data)
    }
  }

  const fetchStats = async () => {
    // Get listings stats
    const { data: listingsData } = await supabase
      .from('barter_listings')
      .select('status')

    // Get requests stats
    const { data: requestsData } = await supabase
      .from('barter_requests')
      .select('request_status')

    // Calculate total trade value (simplified)
    const { data: listingsValue } = await supabase
      .from('barter_listings')
      .select('quantity, unit')

    const totalValue = listingsValue?.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0), 0) || 0

    setStats({
      totalListings: listingsData?.length || 0,
      activeListings: listingsData?.filter(l => l.status === 'ACTIVE').length || 0,
      pendingRequests: requestsData?.filter(r => r.request_status === 'PENDING').length || 0,
      completedTrades: requestsData?.filter(r => r.request_status === 'COMPLETED').length || 0,
      totalValue: totalValue
    })
  }

  const updateRequestStatus = async (requestId, status, comment = '') => {
    setActionLoading(true)
    const session = JSON.parse(localStorage.getItem('adminSession'))
    
    const updateData = {
      request_status: status,
      updated_at: new Date().toISOString(),
      admin_notes: comment || (status === 'APPROVED' ? 'Request approved by admin' : 'Request rejected by admin')
    }

    const { error } = await supabase
      .from('barter_requests')
      .update(updateData)
      .eq('request_id', requestId)

    if (!error) {
      // If approved, update the listing status
      if (status === 'APPROVED' && selectedItem?.listing_id) {
        await supabase
          .from('barter_listings')
          .update({ status: 'COMPLETED' })
          .eq('listing_id', selectedItem.listing_id)
      }
      
      fetchData()
      setShowActionModal(false)
      setSelectedItem(null)
      setActionComment('')
      alert(`Request ${status.toLowerCase()} successfully!`)
    } else {
      alert(`Error updating request: ${error.message}`)
    }
    setActionLoading(false)
  }

  const updateListingStatus = async (listingId, status) => {
    setActionLoading(true)
    
    const { error } = await supabase
      .from('barter_listings')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('listing_id', listingId)

    if (!error) {
      fetchData()
      setShowActionModal(false)
      setSelectedItem(null)
      alert(`Listing ${status.toLowerCase()} successfully!`)
    } else {
      alert(`Error updating listing: ${error.message}`)
    }
    setActionLoading(false)
  }

  const getStatusBadge = (status) => {
    const badges = {
      'ACTIVE': <span className="badge-active"><i className="bi bi-check-circle-fill"></i> Active</span>,
      'PENDING': <span className="badge-pending"><i className="bi bi-clock-fill"></i> Pending</span>,
      'APPROVED': <span className="badge-approved"><i className="bi bi-check-circle-fill"></i> Approved</span>,
      'REJECTED': <span className="badge-rejected"><i className="bi bi-x-circle-fill"></i> Rejected</span>,
      'COMPLETED': <span className="badge-completed"><i className="bi bi-check-double-fill"></i> Completed</span>,
      'CANCELLED': <span className="badge-cancelled"><i className="bi bi-ban-fill"></i> Cancelled</span>
    }
    return badges[status] || <span className="badge-default">{status}</span>
  }

  const getRequestStatusBadge = (status) => {
    const badges = {
      'PENDING': <span className="badge-pending"><i className="bi bi-clock-fill"></i> Pending</span>,
      'APPROVED': <span className="badge-approved"><i className="bi bi-check-circle-fill"></i> Approved</span>,
      'REJECTED': <span className="badge-rejected"><i className="bi bi-x-circle-fill"></i> Rejected</span>,
      'COMPLETED': <span className="badge-completed"><i className="bi bi-check-double-fill"></i> Completed</span>
    }
    return badges[status] || <span className="badge-default">{status}</span>
  }

  const openActionModal = (item, type, action) => {
    setSelectedItem(item)
    setActionType(action)
    setShowActionModal(true)
  }

  if (loading) {
    return (
      <AdminLayout title="Barter Management">
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
    <AdminLayout title="Barter Management">
      <div className="barter-container">
        {/* Header */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="bi bi-arrow-left-right"></i>
            </div>
            <div>
              <h1 className="header-title">Barter Management</h1>
              <p className="header-subtitle">Manage barter listings and trade requests</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary"><i className="bi bi-box-seam"></i></div>
            <div className="stat-info">
              <span className="stat-label">Total Listings</span>
              <h2 className="stat-value">{stats.totalListings}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon success"><i className="bi bi-check-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Active Listings</span>
              <h2 className="stat-value text-success">{stats.activeListings}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon warning"><i className="bi bi-clock-history"></i></div>
            <div className="stat-info">
              <span className="stat-label">Pending Requests</span>
              <h2 className="stat-value text-warning">{stats.pendingRequests}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon info"><i className="bi bi-check-double"></i></div>
            <div className="stat-info">
              <span className="stat-label">Completed Trades</span>
              <h2 className="stat-value text-info">{stats.completedTrades}</h2>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-container">
          <button 
            className={`tab-btn ${activeTab === 'listings' ? 'active' : ''}`}
            onClick={() => setActiveTab('listings')}
          >
            <i className="bi bi-box-seam"></i> Barter Listings
            <span className="tab-count">{listings.length}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <i className="bi bi-chat-dots"></i> Trade Requests
            <span className="tab-count pending">{requests.filter(r => r.request_status === 'PENDING').length}</span>
          </button>
        </div>

        {/* Listings Tab */}
        {activeTab === 'listings' && (
          <div className="listings-grid">
            {listings.length > 0 ? (
              listings.map((listing) => (
                <div key={listing.listing_id} className="listing-card">
                  <div className="listing-header">
                    <div className="listing-title">
                      <h6>{listing.title}</h6>
                      {getStatusBadge(listing.status)}
                    </div>
                  </div>
                  <div className="listing-body">
                    <p className="listing-description">{listing.description}</p>
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
                  <div className="listing-footer">
                    {listing.status === 'ACTIVE' && (
                      <button 
                        className="btn-complete"
                        onClick={() => openActionModal(listing, 'listing', 'complete')}
                      >
                        <i className="bi bi-check-lg"></i> Mark as Completed
                      </button>
                    )}
                    {listing.status === 'ACTIVE' && (
                      <button 
                        className="btn-cancel"
                        onClick={() => openActionModal(listing, 'listing', 'cancel')}
                      >
                        <i className="bi bi-x-lg"></i> Cancel Listing
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <i className="bi bi-inbox"></i>
                <h4>No barter listings</h4>
                <p>No listings have been created yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div className="requests-grid">
            {requests.length > 0 ? (
              requests.map((request) => (
                <div key={request.request_id} className="request-card">
                  <div className="request-header">
                    <div className="request-info">
                      <div className="requester-avatar">
                        {request.requester?.profile_image ? (
                          <img src={request.requester.profile_image} alt={request.requester.full_name} />
                        ) : (
                          <i className="bi bi-person-circle"></i>
                        )}
                      </div>
                      <div className="requester-details">
                        <div className="requester-name">{request.requester?.full_name || 'Anonymous'}</div>
                        <div className="requester-email">{request.requester?.email}</div>
                      </div>
                    </div>
                    {getRequestStatusBadge(request.request_status)}
                  </div>
                  
                  <div className="request-body">
                    <div className="listing-info">
                      <div className="listing-label">Requested Item:</div>
                      <div className="listing-value">{request.listing?.title}</div>
                    </div>
                    <div className="offer-info">
                      <div className="offer-label">Offered Item:</div>
                      <div className="offer-value">{request.offered_item}</div>
                    </div>
                    {request.admin_notes && (
                      <div className="admin-notes">
                        <i className="bi bi-chat-text"></i>
                        <span>{request.admin_notes}</span>
                      </div>
                    )}
                    <div className="request-meta">
                      <span><i className="bi bi-calendar3"></i> {new Date(request.created_at).toLocaleString()}</span>
                      <span><i className="bi bi-person"></i> Owner: {request.listing?.users?.full_name}</span>
                    </div>
                  </div>
                  
                  {request.request_status === 'PENDING' && (
                    <div className="request-footer">
                      <button 
                        className="btn-approve"
                        onClick={() => openActionModal(request, 'request', 'approve')}
                      >
                        <i className="bi bi-check-lg"></i> Approve
                      </button>
                      <button 
                        className="btn-reject"
                        onClick={() => openActionModal(request, 'request', 'reject')}
                      >
                        <i className="bi bi-x-lg"></i> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-state">
                <i className="bi bi-inbox"></i>
                <h4>No trade requests</h4>
                <p>No barter requests have been made yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {showActionModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowActionModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-header ${actionType === 'approve' ? 'success' : 'danger'}`}>
              <div className="modal-icon">
                <i className={`bi ${actionType === 'approve' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
              </div>
              <h3>
                {actionType === 'approve' ? 'Approve Request' : 
                 actionType === 'reject' ? 'Reject Request' :
                 actionType === 'complete' ? 'Complete Listing' : 'Cancel Listing'}
              </h3>
              <button className="modal-close" onClick={() => setShowActionModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to <strong>{actionType}</strong> this {activeTab === 'listings' ? 'listing' : 'request'}?
              </p>
              
              {(actionType === 'reject' || actionType === 'cancel') && (
                <div className="form-group">
                  <label className="form-label">Reason (Optional)</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    placeholder="Enter reason for rejection/cancellation..."
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                  />
                </div>
              )}
              
              {actionType === 'approve' && (
                <div className="warning-message success">
                  <i className="bi bi-info-circle-fill"></i>
                  Approving this request will mark the barter listing as completed.
                </div>
              )}
              
              {(actionType === 'reject' || actionType === 'cancel') && (
                <div className="warning-message danger">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  This action cannot be undone.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowActionModal(false)}>Cancel</button>
              <button 
                className={`btn-primary ${actionType === 'approve' ? 'success' : 'danger'}`}
                onClick={() => {
                  if (activeTab === 'listings') {
                    updateListingStatus(selectedItem.listing_id, actionType === 'complete' ? 'COMPLETED' : 'CANCELLED')
                  } else {
                    updateRequestStatus(selectedItem.request_id, actionType.toUpperCase(), actionComment)
                  }
                }}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Processing...</>
                ) : (
                  'Confirm'
                )}
              </button>
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
          margin-bottom: 28px;
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

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
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
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon.primary { background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); color: #667eea; }
        .stat-icon.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-icon.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .stat-icon.info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

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

        .text-success { color: #10b981; }
        .text-warning { color: #f59e0b; }
        .text-info { color: #3b82f6; }

        .tabs-container {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          background: white;
          padding: 6px;
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .tab-btn {
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

        .tab-btn:hover {
          background: #f8f9fa;
        }

        .tab-btn.active {
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

        .tab-count.pending {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }

        .listings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
        }

        .listing-card, .request-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .listing-card:hover, .request-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .listing-header {
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

        .badge-active, .badge-pending, .badge-approved, .badge-rejected, .badge-completed, .badge-cancelled, .badge-default {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
        }

        .badge-active { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .badge-pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .badge-approved { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .badge-rejected { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .badge-completed { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .badge-cancelled { background: rgba(107, 114, 128, 0.1); color: #6c757d; }
        .badge-default { background: #f8f9fa; color: #6c757d; }

        .listing-body, .request-body {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
        }

        .listing-description {
          font-size: 13px;
          color: #4b5563;
          margin-bottom: 12px;
          line-height: 1.5;
        }

        .listing-details {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #6c757d;
        }

        .listing-footer, .request-footer {
          padding: 16px 20px;
          display: flex;
          gap: 12px;
        }

        .btn-complete, .btn-cancel, .btn-approve, .btn-reject {
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

        .btn-complete, .btn-approve {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .btn-complete:hover, .btn-approve:hover {
          background: #10b981;
          color: white;
        }

        .btn-cancel, .btn-reject {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .btn-cancel:hover, .btn-reject:hover {
          background: #ef4444;
          color: white;
        }

        .request-header {
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .request-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .requester-avatar {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .requester-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .requester-avatar i {
          font-size: 24px;
          color: white;
        }

        .requester-name {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 2px;
        }

        .requester-email {
          font-size: 11px;
          color: #6c757d;
        }

        .listing-info, .offer-info {
          margin-bottom: 12px;
        }

        .listing-label, .offer-label {
          font-size: 11px;
          font-weight: 600;
          color: #6c757d;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .listing-value, .offer-value {
          font-size: 14px;
          color: #1f2937;
        }

        .admin-notes {
          background: #fef3c7;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          color: #92400e;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
        }

        .request-meta {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #9ca3af;
          margin-top: 12px;
        }

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
          max-width: 500px;
          animation: slideUp 0.3s ease;
          overflow: hidden;
        }

        .modal-header {
          padding: 24px 24px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
        }

        .modal-header.success .modal-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .modal-header.danger .modal-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

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
          margin-top: 16px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .form-textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
          resize: vertical;
        }

        .warning-message {
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          margin-top: 16px;
        }

        .warning-message.success {
          background: #d1fae5;
          color: #065f46;
        }

        .warning-message.danger {
          background: #fee2e2;
          color: #991b1b;
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
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-primary.success { background: #10b981; color: white; }
        .btn-primary.danger { background: #ef4444; color: white; }

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

        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .listings-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          .tabs-container {
            flex-direction: column;
          }
          .request-header {
            flex-direction: column;
            gap: 12px;
            text-align: center;
          }
          .request-meta {
            flex-direction: column;
            gap: 8px;
            text-align: center;
          }
        }
      `}</style>
    </AdminLayout>
  )
}