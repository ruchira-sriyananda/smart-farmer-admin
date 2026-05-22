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
  const [debugInfo, setDebugInfo] = useState(null)
  
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
      const adminId = sessionData.admin?.admin_id
      
      if (!adminId) {
        console.error('No admin_id found in session')
        setLoading(false)
        return
      }

      console.log('Fetching profile for admin_id:', adminId)

      // First, check if record exists
      const { data: existingData, error: checkError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('admin_id', adminId)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking profile:', checkError)
      }

      if (!existingData) {
        console.log('No profile found, creating one...')
        // Create profile if it doesn't exist
        const { data: newProfile, error: insertError } = await supabase
          .from('admin_users')
          .insert({
            admin_id: adminId,
            full_name: sessionData.admin?.full_name || 'Admin User',
            email: sessionData.admin?.email || sessionData.user?.email,
            password_hash: 'managed_by_auth',
            role_id: sessionData.admin?.role_id || null,
            is_active: true,
            is_super_admin: sessionData.admin?.is_super_admin || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) {
          console.error('Error creating profile:', insertError)
          setDebugInfo({ error: insertError })
        } else if (newProfile) {
          setProfile(newProfile)
          setFormData({
            full_name: newProfile.full_name || '',
            email: newProfile.email || '',
            phone_number: newProfile.phone_number || '',
            profile_image: newProfile.profile_image || '',
            bio: newProfile.bio || '',
            location: newProfile.location || '',
            timezone: newProfile.timezone || 'Asia/Colombo',
            notification_preferences: newProfile.notification_preferences || {
              email_notifications: true,
              security_alerts: true,
              activity_summary: true
            }
          })
        }
      } else {
        console.log('Profile found:', existingData)
        setProfile(existingData)
        setFormData({
          full_name: existingData.full_name || '',
          email: existingData.email || '',
          phone_number: existingData.phone_number || '',
          profile_image: existingData.profile_image || '',
          bio: existingData.bio || '',
          location: existingData.location || '',
          timezone: existingData.timezone || 'Asia/Colombo',
          notification_preferences: existingData.notification_preferences || {
            email_notifications: true,
            security_alerts: true,
            activity_summary: true
          }
        })
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err)
      setDebugInfo({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  const getClientIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch {
      return 'unknown'
    }
  }

  const logActivity = async (description) => {
    const adminId = session?.admin?.admin_id
    if (adminId) {
      await supabase
        .from('admin_activity_logs')
        .insert({
          admin_id: adminId,
          activity_type: 'PROFILE_UPDATE',
          activity_description: description,
          ip_address: await getClientIP(),
          created_at: new Date().toISOString()
        })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      const adminId = session?.admin?.admin_id
      
      if (!adminId) {
        throw new Error('Admin ID not found. Please logout and login again.')
      }

      console.log('Updating profile for admin_id:', adminId)
      console.log('Update data:', formData)

      // Prepare update data - only include columns that exist
      const updateData = {
        full_name: formData.full_name,
        phone_number: formData.phone_number || null,
        bio: formData.bio || null,
        location: formData.location || null,
        timezone: formData.timezone,
        notification_preferences: formData.notification_preferences,
        updated_at: new Date().toISOString()
      }

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key]
        }
      })

      // Update profile in database
      const { data, error } = await supabase
        .from('admin_users')
        .update(updateData)
        .eq('admin_id', adminId)
        .select()

      if (error) {
        console.error('Supabase update error:', error)
        throw new Error(`Database error: ${error.message}`)
      }

      console.log('Update response:', data)

      // Log the activity
      await logActivity(`Profile updated by ${formData.full_name}`)

      // Update local state
      setProfile(prev => ({ ...prev, ...updateData }))
      
      // Update session storage
      const updatedSession = JSON.parse(localStorage.getItem('adminSession'))
      if (updatedSession) {
        updatedSession.admin = { ...updatedSession.admin, ...updateData }
        localStorage.setItem('adminSession', JSON.stringify(updatedSession))
      }

      setMessage({ type: 'success', text: 'Profile updated successfully in database!' })
      setEditing(false)
      
      // Refresh profile data
      await fetchProfile(session)
      
      // Auto-hide message after 3 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      
    } catch (err) {
      console.error('Save error:', err)
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
      const adminId = session?.admin?.admin_id
      const fileExt = file.name.split('.').pop()
      const fileName = `${adminId}-${Date.now()}.${fileExt}`
      const filePath = `profile-images/${fileName}`

      // Ensure bucket exists
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
        .eq('admin_id', adminId)

      if (updateError) throw updateError

      setFormData(prev => ({ ...prev, profile_image: publicUrl }))
      setMessage({ type: 'success', text: 'Profile image updated!' })
      await logActivity('Profile image updated')
      
    } catch (err) {
      console.error('Image upload error:', err)
      setMessage({ type: 'danger', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout title="My Profile">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }}></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="My Profile">
      {/* Debug Info (remove in production) */}
      {debugInfo && process.env.NODE_ENV !== 'production' && (
        <div className="alert alert-warning small mb-3">
          <strong>Debug:</strong> {JSON.stringify(debugInfo)}
        </div>
      )}

      {message.text && (
        <div className={`alert alert-${message.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
          <i className={`bi bi-${message.type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2`}></i>
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })}></button>
        </div>
      )}

      <div className="row g-4">
        {/* Profile Card */}
        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body text-center p-4">
              <div className="position-relative d-inline-block mb-3">
                <div className="bg-gradient-primary rounded-circle d-flex align-items-center justify-content-center mx-auto" style={{ width: '120px', height: '120px' }}>
                  {formData.profile_image ? (
                    <img src={formData.profile_image} alt="Profile" className="rounded-circle w-100 h-100 object-fit-cover" />
                  ) : (
                    <span className="text-white fw-bold fs-1">{formData.full_name?.charAt(0) || 'A'}</span>
                  )}
                </div>
                {!editing && (
                  <label className="position-absolute bottom-0 end-0 bg-primary rounded-circle p-2 shadow" style={{ cursor: 'pointer' }}>
                    <i className="bi bi-camera-fill text-white"></i>
                    <input type="file" className="d-none" accept="image/*" onChange={handleImageUpload} disabled={saving} />
                  </label>
                )}
              </div>

              <h4 className="mb-1 fw-bold">{profile?.full_name || formData.full_name}</h4>
              <p className="text-muted mb-3">{profile?.email || formData.email}</p>
              
              <div className="border rounded-3 p-3 mb-3">
                <div className="row">
                  <div className="col-6">
                    <small className="text-muted d-block">Role</small>
                    <strong className="text-primary">{userRole || 'SUPER_ADMIN'}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Status</small>
                    <span className="badge bg-success">Active</span>
                  </div>
                </div>
              </div>

              <div className="text-start small text-muted">
                <div className="mb-2">
                  <i className="bi bi-calendar3 me-2"></i>
                  Joined: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                </div>
                <div className="mb-2">
                  <i className="bi bi-clock-history me-2"></i>
                  Last Updated: {profile?.updated_at ? new Date(profile.updated_at).toLocaleString() : 'Never'}
                </div>
                <div>
                  <i className="bi bi-database me-2"></i>
                  Supabase Sync: Active
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="col-md-8">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-white border-0 pt-4 pb-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-person-badge me-2 text-primary"></i>
                    Profile Information
                  </h5>
                  <small className="text-muted">Data syncs directly with Supabase database</small>
                </div>
                {!editing ? (
                  <button className="btn btn-primary btn-sm rounded-pill px-4" onClick={() => setEditing(true)}>
                    <i className="bi bi-pencil me-2"></i>Edit Profile
                  </button>
                ) : (
                  <div className="d-flex gap-2">
                    <button className="btn btn-secondary btn-sm rounded-pill px-4" onClick={handleCancel}>Cancel</button>
                    <button className="btn btn-success btn-sm rounded-pill px-4" onClick={handleSave} disabled={saving}>
                      {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : <><i className="bi bi-save me-2"></i>Save Changes</>}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="card-body">
              <div className="row g-4">
                <div className="col-md-6">
                  <label className="form-label fw-semibold"><i className="bi bi-person me-1"></i>Full Name</label>
                  {editing ? (
                    <input type="text" className="form-control" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} />
                  ) : (
                    <div className="border rounded p-2 bg-light">{profile?.full_name || 'Not set'}</div>
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold"><i className="bi bi-envelope me-1"></i>Email Address</label>
                  <div className="border rounded p-2 bg-light text-muted">
                    {profile?.email || formData.email}
                    <small className="d-block text-muted">Cannot be changed</small>
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold"><i className="bi bi-telephone me-1"></i>Phone Number</label>
                  {editing ? (
                    <input type="tel" className="form-control" value={formData.phone_number || ''} onChange={(e) => setFormData({...formData, phone_number: e.target.value})} placeholder="+94 XX XXX XXXX" />
                  ) : (
                    <div className="border rounded p-2 bg-light">{profile?.phone_number || 'Not provided'}</div>
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold"><i className="bi bi-geo-alt me-1"></i>Location</label>
                  {editing ? (
                    <input type="text" className="form-control" value={formData.location || ''} onChange={(e) => setFormData({...formData, location: e.target.value})} placeholder="City, Country" />
                  ) : (
                    <div className="border rounded p-2 bg-light">{profile?.location || 'Not provided'}</div>
                  )}
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold"><i className="bi bi-file-text me-1"></i>Bio</label>
                  {editing ? (
                    <textarea className="form-control" rows="3" value={formData.bio || ''} onChange={(e) => setFormData({...formData, bio: e.target.value})} placeholder="Tell us about yourself..." />
                  ) : (
                    <div className="border rounded p-2 bg-light" style={{ minHeight: '80px' }}>{profile?.bio || 'No bio provided'}</div>
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold"><i className="bi bi-clock me-1"></i>Timezone</label>
                  {editing ? (
                    <select className="form-select" value={formData.timezone} onChange={(e) => setFormData({...formData, timezone: e.target.value})}>
                      <option value="Asia/Colombo">Asia/Colombo (Sri Lanka)</option>
                      <option value="Asia/Kolkata">Asia/Kolkata (India)</option>
                      <option value="Asia/Dubai">Asia/Dubai (UAE)</option>
                      <option value="America/New_York">America/New York (EST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                    </select>
                  ) : (
                    <div className="border rounded p-2 bg-light">{profile?.timezone || 'Asia/Colombo'}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="card border-0 shadow-sm rounded-4 mt-4">
            <div className="card-header bg-white border-0 pt-4 pb-3">
              <h5 className="mb-0 fw-bold"><i className="bi bi-bell me-2 text-primary"></i>Notification Preferences</h5>
            </div>
            <div className="card-body">
              <div className="vstack gap-3">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="email_notifications"
                    checked={formData.notification_preferences?.email_notifications}
                    onChange={(e) => setFormData({
                      ...formData, 
                      notification_preferences: {
                        ...formData.notification_preferences,
                        email_notifications: e.target.checked
                      }
                    })}
                    disabled={!editing} />
                  <label className="form-check-label fw-semibold" htmlFor="email_notifications">Email Notifications</label>
                  <div className="text-muted small">Receive system notifications via email</div>
                </div>

                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="security_alerts"
                    checked={formData.notification_preferences?.security_alerts}
                    onChange={(e) => setFormData({
                      ...formData, 
                      notification_preferences: {
                        ...formData.notification_preferences,
                        security_alerts: e.target.checked
                      }
                    })}
                    disabled={!editing} />
                  <label className="form-check-label fw-semibold" htmlFor="security_alerts">Security Alerts</label>
                  <div className="text-muted small">Get notified about security events</div>
                </div>

                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="activity_summary"
                    checked={formData.notification_preferences?.activity_summary}
                    onChange={(e) => setFormData({
                      ...formData, 
                      notification_preferences: {
                        ...formData.notification_preferences,
                        activity_summary: e.target.checked
                      }
                    })}
                    disabled={!editing} />
                  <label className="form-check-label fw-semibold" htmlFor="activity_summary">Activity Summary</label>
                  <div className="text-muted small">Receive weekly summary of platform activities</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .bg-gradient-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .object-fit-cover { object-fit: cover; }
      `}</style>
    </AdminLayout>
  )
}