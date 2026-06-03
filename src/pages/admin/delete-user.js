import { createClient } from '@supabase/supabase-js'

// Use service role key to bypass RLS for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { adminId, userId, userEmail, isAdminUser = true } = req.body

  if (!adminId && !userId && !userEmail) {
    return res.status(400).json({ error: 'User identifier required' })
  }

  const identifier = adminId || userId

  try {
    let result
    let deletedTables = []

    if (isAdminUser) {
      // Delete from admin_activity_logs
      const { error: logsError } = await supabaseAdmin
        .from('admin_activity_logs')
        .delete()
        .eq('admin_id', identifier)
      if (!logsError) deletedTables.push('admin_activity_logs')

      // Delete from admin_sessions
      const { error: sessionsError } = await supabaseAdmin
        .from('admin_sessions')
        .delete()
        .eq('admin_id', identifier)
      if (!sessionsError) deletedTables.push('admin_sessions')

      // Update security_alerts references
      const { error: alertsError } = await supabaseAdmin
        .from('security_alerts')
        .update({ resolved_by: null })
        .eq('resolved_by', identifier)
      if (!alertsError) deletedTables.push('security_alerts (updated)')

      // Update system_reports references
      const { error: reportsError } = await supabaseAdmin
        .from('system_reports')
        .update({ reviewed_by: null })
        .eq('reviewed_by', identifier)
      if (!reportsError) deletedTables.push('system_reports (updated)')

      // Update content_moderation references
      const { error: moderationError } = await supabaseAdmin
        .from('content_moderation')
        .update({ reviewed_by: null })
        .eq('reviewed_by', identifier)
      if (!moderationError) deletedTables.push('content_moderation (updated)')

      // Delete from admin_users
      const { error: adminError } = await supabaseAdmin
        .from('admin_users')
        .delete()
        .eq('admin_id', identifier)
      if (adminError) throw adminError
      deletedTables.push('admin_users')

      // Delete from auth.users
      try {
        await supabaseAdmin.auth.admin.deleteUser(identifier)
        deletedTables.push('auth.users')
      } catch (authErr) {
        console.warn('Auth deletion warning:', authErr.message)
      }

      result = { success: true, message: 'Admin user deleted successfully', deletedTables }
    } else {
      // For regular users - cascade delete
      // Delete from user_sessions
      const { error: sessionsError } = await supabaseAdmin
        .from('user_sessions')
        .delete()
        .eq('user_id', identifier)
      if (!sessionsError) deletedTables.push('user_sessions')

      // Delete from posts
      const { error: postsError } = await supabaseAdmin
        .from('posts')
        .delete()
        .eq('user_id', identifier)
      if (!postsError) deletedTables.push('posts')

      // Delete from comments
      const { error: commentsError } = await supabaseAdmin
        .from('comments')
        .delete()
        .eq('user_id', identifier)
      if (!commentsError) deletedTables.push('comments')

      // Delete from messages
      const { error: messagesError } = await supabaseAdmin
        .from('messages')
        .delete()
        .or(`sender_id.eq.${identifier},receiver_id.eq.${identifier}`)
      if (!messagesError) deletedTables.push('messages')

      // Delete from barter_listings
      const { error: barterError } = await supabaseAdmin
        .from('barter_listings')
        .delete()
        .eq('user_id', identifier)
      if (!barterError) deletedTables.push('barter_listings')

      // Delete from barter_requests
      const { error: requestsError } = await supabaseAdmin
        .from('barter_requests')
        .delete()
        .eq('requester_id', identifier)
      if (!requestsError) deletedTables.push('barter_requests')

      // Delete from advertisements
      const { error: adsError } = await supabaseAdmin
        .from('advertisements')
        .delete()
        .eq('user_id', identifier)
      if (!adsError) deletedTables.push('advertisements')

      // Delete from payments
      const { error: paymentsError } = await supabaseAdmin
        .from('payments')
        .delete()
        .eq('user_id', identifier)
      if (!paymentsError) deletedTables.push('payments')

      // Delete from ai_chat_history
      const { error: chatError } = await supabaseAdmin
        .from('ai_chat_history')
        .delete()
        .eq('user_id', identifier)
      if (!chatError) deletedTables.push('ai_chat_history')

      // Delete from notifications
      const { error: notifError } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', identifier)
      if (!notifError) deletedTables.push('notifications')

      // Delete from audit_logs
      const { error: auditError } = await supabaseAdmin
        .from('audit_logs')
        .delete()
        .eq('user_id', identifier)
      if (!auditError) deletedTables.push('audit_logs')

      // Delete from online_users
      const { error: onlineError } = await supabaseAdmin
        .from('online_users')
        .delete()
        .eq('user_id', identifier)
      if (!onlineError) deletedTables.push('online_users')

      // Finally delete from users
      const { error: userError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('user_id', identifier)
      if (userError) throw userError
      deletedTables.push('users')

      result = { success: true, message: 'User deleted successfully', deletedTables }
    }

    return res.status(200).json(result)
    
  } catch (err) {
    console.error('Delete user error:', err)
    return res.status(500).json({ error: err.message })
  }
}