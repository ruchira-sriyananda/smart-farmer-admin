import { createClient } from '@supabase/supabase-js'

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
      // For regular users - you can implement similar cascade delete
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