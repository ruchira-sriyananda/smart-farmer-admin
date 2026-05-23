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
      // Fetch admin user separately
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
      
      // First, check if table has any records
      const { count, error: countError } = await supabase
        .from('admin_activity_logs')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.error('Count error:', countError)
        setError(`Database error: ${countError.message}`)
        setLoading(false)
        return
      }

      console.log('Total logs count:', count)

      if (count === 0) {
        setError('No activity logs found. Please run the SQL to insert sample logs.')
        setLoading(false)
        return
      }

      // Fetch logs without join first
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
        // Get unique admin IDs
        const adminIds = [...new Set(logsData.map(log => log.admin_id).filter(id => id))]
        
        // Fetch admin users separately
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
        
        // Combine logs with admin users
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
        const weekAgo = new Date(now.setDate(now.getDate() - 7))
        return logsData.filter(l => new Date(l.created_at) >= weekAgo)
      case 'month':
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1))
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
          <div className="error-actions">
            <button className="btn-primary" onClick={fetchLogs}>
              <i className="bi bi-arrow-repeat"></i> Retry
            </button>
            <button className="btn-secondary" onClick={() => router.push('/admin/dashboard')}>
              <i className="bi bi-house"></i> Back to Dashboard
            </button>
          </div>
          <div className="info-box">
            <i className="bi bi-info-circle-fill"></i>
            <div>
              <strong>Need sample data?</strong>
              <p>Run this SQL in Supabase SQL Editor to add sample activity logs:</p>
              <pre>{`-- First, make sure you have an admin user
INSERT INTO admin_activity_logs (log_id, admin_id, activity_type, activity_description, ip_address, created_at)
SELECT 
    uuid_generate_v4(),
    (SELECT admin_id FROM admin_users LIMIT 1),
    'LOGIN',
    'Admin logged in successfully',
    '192.168.1.1',
    NOW()
WHERE EXISTS (SELECT 1 FROM admin_users LIMIT 1);

-- Add more sample logs
INSERT INTO admin_activity_logs (log_id, admin_id, activity_type, activity_description, ip_address, created_at)
SELECT 
    uuid_generate_v4(),
    (SELECT admin_id FROM admin_users LIMIT 1),
    'USER_MANAGEMENT',
    'Updated user profile',
    '192.168.1.1',
    NOW() - INTERVAL '1 hour'
WHERE EXISTS (SELECT 1 FROM admin_users LIMIT 1);

INSERT INTO admin_activity_logs (log_id, admin_id, activity_type, activity_description, ip_address, created_at)
SELECT 
    uuid_generate_v4(),
    (SELECT admin_id FROM admin_users LIMIT 1),
    'SECURITY_ALERT',
    'Failed login attempt detected',
    '203.0.113.1',
    NOW() - INTERVAL '2 hours'
WHERE EXISTS (SELECT 1 FROM admin_users LIMIT 1);`}</pre>
            </div>
          </div>
        </div>
        <style jsx>{`
          .error-container {
            text-align: center;
            padding: 60px 20px;
            background: white;
            border-radius: 24px;
            max-width: 600px;
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
          .error-actions {
            display: flex;
            gap: 12px;
            justify-content: center;
            margin-bottom: 24px;
          }
          .btn-primary {
            padding: 10px 20px;
            background: #4f46e5;
            border: none;
            border-radius: 10px;
            color: white;
            font-weight: 500;
            cursor: pointer;
          }
          .btn-secondary {
            padding: 10px 20px;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 10px;
            color: #495057;
            font-weight: 500;
            cursor: pointer;
          }
          .info-box {
            background: #e7f1ff;
            border-radius: 16px;
            padding: 20px;
            text-align: left;
            display: flex;
            gap: 16px;
          }
          .info-box i {
            font-size: 24px;
            color: #0d6efd;
            margin: 0;
          }
          .info-box pre {
            background: #1f2937;
            color: #10b981;
            padding: 12px;
            border-radius: 8px;
            font-size: 12px;
            margin-top: 8px;
            overflow-x: auto;
          }
        `}</style>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Activity Logs">
      <div className="logs-container">
        {/* Header Section */}
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
          <button className="refresh-btn" onClick={fetchLogs}>
            <i className="bi bi-arrow-repeat"></i>
            <span>Refresh</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary">
              <i className="bi bi-database"></i>
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Activities</span>
              <h2 className="stat-value">{stats.total}</h2>
              <span className="stat-change">All time records</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon info">
              <i className="bi bi-ip"></i>
            </div>
            <div className="stat-info">
              <span className="stat-label">Unique IPs</span>
              <h2 className="stat-value">{stats.uniqueIPs}</h2>
              <span className="stat-change">Different locations</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon success">
              <i className="bi bi-clock-history"></i>
            </div>
            <div className="stat-info">
              <span className="stat-label">Last 24 Hours</span>
              <h2 className="stat-value">{stats.last24h}</h2>
              <span className="stat-change">Recent activity</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon warning">
              <i className="bi bi-trophy"></i>
            </div>
            <div className="stat-info">
              <span className="stat-label">Most Active</span>
              <h2 className="stat-value">{stats.mostActive.substring(0, 15)}</h2>
              <span className="stat-change">Top contributor</span>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="filters-card">
          <div className="filters-header">
            <i className="bi bi-funnel-fill"></i>
            <span>Filters</span>
          </div>
          <div className="filters-body">
            <div className="search-wrapper">
              <i className="bi bi-search"></i>
              <input
                type="text"
                className="search-input"
                placeholder="Search by admin, activity, or IP address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="clear-search" onClick={() => setSearchTerm('')}>
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
            <div className="filter-group">
              <label className="filter-label">Activity Type</label>
              <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All Activities</option>
                {activityTypes.map(type => (
                  <option key={type} value={type}>{getActivityLabel(type)}</option>
                ))}
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
              setSearchTerm('')
              setFilter('all')
              setDateRange('all')
            }}>
              <i className="bi bi-arrow-repeat"></i> Reset
            </button>
          </div>
        </div>

        {/* Activity Type Distribution */}
        {Object.keys(stats.byType).length > 0 && (
          <div className="distribution-card">
            <h5><i className="bi bi-pie-chart"></i> Activity Distribution</h5>
            <div className="distribution-tags">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div 
                  key={type} 
                  className={`dist-tag ${getActivityColor(type)}`}
                  onClick={() => setFilter(type)}
                  style={{ cursor: 'pointer' }}
                >
                  <i className={`bi ${getActivityIcon(type)}`}></i>
                  <span>{getActivityLabel(type)}</span>
                  <span className="dist-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logs Table */}
        <div className="logs-table-container">
          <div className="table-header-info">
            <span className="result-count">
              <i className="bi bi-table"></i>
              Showing {filteredLogs.length} of {logs.length} logs
            </span>
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
              <div className="detail-section">
                <label>Activity Type</label>
                <div className={`detail-value badge-large ${getActivityColor(selectedLog.activity_type)}`}>
                  <i className={`bi ${getActivityIcon(selectedLog.activity_type)}`}></i>
                  {getActivityLabel(selectedLog.activity_type)}
                </div>
              </div>
              <div className="detail-section">
                <label>Description</label>
                <div className="detail-value">{selectedLog.activity_description}</div>
              </div>
              <div className="detail-row">
                <div className="detail-section">
                  <label>Admin User</label>
                  <div className="detail-value">
                    <strong>{selectedLog.admin_users?.full_name || 'System'}</strong>
                    <div className="detail-sub">{selectedLog.admin_users?.email}</div>
                  </div>
                </div>
                <div className="detail-section">
                  <label>Date & Time</label>
                  <div className="detail-value">{new Date(selectedLog.created_at).toLocaleString()}</div>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-section">
                  <label>IP Address</label>
                  <div className="detail-value">
                    <code>{selectedLog.ip_address || 'Not recorded'}</code>
                  </div>
                </div>
                <div className="detail-section">
                  <label>Log ID</label>
                  <div className="detail-value">
                    <code>{selectedLog.log_id}</code>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
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

        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #4f46e5;
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .refresh-btn:hover {
          background: #4338ca;
          transform: translateY(-1px);
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

        .stat-change {
          font-size: 11px;
          color: #9ca3af;
        }

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

        .search-wrapper {
          flex: 2;
          position: relative;
          min-width: 200px;
        }

        .search-wrapper i {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .search-input {
          width: 100%;
          padding: 12px 40px 12px 44px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .search-input:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }

        .clear-search {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
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

        .distribution-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .distribution-card h5 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .distribution-card h5 i {
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

        .table-header-info {
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

        .detail-section {
          margin-bottom: 16px;
        }

        .detail-section label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #6c757d;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .detail-value {
          font-size: 14px;
          color: #1f2937;
        }

        .badge-large {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 13px;
        }

        .detail-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .detail-sub {
          font-size: 12px;
          color: #6c757d;
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
          .filters-body {
            flex-direction: column;
            align-items: stretch;
          }
          .detail-row {
            grid-template-columns: 1fr;
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