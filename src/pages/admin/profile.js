import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function Profile() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    profile_image: ''
  })
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const session = localStorage.getItem('adminSession')
      if (!session) {
        router.push('/admin/login')
        return
      }

      const sessionData = JSON.parse(session)
      const adminId = sessionData.admin?.admin_id

      if (adminId) {
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
            profile_image: data.profile_image || ''
          })
        }
      } else {
        // Fallback to session data
        setProfile(sessionData.admin)
        setFormData({
          full_name: sessionData.admin?.full_name || '',
          email: sessionData.admin?.email || '',
          phone_number: '',
          profile_image: ''
        })
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setMessage({ type: '', text: '' })
    
    try {
      const session = localStorage.getItem('adminSession')
      const sessionData = JSON.parse(session)
      const adminId = sessionData.admin?.admin_id

      if (adminId) {
        const { error } = await supabase
          .from('admin_users')
          .update({
            full_name: formData.full_name,
            phone_number: formData.phone_number,
            updated_at: new Date().toISOString()
          })
          .eq('admin_id', adminId)

        if (error) throw error

        // Update session
        sessionData.admin.full_name = formData.full_name
        localStorage.setItem('adminSession', JSON.stringify(sessionData))
        
        setMessage({ type: 'success', text: 'Profile updated successfully!' })
        setEditing(false)
        fetchProfile()
      }
    } catch (err) {
      setMessage({ type: 'danger', text: err.message })
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
      <div className="row">
        <div className="col-md-4 mb-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center">
              <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: '120px', height: '120px' }}>
                <span className="text-white fw-bold fs-1">
                  {profile?.full_name?.charAt(0) || 'A'}
                </span>
              </div>
              <h4 className="mb-1">{profile?.full_name}</h4>
              <p className="text-muted mb-2">{profile?.email}</p>
              <div className="d-grid gap-2">
                {!editing ? (
                  <button className="btn btn-primary" onClick={() => setEditing(true)}>
                    <i className="bi bi-pencil me-2"></i>Edit Profile
                  </button>
                ) : (
                  <button className="btn btn-success" onClick={handleSave}>
                    <i className="bi bi-save me-2"></i>Save Changes
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-person-badge me-2 text-primary"></i>
                Profile Information
              </h5>
            </div>
            <div className="card-body">
              {message.text && (
                <div className={`alert alert-${message.type} alert-dismissible fade show`}>
                  {message.text}
                  <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })}></button>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold">Full Name</label>
                {editing ? (
                  <input
                    type="text"
                    className="form-control"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  />
                ) : (
                  <div className="border rounded p-2 bg-light">{profile?.full_name || 'N/A'}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Email Address</label>
                <div className="border rounded p-2 bg-light">{profile?.email || 'N/A'}</div>
                <small className="text-muted">Email cannot be changed</small>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Phone Number</label>
                {editing ? (
                  <input
                    type="tel"
                    className="form-control"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                    placeholder="+94 XX XXX XXXX"
                  />
                ) : (
                  <div className="border rounded p-2 bg-light">{profile?.phone_number || 'Not provided'}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Role</label>
                <div className="border rounded p-2 bg-light">{profile?.role || 'Admin'}</div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Account Created</label>
                <div className="border rounded p-2 bg-light">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleString() : 'N/A'}
                </div>
              </div>

              {!editing && (
                <div className="alert alert-info">
                  <i className="bi bi-info-circle me-2"></i>
                  To change your password, please visit the Security Settings page.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}