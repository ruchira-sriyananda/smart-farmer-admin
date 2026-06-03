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

// Get current admin user from session
export const getCurrentAdmin = () => {
  if (typeof window === 'undefined') return null
  const session = localStorage.getItem('adminSession')
  if (!session) return null
  try {
    return JSON.parse(session)
  } catch {
    return null
  }
}

// Check if current user is admin
export const isAdmin = async () => {
  const admin = getCurrentAdmin()
  return !!(admin?.admin?.is_active || admin?.admin?.admin_id)
}

// Safe logging function that handles missing admin_id gracefully
export const safeLogActivity = async (adminId, activityType, description, ipAddress) => {
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
      // Don't throw error for logging failures
      console.warn('Activity logging failed:', error.message)
    }
  } catch (err) {
    console.warn('Failed to log activity:', err.message)
  }
}

// Server-side logging function using service role (bypasses RLS)
export const createAdminClient = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set - admin client not available')
    return null
  }
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

// Wrapper for admin queries with RLS-compatible error handling
export const adminQuery = async (tableName, queryFn) => {
  try {
    // First check if user is admin via session
    const admin = getCurrentAdmin()
    if (!admin?.admin?.admin_id) {
      throw new Error('Unauthorized: Admin access required')
    }
    
    // Try the query
    const result = await queryFn(supabase)
    return result
  } catch (err) {
    // If it's an RLS error, try with service role client
    if (err.message?.includes('row-level security') || err.code === '42501') {
      console.warn('RLS policy blocked query, attempting with service role...')
      const adminClient = createAdminClient()
      if (adminClient) {
        try {
          const result = await queryFn(adminClient)
          return result
        } catch (serviceErr) {
          console.error('Service role query also failed:', serviceErr)
          throw serviceErr
        }
      }
    }
    throw err
  }
}

// Helper to fetch counts with fallback
export const fetchCount = async (tableName, filters = {}) => {
  try {
    let query = supabase.from(tableName).select('*', { count: 'exact', head: true })
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value)
      }
    })
    
    const { count, error } = await query
    
    if (error) throw error
    return { count: count || 0, error: null }
  } catch (err) {
    console.error(`Error fetching count from ${tableName}:`, err)
    return { count: 0, error: err }
  }
}

// Helper to fetch data with pagination
export const fetchData = async (tableName, options = {}) => {
  try {
    let query = supabase.from(tableName).select(options.select || '*')
    
    if (options.orderBy) {
      query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending || false })
    }
    
    if (options.limit) {
      query = query.limit(options.limit)
    }
    
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value)
        }
      })
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return { data: data || [], error: null }
  } catch (err) {
    console.error(`Error fetching data from ${tableName}:`, err)
    return { data: [], error: err }
  }
}

// Helper to get role mapping
export const getRoleMap = async () => {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('role_id, role_name')
    
    if (error) throw error
    
    const roleMap = {}
    data?.forEach(role => {
      roleMap[role.role_name] = role.role_id
    })
    return { roleMap, error: null }
  } catch (err) {
    console.error('Error fetching role map:', err)
    return { roleMap: {}, error: err }
  }
}

// Helper to get users with their role names
export const getUsersWithRoles = async (limit = 10) => {
  try {
    // Fetch users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (usersError) throw usersError
    
    if (!users || users.length === 0) {
      return { data: [], error: null }
    }
    
    // Fetch roles
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('role_id, role_name')
    
    if (rolesError) throw rolesError
    
    const roleMap = {}
    roles?.forEach(role => {
      roleMap[role.role_id] = role.role_name
    })
    
    // Combine data
    const usersWithRoles = users.map(user => ({
      ...user,
      role_name: roleMap[user.role_id] || 'PENDING'
    }))
    
    return { data: usersWithRoles, error: null }
  } catch (err) {
    console.error('Error fetching users with roles:', err)
    return { data: [], error: err }
  }
}

// Helper to get posts with author names
export const getPostsWithAuthors = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        users!posts_user_id_fkey (
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    
    const formattedPosts = data?.map(post => ({
      ...post,
      author_name: post.users?.full_name || 'Anonymous',
      author_email: post.users?.email
    })) || []
    
    return { data: formattedPosts, error: null }
  } catch (err) {
    console.error('Error fetching posts with authors:', err)
    return { data: [], error: err }
  }
}

// Helper to get barter listings with owner names
export const getBarterListingsWithOwners = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('barter_listings')
      .select(`
        *,
        users!barter_listings_user_id_fkey (
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    
    const formattedListings = data?.map(listing => ({
      ...listing,
      owner_name: listing.users?.full_name || 'Anonymous',
      owner_email: listing.users?.email
    })) || []
    
    return { data: formattedListings, error: null }
  } catch (err) {
    console.error('Error fetching barter listings:', err)
    return { data: [], error: err }
  }
}

// Helper to get user growth data
export const getUserGrowthData = async () => {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { data, error } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
    
    if (error) throw error
    
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4']
    const weeklyCounts = [0, 0, 0, 0]
    
    data?.forEach(user => {
      const daysSince = Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
      const weekIndex = Math.floor(daysSince / 7)
      if (weekIndex >= 0 && weekIndex < 4) {
        weeklyCounts[3 - weekIndex]++
      }
    })
    
    return { data: weeklyCounts, error: null }
  } catch (err) {
    console.error('Error fetching user growth:', err)
    return { data: [0, 0, 0, 0], error: err }
  }
}

// Helper to get weekly activity
export const getWeeklyActivity = async () => {
  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { data, error } = await supabase
      .from('posts')
      .select('created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
    
    if (error) throw error
    
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const activityByDay = [0, 0, 0, 0, 0, 0, 0]
    
    data?.forEach(post => {
      const dayIndex = new Date(post.created_at).getDay()
      const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1
      if (adjustedIndex >= 0 && adjustedIndex < 7) {
        activityByDay[adjustedIndex]++
      }
    })
    
    return { data: activityByDay, error: null }
  } catch (err) {
    console.error('Error fetching weekly activity:', err)
    return { data: [0, 0, 0, 0, 0, 0, 0], error: err }
  }
}

