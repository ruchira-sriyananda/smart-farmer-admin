import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function SecurityDashboard() {
  const [securityAlerts, setSecurityAlerts] = useState([])
  const [failedAttempts, setFailedAttempts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSecurityData()
  }, [])

  const fetchSecurityData = async () => {
    try {
      const [alertsRes, attemptsRes] = await Promise.all([
        supabase.from('security_alerts').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('failed_login_attempts').select('*').order('attempt_time', { ascending: false }).limit(10)
      ])

      if (!alertsRes.error) setSecurityAlerts(alertsRes.data)
      if (!attemptsRes.error) setFailedAttempts(attemptsRes.data)
    } catch (err) {
      console.error('Error fetching security data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityClass = (severity) => {
    const classes = {
      'HIGH': 'danger',
      'MEDIUM': 'warning',
      'LOW': 'info'
    }
    return classes[severity] || 'secondary'
  }

  return (
    <AdminLayout title="Security Dashboard">
      <div className="row g-4">
        {/* Security Stats */}
        <div className="col-md-3">
          <div className="card border-0 bg-danger bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h6 className="text-muted">Active Alerts</h6>
                  <h2 className="mb-0 fw-bold text-danger">{securityAlerts.filter(a => !a.resolved).length}</h2>
                </div>
                <i className="bi bi-shield-exclamation fs-1 text-danger"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-warning bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h6 className="text-muted">Failed Logins.</h6>
                  <h2 className="mb-0 fw-bold text-warning">{failedAttempts.length}</h2>
                </div>
                <i className="bi bi-shield-lock fs-1 text-warning"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-success bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h6 className="text-muted">System Status</h6>
                  <h2 className="mb-0 fw-bold text-success">Secure</h2>
                </div>
                <i className="bi bi-shield-check fs-1 text-success"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-primary bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h6 className="text-muted">Encryption</h6>
                  <h2 className="mb-0 fw-bold text-primary">AES-256</h2>
                </div>
                <i className="bi bi-lock fs-1 text-primary"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Security Alerts Table */}
        <div className="col-12">
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
                      <th>IP Address</th>
                      <th>Time</th>
                      <th>Status</th>
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
                        <td>{alert.detected_ip}</td>
                        <td>{new Date(alert.created_at).toLocaleString()}</td>
                        <td>
                          {alert.resolved ? 
                            <span className="badge bg-success">Resolved</span> : 
                            <span className="badge bg-warning">Active</span>
                          }
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
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pt-4">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-exclamation-triangle me-2 text-warning"></i>
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
                      <th>Attempt Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedAttempts.map(attempt => (
                      <tr key={attempt.attempt_id}>
                        <td>{attempt.email}</td>
                        <td><code>{attempt.ip_address}</code></td>
                        <td>{attempt.failure_reason}</td>
                        <td>{new Date(attempt.attempt_time).toLocaleString()}</td>
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