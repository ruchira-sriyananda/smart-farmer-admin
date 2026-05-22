import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function SecurityAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')

  useEffect(() => {
    fetchAlerts()
    
    // Real-time subscription for new alerts
    const subscription = supabase
      .channel('alerts_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'security_alerts' },
        () => fetchAlerts()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [])

  const fetchAlerts = async () => {
    try {
      let query = supabase
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false })

      if (severityFilter !== 'all') {
        query = query.eq('severity_level', severityFilter)
      }

      const { data, error } = await query

      if (!error && data) {
        setAlerts(data)
      }
    } catch (err) {
      console.error('Error fetching alerts:', err)
    } finally {
      setLoading(false)
    }
  }

  const resolveAlert = async (alertId) => {
    const { error } = await supabase
      .from('security_alerts')
      .update({ 
        resolved: true, 
        resolved_at: new Date().toISOString() 
      })
      .eq('alert_id', alertId)

    if (!error) fetchAlerts()
  }

  const getSeverityClass = (severity) => {
    const classes = { 'HIGH': 'danger', 'MEDIUM': 'warning', 'LOW': 'info' }
    return classes[severity] || 'secondary'
  }

  if (loading) {
    return (
      <AdminLayout title="Security Alerts">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Security Alerts">
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <select className="form-select" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                <option value="all">All Severities</option>
                <option value="HIGH">High Severity</option>
                <option value="MEDIUM">Medium Severity</option>
                <option value="LOW">Low Severity</option>
              </select>
            </div>
            <div className="col-md-8 text-end">
              <button className="btn btn-primary btn-sm" onClick={fetchAlerts}>
                <i className="bi bi-arrow-repeat me-1"></i>Refresh
              </button>
            </div>
          </div>

          <div className="row g-4">
            {alerts.map(alert => (
              <div className="col-12" key={alert.alert_id}>
                <div className={`card border-start border-4 border-${getSeverityClass(alert.severity_level)} shadow-sm`}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="d-flex gap-3">
                        <div className={`bg-${getSeverityClass(alert.severity_level)} bg-opacity-10 rounded-circle p-2`}>
                          <i className={`bi bi-shield-exclamation text-${getSeverityClass(alert.severity_level)} fs-4`}></i>
                        </div>
                        <div>
                          <h6 className="mb-1">{alert.alert_type}</h6>
                          <p className="mb-1 text-muted">{alert.alert_message}</p>
                          <small className="text-muted">
                            <i className="bi bi-clock me-1"></i>
                            {new Date(alert.created_at).toLocaleString()}
                            {alert.detected_ip && (
                              <> • <i className="bi bi-ip me-1"></i>{alert.detected_ip}</>
                            )}
                          </small>
                        </div>
                      </div>
                      <div className="text-end">
                        <span className={`badge bg-${getSeverityClass(alert.severity_level)} mb-2`}>
                          {alert.severity_level}
                        </span>
                        {!alert.resolved && (
                          <button 
                            className="btn btn-sm btn-outline-success d-block mt-2"
                            onClick={() => resolveAlert(alert.alert_id)}
                          >
                            <i className="bi bi-check-lg me-1"></i>Resolve
                          </button>
                        )}
                        {alert.resolved && (
                          <span className="badge bg-success mt-2">Resolved</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {alerts.length === 0 && (
              <div className="col-12 text-center py-5">
                <i className="bi bi-shield-check text-success fs-1"></i>
                <p className="text-muted mt-3 mb-0">No security alerts found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}