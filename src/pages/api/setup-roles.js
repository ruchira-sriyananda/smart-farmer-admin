import { supabase } from '@/lib/supabaseClient'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Insert roles
    const roles = [
      { role_name: 'SUPER_ADMIN', description: 'Full system access - all permissions' },
      { role_name: 'CONTENT_ADMIN', description: 'Manage content, posts, and comments' },
      { role_name: 'SECURITY_ADMIN', description: 'Manage security settings and monitor threats' },
      { role_name: 'SUPPORT_ADMIN', description: 'Handle user support and tickets' },
      { role_name: 'FARMER', description: 'Registered farmer user' },
      { role_name: 'VENDOR', description: 'Agricultural vendor/supplier' }
    ]

    let inserted = 0
    let existing = 0

    for (const role of roles) {
      const { data, error } = await supabase
        .from('roles')
        .upsert(role, { onConflict: 'role_name' })
        .select()

      if (!error && data) inserted++
      else existing++
    }

    // Get all roles
    const { data: allRoles } = await supabase
      .from('roles')
      .select('*')
      .order('role_name')

    return res.status(200).json({
      success: true,
      message: `Roles setup complete: ${inserted} inserted, ${existing} already existed`,
      roles: allRoles
    })
  } catch (err) {
    console.error('Error:', err)
    return res.status(500).json({ error: err.message })
  }
}