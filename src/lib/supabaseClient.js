// Create a service role client (use only on server-side or in API routes)
export const getServiceRoleClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Delete user from both tables
export const deleteAdminUser = async (adminId, userEmail) => {
  const supabaseAdmin = getServiceRoleClient()
  
  try {
    // 1. Delete from admin_users
    const { error: adminError } = await supabaseAdmin
      .from('admin_users')
      .delete()
      .eq('admin_id', adminId)

    if (adminError) throw adminError

    // 2. Delete from auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(adminId)
    
    if (authError) throw authError

    return { success: true, message: 'User deleted successfully' }
  } catch (err) {
    console.error('Delete user error:', err)
    return { success: false, error: err.message }
  }
}