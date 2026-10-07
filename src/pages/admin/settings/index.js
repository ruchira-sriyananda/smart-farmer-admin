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
    // Password Policy
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_number: true,
    password_require_special_char: true,
    password_expiry_days: 90,
    force_password_change_first_login: true,
    // 2FA / MFA
    enable_2fa: false,
    enforce_super_admin_2fa: true,
    mfa_provider: 'totp',
    // Session & Access Control
    session_timeout_minutes: 30,
    max_concurrent_sessions: 2,
    enable_ip_binding: false,
    enable_ip_whitelist: false,
    allowed_ip_whitelist: '',
    // Threat Defense & Rate Limiting
    max_login_attempts: 5,
    lockout_duration_minutes: 15,
    auto_block_suspicious_ip: true,
    auto_block_threshold: 10,
    enable_recaptcha: true,
    recaptcha_site_key: '',
    recaptcha_secret_key: '',
    // Data Protection & File Upload Security
    enforce_https: true,
    allowed_file_extensions: '.jpg, .jpeg, .png, .webp, .pdf',
    max_file_upload_size_mb: 10,
    sanitize_html_inputs: true,
    // Security Alerting & Webhooks
    enable_security_email_alerts: true,
    security_alert_email: '',
    security_webhook_url: '',
    notify_on_high_severity: true,
    // Other settings
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    default_language: 'en',
    timezone: 'Asia/Colombo',
    posts_per_page: 20,
    enable_notifications: true,
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
                  Industry Standard Security Settings
                </h2>
                <p>Enterprise threat defense, authentication rules, access control, and compliance policies</p>
              </div>

              {/* Security Compliance Overview Banner */}
              <div className="security-status-banner mb-4">
                <div className="banner-badge">
                  <i className="bi bi-shield-check text-success fs-4 me-2"></i>
                  <div>
                    <strong>Security Compliance Shield</strong>
                    <div className="small text-muted">
                      Password Policy: Active | 2FA Enforced: {settings.enable_2fa ? 'Yes' : 'Optional'} | Rate Limit: Guarded | Session Timeout: {settings.session_timeout_minutes}m
                    </div>
                  </div>
                </div>
              </div>

              {/* Category 1: System Access & Maintenance Mode */}
              <div className="security-group-card mb-4">
                <h5 className="group-title"><i className="bi bi-sliders text-primary me-2"></i> System Access & Maintenance</h5>
                <div className="settings-grid mt-3">
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
                    <small className="setting-hint">When enabled, only active admins can access the portal</small>
                  </div>

                  <div className="setting-card">
                    <div className="toggle-switch">
                      <label className="toggle-label">
                        <i className="bi bi-lock"></i>
                        Enforce HTTPS / TLS Connection
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.enforce_https}
                          onChange={(e) => handleSettingChange('enforce_https', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <small className="setting-hint">Reject unencrypted HTTP traffic across all API and Admin routes</small>
                  </div>
                </div>
              </div>

              {/* Category 2: Password Policy & Account Hardening */}
              <div className="security-group-card mb-4">
                <h5 className="group-title"><i className="bi bi-key-fill text-warning me-2"></i> Password Policy & Account Hardening</h5>
                <div className="settings-grid mt-3">
                  <div className="setting-card">
                    <label className="setting-label">
                      <i className="bi bi-type-italic"></i>
                      Minimum Password Length
                    </label>
                    <input
                      type="number"
                      className="setting-input"
                      value={settings.password_min_length}
                      onChange={(e) => handleSettingChange('password_min_length', parseInt(e.target.value) || 8)}
                      min="8"
                      max="32"
                    />
                    <small className="setting-hint">Industry standard recommendation: minimum 8-12 characters</small>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <i className="bi bi-calendar-event"></i>
                      Password Expiration (Days)
                    </label>
                    <input
                      type="number"
                      className="setting-input"
                      value={settings.password_expiry_days}
                      onChange={(e) => handleSettingChange('password_expiry_days', parseInt(e.target.value) || 90)}
                      min="30"
                      max="365"
                    />
                    <small className="setting-hint">Mandatory password reset interval for admin accounts</small>
                  </div>

                  <div className="setting-card">
                    <div className="toggle-switch">
                      <label className="toggle-label">
                        <i className="bi bi-check2-square"></i>
                        Require Uppercase Letters
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.password_require_uppercase}
                          onChange={(e) => handleSettingChange('password_require_uppercase', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <small className="setting-hint">Require at least one uppercase character (A-Z)</small>
                  </div>

                  <div className="setting-card">
                    <div className="toggle-switch">
                      <label className="toggle-label">
                        <i className="bi bi-123"></i>
                        Require Numbers & Special Characters
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.password_require_number}
                          onChange={(e) => handleSettingChange('password_require_number', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <small className="setting-hint">Require numbers (0-9) and symbols (!@#$%^&*)</small>
                  </div>

                  <div className="setting-card">
                    <div className="toggle-switch">
                      <label className="toggle-label">
                        <i className="bi bi-person-exclamation"></i>
                        Force Reset on First Login
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.force_password_change_first_login}
                          onChange={(e) => handleSettingChange('force_password_change_first_login', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <small className="setting-hint">Newly provisioned admins must change temp password immediately</small>
                  </div>
                </div>
              </div>

              {/* Category 3: Multi-Factor Authentication (2FA) */}
              <div className="security-group-card mb-4">
                <h5 className="group-title"><i className="bi bi-shield-check text-success me-2"></i> Multi-Factor Authentication (MFA / 2FA)</h5>
                <div className="settings-grid mt-3">
                  <div className="setting-card">
                    <div className="toggle-switch">
                      <label className="toggle-label">
                        <i className="bi bi-phone"></i>
                        Enable 2FA Platform-Wide
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
                    <small className="setting-hint">Allow admins to bind TOTP authenticator apps</small>
                  </div>

                  <div className="setting-card">
                    <div className="toggle-switch">
                      <label className="toggle-label">
                        <i className="bi bi-award-fill"></i>
                        Enforce 2FA for Super Admins
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.enforce_super_admin_2fa}
                          onChange={(e) => handleSettingChange('enforce_super_admin_2fa', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <small className="setting-hint">Mandatory 2FA challenge for all Super Administrator accounts</small>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <i className="bi bi-qr-code-scan"></i>
                      2FA Provider Standard
                    </label>
                    <select
                      className="setting-select"
                      value={settings.mfa_provider || 'totp'}
                      onChange={(e) => handleSettingChange('mfa_provider', e.target.value)}
                    >
                      <option value="totp">Authenticator App (TOTP - Google / Authy / Microsoft)</option>
                      <option value="email_otp">Email Verification OTP Code</option>
                      <option value="hybrid">Hybrid (TOTP + Email Fallback)</option>
                    </select>
                    <small className="setting-hint">Cryptographic protocol standard for 2FA verification</small>
                  </div>
                </div>
              </div>

              {/* Category 4: Session Control & IP Whitelisting */}
              <div className="security-group-card mb-4">
                <h5 className="group-title"><i className="bi bi-hourglass-split text-info me-2"></i> Session Control & IP Whitelisting</h5>
                <div className="settings-grid mt-3">
                  <div className="setting-card">
                    <label className="setting-label">
                      <i className="bi bi-stopwatch"></i>
                      Session Timeout (Minutes)
                    </label>
                    <input
                      type="number"
                      className="setting-input"
                      value={settings.session_timeout_minutes}
                      onChange={(e) => handleSettingChange('session_timeout_minutes', parseInt(e.target.value) || 30)}
                      min="5"
                      max="120"
                    />
                    <small className="setting-hint">Automatically log out inactive sessions after X minutes</small>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <i className="bi bi-people-fill"></i>
                      Max Concurrent Sessions
                    </label>
                    <input
                      type="number"
                      className="setting-input"
                      value={settings.max_concurrent_sessions || 2}
                      onChange={(e) => handleSettingChange('max_concurrent_sessions', parseInt(e.target.value) || 2)}
                      min="1"
                      max="5"
                    />
                    <small className="setting-hint">Maximum concurrent active sessions per admin account</small>
                  </div>

                  <div className="setting-card">
                    <div className="toggle-switch">
                      <label className="toggle-label">
                        <i className="bi bi-ethernet"></i>
                        Session IP Lock (IP Binding)
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.enable_ip_binding}
                          onChange={(e) => handleSettingChange('enable_ip_binding', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <small className="setting-hint">Invalidates session if client IP address changes during active session</small>
                  </div>

                  <div className="setting-card">
                    <div className="toggle-switch">
                      <label className="toggle-label">
                        <i className="bi bi-funnel-fill"></i>
                        Restrict Portal to Whitelisted IPs
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.enable_ip_whitelist}
                          onChange={(e) => handleSettingChange('enable_ip_whitelist', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <small className="setting-hint">Block access unless user IP is listed in the Allowed Whitelist</small>
                  </div>

                  {settings.enable_ip_whitelist && (
                    <div className="setting-card style-full-width">
                      <label className="setting-label">
                        <i className="bi bi-list-check"></i>
                        Whitelisted IP / CIDR Ranges
                      </label>
                      <input 
                        type="text"
                        className="setting-input"
                        value={settings.allowed_ip_whitelist || ''}
                        onChange={(e) => handleSettingChange('allowed_ip_whitelist', e.target.value)}
                        placeholder="e.g. 192.168.1.1, 10.0.0.0/24, 203.0.113.45"
                      />
                      <small className="setting-hint">Comma-separated list of IPv4/IPv6 addresses or CIDR subnets allowed to access Admin Portal</small>
                    </div>
                  )}
                </div>
              </div>

              {/* Category 5: Threat Defense & Brute-Force Rate Limiting */}
              <div className="security-group-card mb-4">
                <h5 className="group-title"><i className="bi bi-shield-slash-fill text-danger me-2"></i> Threat Defense & Brute-Force Rate Limiting</h5>
                <div className="settings-grid mt-3">
                  <div className="setting-card">
                    <label className="setting-label">
                      <i className="bi bi-x-octagon"></i>
                      Max Login Failure Limit
                    </label>
                    <input
                      type="number"
                      className="setting-input"
                      value={settings.max_login_attempts}
                      onChange={(e) => handleSettingChange('max_login_attempts', parseInt(e.target.value) || 5)}
                      min="3"
                      max="10"
                    />
                    <small className="setting-hint">Failed password attempts before temporary account lockout</small>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <i className="bi bi-clock-history"></i>
                      Lockout Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      className="setting-input"
                      value={settings.lockout_duration_minutes || 15}
                      onChange={(e) => handleSettingChange('lockout_duration_minutes', parseInt(e.target.value) || 15)}
                      min="5"
                      max="1440"
                    />
                    <small className="setting-hint">Cool-down duration before locked account can attempt re-login</small>
                  </div>

                  <div className="setting-card">
                    <div className="toggle-switch">
                      <label className="toggle-label">
                        <i className="bi bi-ban"></i>
                        Auto-Block Malicious IP Addresses
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.auto_block_suspicious_ip}
                          onChange={(e) => handleSettingChange('auto_block_suspicious_ip', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <small className="setting-hint">Automatically add IP to blacklists after exceeding threshold</small>
                  </div>

                  <div className="setting-card">
                    <div className="toggle-switch">
                      <label className="toggle-label">
                        <i className="bi bi-robot"></i>
                        Google reCAPTCHA v3 / Enterprise
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
                    <small className="setting-hint">Bot challenge on login, registration, and sensitive forms</small>
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
                          placeholder="Public site key"
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
                          placeholder="Secret key"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Category 6: File Upload Security & Input Sanitization */}
              <div className="security-group-card mb-4">
                <h5 className="group-title"><i className="bi bi-file-earmark-check text-secondary me-2"></i> File Upload Security & Input Sanitization</h5>
                <div className="settings-grid mt-3">
                  <div className="setting-card">
                    <label className="setting-label">
                      <i className="bi bi-file-earmark-code"></i>
                      Allowed File Upload Extensions
                    </label>
                    <input
                      type="text"
                      className="setting-input"
                      value={settings.allowed_file_extensions || '.jpg, .jpeg, .png, .webp, .pdf'}
                      onChange={(e) => handleSettingChange('allowed_file_extensions', e.target.value)}
                      placeholder=".jpg, .png, .webp, .pdf"
                    />
                    <small className="setting-hint">Restrict uploads to whitelisted file extensions only</small>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <i className="bi bi-hdd-network"></i>
                      Max Upload Limit (MB)
                    </label>
                    <input
                      type="number"
                      className="setting-input"
                      value={settings.max_file_upload_size_mb || 10}
                      onChange={(e) => handleSettingChange('max_file_upload_size_mb', parseInt(e.target.value) || 10)}
                      min="1"
                      max="100"
                    />
                    <small className="setting-hint">Maximum payload size per single media/file upload</small>
                  </div>

                  <div className="setting-card">
                    <div className="toggle-switch">
                      <label className="toggle-label">
                        <i className="bi bi-code-slash"></i>
                        XSS / HTML Input Sanitization
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.sanitize_html_inputs}
                          onChange={(e) => handleSettingChange('sanitize_html_inputs', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <small className="setting-hint">Strip malicious JavaScript/HTML code from user inputs before DB write</small>
                  </div>
                </div>
              </div>

              {/* Category 7: Incident Alerting & Webhooks */}
              <div className="security-group-card mb-4">
                <h5 className="group-title"><i className="bi bi-bell-fill text-warning me-2"></i> Security Incident Alerting & Webhooks</h5>
                <div className="settings-grid mt-3">
                  <div className="setting-card">
                    <div className="toggle-switch">
                      <label className="toggle-label">
                        <i className="bi bi-envelope-at"></i>
                        Instant Security Email Alerts
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.enable_security_email_alerts}
                          onChange={(e) => handleSettingChange('enable_security_email_alerts', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <small className="setting-hint">Send immediate email notifications on detected security breaches</small>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <i className="bi bi-envelope-check"></i>
                      Security Incident Email
                    </label>
                    <input
                      type="email"
                      className="setting-input"
                      value={settings.security_alert_email || ''}
                      onChange={(e) => handleSettingChange('security_alert_email', e.target.value)}
                      placeholder="security@smartfarmer.lk"
                    />
                    <small className="setting-hint">Dedicated email address for SOC / Security Team alerts</small>
                  </div>

                  <div className="setting-card">
                    <label className="setting-label">
                      <i className="bi bi-discord"></i>
                      Security Webhook URL (Slack / Discord)
                    </label>
                    <input
                      type="url"
                      className="setting-input"
                      value={settings.security_webhook_url || ''}
                      onChange={(e) => handleSettingChange('security_webhook_url', e.target.value)}
                      placeholder="https://hooks.slack.com/services/..."
                    />
                    <small className="setting-hint">Receive real-time threat notifications in Slack, Discord, or Teams channel</small>
                  </div>
                </div>
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

        .security-status-banner {
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          border: 1px solid #a7f3d0;
          border-radius: 16px;
          padding: 16px 20px;
        }

        .banner-badge {
          display: flex;
          align-items: center;
        }

        .security-group-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 24px;
        }

        .group-title {
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
          display: flex;
          align-items: center;
        }

        .style-full-width {
          grid-column: 1 / -1;
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