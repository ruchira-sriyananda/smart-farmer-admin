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
  const [hoveredCard, setHoveredCard] = useState(null)

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
              const { data: userResult } = await supabase
                .from('users')
                .select('user_id, full_name, email, profile_image, phone, location, district, created_at')
                .eq('user_id', userId)
                .maybeSingle()
              
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
                full_name: `User ${userId.slice(0, 8)}`,
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
            const { data: userResult } = await supabase
              .from('users')
              .select('user_id, full_name, email, profile_image, phone, location, district, created_at')
              .eq('user_id', userId)
              .maybeSingle()
            
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
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-animation">
              <div className="loading-circle"></div>
              <div className="loading-circle delay-1"></div>
              <div className="loading-circle delay-2"></div>
            </div>
            <h3>Loading content...</h3>
            <p>Please wait while we fetch your data</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Content Moderation">
      <div className="moderation-container">
        {/* Modern Hero Section */}
        <div className="hero-section">
          <div className="hero-content">
            <div className="hero-text">
              <div className="hero-icon-wrapper">
                <i className="bi bi-shield-check"></i>
              </div>
              <div>
                <h1 className="hero-title">Content Moderation</h1>
                <p className="hero-subtitle">Review and manage user-generated content before publication</p>
              </div>
            </div>
            <div className="hero-stats">
              <div className="hero-stat">
                <span className="hero-stat-value">{stats.pending}</span>
                <span className="hero-stat-label">Pending Review</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-value">{stats.approved}</span>
                <span className="hero-stat-label">Approved</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-value">{stats.rejected}</span>
                <span className="hero-stat-label">Rejected</span>
              </div>
            </div>
          </div>
          <div className="hero-decoration">
            <div className="decoration-circle"></div>
            <div className="decoration-circle-2"></div>
          </div>
        </div>

        {/* Modern Stats Cards */}
        <div className="stats-wrapper">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon total">
                <i className="bi bi-files"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Content</span>
                <h3>{stats.total}</h3>
                <span className="stat-trend">All time</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon pending">
                <i className="bi bi-hourglass-split"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Pending</span>
                <h3 className="text-warning">{stats.pending}</h3>
                <span className="stat-trend">Needs review</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon approved">
                <i className="bi bi-check-circle"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Approved</span>
                <h3 className="text-success">{stats.approved}</h3>
                <span className="stat-trend">Published</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon rejected">
                <i className="bi bi-x-circle"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Rejected</span>
                <h3 className="text-danger">{stats.rejected}</h3>
                <span className="stat-trend">Removed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button className={`filter-tab ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
            <i className="bi bi-grid"></i>
            <span>All Content</span>
            <span className="tab-count">{stats.total}</span>
          </button>
          <button className={`filter-tab ${filter === 'PENDING' ? 'active' : ''}`} onClick={() => setFilter('PENDING')}>
            <i className="bi bi-hourglass-split"></i>
            <span>Pending</span>
            <span className="tab-count pending">{stats.pending}</span>
          </button>
          <button className={`filter-tab ${filter === 'APPROVED' ? 'active' : ''}`} onClick={() => setFilter('APPROVED')}>
            <i className="bi bi-check-circle"></i>
            <span>Approved</span>
            <span className="tab-count approved">{stats.approved}</span>
          </button>
          <button className={`filter-tab ${filter === 'REJECTED' ? 'active' : ''}`} onClick={() => setFilter('REJECTED')}>
            <i className="bi bi-x-circle"></i>
            <span>Rejected</span>
            <span className="tab-count rejected">{stats.rejected}</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-container">
          <div className="search-box">
            <i className="bi bi-search"></i>
            <input 
              type="text" 
              placeholder="Search posts by title, content or author..." 
              id="searchInput"
              onChange={(e) => {
                const searchTerm = e.target.value.toLowerCase()
                const cards = document.querySelectorAll('.post-card')
                cards.forEach(card => {
                  const title = card.querySelector('.post-card-title')?.innerText.toLowerCase() || ''
                  const content = card.querySelector('.post-card-text')?.innerText.toLowerCase() || ''
                  const author = card.querySelector('.post-user-name')?.innerText.toLowerCase() || ''
                  if (title.includes(searchTerm) || content.includes(searchTerm) || author.includes(searchTerm)) {
                    card.style.display = 'block'
                  } else {
                    card.style.display = 'none'
                  }
                })
              }}
            />
          </div>
        </div>

        {/* Posts Grid */}
        <div className="posts-grid">
          {posts.length > 0 ? (
            posts.filter(post => post.moderation_status === filter || filter === 'ALL').map((post, index) => (
              <div 
                key={post.moderation_id} 
                className="post-card" 
                style={{ animationDelay: `${index * 0.05}s` }}
                onMouseEnter={() => setHoveredCard(post.moderation_id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* User Info Section */}
                <div className="post-card-header">
                  <div className="post-user-info">
                    <div className="post-user-avatar">
                      {post.user?.profile_image ? (
                        <img src={getImageUrl(post.user.profile_image)} alt={post.user.full_name} />
                      ) : (
                        <div className="avatar-placeholder">
                          {post.author_name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <span className="user-status online"></span>
                    </div>
                    <div className="post-user-details">
                      <div className="post-user-name">{post.author_name}</div>
                      <div className="post-user-meta">
                        <span><i className="bi bi-envelope"></i> {post.author_email}</span>
                        {post.author_location && <span><i className="bi bi-geo-alt"></i> {post.author_location}</span>}
                      </div>
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
                            <i className="bi bi-eye"></i>
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

                {/* Hover Glow Effect */}
                {hoveredCard === post.moderation_id && (
                  <div className="card-glow"></div>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <i className="bi bi-inbox"></i>
              </div>
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
                      <div className="section-header">
                        <i className="bi bi-images"></i>
                        <h4>Attached Images ({postDetails.images.length})</h4>
                      </div>
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
                    <div className="section-header">
                      <i className="bi bi-person-badge"></i>
                      <h4>Author Information</h4>
                    </div>
                    <div className="detail-author">
                      <div className="detail-author-avatar">
                        {postDetails.user?.profile_image ? (
                          <img src={getImageUrl(postDetails.user.profile_image)} alt={postDetails.user.full_name} />
                        ) : (
                          <div className="avatar-large-placeholder">
                            {postDetails.user?.full_name?.charAt(0) || 'U'}
                          </div>
                        )}
                      </div>
                      <div className="detail-author-info">
                        <div className="detail-author-name">{postDetails.user?.full_name || 'Mobile User'}</div>
                        <div className="detail-author-email">
                          <i className="bi bi-envelope"></i> {postDetails.user?.email || 'Email not available'}
                        </div>
                        {postDetails.user?.phone && (
                          <div className="detail-author-phone">
                            <i className="bi bi-telephone"></i> {postDetails.user.phone}
                          </div>
                        )}
                        {(postDetails.user?.location || postDetails.user?.district) && (
                          <div className="detail-author-location">
                            <i className="bi bi-geo-alt"></i> {postDetails.user?.location || postDetails.user?.district}
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
                    <div className="section-header">
                      <i className="bi bi-info-circle"></i>
                      <h4>Content Information</h4>
                    </div>
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
                    <div className="section-header">
                      <i className="bi bi-heading"></i>
                      <h4>Post Title</h4>
                    </div>
                    <div className="detail-title">{postDetails.title}</div>
                  </div>

                  {/* Complete Post Content */}
                  <div className="detail-section">
                    <div className="section-header">
                      <i className="bi bi-file-text"></i>
                      <h4>Full Content</h4>
                    </div>
                    <div className="detail-content">{postDetails.content}</div>
                  </div>

                  {/* Category */}
                  {postDetails.category?.category_name && (
                    <div className="detail-section">
                      <div className="section-header">
                        <i className="bi bi-tag"></i>
                        <h4>Category</h4>
                      </div>
                      <div className="detail-category">
                        <span className="category-badge">{postDetails.category.category_name}</span>
                      </div>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {selectedPost.moderation_reason && (
                    <div className="detail-section rejection">
                      <div className="section-header">
                        <i className="bi bi-exclamation-triangle"></i>
                        <h4>Rejection Reason</h4>
                      </div>
                      <div className="detail-rejection">{selectedPost.moderation_reason}</div>
                    </div>
                  )}

                  {/* Moderation Info */}
                  {selectedPost.reviewed_by_admin && (
                    <div className="detail-section">
                      <div className="section-header">
                        <i className="bi bi-person-check"></i>
                        <h4>Moderation Information</h4>
                      </div>
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
              <p className="reject-instruction">Please select a reason for rejecting this content:</p>
              
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

        /* Loading Screen */
        .loading-screen {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 500px;
        }

        .loading-content {
          text-align: center;
        }

        .loading-animation {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 24px;
        }

        .loading-circle {
          width: 12px;
          height: 12px;
          background: #667eea;
          border-radius: 50%;
          animation: bounce 1.4s ease-in-out infinite;
        }

        .delay-1 { animation-delay: 0.2s; }
        .delay-2 { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }

        /* Hero Section */
        .hero-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 28px;
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
          justify-content: space-between;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .hero-text {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .hero-icon-wrapper {
          width: 60px;
          height: 60px;
          background: rgba(255,255,255,0.2);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
        }

        .hero-icon-wrapper i {
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
          color: rgba(255,255,255,0.9);
          margin: 0;
        }

        .hero-stats {
          display: flex;
          gap: 32px;
        }

        .hero-stat {
          text-align: center;
        }

        .hero-stat-value {
          display: block;
          font-size: 28px;
          font-weight: 700;
          color: white;
          margin-bottom: 4px;
        }

        .hero-stat-label {
          font-size: 12px;
          color: rgba(255,255,255,0.8);
        }

        .hero-decoration {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          overflow: hidden;
        }

        .decoration-circle {
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          bottom: -150px;
          right: -100px;
        }

        .decoration-circle-2 {
          position: absolute;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          top: -100px;
          left: -100px;
        }

        /* Stats Cards */
        .stats-wrapper {
          margin-bottom: 32px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        .stat-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.3s ease;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
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

        .stat-icon.total { background: linear-gradient(135deg, #667eea20, #764ba220); color: #667eea; }
        .stat-icon.pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .stat-icon.approved { background: rgba(16,185,129,0.1); color: #10b981; }
        .stat-icon.rejected { background: rgba(239,68,68,0.1); color: #ef4444; }

        .stat-info {
          flex: 1;
        }

        .stat-label {
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 4px;
          display: block;
        }

        .stat-info h3 {
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 4px 0;
        }

        .stat-trend {
          font-size: 11px;
          color: #6c757d;
        }

        .text-warning { color: #f59e0b; }
        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }

        /* Filter Tabs */
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

        .filter-tab:hover {
          background: #f8f9fa;
        }

        .filter-tab.active {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }

        .tab-count {
          background: rgba(0,0,0,0.1);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
        }

        .filter-tab.active .tab-count {
          background: rgba(255,255,255,0.2);
        }

        /* Search Container */
        .search-container {
          margin-bottom: 24px;
        }

        .search-box {
          position: relative;
          max-width: 400px;
        }

        .search-box i {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .search-box input {
          width: 100%;
          padding: 12px 40px 12px 40px;
          border: 2px solid #e9ecef;
          border-radius: 14px;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .search-box input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }

        /* Posts Grid */
        .posts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 24px;
        }

        .post-card {
          background: white;
          border-radius: 24px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          animation: fadeInUp 0.4s ease backwards;
          position: relative;
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
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }

        .card-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(102,126,234,0.05), rgba(118,75,162,0.05));
          pointer-events: none;
          border-radius: 24px;
        }

        /* Post Card Header */
        .post-card-header {
          padding: 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .post-user-info {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
        }

        .post-user-avatar {
          position: relative;
          width: 48px;
          height: 48px;
        }

        .post-user-avatar img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        .avatar-placeholder {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 18px;
        }

        .user-status {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 12px;
          height: 12px;
          background: #10b981;
          border: 2px solid white;
          border-radius: 50%;
        }

        .post-user-details {
          flex: 1;
        }

        .post-user-name {
          font-weight: 600;
          font-size: 15px;
          color: #1f2937;
          margin-bottom: 4px;
        }

        .post-user-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          font-size: 11px;
          color: #9ca3af;
        }

        .post-user-meta i {
          font-size: 10px;
          margin-right: 3px;
        }

        /* Status Badge */
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
        }

        .status-badge.pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .status-badge.approved { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-badge.rejected { background: rgba(239,68,68,0.1); color: #ef4444; }

        /* Images Gallery */
        .post-images-gallery {
          padding: 16px;
          background: #fafbfc;
        }

        .images-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .gallery-image {
          position: relative;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
        }

        .gallery-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .gallery-image:hover img {
          transform: scale(1.05);
        }

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

        .gallery-image:hover .gallery-overlay {
          opacity: 1;
        }

        .gallery-overlay i {
          font-size: 24px;
          color: white;
        }

        .more-images {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .more-images:hover {
          transform: scale(1.02);
        }

        .more-images i {
          font-size: 28px;
        }

        .more-images span {
          font-size: 12px;
          font-weight: 600;
        }

        /* Post Content */
        .post-card-content {
          padding: 20px;
        }

        .post-card-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 10px 0;
          color: #1f2937;
          line-height: 1.4;
        }

        .post-card-text {
          font-size: 13px;
          color: #6c757d;
          margin: 0 0 14px 0;
          line-height: 1.5;
        }

        .post-card-meta {
          display: flex;
          gap: 16px;
          font-size: 11px;
          color: #9ca3af;
        }

        .post-card-meta i {
          margin-right: 4px;
        }

        /* Post Card Footer */
        .post-card-footer {
          padding: 16px 20px;
          border-top: 1px solid #e9ecef;
          display: flex;
          gap: 12px;
        }

        .btn-view {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          background: rgba(79,70,229,0.1);
          border: none;
          border-radius: 10px;
          color: #4f46e5;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-view:hover {
          background: #4f46e5;
          color: white;
        }

        .action-buttons {
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
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-approve {
          background: rgba(16,185,129,0.1);
          color: #10b981;
        }

        .btn-approve:hover {
          background: #10b981;
          color: white;
        }

        .btn-reject {
          background: rgba(239,68,68,0.1);
          color: #ef4444;
        }

        .btn-reject:hover {
          background: #ef4444;
          color: white;
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 24px;
          grid-column: span 3;
        }

        .empty-state-icon {
          font-size: 80px;
          color: #cbd5e1;
          margin-bottom: 20px;
        }

        .empty-state h4 {
          font-size: 20px;
          margin-bottom: 8px;
          color: #1f2937;
        }

        .empty-state p {
          color: #6c757d;
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
          max-width: 900px;
          max-height: 85vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
        }

        .modal-container.modal-reject {
          max-width: 550px;
        }

        .modal-header {
          padding: 28px;
          border-bottom: 1px solid #e9ecef;
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
          background: linear-gradient(135deg, #667eea20, #764ba220);
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-icon i {
          font-size: 24px;
          color: #667eea;
        }

        .modal-header h2 {
          font-size: 20px;
          margin: 0 0 4px 0;
        }

        .modal-header p {
          margin: 0;
          color: #6c757d;
          font-size: 13px;
        }

        .modal-close {
          width: 36px;
          height: 36px;
          background: #f8f9fa;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .modal-close:hover {
          background: #e9ecef;
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 28px;
        }

        .modal-footer {
          padding: 20px 28px;
          border-top: 1px solid #e9ecef;
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

        /* Detail Section */
        .detail-images-section {
          margin-bottom: 32px;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #f0f0f0;
        }

        .section-header i {
          font-size: 18px;
          color: #667eea;
        }

        .section-header h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .detail-images-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 16px;
        }

        .detail-image-card {
          position: relative;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid #e9ecef;
          transition: all 0.3s ease;
        }

        .detail-image-card:hover {
          transform: scale(1.02);
          border-color: #667eea;
        }

        .detail-image-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

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
          gap: 6px;
          opacity: 0;
          transition: opacity 0.3s ease;
          color: white;
        }

        .detail-image-card:hover .detail-image-overlay {
          opacity: 1;
        }

        .detail-image-overlay i {
          font-size: 24px;
        }

        .detail-image-overlay span {
          font-size: 12px;
        }

        .detail-section {
          margin-bottom: 32px;
        }

        .detail-author {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 24px;
          background: #f8f9fa;
          border-radius: 20px;
        }

        .detail-author-avatar {
          width: 80px;
          height: 80px;
        }

        .detail-author-avatar img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        .avatar-large-placeholder {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 32px;
          font-weight: 600;
        }

        .detail-author-name {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 8px;
          color: #1f2937;
        }

        .detail-author-email,
        .detail-author-phone,
        .detail-author-location,
        .detail-author-joined {
          font-size: 13px;
          color: #6c757d;
          margin: 6px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .detail-info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .detail-info-item label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #6c757d;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .detail-info-item code {
          background: #f8f9fa;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
        }

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
        }

        .category-badge {
          display: inline-block;
          padding: 6px 14px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-radius: 20px;
          font-size: 13px;
        }

        .detail-rejection {
          background: #fef3c7;
          padding: 16px;
          border-radius: 12px;
          color: #92400e;
        }

        .detail-moderation {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 12px;
        }

        .no-details {
          text-align: center;
          padding: 60px;
          color: #9ca3af;
        }

        .loading-details {
          text-align: center;
          padding: 60px;
        }

        /* Quick Reasons */
        .reject-instruction {
          margin-bottom: 20px;
          color: #6c757d;
        }

        .quick-reasons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

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

        .quick-reason:hover {
          background: #e9ecef;
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
          margin-bottom: 20px;
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
          border: 2px solid #e9ecef;
          border-radius: 12px;
          resize: vertical;
          font-size: 14px;
        }

        .custom-reason textarea:focus {
          outline: none;
          border-color: #667eea;
        }

        .warning-note {
          background: #fff3cd;
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #856404;
        }

        /* Lightbox */
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

        .lightbox-prev {
          left: -60px;
        }

        .lightbox-next {
          right: -60px;
        }

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
          padding: 8px 14px;
          background: rgba(0,0,0,0.7);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          transition: all 0.3s ease;
        }

        .lightbox-actions button:hover {
          background: rgba(0,0,0,0.9);
        }

        /* Buttons */
        .btn-secondary {
          padding: 10px 20px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .btn-secondary:hover {
          background: #e9ecef;
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
        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .posts-grid {
            grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .moderation-container {
            padding: 0 16px;
          }

          .hero-section {
            padding: 32px 24px;
          }

          .hero-content {
            flex-direction: column;
            gap: 24px;
            text-align: center;
          }

          .hero-text {
            flex-direction: column;
          }

          .hero-stats {
            justify-content: center;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .filter-tabs {
            flex-wrap: wrap;
          }

          .filter-tab {
            flex: auto;
          }

          .posts-grid {
            grid-template-columns: 1fr;
          }

          .detail-author {
            flex-direction: column;
            text-align: center;
          }

          .detail-info-grid {
            grid-template-columns: 1fr;
          }

          .quick-reasons {
            grid-template-columns: 1fr;
          }

          .footer-actions {
            flex-direction: column;
          }

          .btn-approve-modal, .btn-reject-modal {
            width: 100%;
          }

          .lightbox-prev, .lightbox-next {
            width: 40px;
            height: 40px;
            font-size: 18px;
          }

          .lightbox-prev {
            left: -50px;
          }

          .lightbox-next {
            right: -50px;
          }

          .detail-images-grid {
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          }

          .post-user-meta {
            flex-direction: column;
            gap: 4px;
          }

          .action-buttons {
            flex-direction: column;
          }
        }
      `}</style>
    </AdminLayout>
  )
}