import { supabase } from '@/lib/supabaseClient'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, userEmail, userName, userRole, ipAddress, deviceInfo } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' })
    }

    // Generate a session ID
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)

    // First, update or insert online status
    const { error: upsertError } = await supabase
      .from('online_users')
      .upsert({
        session_id: sessionId,
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        user_role: userRole,
        last_activity: new Date().toISOString(),
        ip_address: ipAddress,
        device_info: deviceInfo
      }, {
        onConflict: 'user_id'
      })

    if (upsertError) throw upsertError

    // Cleanup old sessions (older than 5 minutes)
    await supabase
      .from('online_users')
      .delete()
      .lt('last_activity', new Date(Date.now() - 5 * 60 * 1000).toISOString())

    // Get current online count
    const { count, error: countError } = await supabase
      .from('online_users')
      .select('*', { count: 'exact', head: true })

    if (countError) throw countError

    return res.status(200).json({ 
      success: true, 
      onlineCount: count || 0,
      message: 'Status updated successfully'
    })
  } catch (err) {
    console.error('Error updating online status:', err)
    return res.status(500).json({ error: err.message })
  }
}