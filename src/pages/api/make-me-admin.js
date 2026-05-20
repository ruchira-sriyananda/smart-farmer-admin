import { supabase } from '@/lib/supabaseClient';

export default async function handler(req, res) {
  // Only allow this in development!
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    // Get the user from auth
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) throw userError;
    
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found in auth' });
    }

    // Check if already admin
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingAdmin) {
      return res.status(400).json({ error: 'User is already an admin' });
    }

    // Add to admin_users
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .insert({
        full_name: user.user_metadata?.full_name || 'Admin User',
        email: user.email,
        password_hash: 'managed_by_supabase_auth',
        role_id: (await getSuperAdminRoleId()),
        is_active: true,
        is_super_admin: true
      })
      .select();

    if (adminError) throw adminError;

    res.status(200).json({ 
      success: true, 
      message: 'Admin user created successfully',
      admin: adminData 
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getSuperAdminRoleId() {
  const { data } = await supabase
    .from('admin_roles')
    .select('role_id')
    .eq('role_name', 'SUPER_ADMIN')
    .single();
  
  return data?.role_id;
}