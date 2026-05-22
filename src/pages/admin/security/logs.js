import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function ActivityLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchLogs()
    
    // Real-time subscription for new logs
    const subscription = supabase
      .channel('logs_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_activity_logs' },
        (payload) => {
          setLogs(prev => [payload.new, ...prev.slice(0, 99)])
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchLogs = async () => {
    try {
      let query = supabase
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

      const { data, error } = await query

      if (!error && data) {
        setLogs(data)
      }
    } catch (err) {
      console.error('Error fetching logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.activity_type === filter
    const matchesSearch = log.activity_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.admin_users?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <input
                type="text"
                className="form-control"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <select className="form-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All Activities</option>
                {activityTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="col-md-5 text-end">
              <small className="text-muted">
                <i className="bi bi-database me-1"></i>
                {filteredLogs.length} logs found
              </small>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover">
              <thead className="bg-light">
                <tr>
                  <th>Time</th>
                  <th>Admin</th>
                  <th>Activity Type</th>
                  <th>Description</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.log_id}>
                    <td style={{ width: '180px' }}>
                      <small>{new Date(log.created_at).toLocaleString()}</small>
                    </td>
                    <td>
                      <strong>{log.admin_users?.full_name || 'System'}</strong>
                      <br />
                      <small className="text-muted">{log.admin_users?.email}</small>
                    </td>
                    <td>
                      <span className="badge bg-primary">{log.activity_type}</span>
                    </td>
                    <td>{log.activity_description}</td>
                    <td><code>{log.ip_address || 'N/A'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}