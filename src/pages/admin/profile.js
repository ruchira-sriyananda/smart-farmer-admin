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
        
        // Update session
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
      } else {
        setMessage({ type: 'warning', text: 'Profile not found' })
      }
    } catch (err) {
      console.error('Error:', err)
      setMessage({ type: 'danger', text: 'Error loading profile' })
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

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key]
      })

      // DIRECT UPDATE - NO LOGGING
      const { error } = await supabase
        .from('admin_users')
        .update(updateData)
        .eq('email', adminEmail)

      if (error) throw error

      // Update local state
      setProfile(prev => ({ ...prev, ...updateData }))
      
      // Update session
      const updatedSession = JSON.parse(localStorage.getItem('adminSession'))
      if (updatedSession) {
        updatedSession.admin = { ...updatedSession.admin, ...updateData }
        localStorage.setItem('adminSession', JSON.stringify(updatedSession))
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      setEditing(false)
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
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="My Profile">
      {message.text && (
        <div className={`alert alert-${message.type} alert-dismissible fade show mb-4`} role="alert">
          <i className={`bi bi-${message.type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2`}></i>
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })}></button>
        </div>
      )}

      <div className="row g-4">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body text-center p-4">
              <div className="position-relative d-inline-block mb-3">
                <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center mx-auto" style={{ width: '120px', height: '120px' }}>
                  {formData.profile_image ? (
                    <img src={formData.profile_image} alt="Profile" className="rounded-circle w-100 h-100" />
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

              <h4 className="mb-1">{formData.full_name}</h4>
              <p className="text-muted mb-3">{formData.email}</p>
              
              <div className="border rounded-3 p-3">
                <div className="row">
                  <div className="col-6">
                    <small className="text-muted">Role</small>
                    <div className="fw-bold">{userRole}</div>
                  </div>
                  <div className="col-6">
                    <small className="text-muted">Status</small>
                    <div><span className="badge bg-success">Active</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-white border-0 pt-4">
              <div className="d-flex justify-content-between">
                <h5 className="mb-0 fw-bold">Profile Information</h5>
                {!editing ? (
                  <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
                    <i className="bi bi-pencil me-2"></i>Edit
                  </button>
                ) : (
                  <div className="d-flex gap-2">
                    <button className="btn btn-secondary btn-sm" onClick={handleCancel}>Cancel</button>
                    <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">Full Name</label>
                {editing ? (
                  <input type="text" className="form-control" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} />
                ) : (
                  <div className="border rounded p-2 bg-light">{profile?.full_name || 'Not set'}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Email</label>
                <div className="border rounded p-2 bg-light">{profile?.email}</div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Phone</label>
                {editing ? (
                  <input type="tel" className="form-control" value={formData.phone_number || ''} onChange={(e) => setFormData({...formData, phone_number: e.target.value})} />
                ) : (
                  <div className="border rounded p-2 bg-light">{profile?.phone_number || 'Not provided'}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Location</label>
                {editing ? (
                  <input type="text" className="form-control" value={formData.location || ''} onChange={(e) => setFormData({...formData, location: e.target.value})} />
                ) : (
                  <div className="border rounded p-2 bg-light">{profile?.location || 'Not provided'}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Bio</label>
                {editing ? (
                  <textarea className="form-control" rows="3" value={formData.bio || ''} onChange={(e) => setFormData({...formData, bio: e.target.value})} />
                ) : (
                  <div className="border rounded p-2 bg-light">{profile?.bio || 'No bio'}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}