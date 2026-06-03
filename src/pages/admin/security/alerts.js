import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function SecurityAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    resolved: 0,
    pending: 0,
    high: 0,
    medium: 0,
    low: 0
  })

  useEffect(() => {
    fetchAlerts()
    
    const subscription = supabase
      .channel('alerts_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'security_alerts' },
        () => fetchAlerts()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [severityFilter, statusFilter, dateRange])

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false })

      if (severityFilter !== 'all') {
        query = query.eq('severity_level', severityFilter)
      }
      
      if (statusFilter !== 'all') {
        query = query.eq('resolved', statusFilter === 'resolved')
      }
      
      if (dateRange !== 'all') {
        const now = new Date()
        let startDate = new Date()
        
        switch(dateRange) {
          case 'today':
            startDate.setHours(0, 0, 0, 0)
            break
          case 'week':
            startDate.setDate(startDate.getDate() - 7)
            break
          case 'month':
            startDate.setMonth(startDate.getMonth() - 1)
            break
        }
        
        query = query.gte('created_at', startDate.toISOString())
      }

      const { data, error } = await query

      if (!error && data) {
        setAlerts(data)
        calculateStats(data)
      }
    } catch (err) {
      console.error('Error fetching alerts:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (alertsData) => {
    setStats({
      total: alertsData.length,
      resolved: alertsData.filter(a => a.resolved).length,
      pending: alertsData.filter(a => !a.resolved).length,
      high: alertsData.filter(a => a.severity_level === 'HIGH' && !a.resolved).length,
      medium: alertsData.filter(a => a.severity_level === 'MEDIUM' && !a.resolved).length,
      low: alertsData.filter(a => a.severity_level === 'LOW' && !a.resolved).length
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
      fetchAlerts()
      setShowDetailsModal(false)
      setSelectedAlert(null)
    }
    setActionLoading(false)
  }

  const viewAlertDetails = (alert) => {
    setSelectedAlert(alert)
    setShowDetailsModal(true)
  }

  const getSeverityClass = (severity) => {
    const classes = { 'HIGH': 'danger', 'MEDIUM': 'warning', 'LOW': 'info' }
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
      <AdminLayout title="Security Alerts">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading security alerts...</p>
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
    <AdminLayout title="Security Alerts">
      <div className="alerts-container">
        {/* Header */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="bi bi-shield-exclamation"></i>
            </div>
            <div>
              <h1 className="header-title">Security Alerts</h1>
              <p className="header-subtitle">Monitor and manage security incidents</p>
            </div>
          </div>
          <button className="refresh-btn" onClick={fetchAlerts}>
            <i className="bi bi-arrow-repeat"></i> Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-icon"><i className="bi bi-shield-exclamation"></i></div>
            <div className="stat-info">
              <span className="stat-label">Total Alerts</span>
              <h2 className="stat-value">{stats.total}</h2>
            </div>
          </div>
          <div className="stat-card pending">
            <div className="stat-icon"><i className="bi bi-clock-history"></i></div>
            <div className="stat-info">
              <span className="stat-label">Pending</span>
              <h2 className="stat-value text-warning">{stats.pending}</h2>
            </div>
          </div>
          <div className="stat-card resolved">
            <div className="stat-icon"><i className="bi bi-check-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Resolved</span>
              <h2 className="stat-value text-success">{stats.resolved}</h2>
            </div>
          </div>
          <div className="stat-card high">
            <div className="stat-icon"><i className="bi bi-exclamation-triangle"></i></div>
            <div className="stat-info">
              <span className="stat-label">High Severity</span>
              <h2 className="stat-value text-danger">{stats.high}</h2>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-card">
          <div className="filters-header">
            <i className="bi bi-funnel-fill"></i>
            <span>Filters</span>
          </div>
          <div className="filters-body">
            <div className="filter-group">
              <label className="filter-label">Severity</label>
              <select className="filter-select" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                <option value="all">All Severities</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Status</label>
              <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Date Range</label>
              <select className="filter-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
            <button className="reset-filters" onClick={() => {
              setSeverityFilter('all')
              setStatusFilter('all')
              setDateRange('all')
            }}>
              <i className="bi bi-arrow-repeat"></i> Reset
            </button>
          </div>
        </div>

        {/* Alerts Grid */}
        <div className="alerts-grid">
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <div key={alert.alert_id} className={`alert-card ${alert.resolved ? 'resolved' : ''}`}>
                <div className="alert-card-header">
                  <div className={`alert-severity severity-${getSeverityClass(alert.severity_level)}`}>
                    <i className={`bi ${getSeverityIcon(alert.severity_level)}`}></i>
                    {alert.severity_level}
                  </div>
                  <div className="alert-status">
                    {alert.resolved ? (
                      <span className="status-resolved"><i className="bi bi-check-circle-fill"></i> Resolved</span>
                    ) : (
                      <span className="status-pending"><i className="bi bi-clock"></i> Pending</span>
                    )}
                  </div>
                </div>
                
                <div className="alert-card-body">
                  <div className="alert-type">
                    <code>{alert.alert_type}</code>
                  </div>
                  <div className="alert-message">{alert.alert_message}</div>
                  <div className="alert-meta">
                    <div className="meta-time">
                      <i className="bi bi-calendar3"></i>
                      {new Date(alert.created_at).toLocaleString()}
                    </div>
                    {alert.detected_ip && (
                      <div className="meta-ip">
                        <i className="bi bi-ip"></i>
                        {alert.detected_ip}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="alert-card-footer">
                  {!alert.resolved ? (
                    <div className="action-buttons">
                      <button className="btn-resolve" onClick={() => resolveAlert(alert.alert_id)} disabled={actionLoading}>
                        <i className="bi bi-check-lg"></i> Resolve
                      </button>
                      <button className="btn-details" onClick={() => viewAlertDetails(alert)}>
                        <i className="bi bi-eye"></i> Details
                      </button>
                    </div>
                  ) : (
                    <div className="resolved-info">
                      <i className="bi bi-person-check"></i>
                      Resolved at {new Date(alert.resolved_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <i className="bi bi-shield-check"></i>
              <h4>No Security Alerts</h4>
              <p>No alerts found matching your criteria</p>
            </div>
          )}
        </div>
      </div>

      {/* Alert Details Modal */}
      {showDetailsModal && selectedAlert && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-header ${getSeverityClass(selectedAlert.severity_level)}`}>
              <div className="modal-icon">
                <i className={`bi ${getSeverityIcon(selectedAlert.severity_level)}`}></i>
              </div>
              <h3>Alert Details</h3>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="details-section">
                <div className="detail-row">
                  <span className="detail-label">Alert ID</span>
                  <span className="detail-value">{selectedAlert.alert_id}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Type</span>
                  <span className="detail-value">{selectedAlert.alert_type}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Severity</span>
                  <span className={`detail-value severity-${getSeverityClass(selectedAlert.severity_level)}`}>
                    {selectedAlert.severity_level}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Message</span>
                  <span className="detail-value">{selectedAlert.alert_message}</span>
                </div>
                {selectedAlert.detected_ip && (
                  <div className="detail-row">
                    <span className="detail-label">Source IP</span>
                    <span className="detail-value">{selectedAlert.detected_ip}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Created At</span>
                  <span className="detail-value">{new Date(selectedAlert.created_at).toLocaleString()}</span>
                </div>
                {selectedAlert.resolved_at && (
                  <div className="detail-row">
                    <span className="detail-label">Resolved At</span>
                    <span className="detail-value">{new Date(selectedAlert.resolved_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
              
              {!selectedAlert.resolved && (
                <div className="warning-message">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  This alert requires your attention. Resolve it after investigating the issue.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
              {!selectedAlert.resolved && (
                <button className="btn-primary" onClick={() => resolveAlert(selectedAlert.alert_id)} disabled={actionLoading}>
                  {actionLoading ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span>Resolving...</>
                  ) : (
                    'Resolve Alert'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .alerts-container {
          max-width: 1400px;
          margin: 0 auto;
        }

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
          grid-template-columns: repeat(4, 1fr);
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
        .stat-card.pending .stat-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .stat-card.resolved .stat-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-card.high .stat-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

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

        .text-warning { color: #f59e0b; }
        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }

        .filters-card {
          background: white;
          border-radius: 20px;
          margin-bottom: 24px;
          overflow: hidden;
        }

        .filters-header {
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          font-weight: 600;
          color: #1f2937;
        }

        .filters-header i {
          margin-right: 8px;
          color: #4f46e5;
        }

        .filters-body {
          padding: 20px;
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          align-items: flex-end;
        }

        .filter-group {
          flex: 1;
          min-width: 150px;
        }

        .filter-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #6c757d;
          margin-bottom: 6px;
        }

        .filter-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          font-size: 14px;
        }

        .reset-filters {
          padding: 10px 16px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          color: #6c757d;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .reset-filters:hover {
          background: #e9ecef;
        }

        .alerts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
        }

        .alert-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .alert-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .alert-card.resolved {
          opacity: 0.7;
          background: #f8f9fa;
        }

        .alert-card-header {
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .alert-severity {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .severity-danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .severity-warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .severity-info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

        .status-resolved, .status-pending {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
        }

        .status-resolved { color: #10b981; }
        .status-pending { color: #f59e0b; }

        .alert-card-body {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
        }

        .alert-type {
          font-family: monospace;
          font-size: 12px;
          background: #e9ecef;
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          margin-bottom: 12px;
        }

        .alert-message {
          font-size: 14px;
          color: #1f2937;
          margin-bottom: 12px;
          line-height: 1.5;
        }

        .alert-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #9ca3af;
        }

        .alert-card-footer {
          padding: 16px 20px;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .btn-resolve, .btn-details {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-resolve {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .btn-resolve:hover {
          background: #10b981;
          color: white;
        }

        .btn-details {
          background: rgba(79, 70, 229, 0.1);
          color: #4f46e5;
        }

        .btn-details:hover {
          background: #4f46e5;
          color: white;
        }

        .resolved-info {
          text-align: center;
          font-size: 11px;
          color: #6c757d;
        }

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 24px;
          grid-column: span 2;
        }

        .empty-state i {
          font-size: 64px;
          color: #cbd5e1;
          margin-bottom: 16px;
          display: block;
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
          max-width: 550px;
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
        .modal-header.warning .modal-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .modal-header.info .modal-icon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

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

        .details-section {
          margin-bottom: 20px;
        }

        .detail-row {
          display: flex;
          margin-bottom: 12px;
          font-size: 13px;
        }

        .detail-label {
          width: 100px;
          font-weight: 600;
          color: #6c757d;
        }

        .detail-value {
          flex: 1;
          color: #1f2937;
        }

        .warning-message {
          background: #fef3c7;
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #856404;
          margin-top: 16px;
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
          background: #4f46e5;
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

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

        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .alerts-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          .filters-body {
            flex-direction: column;
            align-items: stretch;
          }
          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .detail-row {
            flex-direction: column;
            gap: 4px;
          }
          .detail-label {
            width: auto;
          }
        }
      `}</style>
    </AdminLayout>
  )
}