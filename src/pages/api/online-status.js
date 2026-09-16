import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Use Admin client to bypass RLS for status tracking
const supabaseAdmin = createClient(
  supabaseUrl || 'https://uhrolwwkxenvcefnessp.supabase.co',
  serviceRoleKey || '',
  { auth: { persistSession: false } }
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!serviceRoleKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is missing for online-status')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    const { userId, userEmail, userName, userRole, ipAddress, deviceInfo } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' })
    }

    // First, update or insert online status
    const { error: upsertError } = await supabaseAdmin
      .from('online_users')
      .upsert({
        user_id: userId,
        user_email: userEmail || 'unknown',
        user_name: userName || 'Admin',
        user_role: userRole || 'ADMIN',
        last_activity: new Date().toISOString(),
        ip_address: ipAddress || 'unknown',
        device_info: deviceInfo || 'unknown'
      }, {
        onConflict: 'user_id'
      })

    if (upsertError) {
      console.error('Upsert online_users error:', upsertError)
      // Check if table exists error (code 42P01)
      if (upsertError.code === '42P01') {
        return res.status(500).json({ error: 'Database table online_users does not exist' })
      }
      throw upsertError
    }

    // Cleanup old sessions (older than 5 minutes)
    await supabaseAdmin
      .from('online_users')
      .delete()
      .lt('last_activity', new Date(Date.now() - 5 * 60 * 1000).toISOString())

    // Get current online count
    const { count, error: countError } = await supabaseAdmin
      .from('online_users')
      .select('*', { count: 'exact', head: true })

    return res.status(200).json({ 
      success: true, 
      onlineCount: count || 0
    })
  } catch (err) {
    console.error('Error updating online status:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}