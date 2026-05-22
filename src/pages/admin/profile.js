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
    }
    init()
  }, [router])

  const fetchProfile = async (sessionData) => {
    try {
      const adminEmail = sessionData.admin?.email || sessionData.user?.email
      
      if (!adminEmail) {
        console.error('No email found')
        setLoading(false)
        return
      }

      // Get profile by email
      let { data: existingData, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', adminEmail)
        .maybeSingle()

      if (error) {
        console.error('Error fetching profile:', error)
      }

      if (existingData) {
        setProfile(existingData)
        setFormData({
          full_name: existingData.full_name || '',
          email: existingData.email || '',
          phone_number: existingData.phone_number || '',
          bio: existingData.bio || '',
          location: existingData.location || '',
          timezone: existingData.timezone || 'Asia/Colombo'
        })
      } else {
        setMessage({ type: 'warning', text: 'Profile not found. Please contact support.' })
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err)
      setMessage({ type: 'danger', text: 'Error loading profile' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      const adminEmail = session?.admin?.email || session?.user?.email
      
      if (!adminEmail) {
        throw new Error('Email not found')
      }

      // Prepare update data
      const updateData = {
        full_name: formData.full_name,
        phone_number: formData.phone_number || null,
        bio: formData.bio || null,
        location: formData.location || null,
        timezone: formData.timezone,
        updated_at: new Date().toISOString()
      }

      // Update profile by email
      const { error } = await supabase
        .from('admin_users')
        .update(updateData)
        .eq('email', adminEmail)

      if (error) {
        console.error('Update error:', error)
        throw new Error(error.message)
      }

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
      bio: profile?.bio || '',
      location: profile?.location || '',
      timezone: profile?.timezone || 'Asia/Colombo'
    })
    setEditing(false)
    setMessage({ type: '', text: '' })
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
              <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: '100px', height: '100px' }}>
                <span className="text-white fw-bold fs-1">{formData.full_name?.charAt(0) || 'A'}</span>
              </div>
              <h4 className="mb-1">{formData.full_name}</h4>
              <p className="text-muted mb-3">{formData.email}</p>
              <div className="border rounded p-2">
                <small className="text-muted">Role</small>
                <div className="fw-bold">{session?.role || 'SUPER_ADMIN'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-white border-0 pt-4 pb-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-person-badge me-2 text-primary"></i>
                  Profile Information
                </h5>
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
              <div className="mb-3">
                <label className="form-label fw-semibold">Full Name</label>
                {editing ? (
                  <input type="text" className="form-control" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} />
                ) : (
                  <div className="border rounded p-2 bg-light">{profile?.full_name || 'Not set'}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Email Address</label>
                <div className="border rounded p-2 bg-light text-muted">
                  {profile?.email}
                  <small className="d-block text-muted">Cannot be changed</small>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Phone Number</label>
                {editing ? (
                  <input type="tel" className="form-control" value={formData.phone_number || ''} onChange={(e) => setFormData({...formData, phone_number: e.target.value})} placeholder="+94 XX XXX XXXX" />
                ) : (
                  <div className="border rounded p-2 bg-light">{profile?.phone_number || 'Not provided'}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Location</label>
                {editing ? (
                  <input type="text" className="form-control" value={formData.location || ''} onChange={(e) => setFormData({...formData, location: e.target.value})} placeholder="City, Country" />
                ) : (
                  <div className="border rounded p-2 bg-light">{profile?.location || 'Not provided'}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Bio</label>
                {editing ? (
                  <textarea className="form-control" rows="3" value={formData.bio || ''} onChange={(e) => setFormData({...formData, bio: e.target.value})} placeholder="Tell us about yourself..." />
                ) : (
                  <div className="border rounded p-2 bg-light" style={{ minHeight: '80px' }}>{profile?.bio || 'No bio provided'}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Timezone</label>
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
      </div>
    </AdminLayout>
  )
}