import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function ContentModeration() {
  const router = useRouter()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('PENDING')
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  })

  useEffect(() => {
    fetchPosts()
    fetchStats()
  }, [filter])

  const fetchPosts = async () => {
    try {
      let query = supabase
        .from('content_moderation')
        .select(`
          *,
          reviewed_by_admin:admin_users!reviewed_by (
            full_name
          )
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'ALL') {
        query = query.eq('moderation_status', filter)
      }

      const { data, error } = await query

      if (!error && data) {
        setPosts(data)
      }
    } catch (err) {
      console.error('Error fetching posts:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('content_moderation')
        .select('moderation_status')

      if (!error && data) {
        setStats({
          total: data.length,
          pending: data.filter(p => p.moderation_status === 'PENDING').length,
          approved: data.filter(p => p.moderation_status === 'APPROVED').length,
          rejected: data.filter(p => p.moderation_status === 'REJECTED').length
        })
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const updateStatus = async (postId, status) => {
    const session = JSON.parse(localStorage.getItem('adminSession'))
    
    const { error } = await supabase
      .from('content_moderation')
      .update({
        moderation_status: status,
        moderation_reason: status === 'REJECTED' ? 'Content violates guidelines' : null,
        reviewed_by: session?.admin?.admin_id,
        reviewed_at: new Date().toISOString()
      })
      .eq('moderation_id', postId)

    if (!error) {
      fetchPosts()
      fetchStats()
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      'PENDING': <span className="badge bg-warning text-dark">Pending Review</span>,
      'APPROVED': <span className="badge bg-success">Approved</span>,
      'REJECTED': <span className="badge bg-danger">Rejected</span>
    }
    return badges[status] || <span className="badge bg-secondary">{status}</span>
  }

  if (loading) {
    return (
      <AdminLayout title="Content Moderation">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Content Moderation">
      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-0 bg-primary bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Total Content</h6>
                  <h3 className="mb-0 fw-bold">{stats.total}</h3>
                </div>
                <i className="bi bi-file-post fs-1 text-primary"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-warning bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Pending Review</h6>
                  <h3 className="mb-0 fw-bold text-warning">{stats.pending}</h3>
                </div>
                <i className="bi bi-clock-history fs-1 text-warning"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-success bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Approved</h6>
                  <h3 className="mb-0 fw-bold text-success">{stats.approved}</h3>
                </div>
                <i className="bi bi-check-circle fs-1 text-success"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-danger bg-opacity-10">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-muted mb-1">Rejected</h6>
                  <h3 className="mb-0 fw-bold text-danger">{stats.rejected}</h3>
                </div>
                <i className="bi bi-x-circle fs-1 text-danger"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="btn-group w-100">
            <button 
              className={`btn ${filter === 'ALL' ? 'btn-primary' : 'btn-outline-primary'}`} 
              onClick={() => setFilter('ALL')}
            >
              All Content
            </button>
            <button 
              className={`btn ${filter === 'PENDING' ? 'btn-warning' : 'btn-outline-warning'}`} 
              onClick={() => setFilter('PENDING')}
            >
              Pending ({stats.pending})
            </button>
            <button 
              className={`btn ${filter === 'APPROVED' ? 'btn-success' : 'btn-outline-success'}`} 
              onClick={() => setFilter('APPROVED')}
            >
              Approved
            </button>
            <button 
              className={`btn ${filter === 'REJECTED' ? 'btn-danger' : 'btn-outline-danger'}`} 
              onClick={() => setFilter('REJECTED')}
            >
              Rejected
            </button>
          </div>
        </div>
      </div>

      {/* Posts List */}
      <div className="row g-4">
        {posts.map(post => (
          <div className="col-12" key={post.moderation_id}>
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      {getStatusBadge(post.moderation_status)}
                      <small className="text-muted">
                        <i className="bi bi-calendar me-1"></i>
                        {new Date(post.created_at).toLocaleString()}
                      </small>
                    </div>
                    <h6 className="mb-2">Content ID: {post.content_id?.slice(0, 8)}...</h6>
                    <p className="text-muted mb-2">
                      <strong>Type:</strong> {post.content_type} | 
                      <strong> Status:</strong> {post.moderation_status}
                    </p>
                    {post.moderation_reason && (
                      <p className="text-danger small mb-2">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        Reason: {post.moderation_reason}
                      </p>
                    )}
                  </div>
                  
                  {post.moderation_status === 'PENDING' && (
                    <div className="btn-group">
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={() => updateStatus(post.moderation_id, 'APPROVED')}
                      >
                        <i className="bi bi-check-lg me-1"></i>Approve
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => updateStatus(post.moderation_id, 'REJECTED')}
                      >
                        <i className="bi bi-x-lg me-1"></i>Reject
                      </button>
                    </div>
                  )}
                  
                  {post.moderation_status !== 'PENDING' && post.reviewed_by_admin && (
                    <small className="text-muted">
                      <i className="bi bi-person-check me-1"></i>
                      Reviewed by: {post.reviewed_by_admin?.full_name || 'System'}
                    </small>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {posts.length === 0 && (
          <div className="col-12">
            <div className="card border-0 shadow-sm">
              <div className="card-body text-center py-5">
                <i className="bi bi-inbox fs-1 text-muted"></i>
                <p className="text-muted mt-3 mb-0">No content found</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}