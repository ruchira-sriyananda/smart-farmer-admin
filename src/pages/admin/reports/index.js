import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

export default function ReportsManagement() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('PENDING')
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchReports()
  }, [filter])

  const checkAuth = async () => {
    const session = localStorage.getItem('adminSession')
    if (!session) {
      router.push('/admin/login')
    }
  }

  const fetchReports = async () => {
    try {
      let query = supabase
        .from('system_reports')
        .select(`
          *,
          reviewed_by_admin:admin_users!reviewed_by (
            full_name
          )
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'ALL') {
        query = query.eq('report_status', filter)
      }

      const { data, error } = await query

      if (!error && data) {
        setReports(data)
      }
    } catch (err) {
      console.error('Error fetching reports:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateReportStatus = async (reportId, status) => {
    const { error } = await supabase
      .from('system_reports')
      .update({
        report_status: status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: JSON.parse(localStorage.getItem('adminSession'))?.admin?.admin_id
      })
      .eq('report_id', reportId)

    if (!error) {
      fetchReports()
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      'PENDING': <span className="badge bg-warning text-dark">Pending</span>,
      'REVIEWED': <span className="badge bg-info">Reviewed</span>,
      'RESOLVED': <span className="badge bg-success">Resolved</span>,
      'DISMISSED': <span className="badge bg-secondary">Dismissed</span>
    }
    return badges[status] || <span className="badge bg-secondary">{status}</span>
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="spinner-border text-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-vh-100 bg-light">
      {/* Header */}
      <nav className="navbar navbar-dark bg-gradient-primary shadow-sm px-4 py-2">
        <div className="d-flex align-items-center">
          <button className="btn btn-link text-white me-3" onClick={() => router.push('/admin/dashboard')}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h5 className="text-white mb-0">Reports Management</h5>
        </div>
      </nav>

      <div className="container-fluid px-4 py-4">
        {/* Filters */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="btn-group w-100">
              <button className={`btn ${filter === 'ALL' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setFilter('ALL')}>
                All Reports
              </button>
              <button className={`btn ${filter === 'PENDING' ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => setFilter('PENDING')}>
                Pending
              </button>
              <button className={`btn ${filter === 'RESOLVED' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setFilter('RESOLVED')}>
                Resolved
              </button>
            </div>
          </div>
        </div>

        {/* Reports List */}
        <div className="row g-4">
          {reports.map(report => (
            <div key={report.report_id} className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <h6 className="mb-1">Report #{report.report_id?.slice(0, 8)}</h6>
                      <small className="text-muted">
                        <i className="bi bi-calendar me-1"></i>
                        {new Date(report.created_at).toLocaleString()}
                      </small>
                    </div>
                    {getStatusBadge(report.report_status)}
                  </div>
                  
                  <p className="mb-2"><strong>Reason:</strong> {report.report_reason}</p>
                  <p className="mb-3"><strong>Description:</strong> {report.report_description || 'No description provided'}</p>
                  
                  <div className="d-flex gap-2">
                    {report.report_status === 'PENDING' && (
                      <>
                        <button className="btn btn-sm btn-success" onClick={() => updateReportStatus(report.report_id, 'RESOLVED')}>
                          <i className="bi bi-check-circle me-1"></i>Resolve
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => updateReportStatus(report.report_id, 'DISMISSED')}>
                          <i className="bi bi-x-circle me-1"></i>Dismiss
                        </button>
                      </>
                    )}
                    <button className="btn btn-sm btn-outline-primary" onClick={() => router.push(`/admin/reports/${report.report_id}`)}>
                      <i className="bi bi-eye me-1"></i>View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        .bg-gradient-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
      `}</style>
    </div>
  )
}