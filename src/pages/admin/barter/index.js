import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function BarterTransactions() {
  const router = useRouter()
  const [transactions, setTransactions] = useState([])
  const [listings, setListings] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [stats, setStats] = useState({
    totalTransactions: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
    activeListings: 0,
    totalRequests: 0,
    successRate: 0,
    popularItems: []
  })

  useEffect(() => {
    fetchBarterData()
    
    // Real-time subscriptions
    const listingsSubscription = supabase
      .channel('barter_listings_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'barter_listings' },
        () => fetchBarterData()
      )
      .subscribe()

    const requestsSubscription = supabase
      .channel('barter_requests_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'barter_requests' },
        () => fetchBarterData()
      )
      .subscribe()

    return () => {
      listingsSubscription.unsubscribe()
      requestsSubscription.unsubscribe()
    }
  }, [filter, dateRange])

  const fetchBarterData = async () => {
    try {
      setLoading(true)
      
      // Fetch barter listings
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

      // Fetch barter requests
      let requestsQuery = supabase
        .from('barter_requests')
        .select(`
          *,
          barter_listings!barter_requests_listing_id_fkey (
            listing_id,
            title,
            user_id,
            users!barter_listings_user_id_fkey (
              full_name,
              email
            )
          ),
          requester:users!barter_requests_requester_id_fkey (
            user_id,
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })

      const { data: requestsData, error: requestsError } = await requestsQuery

      // Fetch transaction analytics
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('system_analytics')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(30)

      if (!listingsError) setListings(listingsData || [])
      if (!requestsError) setRequests(requestsData || [])
      if (!analyticsError) setTransactions(analyticsData || [])

      calculateStats(listingsData || [], requestsData || [], analyticsData || [])
      
    } catch (err) {
      console.error('Error fetching barter data:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (listingsData, requestsData, analyticsData) => {
    const activeListings = listingsData.filter(l => l.status === 'ACTIVE').length
    const totalRequests = requestsData.length
    const pendingRequests = requestsData.filter(r => r.request_status === 'PENDING').length
    const completedRequests = requestsData.filter(r => r.request_status === 'COMPLETED').length
    
    // Calculate popular items from listings
    const itemCounts = {}
    listingsData.forEach(listing => {
      const title = listing.title?.split(' ').slice(0, 2).join(' ') || 'Item'
      itemCounts[title] = (itemCounts[title] || 0) + 1
    })
    const popularItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    // Calculate transaction stats from analytics
    const totalTransactions = analyticsData.reduce((sum, t) => sum + (t.total_barter_transactions || 0), 0)
    const completed = analyticsData.reduce((sum, t) => sum + (t.completed_barter || 0), 0)
    const pending = analyticsData.reduce((sum, t) => sum + (t.pending_barter || 0), 0)
    const cancelled = analyticsData.reduce((sum, t) => sum + (t.cancelled_barter || 0), 0)
    const successRate = totalTransactions > 0 ? Math.round((completed / totalTransactions) * 100) : 0

    setStats({
      totalTransactions,
      completed,
      pending,
      cancelled,
      activeListings,
      totalRequests,
      pendingRequests,
      completedRequests,
      successRate,
      popularItems
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

  const getStatusBadge = (status) => {
    const badges = {
      'ACTIVE': <span className="status-badge active"><i className="bi bi-check-circle-fill"></i> Active</span>,
      'PENDING': <span className="status-badge pending"><i className="bi bi-clock-fill"></i> Pending</span>,
      'COMPLETED': <span className="status-badge completed"><i className="bi bi-check-circle-fill"></i> Completed</span>,
      'CANCELLED': <span className="status-badge cancelled"><i className="bi bi-x-circle-fill"></i> Cancelled</span>,
      'EXPIRED': <span className="status-badge expired"><i className="bi bi-hourglass-split"></i> Expired</span>
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
              <p className="header-subtitle">Manage barter listings, requests, and transactions</p>
            </div>
          </div>
          <button className="refresh-btn" onClick={fetchBarterData}>
            <i className="bi bi-arrow-repeat"></i> Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-icon"><i className="bi bi-arrow-left-right"></i></div>
            <div className="stat-info">
              <span className="stat-label">Total Transactions</span>
              <h2 className="stat-value">{stats.totalTransactions}</h2>
            </div>
          </div>
          <div className="stat-card active">
            <div className="stat-icon"><i className="bi bi-box-seam"></i></div>
            <div className="stat-info">
              <span className="stat-label">Active Listings</span>
              <h2 className="stat-value">{stats.activeListings}</h2>
            </div>
          </div>
          <div className="stat-card requests">
            <div className="stat-icon"><i className="bi bi-chat"></i></div>
            <div className="stat-info">
              <span className="stat-label">Total Requests</span>
              <h2 className="stat-value">{stats.totalRequests}</h2>
            </div>
          </div>
          <div className="stat-card success-rate">
            <div className="stat-icon"><i className="bi bi-graph-up"></i></div>
            <div className="stat-info">
              <span className="stat-label">Success Rate</span>
              <h2 className="stat-value">{stats.successRate}%</h2>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button className={`filter-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            <i className="bi bi-grid"></i> All Listings
          </button>
          <button className={`filter-tab ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>
            <i className="bi bi-check-circle"></i> Active
          </button>
          <button className={`filter-tab ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
            <i className="bi bi-clock"></i> Pending
          </button>
          <button className={`filter-tab ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>
            <i className="bi bi-check2-circle"></i> Completed
          </button>
          <button className={`filter-tab ${filter === 'cancelled' ? 'active' : ''}`} onClick={() => setFilter('cancelled')}>
            <i className="bi bi-x-circle"></i> Cancelled
          </button>
        </div>

        {/* Two Column Layout */}
        <div className="two-columns">
          {/* Barter Listings */}
          <div className="listings-card">
            <div className="card-header-custom">
              <h5><i className="bi bi-box-seam"></i> Barter Listings</h5>
              <span className="badge-count">{listings.length} listings</span>
            </div>
            <div className="listings-list">
              {listings.length > 0 ? (
                listings.map((listing) => (
                  <div key={listing.listing_id} className="listing-item">
                    <div className="listing-header">
                      <h6 className="listing-title">{listing.title}</h6>
                      {getStatusBadge(listing.status)}
                    </div>
                    <p className="listing-description">{listing.description?.substring(0, 100)}...</p>
                    <div className="listing-details">
                      <span><i className="bi bi-box"></i> Qty: {listing.quantity} {listing.unit}</span>
                      <span><i className="bi bi-person"></i> {listing.users?.full_name || 'Anonymous'}</span>
                      <span><i className="bi bi-calendar3"></i> {new Date(listing.created_at).toLocaleDateString()}</span>
                    </div>
                    {listing.status === 'ACTIVE' && (
                      <div className="listing-actions">
                        <button className="btn-complete" onClick={() => updateListingStatus(listing.listing_id, 'COMPLETED')}>
                          <i className="bi bi-check-lg"></i> Mark Complete
                        </button>
                        <button className="btn-expire" onClick={() => updateListingStatus(listing.listing_id, 'EXPIRED')}>
                          <i className="bi bi-hourglass"></i> Expire
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state">No barter listings found</div>
              )}
            </div>
          </div>

          {/* Barter Requests & Popular Items */}
          <div className="requests-card">
            <div className="card-header-custom">
              <h5><i className="bi bi-chat-dots"></i> Barter Requests</h5>
              <span className="badge-count">{requests.length} requests</span>
            </div>
            <div className="requests-list">
              {requests.length > 0 ? (
                requests.slice(0, 10).map((request) => (
                  <div key={request.request_id} className="request-item">
                    <div className="request-header">
                      <div className="request-users">
                        <span className="requester">{request.requester?.full_name?.split(' ')[0]}</span>
                        <i className="bi bi-arrow-right"></i>
                        <span className="listing-owner">{request.barter_listings?.users?.full_name?.split(' ')[0]}</span>
                      </div>
                      {getStatusBadge(request.request_status)}
                    </div>
                    <div className="request-details">
                      <div className="offered-item">
                        <i className="bi bi-gift"></i> Offered: {request.offered_item}
                      </div>
                      <div className="listing-title">
                        <i className="bi bi-box"></i> For: {request.barter_listings?.title}
                      </div>
                    </div>
                    <div className="request-meta">
                      <small><i className="bi bi-calendar3"></i> {new Date(request.created_at).toLocaleString()}</small>
                    </div>
                    {request.request_status === 'PENDING' && (
                      <div className="request-actions">
                        <button className="btn-accept" onClick={() => updateRequestStatus(request.request_id, 'COMPLETED')}>
                          <i className="bi bi-check-lg"></i> Accept
                        </button>
                        <button className="btn-reject" onClick={() => updateRequestStatus(request.request_id, 'CANCELLED')}>
                          <i className="bi bi-x-lg"></i> Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state">No barter requests found</div>
              )}
            </div>

            {/* Popular Items */}
            {stats.popularItems.length > 0 && (
              <div className="popular-items">
                <h6><i className="bi bi-trophy"></i> Most Requested Items</h6>
                <div className="popular-tags">
                  {stats.popularItems.map((item, idx) => (
                    <div key={idx} className="popular-tag">
                      <span className="tag-rank">#{idx + 1}</span>
                      <span className="tag-name">{item.name}</span>
                      <span className="tag-count">{item.count} listings</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transaction History Table */}
        <div className="transactions-table">
          <div className="table-header-custom">
            <h5><i className="bi bi-clock-history"></i> Transaction History</h5>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total Transactions</th>
                  <th>Completed</th>
                  <th>Pending</th>
                  <th>Cancelled</th>
                  <th>Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, idx) => (
                  <tr key={idx}>
                    <td><i className="bi bi-calendar3 me-2"></i>{new Date(tx.generated_at).toLocaleDateString()}</td>
                    <td className="fw-bold">{tx.total_barter_transactions || 0}</td>
                    <td className="text-success">{tx.completed_barter || 0}</td>
                    <td className="text-warning">{tx.pending_barter || 0}</td>
                    <td className="text-danger">{tx.cancelled_barter || 0}</td>
                    <td>
                      <div className="success-rate">
                        <div className="rate-bar">
                          <div className="rate-fill" style={{ width: `${tx.total_barter_transactions > 0 ? Math.round((tx.completed_barter / tx.total_barter_transactions) * 100) : 0}%` }}></div>
                        </div>
                        <span className="rate-value">
                          {tx.total_barter_transactions > 0 ? Math.round((tx.completed_barter / tx.total_barter_transactions) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-4">No transaction data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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

        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          color: #495057;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .refresh-btn:hover {
          background: #e9ecef;
          transform: translateY(-1px);
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

        .stat-card.total .stat-icon { background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); color: #667eea; }
        .stat-card.active .stat-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-card.requests .stat-icon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .stat-card.success-rate .stat-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }

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
          padding: 10px 16px;
          background: transparent;
          border: none;
          border-radius: 12px;
          font-size: 13px;
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

        .two-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }

        .listings-card, .requests-card {
          background: white;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .card-header-custom {
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .card-header-custom h5 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #1f2937;
        }

        .card-header-custom h5 i {
          margin-right: 8px;
          color: #4f46e5;
        }

        .badge-count {
          background: #e9ecef;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          color: #6c757d;
        }

        .listings-list, .requests-list {
          max-height: 500px;
          overflow-y: auto;
          padding: 16px;
        }

        .listing-item, .request-item {
          background: #f8f9fa;
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 16px;
          transition: all 0.3s ease;
        }

        .listing-item:hover, .request-item:hover {
          background: #f1f3f5;
          transform: translateY(-2px);
        }

        .listing-header, .request-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .listing-title {
          font-size: 15px;
          font-weight: 600;
          margin: 0;
          color: #1f2937;
        }

        .listing-description {
          font-size: 13px;
          color: #6c757d;
          margin-bottom: 12px;
          line-height: 1.4;
        }

        .listing-details, .request-details {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .listing-details i, .request-details i {
          margin-right: 4px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
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

        .listing-actions, .request-actions {
          display: flex;
          gap: 10px;
          margin-top: 12px;
        }

        .btn-complete, .btn-expire, .btn-accept, .btn-reject {
          flex: 1;
          padding: 6px 12px;
          border: none;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-complete, .btn-accept {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .btn-complete:hover, .btn-accept:hover {
          background: #10b981;
          color: white;
        }

        .btn-expire, .btn-reject {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .btn-expire:hover, .btn-reject:hover {
          background: #ef4444;
          color: white;
        }

        .request-users {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
        }

        .requester, .listing-owner {
          color: #1f2937;
        }

        .offered-item, .listing-title {
          font-size: 12px;
        }

        .request-meta {
          font-size: 10px;
          color: #9ca3af;
          margin-top: 8px;
        }

        .popular-items {
          padding: 16px;
          border-top: 1px solid #e9ecef;
        }

        .popular-items h6 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: #1f2937;
        }

        .popular-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .popular-tag {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8f9fa;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
        }

        .tag-rank {
          font-weight: 700;
          color: #4f46e5;
        }

        .tag-name {
          color: #1f2937;
        }

        .tag-count {
          color: #6c757d;
          font-size: 11px;
        }

        .transactions-table {
          background: white;
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .table-header-custom {
          margin-bottom: 20px;
        }

        .table-header-custom h5 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #1f2937;
        }

        .table-header-custom h5 i {
          margin-right: 8px;
          color: #4f46e5;
        }

        .custom-table {
          width: 100%;
          border-collapse: collapse;
        }

        .custom-table th {
          text-align: left;
          padding: 12px 16px;
          background: #f8f9fa;
          font-weight: 600;
          font-size: 13px;
          color: #495057;
          border-radius: 12px;
        }

        .custom-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #e9ecef;
          vertical-align: middle;
        }

        .success-rate {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rate-bar {
          flex: 1;
          height: 6px;
          background: #e9ecef;
          border-radius: 3px;
          overflow: hidden;
        }

        .rate-fill {
          height: 100%;
          background: #10b981;
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .rate-value {
          font-size: 12px;
          font-weight: 600;
          min-width: 40px;
        }

        .text-success { color: #10b981; }
        .text-warning { color: #f59e0b; }
        .text-danger { color: #ef4444; }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #9ca3af;
        }

        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .two-columns {
            grid-template-columns: 1fr;
          }
          .filter-tabs {
            flex-wrap: wrap;
          }
          .filter-tab {
            flex: auto;
          }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .listing-details, .request-details {
            flex-direction: column;
            gap: 6px;
          }
          .custom-table {
            display: block;
            overflow-x: auto;
          }
        }
      `}</style>
    </AdminLayout>
  )
}