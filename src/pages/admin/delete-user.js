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

  const { adminId, userId, userEmail } = req.body

  if (!adminId && !userId && !userEmail) {
    return res.status(400).json({ error: 'User identifier required' })
  }

  try {
    // First, delete from admin_users table
    let deleteQuery = supabaseAdmin.from('admin_users').delete()
    
    if (adminId) {
      deleteQuery = deleteQuery.eq('admin_id', adminId)
    } else if (userId) {
      deleteQuery = deleteQuery.eq('admin_id', userId)
    } else if (userEmail) {
      deleteQuery = deleteQuery.eq('email', userEmail)
    }
    
    const { error: adminDeleteError } = await deleteQuery

    if (adminDeleteError) {
      console.error('Admin delete error:', adminDeleteError)
      return res.status(500).json({ error: 'Failed to delete from admin_users: ' + adminDeleteError.message })
    }

    // Second, delete from Supabase Auth
    let authUserId = userId || adminId
    
    if (!authUserId && userEmail) {
      // If we only have email, first get the user ID from auth
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      
      if (listError) {
        console.error('List users error:', listError)
      } else {
        const foundUser = authUsers.users.find(u => u.email === userEmail)
        if (foundUser) {
          authUserId = foundUser.id
        }
      }
    }
    
    if (authUserId) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authUserId)
      
      if (authDeleteError) {
        console.error('Auth delete error:', authDeleteError)
        return res.status(200).json({ 
          success: true, 
          warning: 'User deleted from admin panel but auth deletion failed. Manual cleanup may be needed.',
          authError: authDeleteError.message
        })
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'User deleted successfully from both admin panel and authentication' 
    })
    
  } catch (err) {
    console.error('Delete user error:', err)
    return res.status(500).json({ error: err.message })
  }
}