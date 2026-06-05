import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function Settings() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [activeTab, setActiveTab] = useState('general')
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [originalSettings, setOriginalSettings] = useState({})
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
    posts_per_page: 20,
    enable_notifications: true,
    backup_frequency: 'daily',
    auto_backup_time: '00:00',
    retention_days: 30,
    currency: 'LKR',
    currency_symbol: 'Rs',
    enable_analytics: true,
    analytics_id: '',
    cookie_consent: true,
    privacy_policy_url: '',
    terms_url: '',
    social_facebook: '',
    social_twitter: '',
    social_instagram: '',
    social_youtube: ''
  })

  useEffect(() => {
    const session = localStorage.getItem('adminSession')
    if (!session) {
      router.push('/admin/login')
      return
    }
    fetchSettings()
    
    // Warn before leaving if unsaved changes
    const handleBeforeUnload = (e) => {
      if (unsavedChanges) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [router, unsavedChanges])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')

      if (error) throw error

      if (data && data.length > 0) {
        const settingsMap = {}
        data.forEach(setting => {
          let value = setting.setting_value
          if (value === 'true') value = true
          if (value === 'false') value = false
          if (!isNaN(value) && value !== '' && value !== null && setting.setting_key !== 'site_name' && setting.setting_key !== 'site_description') {
            const numValue = Number(value)
            if (!isNaN(numValue) && String(numValue) === value) {
              value = numValue
            }
          }
          settingsMap[setting.setting_key] = value
        })
        setSettings(prev => ({ ...prev, ...settingsMap }))
        setOriginalSettings(settingsMap)
      }
    } catch (err) {
      console.error('Error fetching settings:', err)
      showMessage('error', 'Failed to load settings: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 5000)
  }

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setUnsavedChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    
    try {
      const updates = []
      for (const [key, value] of Object.entries(settings)) {
        let stringValue = typeof value === 'boolean' ? String(value) : String(value)
        if (typeof value === 'number') stringValue = String(value)
        
        updates.push({
          setting_key: key,
          setting_value: stringValue,
          updated_at: new Date().toISOString()
        })
      }

      for (const update of updates) {
        const { error } = await supabase
          .from('system_settings')
          .upsert(update, { onConflict: 'setting_key' })
        
        if (error) throw error
      }

      setUnsavedChanges(false)
      setOriginalSettings(settings)
      showMessage('success', 'Settings saved successfully!')
      
      // Refresh the page after 1 second to apply changes
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err) {
      console.error('Error saving settings:', err)
      showMessage('error', 'Error saving settings: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all settings to default? This will discard all unsaved changes.')) {
      await fetchSettings()
      setUnsavedChanges(false)
      showMessage('info', 'Settings have been reset to saved values')
    }
  }

  // In your Settings component, update the handleTestEmail function

const handleTestEmail = async () => {
  // Validate SMTP settings
  if (!settings.smtp_host || !settings.smtp_user) {
    showMessage('error', 'Please configure SMTP host and username first')
    return
  }
  
  const recipientEmail = settings.admin_email || settings.support_email
  
  if (!recipientEmail) {
    showMessage('error', 'Please configure admin or support email address first')
    return
  }
  
  setSaving(true)
  showMessage('info', 'Sending test email...')
  
  try {
    // First save the settings
    const updates = []
    for (const [key, value] of Object.entries(settings)) {
      const stringValue = typeof value === 'boolean' ? String(value) : String(value)
      updates.push({
        setting_key: key,
        setting_value: stringValue,
        updated_at: new Date().toISOString()
      })
    }
    
    for (const update of updates) {
      await supabase
        .from('system_settings')
        .upsert(update, { onConflict: 'setting_key' })
    }
    
    // Call our Next.js API route
    const response = await fetch('/api/send-test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipientEmail,
        smtpSettings: {
          host: settings.smtp_host,
          port: settings.smtp_port,
          user: settings.smtp_user,
          pass: settings.smtp_password
        },
        siteName: settings.site_name
      })
    })
    
    const data = await response.json()
    
    if (data.success) {
      showMessage('success', `✅ Test email sent to ${recipientEmail}! Please check your inbox.`)
    } else {
      showMessage('error', data.error || 'Failed to send test email')
    }
  } catch (err) {
    console.error('Error sending test email:', err)
    showMessage('error', 'Failed to send test email. Please check your SMTP settings and try again.')
  } finally {
    setSaving(false)
  }
}

  const handleBackupNow = async () => {
    if (!confirm('Creating a backup may take a few minutes. Continue?')) return
    
    showMessage('info', 'Creating backup...')
    
    try {
      const { error } = await supabase.functions.invoke('create-backup', {
        body: { 
          type: 'manual',
          timestamp: new Date().toISOString()
        }
      })
      
      if (error) throw error
      showMessage('success', 'Backup created successfully!')
    } catch (err) {
      console.error('Error creating backup:', err)
      showMessage('error', 'Failed to create backup. Please try again later.')
    }
  }

  const handleClearCache = async () => {
    if (confirm('Clear all application cache? Users may need to reload the page.')) {
      localStorage.clear()
      sessionStorage.clear()
      showMessage('success', 'Cache cleared successfully! Page will reload.')
      setTimeout(() => window.location.reload(), 1500)
    }
  }

  const tabs = [
    { id: 'general', label: 'General', icon: 'bi-gear' },
    { id: 'security', label: 'Security', icon: 'bi-shield-lock' },
    { id: 'users', label: 'Users', icon: 'bi-people' },
    { id: 'email', label: 'Email', icon: 'bi-envelope' },
    { id: 'backup', label: 'Backup', icon: 'bi-database' },
    { id: 'social', label: 'Social Media', icon: 'bi-share' },
    { id: 'advanced', label: 'Advanced', icon: 'bi-sliders' }
  ]

  if (loading) {
    return (
      <AdminLayout title="System Settings">
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-animation">
              <div className="loading-circle"></div>
              <div className="loading-circle delay-1"></div>
              <div className="loading-circle delay-2"></div>
            </div>
            <h3>Loading settings...</h3>
            <p>Please wait while we fetch configuration data</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="System Settings">
      <div className="settings-dashboard">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">
                <i className="bi bi-sliders2"></i>
                System Settings
              </h1>
              <p className="hero-subtitle">Configure and manage your application settings</p>
            </div>
            <div className="hero-actions">
              {unsavedChanges && (
                <div className="unsaved-badge">
                  <i className="bi bi-exclamation-circle"></i>
                  Unsaved changes
                </div>
              )}
              <button className="btn-reset" onClick={handleReset}>
                <i className="bi bi-arrow-repeat"></i>
                Reset
              </button>
              <button className="btn-save" onClick={handleSave} disabled={saving || !unsavedChanges}>
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg"></i>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Message Alert */}
        {message.text && (
          <div className={`alert-custom alert-${message.type} fade-in-up`}>
            <i className={`bi bi-${message.type === 'success' ? 'check-circle-fill' : message.type === 'error' ? 'exclamation-triangle-fill' : 'info-circle-fill'}`}></i>
            <span>{message.text}</span>
            <button className="alert-close" onClick={() => setMessage({ type: '', text: '' })}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="tabs-container">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={tab.icon}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="settings-section fade-in">
              <div className="section-header">
                <h2>
                  <i className="bi bi-gear-fill"></i>
                  General Settings
                </h2>
                <p>Basic configuration for your application</p>
              </div>

              <div className="settings-grid">
                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-building"></i>
                    Site Name
                  </label>
                  <input 
                    type="text" 
                    className="setting-input" 
                    value={settings.site_name}
                    onChange={(e) => handleSettingChange('site_name', e.target.value)}
                    placeholder="Enter site name"
                  />
                  <small className="setting-hint">This appears in browser tabs and headers</small>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-file-text"></i>
                    Site Description
                  </label>
                  <textarea 
                    className="setting-textarea" 
                    rows="3"
                    value={settings.site_description}
                    onChange={(e) => handleSettingChange('site_description', e.target.value)}
                    placeholder="Enter site description"
                  />
                  <small className="setting-hint">Used for SEO and meta descriptions</small>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-envelope-fill"></i>
                    Admin Email
                  </label>
                  <input 
                    type="email" 
                    className="setting-input" 
                    value={settings.admin_email}
                    onChange={(e) => handleSettingChange('admin_email', e.target.value)}
                    placeholder="admin@example.com"
                  />
                  <small className="setting-hint">Primary contact email for system notifications</small>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-headset"></i>
                    Support Email
                  </label>
                  <input 
                    type="email" 
                    className="setting-input" 
                    value={settings.support_email}
                    onChange={(e) => handleSettingChange('support_email', e.target.value)}
                    placeholder="support@example.com"
                  />
                  <small className="setting-hint">Customer support contact email</small>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-clock"></i>
                    Time Zone
                  </label>
                  <select 
                    className="setting-select"
                    value={settings.timezone}
                    onChange={(e) => handleSettingChange('timezone', e.target.value)}
                  >
                    <option value="Asia/Colombo">🇱🇰 Asia/Colombo (Sri Lanka)</option>
                    <option value="Asia/Kolkata">🇮🇳 Asia/Kolkata (India)</option>
                    <option value="Asia/Dubai">🇦🇪 Asia/Dubai (UAE)</option>
                    <option value="America/New_York">🇺🇸 America/New York (EST)</option>
                    <option value="Europe/London">🇬🇧 Europe/London (GMT)</option>
                    <option value="Australia/Sydney">🇦🇺 Australia/Sydney (AEST)</option>
                    <option value="Asia/Tokyo">🇯🇵 Asia/Tokyo (JST)</option>
                  </select>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-calculator"></i>
                    Currency Settings
                  </label>
                  <div className="setting-row">
                    <select 
                      className="setting-select"
                      value={settings.currency}
                      onChange={(e) => handleSettingChange('currency', e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="LKR">Sri Lankan Rupee (LKR)</option>
                      <option value="USD">US Dollar (USD)</option>
                      <option value="EUR">Euro (EUR)</option>
                      <option value="GBP">British Pound (GBP)</option>
                      <option value="INR">Indian Rupee (INR)</option>
                    </select>
                    <input 
                      type="text" 
                      className="setting-input"
                      style={{ width: '100px' }}
                      value={settings.currency_symbol}
                      onChange={(e) => handleSettingChange('currency_symbol', e.target.value)}
                      placeholder="Symbol"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="settings-section fade-in">
              <div className="section-header">
                <h2>
                  <i className="bi bi-shield-lock-fill"></i>
                  Security Settings
                </h2>
                <p>Protect your application from unauthorized access</p>
              </div>

              <div className="settings-grid">
                <div className="setting-card">
                  <div className="toggle-switch">
                    <label className="toggle-label">
                      <i className="bi bi-tools"></i>
                      Maintenance Mode
                    </label>
                    <label className="toggle">
                      <input 
                        type="checkbox"
                        checked={settings.maintenance_mode}
                        onChange={(e) => handleSettingChange('maintenance_mode', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <small className="setting-hint">When enabled, only admins can access the site</small>
                </div>

                <div className="setting-card">
                  <div className="toggle-switch">
                    <label className="toggle-label">
                      <i className="bi bi-shield-check"></i>
                      Two-Factor Authentication (2FA)
                    </label>
                    <label className="toggle">
                      <input 
                        type="checkbox"
                        checked={settings.enable_2fa}
                        onChange={(e) => handleSettingChange('enable_2fa', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <small className="setting-hint">Adds an extra layer of security to user accounts</small>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-key"></i>
                    Max Login Attempts
                  </label>
                  <input 
                    type="number" 
                    className="setting-input" 
                    value={settings.max_login_attempts}
                    onChange={(e) => handleSettingChange('max_login_attempts', parseInt(e.target.value))}
                    min="1"
                    max="10"
                  />
                  <small className="setting-hint">Number of failed attempts before temporary lockout</small>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-hourglass-split"></i>
                    Session Timeout (minutes)
                  </label>
                  <input 
                    type="number" 
                    className="setting-input" 
                    value={settings.session_timeout_minutes}
                    onChange={(e) => handleSettingChange('session_timeout_minutes', parseInt(e.target.value))}
                    min="5"
                    max="120"
                  />
                  <small className="setting-hint">Auto logout after inactivity</small>
                </div>

                <div className="setting-card">
                  <div className="toggle-switch">
                    <label className="toggle-label">
                      <i className="bi bi-robot"></i>
                      Google reCAPTCHA
                    </label>
                    <label className="toggle">
                      <input 
                        type="checkbox"
                        checked={settings.enable_recaptcha}
                        onChange={(e) => handleSettingChange('enable_recaptcha', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <small className="setting-hint">Protects forms from spam and abuse</small>
                </div>

                {settings.enable_recaptcha && (
                  <>
                    <div className="setting-card">
                      <label className="setting-label">
                        <i className="bi bi-key-fill"></i>
                        reCAPTCHA Site Key
                      </label>
                      <input 
                        type="text" 
                        className="setting-input" 
                        value={settings.recaptcha_site_key}
                        onChange={(e) => handleSettingChange('recaptcha_site_key', e.target.value)}
                        placeholder="Enter site key"
                      />
                    </div>

                    <div className="setting-card">
                      <label className="setting-label">
                        <i className="bi bi-lock-fill"></i>
                        reCAPTCHA Secret Key
                      </label>
                      <input 
                        type="password" 
                        className="setting-input" 
                        value={settings.recaptcha_secret_key}
                        onChange={(e) => handleSettingChange('recaptcha_secret_key', e.target.value)}
                        placeholder="Enter secret key"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* User Settings */}
          {activeTab === 'users' && (
            <div className="settings-section fade-in">
              <div className="section-header">
                <h2>
                  <i className="bi bi-people-fill"></i>
                  User Settings
                </h2>
                <p>Manage user registration and preferences</p>
              </div>

              <div className="settings-grid">
                <div className="setting-card">
                  <div className="toggle-switch">
                    <label className="toggle-label">
                      <i className="bi bi-person-plus"></i>
                      Allow New Registrations
                    </label>
                    <label className="toggle">
                      <input 
                        type="checkbox"
                        checked={settings.allow_registration}
                        onChange={(e) => handleSettingChange('allow_registration', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="setting-card">
                  <div className="toggle-switch">
                    <label className="toggle-label">
                      <i className="bi bi-envelope-check"></i>
                      Require Email Verification
                    </label>
                    <label className="toggle">
                      <input 
                        type="checkbox"
                        checked={settings.require_email_verification}
                        onChange={(e) => handleSettingChange('require_email_verification', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <small className="setting-hint">Users must verify email before accessing account</small>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-translate"></i>
                    Default Language
                  </label>
                  <select 
                    className="setting-select"
                    value={settings.default_language}
                    onChange={(e) => handleSettingChange('default_language', e.target.value)}
                  >
                    <option value="en">🇬🇧 English</option>
                    <option value="si">🇱🇰 Sinhala</option>
                    <option value="ta">🇱🇰 Tamil</option>
                  </select>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-layout-text"></i>
                    Posts Per Page
                  </label>
                  <input 
                    type="number" 
                    className="setting-input" 
                    value={settings.posts_per_page}
                    onChange={(e) => handleSettingChange('posts_per_page', parseInt(e.target.value))}
                    min="5"
                    max="100"
                  />
                  <small className="setting-hint">Number of items to display per page</small>
                </div>

                <div className="setting-card">
                  <div className="toggle-switch">
                    <label className="toggle-label">
                      <i className="bi bi-bell"></i>
                      Enable Notifications
                    </label>
                    <label className="toggle">
                      <input 
                        type="checkbox"
                        checked={settings.enable_notifications}
                        onChange={(e) => handleSettingChange('enable_notifications', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Email Settings */}
          {activeTab === 'email' && (
            <div className="settings-section fade-in">
              <div className="section-header">
                <h2>
                  <i className="bi bi-envelope-fill"></i>
                  Email Settings (SMTP)
                </h2>
                <p>Configure email delivery for notifications</p>
              </div>

              <div className="settings-grid">
                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-server"></i>
                    SMTP Host
                  </label>
                  <input 
                    type="text" 
                    className="setting-input" 
                    placeholder="smtp.gmail.com"
                    value={settings.smtp_host}
                    onChange={(e) => handleSettingChange('smtp_host', e.target.value)}
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-plug"></i>
                    SMTP Port
                  </label>
                  <input 
                    type="number" 
                    className="setting-input" 
                    placeholder="587"
                    value={settings.smtp_port}
                    onChange={(e) => handleSettingChange('smtp_port', e.target.value)}
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-person-badge"></i>
                    SMTP Username
                  </label>
                  <input 
                    type="text" 
                    className="setting-input" 
                    value={settings.smtp_user}
                    onChange={(e) => handleSettingChange('smtp_user', e.target.value)}
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-key"></i>
                    SMTP Password
                  </label>
                  <input 
                    type="password" 
                    className="setting-input" 
                    value={settings.smtp_password}
                    onChange={(e) => handleSettingChange('smtp_password', e.target.value)}
                  />
                </div>

                <div className="setting-card">
                  <div className="toggle-switch">
                    <label className="toggle-label">
                      <i className="bi bi-bell-fill"></i>
                      Enable Email Notifications
                    </label>
                    <label className="toggle">
                      <input 
                        type="checkbox"
                        checked={settings.enable_notifications}
                        onChange={(e) => handleSettingChange('enable_notifications', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="setting-card">
                  <button className="btn-test-email" onClick={handleTestEmail}>
                    <i className="bi bi-send"></i>
                    Send Test Email
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Backup Settings */}
          {activeTab === 'backup' && (
            <div className="settings-section fade-in">
              <div className="section-header">
                <h2>
                  <i className="bi bi-database-fill"></i>
                  Backup Settings
                </h2>
                <p>Configure automatic backups and data retention</p>
              </div>

              <div className="settings-grid">
                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-calendar-week"></i>
                    Backup Frequency
                  </label>
                  <select 
                    className="setting-select"
                    value={settings.backup_frequency}
                    onChange={(e) => handleSettingChange('backup_frequency', e.target.value)}
                  >
                    <option value="daily">📅 Daily</option>
                    <option value="weekly">📆 Weekly</option>
                    <option value="monthly">📊 Monthly</option>
                    <option value="never">⛔ Never</option>
                  </select>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-clock"></i>
                    Auto Backup Time
                  </label>
                  <input 
                    type="time" 
                    className="setting-input" 
                    value={settings.auto_backup_time}
                    onChange={(e) => handleSettingChange('auto_backup_time', e.target.value)}
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-database"></i>
                    Retention Days
                  </label>
                  <input 
                    type="number" 
                    className="setting-input" 
                    value={settings.retention_days}
                    onChange={(e) => handleSettingChange('retention_days', parseInt(e.target.value))}
                    min="1"
                    max="365"
                  />
                  <small className="setting-hint">Number of days to keep backup files</small>
                </div>

                <div className="setting-card">
                  <div className="backup-info">
                    <i className="bi bi-info-circle"></i>
                    <div>
                      <strong>Last Backup:</strong> {localStorage.getItem('last_backup') || 'Not performed yet'}
                      <br />
                      <strong>Next Backup:</strong> {settings.backup_frequency !== 'never' ? 'Scheduled' : 'Not scheduled'}
                    </div>
                  </div>
                  <button className="btn-backup-now" onClick={handleBackupNow}>
                    <i className="bi bi-cloud-upload"></i>
                    Backup Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Social Media Settings */}
          {activeTab === 'social' && (
            <div className="settings-section fade-in">
              <div className="section-header">
                <h2>
                  <i className="bi bi-share-fill"></i>
                  Social Media Settings
                </h2>
                <p>Connect your social media accounts</p>
              </div>

              <div className="settings-grid">
                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-facebook"></i>
                    Facebook URL
                  </label>
                  <input 
                    type="url" 
                    className="setting-input" 
                    placeholder="https://facebook.com/yourpage"
                    value={settings.social_facebook}
                    onChange={(e) => handleSettingChange('social_facebook', e.target.value)}
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-twitter-x"></i>
                    Twitter/X URL
                  </label>
                  <input 
                    type="url" 
                    className="setting-input" 
                    placeholder="https://twitter.com/yourprofile"
                    value={settings.social_twitter}
                    onChange={(e) => handleSettingChange('social_twitter', e.target.value)}
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-instagram"></i>
                    Instagram URL
                  </label>
                  <input 
                    type="url" 
                    className="setting-input" 
                    placeholder="https://instagram.com/yourprofile"
                    value={settings.social_instagram}
                    onChange={(e) => handleSettingChange('social_instagram', e.target.value)}
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-youtube"></i>
                    YouTube URL
                  </label>
                  <input 
                    type="url" 
                    className="setting-input" 
                    placeholder="https://youtube.com/yourchannel"
                    value={settings.social_youtube}
                    onChange={(e) => handleSettingChange('social_youtube', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Advanced Settings */}
          {activeTab === 'advanced' && (
            <div className="settings-section fade-in">
              <div className="section-header">
                <h2>
                  <i className="bi bi-sliders2"></i>
                  Advanced Settings
                </h2>
                <p>Advanced configuration and analytics</p>
              </div>

              <div className="settings-grid">
                <div className="setting-card">
                  <div className="toggle-switch">
                    <label className="toggle-label">
                      <i className="bi bi-graph-up"></i>
                      Enable Analytics
                    </label>
                    <label className="toggle">
                      <input 
                        type="checkbox"
                        checked={settings.enable_analytics}
                        onChange={(e) => handleSettingChange('enable_analytics', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                {settings.enable_analytics && (
                  <div className="setting-card">
                    <label className="setting-label">
                      <i className="bi bi-code-square"></i>
                      Google Analytics ID
                    </label>
                    <input 
                      type="text" 
                      className="setting-input" 
                      placeholder="G-XXXXXXXXXX"
                      value={settings.analytics_id}
                      onChange={(e) => handleSettingChange('analytics_id', e.target.value)}
                    />
                    <small className="setting-hint">Enter your Google Analytics 4 measurement ID</small>
                  </div>
                )}

                <div className="setting-card">
                  <div className="toggle-switch">
                    <label className="toggle-label">
                      <i className="bi bi-cookie"></i>
                      Cookie Consent Banner
                    </label>
                    <label className="toggle">
                      <input 
                        type="checkbox"
                        checked={settings.cookie_consent}
                        onChange={(e) => handleSettingChange('cookie_consent', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-file-lock"></i>
                    Privacy Policy URL
                  </label>
                  <input 
                    type="text" 
                    className="setting-input" 
                    placeholder="/privacy-policy"
                    value={settings.privacy_policy_url}
                    onChange={(e) => handleSettingChange('privacy_policy_url', e.target.value)}
                  />
                </div>

                <div className="setting-card">
                  <label className="setting-label">
                    <i className="bi bi-file-text"></i>
                    Terms of Service URL
                  </label>
                  <input 
                    type="text" 
                    className="setting-input" 
                    placeholder="/terms"
                    value={settings.terms_url}
                    onChange={(e) => handleSettingChange('terms_url', e.target.value)}
                  />
                </div>

                <div className="setting-card">
                  <button className="btn-clear-cache" onClick={handleClearCache}>
                    <i className="bi bi-trash"></i>
                    Clear Application Cache
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .settings-dashboard {
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
        }

        .hero-title {
          font-size: 28px;
          font-weight: 700;
          color: white;
          margin: 0 0 8px 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hero-title i {
          font-size: 32px;
        }

        .hero-subtitle {
          font-size: 14px;
          color: rgba(255,255,255,0.9);
          margin: 0;
        }

        .hero-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .unsaved-badge {
          background: rgba(255,255,255,0.2);
          color: #fbbf24;
          padding: 8px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          backdrop-filter: blur(10px);
        }

        .btn-reset, .btn-save {
          padding: 10px 24px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
        }

        .btn-reset {
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
        }

        .btn-reset:hover {
          background: rgba(255,255,255,0.3);
          transform: translateY(-2px);
        }

        .btn-save {
          background: white;
          color: #667eea;
        }

        .btn-save:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
        }

        .btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Alert Custom */
        .alert-custom {
          background: white;
          border-radius: 16px;
          padding: 16px 20px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          animation: slideDown 0.3s ease;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .fade-in-up {
          animation: slideDown 0.3s ease;
        }

        .alert-success {
          background: linear-gradient(135deg, #10b98120, #05966920);
          border-left: 4px solid #10b981;
          color: #065f46;
        }

        .alert-error {
          background: linear-gradient(135deg, #ef444420, #dc262620);
          border-left: 4px solid #ef4444;
          color: #991b1b;
        }

        .alert-info {
          background: linear-gradient(135deg, #3b82f620, #2563eb20);
          border-left: 4px solid #3b82f6;
          color: #1e40af;
        }

        .alert-close {
          margin-left: auto;
          background: none;
          border: none;
          cursor: pointer;
          color: inherit;
          opacity: 0.7;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Tabs */
        .tabs-container {
          display: flex;
          gap: 8px;
          margin-bottom: 32px;
          background: white;
          padding: 8px;
          border-radius: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          flex-wrap: wrap;
        }

        .tab-btn {
          padding: 12px 24px;
          border: none;
          background: transparent;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6c757d;
        }

        .tab-btn i {
          font-size: 18px;
        }

        .tab-btn:hover {
          background: #f8f9fa;
          color: #667eea;
        }

        .tab-btn.active {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }

        /* Tab Content */
        .tab-content {
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .fade-in {
          animation: fadeIn 0.3s ease;
        }

        .settings-section {
          background: white;
          border-radius: 24px;
          padding: 32px;
        }

        .section-header {
          margin-bottom: 32px;
          padding-bottom: 20px;
          border-bottom: 2px solid #f0f0f0;
        }

        .section-header h2 {
          font-size: 20px;
          margin: 0 0 8px 0;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #1f2937;
        }

        .section-header h2 i {
          color: #667eea;
        }

        .section-header p {
          margin: 0;
          color: #6c757d;
          font-size: 14px;
        }

        /* Settings Grid */
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 24px;
        }

        .setting-card {
          background: #f9fafb;
          border-radius: 20px;
          padding: 20px;
          transition: all 0.3s ease;
        }

        .setting-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }

        .setting-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 12px;
        }

        .setting-label i {
          color: #667eea;
        }

        .setting-input, .setting-select, .setting-textarea {
          width: 100%;
          padding: 10px 14px;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.3s ease;
          background: white;
        }

        .setting-input:focus, .setting-select:focus, .setting-textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }

        .setting-textarea {
          resize: vertical;
        }

        .setting-hint {
          display: block;
          margin-top: 8px;
          font-size: 11px;
          color: #9ca3af;
        }

        .setting-row {
          display: flex;
          gap: 12px;
        }

        /* Toggle Switch */
        .toggle-switch {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: #374151;
        }

        .toggle-label i {
          color: #667eea;
        }

        .toggle {
          position: relative;
          display: inline-block;
          width: 52px;
          height: 28px;
        }

        .toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #cbd5e1;
          transition: 0.3s;
          border-radius: 34px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 22px;
          width: 22px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background: linear-gradient(135deg, #667eea, #764ba2);
        }

        input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }

        /* Buttons */
        .btn-test-email, .btn-backup-now, .btn-clear-cache {
          width: 100%;
          padding: 10px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-test-email:hover, .btn-backup-now:hover, .btn-clear-cache:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102,126,234,0.3);
        }

        .backup-info {
          background: #f3f4f6;
          padding: 12px;
          border-radius: 12px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
        }

        .backup-info i {
          font-size: 20px;
          color: #667eea;
        }

        /* Loading Screen */
        .loading-screen {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 500px;
        }

        .loading-content {
          text-align: center;
        }

        .loading-animation {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 24px;
        }

        .loading-circle {
          width: 12px;
          height: 12px;
          background: #667eea;
          border-radius: 50%;
          animation: bounce 1.4s ease-in-out infinite;
        }

        .delay-1 { animation-delay: 0.2s; }
        .delay-2 { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .settings-dashboard {
            padding: 0 16px;
          }

          .hero-section {
            padding: 24px 20px;
          }

          .hero-content {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }

          .hero-title {
            font-size: 24px;
            justify-content: center;
          }

          .hero-actions {
            flex-wrap: wrap;
            justify-content: center;
          }

          .tabs-container {
            overflow-x: auto;
            flex-wrap: nowrap;
            -webkit-overflow-scrolling: touch;
          }

          .tab-btn {
            white-space: nowrap;
            padding: 10px 16px;
          }

          .settings-section {
            padding: 20px;
          }

          .settings-grid {
            grid-template-columns: 1fr;
          }

          .setting-row {
            flex-direction: column;
          }
        }
      `}</style>
    </AdminLayout>
  )
}