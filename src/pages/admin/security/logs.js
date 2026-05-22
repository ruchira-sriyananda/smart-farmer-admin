import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function ActivityLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    uniqueIPs: 0,
    mostActive: '',
    last24h: 0
  })

  useEffect(() => {
    fetchLogs()
    
    // Real-time subscription for new logs
    const subscription = supabase
      .channel('logs_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_activity_logs' },
        (payload) => {
          // Fetch complete log with admin details
          fetchLogDetails(payload.new.log_id)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchLogDetails = async (logId) => {
    const { data, error } = await supabase
      .from('admin_activity_logs')
      .select(`
        *,
        admin_users (
          full_name,
          email
        )
      `)
      .eq('log_id', logId)
      .single()

    if (!error && data) {
      setLogs(prev => [data, ...prev.slice(0, 99)])
      calculateStats([data, ...logs])
    }
  }

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select(`
          *,
          admin_users (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (!error && data) {
        setLogs(data)
        calculateStats(data)
      }
    } catch (err) {
      console.error('Error fetching logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (logsData) => {
    const uniqueIPs = new Set(logsData.map(l => l.ip_address).filter(ip => ip && ip !== 'unknown'))
    const last24h = logsData.filter(l => {
      const date = new Date(l.created_at)
      const now = new Date()
      const diffHours = (now - date) / (1000 * 60 * 60)
      return diffHours <= 24
    }).length

    // Find most active admin
    const adminActivity = {}
    logsData.forEach(log => {
      const name = log.admin_users?.full_name || 'System'
      adminActivity[name] = (adminActivity[name] || 0) + 1
    })
    const mostActive = Object.entries(adminActivity).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'

    setStats({
      total: logsData.length,
      uniqueIPs: uniqueIPs.size,
      mostActive: mostActive,
      last24h: last24h
    })
  }

  const getActivityIcon = (type) => {
    const icons = {
      'LOGIN': 'bi-box-arrow-in-right',
      'LOGOUT': 'bi-box-arrow-right',
      'USER_MANAGEMENT': 'bi-people',
      'CONTENT_MODERATION': 'bi-file-post',
      'REPORT_HANDLING': 'bi-flag',
      'SECURITY_ALERT': 'bi-shield-exclamation',
      'PASSWORD_CHANGE': 'bi-key',
      'SETTINGS_UPDATE': 'bi-gear'
    }
    return icons[type] || 'bi-activity'
  }

  const getActivityColor = (type) => {
    const colors = {
      'LOGIN': 'success',
      'LOGOUT': 'warning',
      'USER_MANAGEMENT': 'primary',
      'CONTENT_MODERATION': 'info',
      'REPORT_HANDLING': 'danger',
      'SECURITY_ALERT': 'danger',
      'PASSWORD_CHANGE': 'warning',
      'SETTINGS_UPDATE': 'secondary'
    }
    return colors[type] || 'secondary'
  }

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.activity_type === filter
    const matchesSearch = log.activity_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.admin_users?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.ip_address?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const activityTypes = [...new Set(logs.map(l => l.activity_type))]

  if (loading) {
    return (
      <AdminLayout title="Activity Logs">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Activity Logs">
      {/* Stats Cards */}
      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <div className="card border-0 bg-primary bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Total Activities</h6>
                  <h2 className="mb-0 fw-bold">{stats.total}</h2>
                </div>
                <i className="bi bi-activity fs-1 text-primary"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-info bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Unique IPs</h6>
                  <h2 className="mb-0 fw-bold">{stats.uniqueIPs}</h2>
                </div>
                <i className="bi bi-ip fs-1 text-info"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-success bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Last 24 Hours</h6>
                  <h2 className="mb-0 fw-bold">{stats.last24h}</h2>
                </div>
                <i className="bi bi-clock-history fs-1 text-success"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-warning bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Most Active</h6>
                  <h2 className="mb-0 fw-bold fs-5">{stats.mostActive.substring(0, 20)}</h2>
                </div>
                <i className="bi bi-trophy fs-1 text-warning"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-5">
              <div className="input-group">
                <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by admin, activity, or IP address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <select className="form-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All Activity Types</option>
                {activityTypes.map(type => (
                  <option key={type} value={type}>{type.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3 text-end">
              <button className="btn btn-outline-primary btn-sm" onClick={fetchLogs}>
                <i className="bi bi-arrow-repeat me-1"></i>Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="bg-light">
                <tr>
                  <th style={{ width: '160px' }}>Time</th>
                  <th style={{ width: '200px' }}>Admin</th>
                  <th style={{ width: '140px' }}>Activity Type</th>
                  <th>Description</th>
                  <th style={{ width: '140px' }}>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.log_id}>
                    <td>
                      <small className="text-muted">
                        {new Date(log.created_at).toLocaleString()}
                      </small>
                    </td>
                    <td>
                      <div className="d-flex flex-column">
                        <strong className="small">{log.admin_users?.full_name || 'System'}</strong>
                        <small className="text-muted">{log.admin_users?.email || 'system@smartfarmer.com'}</small>
                      </div>
                    </td>
                    <td>
                      <span className={`badge bg-${getActivityColor(log.activity_type)} d-inline-flex align-items-center gap-1`}>
                        <i className={`bi ${getActivityIcon(log.activity_type)}`} style={{ fontSize: '10px' }}></i>
                        {log.activity_type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className="small">{log.activity_description}</span>
                    </td>
                    <td>
                      {log.ip_address && log.ip_address !== 'unknown' && log.ip_address !== 'N/A' ? (
                        <code className="small bg-light px-2 py-1 rounded">
                          <i className="bi bi-wifi me-1"></i>
                          {log.ip_address}
                        </code>
                      ) : (
                        <span className="text-muted small">
                          <i className="bi bi-question-circle me-1"></i>
                          Not recorded
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredLogs.length === 0 && (
            <div className="text-center py-5">
              <i className="bi bi-inbox fs-1 text-muted"></i>
              <p className="text-muted mt-2 mb-0">No activity logs found</p>
              <small className="text-muted">Try adjusting your search or filter</small>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}