import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function Profile() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState('')
  const [activeTab, setActiveTab] = useState('profile')
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    profile_image: '',
    bio: '',
    location: '',
    timezone: 'Asia/Colombo',
    notification_preferences: {
      email_notifications: true,
      security_alerts: true,
      activity_summary: true
    }
  })

  useEffect(() => {
    const init = async () => {
      const storedSession = localStorage.getItem('adminSession')
      if (!storedSession) {
        router.push('/admin/login')
        return
      }
      const parsedSession = JSON.parse(storedSession)
      setSession(parsedSession)
      setUserRole(parsedSession.role || 'SUPER_ADMIN')
      await fetchProfile(parsedSession)
    }
    init()
  }, [router])

  const fetchProfile = async (sessionData) => {
    try {
      const adminEmail = sessionData.admin?.email || sessionData.user?.email
      
      if (!adminEmail) {
        setLoading(false)
        return
      }

      const { data: dbAdmin, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', adminEmail)
        .maybeSingle()

      if (dbAdmin) {
        setProfile(dbAdmin)
        setFormData({
          full_name: dbAdmin.full_name || '',
          email: dbAdmin.email || '',
          phone_number: dbAdmin.phone_number || '',
          profile_image: dbAdmin.profile_image || '',
          bio: dbAdmin.bio || '',
          location: dbAdmin.location || '',
          timezone: dbAdmin.timezone || 'Asia/Colombo',
          notification_preferences: dbAdmin.notification_preferences || {
            email_notifications: true,
            security_alerts: true,
            activity_summary: true
          }
        })
        
        const updatedSession = { 
          ...sessionData, 
          admin: { 
            ...sessionData.admin, 
            admin_id: dbAdmin.admin_id,
            full_name: dbAdmin.full_name
          } 
        }
        localStorage.setItem('adminSession', JSON.stringify(updatedSession))
        setSession(updatedSession)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      const adminEmail = session?.admin?.email || profile?.email
      
      if (!adminEmail) {
        throw new Error('Email not found')
      }

      const updateData = {
        full_name: formData.full_name,
        phone_number: formData.phone_number || null,
        bio: formData.bio || null,
        location: formData.location || null,
        timezone: formData.timezone,
        notification_preferences: formData.notification_preferences,
        updated_at: new Date().toISOString()
      }

      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key]
      })

      const { error } = await supabase
        .from('admin_users')
        .update(updateData)
        .eq('email', adminEmail)

      if (error) throw error

      setProfile(prev => ({ ...prev, ...updateData }))
      
      const updatedSession = JSON.parse(localStorage.getItem('adminSession'))
      if (updatedSession) {
        updatedSession.admin = { ...updatedSession.admin, ...updateData }
        localStorage.setItem('adminSession', JSON.stringify(updatedSession))
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      setEditing(false)
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      
    } catch (err) {
      setMessage({ type: 'danger', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      full_name: profile?.full_name || '',
      email: profile?.email || '',
      phone_number: profile?.phone_number || '',
      profile_image: profile?.profile_image || '',
      bio: profile?.bio || '',
      location: profile?.location || '',
      timezone: profile?.timezone || 'Asia/Colombo',
      notification_preferences: profile?.notification_preferences || {
        email_notifications: true,
        security_alerts: true,
        activity_summary: true
      }
    })
    setEditing(false)
    setMessage({ type: '', text: '' })
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'danger', text: 'Image size must be less than 2MB' })
      return
    }

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'danger', text: 'Please upload an image file' })
      return
    }

    setSaving(true)

    try {
      const adminEmail = session?.admin?.email || profile?.email
      const fileExt = file.name.split('.').pop()
      const fileName = `${adminEmail.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.${fileExt}`
      const filePath = `profile-images/${fileName}`

      const { data: buckets } = await supabase.storage.listBuckets()
      const bucketExists = buckets?.some(b => b.name === 'admin-profiles')
      
      if (!bucketExists) {
        await supabase.storage.createBucket('admin-profiles', { public: true })
      }

      const { error: uploadError } = await supabase.storage
        .from('admin-profiles')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('admin-profiles')
        .getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('admin_users')
        .update({ profile_image: publicUrl })
        .eq('email', adminEmail)

      if (updateError) throw updateError

      setFormData(prev => ({ ...prev, profile_image: publicUrl }))
      setMessage({ type: 'success', text: 'Profile image updated!' })
      
    } catch (err) {
      setMessage({ type: 'danger', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout title="My Profile">
        <div className="d-flex justify-content-center align-items-center min-vh-50">
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}></div>
            <p className="text-muted">Loading profile...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="My Profile">
      {/* Toast Message */}
      {message.text && (
        <div className={`toast-container position-fixed top-0 end-0 p-3`} style={{ zIndex: 1050 }}>
          <div className={`toast show align-items-center text-white bg-${message.type === 'success' ? 'success' : 'danger'} border-0`} role="alert">
            <div className="d-flex">
              <div className="toast-body">
                <i className={`bi bi-${message.type === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill'} me-2`}></i>
                {message.text}
              </div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setMessage({ type: '', text: '' })}></button>
            </div>
          </div>
        </div>
      )}

      <div className="row g-4">
        {/* Left Column - Profile Card */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="bg-gradient-primary p-4 text-center">
              <div className="position-relative d-inline-block">
                <div className="bg-white rounded-circle d-flex align-items-center justify-content-center mx-auto shadow-lg" style={{ width: '130px', height: '130px' }}>
                  {formData.profile_image ? (
                    <img src={formData.profile_image} alt="Profile" className="rounded-circle w-100 h-100 object-fit-cover" />
                  ) : (
                    <span className="text-primary fw-bold fs-1">{formData.full_name?.charAt(0) || 'A'}</span>
                  )}
                </div>
                {!editing && (
                  <label className="position-absolute bottom-0 end-0 bg-white rounded-circle p-2 shadow cursor-pointer" style={{ cursor: 'pointer' }}>
                    <i className="bi bi-camera-fill text-primary"></i>
                    <input type="file" className="d-none" accept="image/*" onChange={handleImageUpload} disabled={saving} />
                  </label>
                )}
              </div>
              <h4 className="text-white mt-3 mb-1">{formData.full_name || 'Admin User'}</h4>
              <p className="text-white-50 mb-2">{formData.email}</p>
              <div className="d-flex justify-content-center gap-2">
                <span className="badge bg-white text-primary px-3 py-1 rounded-pill">{userRole}</span>
                <span className="badge bg-success px-3 py-1 rounded-pill">Active</span>
              </div>
            </div>
            <div className="card-body p-4">
              <div className="d-flex justify-content-around text-center mb-3">
                <div>
                  <h6 className="mb-0 text-primary">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</h6>
                  <small className="text-muted">Joined</small>
                </div>
                <div className="vr"></div>
                <div>
                  <h6 className="mb-0 text-primary">{profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString() : 'Never'}</h6>
                  <small className="text-muted">Last Updated</small>
                </div>
              </div>
              <hr />
              <div className="d-flex justify-content-around">
                <div className="text-center">
                  <i className="bi bi-envelope fs-4 text-primary"></i>
                  <p className="small text-muted mb-0">Email</p>
                </div>
                <div className="text-center">
                  <i className="bi bi-shield-check fs-4 text-success"></i>
                  <p className="small text-muted mb-0">Verified</p>
                </div>
                <div className="text-center">
                  <i className="bi bi-clock fs-4 text-info"></i>
                  <p className="small text-muted mb-0">UTC+5:30</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Tabs Content */}
        <div className="col-lg-8">
          {/* Tabs Navigation */}
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-white border-0 pt-4 px-4">
              <ul className="nav nav-tabs card-header-tabs" style={{ borderBottom: 'none' }}>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'profile' ? 'active text-primary fw-semibold' : 'text-muted'} border-0 px-4`}
                    onClick={() => setActiveTab('profile')}
                    style={{ background: activeTab === 'profile' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent', color: activeTab === 'profile' ? 'white' : '#6c757d' }}
                  >
                    <i className="bi bi-person me-2"></i>Profile
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'notifications' ? 'active text-primary fw-semibold' : 'text-muted'} border-0 px-4`}
                    onClick={() => setActiveTab('notifications')}
                    style={{ background: activeTab === 'notifications' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent', color: activeTab === 'notifications' ? 'white' : '#6c757d' }}
                  >
                    <i className="bi bi-bell me-2"></i>Notifications
                  </button>
                </li>
                <li className="nav-item ms-auto">
                  {!editing ? (
                    <button className="btn btn-primary btn-sm rounded-pill px-4" onClick={() => setEditing(true)}>
                      <i className="bi bi-pencil me-2"></i>Edit Profile
                    </button>
                  ) : (
                    <div className="d-flex gap-2">
                      <button className="btn btn-secondary btn-sm rounded-pill px-4" onClick={handleCancel}>
                        <i className="bi bi-x-circle me-2"></i>Cancel
                      </button>
                      <button className="btn btn-success btn-sm rounded-pill px-4" onClick={handleSave} disabled={saving}>
                        {saving ? (
                          <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                        ) : (
                          <><i className="bi bi-save me-2"></i>Save Changes</>
                        )}
                      </button>
                    </div>
                  )}
                </li>
              </ul>
            </div>
            <div className="card-body p-4">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="row g-4">
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input
                        type="text"
                        className="form-control"
                        id="fullName"
                        placeholder="Full Name"
                        value={formData.full_name}
                        onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                        disabled={!editing}
                      />
                      <label htmlFor="fullName"><i className="bi bi-person me-2"></i>Full Name</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input
                        type="email"
                        className="form-control bg-light"
                        id="email"
                        placeholder="Email"
                        value={formData.email}
                        disabled
                      />
                      <label htmlFor="email"><i className="bi bi-envelope me-2"></i>Email Address</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input
                        type="tel"
                        className="form-control"
                        id="phone"
                        placeholder="Phone Number"
                        value={formData.phone_number || ''}
                        onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                        disabled={!editing}
                      />
                      <label htmlFor="phone"><i className="bi bi-telephone me-2"></i>Phone Number</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating mb-3">
                      <input
                        type="text"
                        className="form-control"
                        id="location"
                        placeholder="Location"
                        value={formData.location || ''}
                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                        disabled={!editing}
                      />
                      <label htmlFor="location"><i className="bi bi-geo-alt me-2"></i>Location</label>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="form-floating mb-3">
                      <select
                        className="form-select"
                        id="timezone"
                        value={formData.timezone}
                        onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                        disabled={!editing}
                      >
                        <option value="Asia/Colombo">Asia/Colombo (Sri Lanka)</option>
                        <option value="Asia/Kolkata">Asia/Kolkata (India)</option>
                        <option value="Asia/Dubai">Asia/Dubai (UAE)</option>
                        <option value="America/New_York">America/New York (EST)</option>
                        <option value="Europe/London">Europe/London (GMT)</option>
                      </select>
                      <label htmlFor="timezone"><i className="bi bi-clock me-2"></i>Timezone</label>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="form-floating mb-3">
                      <textarea
                        className="form-control"
                        id="bio"
                        placeholder="Bio"
                        style={{ height: '120px' }}
                        value={formData.bio || ''}
                        onChange={(e) => setFormData({...formData, bio: e.target.value})}
                        disabled={!editing}
                      />
                      <label htmlFor="bio"><i className="bi bi-file-text me-2"></i>Bio</label>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="vstack gap-4">
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="email_notifications"
                      style={{ width: '3rem', height: '1.5rem', cursor: 'pointer' }}
                      checked={formData.notification_preferences?.email_notifications}
                      onChange={(e) => setFormData({
                        ...formData, 
                        notification_preferences: {
                          ...formData.notification_preferences,
                          email_notifications: e.target.checked
                        }
                      })}
                      disabled={!editing}
                    />
                    <label className="form-check-label fw-semibold ms-3" htmlFor="email_notifications">
                      <i className="bi bi-envelope-fill text-primary me-2"></i>
                      Email Notifications
                    </label>
                    <p className="text-muted small mt-1 ms-5">Receive system notifications and updates via email</p>
                  </div>

                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="security_alerts"
                      style={{ width: '3rem', height: '1.5rem', cursor: 'pointer' }}
                      checked={formData.notification_preferences?.security_alerts}
                      onChange={(e) => setFormData({
                        ...formData, 
                        notification_preferences: {
                          ...formData.notification_preferences,
                          security_alerts: e.target.checked
                        }
                      })}
                      disabled={!editing}
                    />
                    <label className="form-check-label fw-semibold ms-3" htmlFor="security_alerts">
                      <i className="bi bi-shield-exclamation text-warning me-2"></i>
                      Security Alerts
                    </label>
                    <p className="text-muted small mt-1 ms-5">Get notified about suspicious activities and login attempts</p>
                  </div>

                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="activity_summary"
                      style={{ width: '3rem', height: '1.5rem', cursor: 'pointer' }}
                      checked={formData.notification_preferences?.activity_summary}
                      onChange={(e) => setFormData({
                        ...formData, 
                        notification_preferences: {
                          ...formData.notification_preferences,
                          activity_summary: e.target.checked
                        }
                      })}
                      disabled={!editing}
                    />
                    <label className="form-check-label fw-semibold ms-3" htmlFor="activity_summary">
                      <i className="bi bi-bar-chart-steps text-info me-2"></i>
                      Activity Summary
                    </label>
                    <p className="text-muted small mt-1 ms-5">Receive weekly summary of platform activities and statistics</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .bg-gradient-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .object-fit-cover {
          object-fit: cover;
        }
        .nav-tabs .nav-link {
          border: none;
          transition: all 0.3s ease;
          border-radius: 10px;
          padding: 10px 20px;
        }
        .nav-tabs .nav-link:hover:not(.active) {
          background-color: #f8f9fa;
          color: #667eea !important;
        }
        .nav-tabs .nav-link.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white !important;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        .form-floating > .form-control:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 0.2rem rgba(102, 126, 234, 0.25);
        }
        .form-check-input:checked {
          background-color: #667eea;
          border-color: #667eea;
        }
        .toast {
          animation: slideInRight 0.3s ease-out;
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </AdminLayout>
  )
}