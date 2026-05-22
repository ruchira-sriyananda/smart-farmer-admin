import { createClient } from '@supabase/supabase-js'

// Use service role key for server-side logging (bypasses RLS)
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

  const { adminId, activityType, description, ipAddress } = req.body

  if (!adminId || !activityType) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const { error } = await supabaseAdmin
      .from('admin_activity_logs')
      .insert({
        admin_id: adminId,
        activity_type: activityType,
        activity_description: description,
        ip_address: ipAddress || 'unknown',
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Logging error:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Server error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}