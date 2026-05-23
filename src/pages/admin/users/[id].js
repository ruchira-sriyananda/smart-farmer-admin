import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function UserDetails() {
  const router = useRouter()
  const { id } = router.query
  const [user, setUser] = useState(null)
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [currentAdmin, setCurrentAdmin] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (id) {
      fetchCurrentAdmin()
      fetchUserDetails()
      fetchUserActivities()
    }
  }, [id])

  const fetchCurrentAdmin = async () => {
    const session = localStorage.getItem('adminSession')
    if (session) {
      const parsed = JSON.parse(session)
      setCurrentAdmin(parsed.admin)
    }
  }

  const fetchUserDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select(`
          *,
          admin_roles!admin_users_role_id_fkey (
            role_id,
            role_name,
            description
          )
        `)
        .eq('admin_id', id)
        .single()

      if (!error && data) {
        setUser(data)
      }
    } catch (err) {
      console.error('Error fetching user:', err)
    }
  }

  const fetchUserActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .eq('admin_id', id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!error && data) {
        setActivities(data)
      }
    } catch (err) {
      console.error('Error fetching activities:', err)
    } finally {
      setLoading(false)
    }
  }

  const isCurrentUser = () => {
    return currentAdmin?.admin_id === user?.admin_id
  }

  const handleStatusToggle = async () => {
    // Prevent self-deactivation
    if (isCurrentUser()) {
      alert('You cannot deactivate your own account!')
      return
    }
    
    setUpdating(true)
    const { error } = await supabase
      .from('admin_users')
      .update({ 
        is_active: !user.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('admin_id', id)

    if (!error) {
      fetchUserDetails()
      setShowDeactivateModal(false)
    }
    setUpdating(false)
  }

  const handleDeleteUser = async () => {
    // Prevent self-deletion
    if (isCurrentUser()) {
      alert('You cannot delete your own account!')
      return
    }
    
    setUpdating(true)
    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('admin_id', id)

    if (!error) {
      router.push('/admin/users')
    }
    setUpdating(false)
  }

  const handleRoleChange = async (newRoleId) => {
    setUpdating(true)
    const { error } = await supabase
      .from('admin_users')
      .update({ 
        role_id: newRoleId,
        updated_at: new Date().toISOString()
      })
      .eq('admin_id', id)

    if (!error) {
      fetchUserDetails()
    }
    setUpdating(false)
  }

  const getRoleBadge = (roleName) => {
    const badges = {
      'SUPER_ADMIN': { class: 'badge-super', icon: 'bi-star-fill', text: 'Super Administrator' },
      'CONTENT_ADMIN': { class: 'badge-content', icon: 'bi-file-post', text: 'Content Administrator' },
      'SECURITY_ADMIN': { class: 'badge-security', icon: 'bi-shield-lock', text: 'Security Administrator' },
      'SUPPORT_ADMIN': { class: 'badge-support', icon: 'bi-headset', text: 'Support Administrator' }
    }
    const badge = badges[roleName] || { class: 'badge-default', icon: 'bi-person', text: roleName || 'No Role Assigned' }
    return (
      <span className={`role-badge ${badge.class}`}>
        <i className={`bi ${badge.icon}`}></i>
        {badge.text}
      </span>
    )
  }

  const getActivityIcon = (type) => {
    const icons = {
      'LOGIN': 'bi-box-arrow-in-right',
      'LOGOUT': 'bi-box-arrow-right',
      'USER_MANAGEMENT': 'bi-people',
      'CONTENT_MODERATION': 'bi-file-post',
      'REPORT_HANDLING': 'bi-flag',
      'SECURITY_ALERT': 'bi-shield-exclamation',
      'PROFILE_UPDATE': 'bi-person-gear'
    }
    return icons[type] || 'bi-activity'
  }

  const getActivityColor = (type) => {
    const colors = {
      'LOGIN': 'success',
      'LOGOUT': 'warning',
      'USER_MANAGEMENT': 'primary',
      'CONTENT_MODERATION': 'info',
      'REPORT_HANDLING': 'danger',
      'SECURITY_ALERT': 'danger',
      'PROFILE_UPDATE': 'secondary'
    }
    return colors[type] || 'secondary'
  }

  if (loading) {
    return (
      <AdminLayout title="User Details">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading user details...</p>
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

  if (!user) {
    return (
      <AdminLayout title="User Details">
        <div className="error-container">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <h3>User Not Found</h3>
          <p>The requested user does not exist or has been removed.</p>
          <button className="back-btn" onClick={() => router.push('/admin/users')}>
            <i className="bi bi-arrow-left"></i> Back to Users
          </button>
        </div>
        <style jsx>{`
          .error-container {
            text-align: center;
            padding: 60px 20px;
            background: white;
            border-radius: 24px;
            max-width: 500px;
            margin: 40px auto;
          }
          .error-container i {
            font-size: 48px;
            color: #dc3545;
            margin-bottom: 16px;
          }
          .error-container h3 {
            margin-bottom: 8px;
          }
          .back-btn {
            margin-top: 20px;
            padding: 10px 24px;
            background: #4f46e5;
            color: white;
            border: none;
            border-radius: 12px;
          }
        `}</style>
      </AdminLayout>
    )
  }

  const isSelf = isCurrentUser()

  return (
    <AdminLayout title={`User: ${user.full_name}`}>
      <div className="user-details-container">
        {/* Header */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="bi bi-person-badge"></i>
            </div>
            <div>
              <h1 className="header-title">{user.full_name}</h1>
              <p className="header-subtitle">
                <i className="bi bi-envelope"></i> {user.email}
              </p>
            </div>
          </div>
          <button className="back-button" onClick={() => router.back()}>
            <i className="bi bi-arrow-left"></i>
            <span>Back</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs-container">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <i className="bi bi-person-circle"></i>
            Overview
          </button>
          <button 
            className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <i className="bi bi-clock-history"></i>
            Activity Log
            {activities.length > 0 && <span className="tab-badge">{activities.length}</span>}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'permissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('permissions')}
          >
            <i className="bi bi-shield-lock"></i>
            Permissions
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="content-grid">
            {/* Profile Card */}
            <div className="profile-card">
              <div className="profile-header">
                <div className="profile-avatar">
                  {user.profile_image ? (
                    <img src={user.profile_image} alt={user.full_name} />
                  ) : (
                    <span>{user.full_name?.charAt(0)}</span>
                  )}
                  {user.is_super_admin && (
                    <div className="super-badge">
                      <i className="bi bi-star-fill"></i>
                    </div>
                  )}
                </div>
                <div className="profile-info">
                  <h2>{user.full_name}</h2>
                  <p>{user.email}</p>
                  <div className="profile-meta">
                    {getRoleBadge(user.admin_roles?.role_name)}
                    <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                      <span className="status-dot"></span>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="profile-stats">
                <div className="stat-item">
                  <i className="bi bi-calendar3"></i>
                  <div>
                    <span className="stat-label">Joined</span>
                    <strong>{new Date(user.created_at).toLocaleDateString()}</strong>
                  </div>
                </div>
                <div className="stat-item">
                  <i className="bi bi-clock-history"></i>
                  <div>
                    <span className="stat-label">Last Login</span>
                    <strong>{user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</strong>
                  </div>
                </div>
                <div className="stat-item">
                  <i className="bi bi-activity"></i>
                  <div>
                    <span className="stat-label">Total Activities</span>
                    <strong>{activities.length}</strong>
                  </div>
                </div>
                <div className="stat-item">
                  <i className="bi bi-arrow-repeat"></i>
                  <div>
                    <span className="stat-label">Last Updated</span>
                    <strong>{user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'N/A'}</strong>
                  </div>
                </div>
              </div>

              <div className="profile-contact">
                <h4>Contact Information</h4>
                <div className="contact-item">
                  <i className="bi bi-envelope-fill"></i>
                  <div>
                    <span>Email Address</span>
                    <p>{user.email}</p>
                  </div>
                </div>
                {user.phone_number && (
                  <div className="contact-item">
                    <i className="bi bi-telephone-fill"></i>
                    <div>
                      <span>Phone Number</span>
                      <p>{user.phone_number}</p>
                    </div>
                  </div>
                )}
                {user.location && (
                  <div className="contact-item">
                    <i className="bi bi-geo-alt-fill"></i>
                    <div>
                      <span>Location</span>
                      <p>{user.location}</p>
                    </div>
                  </div>
                )}
              </div>

              {user.bio && (
                <div className="profile-bio">
                  <h4>Bio</h4>
                  <p>{user.bio}</p>
                </div>
              )}
            </div>

            {/* Action Cards */}
            <div className="actions-sidebar">
              <div className="action-card">
                <h4>Account Actions</h4>
                <div className="action-buttons">
                  <button 
                    className="action-btn edit-btn"
                    onClick={() => router.push(`/admin/users/${id}/edit`)}
                  >
                    <i className="bi bi-pencil-square"></i>
                    Edit User
                  </button>
                  {!isSelf ? (
                    <>
                      <button 
                        className={`action-btn ${user.is_active ? 'deactivate-btn' : 'activate-btn'}`}
                        onClick={() => setShowDeactivateModal(true)}
                      >
                        <i className={`bi ${user.is_active ? 'bi-ban' : 'bi-check-circle'}`}></i>
                        {user.is_active ? 'Deactivate Account' : 'Activate Account'}
                      </button>
                      <button 
                        className="action-btn delete-btn"
                        onClick={() => setShowDeleteModal(true)}
                      >
                        <i className="bi bi-trash"></i>
                        Delete User
                      </button>
                    </>
                  ) : (
                    <div className="self-warning">
                      <i className="bi bi-shield-exclamation"></i>
                      <span>You cannot modify your own account</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="info-card">
                <h4>Account Information</h4>
                <div className="info-item">
                  <span>User ID</span>
                  <code>{user.admin_id?.slice(0, 8)}...</code>
                </div>
                <div className="info-item">
                  <span>Role ID</span>
                  <code>{user.role_id?.slice(0, 8) || 'None'}</code>
                </div>
                <div className="info-item">
                  <span>Super Admin</span>
                  <span className={user.is_super_admin ? 'text-success' : 'text-muted'}>
                    {user.is_super_admin ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="activity-container">
            <div className="activity-header">
              <h3><i className="bi bi-clock-history"></i> Activity Log</h3>
              <p>Recent actions performed by this user</p>
            </div>
            <div className="activity-timeline">
              {activities.length > 0 ? (
                activities.map((activity, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className={`timeline-icon bg-${getActivityColor(activity.activity_type)}`}>
                      <i className={`bi ${getActivityIcon(activity.activity_type)}`}></i>
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-type">{activity.activity_type}</span>
                        <span className="timeline-date">{new Date(activity.created_at).toLocaleString()}</span>
                      </div>
                      <p className="timeline-description">{activity.activity_description}</p>
                      {activity.ip_address && (
                        <div className="timeline-meta">
                          <i className="bi bi-ip"></i>
                          <span>IP: {activity.ip_address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-activities">
                  <i className="bi bi-inbox"></i>
                  <p>No activity records found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div className="permissions-container">
            <div className="permissions-card">
              <h3><i className="bi bi-shield-lock"></i> User Permissions</h3>
              <p>Access levels and capabilities</p>
              
              <div className="permissions-list">
                <div className="permission-item">
                  <div className="permission-info">
                    <i className="bi bi-people"></i>
                    <div>
                      <strong>User Management</strong>
                      <span>Create, edit, and delete users</span>
                    </div>
                  </div>
                  <span className={`permission-status ${user.is_super_admin ? 'enabled' : (user.admin_roles?.role_name === 'SUPER_ADMIN' ? 'enabled' : 'disabled')}`}>
                    {user.is_super_admin || user.admin_roles?.role_name === 'SUPER_ADMIN' ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                <div className="permission-item">
                  <div className="permission-info">
                    <i className="bi bi-file-post"></i>
                    <div>
                      <strong>Content Moderation</strong>
                      <span>Manage and moderate posts</span>
                    </div>
                  </div>
                  <span className={`permission-status ${user.is_super_admin || user.admin_roles?.role_name === 'CONTENT_ADMIN' ? 'enabled' : 'disabled'}`}>
                    {user.is_super_admin || user.admin_roles?.role_name === 'CONTENT_ADMIN' ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                <div className="permission-item">
                  <div className="permission-info">
                    <i className="bi bi-shield-shaded"></i>
                    <div>
                      <strong>Security Management</strong>
                      <span>Configure security settings</span>
                    </div>
                  </div>
                  <span className={`permission-status ${user.is_super_admin || user.admin_roles?.role_name === 'SECURITY_ADMIN' ? 'enabled' : 'disabled'}`}>
                    {user.is_super_admin || user.admin_roles?.role_name === 'SECURITY_ADMIN' ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                <div className="permission-item">
                  <div className="permission-info">
                    <i className="bi bi-headset"></i>
                    <div>
                      <strong>Support Access</strong>
                      <span>Handle user support tickets</span>
                    </div>
                  </div>
                  <span className={`permission-status ${user.is_super_admin || user.admin_roles?.role_name === 'SUPPORT_ADMIN' ? 'enabled' : 'disabled'}`}>
                    {user.is_super_admin || user.admin_roles?.role_name === 'SUPPORT_ADMIN' ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                <div className="permission-item">
                  <div className="permission-info">
                    <i className="bi bi-graph-up"></i>
                    <div>
                      <strong>Analytics Access</strong>
                      <span>View platform analytics</span>
                    </div>
                  </div>
                  <span className={`permission-status ${user.is_super_admin ? 'enabled' : 'disabled'}`}>
                    {user.is_super_admin ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                <div className="permission-item">
                  <div className="permission-info">
                    <i className="bi bi-gear"></i>
                    <div>
                      <strong>System Settings</strong>
                      <span>Modify system configuration</span>
                    </div>
                  </div>
                  <span className={`permission-status ${user.is_super_admin ? 'enabled' : 'disabled'}`}>
                    {user.is_super_admin ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Deactivate Confirmation Modal */}
      {showDeactivateModal && (
        <div className="modal-overlay" onClick={() => setShowDeactivateModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header warning">
              <div className="modal-icon">
                <i className="bi bi-exclamation-triangle-fill"></i>
              </div>
              <h3>Confirm Deactivation</h3>
              <button className="modal-close" onClick={() => setShowDeactivateModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to <strong>{user.is_active ? 'deactivate' : 'activate'}</strong> 
                <br />
                <span className="user-highlight">{user.full_name}</span>?
              </p>
              {user.is_active && (
                <div className="warning-message">
                  <i className="bi bi-info-circle-fill"></i>
                  Deactivated users will lose access to the admin panel immediately.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeactivateModal(false)}>Cancel</button>
              <button className={`btn-primary ${user.is_active ? 'danger' : 'success'}`} onClick={handleStatusToggle}>
                {user.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header danger">
              <div className="modal-icon">
                <i className="bi bi-trash-fill"></i>
              </div>
              <h3>Delete User</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to permanently delete <br />
                <span className="user-highlight">{user.full_name}</span>?
              </p>
              <div className="warning-message danger">
                <i className="bi bi-exclamation-triangle-fill"></i>
                This action cannot be undone. All user data will be permanently lost.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn-primary danger" onClick={handleDeleteUser}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .user-details-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Header */
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

        .header-subtitle i {
          margin-right: 6px;
        }

        .back-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          color: #495057;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .back-button:hover {
          background: #e9ecef;
          transform: translateX(-2px);
        }

        /* Tabs */
        .tabs-container {
          display: flex;
          gap: 8px;
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

        .tab-badge {
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
          margin-left: 6px;
        }

        /* Content Grid */
        .content-grid {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 24px;
        }

        /* Profile Card */
        .profile-card {
          background: white;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .profile-header {
          display: flex;
          gap: 24px;
          padding: 28px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .profile-avatar {
          position: relative;
          width: 100px;
          height: 100px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          font-weight: 600;
        }

        .profile-avatar img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        .super-badge {
          position: absolute;
          bottom: 0;
          right: 0;
          background: #f59e0b;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
        }

        .super-badge i {
          font-size: 12px;
        }

        .profile-info {
          flex: 1;
        }

        .profile-info h2 {
          margin: 0 0 4px 0;
          font-size: 24px;
        }

        .profile-info p {
          margin: 0 0 12px 0;
          opacity: 0.9;
        }

        .profile-meta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .role-badge, .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 500;
        }

        .badge-super { background: rgba(255, 255, 255, 0.2); color: white; }
        .badge-content { background: rgba(255, 255, 255, 0.2); color: white; }
        .badge-security { background: rgba(255, 255, 255, 0.2); color: white; }
        .badge-support { background: rgba(255, 255, 255, 0.2); color: white; }
        .badge-default { background: rgba(255, 255, 255, 0.2); color: white; }

        .status-badge {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          animation: pulse 2s infinite;
        }

        .status-badge.inactive .status-dot {
          background: #ef4444;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Profile Stats */
        .profile-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          padding: 24px 28px;
          border-bottom: 1px solid #e9ecef;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .stat-item i {
          font-size: 28px;
          color: #667eea;
        }

        .stat-item div {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 12px;
          color: #6c757d;
        }

        .stat-item strong {
          font-size: 16px;
          color: #1f2937;
        }

        /* Profile Contact */
        .profile-contact, .profile-bio {
          padding: 20px 28px;
          border-bottom: 1px solid #e9ecef;
        }

        .profile-contact h4, .profile-bio h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #1f2937;
        }

        .contact-item {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
        }

        .contact-item i {
          font-size: 20px;
          color: #667eea;
          margin-top: 2px;
        }

        .contact-item span {
          font-size: 12px;
          color: #6c757d;
          display: block;
        }

        .contact-item p {
          margin: 0;
          font-weight: 500;
          color: #1f2937;
        }

        .profile-bio p {
          margin: 0;
          color: #4b5563;
          line-height: 1.6;
        }

        /* Actions Sidebar */
        .actions-sidebar {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .action-card, .info-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .action-card h4, .info-card h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #1f2937;
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border: none;
          border-radius: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .edit-btn {
          background: #4f46e5;
          color: white;
        }

        .edit-btn:hover {
          background: #4338ca;
          transform: translateY(-1px);
        }

        .deactivate-btn {
          background: #f59e0b;
          color: white;
        }

        .deactivate-btn:hover {
          background: #d97706;
          transform: translateY(-1px);
        }

        .activate-btn {
          background: #10b981;
          color: white;
        }

        .activate-btn:hover {
          background: #059669;
          transform: translateY(-1px);
        }

        .delete-btn {
          background: #ef4444;
          color: white;
        }

        .delete-btn:hover {
          background: #dc2626;
          transform: translateY(-1px);
        }

        .self-warning {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: #fef3c7;
          border-radius: 12px;
          color: #92400e;
          font-size: 13px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 13px;
        }

        .info-item span:first-child {
          color: #6c757d;
        }

        .info-item code {
          background: #f8f9fa;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
        }

        .text-success { color: #10b981; }
        .text-muted { color: #6c757d; }

        /* Activity Container */
        .activity-container {
          background: white;
          border-radius: 24px;
          padding: 28px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .activity-header {
          margin-bottom: 24px;
        }

        .activity-header h3 {
          margin: 0 0 4px 0;
          font-size: 18px;
          color: #1f2937;
        }

        .activity-header p {
          margin: 0;
          color: #6c757d;
          font-size: 14px;
        }

        .activity-timeline {
          max-height: 500px;
          overflow-y: auto;
        }

        .timeline-item {
          display: flex;
          gap: 16px;
          padding: 16px 0;
          border-bottom: 1px solid #e9ecef;
        }

        .timeline-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .bg-success { background: #10b981; }
        .bg-warning { background: #f59e0b; }
        .bg-primary { background: #4f46e5; }
        .bg-info { background: #0dcaf0; }
        .bg-danger { background: #ef4444; }
        .bg-secondary { background: #6c757d; }

        .timeline-content {
          flex: 1;
        }

        .timeline-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .timeline-type {
          font-weight: 600;
          font-size: 14px;
          color: #1f2937;
        }

        .timeline-date {
          font-size: 12px;
          color: #6c757d;
        }

        .timeline-description {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: #4b5563;
        }

        .timeline-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #9ca3af;
        }

        .empty-activities {
          text-align: center;
          padding: 60px 20px;
          color: #9ca3af;
        }

        .empty-activities i {
          font-size: 48px;
          margin-bottom: 12px;
          display: block;
        }

        /* Permissions Container */
        .permissions-container {
          background: white;
          border-radius: 24px;
          padding: 28px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .permissions-card h3 {
          margin: 0 0 4px 0;
          font-size: 18px;
          color: #1f2937;
        }

        .permissions-card > p {
          margin: 0 0 24px 0;
          color: #6c757d;
          font-size: 14px;
        }

        .permissions-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .permission-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 16px;
        }

        .permission-info {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .permission-info i {
          font-size: 24px;
          color: #4f46e5;
        }

        .permission-info div {
          display: flex;
          flex-direction: column;
        }

        .permission-info strong {
          font-size: 14px;
          margin-bottom: 2px;
        }

        .permission-info span {
          font-size: 12px;
          color: #6c757d;
        }

        .permission-status {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .permission-status.enabled {
          background: #d1fae5;
          color: #065f46;
        }

        .permission-status.disabled {
          background: #fee2e2;
          color: #991b1b;
        }

        /* Modals */
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
          max-width: 450px;
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

        .modal-header.warning .modal-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
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
          padding: 0 24px 24px;
        }

        .modal-body p {
          margin: 0 0 16px;
          line-height: 1.5;
          color: #4b5563;
        }

        .user-highlight {
          font-weight: 600;
          color: #1f2937;
          display: inline-block;
          margin-top: 4px;
        }

        .warning-message {
          background: #fff3cd;
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #856404;
        }

        .warning-message.danger {
          background: #f8d7da;
          color: #721c24;
        }

        .modal-footer {
          padding: 16px 24px 24px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
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
        .btn-primary.success { background: #10b981; color: white; }

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
        @media (max-width: 768px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .profile-header {
            flex-direction: column;
            text-align: center;
          }

          .profile-meta {
            justify-content: center;
          }

          .profile-stats {
            grid-template-columns: 1fr;
          }

          .tabs-container {
            flex-wrap: wrap;
          }

          .tab-btn {
            flex: auto;
          }
        }
      `}</style>
    </AdminLayout>
  )
}