import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllNotifications()
  }, [])

  const fetchAllNotifications = async () => {
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
        .limit(50)

      if (!error && data) {
        const formatted = data.map(activity => ({
          id: activity.log_id,
          title: getNotificationTitle(activity.activity_type),
          message: activity.activity_description,
          user: activity.admin_users?.full_name || 'System',
          time: new Date(activity.created_at).toLocaleString(),
          type: getNotificationType(activity.activity_type),
          icon: getNotificationIcon(activity.activity_type)
        }))
        setNotifications(formatted)
      }
    } catch (err) {
      console.error('Error fetching notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const getNotificationTitle = (type) => {
    const titles = {
      'LOGIN': 'Login Activity',
      'LOGOUT': 'Logout Activity',
      'USER_MANAGEMENT': 'User Management',
      'CONTENT_MODERATION': 'Content Moderation',
      'REPORT_HANDLING': 'Report Activity',
      'SECURITY_ALERT': 'Security Alert'
    }
    return titles[type] || 'Activity'
  }

  const getNotificationType = (type) => {
    const types = {
      'LOGIN': 'info',
      'LOGOUT': 'secondary',
      'USER_MANAGEMENT': 'primary',
      'CONTENT_MODERATION': 'warning',
      'REPORT_HANDLING': 'danger',
      'SECURITY_ALERT': 'danger'
    }
    return types[type] || 'info'
  }

  const getNotificationIcon = (type) => {
    const icons = {
      'LOGIN': 'box-arrow-in-right',
      'LOGOUT': 'box-arrow-right',
      'USER_MANAGEMENT': 'people',
      'CONTENT_MODERATION': 'file-post',
      'REPORT_HANDLING': 'flag',
      'SECURITY_ALERT': 'shield-exclamation'
    }
    return icons[type] || 'bell'
  }

  if (loading) {
    return (
      <AdminLayout title="Notifications">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="All Notifications">
      <div className="card border-0 shadow-sm rounded-3">
        <div className="card-header bg-white border-0 pt-4">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold">
              <i className="bi bi-bell me-2 text-primary"></i>
              Notification History
            </h5>
            <span className="badge bg-primary rounded-pill">{notifications.length} total</span>
          </div>
        </div>
        <div className="card-body p-0">
          {notifications.map((notification, idx) => (
            <div key={notification.id} className={`notification-item p-3 border-bottom ${idx % 2 === 0 ? 'bg-light' : ''}`}>
              <div className="d-flex gap-3">
                <div className={`flex-shrink-0 bg-${notification.type} bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center`} style={{ width: '45px', height: '45px' }}>
                  <i className={`bi bi-${notification.icon} text-${notification.type} fs-5`}></i>
                </div>
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between align-items-start">
                    <h6 className="mb-1 fw-bold">{notification.title}</h6>
                    <small className="text-muted">{notification.time}</small>
                  </div>
                  <p className="mb-1 text-muted small">{notification.message}</p>
                  <small className="text-muted">
                    <i className="bi bi-person-circle me-1"></i>
                    {notification.user}
                  </small>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}