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
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    profile_image: '',
    bio: '',
    location: '',
    timezone: 'Asia/Colombo'
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
      await fetchProfile(parsedSession)
      
      // Subscribe to real-time profile updates
      subscribeToProfileUpdates(parsedSession)
    }
    
    init()
    
    return () => {
      supabase.removeAllChannels()
    }
  }, [router])

  const subscribeToProfileUpdates = (sessionData) => {
    const adminId = sessionData.admin?.admin_id
    
    if (adminId) {
      const subscription = supabase
        .channel(`admin_user_${adminId}`)
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'admin_users',
            filter: `admin_id=eq.${adminId}`
          }, 
          (payload) => {
            // Update profile in real-time when database changes
            setProfile(payload.new)
            setFormData({
              full_name: payload.new.full_name || '',
              email: payload.new.email || '',
              phone_number: payload.new.phone_number || '',
              profile_image: payload.new.profile_image || '',
              bio: payload.new.bio || '',
              location: payload.new.location || '',
              timezone: payload.new.timezone || 'Asia/Colombo'
            })
            
            // Update session storage
            const updatedSession = JSON.parse(localStorage.getItem('adminSession'))
            if (updatedSession) {
              updatedSession.admin = payload.new
              localStorage.setItem('adminSession', JSON.stringify(updatedSession))
            }
            
            setMessage({ type: 'success', text: 'Profile updated in real-time!' })
            setTimeout(() => setMessage({ type: '', text: '' }), 3000)
          }
        )
        .subscribe()
        
      return () => subscription.unsubscribe()
    }
  }

  const fetchProfile = async (sessionData) => {
    try {
      const adminId = sessionData.admin?.admin_id
      
      if (adminId) {
        // Get data from admin_users table
        const { data, error } = await supabase
          .from('admin_users')
          .select('*')
          .eq('admin_id', adminId)
          .single()

        if (!error && data) {
          setProfile(data)
          setFormData({
            full_name: data.full_name || '',
            email: data.email || '',
            phone_number: data.phone_number || '',
            profile_image: data.profile_image || '',
            bio: data.bio || '',
            location: data.location || '',
            timezone: data.timezone || 'Asia/Colombo'
          })
        } else {
          // Fallback to session data
          setProfile(sessionData.admin)
          setFormData({
            full_name: sessionData.admin?.full_name || '',
            email: sessionData.admin?.email || '',
            phone_number: '',
            profile_image: '',
            bio: '',
            location: '',
            timezone: 'Asia/Colombo'
          })
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
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
      const authUserId = session?.user?.id
      
      if (!adminId) {
        throw new Error('Admin ID not found')
      }

      // Step 1: Update admin_users table
      const updateData = {
        full_name: formData.full_name,
        phone_number: formData.phone_number,
        bio: formData.bio,
        location: formData.location,
        timezone: formData.timezone,
        updated_at: new Date().toISOString()
      }

      const { error: adminError } = await supabase
        .from('admin_users')
        .update(updateData)
        .eq('admin_id', adminId)

      if (adminError) throw adminError

      // Step 2: Update Supabase Auth user metadata (this is the key fix!)
      if (authUserId) {
        const { error: authError } = await supabase.auth.updateUser({
          data: {
            full_name: formData.full_name,
            display_name: formData.full_name,
            updated_at: new Date().toISOString()
          }
        })

        if (authError) {
          console.error('Auth update error:', authError)
          // Don't throw here - admin_users was already updated
          setMessage({ type: 'warning', text: 'Profile saved but display name may need re-login to update everywhere.' })
        } else {
          setMessage({ type: 'success', text: 'Profile updated successfully! Name synchronized across system.' })
        }
      } else {
        setMessage({ type: 'success', text: 'Profile updated successfully!' })
      }

      // Step 3: Log the activity
      await logActivity(`Profile updated by ${formData.full_name}`)

      // Step 4: Update local state
      setProfile(prev => ({ ...prev, ...updateData }))
      
      // Step 5: Update session storage with new data
      const updatedSession = JSON.parse(localStorage.getItem('adminSession'))
      if (updatedSession) {
        updatedSession.admin = { ...updatedSession.admin, ...updateData }
        updatedSession.user = { 
          ...updatedSession.user, 
          user_metadata: { 
            ...updatedSession.user?.user_metadata, 
            full_name: formData.full_name,
            display_name: formData.full_name
          }
        }
        localStorage.setItem('adminSession', JSON.stringify(updatedSession))
        setSession(updatedSession)
      }

      setEditing(false)
      
      // Auto-hide message after 3 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      
    } catch (err) {
      setMessage({ type: 'danger', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset form data to original profile values
    setFormData({
      full_name: profile?.full_name || '',
      email: profile?.email || '',
      phone_number: profile?.phone_number || '',
      profile_image: profile?.profile_image || '',
      bio: profile?.bio || '',
      location: profile?.location || '',
      timezone: profile?.timezone || 'Asia/Colombo'
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
      {/* Success/Error Message */}
      {message.text && (
        <div className={`alert alert-${message.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
          <i className={`bi bi-${message.type === 'success' ? 'check-circle' : message.type === 'warning' ? 'exclamation-triangle' : 'exclamation-triangle'} me-2`}></i>
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })}></button>
        </div>
      )}

      <div className="row g-4">
        {/* Profile Card - Left Column */}
        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body text-center p-4">
              {/* Profile Image */}
              <div className="position-relative d-inline-block mb-3">
                <div className="bg-gradient-primary rounded-circle d-flex align-items-center justify-content-center mx-auto" style={{ width: '120px', height: '120px' }}>
                  {formData.profile_image ? (
                    <img 
                      src={formData.profile_image} 
                      alt="Profile" 
                      className="rounded-circle w-100 h-100 object-fit-cover"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <span className="text-white fw-bold fs-1">
                      {formData.full_name?.charAt(0) || 'A'}
                    </span>
                  )}
                </div>
                {!editing && (
                  <label className="position-absolute bottom-0 end-0 bg-primary rounded-circle p-2 shadow cursor-pointer" style={{ cursor: 'pointer' }}>
                    <i className="bi bi-camera-fill text-white"></i>
                    <input 
                      type="file" 
                      className="d-none" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={saving}
                    />
                  </label>
                )}
              </div>

              <h4 className="mb-1 fw-bold">{profile?.full_name}</h4>
              <p className="text-muted mb-3">{profile?.email}</p>
              
              <div className="border rounded-3 p-3 mb-3">
                <div className="row">
                  <div className="col-6">
                    <small className="text-muted d-block">Role</small>
                    <strong>{session?.role || 'Admin'}</strong>
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
                  Last Login: {profile?.last_login ? new Date(profile.last_login).toLocaleString() : 'Never'}
                </div>
                <div>
                  <i className="bi bi-arrow-repeat me-2"></i>
                  Real-time Sync: Active
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details - Right Column */}
        <div className="col-md-8">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-white border-0 pt-4 pb-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-person-badge me-2 text-primary"></i>
                    Profile Information
                  </h5>
                  <small className="text-muted">Your personal information and preferences</small>
                </div>
                {!editing ? (
                  <button className="btn btn-primary btn-sm rounded-pill px-4" onClick={() => setEditing(true)}>
                    <i className="bi bi-pencil me-2"></i>Edit Profile
                  </button>
                ) : (
                  <div className="d-flex gap-2">
                    <button className="btn btn-secondary btn-sm rounded-pill px-4" onClick={handleCancel}>
                      Cancel
                    </button>
                    <button className="btn btn-success btn-sm rounded-pill px-4" onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-save me-2"></i>Save Changes
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="card-body">
              <div className="row g-4">
                {/* Full Name */}
                <div className="col-md-12">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-person me-1"></i>Full Name
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                      placeholder="Enter your full name"
                    />
                  ) : (
                    <div className="border rounded p-3 bg-light">{profile?.full_name || 'Not set'}</div>
                  )}
                  <small className="text-muted">This name will appear across the entire system</small>
                </div>

                {/* Email Address */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-envelope me-1"></i>Email Address
                  </label>
                  <div className="border rounded p-2 bg-light text-muted">
                    {profile?.email}
                    <small className="d-block text-muted">Email cannot be changed</small>
                  </div>
                </div>

                {/* Phone Number */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-telephone me-1"></i>Phone Number
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      className="form-control"
                      value={formData.phone_number || ''}
                      onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                      placeholder="+94 XX XXX XXXX"
                    />
                  ) : (
                    <div className="border rounded p-2 bg-light">{profile?.phone_number || 'Not provided'}</div>
                  )}
                </div>

                {/* Location */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-geo-alt me-1"></i>Location
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      className="form-control"
                      value={formData.location || ''}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      placeholder="City, Country"
                    />
                  ) : (
                    <div className="border rounded p-2 bg-light">{profile?.location || 'Not provided'}</div>
                  )}
                </div>

                {/* Timezone */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-clock me-1"></i>Timezone
                  </label>
                  {editing ? (
                    <select 
                      className="form-select"
                      value={formData.timezone}
                      onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                    >
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

                {/* Bio */}
                <div className="col-12">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-file-text me-1"></i>Bio
                  </label>
                  {editing ? (
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.bio || ''}
                      onChange={(e) => setFormData({...formData, bio: e.target.value})}
                      placeholder="Tell us about yourself..."
                    />
                  ) : (
                    <div className="border rounded p-2 bg-light" style={{ minHeight: '80px' }}>
                      {profile?.bio || 'No bio provided'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Info Alert */}
          <div className="alert alert-info mt-4">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Note:</strong> After updating your name, you may need to refresh the page to see the changes everywhere in the system. The name is synchronized across both the database and your authentication profile.
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
      `}</style>
    </AdminLayout>
  )
}