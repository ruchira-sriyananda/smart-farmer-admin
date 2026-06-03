import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function ReportsManagement() {
  const router = useRouter()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('PENDING')
  const [selectedReport, setSelectedReport] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showActionModal, setShowActionModal] = useState(false)
  const [showGenerateReportModal, setShowGenerateReportModal] = useState(false)
  const [actionType, setActionType] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportType, setReportType] = useState('system')
  const [dateRange, setDateRange] = useState('month')
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    dismissed: 0,
    reviewed: 0
  })

  useEffect(() => {
    fetchReports()
    fetchStats()
  }, [filter])

  const fetchReports = async () => {
    try {
      setLoading(true)
      setError(null)
      
      let query = supabase
        .from('system_reports')
        .select(`
          *,
          reviewed_by_admin:admin_users!reviewed_by (
            admin_id,
            full_name,
            email
          ),
          reported_user:admin_users!reported_user_id (
            admin_id,
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'ALL') {
        query = query.eq('report_status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      setReports(data || [])
    } catch (err) {
      console.error('Error fetching reports:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('system_reports')
        .select('report_status')

      if (!error && data) {
        setStats({
          total: data.length,
          pending: data.filter(r => r.report_status === 'PENDING').length,
          resolved: data.filter(r => r.report_status === 'RESOLVED').length,
          dismissed: data.filter(r => r.report_status === 'DISMISSED').length,
          reviewed: data.filter(r => r.report_status === 'REVIEWED').length
        })
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const updateReportStatus = async (reportId, status) => {
    setActionLoading(true)
    const session = JSON.parse(localStorage.getItem('adminSession'))
    
    const { error } = await supabase
      .from('system_reports')
      .update({
        report_status: status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session?.admin?.admin_id
      })
      .eq('report_id', reportId)

    setActionLoading(false)

    if (!error) {
      fetchReports()
      fetchStats()
      setShowActionModal(false)
      setSelectedReport(null)
    } else {
      alert(`Error updating report: ${error.message}`)
    }
  }

  // Generate Report Function
  const generateReport = async () => {
    setGeneratingReport(true)
    
    try {
      // Calculate date range
      const endDate = new Date()
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
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3)
          break
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
        default:
          startDate.setMonth(startDate.getMonth() - 1)
      }

      // Fetch data based on report type
      let reportData = {}
      
      if (reportType === 'system' || reportType === 'all') {
        // Fetch system reports
        const { data: systemReports } = await supabase
          .from('system_reports')
          .select('*')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
        
        reportData.systemReports = systemReports || []
      }
      
      if (reportType === 'user' || reportType === 'all') {
        // Fetch user reports
        const { data: userReports } = await supabase
          .from('system_reports')
          .select('*, admin_users!reported_user_id(full_name, email)')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .not('reported_user_id', 'is', null)
        
        reportData.userReports = userReports || []
      }
      
      if (reportType === 'content' || reportType === 'all') {
        // Fetch content reports
        const { data: contentReports } = await supabase
          .from('system_reports')
          .select('*')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .not('reported_post_id', 'is', null)
        
        reportData.contentReports = contentReports || []
      }

      // Create CSV content
      const csvRows = []
      
      // Add headers
      csvRows.push(['Report ID', 'Type', 'Reason', 'Description', 'Status', 'Created At', 'Reviewed By', 'Reviewed At'].join(','))
      
      // Add data rows
      const allReports = [
        ...(reportData.systemReports || []).map(r => ({ ...r, type: 'System' })),
        ...(reportData.userReports || []).map(r => ({ ...r, type: 'User' })),
        ...(reportData.contentReports || []).map(r => ({ ...r, type: 'Content' }))
      ]
      
      allReports.forEach(report => {
        csvRows.push([
          `"${report.report_id}"`,
          `"${report.type}"`,
          `"${report.report_reason?.replace(/"/g, '""') || ''}"`,
          `"${report.report_description?.replace(/"/g, '""') || ''}"`,
          `"${report.report_status}"`,
          `"${new Date(report.created_at).toLocaleString()}"`,
          `"${report.reviewed_by || ''}"`,
          `"${report.reviewed_at ? new Date(report.reviewed_at).toLocaleString() : ''}"`
        ].join(','))
      })
      
      const csvContent = csvRows.join('\n')
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reports_${reportType}_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      alert('Report generated successfully!')
      setShowGenerateReportModal(false)
      
    } catch (err) {
      console.error('Error generating report:', err)
      alert('Error generating report: ' + err.message)
    } finally {
      setGeneratingReport(false)
    }
  }

  // Export current view to PDF
  const exportToPDF = async () => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <title>Reports Export - ${new Date().toLocaleString()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { margin-bottom: 20px; }
            .stats { display: flex; gap: 20px; margin-bottom: 20px; }
            .stat-box { padding: 10px; background: #f8f9fa; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Reports Management Report</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
          <div class="stats">
            <div class="stat-box"><strong>Total Reports:</strong> ${stats.total}</div>
            <div class="stat-box"><strong>Pending:</strong> ${stats.pending}</div>
            <div class="stat-box"><strong>Resolved:</strong> ${stats.resolved}</div>
            <div class="stat-box"><strong>Dismissed:</strong> ${stats.dismissed}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              ${reports.map(report => `
                <tr>
                  <td>${report.report_id?.slice(0, 8)}</td>
                  <td>${report.report_reason}</td>
                  <td>${report.report_status}</td>
                  <td>${new Date(report.created_at).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const viewDetails = (report) => {
    setSelectedReport(report)
    setShowDetailsModal(true)
  }

  const openActionModal = (report, action) => {
    setSelectedReport(report)
    setActionType(action)
    setShowActionModal(true)
  }

  const getStatusBadge = (status) => {
    const badges = {
      'PENDING': <span className="status-badge pending"><i className="bi bi-clock-history"></i> Pending</span>,
      'REVIEWED': <span className="status-badge reviewed"><i className="bi bi-eye"></i> Reviewed</span>,
      'RESOLVED': <span className="status-badge resolved"><i className="bi bi-check-circle-fill"></i> Resolved</span>,
      'DISMISSED': <span className="status-badge dismissed"><i className="bi bi-x-circle-fill"></i> Dismissed</span>
    }
    return badges[status] || <span className="status-badge default">{status}</span>
  }

  const getSeverityBadge = (severity) => {
    if (!severity) return null
    const badges = {
      'HIGH': <span className="severity-badge high"><i className="bi bi-exclamation-triangle-fill"></i> High</span>,
      'MEDIUM': <span className="severity-badge medium"><i className="bi bi-exclamation-circle-fill"></i> Medium</span>,
      'LOW': <span className="severity-badge low"><i className="bi bi-info-circle-fill"></i> Low</span>
    }
    return badges[severity]
  }

  if (loading) {
    return (
      <AdminLayout title="Reports Management">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading reports...</p>
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

  if (error) {
    return (
      <AdminLayout title="Reports Management">
        <div className="error-container">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <h3>Failed to Load Reports</h3>
          <p>{error}</p>
          <button className="btn-primary" onClick={fetchReports}>Retry</button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Reports Management">
      <div className="reports-container">
        {/* Header with Generate Report Button */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-icon">
              <i className="bi bi-flag-fill"></i>
            </div>
            <div>
              <h1 className="header-title">Reports Management</h1>
              <p className="header-subtitle">Review and manage user reports</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-generate" onClick={() => setShowGenerateReportModal(true)}>
              <i className="bi bi-file-earmark-spreadsheet-fill"></i>
              Generate Report
            </button>
            <button className="btn-export" onClick={exportToPDF}>
              <i className="bi bi-printer-fill"></i>
              Export
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-icon"><i className="bi bi-flag"></i></div>
            <div className="stat-info">
              <span className="stat-label">Total Reports</span>
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
          <div className="stat-card dismissed">
            <div className="stat-icon"><i className="bi bi-x-circle"></i></div>
            <div className="stat-info">
              <span className="stat-label">Dismissed</span>
              <h2 className="stat-value text-danger">{stats.dismissed}</h2>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button className={`filter-tab ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
            <i className="bi bi-grid"></i> All Reports
            <span className="tab-count">{stats.total}</span>
          </button>
          <button className={`filter-tab ${filter === 'PENDING' ? 'active' : ''}`} onClick={() => setFilter('PENDING')}>
            <i className="bi bi-clock-history"></i> Pending
            <span className="tab-count pending">{stats.pending}</span>
          </button>
          <button className={`filter-tab ${filter === 'RESOLVED' ? 'active' : ''}`} onClick={() => setFilter('RESOLVED')}>
            <i className="bi bi-check-circle"></i> Resolved
            <span className="tab-count resolved">{stats.resolved}</span>
          </button>
          <button className={`filter-tab ${filter === 'DISMISSED' ? 'active' : ''}`} onClick={() => setFilter('DISMISSED')}>
            <i className="bi bi-x-circle"></i> Dismissed
            <span className="tab-count dismissed">{stats.dismissed}</span>
          </button>
        </div>

        {/* Reports Grid */}
        <div className="reports-grid">
          {reports.length > 0 ? (
            reports.map((report) => (
              <div key={report.report_id} className="report-card">
                <div className="report-card-header">
                  <div className="report-id">
                    <i className="bi bi-hash"></i>
                    #{report.report_id?.slice(0, 8)}
                  </div>
                  {getStatusBadge(report.report_status)}
                </div>
                
                <div className="report-card-body">
                  <div className="report-reason">
                    <i className="bi bi-exclamation-triangle-fill"></i>
                    <span>{report.report_reason}</span>
                  </div>
                  <div className="report-description">
                    {report.report_description || 'No description provided'}
                  </div>
                  <div className="report-meta">
                    <div className="meta-item">
                      <i className="bi bi-calendar3"></i>
                      {new Date(report.created_at).toLocaleString()}
                    </div>
                    {getSeverityBadge(report.severity_level)}
                  </div>
                </div>
                
                <div className="report-card-footer">
                  {report.report_status === 'PENDING' ? (
                    <div className="action-buttons">
                      <button className="btn-resolve" onClick={() => openActionModal(report, 'RESOLVED')}>
                        <i className="bi bi-check-lg"></i> Resolve
                      </button>
                      <button className="btn-dismiss" onClick={() => openActionModal(report, 'DISMISSED')}>
                        <i className="bi bi-x-lg"></i> Dismiss
                      </button>
                      <button className="btn-view" onClick={() => viewDetails(report)}>
                        <i className="bi bi-eye"></i> Details
                      </button>
                    </div>
                  ) : (
                    <div className="reviewed-info">
                      <i className="bi bi-person-check"></i>
                      Reviewed by {report.reviewed_by_admin?.full_name || 'System'}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <i className="bi bi-inbox"></i>
              <h4>No reports found</h4>
              <p>There are no {filter.toLowerCase()} reports to display.</p>
            </div>
          )}
        </div>
      </div>

      {/* Generate Report Modal */}
      {showGenerateReportModal && (
        <div className="modal-overlay" onClick={() => setShowGenerateReportModal(false)}>
          <div className="modal-container modal-generate" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header info">
              <div className="modal-icon"><i className="bi bi-file-earmark-spreadsheet-fill"></i></div>
              <h3>Generate Report</h3>
              <button className="modal-close" onClick={() => setShowGenerateReportModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Report Type</label>
                <select className="form-select" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                  <option value="system">System Reports</option>
                  <option value="user">User Reports</option>
                  <option value="content">Content Reports</option>
                  <option value="all">All Reports</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Date Range</label>
                <select className="form-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="quarter">Last 3 Months</option>
                  <option value="year">Last Year</option>
                </select>
              </div>

              <div className="report-preview">
                <h4>Report Summary</h4>
                <div className="preview-stats">
                  <div className="preview-stat">
                    <span>Total Reports:</span>
                    <strong>{stats.total}</strong>
                  </div>
                  <div className="preview-stat">
                    <span>Pending:</span>
                    <strong className="text-warning">{stats.pending}</strong>
                  </div>
                  <div className="preview-stat">
                    <span>Resolved:</span>
                    <strong className="text-success">{stats.resolved}</strong>
                  </div>
                  <div className="preview-stat">
                    <span>Dismissed:</span>
                    <strong className="text-danger">{stats.dismissed}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowGenerateReportModal(false)}>Cancel</button>
              <button className="btn-primary success" onClick={generateReport} disabled={generatingReport}>
                {generatingReport ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Generating...</>
                ) : (
                  <><i className="bi bi-download"></i> Generate Report</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedReport && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header info">
              <div className="modal-icon"><i className="bi bi-info-circle-fill"></i></div>
              <h3>Report Details</h3>
              <button className="modal-close" onClick={() => setShowDetailsModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="modal-body">
              <div className="details-section">
                <h4><i className="bi bi-file-text"></i> Report Information</h4>
                <div className="details-grid">
                  <div className="detail-item">
                    <label>Report ID</label>
                    <code>{selectedReport.report_id}</code>
                  </div>
                  <div className="detail-item">
                    <label>Status</label>
                    {getStatusBadge(selectedReport.report_status)}
                  </div>
                  <div className="detail-item">
                    <label>Created At</label>
                    <span>{new Date(selectedReport.created_at).toLocaleString()}</span>
                  </div>
                  <div className="detail-item">
                    <label>Severity</label>
                    {getSeverityBadge(selectedReport.severity_level)}
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h4><i className="bi bi-exclamation-triangle"></i> Report Content</h4>
                <div className="report-detail-box">
                  <label>Reason</label>
                  <div className="report-reason-box">{selectedReport.report_reason}</div>
                </div>
                <div className="report-detail-box">
                  <label>Description</label>
                  <div className="report-description-box">{selectedReport.report_description || 'No description provided'}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {selectedReport.report_status === 'PENDING' && (
                <>
                  <button className="btn-resolve-modal" onClick={() => {
                    setShowDetailsModal(false)
                    openActionModal(selectedReport, 'RESOLVED')
                  }}>
                    <i className="bi bi-check-lg"></i> Resolve
                  </button>
                  <button className="btn-dismiss-modal" onClick={() => {
                    setShowDetailsModal(false)
                    openActionModal(selectedReport, 'DISMISSED')
                  }}>
                    <i className="bi bi-x-lg"></i> Dismiss
                  </button>
                </>
              )}
              <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {showActionModal && selectedReport && (
        <div className="modal-overlay" onClick={() => setShowActionModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-header ${actionType === 'RESOLVED' ? 'success' : 'danger'}`}>
              <div className="modal-icon">
                <i className={`bi ${actionType === 'RESOLVED' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
              </div>
              <h3>{actionType === 'RESOLVED' ? 'Resolve Report' : 'Dismiss Report'}</h3>
              <button className="modal-close" onClick={() => setShowActionModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to <strong>{actionType === 'RESOLVED' ? 'resolve' : 'dismiss'}</strong> this report?
              </p>
              <div className="report-summary">
                <div><strong>Report ID:</strong> {selectedReport.report_id?.slice(0, 8)}</div>
                <div><strong>Reason:</strong> {selectedReport.report_reason}</div>
              </div>
              {actionType === 'RESOLVED' ? (
                <div className="warning-message success">
                  <i className="bi bi-check-circle-fill"></i>
                  This will mark the report as resolved. The reported content may be reviewed.
                </div>
              ) : (
                <div className="warning-message danger">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  This will dismiss the report without any action on the reported content.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowActionModal(false)}>Cancel</button>
              <button 
                className={`btn-primary ${actionType === 'RESOLVED' ? 'success' : 'danger'}`}
                onClick={() => updateReportStatus(selectedReport.report_id, actionType)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Processing...</>
                ) : (
                  actionType === 'RESOLVED' ? 'Confirm Resolve' : 'Confirm Dismiss'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .reports-container {
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

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .btn-generate, .btn-export {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border: none;
          border-radius: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-generate {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-generate:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }

        .btn-export {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          color: #495057;
        }

        .btn-export:hover {
          background: #e9ecef;
        }

        /* Stats Cards */
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
        .stat-card.dismissed .stat-icon { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

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
        }

        .text-warning { color: #f59e0b; }
        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }

        /* Filter Tabs */
        .filter-tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 28px;
          background: white;
          padding: 6px;
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .filter-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          background: transparent;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #6c757d;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .filter-tab:hover {
          background: #f8f9fa;
        }

        .filter-tab.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .tab-count {
          background: rgba(0, 0, 0, 0.1);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
          margin-left: 6px;
        }

        .filter-tab.active .tab-count {
          background: rgba(255, 255, 255, 0.2);
        }

        /* Reports Grid */
        .reports-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
        }

        .report-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .report-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }

        .report-card-header {
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .report-id {
          font-family: monospace;
          font-size: 12px;
          font-weight: 600;
          color: #6c757d;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
        }

        .status-badge.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .status-badge.resolved { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-badge.dismissed { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

        .severity-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
        }

        .severity-badge.high { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .severity-badge.medium { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .severity-badge.low { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

        .report-card-body {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
        }

        .report-reason {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 12px;
        }

        .report-reason i {
          color: #ef4444;
        }

        .report-description {
          font-size: 13px;
          color: #6c757d;
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .report-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #9ca3af;
        }

        .report-card-footer {
          padding: 16px 20px;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .btn-resolve, .btn-dismiss, .btn-view {
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

        .btn-resolve { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .btn-resolve:hover { background: #10b981; color: white; }
        .btn-dismiss { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .btn-dismiss:hover { background: #ef4444; color: white; }
        .btn-view { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
        .btn-view:hover { background: #4f46e5; color: white; }

        .reviewed-info {
          font-size: 11px;
          color: #6c757d;
          text-align: center;
        }

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 24px;
          grid-column: span 3;
        }

        /* Generate Report Modal */
        .modal-generate {
          max-width: 450px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .form-select {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 14px;
        }

        .report-preview {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 16px;
          margin-top: 20px;
        }

        .report-preview h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .preview-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .preview-stat {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .report-summary {
          background: #f8f9fa;
          padding: 12px;
          border-radius: 12px;
          margin: 16px 0;
        }

        .warning-message {
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .warning-message.success {
          background: #d1fae5;
          color: #065f46;
        }

        .warning-message.danger {
          background: #fee2e2;
          color: #991b1b;
        }

        /* Modal */
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
          max-width: 600px;
          animation: slideUp 0.3s ease;
          overflow: hidden;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-container.modal-lg {
          max-width: 700px;
        }

        .modal-header {
          padding: 24px 24px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          border-bottom: 1px solid #e9ecef;
        }

        .modal-header.info .modal-icon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .modal-header.success .modal-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
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

        .details-section {
          margin-bottom: 24px;
        }

        .details-section h4 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #1f2937;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .detail-item label {
          font-size: 11px;
          font-weight: 600;
          color: #6c757d;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
          display: block;
        }

        .report-detail-box {
          margin-bottom: 16px;
        }

        .report-detail-box label {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 6px;
          display: block;
        }

        .report-reason-box {
          background: #fef3c7;
          padding: 12px;
          border-radius: 12px;
          color: #92400e;
        }

        .report-description-box {
          background: #f8f9fa;
          padding: 12px;
          border-radius: 12px;
          color: #4b5563;
          line-height: 1.5;
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

        .btn-primary.success { background: #10b981; color: white; }
        .btn-primary.danger { background: #ef4444; color: white; }

        .btn-resolve-modal, .btn-dismiss-modal {
          padding: 10px 24px;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-resolve-modal { background: #10b981; color: white; }
        .btn-dismiss-modal { background: #ef4444; color: white; }

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
          .reports-grid {
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .filter-tabs {
            flex-wrap: wrap;
          }
          
          .filter-tab {
            flex: auto;
          }
          
          .reports-grid {
            grid-template-columns: 1fr;
          }
          
          .details-grid {
            grid-template-columns: 1fr;
          }

          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .preview-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AdminLayout>
  )
}