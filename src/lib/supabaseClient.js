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

// Safe logging function that handles RLS errors gracefully
export const safeLogActivity = async (adminId, activityType, description, ipAddress) => {
  try {
    const { error } = await supabase
      .from('admin_activity_logs')
      .insert({
        admin_id: adminId,
        activity_type: activityType,
        activity_description: description,
        ip_address: ipAddress,
        created_at: new Date().toISOString()
      })
    
    if (error) {
      console.warn('Activity logging failed (RLS may be blocking):', error.message)
      // Don't throw - logging failure shouldn't break the main flow
    }
  } catch (err) {
    console.warn('Failed to log activity:', err.message)
  }
}

// For development - bypass RLS (use only in development)
export const devLogActivity = async (adminId, activityType, description, ipAddress) => {
  if (process.env.NODE_ENV !== 'production') {
    try {
      // Use service role key for development (bypass RLS)
      const serviceClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
      
      await serviceClient
        .from('admin_activity_logs')
        .insert({
          admin_id: adminId,
          activity_type: activityType,
          activity_description: description,
          ip_address: ipAddress,
          created_at: new Date().toISOString()
        })
    } catch (err) {
      console.warn('Dev logging failed:', err.message)
    }
  }
}