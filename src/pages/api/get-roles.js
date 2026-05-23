import { createClient } from '@supabase/supabase-js'

// Use service role key to bypass RLS
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
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_roles')
      .select('role_id, role_name, description')
      .order('role_name')

    if (error) {
      return res.status(500).json({ success: false, error: error.message })
    }

    return res.status(200).json({ 
      success: true, 
      roles: data || [],
      count: data?.length || 0
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
}