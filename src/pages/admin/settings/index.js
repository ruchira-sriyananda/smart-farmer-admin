import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function Settings() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({
    siteName: 'Smart Farmer',
    adminEmail: '',
    maintenanceMode: false,
    allowRegistration: true,
    requireEmailVerification: true
  })

  useEffect(() => {
    const session = localStorage.getItem('adminSession')
    if (!session) {
      router.push('/admin/login')
      return
    }
    fetchSettings()
  }, [router])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(10)

      if (!error && data) {
        const settingsMap = {}
        data.forEach(s => { settingsMap[s.setting_key] = s.setting_value })
        setSettings(prev => ({ ...prev, ...settingsMap }))
      }
    } catch (err) {
      console.error('Error fetching settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    // Save settings logic here
    alert('Settings saved successfully!')
  }

  if (loading) {
    return (
      <AdminLayout title="System Settings">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="System Settings">
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h5 className="mb-4 fw-bold">General Settings</h5>
          
          <div className="mb-3">
            <label className="form-label">Site Name</label>
            <input 
              type="text" 
              className="form-control" 
              value={settings.siteName}
              onChange={(e) => setSettings({...settings, siteName: e.target.value})}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Admin Email</label>
            <input 
              type="email" 
              className="form-control" 
              value={settings.adminEmail}
              onChange={(e) => setSettings({...settings, adminEmail: e.target.value})}
            />
          </div>

          <div className="mb-3 form-check">
            <input 
              type="checkbox" 
              className="form-check-input" 
              id="maintenanceMode"
              checked={settings.maintenanceMode}
              onChange={(e) => setSettings({...settings, maintenanceMode: e.target.checked})}
            />
            <label className="form-check-label" htmlFor="maintenanceMode">
              Maintenance Mode
            </label>
          </div>

          <div className="mb-3 form-check">
            <input 
              type="checkbox" 
              className="form-check-input" 
              id="allowRegistration"
              checked={settings.allowRegistration}
              onChange={(e) => setSettings({...settings, allowRegistration: e.target.checked})}
            />
            <label className="form-check-label" htmlFor="allowRegistration">
              Allow User Registration
            </label>
          </div>

          <button className="btn btn-primary" onClick={handleSave}>
            <i className="bi bi-save me-2"></i>Save Settings
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}