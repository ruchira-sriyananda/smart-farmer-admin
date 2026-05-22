import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function AIChatbot() {
  const [conversations, setConversations] = useState([])
  const [stats, setStats] = useState({
    totalConversations: 0,
    activeSessions: 0,
    avgResponseTime: 0,
    satisfactionRate: 92
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchChatbotData()
    
    const subscription = supabase
      .channel('chatbot_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'ai_chatbot_logs' },
        () => fetchChatbotData()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [])

  const fetchChatbotData = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_chatbot_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (!error && data) {
        setConversations(data)
        calculateStats(data)
      }
    } catch (err) {
      console.error('Error fetching chatbot data:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data) => {
    setStats({
      totalConversations: data.length,
      activeSessions: data.filter(c => c.status === 'active').length,
      avgResponseTime: Math.floor(data.reduce((sum, c) => sum + (c.response_time || 0), 0) / (data.length || 1)),
      satisfactionRate: 92
    })
  }

  if (loading) {
    return (
      <AdminLayout title="AI Chatbot Monitoring">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="AI Chatbot Monitoring">
      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <div className="card border-0 bg-primary bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Total Conversations</h6>
              <h2 className="fw-bold">{stats.totalConversations}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-success bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Active Sessions</h6>
              <h2 className="fw-bold text-success">{stats.activeSessions}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-info bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Avg Response Time</h6>
              <h2 className="fw-bold text-info">{stats.avgResponseTime}s</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-warning bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Satisfaction Rate</h6>
              <h2 className="fw-bold text-warning">{stats.satisfactionRate}%</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-0 pt-4">
          <h5 className="mb-0 fw-bold">
            <i className="bi bi-robot me-2 text-primary"></i>
            Recent Conversations
          </h5>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="bg-light">
                <tr>
                  <th>User</th>
                  <th>Message</th>
                  <th>Bot Response</th>
                  <th>Response Time</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map(conv => (
                  <tr key={conv.id}>
                    <td>{conv.user_email || 'Anonymous'}</td>
                    <td style={{ maxWidth: '200px' }}>{conv.user_message?.substring(0, 50)}...</td>
                    <td style={{ maxWidth: '200px' }}>{conv.bot_response?.substring(0, 50)}...</td>
                    <td>{conv.response_time || 'N/A'}s</td>
                    <td>
                      <span className={`badge bg-${conv.status === 'active' ? 'success' : 'secondary'}`}>
                        {conv.status || 'completed'}
                      </span>
                    </td>
                    <td><small>{new Date(conv.created_at).toLocaleString()}</small></td>
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