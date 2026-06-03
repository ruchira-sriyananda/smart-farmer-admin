import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function SecurityDashboard() {
  const router = useRouter()
  const [securityAlerts, setSecurityAlerts] = useState([])
  const [failedAttempts, setFailedAttempts] = useState([])
  const [blacklistedIPs, setBlacklistedIPs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [selectedIP, setSelectedIP] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [currentUserIP, setCurrentUserIP] = useState('')
  const [stats, setStats] = useState({
    totalAlerts: 0,
    highSeverity: 0,
    mediumSeverity: 0,
    lowSeverity: 0,
    blockedIPs: 0,
    uniqueAttackers: 0
  })

  // Get current user's IP on mount
  useEffect(() => {
    getCurrentUserIP()
    fetchSecurityData()
    
    const alertsSubscription = supabase
      .channel('security_alerts_realtime')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'security_alerts' },
        (payload) => {
          setSecurityAlerts(prev => [payload.new, ...prev.slice(0, 19)])
          fetchStats()
        }
      )
      .subscribe()

    return () => {
      alertsSubscription.unsubscribe()
    }
  }, [])

  const getCurrentUserIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      setCurrentUserIP(data.ip)
    } catch (err) {
      console.error('Error getting IP:', err)
    }
  }

  const fetchSecurityData = async () => {
    try {
      const [
        alertsRes,
        attemptsRes,
        blacklistRes
      ] = await Promise.all([
        supabase.from('security_alerts').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('failed_login_attempts').select('*').order('attempt_time', { ascending: false }).limit(50),
        supabase.from('ip_blacklist').select('*')
      ])

      if (!alertsRes.error) {
        const alerts = alertsRes.data || []
        setSecurityAlerts(alerts)
        calculateStats(alerts, attemptsRes.data || [], blacklistRes.data || [])
      }
      
      if (!attemptsRes.error) setFailedAttempts(attemptsRes.data || [])
      if (!blacklistRes.error) setBlacklistedIPs(blacklistRes.data || [])
    } catch (err) {
      console.error('Error fetching security data:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (alerts, attempts, blacklist) => {
    const uniqueAttackers = new Set(attempts.map(a => a.ip_address).filter(ip => ip)).size

    setStats({
      totalAlerts: alerts.filter(a => !a.resolved).length,
      highSeverity: alerts.filter(a => a.severity_level === 'HIGH' && !a.resolved).length,
      mediumSeverity: alerts.filter(a => a.severity_level === 'MEDIUM' && !a.resolved).length,
      lowSeverity: alerts.filter(a => a.severity_level === 'LOW' && !a.resolved).length,
      blockedIPs: blacklist.length,
      uniqueAttackers: uniqueAttackers
    })
  }

  const resolveAlert = async (alertId) => {
    setActionLoading(true)
    const { error } = await supabase
      .from('security_alerts')
      .update({ 
        resolved: true, 
        resolved_at: new Date().toISOString() 
      })
      .eq('alert_id', alertId)

    if (!error) {
      fetchSecurityData()
    }
    setActionLoading(false)
  }

  const blockIP = async () => {
    if (!selectedIP) return
    
    // Prevent self-blocking
    if (selectedIP === currentUserIP) {
      alert('⚠️ You cannot block your own IP address! This would lock you out of the admin panel.')
      setShowBlockModal(false)
      setSelectedIP('')
      setBlockReason('')
      return
    }
    
    setActionLoading(true)
    
    try {
      // Check if IP is already blacklisted
      const { data: existing } = await supabase
        .from('ip_blacklist')
        .select('ip_address')
        .eq('ip_address', selectedIP)
        .maybeSingle()

      if (existing) {
        alert('IP address is already blacklisted!')
        setShowBlockModal(false)
        setSelectedIP('')
        setBlockReason('')
        setActionLoading(false)
        return
      }

      // Block the IP
      const { error } = await supabase
        .from('ip_blacklist')
        .insert({ 
          ip_address: selectedIP, 
          blocked_reason: blockReason || 'Suspicious activity detected',
          blocked_at: new Date().toISOString()
        })

      if (error) {
        console.error('Block IP error:', error)
        alert(`Failed to block IP: ${error.message}`)
      } else {
        alert(`✅ IP ${selectedIP} has been blocked successfully! This IP can no longer access the admin panel.`)
        fetchSecurityData()
        setShowBlockModal(false)
        setSelectedIP('')
        setBlockReason('')
      }
    } catch (err) {
      console.error('Error blocking IP:', err)
      alert('Error blocking IP: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const unblockIP = async (ipId, ipAddress) => {
    if (!confirm(`Are you sure you want to unblock ${ipAddress}? This IP will regain access to the admin panel.`)) return
    
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('ip_blacklist')
        .delete()
        .eq('blacklist_id', ipId)

      if (error) {
        console.error('Unblock IP error:', error)
        alert(`Failed to unblock IP: ${error.message}`)
      } else {
        alert(`✅ IP ${ipAddress} has been unblocked successfully! This IP can now access the admin panel.`)
        fetchSecurityData()
      }
    } catch (err) {
      console.error('Error unblocking IP:', err)
      alert('Error unblocking IP: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Helper to check if an IP is the current user's IP
  const isCurrentUserIP = (ip) => {
    return ip === currentUserIP
  }

  const getSeverityClass = (severity) => {
    const classes = { 
      'HIGH': 'danger', 
      'MEDIUM': 'warning', 
      'LOW': 'info' 
    }
    return classes[severity] || 'secondary'
  }

  const getSeverityIcon = (severity) => {
    const icons = {
      'HIGH': 'bi-exclamation-triangle-fill',
      'MEDIUM': 'bi-exclamation-circle-fill',
      'LOW': 'bi-info-circle-fill'
    }
    return icons[severity] || 'bi-shield'
  }

  if (loading) {
    return (
      <AdminLayout title="Security Dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading security data...</p>
        </div>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
          }
          .loading-spinner {
            width: 48px;
            height: 48px;
            border: 3px solid #e9ecef;
            border-top-color: #4f46e5;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Security Dashboard">
      <div className="security-container">
        {/* Current IP Info Banner */}
        <div className="current-ip-banner">
          <i className="bi bi-ip"></i>
          <div>
            <strong>Your IP Address:</strong> {currentUserIP || 'Loading...'}
            <span className="text-muted small ms-2">(You cannot block your own IP)</span>
          </div>
        </div>

        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="bi bi-shield-lock-fill"></i>
            </div>
            <div>
              <h1 className="header-title">Security Dashboard</h1>
              <p className="header-subtitle">Monitor and manage platform security</p>
            </div>
          </div>
          <button className="refresh-btn" onClick={fetchSecurityData}>
            <i className="bi bi-arrow-repeat"></i> Refresh
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-icon"><i className="bi bi-shield-exclamation"></i></div>
            <div className="stat-info">
              <span className="stat-label">Active Alerts</span>
              <h2 className="stat-value">{stats.totalAlerts}</h2>
            </div>
          </div>
          <div className="stat-card high">
            <div className="stat-icon"><i className="bi bi-exclamation-triangle"></i></div>
            <div className="stat-info">
              <span className="stat-label">High Severity</span>
              <h2 className="stat-value text-danger">{stats.highSeverity}</h2>
            </div>
          </div>
          <div className="stat-card medium">
            <div className="stat-icon"><i className="bi bi-exclamation-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Medium Severity</span>
              <h2 className="stat-value text-warning">{stats.mediumSeverity}</h2>
            </div>
          </div>
          <div className="stat-card low">
            <div className="stat-icon"><i className="bi bi-info-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Low Severity</span>
              <h2 className="stat-value text-info">{stats.lowSeverity}</h2>
            </div>
          </div>
          <div className="stat-card blocked">
            <div className="stat-icon"><i className="bi bi-slash-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Blocked IPs</span>
              <h2 className="stat-value">{stats.blockedIPs}</h2>
            </div>
          </div>
        </div>

        <div className="two-columns">
          {/* Failed Login Attempts */}
          <div className="failed-attempts-card">
            <div className="section-header">
              <h5><i className="bi bi-key me-2 text-warning"></i> Failed Login Attempts</h5>
              <span className="section-badge">{failedAttempts.length} attempts</span>
            </div>
            <div className="attempts-list">
              {failedAttempts.length > 0 ? (
                failedAttempts.slice(0, 10).map((attempt) => (
                  <div key={attempt.attempt_id} className="attempt-item">
                    <div className="attempt-info">
                      <div className="attempt-email">
                        <i className="bi bi-envelope"></i>
                        {attempt.email}
                      </div>
                      <div className="attempt-details">
                        <span className="attempt-ip">
                          <i className="bi bi-ip"></i>
                          {attempt.ip_address}
                          {isCurrentUserIP(attempt.ip_address) && (
                            <span className="current-ip-badge">(You)</span>
                          )}
                        </span>
                        <span className="attempt-reason">
                          <i className="bi bi-info-circle"></i>
                          {attempt.failure_reason}
                        </span>
                      </div>
                      <div className="attempt-time">
                        <i className="bi bi-clock"></i>
                        {new Date(attempt.attempt_time).toLocaleString()}
                      </div>
                    </div>
                    {attempt.ip_address && !isCurrentUserIP(attempt.ip_address) && (
                      <button 
                        className="btn-block"
                        onClick={() => {
                          setSelectedIP(attempt.ip_address)
                          setShowBlockModal(true)
                        }}
                      >
                        <i className="bi bi-ban"></i> Block IP
                      </button>
                    )}
                    {attempt.ip_address && isCurrentUserIP(attempt.ip_address) && (
                      <button className="btn-block-disabled" disabled title="You cannot block your own IP">
                        <i className="bi bi-ban"></i> Cannot Block Self
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state-small">
                  <i className="bi bi-check-circle"></i>
                  <p>No failed login attempts</p>
                </div>
              )}
            </div>
          </div>

          {/* Blacklisted IPs */}
          <div className="blacklist-card">
            <div className="section-header">
              <h5><i className="bi bi-slash-circle me-2 text-danger"></i> Blacklisted IPs</h5>
              <span className="section-badge">{blacklistedIPs.length} blocked</span>
            </div>
            <div className="blacklist-list">
              {blacklistedIPs.length > 0 ? (
                blacklistedIPs.map((ip) => (
                  <div key={ip.blacklist_id} className="blacklist-item">
                    <div className="blacklist-info">
                      <div className="blacklist-ip">
                        <code>{ip.ip_address}</code>
                        {isCurrentUserIP(ip.ip_address) && (
                          <span className="self-block-warning">⚠️ YOUR IP</span>
                        )}
                      </div>
                      <div className="blacklist-reason">
                        <i className="bi bi-exclamation-circle"></i>
                        {ip.blocked_reason || 'Suspicious activity detected'}
                      </div>
                      <div className="blacklist-time">
                        <i className="bi bi-calendar"></i>
                        {new Date(ip.blocked_at).toLocaleString()}
                      </div>
                    </div>
                    <button 
                      className="btn-unblock"
                      onClick={() => unblockIP(ip.blacklist_id, ip.ip_address)}
                      disabled={actionLoading}
                    >
                      <i className="bi bi-unlock"></i> Unblock
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-state-small">
                  <i className="bi bi-shield-check"></i>
                  <p>No IPs blacklisted</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Block IP Modal */}
      {showBlockModal && (
        <div className="modal-overlay" onClick={() => setShowBlockModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header danger">
              <div className="modal-icon">
                <i className="bi bi-ban"></i>
              </div>
              <h3>Block IP Address</h3>
              <button className="modal-close" onClick={() => setShowBlockModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to block this IP address?</p>
              <div className="ip-display">{selectedIP}</div>
              {selectedIP === currentUserIP && (
                <div className="warning-message danger">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  <strong>WARNING:</strong> You are trying to block your own IP address! This will lock you out of the admin panel.
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Reason (Optional)</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  placeholder="Enter reason for blocking this IP..."
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                />
              </div>
              <div className="warning-message">
                <i className="bi bi-info-circle-fill"></i>
                Blocked IPs will be unable to access the admin panel. They will see an "Access Denied" message.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowBlockModal(false)}>Cancel</button>
              <button 
                className="btn-primary danger" 
                onClick={blockIP} 
                disabled={actionLoading || selectedIP === currentUserIP}
              >
                {actionLoading ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Blocking...</>
                ) : (
                  'Confirm Block'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .security-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .current-ip-banner {
          background: #e7f1ff;
          border-radius: 12px;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .current-ip-banner i {
          font-size: 20px;
          color: #4f46e5;
        }

        .current-ip-badge {
          background: #e9ecef;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          margin-left: 6px;
        }

        .self-block-warning {
          background: #fee2e2;
          color: #dc2626;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          margin-left: 8px;
        }

        .btn-block-disabled {
          padding: 6px 12px;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          color: #adb5bd;
          font-size: 11px;
          cursor: not-allowed;
        }

        /* Rest of the styles remain the same as before */
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .header-icon {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-icon i {
          font-size: 28px;
          color: white;
        }

        .header-title {
          font-size: 24px;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 4px 0;
        }

        .header-subtitle {
          color: #6c757d;
          margin: 0;
          font-size: 14px;
        }

        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          color: #495057;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .refresh-btn:hover {
          background: #e9ecef;
          transform: translateY(-1px);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }

        .stat-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.3s ease;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .stat-card.total .stat-icon { background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); color: #667eea; }
        .stat-card.high .stat-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .stat-card.medium .stat-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .stat-card.low .stat-icon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .stat-card.blocked .stat-icon { background: rgba(107, 114, 128, 0.1); color: #6c757d; }

        .stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon i {
          font-size: 24px;
        }

        .stat-info {
          flex: 1;
        }

        .stat-label {
          font-size: 13px;
          color: #6c757d;
          margin-bottom: 4px;
          display: block;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          color: #1f2937;
        }

        .text-danger { color: #ef4444; }
        .text-warning { color: #f59e0b; }
        .text-info { color: #3b82f6; }

        .two-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }

        .failed-attempts-card, .blacklist-card {
          background: white;
          border-radius: 24px;
          padding: 20px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-header h5 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #1f2937;
        }

        .section-badge {
          background: #f8f9fa;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          color: #6c757d;
        }

        .attempts-list, .blacklist-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .attempt-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 16px;
          border-bottom: 1px solid #e9ecef;
          transition: all 0.3s ease;
        }

        .attempt-item:hover {
          background: #f8f9fa;
        }

        .attempt-info {
          flex: 1;
        }

        .attempt-email {
          font-size: 13px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 6px;
        }

        .attempt-details {
          display: flex;
          gap: 16px;
          font-size: 11px;
          color: #6c757d;
          margin-bottom: 6px;
          flex-wrap: wrap;
        }

        .attempt-time {
          font-size: 10px;
          color: #9ca3af;
        }

        .btn-block {
          padding: 6px 12px;
          background: none;
          border: 1px solid #ef4444;
          border-radius: 8px;
          color: #ef4444;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-block:hover {
          background: #ef4444;
          color: white;
        }

        .blacklist-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #e9ecef;
          transition: all 0.3s ease;
        }

        .blacklist-item:hover {
          background: #f8f9fa;
        }

        .blacklist-ip {
          font-family: monospace;
          font-size: 13px;
          font-weight: 600;
          color: #dc2626;
          margin-bottom: 6px;
        }

        .blacklist-reason {
          font-size: 11px;
          color: #6c757d;
          margin-bottom: 6px;
        }

        .blacklist-time {
          font-size: 10px;
          color: #9ca3af;
        }

        .btn-unblock {
          padding: 6px 12px;
          background: none;
          border: 1px solid #10b981;
          border-radius: 8px;
          color: #10b981;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-unblock:hover {
          background: #10b981;
          color: white;
        }

        .empty-state-small {
          text-align: center;
          padding: 40px 20px;
          color: #9ca3af;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          animation: fadeIn 0.2s ease;
        }

        .modal-container {
          background: white;
          border-radius: 24px;
          width: 90%;
          max-width: 500px;
          animation: slideUp 0.3s ease;
          overflow: hidden;
        }

        .modal-header {
          padding: 24px 24px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
        }

        .modal-header.danger .modal-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

        .modal-icon {
          width: 48px;
          height: 48px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-icon i { font-size: 24px; }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .modal-close {
          position: absolute;
          right: 20px;
          top: 20px;
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #9ca3af;
        }

        .modal-body {
          padding: 24px;
        }

        .ip-display {
          background: #f8f9fa;
          padding: 12px;
          border-radius: 12px;
          font-family: monospace;
          text-align: center;
          margin: 16px 0;
          font-size: 14px;
        }

        .form-group {
          margin-top: 16px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .form-textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
          resize: vertical;
        }

        .warning-message {
          background: #fff3cd;
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #856404;
          margin-top: 16px;
        }

        .warning-message.danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .modal-footer {
          padding: 16px 24px 24px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          border-top: 1px solid #e9ecef;
        }

        .btn-secondary {
          padding: 10px 20px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
        }

        .btn-primary {
          padding: 10px 24px;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-primary.danger { background: #ef4444; color: white; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 1200px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr); }
          .two-columns { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .attempt-item { flex-direction: column; gap: 12px; }
          .blacklist-item { flex-direction: column; gap: 12px; text-align: center; }
        }
      `}</style>
    </AdminLayout>
  )
}