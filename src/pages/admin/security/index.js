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
  const [stats, setStats] = useState({
    totalAlerts: 0,
    highSeverity: 0,
    mediumSeverity: 0,
    lowSeverity: 0,
    blockedIPs: 0
  })

  useEffect(() => {
    fetchSecurityData()
  }, [])

  const fetchSecurityData = async () => {
    try {
      const [alertsRes, attemptsRes, blacklistRes] = await Promise.all([
        supabase.from('security_alerts').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('failed_login_attempts').select('*').order('attempt_time', { ascending: false }).limit(20),
        supabase.from('ip_blacklist').select('*')
      ])

      if (!alertsRes.error) {
        const alerts = alertsRes.data || []
        setSecurityAlerts(alerts)
        setStats({
          totalAlerts: alerts.length,
          highSeverity: alerts.filter(a => a.severity_level === 'HIGH' && !a.resolved).length,
          mediumSeverity: alerts.filter(a => a.severity_level === 'MEDIUM' && !a.resolved).length,
          lowSeverity: alerts.filter(a => a.severity_level === 'LOW' && !a.resolved).length,
          blockedIPs: blacklistRes.data?.length || 0
        })
      }
      
      if (!attemptsRes.error) setFailedAttempts(attemptsRes.data || [])
      if (!blacklistRes.error) setBlacklistedIPs(blacklistRes.data || [])
    } catch (err) {
      console.error('Error fetching security data:', err)
    } finally {
      setLoading(false)
    }
  }

  const resolveAlert = async (alertId) => {
    const { error } = await supabase
      .from('security_alerts')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('alert_id', alertId)

    if (!error) fetchSecurityData()
  }

  const blockIP = async (ipAddress) => {
    const { error } = await supabase
      .from('ip_blacklist')
      .insert({ ip_address: ipAddress, blocked_at: new Date().toISOString() })

    if (!error) fetchSecurityData()
  }

  const unblockIP = async (ipId) => {
    const { error } = await supabase
      .from('ip_blacklist')
      .delete()
      .eq('blacklist_id', ipId)

    if (!error) fetchSecurityData()
  }

  const getSeverityClass = (severity) => {
    const classes = { 'HIGH': 'danger', 'MEDIUM': 'warning', 'LOW': 'info' }
    return classes[severity] || 'secondary'
  }

  if (loading) {
    return (
      <AdminLayout title="Security Dashboard">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Security Dashboard">
      {/* Stats Cards */}
      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <div className="card border-0 bg-danger bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Active Alerts</h6>
                  <h2 className="mb-0 fw-bold text-danger">{stats.totalAlerts}</h2>
                </div>
                <i className="bi bi-shield-exclamation fs-1 text-danger"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-warning bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">High Severity</h6>
                  <h2 className="mb-0 fw-bold text-warning">{stats.highSeverity}</h2>
                </div>
                <i className="bi bi-exclamation-triangle fs-1 text-warning"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-info bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Failed Attempts</h6>
                  <h2 className="mb-0 fw-bold text-info">{failedAttempts.length}</h2>
                </div>
                <i className="bi bi-key fs-1 text-info"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-secondary bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Blocked IPs</h6>
                  <h2 className="mb-0 fw-bold">{stats.blockedIPs}</h2>
                </div>
                <i className="bi bi-slash-circle fs-1 text-secondary"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Security Alerts */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-shield-exclamation me-2 text-danger"></i>
                Security Alerts
              </h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="bg-light">
                    <tr>
                      <th>Type</th>
                      <th>Message</th>
                      <th>Severity</th>
                      <th>Time</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityAlerts.map(alert => (
                      <tr key={alert.alert_id}>
                        <td><code>{alert.alert_type}</code></td>
                        <td>{alert.alert_message}</td>
                        <td>
                          <span className={`badge bg-${getSeverityClass(alert.severity_level)}`}>
                            {alert.severity_level}
                          </span>
                        </td>
                        <td>{new Date(alert.created_at).toLocaleString()}</td>
                        <td>
                          {!alert.resolved && (
                            <button 
                              className="btn btn-sm btn-outline-success"
                              onClick={() => resolveAlert(alert.alert_id)}
                            >
                              <i className="bi bi-check-lg"></i>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Failed Login Attempts */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-key me-2 text-warning"></i>
                Failed Login Attempts
              </h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="bg-light">
                    <tr>
                      <th>Email</th>
                      <th>IP Address</th>
                      <th>Reason</th>
                      <th>Time</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedAttempts.map(attempt => (
                      <tr key={attempt.attempt_id}>
                        <td>{attempt.email}</td>
                        <td><code>{attempt.ip_address}</code></td>
                        <td>{attempt.failure_reason}</td>
                        <td>{new Date(attempt.attempt_time).toLocaleString()}</td>
                        <td>
                          <button 
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => blockIP(attempt.ip_address)}
                          >
                            <i className="bi bi-ban"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Blacklisted IPs */}
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-slash-circle me-2 text-danger"></i>
                Blacklisted IP Addresses
              </h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="bg-light">
                    <tr>
                      <th>IP Address</th>
                      <th>Blocked Reason</th>
                      <th>Blocked At</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {blacklistedIPs.map(ip => (
                      <tr key={ip.blacklist_id}>
                        <td><code>{ip.ip_address}</code></td>
                        <td>{ip.blocked_reason || 'Suspicious activity detected'}</td>
                        <td>{new Date(ip.blocked_at).toLocaleString()}</td>
                        <td>
                          <button 
                            className="btn btn-sm btn-outline-success"
                            onClick={() => unblockIP(ip.blacklist_id)}
                          >
                            <i className="bi bi-unlock"></i> Unblock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}