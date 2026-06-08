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
              const { data: userResult, error: userError } = await supabase
                .from('users')
                .select('user_id, full_name, email, profile_image, phone, location, district, created_at')
                .eq('user_id', userId)
                .maybeSingle()
              
              if (userError) {
                console.error(`Error fetching user ${userId}:`, userError)
              }
              
              if (userResult) {
                userData = userResult
              } else {
                const { data: adminResult } = await supabase
                  .from('admin_users')
                  .select('admin_id, full_name, email')
                  .eq('admin_id', userId)
                  .maybeSingle()
                
                if (adminResult) {
                  userData = {
                    user_id: adminResult.admin_id,
                    full_name: adminResult.full_name,
                    email: adminResult.email,
                    profile_image: null,
                    phone: null,
                    location: null,
                    district: null
                  }
                }
              }
            }
            
            if (!userData && userId) {
              userData = {
                user_id: userId,
                full_name: `User (${userId.slice(0, 8)}...)`,
                email: 'Email not available',
                profile_image: null,
                phone: null,
                location: null,
                district: null
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
          author_name: userData?.full_name || 'Mobile User',
          author_email: userData?.email || 'Email not available',
          author_phone: userData?.phone || null,
          author_location: userData?.location || userData?.district || null,
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
            const { data: userResult, error: userError } = await supabase
              .from('users')
              .select('user_id, full_name, email, profile_image, phone, location, district, created_at')
              .eq('user_id', userId)
              .maybeSingle()
            
            if (userError) {
              console.error('Error fetching user:', userError)
            }
            
            if (userResult) {
              userData = userResult
            } else {
              const { data: adminResult } = await supabase
                .from('admin_users')
                .select('admin_id, full_name, email')
                .eq('admin_id', userId)
                .maybeSingle()
              
              if (adminResult) {
                userData = {
                  user_id: adminResult.admin_id,
                  full_name: adminResult.full_name,
                  email: adminResult.email,
                  profile_image: null,
                  phone: null,
                  location: null,
                  district: null
                }
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
        <div className="loading-container">
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
              <p className="hero-subtitle">Review and manage user-generated content before publication</p>
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
                  <div className="post-user-info">
                    <div className="post-user-avatar">
                      {post.user?.profile_image ? (
                        <img src={getImageUrl(post.user.profile_image)} alt={post.user.full_name} />
                      ) : (
                        <i className="bi bi-person-circle"></i>
                      )}
                    </div>
                    <div className="post-user-details">
                      <div className="post-user-name">
                        {post.author_name}
                        {post.user_id && (
                          <span className="user-id-tooltip" title={`User ID: ${post.user_id}`}>
                            <i className="bi bi-info-circle"></i>
                          </span>
                        )}
                      </div>
                      <div className="post-user-email">
                        <i className="bi bi-envelope"></i> {post.author_email}
                      </div>
                      {post.author_phone && (
                        <div className="post-user-phone">
                          <i className="bi bi-telephone"></i> {post.author_phone}
                        </div>
                      )}
                      {post.author_location && (
                        <div className="post-user-location">
                          <i className="bi bi-geo-alt"></i> {post.author_location}
                        </div>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(post.moderation_status)}
                </div>

                {/* Post Images Gallery */}
                {post.images && post.images.length > 0 && (
                  <div className="post-images-gallery">
                    <div className="images-grid">
                      {post.images.slice(0, 3).map((img, idx) => (
                        <div key={idx} className="gallery-image" onClick={() => openFullImage(img, idx)}>
                          <img src={img} alt={`Image ${idx + 1}`} />
                          <div className="gallery-overlay">
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
                    {post.images.length > 1 && (
                      <div className="image-count-badge">
                        <i className="bi bi-images"></i> {post.images.length} images
                      </div>
                    )}
                  </div>
                )}

                {/* Post Content */}
                <div className="post-card-content">
                  <h6 className="post-card-title">{post.title}</h6>
                  <p className="post-card-text">
                    {post.content?.substring(0, 120)}...
                  </p>
                  <div className="post-card-meta">
                    <span><i className="bi bi-calendar3"></i> {new Date(post.post_created_at).toLocaleDateString()}</span>
                    <span><i className="bi bi-clock"></i> {new Date(post.post_created_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="post-card-footer">
                  <button className="btn-view" onClick={() => viewDetails(post)}>
                    <i className="bi bi-eye"></i> View Details
                  </button>
                  {post.moderation_status === 'PENDING' && post.post_exists !== false && (
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
              ) : postDetails ? (
                <>
                  {/* Full Images Gallery */}
                  {postDetails.images && postDetails.images.length > 0 && (
                    <div className="detail-images-section">
                      <h4><i className="bi bi-images"></i> All Images ({postDetails.images.length})</h4>
                      <div className="detail-images-grid">
                        {postDetails.images.map((img, idx) => (
                          <div key={idx} className="detail-image-card" onClick={() => openFullImage(img, idx)}>
                            <img src={img} alt={`Image ${idx + 1}`} />
                            <div className="detail-image-overlay">
                              <i className="bi bi-zoom-in"></i>
                              <span>View</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Author Information */}
                  <div className="detail-section">
                    <h4><i className="bi bi-person-badge"></i> Author Information</h4>
                    <div className="detail-author">
                      <div className="detail-author-avatar">
                        {postDetails.user?.profile_image ? (
                          <img src={getImageUrl(postDetails.user.profile_image)} alt={postDetails.user.full_name} />
                        ) : (
                          <i className="bi bi-person-circle"></i>
                        )}
                      </div>
                      <div className="detail-author-info">
                        <div className="detail-author-name">
                          {postDetails.user?.full_name || 'Mobile User'}
                          {postDetails.user?.user_id && (
                            <span className="user-id-badge">ID: {postDetails.user.user_id.slice(0, 8)}...</span>
                          )}
                        </div>
                        <div className="detail-author-email">
                          <i className="bi bi-envelope"></i> {postDetails.user?.email || 'Email not available'}
                        </div>
                        {postDetails.user?.phone && (
                          <div className="detail-author-phone">
                            <i className="bi bi-telephone"></i> {postDetails.user.phone}
                          </div>
                        )}
                        {postDetails.user?.location && (
                          <div className="detail-author-location">
                            <i className="bi bi-geo-alt"></i> {postDetails.user.location}
                          </div>
                        )}
                        {postDetails.user?.district && (
                          <div className="detail-author-district">
                            <i className="bi bi-building"></i> {postDetails.user.district}
                          </div>
                        )}
                        {postDetails.user?.created_at && (
                          <div className="detail-author-joined">
                            <i className="bi bi-calendar-check"></i> Joined: {new Date(postDetails.user.created_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content Information */}
                  <div className="detail-section">
                    <h4><i className="bi bi-info-circle"></i> Content Information</h4>
                    <div className="detail-info-grid">
                      <div className="detail-info-item">
                        <label>Content ID</label>
                        <code>{selectedPost.content_id}</code>
                      </div>
                      <div className="detail-info-item">
                        <label>Status</label>
                        {getStatusBadge(selectedPost.moderation_status)}
                      </div>
                      <div className="detail-info-item">
                        <label>Created At</label>
                        <span>{new Date(selectedPost.created_at).toLocaleString()}</span>
                      </div>
                      {selectedPost.reviewed_at && (
                        <div className="detail-info-item">
                          <label>Reviewed At</label>
                          <span>{new Date(selectedPost.reviewed_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Post Title */}
                  <div className="detail-section">
                    <h4><i className="bi bi-heading"></i> Post Title</h4>
                    <div className="detail-title">{postDetails.title}</div>
                  </div>

                  {/* Complete Post Content */}
                  <div className="detail-section">
                    <h4><i className="bi bi-file-text"></i> Full Content</h4>
                    <div className="detail-content">{postDetails.content}</div>
                  </div>

                  {/* Category */}
                  {postDetails.category?.category_name && (
                    <div className="detail-section">
                      <h4><i className="bi bi-tag"></i> Category</h4>
                      <div className="detail-category">
                        <span className="category-badge">{postDetails.category.category_name}</span>
                      </div>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {selectedPost.moderation_reason && (
                    <div className="detail-section rejection">
                      <h4><i className="bi bi-exclamation-triangle"></i> Rejection Reason</h4>
                      <div className="detail-rejection">{selectedPost.moderation_reason}</div>
                    </div>
                  )}

                  {/* Moderation Info */}
                  {selectedPost.reviewed_by_admin && (
                    <div className="detail-section">
                      <h4><i className="bi bi-person-check"></i> Moderation Information</h4>
                      <div className="detail-moderation">
                        <div>Reviewed by: <strong>{selectedPost.reviewed_by_admin?.full_name}</strong></div>
                        <div>Reviewed at: {new Date(selectedPost.reviewed_at).toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-details">
                  <i className="bi bi-file-text"></i>
                  <p>The original post could not be found.</p>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              {selectedPost.moderation_status === 'PENDING' && postDetails && (
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

      {/* Full Image Lightbox */}
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
          padding: 0 24px;
        }

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

        .hero-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 24px;
          padding: 32px;
          margin-bottom: 32px;
        }

        .hero-content {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .hero-icon {
          width: 56px;
          height: 56px;
          background: rgba(255,255,255,0.2);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hero-icon i { font-size: 28px; color: white; }
        .hero-title { font-size: 24px; font-weight: 700; color: white; margin: 0 0 4px 0; }
        .hero-subtitle { font-size: 14px; color: rgba(255,255,255,0.9); margin: 0; }

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

        .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); }
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
          padding: 10px 16px;
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
          padding: 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .post-user-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .post-user-avatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .post-user-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .post-user-avatar i { font-size: 20px; color: white; }

        .post-user-details { flex: 1; }
        .post-user-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .user-id-tooltip { cursor: help; font-size: 11px; color: #9ca3af; }
        .post-user-email, .post-user-phone, .post-user-location { font-size: 10px; color: #9ca3af; margin-top: 2px; display: flex; align-items: center; gap: 4px; }
        .post-user-email i, .post-user-phone i, .post-user-location i { font-size: 9px; }

        .post-images-gallery { padding: 12px; background: #fafbfc; }
        .images-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .gallery-image {
          position: relative;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
        }
        .gallery-image img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
        .gallery-image:hover img { transform: scale(1.05); }
        .gallery-overlay {
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
        .gallery-image:hover .gallery-overlay { opacity: 1; }
        .gallery-overlay i { font-size: 24px; color: white; }
        .more-images {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-radius: 12px;
          cursor: pointer;
        }
        .more-images:hover { transform: scale(1.02); }
        .more-images i { font-size: 24px; }
        .more-images span { font-size: 11px; }
        .image-count-badge { margin-top: 8px; font-size: 11px; color: #667eea; display: flex; align-items: center; gap: 4px; }

        .post-card-content { padding: 16px; }
        .post-card-title { font-size: 16px; font-weight: 600; margin: 0 0 8px 0; }
        .post-card-text { font-size: 13px; color: #6c757d; margin: 0 0 12px 0; line-height: 1.5; }
        .post-card-meta { display: flex; gap: 16px; font-size: 11px; color: #9ca3af; }
        .post-card-meta i { margin-right: 4px; }

        .post-card-footer {
          padding: 16px;
          border-top: 1px solid #e9ecef;
          display: flex;
          gap: 12px;
        }

        .btn-view {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px;
          background: rgba(79,70,229,0.1);
          border: none;
          border-radius: 8px;
          color: #4f46e5;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-view:hover { background: #4f46e5; color: white; }
        .action-buttons { display: flex; gap: 8px; flex: 2; }
        .btn-approve, .btn-reject {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-approve { background: rgba(16,185,129,0.1); color: #10b981; }
        .btn-approve:hover { background: #10b981; color: white; }
        .btn-reject { background: rgba(239,68,68,0.1); color: #ef4444; }
        .btn-reject:hover { background: #ef4444; color: white; }

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

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 24px;
        }
        .empty-state i { font-size: 64px; color: #cbd5e1; margin-bottom: 16px; display: block; }

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
          max-width: 900px;
          max-height: 85vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
        }
        .modal-container.modal-reject { max-width: 550px; }

        .modal-header {
          padding: 24px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          background: white;
          z-index: 10;
        }
        .modal-header-content { display: flex; align-items: center; gap: 16px; }
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
        }
        .modal-close:hover { background: #e9ecef; transform: rotate(90deg); }
        .modal-body { padding: 24px; }

        /* Detail Modal Styles */
        .detail-images-section { margin-bottom: 28px; }
        .detail-images-section h4 { font-size: 15px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .detail-images-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
        .detail-image-card {
          position: relative;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid #e9ecef;
          transition: all 0.3s ease;
        }
        .detail-image-card img { width: 100%; height: 100%; object-fit: cover; }
        .detail-image-card:hover { transform: scale(1.02); border-color: #667eea; }
        .detail-image-overlay {
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
          gap: 4px;
          opacity: 0;
          transition: opacity 0.3s ease;
          color: white;
        }
        .detail-image-card:hover .detail-image-overlay { opacity: 1; }
        .detail-image-overlay i { font-size: 20px; }
        .detail-image-overlay span { font-size: 11px; }

        .detail-section { margin-bottom: 28px; }
        .detail-section h4 {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #1f2937;
        }
        .detail-section h4 i { color: #667eea; }

        .detail-author {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 16px;
        }
        .detail-author-avatar {
          width: 70px;
          height: 70px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .detail-author-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .detail-author-avatar i { font-size: 32px; color: white; }
        .detail-author-name { font-weight: 700; font-size: 18px; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .user-id-badge {
          display: inline-block;
          font-size: 10px;
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 12px;
          color: #6c757d;
          font-weight: normal;
        }
        .detail-author-email, .detail-author-phone, .detail-author-location, .detail-author-district, .detail-author-joined {
          font-size: 13px;
          color: #6c757d;
          margin: 4px 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .detail-info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .detail-info-item label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #6c757d;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .detail-info-item code { background: #f8f9fa; padding: 4px 8px; border-radius: 6px; font-size: 12px; }
        .detail-title {
          font-size: 18px;
          font-weight: 600;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 12px;
        }
        .detail-content {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 12px;
          line-height: 1.8;
          white-space: pre-wrap;
          font-size: 14px;
        }
        .category-badge {
          display: inline-block;
          padding: 6px 14px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-radius: 20px;
          font-size: 13px;
        }
        .detail-rejection { background: #fef3c7; padding: 12px; border-radius: 8px; color: #92400e; }
        .detail-moderation { background: #f8f9fa; padding: 12px; border-radius: 8px; font-size: 13px; }
        .no-details { text-align: center; padding: 60px; color: #9ca3af; }
        .loading-details { text-align: center; padding: 60px; }

        /* Lightbox Styles */
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
        .lightbox-content { position: relative; max-width: 90vw; max-height: 90vh; }
        .lightbox-content img { max-width: 90vw; max-height: 85vh; object-fit: contain; }
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
        .lightbox-close:hover { background: rgba(255,255,255,0.3); transform: rotate(90deg); }
        .lightbox-prev, .lightbox-next {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 50px;
          height: 50px;
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
        .lightbox-prev:hover, .lightbox-next:hover { background: rgba(255,255,255,0.3); transform: translateY(-50%) scale(1.1); }
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
          padding: 6px 12px;
          background: rgba(0,0,0,0.7);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          transition: all 0.3s ease;
        }
        .lightbox-actions button:hover { background: rgba(0,0,0,0.9); }

        .quick-reasons { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
        .quick-reason {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: #f8f9fa;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          cursor: pointer;
          position: relative;
        }
        .quick-reason.selected { background: #fef3c7; border-color: #f59e0b; }
        .quick-reason i { font-size: 18px; color: var(--reason-color); }
        .quick-reason .check { position: absolute; right: 12px; top: 12px; color: #10b981; }

        .custom-reason { margin-top: 20px; }
        .custom-reason label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
        .custom-reason textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          resize: vertical;
        }
        .warning-note { background: #fff3cd; padding: 12px; border-radius: 12px; margin-top: 16px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #856404; }

        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e9ecef;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: white;
          position: sticky;
          bottom: 0;
        }
        .footer-actions { display: flex; gap: 12px; flex: 1; }
        .btn-secondary { padding: 10px 20px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 10px; cursor: pointer; }
        .btn-approve-modal { padding: 10px 24px; background: #10b981; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; }
        .btn-reject-modal { padding: 10px 24px; background: #ef4444; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; }
        .btn-danger { padding: 10px 24px; background: #ef4444; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 768px) {
          .moderation-container { padding: 0 16px; }
          .hero-section { padding: 24px; }
          .hero-content { flex-direction: column; text-align: center; }
          .stats-grid { grid-template-columns: 1fr; }
          .filter-tabs { flex-wrap: wrap; }
          .filter-tab { flex: auto; }
          .posts-grid { grid-template-columns: 1fr; }
          .detail-author { flex-direction: column; text-align: center; }
          .detail-info-grid { grid-template-columns: 1fr; }
          .quick-reasons { grid-template-columns: 1fr; }
          .footer-actions { flex-direction: column; }
          .btn-approve-modal, .btn-reject-modal { width: 100%; }
          .lightbox-prev, .lightbox-next { width: 40px; height: 40px; font-size: 18px; }
          .lightbox-prev { left: -50px; }
          .lightbox-next { right: -50px; }
          .detail-images-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
          .post-user-details { min-width: 0; }
          .post-user-name { font-size: 12px; }
          .post-user-email, .post-user-phone, .post-user-location { font-size: 9px; }
        }
      `}</style>
    </AdminLayout>
  )
}