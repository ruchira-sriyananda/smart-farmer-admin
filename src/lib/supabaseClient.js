import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Safe logging function that handles missing admin_id gracefully
export const safeLogActivity = async (adminId, activityType, description, ipAddress) => {
  // If no adminId, don't try to log (or log with null)
  if (!adminId) {
    console.warn('Cannot log activity: No admin_id provided')
    return
  }

  try {
    const { error } = await supabase
      .from('admin_activity_logs')
      .insert({
        admin_id: adminId,
        activity_type: activityType,
        activity_description: description,
        ip_address: ipAddress || 'unknown',
        created_at: new Date().toISOString()
      })
    
    if (error) {
      console.warn('Activity logging failed:', error.message)
    }
  } catch (err) {
    console.warn('Failed to log activity:', err.message)
  }
}

// Server-side logging function using service role
export const createAdminClient = () => {
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