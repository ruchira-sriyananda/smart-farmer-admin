import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase, resolveImageUrl, safeLogActivity } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function ContentModeration() {
  const router = useRouter()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters and search
  const [filter, setFilter] = useState('ALL') // ALL, PENDING, APPROVED, REJECTED, HAS_IMAGES
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('newest') // newest, oldest, images_desc

  // Modals state
  const [selectedPost, setSelectedPost] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)



  // Details Modal image state
  const [modalActiveImageIndex, setModalActiveImageIndex] = useState(0)

  // Lightbox state
  const [showLightbox, setShowLightbox] = useState(false)
  const [lightboxImages, setLightboxImages] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Toast notification
  const [toastMessage, setToastMessage] = useState(null)

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Handle post image fallback across multiple Supabase storage buckets
  const handleImageError = (e) => {
    const target = e.target
    const currentSrc = target.src
    const fallbackBuckets = ['post-images', 'posts', 'barter-images', 'listings', 'images', 'public']

    let supabaseUrl = (
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://uhrolwwkxenvcefnessp.supabase.co'
    ).trim()
    if (supabaseUrl.endsWith('/')) {
      supabaseUrl = supabaseUrl.slice(0, -1)
    }

    const triedStr = target.getAttribute('data-tried') || ''
    const triedBuckets = triedStr ? triedStr.split(',') : []

    const match = currentSrc.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (match) {
      const currentBucket = match[1]
      const filename = match[2]

      if (!triedBuckets.includes(currentBucket)) {
        triedBuckets.push(currentBucket)
      }

      const nextBucket = fallbackBuckets.find(b => !triedBuckets.includes(b))
      if (nextBucket) {
        triedBuckets.push(nextBucket)
        target.setAttribute('data-tried', triedBuckets.join(','))
        target.src = `${supabaseUrl}/storage/v1/object/public/${nextBucket}/${filename}`
        return
      }
    }

    target.onerror = null
    target.src = 'https://placehold.co/600x400/f1f5f9/64748b?text=Image+Unavailable'
  }

  // Handle profile image fallback
  const handleAvatarError = (e) => {
    const target = e.target
    const currentSrc = target.src
    const avatarBuckets = ['profile-images', 'profiles', 'avatars', 'public']

    let supabaseUrl = (
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://uhrolwwkxenvcefnessp.supabase.co'
    ).trim()
    if (supabaseUrl.endsWith('/')) {
      supabaseUrl = supabaseUrl.slice(0, -1)
    }

    const triedStr = target.getAttribute('data-tried') || ''
    const triedBuckets = triedStr ? triedStr.split(',') : []

    const match = currentSrc.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (match) {
      const currentBucket = match[1]
      const filename = match[2]

      if (!triedBuckets.includes(currentBucket)) {
        triedBuckets.push(currentBucket)
      }

      const nextBucket = avatarBuckets.find(b => !triedBuckets.includes(b))
      if (nextBucket) {
        triedBuckets.push(nextBucket)
        target.setAttribute('data-tried', triedBuckets.join(','))
        target.src = `${supabaseUrl}/storage/v1/object/public/${nextBucket}/${filename}`
        return
      }
    }

    target.style.display = 'none'
    if (target.nextSibling) {
      target.nextSibling.style.display = 'flex'
    }
  }

  const quickReasons = [
    { id: 1, reason: 'Inappropriate or explicit content', icon: 'bi-shield-slash-fill', color: '#ef4444' },
    { id: 2, reason: 'Spam, advertising, or promotional link', icon: 'bi-megaphone-fill', color: '#f59e0b' },
    { id: 3, reason: 'Misleading or false information', icon: 'bi-exclamation-triangle-fill', color: '#f59e0b' },
    { id: 4, reason: 'Copyright or trademark violation', icon: 'bi-c-circle-fill', color: '#ef4444' },
    { id: 5, reason: 'Offensive language or hate speech', icon: 'bi-chat-left-dots-fill', color: '#dc2626' },
    { id: 6, reason: 'Duplicate or redundant post', icon: 'bi-files', color: '#6b7280' },
    { id: 7, reason: 'Irrelevant to agriculture community', icon: 'bi-x-octagon-fill', color: '#6b7280' },
    { id: 8, reason: 'Harassment, bullying, or safety concern', icon: 'bi-shield-exclamation', color: '#dc2626' }
  ]

  useEffect(() => {
    fetchPosts()
  }, [])

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showLightbox) return
      if (e.key === 'Escape') setShowLightbox(false)
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showLightbox, lightboxImages])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      setError(null)

      // 1. Fetch all posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })

      if (postsError) throw postsError

      // 2. Fetch content moderation table
      const { data: modData } = await supabase
        .from('content_moderation')
        .select(`
          *,
          reviewed_by_admin:admin_users!reviewed_by (
            admin_id,
            full_name,
            email
          )
        `)

      // 3. Batch fetch users
      const userIds = [...new Set((postsData || []).map(p => p.user_id).filter(Boolean))]
      let usersMap = {}
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('*')
          .in('user_id', userIds)

        if (usersData) {
          usersData.forEach(u => {
            usersMap[u.user_id] = u
          })
        }

        const missingUserIds = userIds.filter(id => !usersMap[id])
        if (missingUserIds.length > 0) {
          const { data: adminsData } = await supabase
            .from('admin_users')
            .select('*')
            .in('admin_id', missingUserIds)

          if (adminsData) {
            adminsData.forEach(a => {
              usersMap[a.admin_id] = { ...a, user_id: a.admin_id, full_name: a.full_name || a.name }
            })
          }
        }
      }

      // 4. Batch fetch categories
      const categoryIds = [...new Set((postsData || []).map(p => p.category_id).filter(Boolean))]
      let categoriesMap = {}
      if (categoryIds.length > 0) {
        const { data: catData } = await supabase
          .from('post_categories')
          .select('*')
          .in('category_id', categoryIds)

        if (catData) {
          catData.forEach(c => {
            categoriesMap[c.category_id] = c
          })
        }
      }

      // 5. Batch fetch post_images
      const postIds = (postsData || []).map(p => p.post_id).filter(Boolean)
      let postImagesMap = {}
      if (postIds.length > 0) {
        const { data: imagesData } = await supabase
          .from('post_images')
          .select('*')
          .in('post_id', postIds)
          .order('image_order', { ascending: true })

        if (imagesData) {
          imagesData.forEach(img => {
            if (!postImagesMap[img.post_id]) postImagesMap[img.post_id] = []
            const rawUrl = img.image_url || img.url || img.path || img.photo_url || img.image_path || img.file_path || img.src || img.uri
            if (rawUrl) {
              const url = resolveImageUrl(rawUrl, 'post-images')
              if (url && !postImagesMap[img.post_id].includes(url)) {
                postImagesMap[img.post_id].push(url)
              }
            }
          })
        }
      }

      // 6. Process and compile final posts list
      const processedPosts = (postsData || []).map(post => {
        const mod = modData?.find(m => String(m.content_id) === String(post.post_id) && m.content_type === 'POST') || null

        const effectiveStatus = mod?.moderation_status || post.status || post.moderation_status || 'PENDING'
        const effectiveReason = mod?.moderation_reason || post.rejection_reason || post.rejected_reason || post.moderation_reason || null

        const modObj = {
          moderation_status: effectiveStatus,
          moderation_reason: effectiveReason,
          moderation_id: mod?.moderation_id || `new-${post.post_id}`,
          content_id: post.post_id,
          content_type: 'POST',
          created_at: mod?.created_at || post.created_at,
          reviewed_by_admin: mod?.reviewed_by_admin || null,
          reviewed_at: mod?.reviewed_at || null
        }

        const userData = usersMap[post.user_id] || null
        const categoryData = categoriesMap[post.category_id] || null

        // Gather all image sources
        let imagesList = postImagesMap[post.post_id] ? [...postImagesMap[post.post_id]] : []

        if (post.image_url) {
          const url = resolveImageUrl(post.image_url, 'post-images')
          if (url && !imagesList.includes(url)) imagesList.push(url)
        }
        if (post.image) {
          const url = resolveImageUrl(post.image, 'post-images')
          if (url && !imagesList.includes(url)) imagesList.push(url)
        }
        if (post.photo_url) {
          const url = resolveImageUrl(post.photo_url, 'post-images')
          if (url && !imagesList.includes(url)) imagesList.push(url)
        }
        if (post.attachment_url) {
          const url = resolveImageUrl(post.attachment_url, 'post-images')
          if (url && !imagesList.includes(url)) imagesList.push(url)
        }
        if (post.media_url) {
          const url = resolveImageUrl(post.media_url, 'post-images')
          if (url && !imagesList.includes(url)) imagesList.push(url)
        }
        if (post.content_image) {
          const url = resolveImageUrl(post.content_image, 'post-images')
          if (url && !imagesList.includes(url)) imagesList.push(url)
        }

        if (post.attachments) {
          let parsedAttachments = []
          if (Array.isArray(post.attachments)) parsedAttachments = post.attachments
          else if (typeof post.attachments === 'string') {
            try {
              const parsed = JSON.parse(post.attachments)
              if (Array.isArray(parsed)) parsedAttachments = parsed
              else if (typeof parsed === 'string') parsedAttachments = [parsed]
            } catch (e) {
              parsedAttachments = post.attachments.split(',').map(s => s.trim())
            }
          }
          parsedAttachments.forEach(att => {
            if (att) {
              const url = resolveImageUrl(typeof att === 'string' ? att : att.url || att.image_url || att.path, 'post-images')
              if (url && !imagesList.includes(url)) imagesList.push(url)
            }
          })
        }

        if (post.images) {
          let parsedImages = []
          if (Array.isArray(post.images)) {
            parsedImages = post.images
          } else if (typeof post.images === 'string') {
            try {
              const parsed = JSON.parse(post.images)
              if (Array.isArray(parsed)) parsedImages = parsed
              else if (typeof parsed === 'string') parsedImages = [parsed]
            } catch (e) {
              parsedImages = post.images.split(',').map(s => s.trim())
            }
          }
          parsedImages.forEach(img => {
            if (img) {
              const url = resolveImageUrl(typeof img === 'string' ? img : img.image_url || img.url, 'post-images')
              if (url && !imagesList.includes(url)) imagesList.push(url)
            }
          })
        }

        // Use post title and content directly without replacing or duplicating text
        let postTitle = post.title || 'Untitled Post'
        let postContent = post.content || 'No content provided'

        // Only cleanup if NOT rejected
        if (effectiveStatus !== 'REJECTED') {
          if (postTitle === '⚠️ [Content Removed - Rejected Post]') {
            postTitle = 'Untitled Post'
          }
          if (typeof postContent === 'string' && postContent.includes('removed from public view due to a violation')) {
            postContent = 'No content provided'
          }
        }

        const finalImages = effectiveStatus === 'REJECTED'
          ? (imagesList.length > 0 ? imagesList : ['https://placehold.co/600x400/fee2e2/dc2626?text=Content+Removed'])
          : imagesList.filter(img => !img.includes('fee2e2/dc2626?text=Content+Removed'))

        return {
          ...modObj,
          status: effectiveStatus,
          rejection_reason: effectiveReason,
          rejected_reason: effectiveReason,
          post_id: post.post_id,
          title: postTitle,
          content: postContent,
          category: categoryData,
          images: finalImages,
          image_count: finalImages.length,
          cover_image: finalImages[0] || null,
          post_created_at: post.created_at,
          user: userData,
          author_name: userData?.full_name || userData?.name || 'Unknown User',
          author_email: userData?.email || 'No email',
          author_phone: userData?.phone || null,
          author_location: userData?.location || userData?.district || null,
          author_joined: userData?.created_at || null,
          user_status: userData?.status || 'Active',
          user_bio: userData?.bio || null,
          user_last_login: userData?.last_login || null,
          user_verified: userData?.is_verified || false,
          user_id: userData?.user_id || post.user_id,
          post_exists: true
        }
      })

      setPosts(processedPosts)
    } catch (err) {
      console.error('Error fetching posts for moderation:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics dynamically
  const stats = useMemo(() => {
    const total = posts.length
    const pending = posts.filter(p => p.moderation_status === 'PENDING').length
    const approved = posts.filter(p => p.moderation_status === 'APPROVED').length
    const rejected = posts.filter(p => p.moderation_status === 'REJECTED').length
    const withImages = posts.filter(p => p.images && p.images.length > 0).length
    return { total, pending, approved, rejected, withImages }
  }, [posts])

  // Filter & Sort Posts
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      // Filter by status tab
      if (filter === 'PENDING' && post.moderation_status !== 'PENDING') return false
      if (filter === 'APPROVED' && post.moderation_status !== 'APPROVED') return false
      if (filter === 'REJECTED' && post.moderation_status !== 'REJECTED') return false
      if (filter === 'HAS_IMAGES' && (!post.images || post.images.length === 0)) return false

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const titleMatch = post.title?.toLowerCase().includes(q)
        const contentMatch = post.content?.toLowerCase().includes(q)
        const authorMatch = post.author_name?.toLowerCase().includes(q)
        const emailMatch = post.author_email?.toLowerCase().includes(q)
        const idMatch = post.content_id?.toString().toLowerCase().includes(q)
        const categoryMatch = post.category?.category_name?.toLowerCase().includes(q)
        if (!titleMatch && !contentMatch && !authorMatch && !emailMatch && !idMatch && !categoryMatch) {
          return false
        }
      }
      return true
    }).sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.post_created_at) - new Date(b.post_created_at)
      }
      if (sortBy === 'images_desc') {
        return (b.images?.length || 0) - (a.images?.length || 0)
      }
      // Default: newest
      return new Date(b.post_created_at) - new Date(a.post_created_at)
    })
  }, [posts, filter, searchTerm, sortBy])

  // Moderation status update
  const updateStatus = async (post, status, reason = null) => {
    setActionLoading(true)
    try {
      const sessionStr = localStorage.getItem('adminSession')
      const session = sessionStr ? JSON.parse(sessionStr) : null
      const finalReason = reason || (status === 'APPROVED' ? null : post.moderation_reason || post.rejection_reason || post.rejected_reason || null)

      // 1. Insert or update in content_moderation table
      const moderationData = {
        content_id: post.content_id,
        content_type: 'POST',
        moderation_status: status,
        reviewed_by: session?.admin?.admin_id || null,
        reviewed_at: new Date().toISOString(),
        moderation_reason: finalReason
      }

      let resultError
      if (post.moderation_id && !post.moderation_id.toString().startsWith('new-')) {
        const { error } = await supabase
          .from('content_moderation')
          .update(moderationData)
          .eq('moderation_id', post.moderation_id)
        resultError = error
      } else {
        const { error } = await supabase
          .from('content_moderation')
          .insert(moderationData)
        resultError = error
      }

      if (resultError) throw resultError

      // 2. If rejected, update post title and content on posts table (preserve original image URLs in posts and post_images so mobile apps can load images)
      if (status === 'REJECTED') {
        try {
          let { error: postErr } = await supabase
            .from('posts')
            .update({
              title: `⚠️ Rejected: ${finalReason}`,
              content: `This post has been removed from public view due to a violation. Reason: ${finalReason}`,
              updated_at: new Date().toISOString()
            })
            .eq('post_id', post.content_id)

          // If updated_at column is missing on posts table, fallback to title and content
          if (postErr && postErr.message?.includes('column')) {
            await supabase
              .from('posts')
              .update({
                title: `⚠️ Rejected: ${finalReason}`,
                content: `This post has been removed from public view due to a violation. Reason: ${finalReason}`
              })
              .eq('post_id', post.content_id)
          }
        } catch (pErr) {
          console.warn('Post table text update notice:', pErr.message)
        }
      }

      // 3. Insert notification for the mobile user if rejected
      if (status === 'REJECTED' && post.user_id) {
        try {
          await supabase
            .from('notifications')
            .insert({
              user_id: post.user_id,
              title: 'Post Rejected',
              message: `Your post "${post.title}" was rejected. Reason: ${finalReason}`,
              type: 'POST_REJECTED',
              related_id: post.content_id,
              is_read: false,
              created_at: new Date().toISOString()
            })
        } catch (notifErr) {
          console.warn('User notification insert warning:', notifErr.message)
        }
      }

      // 4. Log activity
      if (session?.admin?.admin_id) {
        await safeLogActivity(
          session.admin.admin_id,
          'CONTENT_MODERATION',
          `Set status of post "${post.title}" (ID: ${post.content_id}) to ${status}${finalReason ? ` (Reason: ${finalReason})` : ''}`,
          'internal'
        )
      }

      showToast(`Content ${status.toLowerCase()} successfully!`, status === 'APPROVED' ? 'success' : 'warning')

      // Update local state smoothly
      setPosts(prev => prev.map(p => {
        if (p.content_id === post.content_id) {
          const newTitle = status === 'REJECTED' ? `⚠️ Rejected: ${finalReason}` : p.title
          const newContent = status === 'REJECTED' ? `This post has been removed from public view due to a violation. Reason: ${finalReason}` : p.content
          return {
            ...p,
            moderation_status: status,
            status: status,
            moderation_reason: finalReason,
            rejection_reason: finalReason,
            rejected_reason: finalReason,
            title: newTitle,
            content: newContent,
            images: newImages,
            image_count: newImages.length,
            cover_image: newImages[0] || null,
            reviewed_at: new Date().toISOString(),
            reviewed_by_admin: session?.admin ? {
              admin_id: session.admin.admin_id,
              full_name: session.admin.full_name || 'Admin',
              email: session.admin.email
            } : p.reviewed_by_admin
          }
        }
        return p
      }))

      setShowRejectModal(false)
      setRejectReason('')
      setCustomReason('')
      setSelectedPost(null)
      setShowDetailsModal(false)
    } catch (err) {
      console.error('Error updating status:', err)
      showToast(`Failed to update status: ${err.message}`, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async (post) => {
    await updateStatus(post, 'APPROVED')
  }

  const handleRejectSubmit = async () => {
    const finalReason = customReason.trim() || rejectReason
    if (!finalReason) {
      showToast('Please select or enter a rejection reason', 'error')
      return
    }
    await updateStatus(selectedPost, 'REJECTED', finalReason)
  }

  const handleRemovePost = async (post) => {
    if (!confirm(`Are you sure you want to PERMANENTLY remove post "${post.title}"? This cannot be undone.`)) {
      return
    }

    setActionLoading(true)
    try {
      const contentId = post.content_id

      // 1. Delete post images
      await supabase.from('post_images').delete().eq('post_id', contentId)

      // 2. Delete post
      const { error: postErr } = await supabase.from('posts').delete().eq('post_id', contentId)
      if (postErr) throw postErr

      // 3. Delete moderation record
      if (post.moderation_id && !post.moderation_id.toString().startsWith('new-')) {
        await supabase.from('content_moderation').delete().eq('moderation_id', post.moderation_id)
      }

      const sessionStr = localStorage.getItem('adminSession')
      const session = sessionStr ? JSON.parse(sessionStr) : null
      if (session?.admin?.admin_id) {
        await safeLogActivity(
          session.admin.admin_id,
          'CONTENT_REMOVAL',
          `Permanently deleted post "${post.title}" (ID: ${contentId})`,
          'internal'
        )
      }

      showToast('Post removed permanently', 'info')
      setPosts(prev => prev.filter(p => p.content_id !== contentId))
      setShowDetailsModal(false)
      setSelectedPost(null)
    } catch (err) {
      console.error('Error removing post:', err)
      showToast(`Error removing post: ${err.message}`, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const openDetails = (post) => {
    setSelectedPost(post)
    setModalActiveImageIndex(0)
    setShowDetailsModal(true)
  }

  const openLightbox = (imagesList, startIndex = 0) => {
    if (!imagesList || imagesList.length === 0) return
    setLightboxImages(imagesList)
    setLightboxIndex(startIndex)
    setShowLightbox(true)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const d = new Date(dateString)
      if (isNaN(d.getTime())) return 'N/A'
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return 'N/A'
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <span className="status-badge approved"><i className="bi bi-check-circle-fill"></i> Approved</span>
      case 'REJECTED':
        return <span className="status-badge rejected"><i className="bi bi-x-circle-fill"></i> Rejected</span>
      case 'PENDING':
      default:
        return <span className="status-badge pending"><i className="bi bi-clock-history"></i> Pending Review</span>
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Content Moderation">
        <div className="moderation-loading">
          <div className="spinner-glow"></div>
          <p>Loading user content & moderation database...</p>
        </div>
        <style jsx>{`
          .moderation-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 480px;
            color: #64748b;
          }
          .spinner-glow {
            width: 54px;
            height: 54px;
            border: 4px solid #e2e8f0;
            border-top-color: #4f46e5;
            border-radius: 50%;
            animation: spin 0.9s cubic-bezier(0.6, 0.2, 0.4, 0.8) infinite;
            margin-bottom: 20px;
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
      <div className="moderation-page">
        {/* Toast Notification */}
        {toastMessage && (
          <div className={`toast-popup ${toastMessage.type}`}>
            <i className={`bi ${toastMessage.type === 'success' ? 'bi-check-circle-fill' : toastMessage.type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'}`}></i>
            <span>{toastMessage.message}</span>
          </div>
        )}

        {/* Hero Header */}
        <div className="hero-banner">
          <div className="hero-left">
            <div className="hero-badge">
              <i className="bi bi-shield-check"></i>
              <span>Safety & Quality Control</span>
            </div>
            <h1>Content Moderation Hub</h1>
            <p>Review user posts, inspect uploaded images, and maintain platform standards.</p>
          </div>
          <div className="hero-right">
            <button className="btn-refresh" onClick={fetchPosts} title="Refresh content list">
              <i className="bi bi-arrow-clockwise"></i>
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        {/* Interactive Stats Cards */}
        <div className="stats-row">
          <div
            className={`stat-card ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            <div className="stat-icon total"><i className="bi bi-layers-fill"></i></div>
            <div className="stat-content">
              <span className="stat-label">Total Posts</span>
              <h2 className="stat-number">{stats.total}</h2>
              <span className="stat-sub">All platform items</span>
            </div>
          </div>

          <div
            className={`stat-card pending ${filter === 'PENDING' ? 'active' : ''}`}
            onClick={() => setFilter('PENDING')}
          >
            <div className="stat-icon pending"><i className="bi bi-hourglass-split"></i></div>
            <div className="stat-content">
              <span className="stat-label">Pending Review</span>
              <h2 className="stat-number text-amber">{stats.pending}</h2>
              <span className="stat-sub">Awaiting decision</span>
            </div>
            {stats.pending > 0 && <span className="pulse-dot"></span>}
          </div>

          <div
            className={`stat-card approved ${filter === 'APPROVED' ? 'active' : ''}`}
            onClick={() => setFilter('APPROVED')}
          >
            <div className="stat-icon approved"><i className="bi bi-check-lg"></i></div>
            <div className="stat-content">
              <span className="stat-label">Approved</span>
              <h2 className="stat-number text-emerald">{stats.approved}</h2>
              <span className="stat-sub">Live on platform</span>
            </div>
          </div>

          <div
            className={`stat-card rejected ${filter === 'REJECTED' ? 'active' : ''}`}
            onClick={() => setFilter('REJECTED')}
          >
            <div className="stat-icon rejected"><i className="bi bi-x-lg"></i></div>
            <div className="stat-content">
              <span className="stat-label">Rejected</span>
              <h2 className="stat-number text-rose">{stats.rejected}</h2>
              <span className="stat-sub">Declined items</span>
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Filters & Sorting */}
        <div className="toolbar-card">
          <div className="search-box">
            <i className="bi bi-search search-icon"></i>
            <input
              type="text"
              placeholder="Search by title, content, user, category or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-search" onClick={() => setSearchTerm('')}>
                <i className="bi bi-x-lg"></i>
              </button>
            )}
          </div>

          <div className="filter-tabs">
            <button
              className={`filter-chip ${filter === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilter('ALL')}
            >
              <i className="bi bi-grid-fill"></i>
              <span>All</span>
              <span className="count-pill">{stats.total}</span>
            </button>

            <button
              className={`filter-chip warning ${filter === 'PENDING' ? 'active' : ''}`}
              onClick={() => setFilter('PENDING')}
            >
              <i className="bi bi-clock-history"></i>
              <span>Pending</span>
              <span className="count-pill warning">{stats.pending}</span>
            </button>

            <button
              className={`filter-chip success ${filter === 'APPROVED' ? 'active' : ''}`}
              onClick={() => setFilter('APPROVED')}
            >
              <i className="bi bi-check-circle-fill"></i>
              <span>Approved</span>
              <span className="count-pill success">{stats.approved}</span>
            </button>

            <button
              className={`filter-chip danger ${filter === 'REJECTED' ? 'active' : ''}`}
              onClick={() => setFilter('REJECTED')}
            >
              <i className="bi bi-x-circle-fill"></i>
              <span>Rejected</span>
              <span className="count-pill danger">{stats.rejected}</span>
            </button>

            <button
              className={`filter-chip info ${filter === 'HAS_IMAGES' ? 'active' : ''}`}
              onClick={() => setFilter('HAS_IMAGES')}
            >
              <i className="bi bi-images"></i>
              <span>With Images</span>
              <span className="count-pill info">{stats.withImages}</span>
            </button>
          </div>

          <div className="sort-box">
            <label><i className="bi bi-sort-down"></i> Sort:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="images_desc">Most Images</option>
            </select>
          </div>
        </div>

        {/* Results Counter Bar */}
        <div className="results-bar">
          <span>Showing <strong>{filteredPosts.length}</strong> of <strong>{posts.length}</strong> posts</span>
          {(filter !== 'ALL' || searchTerm) && (
            <button className="reset-filters-btn" onClick={() => { setFilter('ALL'); setSearchTerm('') }}>
              <i className="bi bi-x-circle"></i> Reset Filters
            </button>
          )}
        </div>

        {/* Posts Grid */}
        {filteredPosts.length > 0 ? (
          <div className="posts-grid">
            {filteredPosts.map((post) => (
              <div key={post.content_id} className={`post-card ${post.moderation_status.toLowerCase()}`}>
                {/* User Header */}
                <div className="card-user-header">
                  <div className="avatar-wrapper">
                    {post.user?.profile_image ? (
                      <img
                        src={resolveImageUrl(post.user.profile_image, 'profile-images')}
                        alt=""
                        onError={handleAvatarError}
                      />
                    ) : null}
                    <div className="avatar-fallback" style={{ display: post.user?.profile_image ? 'none' : 'flex' }}>
                      {post.author_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  </div>

                  <div className="user-meta">
                    <h4 className="author-name">
                      {post.author_name}
                      {post.user_verified && <i className="bi bi-patch-check-fill verified-badge" title="Verified User"></i>}
                    </h4>
                    <p className="author-email">{post.author_email}</p>
                    <div className="time-location">
                      <span><i className="bi bi-clock"></i> {formatDate(post.post_created_at)}</span>
                      {post.author_location && (
                        <span><i className="bi bi-geo-alt"></i> {post.author_location}</span>
                      )}
                    </div>
                  </div>

                  <div className="status-pill-box">
                    {getStatusBadge(post.moderation_status)}
                  </div>
                </div>

                {/* Images Display Area */}
                <div className="card-media-section">
                  {post.images && post.images.length > 0 ? (
                    <div className="image-display-container">
                      {/* Image Layouts based on Count */}
                      {post.images.length === 1 && (
                        <div className="single-image-wrapper" onClick={() => openLightbox(post.images, 0)}>
                          <img
                            src={post.images[0]}
                            alt={post.title}
                            onError={handleImageError}
                          />
                          <div className="image-zoom-overlay">
                            <i className="bi bi-zoom-in"></i>
                            <span>View Photo</span>
                          </div>
                        </div>
                      )}

                      {post.images.length === 2 && (
                        <div className="dual-image-grid">
                          {post.images.map((img, idx) => (
                            <div key={idx} className="grid-image-item" onClick={() => openLightbox(post.images, idx)}>
                              <img
                                src={img}
                                alt=""
                                onError={handleImageError}
                              />
                              <div className="image-zoom-overlay">
                                <i className="bi bi-zoom-in"></i>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {post.images.length >= 3 && (
                        <div className="multi-image-grid">
                          <div className="grid-main-image" onClick={() => openLightbox(post.images, 0)}>
                            <img
                              src={post.images[0]}
                              alt=""
                              onError={handleImageError}
                            />
                            <div className="image-zoom-overlay">
                              <i className="bi bi-zoom-in"></i>
                            </div>
                          </div>
                          <div className="grid-side-stack">
                            <div className="grid-image-item" onClick={() => openLightbox(post.images, 1)}>
                              <img
                                src={post.images[1]}
                                alt=""
                                onError={handleImageError}
                              />
                              <div className="image-zoom-overlay">
                                <i className="bi bi-zoom-in"></i>
                              </div>
                            </div>
                            <div className="grid-image-item" onClick={() => openLightbox(post.images, post.images.length > 3 ? 2 : 2)}>
                              <img
                                src={post.images[2]}
                                alt=""
                                onError={handleImageError}
                              />
                              {post.images.length > 3 && (
                                <div className="more-images-overlay" onClick={(e) => { e.stopPropagation(); openDetails(post) }}>
                                  <span>+{post.images.length - 2}</span>
                                  <small>more</small>
                                </div>
                              )}
                              {post.images.length <= 3 && (
                                <div className="image-zoom-overlay">
                                  <i className="bi bi-zoom-in"></i>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="media-badge-bar">
                        <span className="photos-count-tag">
                          <i className="bi bi-images"></i> {post.images.length} Image{post.images.length > 1 ? 's' : ''} Attached
                        </span>
                        <button className="preview-all-btn" onClick={() => openLightbox(post.images, 0)}>
                          <i className="bi bi-arrows-angle-expand"></i> Fullscreen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="no-image-banner">
                      <div className="no-image-icon"><i className="bi bi-file-earmark-text"></i></div>
                      <div className="no-image-text">
                        <span>Text Post</span>
                        <small>No images attached to this post</small>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Main Body */}
                <div className="card-body-section">
                  {post.category?.category_name && (
                    <div className="category-pill">
                      <i className="bi bi-tag-fill"></i> {post.category.category_name}
                    </div>
                  )}

                  <h3 className="post-title-text">{post.title}</h3>
                  {post.content && post.content.trim().toLowerCase() !== post.title?.trim().toLowerCase() && (
                    <p className="post-excerpt">
                      {post.content.length > 140 ? `${post.content.substring(0, 140)}...` : post.content}
                    </p>
                  )}

                  {/* Rejection reason banner if rejected */}
                  {post.moderation_status === 'REJECTED' && (post.moderation_reason || post.rejection_reason || post.rejected_reason) && (
                    <div className="rejection-reason-strip">
                      <i className="bi bi-exclamation-triangle-fill"></i>
                      <div>
                        <strong>Reason for Rejection:</strong> {post.moderation_reason || post.rejection_reason || post.rejected_reason}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="card-actions-section">
                  <button className="btn-action-view" onClick={() => openDetails(post)}>
                    <i className="bi bi-eye-fill"></i> Details
                  </button>

                  <div className="action-buttons-group">
                    {post.moderation_status !== 'APPROVED' && (
                      <button
                        className="btn-action-approve"
                        onClick={() => handleApprove(post)}
                        disabled={actionLoading}
                      >
                        <i className="bi bi-check-lg"></i>
                        <span>{post.moderation_status === 'REJECTED' ? 'Re-Approve' : 'Approve'}</span>
                      </button>
                    )}

                    {post.moderation_status !== 'REJECTED' && (
                      <button
                        className="btn-action-reject"
                        onClick={() => { setSelectedPost(post); setShowRejectModal(true) }}
                        disabled={actionLoading}
                      >
                        <i className="bi bi-x-lg"></i>
                        <span>Reject</span>
                      </button>
                    )}

                    <button
                      className="btn-action-delete"
                      onClick={() => handleRemovePost(post)}
                      disabled={actionLoading}
                      title="Permanently remove post"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-results-card">
            <div className="empty-icon"><i className="bi bi-inbox-fill"></i></div>
            <h3>No posts found matching your filter</h3>
            <p>Try clearing your search query or selecting a different status filter above.</p>
            <button className="btn-primary-reset" onClick={() => { setFilter('ALL'); setSearchTerm('') }}>
              View All Content
            </button>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedPost && (
        <div className="modal-backdrop" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-box details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top-bar">
              <div className="modal-title-box">
                <i className="bi bi-file-earmark-post-fill title-icon"></i>
                <div>
                  <h2>Post & Author Detailed View</h2>
                  <p>Content ID: <code>{selectedPost.content_id}</code></p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowDetailsModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="modal-scroll-content">
              {/* Image Gallery Showcase in Modal */}
              {selectedPost.images && selectedPost.images.length > 0 ? (
                <div className="modal-gallery-block">
                  <div className="active-modal-image-view">
                    <img
                      src={selectedPost.images[modalActiveImageIndex] || selectedPost.images[0]}
                      alt="Selected preview"
                      onError={handleImageError}
                      onClick={() => openLightbox(selectedPost.images, modalActiveImageIndex)}
                    />
                    <button
                      className="expand-image-btn"
                      onClick={() => openLightbox(selectedPost.images, modalActiveImageIndex)}
                    >
                      <i className="bi bi-arrows-angle-expand"></i> Zoom Fullscreen
                    </button>
                    <div className="image-counter-tag">
                      Photo {modalActiveImageIndex + 1} of {selectedPost.images.length}
                    </div>
                  </div>

                  {selectedPost.images.length > 1 && (
                    <div className="modal-thumbnails-strip">
                      {selectedPost.images.map((imgUrl, idx) => (
                        <div
                          key={idx}
                          className={`thumbnail-item ${idx === modalActiveImageIndex ? 'active' : ''}`}
                          onClick={() => setModalActiveImageIndex(idx)}
                        >
                          <img src={imgUrl} alt="" onError={handleImageError} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="modal-no-image-notice">
                  <i className="bi bi-image-alt"></i>
                  <span>No images attached to this post</span>
                </div>
              )}

              {/* Author Dossier */}
              <div className="modal-section-card">
                <h3 className="section-heading"><i className="bi bi-person-circle"></i> Author Dossier</h3>
                <div className="author-dossier-grid">
                  <div className="author-avatar-large">
                    {selectedPost.user?.profile_image ? (
                      <img
                        src={resolveImageUrl(selectedPost.user.profile_image, 'profile-images')}
                        alt=""
                        onError={handleAvatarError}
                      />
                    ) : (
                      <span>{selectedPost.author_name?.charAt(0)?.toUpperCase() || 'U'}</span>
                    )}
                  </div>

                  <div className="author-info-fields">
                    <h4>
                      {selectedPost.author_name}
                      {selectedPost.user_verified && <span className="verified-badge-pill"><i className="bi bi-patch-check-fill"></i> Verified</span>}
                    </h4>

                    <div className="fields-grid">
                      <div className="field-item">
                        <label>Email Address</label>
                        <span>{selectedPost.author_email}</span>
                      </div>

                      {selectedPost.author_phone && (
                        <div className="field-item">
                          <label>Phone Number</label>
                          <span>{selectedPost.author_phone}</span>
                        </div>
                      )}

                      {selectedPost.author_location && (
                        <div className="field-item">
                          <label>Location / District</label>
                          <span>{selectedPost.author_location}</span>
                        </div>
                      )}

                      <div className="field-item">
                        <label>Member Since</label>
                        <span>{formatDate(selectedPost.author_joined)}</span>
                      </div>

                      <div className="field-item">
                        <label>Account Status</label>
                        <span className={`status-text ${selectedPost.user_status?.toLowerCase()}`}>{selectedPost.user_status}</span>
                      </div>
                    </div>

                    {selectedPost.user_bio && (
                      <div className="author-bio-box">
                        <label>Bio / Notes:</label>
                        <p>{selectedPost.user_bio}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Post Content Details */}
              <div className="modal-section-card">
                <h3 className="section-heading"><i className="bi bi-card-text"></i> Post Information</h3>

                <div className="content-meta-bar">
                  <div className="meta-pill">
                    <label>Status:</label> {getStatusBadge(selectedPost.moderation_status)}
                  </div>
                  {selectedPost.category?.category_name && (
                    <div className="meta-pill category">
                      <i className="bi bi-tag-fill"></i> {selectedPost.category.category_name}
                    </div>
                  )}
                  <div className="meta-pill date">
                    <i className="bi bi-calendar3"></i> Posted {formatDate(selectedPost.post_created_at)}
                  </div>
                </div>

                <div className="full-post-body">
                  <h2 className="full-title">{selectedPost.title}</h2>
                  {selectedPost.content && selectedPost.content.trim().toLowerCase() !== selectedPost.title?.trim().toLowerCase() && (
                    <div className="full-text">{selectedPost.content}</div>
                  )}
                </div>
              </div>

              {/* Moderation History */}
              {(selectedPost.moderation_reason || selectedPost.rejection_reason || selectedPost.rejected_reason) && (
                <div className="modal-section-card warning-border">
                  <h3 className="section-heading text-amber"><i className="bi bi-exclamation-triangle-fill"></i> Rejection History</h3>
                  <div className="rejection-history-box">
                    <p className="reason-text">{selectedPost.moderation_reason || selectedPost.rejection_reason || selectedPost.rejected_reason}</p>
                    {selectedPost.reviewed_by_admin && (
                      <p className="reviewed-by-text">
                        Reviewed by <strong>{selectedPost.reviewed_by_admin.full_name}</strong> ({selectedPost.reviewed_by_admin.email}) on {formatDate(selectedPost.reviewed_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="modal-bottom-bar">
              <div className="modal-actions-left">
                {selectedPost.moderation_status !== 'APPROVED' && (
                  <button className="btn-modal-approve" onClick={() => handleApprove(selectedPost)} disabled={actionLoading}>
                    <i className="bi bi-check-lg"></i> Approve Post
                  </button>
                )}

                {selectedPost.moderation_status !== 'REJECTED' && (
                  <button
                    className="btn-modal-reject"
                    onClick={() => { setShowDetailsModal(false); setShowRejectModal(true) }}
                    disabled={actionLoading}
                  >
                    <i className="bi bi-x-lg"></i> Reject Post
                  </button>
                )}

                <button className="btn-modal-delete" onClick={() => handleRemovePost(selectedPost)} disabled={actionLoading}>
                  <i className="bi bi-trash"></i> Delete Post
                </button>
              </div>

              <button className="btn-modal-close" onClick={() => setShowDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedPost && (
        <div className="modal-backdrop" onClick={() => setShowRejectModal(false)}>
          <div className="modal-box reject-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top-bar danger-header">
              <div className="modal-title-box">
                <i className="bi bi-exclamation-octagon-fill title-icon danger"></i>
                <div>
                  <h2>Reject Content</h2>
                  <p>Select reason for rejecting post: "{selectedPost.title}"</p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowRejectModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="modal-scroll-content">
              <p className="reject-instruction">Please select a standard reason or provide a custom explanation below:</p>

              <div className="quick-reasons-grid">
                {quickReasons.map((item) => (
                  <div
                    key={item.id}
                    className={`reason-chip ${rejectReason === item.reason ? 'selected' : ''}`}
                    onClick={() => {
                      setRejectReason(item.reason)
                      setCustomReason('')
                    }}
                  >
                    <i className={`bi ${item.icon}`} style={{ color: item.color }}></i>
                    <span>{item.reason}</span>
                    {rejectReason === item.reason && <i className="bi bi-check-circle-fill check-icon"></i>}
                  </div>
                ))}
              </div>

              <div className="custom-reason-block">
                <label>Custom Rejection Reason / Additional Notes:</label>
                <textarea
                  rows="3"
                  placeholder="Describe specifically why this content is being rejected..."
                  value={customReason}
                  onChange={(e) => {
                    setCustomReason(e.target.value)
                    setRejectReason('')
                  }}
                />
              </div>
            </div>

            <div className="modal-bottom-bar">
              <button className="btn-modal-close" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button
                className="btn-modal-reject"
                onClick={handleRejectSubmit}
                disabled={actionLoading || (!rejectReason && !customReason.trim())}
              >
                {actionLoading ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Fullscreen Preview */}
      {showLightbox && lightboxImages.length > 0 && (
        <div className="lightbox-backdrop" onClick={() => setShowLightbox(false)}>
          <div className="lightbox-dialog" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setShowLightbox(false)}>
              <i className="bi bi-x-lg"></i>
            </button>

            {lightboxImages.length > 1 && (
              <>
                <button
                  className="lightbox-nav prev"
                  onClick={() => setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)}
                >
                  <i className="bi bi-chevron-left"></i>
                </button>
                <button
                  className="lightbox-nav next"
                  onClick={() => setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)}
                >
                  <i className="bi bi-chevron-right"></i>
                </button>
              </>
            )}

            <div className="lightbox-media-container">
              <img src={lightboxImages[lightboxIndex]} alt="Fullscreen view" onError={handleImageError} />
            </div>

            <div className="lightbox-toolbar">
              <span className="lightbox-counter">Image {lightboxIndex + 1} of {lightboxImages.length}</span>
              <a href={lightboxImages[lightboxIndex]} target="_blank" rel="noreferrer" className="lightbox-external-link">
                <i className="bi bi-box-arrow-up-right"></i> Open Original
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Styled JSX */}
      <style jsx>{`
        .moderation-page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px;
        }

        /* Toast Popup */
        .toast-popup {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 2000;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 24px;
          border-radius: 14px;
          background: #0f172a;
          color: white;
          box-shadow: 0 12px 24px -6px rgba(0,0,0,0.25);
          font-weight: 500;
          font-size: 14px;
          animation: slideIn 0.3s ease;
        }
        .toast-popup.success { border-left: 5px solid #10b981; }
        .toast-popup.warning { border-left: 5px solid #f59e0b; }
        .toast-popup.error { border-left: 5px solid #ef4444; }
        .toast-popup.info { border-left: 5px solid #3b82f6; }

        /* Hero Banner */
        .hero-banner {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%);
          border-radius: 24px;
          padding: 32px 40px;
          margin-bottom: 28px;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 10px 25px -5px rgba(49, 46, 129, 0.3);
        }
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(8px);
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .hero-left h1 {
          font-size: 28px;
          font-weight: 800;
          margin: 0 0 6px 0;
          letter-spacing: -0.5px;
        }
        .hero-left p {
          margin: 0;
          color: rgba(255,255,255,0.8);
          font-size: 14px;
        }
        .btn-refresh {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 14px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-refresh:hover {
          background: rgba(255,255,255,0.25);
          transform: translateY(-2px);
        }

        /* Stats Row */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }
        .stat-card {
          background: white;
          border-radius: 20px;
          padding: 22px;
          display: flex;
          align-items: center;
          gap: 16px;
          border: 2px solid #f1f5f9;
          cursor: pointer;
          transition: all 0.25s ease;
          position: relative;
        }
        .stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 20px -5px rgba(0,0,0,0.08);
          border-color: #cbd5e1;
        }
        .stat-card.active {
          border-color: #4f46e5;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12);
        }
        .stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }
        .stat-icon.total { background: #e0e7ff; color: #4338ca; }
        .stat-icon.pending { background: #fef3c7; color: #d97706; }
        .stat-icon.approved { background: #d1fae5; color: #059669; }
        .stat-icon.rejected { background: #fee2e2; color: #dc2626; }

        .stat-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; }
        .stat-number { font-size: 26px; font-weight: 800; margin: 2px 0 0 0; color: #0f172a; }
        .stat-sub { font-size: 11px; color: #94a3b8; }
        .text-amber { color: #d97706; }
        .text-emerald { color: #059669; }
        .text-rose { color: #dc2626; }

        .pulse-dot {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 10px;
          height: 10px;
          background: #f59e0b;
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
          animation: pulseRing 1.8s infinite;
        }
        @keyframes pulseRing {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }

        /* Toolbar */
        .toolbar-card {
          background: white;
          border-radius: 20px;
          padding: 18px 24px;
          display: flex;
          gap: 20px;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          flex-wrap: wrap;
        }
        .search-box {
          position: relative;
          flex: 1;
          min-width: 280px;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 16px;
        }
        .search-box input {
          width: 100%;
          padding: 10px 36px 10px 42px;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          font-size: 13.5px;
          outline: none;
          transition: all 0.2s ease;
        }
        .search-box input:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        .clear-search {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
        }

        .filter-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .filter-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .filter-chip:hover { background: #f1f5f9; color: #1e293b; }
        .filter-chip.active {
          background: #4f46e5;
          color: white;
          border-color: #4f46e5;
        }
        .count-pill {
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 11px;
          background: rgba(0,0,0,0.08);
        }
        .filter-chip.active .count-pill { background: rgba(255,255,255,0.25); color: white; }

        .sort-box {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
        }
        .sort-box select {
          padding: 8px 12px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          font-size: 13px;
          outline: none;
          cursor: pointer;
          background: white;
        }

        /* Results bar */
        .results-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 0 4px;
          font-size: 13px;
          color: #64748b;
        }
        .reset-filters-btn {
          background: none;
          border: none;
          color: #ef4444;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Posts Grid */
        .posts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
        }

        .post-card {
          background: white;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 6px rgba(0,0,0,0.03);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .post-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 28px -6px rgba(0,0,0,0.08);
          border-color: #cbd5e1;
        }

        /* Card User Header */
        .card-user-header {
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid #f1f5f9;
          background: #fafbfc;
        }
        .avatar-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          overflow: hidden;
          position: relative;
          flex-shrink: 0;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
        }
        .avatar-wrapper img { width: 100%; height: 100%; object-fit: cover; }
        .avatar-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 18px;
        }
        .user-meta { flex: 1; min-width: 0; }
        .author-name {
          font-size: 14px;
          font-weight: 700;
          margin: 0 0 2px 0;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .verified-badge { color: #10b981; font-size: 13px; }
        .author-email {
          font-size: 11.5px;
          color: #64748b;
          margin: 0 0 4px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .time-location {
          display: flex;
          gap: 10px;
          font-size: 10.5px;
          color: #94a3b8;
        }

        /* Status Pills */
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }
        .status-badge.pending { background: #fef3c7; color: #b45309; }
        .status-badge.approved { background: #d1fae5; color: #047857; }
        .status-badge.rejected { background: #fee2e2; color: #b91c1c; }

        /* Media Display */
        .card-media-section {
          background: #f8fafc;
          border-bottom: 1px solid #f1f5f9;
        }
        .image-display-container { position: relative; }

        .single-image-wrapper {
          position: relative;
          height: 220px;
          overflow: hidden;
          cursor: pointer;
        }
        .single-image-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .single-image-wrapper:hover img { transform: scale(1.04); }

        .dual-image-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3px;
          height: 200px;
        }
        .multi-image-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 3px;
          height: 210px;
        }
        .grid-main-image { position: relative; height: 100%; cursor: pointer; overflow: hidden; }
        .grid-main-image img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
        .grid-main-image:hover img { transform: scale(1.04); }

        .grid-side-stack { display: grid; grid-template-rows: 1fr 1fr; gap: 3px; height: 100%; }
        .grid-image-item { position: relative; height: 100%; cursor: pointer; overflow: hidden; }
        .grid-image-item img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
        .grid-image-item:hover img { transform: scale(1.04); }

        .image-zoom-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: white;
          font-size: 13px;
          font-weight: 600;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .single-image-wrapper:hover .image-zoom-overlay,
        .grid-image-item:hover .image-zoom-overlay,
        .grid-main-image:hover .image-zoom-overlay {
          opacity: 1;
        }

        .more-images-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.75);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 18px;
        }
        .more-images-overlay small { font-size: 11px; font-weight: 500; text-transform: uppercase; }

        .media-badge-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 14px;
          background: rgba(15, 23, 42, 0.04);
          font-size: 11.5px;
          color: #475569;
          font-weight: 600;
        }
        .preview-all-btn {
          background: none;
          border: none;
          color: #4f46e5;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
        }

        .no-image-banner {
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          background: #f8fafc;
          color: #94a3b8;
        }
        .no-image-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #64748b;
        }
        .no-image-text span { display: block; font-size: 13px; font-weight: 700; color: #475569; }
        .no-image-text small { font-size: 11px; }

        /* Warning Banner for Rejected Media */
        .warning-rejected-banner {
          padding: 28px 20px;
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border-bottom: 1px solid #fca5a5;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .warning-rejected-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: #ef4444;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2);
        }
        .warning-rejected-text span {
          display: block;
          font-size: 13.5px;
          font-weight: 800;
          color: #991b1b;
        }
        .warning-rejected-text small {
          font-size: 11.5px;
          color: #b91c1c;
        }

        .modal-warning-image-banner {
          padding: 42px 24px;
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border-radius: 16px;
          text-align: center;
          color: #991b1b;
          border: 1.5px dashed #fca5a5;
        }
        .modal-warning-image-banner .warning-big-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: #ef4444;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin: 0 auto 12px;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
        }
        .modal-warning-image-banner h3 {
          font-size: 16px;
          font-weight: 800;
          margin: 0 0 4px 0;
        }
        .modal-warning-image-banner p {
          font-size: 13px;
          margin: 0;
          color: #b91c1c;
        }

        /* Card Body */
        .card-body-section {
          padding: 18px 20px;
          flex: 1;
        }
        .category-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 8px;
          background: #e0e7ff;
          color: #4338ca;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .post-title-text {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
          line-height: 1.4;
        }
        .post-title-text.text-danger {
          color: #dc2626 !important;
        }
        .post-excerpt {
          font-size: 13px;
          color: #475569;
          line-height: 1.5;
          margin: 0;
        }
        .post-excerpt.text-muted {
          color: #7f1d1d !important;
          font-style: italic;
        }
        .rejection-reason-strip {
          margin-top: 12px;
          padding: 10px 12px;
          background: #fef2f2;
          border-left: 3px solid #ef4444;
          border-radius: 6px;
          font-size: 12px;
          color: #991b1b;
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .btn-show-original {
          margin-top: 12px;
          padding: 6px 12px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 700;
          color: #475569;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }
        .btn-show-original:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .btn-show-original.active {
          background: #fee2e2;
          border-color: #fca5a5;
          color: #b91c1c;
        }

        .warning-body {
          border-color: #fca5a5 !important;
          background: #fff5f5 !important;
        }

        /* Card Actions */
        .card-actions-section {
          padding: 14px 20px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          gap: 10px;
          align-items: center;
          background: #ffffff;
        }
        .btn-action-view {
          padding: 9px 14px;
          background: #f1f5f9;
          border: none;
          border-radius: 10px;
          color: #334155;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }
        .btn-action-view:hover { background: #e2e8f0; color: #0f172a; }

        .action-buttons-group {
          display: flex;
          gap: 6px;
          flex: 1;
          justify-content: flex-end;
        }
        .btn-action-approve {
          padding: 9px 14px;
          background: #d1fae5;
          color: #047857;
          border: none;
          border-radius: 10px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s ease;
        }
        .btn-action-approve:hover { background: #10b981; color: white; }

        .btn-action-reject {
          padding: 9px 14px;
          background: #fee2e2;
          color: #b91c1c;
          border: none;
          border-radius: 10px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s ease;
        }
        .btn-action-reject:hover { background: #ef4444; color: white; }

        .btn-action-delete {
          padding: 9px 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #94a3b8;
          border-radius: 10px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-action-delete:hover { background: #fee2e2; border-color: #fca5a5; color: #dc2626; }

        /* Empty State */
        .empty-results-card {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 24px;
          border: 1px dashed #cbd5e1;
          margin-top: 20px;
        }
        .empty-icon {
          width: 72px;
          height: 72px;
          background: #f1f5f9;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          color: #94a3b8;
          margin: 0 auto 16px;
        }
        .empty-results-card h3 { font-size: 18px; margin: 0 0 6px 0; color: #0f172a; }
        .empty-results-card p { color: #64748b; font-size: 14px; margin: 0 0 20px 0; }
        .btn-primary-reset {
          padding: 10px 20px;
          background: #4f46e5;
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        /* Modals */
        .modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(6px);
          z-index: 1200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }
        .modal-box {
          background: white;
          border-radius: 24px;
          width: 100%;
          max-width: 820px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3);
        }
        .modal-top-bar {
          padding: 20px 28px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #ffffff;
        }
        .modal-title-box { display: flex; align-items: center; gap: 14px; }
        .title-icon {
          font-size: 24px;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: #e0e7ff;
          color: #4338ca;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .title-icon.danger { background: #fee2e2; color: #dc2626; }
        .modal-title-box h2 { font-size: 18px; font-weight: 700; margin: 0; color: #0f172a; }
        .modal-title-box p { margin: 2px 0 0 0; font-size: 12px; color: #64748b; }
        .modal-close-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #f1f5f9;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
        }
        .modal-close-btn:hover { background: #e2e8f0; color: #0f172a; }

        .modal-scroll-content {
          padding: 24px 28px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Modal Gallery */
        .active-modal-image-view {
          position: relative;
          height: 380px;
          background: #0f172a;
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .active-modal-image-view img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          cursor: zoom-in;
        }
        .expand-image-btn {
          position: absolute;
          top: 14px;
          right: 14px;
          padding: 8px 14px;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 10px;
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .image-counter-tag {
          position: absolute;
          bottom: 14px;
          left: 14px;
          padding: 6px 12px;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(4px);
          border-radius: 10px;
          color: white;
          font-size: 11.5px;
          font-weight: 600;
        }
        .modal-thumbnails-strip {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-top: 12px;
        }
        .thumbnail-item {
          width: 72px;
          height: 72px;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
          flex-shrink: 0;
          opacity: 0.6;
          transition: all 0.2s ease;
        }
        .thumbnail-item.active { opacity: 1; border-color: #4f46e5; }
        .thumbnail-item img { width: 100%; height: 100%; object-fit: cover; }
        .modal-no-image-notice {
          padding: 24px;
          background: #f8fafc;
          border-radius: 16px;
          text-align: center;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
        }

        /* Modal Dossier Cards */
        .modal-section-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
        }
        .section-heading {
          font-size: 14px;
          font-weight: 700;
          color: #334155;
          margin: 0 0 16px 0;
          display: flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .author-dossier-grid {
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }
        .author-avatar-large {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 24px;
          flex-shrink: 0;
        }
        .author-avatar-large img { width: 100%; height: 100%; object-fit: cover; }

        .author-info-fields { flex: 1; }
        .author-info-fields h4 { font-size: 16px; font-weight: 700; margin: 0 0 12px 0; color: #0f172a; display: flex; align-items: center; gap: 6px; }
        .verified-badge-pill {
          font-size: 11px;
          background: #d1fae5;
          color: #047857;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 600;
        }
        .fields-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px 20px;
        }
        .field-item label { display: block; font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 2px; text-transform: uppercase; }
        .field-item span { font-size: 13px; font-weight: 600; color: #0f172a; }
        .author-bio-box {
          margin-top: 14px;
          padding: 10px 14px;
          background: white;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          font-size: 12.5px;
        }
        .author-bio-box label { display: block; font-weight: 700; color: #64748b; margin-bottom: 4px; }
        .author-bio-box p { margin: 0; color: #334155; }

        .content-meta-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .meta-pill { font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 6px; }

        .full-post-body {
          background: white;
          padding: 20px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }
        .full-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; }
        .full-text { font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-wrap; }

        /* Rejection History */
        .rejection-history-box {
          background: #fef2f2;
          padding: 14px 18px;
          border-radius: 12px;
          border-left: 4px solid #ef4444;
        }
        .reason-text { font-size: 13.5px; font-weight: 600; color: #991b1b; margin: 0 0 6px 0; }
        .reviewed-by-text { font-size: 11.5px; color: #7f1d1d; margin: 0; }

        /* Modal Footer */
        .modal-bottom-bar {
          padding: 18px 28px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #ffffff;
        }
        .modal-actions-left { display: flex; gap: 10px; }
        .btn-modal-approve {
          padding: 10px 18px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .btn-modal-reject {
          padding: 10px 18px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .btn-modal-delete {
          padding: 10px 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #dc2626;
          border-radius: 10px;
          font-size: 13px;
          cursor: pointer;
        }
        .btn-modal-close {
          padding: 10px 20px;
          background: #f1f5f9;
          border: none;
          border-radius: 10px;
          color: #334155;
          font-weight: 600;
          cursor: pointer;
        }

        /* Reject Modal Grid */
        .reject-modal { max-width: 580px; }
        .reject-instruction { font-size: 13.5px; color: #475569; margin: 0 0 16px 0; }
        .quick-reasons-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .reason-chip {
          padding: 12px 14px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12.5px;
          font-weight: 600;
          color: #334155;
          position: relative;
          transition: all 0.2s ease;
        }
        .reason-chip:hover { background: #f1f5f9; border-color: #cbd5e1; }
        .reason-chip.selected {
          background: #fef3c7;
          border-color: #f59e0b;
          color: #78350f;
        }
        .check-icon { position: absolute; right: 10px; color: #d97706; }

        .custom-reason-block label { display: block; font-size: 12.5px; font-weight: 700; color: #334155; margin-bottom: 6px; }
        .custom-reason-block textarea {
          width: 100%;
          padding: 12px;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          font-size: 13px;
          outline: none;
          resize: vertical;
        }
        .custom-reason-block textarea:focus { border-color: #4f46e5; }

        /* Lightbox Fullscreen */
        .lightbox-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.92);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease;
        }
        .lightbox-dialog {
          position: relative;
          max-width: 92vw;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .lightbox-close {
          position: absolute;
          top: -46px;
          right: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lightbox-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .lightbox-nav:hover { background: rgba(255, 255, 255, 0.35); }
        .lightbox-nav.prev { left: -60px; }
        .lightbox-nav.next { right: -60px; }

        .lightbox-media-container {
          max-width: 88vw;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lightbox-media-container img {
          max-width: 88vw;
          max-height: 80vh;
          object-fit: contain;
          border-radius: 8px;
        }

        .lightbox-toolbar {
          margin-top: 16px;
          display: flex;
          gap: 20px;
          align-items: center;
          color: white;
          font-size: 13px;
        }
        .lightbox-external-link {
          color: #818cf8;
          text-decoration: none;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .stats-row { grid-template-columns: repeat(2, 1fr); }
          .posts-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
        }

        @media (max-width: 768px) {
          .moderation-page { padding: 16px; }
          .hero-banner { flex-direction: column; text-align: center; gap: 20px; padding: 24px; }
          .stats-row { grid-template-columns: 1fr; }
          .toolbar-card { flex-direction: column; align-items: stretch; }
          .filter-tabs { overflow-x: auto; padding-bottom: 6px; }
          .quick-reasons-grid { grid-template-columns: 1fr; }
          .fields-grid { grid-template-columns: 1fr; }
          .lightbox-nav.prev { left: 10px; }
          .lightbox-nav.next { right: 10px; }
          .modal-box { border-radius: 16px; }
          .modal-top-bar, .modal-scroll-content, .modal-bottom-bar { padding: 16px; }
        }
      `}</style>
    </AdminLayout>
  )
}
