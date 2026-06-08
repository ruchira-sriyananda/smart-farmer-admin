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
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [addingComment, setAddingComment] = useState(false)
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

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null
    if (imagePath.startsWith('http')) return imagePath
    try {
      const { data } = supabase.storage.from('post-images').getPublicUrl(imagePath)
      return data?.publicUrl || imagePath
    } catch {
      return imagePath
    }
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

      // Fetch images for each post
      const postsWithImages = await Promise.all((data || []).map(async (post) => {
        if (post.content_type === 'POST') {
          const { data: images, error: imagesError } = await supabase
            .from('post_images')
            .select('image_url, image_order')
            .eq('post_id', post.content_id)
            .order('image_order', { ascending: true })

          let imageUrls = []
          if (!imagesError && images && images.length > 0) {
            imageUrls = images.map(img => getImageUrl(img.image_url))
          } else if (post.image_url) {
            imageUrls = [getImageUrl(post.image_url)]
          }
          return { ...post, images: imageUrls, image_count: imageUrls.length }
        }
        return { ...post, images: [], image_count: 0 }
      }))

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
        // First fetch the post
        const { data, error } = await supabase
          .from('posts')
          .select(`
            *,
            users!posts_user_id_fkey (
              user_id,
              full_name,
              email,
              profile_image,
              phone,
              location
            ),
            post_categories!posts_category_id_fkey (
              category_name,
              description
            )
          `)
          .eq('post_id', contentId)
          .single()
        
        if (!error && data) {
          // Fetch images from post_images table
          const { data: images, error: imagesError } = await supabase
            .from('post_images')
            .select('image_url, image_order')
            .eq('post_id', contentId)
            .order('image_order', { ascending: true })
          
          const imageUrls = []
          if (!imagesError && images && images.length > 0) {
            for (const img of images) {
              const url = getImageUrl(img.image_url)
              if (url) imageUrls.push(url)
            }
          } else if (data.image_url) {
            const url = getImageUrl(data.image_url)
            if (url) imageUrls.push(url)
          }
          
          details = { ...data, images: imageUrls, image_count: imageUrls.length }
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
              title,
              content
            )
          `)
          .eq('comment_id', contentId)
          .single()
        
        if (!error && data) details = data
      }
      
      setPostDetails(details)
      
      // Fetch comments for this post
      if (contentType === 'POST') {
        await fetchComments(contentId)
      }
    } catch (err) {
      console.error('Error fetching post details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  const fetchComments = async (postId) => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          users!comments_user_id_fkey (
            user_id,
            full_name,
            email,
            profile_image
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setComments(data)
      } else {
        setComments([])
      }
    } catch (err) {
      console.error('Error fetching comments:', err)
      setComments([])
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
      await fetchPosts()
      await fetchStats()
      setShowRejectModal(false)
      setRejectReason('')
      setCustomReason('')
      setSelectedPost(null)
      if (showDetailsModal) setShowDetailsModal(false)
      alert(`Content ${status.toLowerCase()} successfully!`)
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
          <h3>Unable to Load Content</h3>
          <p>{error}</p>
          <button className="btn-primary" onClick={fetchPosts}>Try Again</button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Content Moderation">
      <div className="moderation-container">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-content">
            <div className="hero-icon">
              <i className="bi bi-shield-check"></i>
            </div>
            <div>
              <h1 className="hero-title">Content Moderation</h1>
              <p className="hero-subtitle">Review and manage user-generated content</p>
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
            <i className="bi bi-grid"></i> All
            <span className="count">{stats.total}</span>
          </button>
          <button className={`filter-tab ${filter === 'PENDING' ? 'active' : ''}`} onClick={() => setFilter('PENDING')}>
            <i className="bi bi-hourglass-split"></i> Pending
            <span className="count pending">{stats.pending}</span>
          </button>
          <button className={`filter-tab ${filter === 'APPROVED' ? 'active' : ''}`} onClick={() => setFilter('APPROVED')}>
            <i className="bi bi-check-circle"></i> Approved
            <span className="count approved">{stats.approved}</span>
          </button>
          <button className={`filter-tab ${filter === 'REJECTED' ? 'active' : ''}`} onClick={() => setFilter('REJECTED')}>
            <i className="bi bi-x-circle"></i> Rejected
            <span className="count rejected">{stats.rejected}</span>
          </button>
        </div>

        {/* Posts Grid */}
        <div className="posts-grid">
          {posts.length > 0 ? (
            posts.map((post, index) => (
              <div key={post.moderation_id} className="post-card" style={{ animationDelay: `${index * 0.05}s` }}>
                <div className="post-card-header">
                  <div className="post-type">
                    <i className={`bi ${getContentTypeIcon(post.content_type)}`}></i>
                    <span>{post.content_type}</span>
                  </div>
                  {getStatusBadge(post.moderation_status)}
                </div>
                
                {post.images && post.images.length > 0 && (
                  <div className="post-image-preview" onClick={() => openFullImage(post.images[0])}>
                    <img src={post.images[0]} alt="Preview" />
                    {post.images.length > 1 && (
                      <div className="image-count-badge">
                        <i className="bi bi-images"></i> +{post.images.length - 1}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="post-card-body">
                  <div className="post-meta">
                    <span className="post-id">
                      <i className="bi bi-hash"></i> {post.content_id?.slice(0, 12)}...
                    </span>
                    <span className="post-date">
                      <i className="bi bi-calendar3"></i> {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {post.moderation_reason && (
                    <div className="rejection-badge">
                      <i className="bi bi-exclamation-triangle-fill"></i>
                      <span>{post.moderation_reason}</span>
                    </div>
                  )}
                </div>
                
                <div className="post-card-footer">
                  {post.moderation_status === 'PENDING' ? (
                    <div className="action-group">
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
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon">
                  <i className="bi bi-file-text-fill"></i>
                </div>
                <div>
                  <h2>Content Details</h2>
                  <p>Complete information about this content</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            
            <div className="modal-body">
              {loadingDetails ? (
                <div className="loading-details">
                  <div className="spinner-border text-primary"></div>
                  <p>Loading content details...</p>
                </div>
              ) : (
                <>
                  {/* Content Info Section */}
                  <div className="info-section">
                    <h4><i className="bi bi-info-circle"></i> Content Information</h4>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>Content ID</label>
                        <code>{selectedPost.content_id}</code>
                      </div>
                      <div className="info-item">
                        <label>Content Type</label>
                        <span className="badge-type">{selectedPost.content_type}</span>
                      </div>
                      <div className="info-item">
                        <label>Status</label>
                        {getStatusBadge(selectedPost.moderation_status)}
                      </div>
                      <div className="info-item">
                        <label>Created At</label>
                        <span>{new Date(selectedPost.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Author Information */}
                  {postDetails && postDetails.users && (
                    <div className="info-section">
                      <h4><i className="bi bi-person-badge"></i> Author Information</h4>
                      <div className="author-card">
                        <div className="author-avatar">
                          {postDetails.users.profile_image ? (
                            <img src={getImageUrl(postDetails.users.profile_image)} alt={postDetails.users.full_name} />
                          ) : (
                            <i className="bi bi-person-circle"></i>
                          )}
                        </div>
                        <div className="author-details">
                          <div className="author-name">{postDetails.users.full_name || 'Unknown User'}</div>
                          <div className="author-email">{postDetails.users.email || 'No email'}</div>
                          {postDetails.users.phone && (
                            <div className="author-phone"><i className="bi bi-telephone"></i> {postDetails.users.phone}</div>
                          )}
                          {postDetails.users.location && (
                            <div className="author-location"><i className="bi bi-geo-alt"></i> {postDetails.users.location}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Post Content with Images */}
                  {selectedPost.content_type === 'POST' && postDetails && (
                    <div className="info-section">
                      <h4><i className="bi bi-file-text"></i> Post Content</h4>
                      <div className="post-title">{postDetails.title}</div>
                      <div className="post-content">{postDetails.content}</div>
                      
                      {/* All Images Gallery - FIXED */}
                      {postDetails.images && postDetails.images.length > 0 && (
                        <div className="images-section">
                          <h5><i className="bi bi-images"></i> Attached Images ({postDetails.images.length})</h5>
                          <div className="images-grid">
                            {postDetails.images.map((img, idx) => (
                              <div key={idx} className="image-card" onClick={() => openFullImage(img)}>
                                <img src={img} alt={`Image ${idx + 1}`} onError={(e) => {
                                  e.target.src = 'https://placehold.co/400x300/e2e8f0/64748b?text=Image+Not+Found'
                                }} />
                                <div className="image-overlay">
                                  <i className="bi bi-zoom-in"></i>
                                  <span>Click to enlarge</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Show message if no images */}
                      {(!postDetails.images || postDetails.images.length === 0) && (
                        <div className="no-images-message">
                          <i className="bi bi-image-slash"></i>
                          <span>No images attached to this post</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comment Content */}
                  {selectedPost.content_type === 'COMMENT' && postDetails && (
                    <div className="info-section">
                      <h4><i className="bi bi-chat"></i> Comment Content</h4>
                      <div className="comment-post-info">
                        <i className="bi bi-file-post"></i> On Post: <strong>{postDetails.posts?.title || 'Unknown Post'}</strong>
                      </div>
                      <div className="comment-text">{postDetails.comment_text}</div>
                    </div>
                  )}

                  {/* Comments Section for Posts - Read Only */}
                  {selectedPost.content_type === 'POST' && (
                    <div className="comments-section">
                      <h4><i className="bi bi-chat-dots"></i> Comments ({comments.length})</h4>
                      
                      {/* Comments List */}
                      <div className="comments-list">
                        {comments.length > 0 ? (
                          comments.map((comment) => (
                            <div key={comment.comment_id} className="comment-item">
                              <div className="comment-avatar">
                                {comment.users?.profile_image ? (
                                  <img src={getImageUrl(comment.users.profile_image)} alt={comment.users.full_name} />
                                ) : (
                                  <i className="bi bi-person-circle"></i>
                                )}
                              </div>
                              <div className="comment-content">
                                <div className="comment-header">
                                  <span className="comment-author">{comment.users?.full_name || 'Anonymous'}</span>
                                  <span className="comment-time">{new Date(comment.created_at).toLocaleString()}</span>
                                </div>
                                <div className="comment-text">{comment.comment_text}</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="no-comments">
                            <i className="bi bi-chat"></i>
                            <p>No comments yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {selectedPost.moderation_reason && (
                    <div className="info-section rejection">
                      <h4><i className="bi bi-exclamation-triangle"></i> Rejection Reason</h4>
                      <div className="rejection-box">{selectedPost.moderation_reason}</div>
                    </div>
                  )}

                  {/* Moderation Info */}
                  {selectedPost.reviewed_by_admin && (
                    <div className="info-section">
                      <h4><i className="bi bi-person-check"></i> Moderation Information</h4>
                      <div className="moderation-info">
                        <div>Reviewed by: <strong>{selectedPost.reviewed_by_admin?.full_name}</strong></div>
                        <div>Reviewed at: {new Date(selectedPost.reviewed_at).toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="modal-footer">
              {selectedPost.moderation_status === 'PENDING' && (
                <div className="footer-actions">
                  <button className="btn-approve-modal" onClick={() => handleApprove(selectedPost)}>
                    <i className="bi bi-check-lg"></i> Approve
                  </button>
                  <button className="btn-reject-modal" onClick={() => {
                    setShowDetailsModal(false)
                    setShowRejectModal(true)
                  }}>
                    <i className="bi bi-x-lg"></i> Reject
                  </button>
                </div>
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
            <button className="close-image" onClick={() => setShowFullImage(false)}>
              <i className="bi bi-x-lg"></i>
            </button>
            <img src={selectedImage} alt="Full size" />
            <div className="image-actions">
              <button onClick={() => window.open(selectedImage, '_blank')}>
                <i className="bi bi-box-arrow-up-right"></i> Open in new tab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedPost && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-container modal-reject" onClick={(e) => e.stopPropagation()}>
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
              <p>Please select a reason for rejecting this content:</p>
              
              <div className="quick-reasons">
                {quickReasons.map((reason) => (
                  <button
                    key={reason.id}
                    className={`quick-reason ${rejectReason === reason.reason ? 'selected' : ''}`}
                    onClick={() => {
                      setRejectReason(reason.reason)
                      setCustomReason('')
                    }}
                    style={{ '--reason-color': reason.color }}
                  >
                    <i className={`bi ${reason.icon}`}></i>
                    <span>{reason.reason}</span>
                    {rejectReason === reason.reason && <i className="bi bi-check-circle-fill check"></i>}
                  </button>
                ))}
              </div>

              <div className="custom-reason">
                <label>Or provide a custom reason:</label>
                <textarea
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
                <div className="warning-note">
                  <i className="bi bi-info-circle"></i>
                  Please select or provide a reason for rejection
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button 
                className="btn-danger" 
                onClick={handleReject}
                disabled={actionLoading || (!rejectReason && !customReason)}
              >
                {actionLoading ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .moderation-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .hero-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 24px;
          padding: 40px 32px;
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
          align-items: center;
          gap: 20px;
          position: relative;
          z-index: 1;
        }

        .hero-icon {
          width: 60px;
          height: 60px;
          background: rgba(255,255,255,0.2);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hero-icon i {
          font-size: 28px;
          color: white;
        }

        .hero-title {
          font-size: 28px;
          font-weight: 700;
          color: white;
          margin: 0 0 8px 0;
        }

        .hero-subtitle {
          font-size: 14px;
          color: rgba(255,255,255,0.9);
          margin: 0;
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
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
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

        .stat-card.total .stat-icon { background: linear-gradient(135deg, #667eea20, #764ba220); color: #667eea; }
        .stat-card.pending .stat-icon { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .stat-card.approved .stat-icon { background: rgba(16,185,129,0.1); color: #10b981; }
        .stat-card.rejected .stat-icon { background: rgba(239,68,68,0.1); color: #ef4444; }

        .stat-info { flex: 1; }
        .stat-label { font-size: 13px; color: #6c757d; display: block; margin-bottom: 4px; }
        .stat-value { font-size: 28px; font-weight: 700; margin: 0; }
        .text-warning { color: #f59e0b; }
        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }

        .filter-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 28px;
          background: white;
          padding: 6px;
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
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
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .filter-tab:hover { background: #f8f9fa; }
        .filter-tab.active { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
        .count { background: rgba(0,0,0,0.1); padding: 2px 8px; border-radius: 20px; font-size: 11px; }
        .filter-tab.active .count { background: rgba(255,255,255,0.2); }

        .posts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
        }

        .post-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          animation: fadeInUp 0.4s ease backwards;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .post-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); }

        .post-card-header {
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .post-type {
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

        .status-badge.pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .status-badge.approved { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-badge.rejected { background: rgba(239,68,68,0.1); color: #ef4444; }

        .post-image-preview {
          position: relative;
          height: 180px;
          overflow: hidden;
          cursor: pointer;
        }

        .post-image-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .post-card:hover .post-image-preview img {
          transform: scale(1.05);
        }

        .image-count-badge {
          position: absolute;
          bottom: 12px;
          right: 12px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .post-card-body {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
        }

        .post-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 11px;
          color: #9ca3af;
        }

        .post-meta i { margin-right: 4px; }

        .rejection-badge {
          background: #fef3c7;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          color: #92400e;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .post-card-footer {
          padding: 16px 20px;
        }

        .action-group {
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

        .btn-approve { background: rgba(16,185,129,0.1); color: #10b981; }
        .btn-approve:hover { background: #10b981; color: white; }
        .btn-reject { background: rgba(239,68,68,0.1); color: #ef4444; }
        .btn-reject:hover { background: #ef4444; color: white; }
        .btn-view { background: rgba(79,70,229,0.1); color: #4f46e5; }
        .btn-view:hover { background: #4f46e5; color: white; }

        .reviewed-info {
          text-align: center;
          font-size: 11px;
          color: #6c757d;
        }

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

        .modal-container.modal-lg { max-width: 900px; }
        .modal-container.modal-reject { max-width: 600px; }

        .modal-header {
          padding: 24px 28px 20px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header.warning .modal-icon { background: rgba(245,158,11,0.1); color: #f59e0b; }

        .modal-header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .modal-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #667eea20, #764ba220);
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-icon i { font-size: 24px; color: #667eea; }

        .modal-header h2 { font-size: 20px; margin: 0 0 4px 0; }
        .modal-header p { margin: 0; color: #6c757d; font-size: 13px; }

        .modal-close {
          width: 36px;
          height: 36px;
          background: #f8f9fa;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .modal-close:hover { background: #e9ecef; transform: rotate(90deg); }

        .modal-body { padding: 28px; }
        .modal-footer { padding: 16px 28px 28px; border-top: 1px solid #e9ecef; display: flex; justify-content: flex-end; gap: 12px; }

        .footer-actions { display: flex; gap: 12px; }

        .loading-details { text-align: center; padding: 60px; }

        /* Info Section */
        .info-section { margin-bottom: 28px; }
        .info-section h4 { font-size: 16px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .info-section h4 i { color: #667eea; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .info-item label { display: block; font-size: 11px; font-weight: 600; color: #6c757d; margin-bottom: 4px; }
        .info-item code { background: #f8f9fa; padding: 4px 8px; border-radius: 6px; font-size: 12px; }
        .badge-type { display: inline-block; padding: 4px 12px; background: #e9ecef; border-radius: 12px; font-size: 12px; }

        /* Author Card */
        .author-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 16px;
        }
        .author-avatar {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .author-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .author-avatar i { font-size: 32px; color: white; }
        .author-name { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
        .author-email, .author-phone, .author-location { font-size: 12px; color: #6c757d; margin: 2px 0; }
        .author-email i, .author-phone i, .author-location i { margin-right: 4px; font-size: 11px; }

        /* Post Content */
        .post-title { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
        .post-content { background: #f8f9fa; padding: 16px; border-radius: 12px; line-height: 1.6; margin-bottom: 16px; }

        /* Images Section */
        .images-section { margin-top: 20px; }
        .images-section h5 { font-size: 14px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .images-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
        .image-card {
          position: relative;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid #e9ecef;
          transition: all 0.3s ease;
          background: #f8f9fa;
        }
        .image-card:hover { transform: scale(1.02); border-color: #667eea; }
        .image-card img { width: 100%; height: 100%; object-fit: cover; }
        .image-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          opacity: 0;
          transition: opacity 0.3s ease;
          color: white;
        }
        .image-card:hover .image-overlay { opacity: 1; }
        .image-overlay i { font-size: 24px; }
        .image-overlay span { font-size: 11px; }

        .no-images-message {
          text-align: center;
          padding: 40px;
          background: #f8f9fa;
          border-radius: 12px;
          color: #9ca3af;
        }
        .no-images-message i { font-size: 32px; margin-bottom: 8px; display: block; }

        /* Comments Section */
        .comments-section { margin-top: 28px; }
        .comments-section h4 { font-size: 16px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }

        .comments-list { max-height: 400px; overflow-y: auto; }
        .comment-item { display: flex; gap: 12px; padding: 16px; background: #f8f9fa; border-radius: 16px; margin-bottom: 12px; }
        .comment-avatar { width: 40px; height: 40px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .comment-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .comment-avatar i { font-size: 20px; color: white; }
        .comment-content { flex: 1; }
        .comment-header { display: flex; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
        .comment-author { font-weight: 600; font-size: 13px; }
        .comment-time { font-size: 11px; color: #9ca3af; }
        .comment-text { font-size: 13px; color: #4b5563; line-height: 1.5; }

        .no-comments { text-align: center; padding: 40px; color: #9ca3af; }
        .no-comments i { font-size: 48px; margin-bottom: 12px; display: block; }

        /* Rejection Box */
        .rejection-box { background: #fef3c7; padding: 12px; border-radius: 8px; color: #92400e; }
        .moderation-info { background: #f8f9fa; padding: 12px; border-radius: 8px; font-size: 13px; }

        /* Quick Reasons */
        .quick-reasons { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
        .quick-reason {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #f8f9fa;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }
        .quick-reason:hover { background: #e9ecef; transform: translateY(-2px); }
        .quick-reason.selected { background: #fef3c7; border-color: #f59e0b; }
        .quick-reason i { font-size: 18px; color: var(--reason-color); }
        .quick-reason .check { position: absolute; right: 12px; top: 12px; color: #10b981; font-size: 16px; }

        .custom-reason { margin-top: 20px; }
        .custom-reason label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
        .custom-reason textarea { width: 100%; padding: 12px; border: 2px solid #e9ecef; border-radius: 12px; font-size: 14px; resize: vertical; }
        .custom-reason textarea:focus { outline: none; border-color: #667eea; }

        .warning-note { background: #fff3cd; padding: 12px; border-radius: 12px; margin-top: 16px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #856404; }

        /* Full Image Modal */
        .full-image-modal {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
          background: #1a1f2e;
          border-radius: 12px;
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }
        .full-image-modal img { max-width: 100%; max-height: 85vh; display: block; margin: 0 auto; }
        .close-image {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 40px;
          height: 40px;
          background: rgba(0,0,0,0.7);
          border: none;
          border-radius: 50%;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }
        .close-image:hover { background: rgba(0,0,0,0.9); transform: rotate(90deg); }
        .image-actions { position: absolute; bottom: 16px; right: 16px; }
        .image-actions button { padding: 8px 16px; background: rgba(0,0,0,0.7); border: none; border-radius: 8px; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; transition: all 0.3s ease; }
        .image-actions button:hover { background: rgba(0,0,0,0.9); }

        /* Buttons */
        .btn-secondary { padding: 10px 20px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 10px; cursor: pointer; font-weight: 500; }
        .btn-primary { padding: 10px 24px; background: #4f46e5; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; }
        .btn-danger { padding: 10px 24px; background: #ef4444; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; }
        .btn-approve-modal { padding: 10px 24px; background: #10b981; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; }
        .btn-reject-modal { padding: 10px 24px; background: #ef4444; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 1200px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .posts-grid { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }
        }

        @media (max-width: 768px) {
          .moderation-container { padding: 0 16px; }
          .hero-section { padding: 32px 24px; }
          .hero-content { flex-direction: column; text-align: center; }
          .stats-grid { grid-template-columns: 1fr; }
          .filter-tabs { flex-wrap: wrap; }
          .filter-tab { flex: auto; }
          .posts-grid { grid-template-columns: 1fr; }
          .info-grid { grid-template-columns: 1fr; }
          .images-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
          .quick-reasons { grid-template-columns: 1fr; }
          .author-card { flex-direction: column; text-align: center; }
          .footer-actions { flex-direction: column; }
          .btn-approve-modal, .btn-reject-modal { width: 100%; }
          .action-group { flex-direction: column; }
        }
      `}</style>
    </AdminLayout>
  )
}