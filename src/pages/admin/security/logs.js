import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function ActivityLogs() {
  const router = useRouter()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    uniqueIPs: 0,
    mostActive: '',
    last24h: 0,
    byType: {}
  })
  const [selectedLog, setSelectedLog] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [adminUsersMap, setAdminUsersMap] = useState({})

  useEffect(() => {
    fetchLogs()
    
    const subscription = supabase
      .channel('logs_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_activity_logs' },
        (payload) => {
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
      .select('*')
      .eq('log_id', logId)
      .single()

    if (!error && data) {
      if (data.admin_id) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('full_name, email')
          .eq('admin_id', data.admin_id)
          .single()
        
        data.admin_user = adminUser
      }
      
      setLogs(prev => [data, ...prev.slice(0, 99)])
      calculateStats([data, ...logs])
    }
  }

  const fetchLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { count, error: countError } = await supabase
        .from('admin_activity_logs')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.error('Count error:', countError)
        setError(`Database error: ${countError.message}`)
        setLoading(false)
        return
      }

      if (count === 0) {
        setError('No activity logs found.')
        setLoading(false)
        return
      }

      const { data: logsData, error: logsError } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (logsError) {
        console.error('Fetch error:', logsError)
        setError(`Error fetching logs: ${logsError.message}`)
        return
      }

      if (logsData && logsData.length > 0) {
        const adminIds = [...new Set(logsData.map(log => log.admin_id).filter(id => id))]
        
        let adminUsersMap = {}
        if (adminIds.length > 0) {
          const { data: adminUsers, error: adminError } = await supabase
            .from('admin_users')
            .select('admin_id, full_name, email')
            .in('admin_id', adminIds)

          if (!adminError && adminUsers) {
            adminUsersMap = adminUsers.reduce((acc, user) => {
              acc[user.admin_id] = user
              return acc
            }, {})
          }
        }
        
        setAdminUsersMap(adminUsersMap)
        
        const logsWithUsers = logsData.map(log => ({
          ...log,
          admin_users: adminUsersMap[log.admin_id] || null
        }))
        
        setLogs(logsWithUsers)
        calculateStats(logsWithUsers)
      } else {
        setLogs([])
        setError('No activity logs found')
      }
    } catch (err) {
      console.error('Error fetching logs:', err)
      setError(err.message)
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

    const adminActivity = {}
    logsData.forEach(log => {
      const name = log.admin_users?.full_name || 'System'
      adminActivity[name] = (adminActivity[name] || 0) + 1
    })
    const mostActive = Object.entries(adminActivity).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'

    const byType = {}
    logsData.forEach(log => {
      const type = log.activity_type || 'OTHER'
      byType[type] = (byType[type] || 0) + 1
    })

    setStats({
      total: logsData.length,
      uniqueIPs: uniqueIPs.size,
      mostActive: mostActive,
      last24h: last24h,
      byType: byType
    })
  }

  const getDateRangeFilter = (logsData) => {
    const now = new Date()
    switch(dateRange) {
      case 'today':
        return logsData.filter(l => new Date(l.created_at).toDateString() === now.toDateString())
      case 'week':
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return logsData.filter(l => new Date(l.created_at) >= weekAgo)
      case 'month':
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        return logsData.filter(l => new Date(l.created_at) >= monthAgo)
      default:
        return logsData
    }
  }

  const filteredLogs = getDateRangeFilter(logs.filter(log => {
    const matchesFilter = filter === 'all' || log.activity_type === filter
    const matchesSearch = log.activity_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.admin_users?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.ip_address?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  }))

  const getActivityIcon = (type) => {
    const icons = {
      'LOGIN': 'bi-box-arrow-in-right',
      'LOGOUT': 'bi-box-arrow-right',
      'USER_MANAGEMENT': 'bi-people',
      'CONTENT_MODERATION': 'bi-file-post',
      'REPORT_HANDLING': 'bi-flag',
      'SECURITY_ALERT': 'bi-shield-exclamation',
      'PASSWORD_CHANGE': 'bi-key',
      'SETTINGS_UPDATE': 'bi-gear',
      'PROFILE_UPDATE': 'bi-person-gear'
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
      'SETTINGS_UPDATE': 'secondary',
      'PROFILE_UPDATE': 'primary'
    }
    return colors[type] || 'secondary'
  }

  const getActivityLabel = (type) => {
    const labels = {
      'LOGIN': 'Login',
      'LOGOUT': 'Logout',
      'USER_MANAGEMENT': 'User Management',
      'CONTENT_MODERATION': 'Content Moderation',
      'REPORT_HANDLING': 'Report Handling',
      'SECURITY_ALERT': 'Security Alert',
      'PASSWORD_CHANGE': 'Password Change',
      'SETTINGS_UPDATE': 'Settings Update',
      'PROFILE_UPDATE': 'Profile Update'
    }
    return labels[type] || type
  }

  const viewLogDetails = (log) => {
    setSelectedLog(log)
    setShowDetailsModal(true)
  }

  const activityTypes = [...new Set(logs.map(l => l.activity_type))]

  if (loading) {
    return (
      <AdminLayout title="Activity Logs">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading activity logs...</p>
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

  if (error && logs.length === 0) {
    return (
      <AdminLayout title="Activity Logs">
        <div className="error-container">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <h3>No Activity Logs Found</h3>
          <p>{error}</p>
          <button className="retry-btn" onClick={fetchLogs}>
            <i className="bi bi-arrow-repeat"></i> Retry
          </button>
        </div>
        <style jsx>{`
          .error-container {
            text-align: center;
            padding: 60px 20px;
            background: white;
            border-radius: 24px;
            max-width: 500px;
            margin: 40px auto;
          }
          .error-container i {
            font-size: 48px;
            color: #f59e0b;
            margin-bottom: 16px;
          }
          .error-container h3 {
            margin-bottom: 8px;
            color: #1f2937;
          }
          .error-container p {
            color: #6c757d;
            margin-bottom: 24px;
          }
          .retry-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            padding: 10px 24px;
            border-radius: 12px;
            color: white;
            font-weight: 500;
            cursor: pointer;
          }
        `}</style>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Activity Logs">
      <div className="logs-container">
        {/* Header */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="bi bi-activity"></i>
            </div>
            <div>
              <h1 className="header-title">Activity Logs</h1>
              <p className="header-subtitle">Track and monitor all system activities</p>
            </div>
          </div>
          <button className="filter-toggle-btn" onClick={() => setShowFilters(!showFilters)}>
            <i className="bi bi-funnel-fill"></i>
            <span>Filters</span>
            {(filter !== 'all' || searchTerm || dateRange !== 'all') && (
              <span className="active-filter-badge"></span>
            )}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary"><i className="bi bi-database"></i></div>
            <div className="stat-info">
              <span className="stat-label">Total Activities</span>
              <h2 className="stat-value">{stats.total}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon info"><i className="bi bi-ip"></i></div>
            <div className="stat-info">
              <span className="stat-label">Unique IPs</span>
              <h2 className="stat-value">{stats.uniqueIPs}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon success"><i className="bi bi-clock-history"></i></div>
            <div className="stat-info">
              <span className="stat-label">Last 24 Hours</span>
              <h2 className="stat-value">{stats.last24h}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon warning"><i className="bi bi-trophy"></i></div>
            <div className="stat-info">
              <span className="stat-label">Most Active</span>
              <h2 className="stat-value">{stats.mostActive.substring(0, 15)}</h2>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="filters-panel">
            <div className="filters-row">
              <div className="filter-group search-group">
                <i className="bi bi-search"></i>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Search by admin, activity, or IP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button className="clear-btn" onClick={() => setSearchTerm('')}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                )}
              </div>
              <div className="filter-group">
                <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">All Activities</option>
                  {activityTypes.map(type => (
                    <option key={type} value={type}>{getActivityLabel(type)}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <select className="filter-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
              <button className="reset-btn" onClick={() => {
                setSearchTerm('')
                setFilter('all')
                setDateRange('all')
              }}>
                <i className="bi bi-arrow-repeat"></i> Reset
              </button>
            </div>
          </div>
        )}

        {/* Activity Distribution */}
        {Object.keys(stats.byType).length > 0 && (
          <div className="distribution-card">
            <div className="distribution-header">
              <h5><i className="bi bi-pie-chart"></i> Activity Distribution</h5>
            </div>
            <div className="distribution-tags">
              {Object.entries(stats.byType).map(([type, count]) => (
                <button 
                  key={type} 
                  className={`dist-tag ${getActivityColor(type)}`}
                  onClick={() => setFilter(type)}
                >
                  <i className={`bi ${getActivityIcon(type)}`}></i>
                  <span>{getActivityLabel(type)}</span>
                  <span className="dist-count">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Logs Table */}
        <div className="logs-table-container">
          <div className="table-header">
            <span className="result-count">
              <i className="bi bi-table"></i>
              {filteredLogs.length} of {logs.length} logs
            </span>
            <button className="refresh-table-btn" onClick={fetchLogs}>
              <i className="bi bi-arrow-repeat"></i> Refresh
            </button>
          </div>
          
          <div className="table-responsive">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Admin</th>
                  <th>Activity Type</th>
                  <th>Description</th>
                  <th>IP Address</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.log_id} className="log-row">
                    <td className="time-cell">
                      <div className="time-wrapper">
                        <i className="bi bi-calendar3"></i>
                        <span>{new Date(log.created_at).toLocaleDateString()}</span>
                        <i className="bi bi-clock ms-2"></i>
                        <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="admin-cell">
                      <div className="admin-wrapper">
                        <div className="admin-avatar">
                          {log.admin_users?.full_name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <div className="admin-name">{log.admin_users?.full_name || 'System'}</div>
                          <div className="admin-email">{log.admin_users?.email || 'system@smartfarmer.com'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`activity-badge ${getActivityColor(log.activity_type)}`}>
                        <i className={`bi ${getActivityIcon(log.activity_type)}`}></i>
                        {getActivityLabel(log.activity_type)}
                      </span>
                    </td>
                    <td className="description-cell">
                      <span className="description-text">{log.activity_description}</span>
                    </td>
                    <td>
                      {log.ip_address && log.ip_address !== 'unknown' && log.ip_address !== 'N/A' ? (
                        <code className="ip-code">
                          <i className="bi bi-wifi"></i>
                          {log.ip_address}
                        </code>
                      ) : (
                        <span className="no-ip">
                          <i className="bi bi-question-circle"></i>
                          Not recorded
                        </span>
                      )}
                    </td>
                    <td>
                      <button 
                        className="view-details-btn"
                        onClick={() => viewLogDetails(log)}
                        title="View Details"
                      >
                        <i className="bi bi-eye"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredLogs.length === 0 && logs.length > 0 && (
            <div className="empty-state">
              <i className="bi bi-search"></i>
              <h4>No matching logs</h4>
              <p>Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>
      </div>

      {/* Log Details Modal */}
      {showDetailsModal && selectedLog && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className={`modal-icon ${getActivityColor(selectedLog.activity_type)}`}>
                <i className={`bi ${getActivityIcon(selectedLog.activity_type)}`}></i>
              </div>
              <h3>Activity Details</h3>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="details-section">
                <div className="detail-row">
                  <span className="detail-label">Activity Type</span>
                  <span className={`detail-value ${getActivityColor(selectedLog.activity_type)}`}>
                    <i className={`bi ${getActivityIcon(selectedLog.activity_type)}`}></i>
                    {getActivityLabel(selectedLog.activity_type)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Description</span>
                  <span className="detail-value">{selectedLog.activity_description}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Admin</span>
                  <span className="detail-value">
                    <strong>{selectedLog.admin_users?.full_name || 'System'}</strong>
                    <div className="detail-sub">{selectedLog.admin_users?.email}</div>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Date & Time</span>
                  <span className="detail-value">{new Date(selectedLog.created_at).toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">IP Address</span>
                  <span className="detail-value">
                    <code>{selectedLog.ip_address || 'Not recorded'}</code>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Log ID</span>
                  <span className="detail-value">
                    <code>{selectedLog.log_id}</code>
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .logs-container {
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

        .filter-toggle-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          color: #495057;
          font-weight: 500;
          position: relative;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .filter-toggle-btn:hover {
          background: #e9ecef;
        }

        .active-filter-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 10px;
          height: 10px;
          background: #4f46e5;
          border-radius: 50%;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 24px;
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
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        }

        .stat-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon.primary { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .stat-icon.info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .stat-icon.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .stat-icon.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }

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
          font-size: 24px;
          font-weight: 700;
          margin: 0;
          color: #1f2937;
        }

        .filters-panel {
          background: white;
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .filters-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          align-items: flex-end;
        }

        .filter-group {
          flex: 1;
          min-width: 180px;
        }

        .search-group {
          position: relative;
          flex: 2;
        }

        .search-group i {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .filter-input {
          width: 100%;
          padding: 10px 12px 10px 38px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .filter-input:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }

        .clear-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
        }

        .filter-select {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 14px;
        }

        .reset-btn {
          padding: 10px 16px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          color: #6c757d;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .reset-btn:hover {
          background: #e9ecef;
        }

        .distribution-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .distribution-header h5 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .distribution-header h5 i {
          margin-right: 8px;
          color: #4f46e5;
        }

        .distribution-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .dist-tag {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .dist-tag:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .dist-tag.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .dist-tag.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .dist-tag.primary { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .dist-tag.info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .dist-tag.danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .dist-tag.secondary { background: rgba(107, 114, 128, 0.1); color: #6c757d; }

        .dist-count {
          background: rgba(0, 0, 0, 0.1);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
        }

        .logs-table-container {
          background: white;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
          background: #fafbfc;
        }

        .result-count {
          font-size: 13px;
          color: #6c757d;
        }

        .result-count i {
          margin-right: 6px;
        }

        .refresh-table-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          font-size: 12px;
          color: #495057;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .refresh-table-btn:hover {
          background: #e9ecef;
        }

        .logs-table {
          width: 100%;
          border-collapse: collapse;
        }

        .logs-table th {
          text-align: left;
          padding: 16px 20px;
          background: #f8f9fa;
          font-weight: 600;
          font-size: 13px;
          color: #495057;
          border-bottom: 1px solid #e9ecef;
        }

        .logs-table td {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
          vertical-align: middle;
        }

        .log-row:hover {
          background: #fafbfc;
        }

        .time-wrapper {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          font-size: 13px;
          color: #6c757d;
        }

        .time-wrapper i {
          font-size: 12px;
        }

        .admin-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .admin-avatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 16px;
        }

        .admin-name {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
        }

        .admin-email {
          font-size: 11px;
          color: #6c757d;
        }

        .activity-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .activity-badge.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .activity-badge.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .activity-badge.primary { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .activity-badge.info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .activity-badge.danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .activity-badge.secondary { background: rgba(107, 114, 128, 0.1); color: #6c757d; }

        .description-cell {
          max-width: 350px;
        }

        .description-text {
          display: block;
          font-size: 13px;
          color: #4b5563;
          line-height: 1.4;
        }

        .ip-code {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f8f9fa;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12px;
          color: #1f2937;
        }

        .no-ip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #9ca3af;
        }

        .view-details-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(79, 70, 229, 0.1);
          border: none;
          color: #4f46e5;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .view-details-btn:hover {
          background: #4f46e5;
          color: white;
          transform: translateY(-2px);
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-state i {
          font-size: 48px;
          color: #cbd5e1;
          margin-bottom: 16px;
          display: block;
        }

        .empty-state h4 {
          margin: 0 0 8px 0;
          color: #64748b;
        }

        .empty-state p {
          margin: 0;
          color: #94a3b8;
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
          border-bottom: 1px solid #e9ecef;
        }

        .modal-icon {
          width: 48px;
          height: 48px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-icon.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .modal-icon.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .modal-icon.primary { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .modal-icon.info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .modal-icon.danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

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
          padding: 20px 24px;
        }

        .details-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .detail-row {
          display: flex;
          padding: 8px 0;
          border-bottom: 1px solid #f1f3f5;
        }

        .detail-label {
          width: 110px;
          font-size: 12px;
          font-weight: 600;
          color: #6c757d;
        }

        .detail-value {
          flex: 1;
          font-size: 13px;
          color: #1f2937;
        }

        .detail-sub {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 2px;
        }

        .modal-footer {
          padding: 16px 24px 24px;
          display: flex;
          justify-content: flex-end;
          border-top: 1px solid #e9ecef;
        }

        .btn-secondary {
          padding: 10px 24px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
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
          .filters-row {
            flex-direction: column;
          }
          .filter-group {
            width: 100%;
          }
          .detail-row {
            flex-direction: column;
            gap: 4px;
          }
          .detail-label {
            width: auto;
          }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          .logs-table {
            display: block;
            overflow-x: auto;
          }
          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </AdminLayout>
  )
}