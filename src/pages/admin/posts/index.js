import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function MobileUsers() {
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showBanModal, setShowBanModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [userImages, setUserImages] = useState({})
  const [showFullImage, setShowFullImage] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    banned: 0,
    farmers: 0,
    vendors: 0,
    newToday: 0,
    verified: 0,
    pending: 0
  })

  useEffect(() => {
    fetchUsers()
    fetchStats()
    
    const subscription = supabase
      .channel('mobile_users_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'users' },
        () => {
          fetchUsers()
          fetchStats()
        }
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [])

  // Helper function to get Supabase storage URL for images
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null
    if (imagePath.startsWith('http')) return imagePath
    try {
      const { data } = supabase.storage.from('user-images').getPublicUrl(imagePath)
      return data?.publicUrl || imagePath
    } catch {
      return imagePath
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          roles!users_role_id_fkey (
            role_id,
            role_name
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (data && data.length > 0) {
        const processedUsers = data.map(user => ({
          ...user,
          role_name: user.roles?.role_name || 'USER',
          status: user.status || 'active',
          is_verified: user.is_verified || false
        }))
        setUsers(processedUsers)
        
        // Fetch images for users
        const images = {}
        for (const user of processedUsers) {
          // Fetch profile image
          if (user.profile_image) {
            images[user.user_id] = {
              profile: getImageUrl(user.profile_image),
              posts: []
            }
          }
          
          // Fetch user's post images
          const { data: userPosts } = await supabase
            .from('posts')
            .select('post_id, image_url')
            .eq('user_id', user.user_id)
            .limit(5)
          
          if (userPosts && userPosts.length > 0) {
            const postImages = []
            for (const post of userPosts) {
              // Get images from post_images table
              const { data: postImagesData } = await supabase
                .from('post_images')
                .select('image_url')
                .eq('post_id', post.post_id)
                .limit(3)
              
              if (postImagesData && postImagesData.length > 0) {
                postImagesData.forEach(img => {
                  if (img.image_url) {
                    postImages.push(getImageUrl(img.image_url))
                  }
                })
              } else if (post.image_url) {
                postImages.push(getImageUrl(post.image_url))
              }
            }
            
            if (!images[user.user_id]) {
              images[user.user_id] = { profile: null, posts: [] }
            }
            images[user.user_id].posts = [...new Set(postImages)].slice(0, 6)
          }
        }
        setUserImages(images)
      } else {
        setUsers([])
      }
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('*')

      if (usersError) throw usersError

      if (!allUsers || allUsers.length === 0) {
        setStats({
          total: 0,
          active: 0,
          banned: 0,
          farmers: 0,
          vendors: 0,
          newToday: 0,
          verified: 0,
          pending: 0
        })
        return
      }

      const { data: roles } = await supabase
        .from('roles')
        .select('role_id, role_name')

      const roleMap = {}
      roles?.forEach(r => { roleMap[r.role_name] = r.role_id })

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const total = allUsers.length
      const active = allUsers.filter(u => u.status === 'active').length
      const banned = allUsers.filter(u => u.status === 'banned').length
      const pending = allUsers.filter(u => u.status === 'pending').length
      const verified = allUsers.filter(u => u.is_verified === true).length
      const newToday = allUsers.filter(u => new Date(u.created_at) >= today).length
      
      let farmersCount = 0
      let vendorsCount = 0
      
      if (roleMap['FARMER']) {
        farmersCount = allUsers.filter(u => u.role_id === roleMap['FARMER']).length
      }
      if (roleMap['VENDOR']) {
        vendorsCount = allUsers.filter(u => u.role_id === roleMap['VENDOR']).length
      }

      setStats({
        total,
        active,
        banned,
        farmers: farmersCount,
        vendors: vendorsCount,
        newToday,
        verified,
        pending
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const handleBanUser = async () => {
    if (!banReason.trim()) {
      alert('Please provide a reason for banning')
      return
    }
    
    setActionLoading(true)
    
    try {
      const updateData = {
        status: 'banned',
        updated_at: new Date().toISOString()
      }
      
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('user_id', selectedUser.user_id)

      if (error) throw error

      alert('User has been banned successfully!')
      fetchUsers()
      fetchStats()
      setShowBanModal(false)
      setSelectedUser(null)
      setBanReason('')
    } catch (err) {
      console.error('Error banning user:', err)
      alert('Error banning user: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnbanUser = async (userId) => {
    if (!confirm('Are you sure you want to unban this user?')) return
    
    setActionLoading(true)
    
    try {
      const updateData = {
        status: 'active',
        updated_at: new Date().toISOString()
      }
      
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('user_id', userId)

      if (error) throw error

      alert('User has been unbanned successfully!')
      fetchUsers()
      fetchStats()
    } catch (err) {
      console.error('Error unbanning user:', err)
      alert('Error unbanning user: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteUser = async () => {
    setActionLoading(true)
    
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('user_id', selectedUser.user_id)

      if (error) throw error

      alert('User deleted successfully!')
      fetchUsers()
      fetchStats()
      setShowDeleteModal(false)
      setSelectedUser(null)
    } catch (err) {
      console.error('Error deleting user:', err)
      alert('Error deleting user: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const openFullImage = (imageUrl) => {
    setSelectedImage(imageUrl)
    setShowFullImage(true)
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'active': { class: 'success', icon: 'bi-check-circle-fill', text: 'Active' },
      'banned': { class: 'danger', icon: 'bi-ban-fill', text: 'Banned' },
      'pending': { class: 'warning', icon: 'bi-clock-fill', text: 'Pending' },
      'inactive': { class: 'secondary', icon: 'bi-x-circle-fill', text: 'Inactive' }
    }
    const s = statusMap[status] || statusMap['active']
    return (
      <span className={`status-badge ${s.class}`}>
        <i className={`bi ${s.icon}`}></i>
        {s.text}
      </span>
    )
  }

  const getRoleBadge = (roleName) => {
    const roleMap = {
      'FARMER': { class: 'farmer', icon: 'bi-tree-fill', text: 'Farmer' },
      'VENDOR': { class: 'vendor', icon: 'bi-shop', text: 'Vendor' },
      'ADMIN': { class: 'admin', icon: 'bi-shield-lock-fill', text: 'Admin' }
    }
    const r = roleMap[roleName] || { class: 'default', icon: 'bi-person', text: roleName || 'User' }
    return (
      <span className={`role-badge ${r.class}`}>
        <i className={`bi ${r.icon}`}></i>
        {r.text}
      </span>
    )
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.phone && user.phone.includes(searchTerm))
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus
    const matchesRole = filterRole === 'all' || user.role_name?.toLowerCase() === filterRole
    return matchesSearch && matchesStatus && matchesRole
  })

  if (loading) {
    return (
      <AdminLayout title="Mobile Users">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading users...</p>
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
    <AdminLayout title="Mobile Users Management">
      <div className="users-container">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-content">
            <div className="hero-text">
              <div className="hero-icon-wrapper">
                <i className="bi bi-people-fill"></i>
              </div>
              <div>
                <h1 className="hero-title">Mobile Users Management</h1>
                <p className="hero-subtitle">Manage and monitor all mobile application users</p>
              </div>
            </div>
            <div className="hero-actions">
              <button className="btn-refresh" onClick={() => { fetchUsers(); fetchStats(); }}>
                <i className="bi bi-arrow-repeat"></i> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-icon"><i className="bi bi-people"></i></div>
            <div className="stat-info">
              <span className="stat-label">Total Users</span>
              <h3>{stats.total}</h3>
              <span className="stat-trend">All registered users</span>
            </div>
          </div>
          <div className="stat-card active">
            <div className="stat-icon"><i className="bi bi-person-check"></i></div>
            <div className="stat-info">
              <span className="stat-label">Active Users</span>
              <h3 className="text-success">{stats.active}</h3>
              <span className="stat-trend">{stats.total > 0 ? ((stats.active/stats.total)*100).toFixed(0) : 0}% of total</span>
            </div>
          </div>
          <div className="stat-card banned">
            <div className="stat-icon"><i className="bi bi-ban"></i></div>
            <div className="stat-info">
              <span className="stat-label">Banned Users</span>
              <h3 className="text-danger">{stats.banned}</h3>
              <span className="stat-trend">Restricted access</span>
            </div>
          </div>
          <div className="stat-card farmers">
            <div className="stat-icon"><i className="bi bi-tree"></i></div>
            <div className="stat-info">
              <span className="stat-label">Farmers</span>
              <h3 className="text-info">{stats.farmers}</h3>
              <span className="stat-trend">Agricultural producers</span>
            </div>
          </div>
          <div className="stat-card vendors">
            <div className="stat-icon"><i className="bi bi-shop"></i></div>
            <div className="stat-info">
              <span className="stat-label">Vendors</span>
              <h3 className="text-warning">{stats.vendors}</h3>
              <span className="stat-trend">Product sellers</span>
            </div>
          </div>
          <div className="stat-card new">
            <div className="stat-icon"><i className="bi bi-calendar-plus"></i></div>
            <div className="stat-info">
              <span className="stat-label">New Today</span>
              <h3 className="text-primary">{stats.newToday}</h3>
              <span className="stat-trend">Last 24 hours</span>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="controls-bar">
          <div className="controls-left">
            <div className="search-box">
              <i className="bi bi-search"></i>
              <input 
                type="text" 
                placeholder="Search by name, email or phone..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="clear-search" onClick={() => setSearchTerm('')}>
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
            <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
              <option value="pending">Pending</option>
            </select>
            <select className="filter-select" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="farmer">Farmers</option>
              <option value="vendor">Vendors</option>
            </select>
          </div>
          <div className="info-text">
            <i className="bi bi-info-circle"></i>
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>

        {/* Users Cards Grid - Replacing Table */}
        <div className="users-cards-grid">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <div key={user.user_id} className="user-card">
                <div className="user-card-header">
                  <div className="user-avatar">
                    {userImages[user.user_id]?.profile ? (
                      <img src={userImages[user.user_id].profile} alt={user.full_name} />
                    ) : (
                      <span>{user.full_name?.charAt(0) || 'U'}</span>
                    )}
                  </div>
                  <div className="user-header-info">
                    <h3 className="user-name">{user.full_name}</h3>
                    <div className="user-badges">
                      {getRoleBadge(user.role_name)}
                      {getStatusBadge(user.status)}
                    </div>
                  </div>
                  <div className="user-actions">
                    <button className="action-icon view" onClick={() => { setSelectedUser(user); setShowDetailsModal(true); }} title="View Details">
                      <i className="bi bi-eye"></i>
                    </button>
                    {user.status !== 'banned' ? (
                      <button className="action-icon ban" onClick={() => { setSelectedUser(user); setShowBanModal(true); }} title="Ban User">
                        <i className="bi bi-ban"></i>
                      </button>
                    ) : (
                      <button className="action-icon unban" onClick={() => handleUnbanUser(user.user_id)} title="Unban User">
                        <i className="bi bi-check-circle"></i>
                      </button>
                    )}
                    <button className="action-icon delete" onClick={() => { setSelectedUser(user); setShowDeleteModal(true); }} title="Delete User">
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>

                <div className="user-card-body">
                  <div className="user-contact">
                    <div className="contact-item">
                      <i className="bi bi-envelope"></i>
                      <span>{user.email}</span>
                    </div>
                    {user.phone && (
                      <div className="contact-item">
                        <i className="bi bi-telephone"></i>
                        <span>{user.phone}</span>
                      </div>
                    )}
                    {user.location && (
                      <div className="contact-item">
                        <i className="bi bi-geo-alt"></i>
                        <span>{user.location}</span>
                      </div>
                    )}
                    {user.is_verified && (
                      <div className="verified-badge">
                        <i className="bi bi-check-circle-fill"></i> Verified Account
                      </div>
                    )}
                  </div>

                  {/* User's Uploaded Images */}
                  {userImages[user.user_id]?.posts && userImages[user.user_id].posts.length > 0 && (
                    <div className="user-images-section">
                      <div className="images-header">
                        <i className="bi bi-images"></i>
                        <span>Uploaded Images ({userImages[user.user_id].posts.length})</span>
                      </div>
                      <div className="user-images-grid">
                        {userImages[user.user_id].posts.slice(0, 6).map((img, idx) => (
                          <div key={idx} className="user-image-item" onClick={() => openFullImage(img)}>
                            <img src={img} alt={`Uploaded by ${user.full_name}`} />
                            <div className="image-overlay">
                              <i className="bi bi-zoom-in"></i>
                            </div>
                          </div>
                        ))}
                        {userImages[user.user_id].posts.length > 6 && (
                          <div className="more-images">
                            +{userImages[user.user_id].posts.length - 6} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="user-meta-info">
                    <div className="meta-item">
                      <i className="bi bi-calendar3"></i>
                      Joined: {new Date(user.created_at).toLocaleDateString()}
                    </div>
                    <div className="meta-item">
                      <i className="bi bi-clock"></i>
                      Last active: {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <i className="bi bi-people-slash"></i>
              <h3>No Users Found</h3>
              <p>No mobile users match your search criteria</p>
              <button className="btn-clear-filters" onClick={() => { setSearchTerm(''); setFilterStatus('all'); setFilterRole('all'); }}>
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* User Details Modal */}
      {showDetailsModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-wrapper">
                  <i className="bi bi-person-circle"></i>
                </div>
                <div>
                  <h2>User Details</h2>
                  <p>Complete user information</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="user-profile-header">
                <div className="user-avatar-large">
                  {userImages[selectedUser.user_id]?.profile ? (
                    <img src={userImages[selectedUser.user_id].profile} alt={selectedUser.full_name} />
                  ) : (
                    <span>{selectedUser.full_name?.charAt(0) || 'U'}</span>
                  )}
                </div>
                <div className="user-profile-info">
                  <h3>{selectedUser.full_name}</h3>
                  <div className="user-meta">
                    {getRoleBadge(selectedUser.role_name)}
                    {getStatusBadge(selectedUser.status)}
                  </div>
                  <div className="user-id-full">ID: {selectedUser.user_id}</div>
                </div>
              </div>

              <div className="details-grid">
                <div className="detail-section">
                  <h4><i className="bi bi-envelope"></i> Contact Information</h4>
                  <div><strong>Email:</strong> {selectedUser.email}</div>
                  <div><strong>Phone:</strong> {selectedUser.phone || 'Not provided'}</div>
                  <div><strong>Location:</strong> {selectedUser.location || 'Not provided'}</div>
                  {selectedUser.is_verified && <div className="verified-badge-sm"><i className="bi bi-check-circle-fill"></i> Verified Account</div>}
                </div>
                <div className="detail-section">
                  <h4><i className="bi bi-calendar"></i> Account Information</h4>
                  <div><strong>Joined:</strong> {new Date(selectedUser.created_at).toLocaleString()}</div>
                  <div><strong>Last Updated:</strong> {new Date(selectedUser.updated_at).toLocaleString()}</div>
                  <div><strong>Last Login:</strong> {selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString() : 'Never'}</div>
                </div>

                {/* User's Uploaded Images in Modal */}
                {userImages[selectedUser.user_id]?.posts && userImages[selectedUser.user_id].posts.length > 0 && (
                  <div className="detail-section full-width">
                    <h4><i className="bi bi-images"></i> Uploaded Images ({userImages[selectedUser.user_id].posts.length})</h4>
                    <div className="modal-images-grid">
                      {userImages[selectedUser.user_id].posts.map((img, idx) => (
                        <div key={idx} className="modal-image-item" onClick={() => openFullImage(img)}>
                          <img src={img} alt={`Upload ${idx + 1}`} />
                          <div className="image-overlay">
                            <i className="bi bi-zoom-in"></i>
                            <span>Click to enlarge</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedUser.bio && (
                  <div className="detail-section full-width">
                    <h4><i className="bi bi-file-text"></i> Bio</h4>
                    <p>{selectedUser.bio}</p>
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

      {/* Ban User Modal */}
      {showBanModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowBanModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header warning">
              <div className="modal-icon-wrapper"><i className="bi bi-ban"></i></div>
              <div><h2>Ban User</h2><p>Provide a reason for banning</p></div>
              <button className="modal-close" onClick={() => setShowBanModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="modal-body">
              <div className="ban-user-info">
                <div className="user-avatar-small">
                  {userImages[selectedUser.user_id]?.profile ? (
                    <img src={userImages[selectedUser.user_id].profile} alt={selectedUser.full_name} />
                  ) : (
                    <span>{selectedUser.full_name?.charAt(0)}</span>
                  )}
                </div>
                <div><strong>{selectedUser.full_name}</strong><br />{selectedUser.email}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Ban Reason *</label>
                <textarea className="form-textarea" rows="4" placeholder="Enter reason for banning..." value={banReason} onChange={(e) => setBanReason(e.target.value)} />
              </div>
              <div className="warning-message"><i className="bi bi-exclamation-triangle-fill"></i> Banned users cannot access the platform.</div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowBanModal(false)}>Cancel</button>
              <button className="btn-primary danger" onClick={handleBanUser} disabled={actionLoading}>
                {actionLoading ? 'Banning...' : 'Ban User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header danger">
              <div className="modal-icon-wrapper"><i className="bi bi-trash"></i></div>
              <div><h2>Delete User</h2><p>This action cannot be undone</p></div>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to permanently delete <strong>{selectedUser.full_name}</strong>?</p>
              <div className="warning-message"><i className="bi bi-exclamation-triangle-fill"></i> All user data will be permanently removed.</div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn-primary danger" onClick={handleDeleteUser} disabled={actionLoading}>
                {actionLoading ? 'Deleting...' : 'Delete User'}
              </button>
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

      <style jsx>{`
        .users-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px;
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
          flex-wrap: wrap;
          gap: 20px;
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

        .btn-refresh {
          padding: 10px 24px;
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 12px;
          color: white;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-refresh:hover {
          background: rgba(255,255,255,0.3);
          transform: translateY(-2px);
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 20px;
          margin-bottom: 32px;
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

        .total .stat-icon { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
        .active .stat-icon { background: rgba(16,185,129,0.1); color: #10b981; }
        .banned .stat-icon { background: rgba(239,68,68,0.1); color: #ef4444; }
        .farmers .stat-icon { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .vendors .stat-icon { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .new .stat-icon { background: rgba(139,92,246,0.1); color: #8b5cf6; }

        .stat-info { flex: 1; }
        .stat-label { font-size: 12px; color: #6c757d; margin-bottom: 4px; display: block; }
        .stat-info h3 { font-size: 28px; font-weight: 700; margin: 0; }
        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }
        .text-info { color: #3b82f6; }
        .text-warning { color: #f59e0b; }
        .text-primary { color: #8b5cf6; }
        .stat-trend { font-size: 11px; color: #6c757d; }

        /* Controls Bar */
        .controls-bar {
          background: white;
          border-radius: 20px;
          padding: 16px 20px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .controls-left {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          flex: 1;
        }

        .search-box {
          position: relative;
          min-width: 300px;
          flex: 1;
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
          padding: 10px 40px 10px 40px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .search-box input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }

        .clear-search {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
        }

        .filter-select {
          padding: 10px 12px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
          min-width: 140px;
          background: white;
          cursor: pointer;
        }

        .info-text {
          padding: 8px 16px;
          background: #f8f9fa;
          border-radius: 12px;
          font-size: 13px;
          color: #6c757d;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Users Cards Grid */
        .users-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
        }

        .user-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .user-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }

        .user-card-header {
          padding: 20px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
        }

        .user-avatar {
          width: 64px;
          height: 64px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-size: 28px;
          font-weight: 600;
        }

        .user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .user-header-info {
          flex: 1;
        }

        .user-name {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
        }

        .user-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .role-badge, .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
          background: rgba(255,255,255,0.2);
          color: white;
        }

        .user-actions {
          display: flex;
          gap: 8px;
        }

        .action-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .action-icon:hover {
          background: rgba(255,255,255,0.3);
          transform: scale(1.05);
        }

        .user-card-body {
          padding: 20px;
        }

        .user-contact {
          margin-bottom: 16px;
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #4b5563;
          margin-bottom: 8px;
        }

        .contact-item i {
          width: 18px;
          color: #9ca3af;
        }

        .verified-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: #d1fae5;
          border-radius: 20px;
          font-size: 11px;
          color: #065f46;
          margin-top: 8px;
        }

        /* User Images Section */
        .user-images-section {
          margin: 16px 0;
          padding-top: 16px;
          border-top: 1px solid #e9ecef;
        }

        .images-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 12px;
        }

        .images-header i {
          color: #667eea;
        }

        .user-images-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .user-image-item {
          position: relative;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          background: #f8f9fa;
        }

        .user-image-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .user-image-item:hover img {
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

        .user-image-item:hover .image-overlay {
          opacity: 1;
        }

        .image-overlay i {
          font-size: 20px;
          color: white;
        }

        .more-images {
          background: #e9ecef;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: #6c757d;
        }

        .user-meta-info {
          display: flex;
          justify-content: space-between;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e9ecef;
          font-size: 11px;
          color: #9ca3af;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Modal Images Grid */
        .modal-images-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 16px;
        }

        .modal-image-item {
          position: relative;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid #e9ecef;
          transition: all 0.3s ease;
        }

        .modal-image-item:hover {
          border-color: #667eea;
          transform: scale(1.02);
        }

        .modal-image-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 24px;
        }

        .empty-state i {
          font-size: 80px;
          color: #cbd5e1;
          margin-bottom: 16px;
          display: block;
        }

        .btn-clear-filters {
          margin-top: 20px;
          padding: 12px 32px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        /* Loading */
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

        .modal-container.modal-lg {
          max-width: 800px;
        }

        .modal-header {
          padding: 24px 28px 20px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
        }

        .modal-header.warning .modal-icon-wrapper {
          background: rgba(245,158,11,0.1);
          color: #f59e0b;
        }

        .modal-header.danger .modal-icon-wrapper {
          background: rgba(239,68,68,0.1);
          color: #ef4444;
        }

        .modal-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-icon-wrapper i {
          font-size: 24px;
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
          position: absolute;
          right: 20px;
          top: 20px;
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #9ca3af;
          transition: all 0.3s ease;
        }

        .modal-close:hover {
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 28px;
        }

        .modal-footer {
          padding: 16px 28px 28px;
          border-top: 1px solid #e9ecef;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .user-profile-header {
          display: flex;
          align-items: center;
          gap: 24px;
          padding-bottom: 24px;
          margin-bottom: 24px;
          border-bottom: 1px solid #e9ecef;
        }

        .user-avatar-large {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 600;
          color: white;
          overflow: hidden;
        }

        .user-avatar-large img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .user-profile-info h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
        }

        .user-meta {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }

        .user-id-full {
          font-size: 12px;
          color: #6c757d;
          font-family: monospace;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }

        .detail-section {
          background: #f8f9fa;
          border-radius: 16px;
          padding: 20px;
        }

        .detail-section.full-width {
          grid-column: span 2;
        }

        .detail-section h4 {
          margin: 0 0 16px 0;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        .detail-section h4 i {
          margin-right: 8px;
          color: #667eea;
        }

        .detail-section div {
          margin-bottom: 8px;
          font-size: 13px;
        }

        .verified-badge-sm {
          font-size: 11px;
          color: #10b981;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 8px;
        }

        .ban-user-info {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 16px;
          margin-bottom: 20px;
        }

        .user-avatar-small {
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
          overflow: hidden;
        }

        .user-avatar-small img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .form-group {
          margin-bottom: 20px;
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
        }

        .warning-message {
          background: #fef3c7;
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: #92400e;
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

        .btn-primary.danger {
          background: #ef4444;
          color: white;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

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

        .full-image-modal img {
          max-width: 100%;
          max-height: 85vh;
          display: block;
          margin: 0 auto;
        }

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

        .close-image:hover {
          background: rgba(0,0,0,0.9);
          transform: rotate(90deg);
        }

        .image-actions {
          position: absolute;
          bottom: 16px;
          right: 16px;
        }

        .image-actions button {
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

        .image-actions button:hover {
          background: rgba(0,0,0,0.9);
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
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .users-container {
            padding: 0 16px;
          }

          .hero-section {
            padding: 32px 24px;
          }

          .hero-content {
            flex-direction: column;
            text-align: center;
          }

          .hero-text {
            flex-direction: column;
          }

          .hero-title {
            font-size: 24px;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .controls-bar {
            flex-direction: column;
          }

          .controls-left {
            width: 100%;
            flex-direction: column;
          }

          .search-box {
            width: 100%;
          }

          .filter-select {
            width: 100%;
          }

          .users-cards-grid {
            grid-template-columns: 1fr;
          }

          .user-card-header {
            flex-wrap: wrap;
          }

          .user-actions {
            margin-left: auto;
          }

          .user-images-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .detail-section.full-width {
            grid-column: span 1;
          }

          .user-profile-header {
            flex-direction: column;
            text-align: center;
          }

          .user-meta {
            justify-content: center;
          }

          .modal-images-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </AdminLayout>
  )
}