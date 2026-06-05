import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function AIChatbot() {
  const [conversations, setConversations] = useState([])
  const [stats, setStats] = useState({
    totalConversations: 0,
    activeSessions: 0,
    avgResponseTime: 0,
    satisfactionRate: 92,
    totalMessages: 0,
    uniqueUsers: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

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
        .limit(50)

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
    const uniqueUsers = [...new Set(data.map(c => c.user_email).filter(email => email))].length
    
    setStats({
      totalConversations: data.length,
      activeSessions: data.filter(c => c.status === 'active').length,
      avgResponseTime: Math.floor(data.reduce((sum, c) => sum + (c.response_time || 0), 0) / (data.length || 1)),
      satisfactionRate: 92,
      totalMessages: data.reduce((sum, c) => sum + (c.user_message ? 1 : 0) + (c.bot_response ? 1 : 0), 0),
      uniqueUsers: uniqueUsers
    })
  }

  const getStatusBadge = (status) => {
    const badges = {
      'active': { class: 'success', icon: 'bi-chat-dots-fill', text: 'Active' },
      'completed': { class: 'secondary', icon: 'bi-check-circle-fill', text: 'Completed' },
      'pending': { class: 'warning', icon: 'bi-clock-fill', text: 'Pending' },
      'failed': { class: 'danger', icon: 'bi-exclamation-circle-fill', text: 'Failed' }
    }
    const badge = badges[status] || badges['completed']
    return (
      <span className={`status-badge ${badge.class}`}>
        <i className={`bi ${badge.icon}`}></i>
        {badge.text}
      </span>
    )
  }

  const getResponseTimeColor = (time) => {
    if (!time) return 'text-secondary'
    if (time < 1) return 'text-success'
    if (time < 2) return 'text-warning'
    return 'text-danger'
  }

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.user_message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         conv.bot_response?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         conv.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || conv.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const viewConversationDetails = (conv) => {
    setSelectedConversation(conv)
    setShowDetailsModal(true)
  }

  if (loading) {
    return (
      <AdminLayout title="AI Chatbot Monitoring">
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-animation">
              <div className="loading-circle"></div>
              <div className="loading-circle delay-1"></div>
              <div className="loading-circle delay-2"></div>
            </div>
            <h3>Loading chatbot analytics...</h3>
            <p>Please wait while we fetch conversation data</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="AI Chatbot Monitoring">
      <div className="chatbot-dashboard">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">
                <i className="bi bi-robot"></i>
                AI Chatbot Monitoring
              </h1>
              <p className="hero-subtitle">Monitor conversations, track performance, and optimize your AI assistant</p>
            </div>
            <div className="hero-actions">
              <button className="btn-refresh" onClick={fetchChatbotData}>
                <i className="bi bi-arrow-repeat"></i>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-wrapper">
          <div className="stats-grid">
            <div className="stat-card stat-conversations">
              <div className="stat-icon">
                <i className="bi bi-chat-dots"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Conversations</span>
                <h3 className="stat-value">{stats.totalConversations}</h3>
                <span className="stat-trend">+12% this week</span>
              </div>
              <div className="stat-bg-icon">
                <i className="bi bi-chat-dots"></i>
              </div>
            </div>

            <div className="stat-card stat-active">
              <div className="stat-icon">
                <i className="bi bi-activity"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Active Sessions</span>
                <h3 className="stat-value">{stats.activeSessions}</h3>
                <span className="stat-trend">Currently active</span>
              </div>
              <div className="stat-bg-icon">
                <i className="bi bi-activity"></i>
              </div>
            </div>

            <div className="stat-card stat-response">
              <div className="stat-icon">
                <i className="bi bi-stopwatch"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Avg Response Time</span>
                <h3 className="stat-value">{stats.avgResponseTime}s</h3>
                <span className="stat-trend">Fast responses</span>
              </div>
              <div className="stat-bg-icon">
                <i className="bi bi-stopwatch"></i>
              </div>
            </div>

            <div className="stat-card stat-satisfaction">
              <div className="stat-icon">
                <i className="bi bi-emoji-smile"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Satisfaction Rate</span>
                <h3 className="stat-value">{stats.satisfactionRate}%</h3>
                <span className="stat-trend">Excellent rating</span>
              </div>
              <div className="stat-bg-icon">
                <i className="bi bi-emoji-smile"></i>
              </div>
            </div>

            <div className="stat-card stat-messages">
              <div className="stat-icon">
                <i className="bi bi-envelope"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Messages</span>
                <h3 className="stat-value">{stats.totalMessages}</h3>
                <span className="stat-trend">Messages exchanged</span>
              </div>
              <div className="stat-bg-icon">
                <i className="bi bi-envelope"></i>
              </div>
            </div>

            <div className="stat-card stat-users">
              <div className="stat-icon">
                <i className="bi bi-people"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Unique Users</span>
                <h3 className="stat-value">{stats.uniqueUsers}</h3>
                <span className="stat-trend">Active users</span>
              </div>
              <div className="stat-bg-icon">
                <i className="bi bi-people"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="controls-bar">
          <div className="controls-left">
            <div className="search-box">
              <i className="bi bi-search"></i>
              <input 
                type="text" 
                placeholder="Search conversations..." 
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
              <select 
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div className="controls-right">
            <div className="info-text">
              <i className="bi bi-info-circle"></i>
              Showing last {filteredConversations.length} conversations
            </div>
          </div>
        </div>

        {/* Conversations List */}
        {filteredConversations.length > 0 ? (
          <div className="conversations-list">
            {filteredConversations.map((conv, index) => (
              <div 
                key={conv.id} 
                className={`conversation-card fade-in-up`}
                style={{animationDelay: `${index * 0.03}s`}}
                onClick={() => viewConversationDetails(conv)}
              >
                <div className="conversation-header">
                  <div className="user-info">
                    <div className="user-avatar">
                      <i className="bi bi-person-circle"></i>
                    </div>
                    <div>
                      <h4 className="user-name">{conv.user_email || 'Anonymous User'}</h4>
                      <div className="conversation-time">
                        <i className="bi bi-clock"></i>
                        {new Date(conv.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(conv.status)}
                </div>

                <div className="conversation-messages">
                  <div className="message user-message">
                    <div className="message-icon">
                      <i className="bi bi-person"></i>
                    </div>
                    <div className="message-content">
                      <div className="message-label">User asked:</div>
                      <p>{conv.user_message?.substring(0, 150)}...</p>
                    </div>
                  </div>

                  <div className="message bot-message">
                    <div className="message-icon">
                      <i className="bi bi-robot"></i>
                    </div>
                    <div className="message-content">
                      <div className="message-label">Bot responded:</div>
                      <p>{conv.bot_response?.substring(0, 150)}...</p>
                    </div>
                  </div>
                </div>

                <div className="conversation-footer">
                  <div className="response-metrics">
                    <div className="metric">
                      <i className="bi bi-stopwatch"></i>
                      <span className={getResponseTimeColor(conv.response_time)}>
                        Response: {conv.response_time || 'N/A'}s
                      </span>
                    </div>
                    <div className="metric">
                      <i className="bi bi-chat"></i>
                      <span>Messages: {conv.message_count || 2}</span>
                    </div>
                  </div>
                  <button className="view-details-btn">
                    View Details
                    <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="bi bi-chat-dots"></i>
            </div>
            <h3>No Conversations Found</h3>
            <p>No chatbot conversations match your search criteria</p>
            <button className="btn-clear-filters" onClick={() => {
              setSearchTerm('')
              setFilterStatus('all')
            }}>
              <i className="bi bi-arrow-repeat"></i>
              Clear Filters
            </button>
          </div>
        )}

        {/* Conversation Details Modal */}
        {showDetailsModal && selectedConversation && (
          <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
            <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-header-content">
                  <i className="bi bi-chat-dots-fill"></i>
                  <div>
                    <h2>Conversation Details</h2>
                    <p>Complete conversation history and analytics</p>
                  </div>
                </div>
                <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="modal-body">
                <div className="conversation-metadata">
                  <div className="metadata-item">
                    <label>User</label>
                    <span>{selectedConversation.user_email || 'Anonymous User'}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Status</label>
                    <span>{getStatusBadge(selectedConversation.status)}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Timestamp</label>
                    <span>{new Date(selectedConversation.created_at).toLocaleString()}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Response Time</label>
                    <span className={getResponseTimeColor(selectedConversation.response_time)}>
                      {selectedConversation.response_time || 'N/A'} seconds
                    </span>
                  </div>
                </div>

                <div className="full-conversation">
                  <div className="message-detail user">
                    <div className="message-header">
                      <i className="bi bi-person-circle"></i>
                      <span>User Message</span>
                    </div>
                    <div className="message-body">
                      {selectedConversation.user_message}
                    </div>
                  </div>

                  <div className="message-detail bot">
                    <div className="message-header">
                      <i className="bi bi-robot"></i>
                      <span>Bot Response</span>
                    </div>
                    <div className="message-body">
                      {selectedConversation.bot_response}
                    </div>
                  </div>
                </div>

                {selectedConversation.metadata && (
                  <div className="additional-info">
                    <h4>Additional Information</h4>
                    <pre>{JSON.stringify(selectedConversation.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          .chatbot-dashboard {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 24px;
          }

          /* Hero Section */
          .hero-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 28px;
            padding: 48px 40px;
            margin-bottom: 32px;
            position: relative;
            overflow: hidden;
          }

          .hero-section::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: pulse 10s ease-in-out infinite;
          }

          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }

          .hero-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
            z-index: 1;
          }

          .hero-title {
            font-size: 32px;
            font-weight: 700;
            color: white;
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .hero-title i {
            font-size: 40px;
          }

          .hero-subtitle {
            font-size: 16px;
            color: rgba(255,255,255,0.9);
            margin: 0;
          }

          .btn-refresh {
            padding: 12px 24px;
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 12px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
          }

          .btn-refresh:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
          }

          /* Stats Grid */
          .stats-wrapper {
            margin-bottom: 32px;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
          }

          .stat-card {
            background: white;
            border-radius: 24px;
            padding: 24px;
            display: flex;
            align-items: center;
            gap: 16px;
            position: relative;
            overflow: hidden;
            transition: all 0.3s ease;
            cursor: pointer;
          }

          .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 24px rgba(0,0,0,0.1);
          }

          .stat-icon {
            width: 56px;
            height: 56px;
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            z-index: 1;
          }

          .stat-conversations .stat-icon { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
          .stat-active .stat-icon { background: linear-gradient(135deg, #10b981, #059669); color: white; }
          .stat-response .stat-icon { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; }
          .stat-satisfaction .stat-icon { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
          .stat-messages .stat-icon { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; }
          .stat-users .stat-icon { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }

          .stat-info {
            flex: 1;
            z-index: 1;
          }

          .stat-label {
            font-size: 13px;
            color: #6c757d;
            font-weight: 500;
            display: block;
            margin-bottom: 8px;
          }

          .stat-value {
            font-size: 32px;
            font-weight: 700;
            color: #1f2937;
            margin: 0 0 4px 0;
          }

          .stat-trend {
            font-size: 12px;
            color: #10b981;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .stat-bg-icon {
            position: absolute;
            right: 16px;
            bottom: 16px;
            font-size: 80px;
            opacity: 0.05;
          }

          /* Controls Bar */
          .controls-bar {
            background: white;
            border-radius: 20px;
            padding: 16px 20px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          }

          .controls-left {
            display: flex;
            gap: 16px;
            align-items: center;
            flex-wrap: wrap;
            flex: 1;
          }

          .search-box {
            position: relative;
            min-width: 300px;
            flex: 1;
          }

          .search-box i {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: #9ca3af;
          }

          .search-box input {
            width: 100%;
            padding: 10px 40px 10px 40px;
            border: 2px solid #e9ecef;
            border-radius: 12px;
            font-size: 14px;
            transition: all 0.3s ease;
          }

          .search-box input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
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
            min-width: 150px;
          }

          .filter-select {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #e9ecef;
            border-radius: 12px;
            font-size: 14px;
            background: white;
            cursor: pointer;
          }

          .controls-right {
            display: flex;
            align-items: center;
          }

          .info-text {
            padding: 8px 16px;
            background: #f8f9fa;
            border-radius: 12px;
            font-size: 13px;
            color: #6c757d;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          /* Conversations List */
          .conversations-list {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .conversation-card {
            background: white;
            border-radius: 20px;
            padding: 24px;
            transition: all 0.3s ease;
            cursor: pointer;
            animation: fadeInUp 0.5s ease backwards;
          }

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .fade-in-up {
            animation: fadeInUp 0.5s ease backwards;
          }

          .conversation-card:hover {
            transform: translateX(4px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.08);
            background: linear-gradient(135deg, rgba(102,126,234,0.02), rgba(118,75,162,0.02));
          }

          .conversation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }

          .user-info {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .user-avatar {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          }

          .user-avatar i {
            font-size: 24px;
          }

          .user-name {
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 4px 0;
            color: #1f2937;
          }

          .conversation-time {
            font-size: 12px;
            color: #9ca3af;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
          }

          .status-badge.success { background: rgba(16,185,129,0.1); color: #10b981; }
          .status-badge.secondary { background: rgba(107,114,128,0.1); color: #6c757d; }
          .status-badge.warning { background: rgba(245,158,11,0.1); color: #f59e0b; }
          .status-badge.danger { background: rgba(239,68,68,0.1); color: #ef4444; }

          /* Messages */
          .conversation-messages {
            margin-bottom: 20px;
          }

          .message {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
          }

          .message-icon {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .user-message .message-icon {
            background: rgba(102,126,234,0.1);
            color: #667eea;
          }

          .bot-message .message-icon {
            background: rgba(16,185,129,0.1);
            color: #10b981;
          }

          .message-content {
            flex: 1;
          }

          .message-label {
            font-size: 11px;
            font-weight: 600;
            color: #9ca3af;
            margin-bottom: 4px;
          }

          .message-content p {
            margin: 0;
            font-size: 14px;
            color: #374151;
            line-height: 1.5;
          }

          .conversation-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 16px;
            border-top: 1px solid #e9ecef;
          }

          .response-metrics {
            display: flex;
            gap: 16px;
          }

          .metric {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
          }

          .metric i {
            font-size: 14px;
          }

          .text-success { color: #10b981; }
          .text-warning { color: #f59e0b; }
          .text-danger { color: #ef4444; }
          .text-secondary { color: #6c757d; }

          .view-details-btn {
            padding: 6px 16px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border: none;
            border-radius: 10px;
            color: white;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .view-details-btn:hover {
            transform: translateX(4px);
          }

          /* Empty State */
          .empty-state {
            text-align: center;
            padding: 80px 20px;
            background: white;
            border-radius: 24px;
          }

          .empty-state-icon {
            font-size: 80px;
            color: #cbd5e1;
            margin-bottom: 24px;
          }

          .empty-state h3 {
            font-size: 24px;
            margin-bottom: 12px;
            color: #1f2937;
          }

          .empty-state p {
            color: #6c757d;
            margin-bottom: 32px;
          }

          .btn-clear-filters {
            padding: 12px 32px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border: none;
            border-radius: 12px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }

          /* Loading Screen */
          .loading-screen {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 500px;
          }

          .loading-content {
            text-align: center;
          }

          .loading-animation {
            display: flex;
            gap: 12px;
            justify-content: center;
            margin-bottom: 24px;
          }

          .loading-circle {
            width: 12px;
            height: 12px;
            background: #667eea;
            border-radius: 50%;
            animation: bounce 1.4s ease-in-out infinite;
          }

          .delay-1 { animation-delay: 0.2s; }
          .delay-2 { animation-delay: 0.4s; }

          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
            40% { transform: scale(1); opacity: 1; }
          }

          /* Modal Styles */
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1100;
            animation: fadeIn 0.2s ease;
          }

          .modal-container {
            background: white;
            border-radius: 28px;
            width: 90%;
            max-width: 800px;
            max-height: 85vh;
            overflow-y: auto;
            animation: slideUp 0.3s ease;
          }

          .modal-container.modal-lg {
            max-width: 900px;
          }

          .modal-header {
            padding: 28px 28px 20px;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .modal-header-content {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .modal-header-content i {
            font-size: 32px;
            color: #667eea;
          }

          .modal-header-content h2 {
            font-size: 24px;
            margin: 0 0 4px 0;
          }

          .modal-header-content p {
            margin: 0;
            color: #6c757d;
          }

          .modal-close {
            width: 40px;
            height: 40px;
            background: #f8f9fa;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .modal-close:hover {
            background: #e9ecef;
            transform: rotate(90deg);
          }

          .modal-body {
            padding: 28px;
          }

          .modal-footer {
            padding: 20px 28px 28px;
            border-top: 1px solid #e9ecef;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
          }

          /* Conversation Details */
          .conversation-metadata {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 16px;
          }

          .metadata-item label {
            display: block;
            font-size: 11px;
            font-weight: 600;
            color: #6c757d;
            margin-bottom: 8px;
            text-transform: uppercase;
          }

          .metadata-item span {
            font-size: 14px;
            font-weight: 500;
            color: #1f2937;
          }

          .full-conversation {
            margin-bottom: 24px;
          }

          .message-detail {
            margin-bottom: 24px;
            padding: 20px;
            border-radius: 16px;
          }

          .message-detail.user {
            background: linear-gradient(135deg, rgba(102,126,234,0.05), rgba(118,75,162,0.05));
          }

          .message-detail.bot {
            background: linear-gradient(135deg, rgba(16,185,129,0.05), rgba(5,150,105,0.05));
          }

          .message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            font-weight: 600;
          }

          .message-header i {
            font-size: 20px;
          }

          .message-detail.user .message-header {
            color: #667eea;
          }

          .message-detail.bot .message-header {
            color: #10b981;
          }

          .message-body {
            font-size: 14px;
            line-height: 1.6;
            color: #374151;
          }

          .additional-info {
            margin-top: 24px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 16px;
          }

          .additional-info h4 {
            font-size: 16px;
            margin-bottom: 12px;
          }

          .additional-info pre {
            background: white;
            padding: 12px;
            border-radius: 12px;
            overflow-x: auto;
            font-size: 12px;
          }

          .btn-secondary {
            padding: 10px 20px;
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

          /* Responsive */
          @media (max-width: 1200px) {
            .stats-grid {
              grid-template-columns: repeat(3, 1fr);
            }
          }

          @media (max-width: 768px) {
            .chatbot-dashboard {
              padding: 0 16px;
            }
            .hero-section {
              padding: 32px 24px;
            }
            .hero-content {
              flex-direction: column;
              text-align: center;
              gap: 20px;
            }
            .stats-grid {
              grid-template-columns: repeat(2, 1fr);
            }
            .controls-bar {
              flex-direction: column;
              align-items: stretch;
            }
            .controls-left {
              flex-direction: column;
            }
            .search-box {
              width: 100%;
            }
            .filter-group {
              width: 100%;
            }
            .conversation-header {
              flex-direction: column;
              align-items: flex-start;
              gap: 12px;
            }
            .conversation-footer {
              flex-direction: column;
              gap: 12px;
            }
            .response-metrics {
              width: 100%;
              justify-content: space-between;
            }
            .view-details-btn {
              width: 100%;
              justify-content: center;
            }
            .conversation-metadata {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </AdminLayout>
  )
}