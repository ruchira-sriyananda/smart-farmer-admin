import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function Settings() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [settings, setSettings] = useState({
    site_name: 'Smart Farmer',
    site_description: 'Agricultural Platform for Farmers',
    admin_email: '',
    support_email: '',
    maintenance_mode: false,
    allow_registration: true,
    require_email_verification: true,
    max_login_attempts: 5,
    session_timeout_minutes: 30,
    enable_2fa: false,
    enable_recaptcha: true,
    recaptcha_site_key: '',
    recaptcha_secret_key: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    default_language: 'en',
    timezone: 'Asia/Colombo',
    date_format: 'YYYY-MM-DD',
    posts_per_page: 20,
    enable_notifications: true,
    backup_frequency: 'daily'
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

      if (!error && data && data.length > 0) {
        const settingsMap = {}
        data.forEach(setting => {
          settingsMap[setting.setting_key] = setting.setting_value
        })
        setSettings(prev => ({ ...prev, ...settingsMap }))
      }
    } catch (err) {
      console.error('Error fetching settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      // Save each setting to database
      for (const [key, value] of Object.entries(settings)) {
        // Check if setting exists
        const { data: existing } = await supabase
          .from('system_settings')
          .select('setting_key')
          .eq('setting_key', key)
          .single()

        if (existing) {
          // Update existing
          await supabase
            .from('system_settings')
            .update({ 
              setting_value: String(value),
              updated_at: new Date().toISOString()
            })
            .eq('setting_key', key)
        } else {
          // Insert new
          await supabase
            .from('system_settings')
            .insert({
              setting_key: key,
              setting_value: String(value),
              setting_description: `System setting for ${key}`,
              updated_at: new Date().toISOString()
            })
        }
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' })
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    } catch (err) {
      setMessage({ type: 'danger', text: 'Error saving settings: ' + err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      await fetchSettings()
      setMessage({ type: 'info', text: 'Settings reset to defaults' })
    }
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
      {message.text && (
        <div className={`alert alert-${message.type} alert-dismissible fade show mb-4`} role="alert">
          <i className={`bi bi-${message.type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2`}></i>
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })}></button>
        </div>
      )}

      <div className="row g-4">
        {/* General Settings */}
        <div className="col-md-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-gear me-2 text-primary"></i>
                General Settings
              </h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">Site Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={settings.site_name}
                  onChange={(e) => setSettings({...settings, site_name: e.target.value})}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Site Description</label>
                <textarea 
                  className="form-control" 
                  rows="2"
                  value={settings.site_description}
                  onChange={(e) => setSettings({...settings, site_description: e.target.value})}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Admin Email</label>
                <input 
                  type="email" 
                  className="form-control" 
                  value={settings.admin_email}
                  onChange={(e) => setSettings({...settings, admin_email: e.target.value})}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Support Email</label>
                <input 
                  type="email" 
                  className="form-control" 
                  value={settings.support_email}
                  onChange={(e) => setSettings({...settings, support_email: e.target.value})}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Time Zone</label>
                <select 
                  className="form-select"
                  value={settings.timezone}
                  onChange={(e) => setSettings({...settings, timezone: e.target.value})}
                >
                  <option value="Asia/Colombo">Asia/Colombo (Sri Lanka)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (India)</option>
                  <option value="America/New_York">America/New York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="col-md-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-shield-lock me-2 text-primary"></i>
                Security Settings
              </h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <div className="form-check form-switch">
                  <input 
                    className="form-check-input" 
                    type="checkbox"
                    id="maintenanceMode"
                    checked={settings.maintenance_mode === 'true' || settings.maintenance_mode === true}
                    onChange={(e) => setSettings({...settings, maintenance_mode: e.target.checked})}
                  />
                  <label className="form-check-label" htmlFor="maintenanceMode">
                    Maintenance Mode
                  </label>
                  <small className="d-block text-muted">When enabled, only admins can access the site</small>
                </div>
              </div>

              <div className="mb-3">
                <div className="form-check form-switch">
                  <input 
                    className="form-check-input" 
                    type="checkbox"
                    id="enable2fa"
                    checked={settings.enable_2fa === 'true' || settings.enable_2fa === true}
                    onChange={(e) => setSettings({...settings, enable_2fa: e.target.checked})}
                  />
                  <label className="form-check-label" htmlFor="enable2fa">
                    Enable Two-Factor Authentication (2FA)
                  </label>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Max Login Attempts</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={settings.max_login_attempts}
                  onChange={(e) => setSettings({...settings, max_login_attempts: e.target.value})}
                />
                <small className="text-muted">Number of failed attempts before account lockout</small>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Session Timeout (minutes)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={settings.session_timeout_minutes}
                  onChange={(e) => setSettings({...settings, session_timeout_minutes: e.target.value})}
                />
              </div>

              <div className="mb-3">
                <div className="form-check form-switch">
                  <input 
                    className="form-check-input" 
                    type="checkbox"
                    id="enableRecaptcha"
                    checked={settings.enable_recaptcha === 'true' || settings.enable_recaptcha === true}
                    onChange={(e) => setSettings({...settings, enable_recaptcha: e.target.checked})}
                  />
                  <label className="form-check-label" htmlFor="enableRecaptcha">
                    Enable Google reCAPTCHA
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Settings */}
        <div className="col-md-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-people me-2 text-primary"></i>
                User Settings
              </h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <div className="form-check form-switch">
                  <input 
                    className="form-check-input" 
                    type="checkbox"
                    id="allowRegistration"
                    checked={settings.allow_registration === 'true' || settings.allow_registration === true}
                    onChange={(e) => setSettings({...settings, allow_registration: e.target.checked})}
                  />
                  <label className="form-check-label" htmlFor="allowRegistration">
                    Allow New Registrations
                  </label>
                </div>
              </div>

              <div className="mb-3">
                <div className="form-check form-switch">
                  <input 
                    className="form-check-input" 
                    type="checkbox"
                    id="requireEmailVerification"
                    checked={settings.require_email_verification === 'true' || settings.require_email_verification === true}
                    onChange={(e) => setSettings({...settings, require_email_verification: e.target.checked})}
                  />
                  <label className="form-check-label" htmlFor="requireEmailVerification">
                    Require Email Verification
                  </label>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Default Language</label>
                <select 
                  className="form-select"
                  value={settings.default_language}
                  onChange={(e) => setSettings({...settings, default_language: e.target.value})}
                >
                  <option value="en">English</option>
                  <option value="si">Sinhala</option>
                  <option value="ta">Tamil</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Posts Per Page</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={settings.posts_per_page}
                  onChange={(e) => setSettings({...settings, posts_per_page: e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="col-md-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-envelope me-2 text-primary"></i>
                Email Settings (SMTP)
              </h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">SMTP Host</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="smtp.gmail.com"
                  value={settings.smtp_host}
                  onChange={(e) => setSettings({...settings, smtp_host: e.target.value})}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">SMTP Port</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="587"
                  value={settings.smtp_port}
                  onChange={(e) => setSettings({...settings, smtp_port: e.target.value})}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">SMTP Username</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={settings.smtp_user}
                  onChange={(e) => setSettings({...settings, smtp_user: e.target.value})}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">SMTP Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  value={settings.smtp_password}
                  onChange={(e) => setSettings({...settings, smtp_password: e.target.value})}
                />
              </div>

              <div className="mb-3">
                <div className="form-check form-switch">
                  <input 
                    className="form-check-input" 
                    type="checkbox"
                    id="enableNotifications"
                    checked={settings.enable_notifications === 'true' || settings.enable_notifications === true}
                    onChange={(e) => setSettings({...settings, enable_notifications: e.target.value})}
                  />
                  <label className="form-check-label" htmlFor="enableNotifications">
                    Enable Email Notifications
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Backup Settings */}
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-database me-2 text-primary"></i>
                Backup Settings
              </h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Backup Frequency</label>
                    <select 
                      className="form-select"
                      value={settings.backup_frequency}
                      onChange={(e) => setSettings({...settings, backup_frequency: e.target.value})}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Last Backup</label>
                    <div className="border rounded p-2 bg-light">
                      <small className="text-muted">No backup taken yet</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex gap-2">
                <button 
                  className="btn btn-primary" 
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-save me-2"></i>Save All Settings
                    </>
                  )}
                </button>
                <button className="btn btn-outline-secondary" onClick={handleReset}>
                  <i className="bi bi-arrow-repeat me-2"></i>Reset to Defaults
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}