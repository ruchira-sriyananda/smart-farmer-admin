import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function ContentModeration() {
  const router = useRouter()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('PENDING')
  const [selectedPost, setSelectedPost] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  })

  useEffect(() => {
    fetchPosts()
    fetchStats()
  }, [filter])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('content_moderation')
        .select(`
          *,
          reviewed_by_admin:admin_users!reviewed_by (
            admin_id,
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'ALL') {
        query = query.eq('moderation_status', filter)
      }

      const { data, error } = await query

      if (!error && data) {
        setPosts(data)
      }
    } catch (err) {
      console.error('Error fetching posts:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('content_moderation')
        .select('moderation_status')

      if (!error && data) {
        setStats({
          total: data.length,
          pending: data.filter(p => p.moderation_status === 'PENDING').length,
          approved: data.filter(p => p.moderation_status === 'APPROVED').length,
          rejected: data.filter(p => p.moderation_status === 'REJECTED').length
        })
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const updateStatus = async (postId, status, reason = null) => {
    setActionLoading(true)
    const session = JSON.parse(localStorage.getItem('adminSession'))
    
    const updateData = {
      moderation_status: status,
      reviewed_by: session?.admin?.admin_id,
      reviewed_at: new Date().toISOString()
    }

    if (reason) {
      updateData.moderation_reason = reason
    }

    const { error } = await supabase
      .from('content_moderation')
      .update(updateData)
      .eq('moderation_id', postId)

    setActionLoading(false)

    if (!error) {
      fetchPosts()
      fetchStats()
      setShowRejectModal(false)
      setRejectReason('')
      setSelectedPost(null)
    }
  }

  const handleApprove = async (post) => {
    if (confirm(`Are you sure you want to approve this content?`)) {
      await updateStatus(post.moderation_id, 'APPROVED')
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection')
      return
    }
    await updateStatus(selectedPost.moderation_id, 'REJECTED', rejectReason)
  }

  const viewDetails = (post) => {
    setSelectedPost(post)
    setShowDetailsModal(true)
  }

  const getStatusBadge = (status) => {
    const badges = {
      'PENDING': <span className="status-badge pending"><i className="bi bi-clock-history"></i> Pending Review</span>,
      'APPROVED': <span className="status-badge approved"><i className="bi bi-check-circle-fill"></i> Approved</span>,
      'REJECTED': <span className="status-badge rejected"><i className="bi bi-x-circle-fill"></i> Rejected</span>
    }
    return badges[status] || <span className="status-badge default">{status}</span>
  }

  const getContentTypeIcon = (type) => {
    const icons = {
      'POST': 'bi-file-post',
      'COMMENT': 'bi-chat',
      'IMAGE': 'bi-image',
      'VIDEO': 'bi-camera-reels'
    }
    return icons[type] || 'bi-file-text'
  }

  if (loading) {
    return (
      <AdminLayout title="Content Moderation">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading content...</p>
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
    <AdminLayout title="Content Moderation">
      <div className="moderation-container">
        {/* Header */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="bi bi-shield-check"></i>
            </div>
            <div>
              <h1 className="header-title">Content Moderation</h1>
              <p className="header-subtitle">Review and manage user-generated content</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-icon">
              <i className="bi bi-files"></i>
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Content</span>
              <h2 className="stat-value">{stats.total}</h2>
            </div>
          </div>
          <div className="stat-card pending">
            <div className="stat-icon">
              <i className="bi bi-hourglass-split"></i>
            </div>
            <div className="stat-info">
              <span className="stat-label">Pending Review</span>
              <h2 className="stat-value text-warning">{stats.pending}</h2>
            </div>
          </div>
          <div className="stat-card approved">
            <div className="stat-icon">
              <i className="bi bi-check-circle"></i>
            </div>
            <div className="stat-info">
              <span className="stat-label">Approved</span>
              <h2 className="stat-value text-success">{stats.approved}</h2>
            </div>
          </div>
          <div className="stat-card rejected">
            <div className="stat-icon">
              <i className="bi bi-x-circle"></i>
            </div>
            <div className="stat-info">
              <span className="stat-label">Rejected</span>
              <h2 className="stat-value text-danger">{stats.rejected}</h2>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            <i className="bi bi-grid"></i>
            All Content
            <span className="tab-count">{stats.total}</span>
          </button>
          <button 
            className={`filter-tab ${filter === 'PENDING' ? 'active' : ''}`}
            onClick={() => setFilter('PENDING')}
          >
            <i className="bi bi-hourglass-split"></i>
            Pending
            <span className="tab-count pending">{stats.pending}</span>
          </button>
          <button 
            className={`filter-tab ${filter === 'APPROVED' ? 'active' : ''}`}
            onClick={() => setFilter('APPROVED')}
          >
            <i className="bi bi-check-circle"></i>
            Approved
            <span className="tab-count approved">{stats.approved}</span>
          </button>
          <button 
            className={`filter-tab ${filter === 'REJECTED' ? 'active' : ''}`}
            onClick={() => setFilter('REJECTED')}
          >
            <i className="bi bi-x-circle"></i>
            Rejected
            <span className="tab-count rejected">{stats.rejected}</span>
          </button>
        </div>

        {/* Content Cards Grid */}
        <div className="content-grid">
          {posts.length > 0 ? (
            posts.map((post) => (
              <div key={post.moderation_id} className="content-card">
                <div className="content-card-header">
                  <div className="content-type">
                    <i className={`bi ${getContentTypeIcon(post.content_type)}`}></i>
                    <span>{post.content_type || 'CONTENT'}</span>
                  </div>
                  {getStatusBadge(post.moderation_status)}
                </div>
                
                <div className="content-card-body">
                  <div className="content-id">
                    <i className="bi bi-hash"></i>
                    {post.content_id?.slice(0, 12)}...
                  </div>
                  <div className="content-date">
                    <i className="bi bi-calendar3"></i>
                    {new Date(post.created_at).toLocaleString()}
                  </div>
                  {post.moderation_reason && (
                    <div className="rejection-reason">
                      <i className="bi bi-exclamation-triangle-fill"></i>
                      <span>{post.moderation_reason}</span>
                    </div>
                  )}
                </div>
                
                <div className="content-card-footer">
                  {post.moderation_status === 'PENDING' ? (
                    <div className="action-buttons">
                      <button 
                        className="btn-approve"
                        onClick={() => handleApprove(post)}
                        disabled={actionLoading}
                      >
                        <i className="bi bi-check-lg"></i>
                        Approve
                      </button>
                      <button 
                        className="btn-reject"
                        onClick={() => {
                          setSelectedPost(post)
                          setShowRejectModal(true)
                        }}
                        disabled={actionLoading}
                      >
                        <i className="bi bi-x-lg"></i>
                        Reject
                      </button>
                      <button 
                        className="btn-view"
                        onClick={() => viewDetails(post)}
                      >
                        <i className="bi bi-eye"></i>
                        Details
                      </button>
                    </div>
                  ) : (
                    <div className="reviewed-info">
                      <i className="bi bi-person-check"></i>
                      Reviewed by {post.reviewed_by_admin?.full_name || 'System'}
                      <br />
                      <small>{new Date(post.reviewed_at).toLocaleString()}</small>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <i className="bi bi-inbox"></i>
              <h4>No content found</h4>
              <p>There are no {filter.toLowerCase()} content items to display.</p>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedPost && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon info">
                <i className="bi bi-info-circle-fill"></i>
              </div>
              <h3>Content Details</h3>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="details-grid">
                <div className="detail-item">
                  <label>Content ID</label>
                  <code>{selectedPost.content_id}</code>
                </div>
                <div className="detail-item">
                  <label>Content Type</label>
                  <span className="badge bg-secondary">{selectedPost.content_type}</span>
                </div>
                <div className="detail-item">
                  <label>Status</label>
                  {getStatusBadge(selectedPost.moderation_status)}
                </div>
                <div className="detail-item">
                  <label>Created At</label>
                  <span>{new Date(selectedPost.created_at).toLocaleString()}</span>
                </div>
                {selectedPost.moderation_reason && (
                  <div className="detail-item full-width">
                    <label>Rejection Reason</label>
                    <div className="rejection-box">{selectedPost.moderation_reason}</div>
                  </div>
                )}
                {selectedPost.reviewed_by_admin && (
                  <div className="detail-item">
                    <label>Reviewed By</label>
                    <span>{selectedPost.reviewed_by_admin?.full_name}</span>
                  </div>
                )}
                {selectedPost.reviewed_at && (
                  <div className="detail-item">
                    <label>Reviewed At</label>
                    <span>{new Date(selectedPost.reviewed_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedPost && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header warning">
              <div className="modal-icon">
                <i className="bi bi-exclamation-triangle-fill"></i>
              </div>
              <h3>Reject Content</h3>
              <button className="modal-close" onClick={() => setShowRejectModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to reject this content?
              </p>
              <div className="form-group">
                <label className="form-label">Reason for rejection</label>
                <textarea
                  className="form-textarea"
                  rows="4"
                  placeholder="Please provide a reason for rejecting this content..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button 
                className="btn-primary danger" 
                onClick={handleReject}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Processing...
                  </>
                ) : (
                  'Confirm Rejection'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .moderation-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Header */
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

        /* Stats Cards */
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
        .stat-card.pending .stat-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .stat-card.approved .stat-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-card.rejected .stat-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

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
        }

        .text-warning { color: #f59e0b; }
        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }

        /* Filter Tabs */
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

        .tab-count.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .tab-count.approved { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .tab-count.rejected { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

        /* Content Grid */
        .content-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
        }

        .content-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .content-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .content-card-header {
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .content-type {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #6c757d;
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

        .status-badge.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .status-badge.approved { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-badge.rejected { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

        .content-card-body {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
        }

        .content-id {
          font-family: monospace;
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 8px;
        }

        .content-date {
          font-size: 11px;
          color: #9ca3af;
          margin-bottom: 8px;
        }

        .rejection-reason {
          background: #fef3c7;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          color: #92400e;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
        }

        .content-card-footer {
          padding: 16px 20px;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .btn-approve, .btn-reject, .btn-view {
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

        .btn-approve {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .btn-approve:hover {
          background: #10b981;
          color: white;
        }

        .btn-reject {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .btn-reject:hover {
          background: #ef4444;
          color: white;
        }

        .btn-view {
          background: rgba(79, 70, 229, 0.1);
          color: #4f46e5;
        }

        .btn-view:hover {
          background: #4f46e5;
          color: white;
        }

        .reviewed-info {
          font-size: 11px;
          color: #6c757d;
          text-align: center;
        }

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

        .empty-state h4 {
          margin: 0 0 8px 0;
          color: #64748b;
        }

        .empty-state p {
          margin: 0;
          color: #94a3b8;
        }

        /* Modal */
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

        .modal-header.warning .modal-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
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

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .detail-item.full-width {
          grid-column: span 2;
        }

        .detail-item label {
          font-size: 11px;
          font-weight: 600;
          color: #6c757d;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .rejection-box {
          background: #fef3c7;
          padding: 12px;
          border-radius: 8px;
          color: #92400e;
          font-size: 13px;
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

        .form-textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
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

        @media (max-width: 1200px) {
          .content-grid {
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .filter-tabs {
            flex-wrap: wrap;
          }
          
          .filter-tab {
            flex: auto;
          }
          
          .content-grid {
            grid-template-columns: 1fr;
          }
          
          .details-grid {
            grid-template-columns: 1fr;
          }
          
          .detail-item.full-width {
            grid-column: span 1;
          }
        }
      `}</style>
    </AdminLayout>
  )
}