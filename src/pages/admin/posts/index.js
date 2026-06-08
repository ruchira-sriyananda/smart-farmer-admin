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
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  })

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
    if (imagePath.startsWith('/')) return imagePath
    return imagePath
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

      const postsWithDetails = await Promise.all((data || []).map(async (post) => {
        let postData = null
        let userData = null
        let images = []
        let postExists = true
        
        if (post.content_type === 'POST' && post.content_id) {
          const { data: postDataResult, error: postError } = await supabase
            .from('posts')
            .select('*')
            .eq('post_id', post.content_id)
            .maybeSingle()
          
          if (postError) {
            console.error(`Error fetching post ${post.content_id}:`, postError)
            postExists = false
          }
          
          if (postDataResult) {
            postData = postDataResult
            
            const { data: imagesData, error: imagesError } = await supabase
              .from('post_images')
              .select('image_url, image_order')
              .eq('post_id', post.content_id)
              .order('image_order', { ascending: true })
            
            if (!imagesError && imagesData && imagesData.length > 0) {
              images = imagesData.map(img => getImageUrl(img.image_url))
            } else if (postDataResult.image_url) {
              images = [getImageUrl(postDataResult.image_url)]
            }
            
            const userId = postDataResult.user_id || post.user_id
            
            if (userId) {
              // Try to get user from users table
              const { data: userResult, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle()
              
              if (userError) {
                console.error(`Error fetching user ${userId}:`, userError)
              }
              
              if (userResult) {
                userData = userResult
              } else {
                // Try admin_users table
                const { data: adminResult } = await supabase
                  .from('admin_users')
                  .select('*')
                  .eq('admin_id', userId)
                  .maybeSingle()
                
                if (adminResult) {
                  userData = adminResult
                }
              }
            }
          } else {
            postExists = false
          }
        }
        
        return { 
          ...post, 
          title: postData?.title || (postExists ? 'Untitled Post' : 'Post Deleted'),
          content: postData?.content || (postExists ? 'No content available' : 'This post has been deleted'),
          images: images,
          image_count: images.length,
          cover_image: images[0] || null,
          post_created_at: postData?.created_at || post.created_at,
          user: userData,
          author_name: userData?.full_name || userData?.name || 'User',
          author_email: userData?.email || 'Email not available',
          author_phone: userData?.phone || null,
          author_location: userData?.location || userData?.district || null,
          author_joined: userData?.created_at || null,
          user_id: userData?.user_id || post.user_id,
          post_exists: postExists
        }
      }))

      setPosts(postsWithDetails || [])
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
    setPostDetails(null)
    
    try {
      let details = null
      
      if (contentType === 'POST' && contentId) {
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select('*')
          .eq('post_id', contentId)
          .maybeSingle()
        
        if (postData) {
          const { data: imagesData, error: imagesError } = await supabase
            .from('post_images')
            .select('image_url, image_order')
            .eq('post_id', contentId)
            .order('image_order', { ascending: true })
          
          let images = []
          if (!imagesError && imagesData && imagesData.length > 0) {
            images = imagesData.map(img => getImageUrl(img.image_url))
          } else if (postData.image_url) {
            images = [getImageUrl(postData.image_url)]
          }
          
          let userData = null
          const userId = postData.user_id
          
          if (userId) {
            // First try users table
            const { data: userResult, error: userError } = await supabase
              .from('users')
              .select('*')
              .eq('user_id', userId)
              .maybeSingle()
            
            if (userError) {
              console.error('Error fetching user:', userError)
            }
            
            if (userResult) {
              userData = userResult
            } else {
              // Try admin_users table
              const { data: adminResult } = await supabase
                .from('admin_users')
                .select('*')
                .eq('admin_id', userId)
                .maybeSingle()
              
              if (adminResult) {
                userData = adminResult
              }
            }
          }
          
          let categoryData = null
          if (postData.category_id) {
            const { data: catResult } = await supabase
              .from('post_categories')
              .select('category_name, description')
              .eq('category_id', postData.category_id)
              .maybeSingle()
            
            if (catResult) {
              categoryData = catResult
            }
          }
          
          details = { 
            ...postData, 
            images: images,
            image_count: images.length,
            user: userData,
            category: categoryData
          }
        }
      }
      
      setPostDetails(details)
    } catch (err) {
      console.error('Error fetching post details:', err)
      setPostDetails(null)
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

  const openFullImage = (imageUrl, index) => {
    setSelectedImage(imageUrl)
    setCurrentImageIndex(index)
    setShowFullImage(true)
  }

  const nextImage = () => {
    if (postDetails && postDetails.images && currentImageIndex < postDetails.images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1)
      setSelectedImage(postDetails.images[currentImageIndex + 1])
    }
  }

  const prevImage = () => {
    if (postDetails && postDetails.images && currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1)
      setSelectedImage(postDetails.images[currentImageIndex - 1])
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Date not available'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Date not available'
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch (e) {
      return 'Date not available'
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      'PENDING': <span className="status-badge pending"><i className="bi bi-clock-history"></i> Pending Review</span>,
      'APPROVED': <span className="status-badge approved"><i className="bi bi-check-circle-fill"></i> Approved</span>,
      'REJECTED': <span className="status-badge rejected"><i className="bi bi-x-circle-fill"></i> Rejected</span>
    }
    return badges[status] || <span className="status-badge default">{status}</span>
  }

  if (loading) {
    return (
      <AdminLayout title="Content Moderation">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading content...</p>
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
              <span className="stat-label">Total</span>
              <h2>{stats.total}</h2>
              <span className="stat-trend">All content</span>
            </div>
          </div>
          <div className="stat-card pending">
            <div className="stat-icon"><i className="bi bi-hourglass-split"></i></div>
            <div className="stat-info">
              <span className="stat-label">Pending</span>
              <h2 className="text-warning">{stats.pending}</h2>
              <span className="stat-trend">Awaiting review</span>
            </div>
          </div>
          <div className="stat-card approved">
            <div className="stat-icon"><i className="bi bi-check-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Approved</span>
              <h2 className="text-success">{stats.approved}</h2>
              <span className="stat-trend">Published</span>
            </div>
          </div>
          <div className="stat-card rejected">
            <div className="stat-icon"><i className="bi bi-x-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Rejected</span>
              <h2 className="text-danger">{stats.rejected}</h2>
              <span className="stat-trend">Not approved</span>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="filter-section">
          <div className="filter-buttons">
            <button className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
              <i className="bi bi-grid"></i>
              <span>All Content</span>
              <span className="filter-count">{stats.total}</span>
            </button>
            <button className={`filter-btn ${filter === 'PENDING' ? 'active' : ''}`} onClick={() => setFilter('PENDING')}>
              <i className="bi bi-hourglass-split"></i>
              <span>Pending</span>
              <span className="filter-count warning">{stats.pending}</span>
            </button>
            <button className={`filter-btn ${filter === 'APPROVED' ? 'active' : ''}`} onClick={() => setFilter('APPROVED')}>
              <i className="bi bi-check-circle"></i>
              <span>Approved</span>
              <span className="filter-count success">{stats.approved}</span>
            </button>
            <button className={`filter-btn ${filter === 'REJECTED' ? 'active' : ''}`} onClick={() => setFilter('REJECTED')}>
              <i className="bi bi-x-circle"></i>
              <span>Rejected</span>
              <span className="filter-count danger">{stats.rejected}</span>
            </button>
          </div>
        </div>

        {/* Posts Grid */}
        <div className="posts-grid">
          {posts.length > 0 ? (
            posts.map((post, index) => (
              <div key={post.moderation_id} className="post-card" style={{ animationDelay: `${index * 0.05}s` }}>
                {/* User Info */}
                <div className="post-user">
                  <div className="user-avatar">
                    {post.user?.profile_image ? (
                      <img src={getImageUrl(post.user.profile_image)} alt={post.user.full_name} />
                    ) : (
                      <span>{post.author_name?.charAt(0) || 'U'}</span>
                    )}
                    <div className={`user-status ${post.moderation_status === 'PENDING' ? 'pending' : post.moderation_status === 'APPROVED' ? 'approved' : 'rejected'}`}></div>
                  </div>
                  <div className="user-info">
                    <h4>{post.author_name}</h4>
                    <p>{post.author_email}</p>
                    {post.author_location && (
                      <span className="user-location"><i className="bi bi-geo-alt"></i> {post.author_location}</span>
                    )}
                  </div>
                  {getStatusBadge(post.moderation_status)}
                </div>

                {/* Images */}
                {post.images && post.images.length > 0 && (
                  <div className="post-images">
                    <div className="images-grid">
                      {post.images.slice(0, 3).map((img, idx) => (
                        <div key={idx} className="image-item" onClick={() => openFullImage(img, idx)}>
                          <img src={img} alt={`Image ${idx + 1}`} />
                          <div className="image-overlay">
                            <i className="bi bi-zoom-in"></i>
                          </div>
                        </div>
                      ))}
                      {post.images.length > 3 && (
                        <div className="more-images" onClick={() => viewDetails(post)}>
                          <i className="bi bi-images"></i>
                          <span>+{post.images.length - 3}</span>
                        </div>
                      )}
                    </div>
                    <div className="image-count">
                      <i className="bi bi-images"></i> {post.images.length} image{post.images.length > 1 ? 's' : ''}
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="post-content">
                  <h3>{post.title}</h3>
                  <p>{post.content?.substring(0, 100)}...</p>
                  <div className="post-meta">
                    <span><i className="bi bi-calendar3"></i> {new Date(post.post_created_at).toLocaleDateString()}</span>
                    <span><i className="bi bi-clock"></i> {new Date(post.post_created_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="post-actions">
                  <button className="btn-view" onClick={() => viewDetails(post)}>
                    <i className="bi bi-eye"></i> View Details
                  </button>
                  {post.moderation_status === 'PENDING' && post.post_exists !== false && (
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
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <i className="bi bi-inbox"></i>
              </div>
              <h3>No content found</h3>
              <p>There are no {filter.toLowerCase()} content items to display.</p>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal with Proper User Data */}
      {showDetailsModal && selectedPost && postDetails && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
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
                  {/* Images Gallery */}
                  {postDetails.images && postDetails.images.length > 0 && (
                    <div className="modal-images">
                      <h4><i className="bi bi-images"></i> Images ({postDetails.images.length})</h4>
                      <div className="modal-images-grid">
                        {postDetails.images.map((img, idx) => (
                          <div key={idx} className="modal-image" onClick={() => openFullImage(img, idx)}>
                            <img src={img} alt={`Image ${idx + 1}`} />
                            <div className="modal-image-overlay">
                              <i className="bi bi-zoom-in"></i>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Author Info - Now with proper data from Supabase */}
                  <div className="modal-section">
                    <h4><i className="bi bi-person-badge"></i> Author Information</h4>
                    <div className="author-card">
                      <div className="author-avatar">
                        {postDetails.user?.profile_image ? (
                          <img src={getImageUrl(postDetails.user.profile_image)} alt={postDetails.user.full_name} />
                        ) : (
                          <span>{postDetails.user?.full_name?.charAt(0) || postDetails.user?.name?.charAt(0) || 'U'}</span>
                        )}
                      </div>
                      <div className="author-details">
                        <h5>{postDetails.user?.full_name || postDetails.user?.name || 'User'}</h5>
                        <p><i className="bi bi-envelope"></i> {postDetails.user?.email || 'Email not available'}</p>
                        {postDetails.user?.phone && <p><i className="bi bi-telephone"></i> {postDetails.user.phone}</p>}
                        {postDetails.user?.location && <p><i className="bi bi-geo-alt"></i> {postDetails.user.location}</p>}
                        <p><i className="bi bi-calendar-check"></i> Joined: {formatDate(postDetails.user?.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Content Info */}
                  <div className="modal-section">
                    <h4><i className="bi bi-info-circle"></i> Content Information</h4>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>Content ID</label>
                        <code>{selectedPost.content_id}</code>
                      </div>
                      <div className="info-item">
                        <label>Status</label>
                        {getStatusBadge(selectedPost.moderation_status)}
                      </div>
                      <div className="info-item">
                        <label>Created</label>
                        <span>{new Date(selectedPost.created_at).toLocaleString()}</span>
                      </div>
                      {selectedPost.reviewed_at && (
                        <div className="info-item">
                          <label>Reviewed</label>
                          <span>{new Date(selectedPost.reviewed_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Post Content */}
                  <div className="modal-section">
                    <h4><i className="bi bi-file-text"></i> Post Content</h4>
                    <div className="post-title">{postDetails.title}</div>
                    <div className="post-body">{postDetails.content}</div>
                  </div>

                  {/* Category */}
                  {postDetails.category?.category_name && (
                    <div className="modal-section">
                      <h4><i className="bi bi-tag"></i> Category</h4>
                      <div className="category-badge">{postDetails.category.category_name}</div>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {selectedPost.moderation_reason && (
                    <div className="modal-section rejection">
                      <h4><i className="bi bi-exclamation-triangle"></i> Rejection Reason</h4>
                      <div className="rejection-box">{selectedPost.moderation_reason}</div>
                    </div>
                  )}

                  {/* Moderation Info */}
                  {selectedPost.reviewed_by_admin && (
                    <div className="modal-section">
                      <h4><i className="bi bi-person-check"></i> Moderation Information</h4>
                      <div className="moderation-box">
                        <p>Reviewed by: <strong>{selectedPost.reviewed_by_admin?.full_name}</strong></p>
                        <p>Reviewed at: {new Date(selectedPost.reviewed_at).toLocaleString()}</p>
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
              <button className="btn-close" onClick={() => setShowDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {showFullImage && selectedImage && postDetails && (
        <div className="lightbox-overlay" onClick={() => setShowFullImage(false)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setShowFullImage(false)}>
              <i className="bi bi-x-lg"></i>
            </button>
            
            {postDetails.images && postDetails.images.length > 1 && (
              <>
                <button className="lightbox-prev" onClick={prevImage}>
                  <i className="bi bi-chevron-left"></i>
                </button>
                <button className="lightbox-next" onClick={nextImage}>
                  <i className="bi bi-chevron-right"></i>
                </button>
                <div className="lightbox-counter">
                  {currentImageIndex + 1} / {postDetails.images.length}
                </div>
              </>
            )}
            
            <img src={selectedImage} alt="Full size" />
            
            <div className="lightbox-actions">
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
          padding: 24px;
        }

        .loading-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 3px solid #e2e8f0;
          border-top-color: #4f46e5;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .hero-section {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
          border-radius: 24px;
          padding: 40px;
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
          background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
          animation: pulse 8s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }

        .hero-content {
          display: flex;
          align-items: center;
          gap: 24px;
          position: relative;
          z-index: 1;
        }

        .hero-icon {
          width: 64px;
          height: 64px;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hero-icon i {
          font-size: 32px;
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
          color: rgba(255,255,255,0.8);
          margin: 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: white;
          border-radius: 20px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.02);
        }

        .stat-icon {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .stat-card.total .stat-icon { background: linear-gradient(135deg, #e0e7ff, #c7d2fe); color: #4f46e5; }
        .stat-card.pending .stat-icon { background: linear-gradient(135deg, #fed7aa, #fde68a); color: #f59e0b; }
        .stat-card.approved .stat-icon { background: linear-gradient(135deg, #d1fae5, #a7f3d0); color: #10b981; }
        .stat-card.rejected .stat-icon { background: linear-gradient(135deg, #fee2e2, #fecaca); color: #ef4444; }

        .stat-info { flex: 1; }
        .stat-label { font-size: 13px; color: #6b7280; display: block; margin-bottom: 4px; }
        .stat-info h2 { font-size: 32px; font-weight: 700; margin: 0; }
        .text-warning { color: #f59e0b; }
        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }
        .stat-trend { font-size: 11px; color: #9ca3af; margin-top: 4px; display: block; }

        .filter-section {
          margin-bottom: 32px;
        }

        .filter-buttons {
          display: flex;
          gap: 12px;
          background: white;
          padding: 6px;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .filter-btn {
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
          color: #6b7280;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .filter-btn:hover {
          background: #f9fafb;
          color: #4f46e5;
        }

        .filter-btn.active {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
        }

        .filter-count {
          background: rgba(0,0,0,0.08);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
        }

        .filter-btn.active .filter-count {
          background: rgba(255,255,255,0.2);
        }

        .filter-count.warning { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .filter-count.success { background: rgba(16,185,129,0.1); color: #10b981; }
        .filter-count.danger { background: rgba(239,68,68,0.1); color: #ef4444; }
        .filter-btn.active .filter-count { color: white; background: rgba(255,255,255,0.2); }

        .posts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 24px;
        }

        .post-card {
          background: white;
          border-radius: 24px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
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

        .post-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.02);
        }

        .post-user {
          padding: 20px;
          background: #fafbfc;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          position: relative;
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 18px;
          overflow: hidden;
        }

        .user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .user-status {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid white;
        }

        .user-status.pending { background: #f59e0b; }
        .user-status.approved { background: #10b981; }
        .user-status.rejected { background: #ef4444; }

        .user-info {
          flex: 1;
        }

        .user-info h4 {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }

        .user-info p {
          font-size: 12px;
          color: #9ca3af;
          margin: 0;
        }

        .user-location {
          font-size: 10px;
          color: #9ca3af;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
        }

        .post-images {
          padding: 16px;
          background: #fafbfc;
        }

        .images-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .image-item {
          position: relative;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
        }

        .image-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .image-item:hover img {
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

        .image-item:hover .image-overlay {
          opacity: 1;
        }

        .image-overlay i {
          font-size: 20px;
          color: white;
        }

        .more-images {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .more-images:hover {
          transform: scale(1.02);
        }

        .more-images i {
          font-size: 20px;
        }

        .more-images span {
          font-size: 11px;
        }

        .image-count {
          margin-top: 12px;
          font-size: 11px;
          color: #6b7280;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .post-content {
          padding: 20px;
        }

        .post-content h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 8px 0;
          line-height: 1.4;
        }

        .post-content p {
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 12px 0;
          line-height: 1.5;
        }

        .post-meta {
          display: flex;
          gap: 16px;
          font-size: 11px;
          color: #9ca3af;
        }

        .post-meta i {
          margin-right: 4px;
        }

        .post-actions {
          padding: 16px 20px 20px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          gap: 12px;
        }

        .btn-view {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          background: #f3f4f6;
          border: none;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          color: #4f46e5;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-view:hover {
          background: #e0e7ff;
        }

        .action-group {
          display: flex;
          gap: 8px;
          flex: 2;
        }

        .btn-approve, .btn-reject {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border: none;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-approve {
          background: #ecfdf5;
          color: #10b981;
        }

        .btn-approve:hover {
          background: #10b981;
          color: white;
        }

        .btn-reject {
          background: #fef2f2;
          color: #ef4444;
        }

        .btn-reject:hover {
          background: #ef4444;
          color: white;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 500;
        }

        .status-badge.pending { background: #fef3c7; color: #f59e0b; }
        .status-badge.approved { background: #d1fae5; color: #10b981; }
        .status-badge.rejected { background: #fee2e2; color: #ef4444; }

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 24px;
        }

        .empty-icon {
          width: 80px;
          height: 80px;
          background: #f1f5f9;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }

        .empty-icon i {
          font-size: 40px;
          color: #cbd5e1;
        }

        .empty-state h3 {
          font-size: 20px;
          margin-bottom: 8px;
        }

        .empty-state p {
          color: #9ca3af;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(8px);
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
          max-width: 900px;
          max-height: 85vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
        }

        .modal-container.modal-reject { max-width: 550px; }

        .modal-header {
          padding: 24px 28px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          background: white;
          z-index: 10;
        }

        .modal-header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .modal-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-icon i {
          font-size: 24px;
          color: #4f46e5;
        }

        .modal-header h2 {
          font-size: 20px;
          margin: 0 0 4px 0;
        }

        .modal-header p {
          margin: 0;
          color: #6b7280;
          font-size: 13px;
        }

        .modal-close {
          width: 36px;
          height: 36px;
          background: #f1f5f9;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .modal-close:hover {
          background: #e2e8f0;
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 28px;
        }

        .modal-footer {
          padding: 20px 28px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: white;
          position: sticky;
          bottom: 0;
        }

        .footer-actions {
          display: flex;
          gap: 12px;
          flex: 1;
        }

        .modal-images {
          margin-bottom: 28px;
        }

        .modal-images h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .modal-images-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
        }

        .modal-image {
          position: relative;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid #f1f5f9;
          transition: all 0.3s ease;
        }

        .modal-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .modal-image:hover {
          transform: scale(1.02);
          border-color: #4f46e5;
        }

        .modal-image-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
          color: white;
        }

        .modal-image:hover .modal-image-overlay {
          opacity: 1;
        }

        .modal-image-overlay i {
          font-size: 20px;
        }

        .modal-section {
          margin-bottom: 28px;
        }

        .modal-section h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #1f2937;
        }

        .modal-section h4 i {
          color: #4f46e5;
        }

        .author-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px;
          background: #f9fafb;
          border-radius: 20px;
        }

        .author-avatar {
          width: 70px;
          height: 70px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 28px;
          font-weight: 600;
          overflow: hidden;
        }

        .author-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .author-details h5 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }

        .author-details p {
          font-size: 13px;
          margin: 4px 0;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6b7280;
        }

        .author-details p i {
          font-size: 12px;
          color: #9ca3af;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .info-item label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 4px;
          text-transform: uppercase;
        }

        .info-item code {
          background: #f1f5f9;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
        }

        .post-title {
          font-size: 18px;
          font-weight: 600;
          padding: 16px;
          background: #f9fafb;
          border-radius: 12px;
          margin-bottom: 16px;
        }

        .post-body {
          background: #f9fafb;
          padding: 20px;
          border-radius: 12px;
          line-height: 1.6;
          white-space: pre-wrap;
          font-size: 14px;
        }

        .category-badge {
          display: inline-block;
          padding: 8px 16px;
          background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
          color: #4f46e5;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 500;
        }

        .rejection-box {
          background: #fef3c7;
          padding: 16px;
          border-radius: 12px;
          color: #92400e;
        }

        .moderation-box {
          background: #f9fafb;
          padding: 16px;
          border-radius: 12px;
        }

        .moderation-box p {
          margin: 0 0 8px 0;
        }

        .moderation-box p:last-child {
          margin-bottom: 0;
        }

        .lightbox-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1200;
          animation: fadeIn 0.2s ease;
        }

        .lightbox-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
        }

        .lightbox-content img {
          max-width: 90vw;
          max-height: 85vh;
          object-fit: contain;
        }

        .lightbox-close {
          position: absolute;
          top: -50px;
          right: 0;
          width: 40px;
          height: 40px;
          background: rgba(255,255,255,0.2);
          border: none;
          border-radius: 50%;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          transition: all 0.3s ease;
        }

        .lightbox-close:hover {
          background: rgba(255,255,255,0.3);
          transform: rotate(90deg);
        }

        .lightbox-prev, .lightbox-next {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 48px;
          height: 48px;
          background: rgba(255,255,255,0.2);
          border: none;
          border-radius: 50%;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          transition: all 0.3s ease;
        }

        .lightbox-prev { left: -60px; }
        .lightbox-next { right: -60px; }

        .lightbox-prev:hover, .lightbox-next:hover {
          background: rgba(255,255,255,0.3);
          transform: translateY(-50%) scale(1.1);
        }

        .lightbox-counter {
          position: absolute;
          bottom: -40px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
        }

        .lightbox-actions {
          position: absolute;
          bottom: -40px;
          right: 0;
        }

        .lightbox-actions button {
          padding: 8px 16px;
          background: rgba(0,0,0,0.7);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          transition: all 0.3s ease;
        }

        .lightbox-actions button:hover {
          background: rgba(0,0,0,0.9);
        }

        .quick-reasons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .quick-reason {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #f9fafb;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }

        .quick-reason:hover {
          background: #f3f4f6;
          transform: translateY(-2px);
        }

        .quick-reason.selected {
          background: #fef3c7;
          border-color: #f59e0b;
        }

        .quick-reason i {
          font-size: 18px;
          color: var(--reason-color);
        }

        .quick-reason .check {
          position: absolute;
          right: 12px;
          top: 12px;
          color: #10b981;
          font-size: 16px;
        }

        .custom-reason {
          margin-top: 20px;
        }

        .custom-reason label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .custom-reason textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          resize: vertical;
          font-size: 14px;
        }

        .custom-reason textarea:focus {
          outline: none;
          border-color: #4f46e5;
        }

        .warning-note {
          background: #fef3c7;
          padding: 12px;
          border-radius: 12px;
          margin-top: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #856404;
        }

        .btn-secondary {
          padding: 10px 20px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .btn-secondary:hover {
          background: #f3f4f6;
        }

        .btn-approve-modal {
          padding: 10px 24px;
          background: #10b981;
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-approve-modal:hover {
          background: #059669;
          transform: translateY(-2px);
        }

        .btn-reject-modal {
          padding: 10px 24px;
          background: #ef4444;
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-reject-modal:hover {
          background: #dc2626;
          transform: translateY(-2px);
        }

        .btn-danger {
          padding: 10px 24px;
          background: #ef4444;
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-close {
          padding: 10px 24px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
        }

        .loading-details {
          text-align: center;
          padding: 60px;
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

        @media (max-width: 1024px) {
          .moderation-container { padding: 20px; }
          .posts-grid { grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); }
        }

        @media (max-width: 768px) {
          .moderation-container { padding: 16px; }
          .hero-section { padding: 28px; }
          .hero-content { flex-direction: column; text-align: center; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .filter-buttons { flex-wrap: wrap; }
          .filter-btn { flex: auto; }
          .posts-grid { grid-template-columns: 1fr; }
          .post-user { flex-wrap: wrap; }
          .action-group { flex-direction: column; }
          .info-grid { grid-template-columns: 1fr; }
          .author-card { flex-direction: column; text-align: center; }
          .author-details p { justify-content: center; }
          .quick-reasons { grid-template-columns: 1fr; }
          .footer-actions { flex-direction: column; }
          .btn-approve-modal, .btn-reject-modal { width: 100%; }
          .lightbox-prev, .lightbox-next { width: 40px; height: 40px; font-size: 18px; }
          .lightbox-prev { left: -50px; }
          .lightbox-next { right: -50px; }
          .modal-images-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
        }

        @media (max-width: 480px) {
          .hero-title { font-size: 22px; }
          .stats-grid { grid-template-columns: 1fr; }
          .post-card { border-radius: 20px; }
          .post-user { padding: 16px; }
          .post-content { padding: 16px; }
          .post-actions { padding: 16px; }
        }
      `}</style>
    </AdminLayout>
  )
}