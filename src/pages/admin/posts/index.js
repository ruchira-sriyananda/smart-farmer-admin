import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function ContentModeration() {
  const router = useRouter()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('PENDING')
  const [selectedPost, setSelectedPost] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [postDetails, setPostDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showFullImage, setShowFullImage] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imageLoading, setImageLoading] = useState({})
  const [imageErrors, setImageErrors] = useState({})
  const [postImages, setPostImages] = useState({})
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  })

  // Quick rejection reasons
  const quickReasons = [
    { id: 1, reason: 'Inappropriate content', icon: 'bi-emoji-frown', color: '#ef4444' },
    { id: 2, reason: 'Spam or promotional', icon: 'bi-megaphone', color: '#f59e0b' },
    { id: 3, reason: 'Misleading information', icon: 'bi-info-circle', color: '#f59e0b' },
    { id: 4, reason: 'Copyright violation', icon: 'bi-c-circle', color: '#ef4444' },
    { id: 5, reason: 'Offensive language', icon: 'bi-chat-dots', color: '#ef4444' },
    { id: 6, reason: 'Duplicate content', icon: 'bi-files', color: '#6c757d' },
    { id: 7, reason: 'Irrelevant to community', icon: 'bi-x-octagon', color: '#6c757d' },
    { id: 8, reason: 'Harassment or bullying', icon: 'bi-shield-exclamation', color: '#dc2626' }
  ]

  useEffect(() => {
    fetchPosts()
    fetchStats()
  }, [filter])

  // Helper function to get Supabase storage URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null
    if (imagePath.startsWith('http')) return imagePath
    const { data } = supabase.storage.from('post-images').getPublicUrl(imagePath)
    return data?.publicUrl || imagePath
  }

  const fetchPosts = async () => {
    try {
      setLoading(true)
      setError(null)
      
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

      if (error) throw error

      // Fetch images for each post that is a POST type
      const postsWithImages = []
      for (const post of (data || [])) {
        if (post.content_type === 'POST') {
          const { data: images, error: imagesError } = await supabase
            .from('post_images')
            .select('image_id, image_url, image_order')
            .eq('post_id', post.content_id)
            .order('image_order', { ascending: true })
          
          if (!imagesError && images && images.length > 0) {
            postsWithImages.push({ ...post, images })
          } else if (post.image_url) {
            postsWithImages.push({ ...post, images: [{ image_url: post.image_url }] })
          } else {
            postsWithImages.push({ ...post, images: [] })
          }
        } else {
          postsWithImages.push({ ...post, images: [] })
        }
      }

      setPosts(postsWithImages || [])
    } catch (err) {
      console.error('Error fetching posts:', err)
      setError(err.message)
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

  const fetchPostDetails = async (contentId, contentType) => {
    setLoadingDetails(true)
    try {
      let details = null
      
      if (contentType === 'POST') {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            *,
            users!posts_user_id_fkey (
              user_id,
              full_name,
              email,
              profile_image
            ),
            post_categories!posts_category_id_fkey (
              category_name
            ),
            post_images (
              image_id,
              image_url,
              image_order
            )
          `)
          .eq('post_id', contentId)
          .single()
        
        if (!error && data) {
          // Fetch images if they exist in separate table
          const { data: images, error: imagesError } = await supabase
            .from('post_images')
            .select('image_id, image_url, image_order')
            .eq('post_id', contentId)
            .order('image_order', { ascending: true })
          
          if (!imagesError && images && images.length > 0) {
            data.images = images
          } else if (data.image_url) {
            data.images = [{ image_url: data.image_url, image_order: 0 }]
          } else {
            data.images = []
          }
          details = data
        }
      } else if (contentType === 'COMMENT') {
        const { data, error } = await supabase
          .from('comments')
          .select(`
            *,
            users!comments_user_id_fkey (
              user_id,
              full_name,
              email,
              profile_image
            ),
            posts!comments_post_id_fkey (
              post_id,
              title
            )
          `)
          .eq('comment_id', contentId)
          .single()
        
        if (!error && data) details = data
      }
      
      setPostDetails(details)
    } catch (err) {
      console.error('Error fetching post details:', err)
    } finally {
      setLoadingDetails(false)
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
      setCustomReason('')
      setSelectedPost(null)
      if (showDetailsModal) setShowDetailsModal(false)
    } else {
      alert(`Error updating status: ${error.message}`)
    }
  }

  const handleApprove = async (post) => {
    if (confirm(`Are you sure you want to approve this content?`)) {
      await updateStatus(post.moderation_id, 'APPROVED')
    }
  }

  const handleReject = async () => {
    const finalReason = customReason || rejectReason
    if (!finalReason.trim()) {
      alert('Please provide a reason for rejection')
      return
    }
    await updateStatus(selectedPost.moderation_id, 'REJECTED', finalReason)
  }

  const viewDetails = async (post) => {
    setSelectedPost(post)
    await fetchPostDetails(post.content_id, post.content_type)
    setShowDetailsModal(true)
  }

  const openFullImage = (imageUrl) => {
    setSelectedImage(imageUrl)
    setShowFullImage(true)
  }

  const handleImageLoad = (imageId) => {
    setImageLoading(prev => ({ ...prev, [imageId]: false }))
  }

  const handleImageError = (imageId) => {
    setImageLoading(prev => ({ ...prev, [imageId]: false }))
    setImageErrors(prev => ({ ...prev, [imageId]: true }))
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

  if (error) {
    return (
      <AdminLayout title="Content Moderation">
        <div className="error-container">
          <i className="bi bi-shield-exclamation"></i>
          <h3>Access Denied</h3>
          <p>{error}</p>
          <button className="btn-primary" onClick={fetchPosts}>Retry</button>
        </div>
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
            <div className="stat-icon"><i className="bi bi-files"></i></div>
            <div className="stat-info">
              <span className="stat-label">Total Content</span>
              <h2 className="stat-value">{stats.total}</h2>
            </div>
          </div>
          <div className="stat-card pending">
            <div className="stat-icon"><i className="bi bi-hourglass-split"></i></div>
            <div className="stat-info">
              <span className="stat-label">Pending Review</span>
              <h2 className="stat-value text-warning">{stats.pending}</h2>
            </div>
          </div>
          <div className="stat-card approved">
            <div className="stat-icon"><i className="bi bi-check-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Approved</span>
              <h2 className="stat-value text-success">{stats.approved}</h2>
            </div>
          </div>
          <div className="stat-card rejected">
            <div className="stat-icon"><i className="bi bi-x-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Rejected</span>
              <h2 className="stat-value text-danger">{stats.rejected}</h2>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button className={`filter-tab ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
            <i className="bi bi-grid"></i> All Content
            <span className="tab-count">{stats.total}</span>
          </button>
          <button className={`filter-tab ${filter === 'PENDING' ? 'active' : ''}`} onClick={() => setFilter('PENDING')}>
            <i className="bi bi-hourglass-split"></i> Pending
            <span className="tab-count pending">{stats.pending}</span>
          </button>
          <button className={`filter-tab ${filter === 'APPROVED' ? 'active' : ''}`} onClick={() => setFilter('APPROVED')}>
            <i className="bi bi-check-circle"></i> Approved
            <span className="tab-count approved">{stats.approved}</span>
          </button>
          <button className={`filter-tab ${filter === 'REJECTED' ? 'active' : ''}`} onClick={() => setFilter('REJECTED')}>
            <i className="bi bi-x-circle"></i> Rejected
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
                
                {/* Image Preview in Card */}
                {post.images && post.images.length > 0 && (
                  <div className="content-image-preview">
                    <img 
                      src={getImageUrl(post.images[0].image_url)} 
                      alt="Preview" 
                      className="preview-image"
                    />
                    {post.images.length > 1 && (
                      <div className="image-count-badge">
                        +{post.images.length}
                      </div>
                    )}
                  </div>
                )}
                
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
                      <button className="btn-approve" onClick={() => handleApprove(post)} disabled={actionLoading}>
                        <i className="bi bi-check-lg"></i> Approve
                      </button>
                      <button className="btn-reject" onClick={() => {
                        setSelectedPost(post)
                        setShowRejectModal(true)
                      }} disabled={actionLoading}>
                        <i className="bi bi-x-lg"></i> Reject
                      </button>
                      <button className="btn-view" onClick={() => viewDetails(post)}>
                        <i className="bi bi-eye"></i> Details
                      </button>
                    </div>
                  ) : (
                    <div className="reviewed-info">
                      <i className="bi bi-person-check"></i>
                      Reviewed by {post.reviewed_by_admin?.full_name || 'System'}
                      <br />
                      <small>{post.reviewed_at ? new Date(post.reviewed_at).toLocaleString() : 'Auto-approved'}</small>
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

      {/* Details Modal with Full Content and Images */}
      {showDetailsModal && selectedPost && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header info">
              <div className="modal-icon"><i className="bi bi-info-circle-fill"></i></div>
              <h3>Content Details</h3>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="modal-body">
              {loadingDetails ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary"></div>
                  <p className="mt-2">Loading content details...</p>
                </div>
              ) : (
                <>
                  {/* Content Metadata */}
                  <div className="details-section">
                    <h4><i className="bi bi-info-circle"></i> Content Information</h4>
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
                    </div>
                  </div>

                  {/* Author Information */}
                  {postDetails && (
                    <div className="details-section">
                      <h4><i className="bi bi-person-badge"></i> Author Information</h4>
                      <div className="author-info">
                        <div className="author-avatar">
                          {postDetails.users?.profile_image ? (
                            <img src={getImageUrl(postDetails.users.profile_image)} alt={postDetails.users.full_name} />
                          ) : (
                            <i className="bi bi-person-circle"></i>
                          )}
                        </div>
                        <div className="author-details">
                          <div className="author-name">{postDetails.users?.full_name || 'Unknown User'}</div>
                          <div className="author-email">{postDetails.users?.email || 'No email'}</div>
                          {postDetails.users?.user_id && (
                            <div className="author-id">ID: {postDetails.users.user_id.slice(0, 8)}...</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Post Content with Images */}
                  {selectedPost.content_type === 'POST' && postDetails && (
                    <div className="details-section">
                      <h4><i className="bi bi-file-text"></i> Post Content</h4>
                      <div className="post-title">{postDetails.title}</div>
                      <div className="post-content">{postDetails.content}</div>
                      
                      {/* Display Images from Supabase */}
                      {postDetails.images && postDetails.images.length > 0 && (
                        <div className="post-images">
                          <label className="images-label">
                            <i className="bi bi-images"></i> 
                            Attached Images ({postDetails.images.length})
                          </label>
                          <div className="images-grid">
                            {postDetails.images.map((img, idx) => {
                              const imageUrl = getImageUrl(img.image_url)
                              const imageId = `${selectedPost.content_id}_img_${idx}`
                              return (
                                <div 
                                  key={idx} 
                                  className="image-item"
                                  onClick={() => openFullImage(imageUrl)}
                                >
                                  <img 
                                    src={imageUrl} 
                                    alt={`Post image ${idx + 1}`}
                                    onLoad={() => handleImageLoad(imageId)}
                                    onError={() => handleImageError(imageId)}
                                  />
                                  <div className="image-overlay">
                                    <i className="bi bi-zoom-in"></i>
                                    <span>Click to enlarge</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {postDetails.post_categories?.category_name && (
                        <div className="post-category">
                          <i className="bi bi-tag"></i> Category: {postDetails.post_categories.category_name}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comment Content */}
                  {selectedPost.content_type === 'COMMENT' && postDetails && (
                    <div className="details-section">
                      <h4><i className="bi bi-chat"></i> Comment Content</h4>
                      <div className="comment-post">
                        <i className="bi bi-file-post"></i> On Post: {postDetails.posts?.title || 'Unknown Post'}
                      </div>
                      <div className="comment-text">{postDetails.comment_text}</div>
                    </div>
                  )}

                  {/* Moderation Info */}
                  {selectedPost.moderation_reason && (
                    <div className="details-section">
                      <h4><i className="bi bi-exclamation-triangle"></i> Rejection Reason</h4>
                      <div className="rejection-box">{selectedPost.moderation_reason}</div>
                    </div>
                  )}

                  {selectedPost.reviewed_by_admin && (
                    <div className="details-section">
                      <h4><i className="bi bi-person-check"></i> Moderation Info</h4>
                      <div className="moderation-info">
                        <div>Reviewed by: {selectedPost.reviewed_by_admin?.full_name}</div>
                        <div>Reviewed at: {new Date(selectedPost.reviewed_at).toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              {selectedPost.moderation_status === 'PENDING' && (
                <>
                  <button className="btn-approve-modal" onClick={() => handleApprove(selectedPost)}>
                    <i className="bi bi-check-lg"></i> Approve
                  </button>
                  <button className="btn-reject-modal" onClick={() => {
                    setShowDetailsModal(false)
                    setShowRejectModal(true)
                  }}>
                    <i className="bi bi-x-lg"></i> Reject
                  </button>
                </>
              )}
              <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Full Image Modal */}
      {showFullImage && selectedImage && (
        <div className="modal-overlay" onClick={() => setShowFullImage(false)}>
          <div className="full-image-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-image-btn" onClick={() => setShowFullImage(false)}>
              <i className="bi bi-x-lg"></i>
            </button>
            <img src={selectedImage} alt="Full size" />
            <button 
              className="download-image-btn" 
              onClick={() => window.open(selectedImage, '_blank')}
            >
              <i className="bi bi-box-arrow-up-right"></i> Open in new tab
            </button>
          </div>
        </div>
      )}

      {/* Quick Reject Modal with Preset Reasons */}
      {showRejectModal && selectedPost && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-container modal-reject" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header warning">
              <div className="modal-icon"><i className="bi bi-exclamation-triangle-fill"></i></div>
              <h3>Reject Content</h3>
              <button className="modal-close" onClick={() => setShowRejectModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="modal-body">
              <p>Select a reason for rejecting this content:</p>
              
              {/* Quick Reason Buttons */}
              <div className="quick-reasons">
                {quickReasons.map((reason) => (
                  <button
                    key={reason.id}
                    className={`quick-reason-btn ${rejectReason === reason.reason ? 'selected' : ''}`}
                    onClick={() => setRejectReason(reason.reason)}
                    style={{ '--reason-color': reason.color }}
                  >
                    <i className={`bi ${reason.icon}`}></i>
                    <span>{reason.reason}</span>
                    {rejectReason === reason.reason && <i className="bi bi-check-circle-fill check-icon"></i>}
                  </button>
                ))}
              </div>

              {/* Custom Reason */}
              <div className="custom-reason">
                <label className="form-label">Or provide a custom reason:</label>
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

              {!rejectReason && !customReason && (
                <div className="warning-message">
                  <i className="bi bi-info-circle"></i>
                  Please select a reason or provide a custom reason before rejecting.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button 
                className="btn-primary danger" 
                onClick={handleReject}
                disabled={actionLoading || (!rejectReason && !customReason)}
              >
                {actionLoading ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Processing...</>
                ) : (
                  'Confirm Rejection'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .moderation-container { max-width: 1400px; margin: 0 auto; }
        .page-header { margin-bottom: 28px; }
        .header-content { display: flex; align-items: center; gap: 20px; }
        .header-icon { width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; display: flex; align-items: center; justify-content: center; }
        .header-icon i { font-size: 28px; color: white; }
        .header-title { font-size: 24px; font-weight: 700; color: #1f2937; margin: 0 0 4px 0; }
        .header-subtitle { color: #6c757d; margin: 0; font-size: 14px; }
        
        /* Stats Cards */
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 28px; }
        .stat-card { background: white; border-radius: 20px; padding: 20px; display: flex; align-items: center; gap: 16px; transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); }
        .stat-card.total .stat-icon { background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); color: #667eea; }
        .stat-card.pending .stat-icon { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .stat-card.approved .stat-icon { background: rgba(16,185,129,0.1); color: #10b981; }
        .stat-card.rejected .stat-icon { background: rgba(239,68,68,0.1); color: #ef4444; }
        .stat-icon { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
        .stat-icon i { font-size: 24px; }
        .stat-info { flex: 1; }
        .stat-label { font-size: 13px; color: #6c757d; margin-bottom: 4px; display: block; }
        .stat-value { font-size: 28px; font-weight: 700; margin: 0; }
        .text-warning { color: #f59e0b; }
        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }
        
        /* Filter Tabs */
        .filter-tabs { display: flex; gap: 12px; margin-bottom: 28px; background: white; padding: 6px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .filter-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; background: transparent; border: none; border-radius: 12px; font-size: 14px; font-weight: 500; color: #6c757d; transition: all 0.3s ease; cursor: pointer; }
        .filter-tab:hover { background: #f8f9fa; }
        .filter-tab.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .tab-count { background: rgba(0,0,0,0.1); padding: 2px 8px; border-radius: 20px; font-size: 11px; margin-left: 6px; }
        .filter-tab.active .tab-count { background: rgba(255,255,255,0.2); }
        
        /* Content Grid */
        .content-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 24px; }
        .content-card { background: white; border-radius: 20px; overflow: hidden; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .content-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); }
        .content-card-header { padding: 16px 20px; background: #f8f9fa; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center; }
        
        /* Image Preview in Card */
        .content-image-preview { position: relative; height: 160px; overflow: hidden; background: #f8f9fa; }
        .preview-image { width: 100%; height: 100%; object-fit: cover; }
        .image-count-badge { position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
        
        .content-type { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #6c757d; }
        .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
        .status-badge.pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .status-badge.approved { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-badge.rejected { background: rgba(239,68,68,0.1); color: #ef4444; }
        .content-card-body { padding: 16px 20px; border-bottom: 1px solid #e9ecef; }
        .content-id { font-family: monospace; font-size: 12px; color: #6c757d; margin-bottom: 8px; }
        .content-date { font-size: 11px; color: #9ca3af; margin-bottom: 8px; }
        .rejection-reason { background: #fef3c7; padding: 8px 12px; border-radius: 8px; font-size: 12px; color: #92400e; display: flex; align-items: center; gap: 6px; margin-top: 8px; }
        .content-card-footer { padding: 16px 20px; }
        .action-buttons { display: flex; gap: 12px; }
        .btn-approve, .btn-reject, .btn-view { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; border: none; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; }
        .btn-approve { background: rgba(16,185,129,0.1); color: #10b981; }
        .btn-approve:hover { background: #10b981; color: white; }
        .btn-reject { background: rgba(239,68,68,0.1); color: #ef4444; }
        .btn-reject:hover { background: #ef4444; color: white; }
        .btn-view { background: rgba(79,70,229,0.1); color: #4f46e5; }
        .btn-view:hover { background: #4f46e5; color: white; }
        .reviewed-info { font-size: 11px; color: #6c757d; text-align: center; }
        .empty-state { text-align: center; padding: 80px 20px; background: white; border-radius: 24px; }
        .empty-state i { font-size: 64px; color: #cbd5e1; margin-bottom: 16px; display: block; }
        
        /* Images Grid */
        .post-images { margin-top: 20px; }
        .images-label { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 12px; }
        .images-label i { color: #667eea; }
        .images-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
        .image-item { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; cursor: pointer; border: 2px solid #e9ecef; transition: all 0.3s ease; background: #f8f9fa; }
        .image-item:hover { transform: scale(1.02); border-color: #667eea; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .image-item img { width: 100%; height: 100%; object-fit: cover; }
        .image-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; opacity: 0; transition: opacity 0.3s ease; color: white; }
        .image-item:hover .image-overlay { opacity: 1; }
        .image-overlay i { font-size: 24px; }
        .image-overlay span { font-size: 11px; }
        
        /* Full Image Modal */
        .full-image-modal { position: relative; max-width: 90vw; max-height: 90vh; background: #1a1f2e; border-radius: 12px; overflow: hidden; animation: slideUp 0.3s ease; }
        .full-image-modal img { max-width: 100%; max-height: 85vh; display: block; margin: 0 auto; }
        .close-image-btn { position: absolute; top: 16px; right: 16px; width: 40px; height: 40px; background: rgba(0,0,0,0.7); border: none; border-radius: 50%; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
        .close-image-btn:hover { background: rgba(0,0,0,0.9); transform: rotate(90deg); }
        .download-image-btn { position: absolute; bottom: 16px; right: 16px; padding: 8px 16px; background: rgba(0,0,0,0.7); border: none; border-radius: 8px; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; transition: all 0.3s ease; }
        .download-image-btn:hover { background: rgba(0,0,0,0.9); }
        
        /* Modal */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1100; animation: fadeIn 0.2s ease; }
        .modal-container { background: white; border-radius: 24px; width: 90%; max-width: 550px; animation: slideUp 0.3s ease; overflow: hidden; max-height: 90vh; overflow-y: auto; }
        .modal-container.modal-lg { max-width: 800px; }
        .modal-container.modal-reject { max-width: 600px; }
        .modal-header { padding: 24px 24px 16px; display: flex; align-items: center; gap: 12px; position: relative; border-bottom: 1px solid #e9ecef; }
        .modal-header.warning .modal-icon { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .modal-header.info .modal-icon { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .modal-icon { width: 48px; height: 48px; border-radius: 24px; display: flex; align-items: center; justify-content: center; }
        .modal-icon i { font-size: 24px; }
        .modal-header h3 { margin: 0; font-size: 18px; font-weight: 600; }
        .modal-close { position: absolute; right: 20px; top: 20px; background: none; border: none; font-size: 18px; cursor: pointer; color: #9ca3af; }
        .modal-body { padding: 24px; }
        
        /* Details Section */
        .details-section { margin-bottom: 28px; }
        .details-section h4 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #1f2937; }
        .details-section h4 i { margin-right: 8px; color: #4f46e5; }
        .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .detail-item label { font-size: 11px; font-weight: 600; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; display: block; }
        .detail-item code { background: #f8f9fa; padding: 4px 8px; border-radius: 6px; font-size: 12px; }
        
        /* Author Info */
        .author-info { display: flex; gap: 16px; padding: 16px; background: #f8f9fa; border-radius: 16px; }
        .author-avatar { width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .author-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .author-avatar i { font-size: 32px; color: white; }
        .author-name { font-weight: 600; font-size: 16px; color: #1f2937; margin-bottom: 4px; }
        .author-email { font-size: 12px; color: #6c757d; margin-bottom: 2px; }
        .author-id { font-size: 10px; color: #9ca3af; font-family: monospace; }
        
        /* Post Content */
        .post-title { font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #1f2937; }
        .post-content { background: #f8f9fa; padding: 16px; border-radius: 12px; margin-bottom: 16px; line-height: 1.6; color: #4b5563; }
        .post-category { font-size: 12px; color: #6c757d; margin-top: 12px; }
        .comment-text { background: #f8f9fa; padding: 16px; border-radius: 12px; line-height: 1.6; color: #4b5563; }
        .comment-post { background: #e7f1ff; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; color: #0d6efd; }
        .rejection-box { background: #fef3c7; padding: 12px; border-radius: 8px; color: #92400e; }
        .moderation-info { background: #f8f9fa; padding: 12px; border-radius: 8px; font-size: 13px; }
        
        /* Quick Reasons */
        .quick-reasons { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
        .quick-reason-btn { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 12px; cursor: pointer; transition: all 0.3s ease; position: relative; }
        .quick-reason-btn:hover { background: #e9ecef; transform: translateY(-2px); }
        .quick-reason-btn.selected { background: #fef3c7; border-color: #f59e0b; }
        .quick-reason-btn i { font-size: 18px; color: var(--reason-color); }
        .quick-reason-btn .check-icon { position: absolute; right: 12px; top: 12px; color: #10b981; font-size: 16px; }
        .custom-reason { margin-top: 20px; }
        .form-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #374151; }
        .form-textarea { width: 100%; padding: 12px; border: 2px solid #e9ecef; border-radius: 12px; font-size: 14px; resize: vertical; }
        .form-textarea:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
        .warning-message { background: #fff3cd; padding: 12px; border-radius: 12px; margin-top: 16px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #856404; }
        
        /* Modal Footer Buttons */
        .modal-footer { padding: 16px 24px 24px; display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid #e9ecef; }
        .btn-secondary { padding: 10px 20px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 10px; cursor: pointer; font-weight: 500; }
        .btn-primary { padding: 10px 24px; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; }
        .btn-primary.danger { background: #ef4444; color: white; }
        .btn-primary.danger:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-approve-modal { padding: 10px 24px; background: #10b981; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; }
        .btn-reject-modal { padding: 10px 24px; background: #ef4444; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .filter-tabs { flex-wrap: wrap; }
          .filter-tab { flex: auto; }
          .content-grid { grid-template-columns: 1fr; }
          .details-grid { grid-template-columns: 1fr; }
          .quick-reasons { grid-template-columns: 1fr; }
          .author-info { flex-direction: column; text-align: center; }
          .images-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
        }
      `}</style>
    </AdminLayout>
  )
}