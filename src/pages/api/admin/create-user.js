import { createClient } from '@supabase/supabase-js'

// Use service role key to bypass RLS and trigger restrictions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('CRITICAL: Supabase environment variables missing in API route')
}

const supabaseAdmin = createClient(
  supabaseUrl || 'https://uhrolwwkxenvcefnessp.supabase.co',
  serviceRoleKey || '',
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

  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing' })
  }

  const { full_name, email, password, role_id, is_active, is_super_admin } = req.body

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // 1. Check if user already exists in admin_users
    const { data: existingAdmin } = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    if (existingAdmin) {
      return res.status(400).json({ error: 'An administrator with this email already exists' })
    }

    // 2. Create user in Supabase Auth using admin API
    // Setting email_confirm: true bypasses the confirmation email requirement
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name },
      email_confirm: true
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      return res.status(400).json({ error: authError.message })
    }

    if (!authData.user) {
      return res.status(500).json({ error: 'Failed to create auth user' })
    }

    // 3. Insert into admin_users table
    const adminData = {
      admin_id: authData.user.id,
      full_name,
      email,
      password_hash: 'managed_by_auth',
      is_active: is_active !== undefined ? is_active : true,
      is_super_admin: is_super_admin !== undefined ? is_super_admin : false,
      role_id: role_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { error: dbError } = await supabaseAdmin
      .from('admin_users')
      .insert(adminData)

    if (dbError) {
      console.error('Database insert error:', dbError)
      // Attempt to rollback auth user creation if DB insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return res.status(500).json({ error: `User account created but database record failed: ${dbError.message}` })
    }

    return res.status(200).json({
      success: true,
      message: 'Administrator created successfully',
      user: authData.user
    })

  } catch (err) {
    console.error('Create admin error:', err)
    return res.status(500).json({ error: err.message })
  }
}
