import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''

// During build time on Vercel, env vars might be missing initially.
// We warn instead of throwing to allow the build to proceed if possible,
// though actual database features will fail until vars are provided.
if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.error('Missing Supabase environment variables')
  } else {
    console.warn('Supabase environment variables are missing. Database features will be unavailable.')
  }
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : new Proxy({}, {
      get: (target, prop) => {
        if (prop === 'supabaseUrl') return supabaseUrl || 'https://uhrolwwkxenvcefnessp.supabase.co'
        if (prop === 'from') {
          return () => ({
            select: () => ({ order: () => ({ limit: () => ({}) }), eq: () => ({ maybeSingle: () => ({}) }) }),
            insert: () => ({}),
            update: () => ({ eq: () => ({}) }),
            delete: () => ({ eq: () => ({}) })
          })
        }
        return () => {
          console.warn(`Supabase client is not fully initialized. Property accessed: ${prop}`)
          return { data: null, error: null }
        }
      }
    })

/**
 * Robustly resolves an image path or Base64 string to a full public URL or Data URI.
 * Handles:
 * - Data URIs (data:image/...)
 * - Raw Base64 encoded strings from mobile app (JPEG/PNG/GIF/WebP magic bytes or long Base64)
 * - Full HTTP(S) URLs (rewriting legacy Supabase domains to active project domain)
 * - Relative storage paths and bucket fallbacks
 */
export const resolveImageUrl = (path, defaultBucket = 'post-images') => {
  if (!path) return null
  const cleanPath = path.toString().trim()
  if (!cleanPath) return null

  // 1. Data URI already prefixed
  if (cleanPath.startsWith('data:')) {
    return cleanPath
  }

  // 2. Base64 encoded image strings from Android app (ImageUtils.java)
  // Common Base64 image headers:
  // /9j/ = JPEG, iVBOR = PNG, R0lGO = GIF, UklGR = WebP, Qk = BMP
  if (cleanPath.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${cleanPath.replace(/\s+/g, '')}`
  }
  if (cleanPath.startsWith('iVBOR')) {
    return `data:image/png;base64,${cleanPath.replace(/\s+/g, '')}`
  }
  if (cleanPath.startsWith('R0lGO')) {
    return `data:image/gif;base64,${cleanPath.replace(/\s+/g, '')}`
  }
  if (cleanPath.startsWith('UklGR')) {
    return `data:image/webp;base64,${cleanPath.replace(/\s+/g, '')}`
  }
  if (cleanPath.startsWith('Qk')) {
    return `data:image/bmp;base64,${cleanPath.replace(/\s+/g, '')}`
  }

  // General heuristic for un-prefixed Base64 strings (length > 100 with valid Base64 characters)
  const isBase64Pattern = /^[A-Za-z0-9+/=\s]+$/
  if (cleanPath.length > 100 && isBase64Pattern.test(cleanPath)) {
    return `data:image/jpeg;base64,${cleanPath.replace(/\s+/g, '')}`
  }

  // Priority project URLs - ensure NO trailing slash
  let supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://uhrolwwkxenvcefnessp.supabase.co'
  ).trim()
  if (supabaseUrl.endsWith('/')) {
    supabaseUrl = supabaseUrl.slice(0, -1)
  }

  // 3. Handle full HTTP(S) URLs
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    // If it's a Supabase storage URL (from ANY domain, e.g. old project domain),
    // rewrite it to use current active supabaseUrl so it resolves properly!
    if (cleanPath.includes('/storage/v1/object/public/')) {
      const pathAfterPublic = cleanPath.substring(
        cleanPath.indexOf('/storage/v1/object/public/') + '/storage/v1/object/public/'.length
      )
      return `${supabaseUrl}/storage/v1/object/public/${pathAfterPublic}`
    }
    return cleanPath
  }

  // Strip leading slash from path
  let finalPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath

  // 4. If path already starts with storage/
  if (finalPath.startsWith('storage/')) {
    return `${supabaseUrl}/${finalPath}`
  }

  // 5. If path already includes a bucket structure (e.g. "post-images/123.jpg" or "barters/xyz.png")
  if (finalPath.includes('/')) {
    return `${supabaseUrl}/storage/v1/object/public/${finalPath}`
  }

  // 6. If it's just a filename, use the provided default bucket
  return `${supabaseUrl}/storage/v1/object/public/${defaultBucket}/${finalPath}`
}

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

// Helper to get activity heatmap data
export const getActivityHeatmapData = async (days = 30) => {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('admin_activity_logs')
      .select('created_at')
      .gte('created_at', startDate.toISOString())

    if (error) throw error

    const heatmap = Array(7).fill(0).map(() => Array(24).fill(0))
    data?.forEach(log => {
      const date = new Date(log.created_at)
      heatmap[date.getDay()][date.getHours()]++
    })

    return { data: heatmap, error: null }
  } catch (err) {
    console.error('Error fetching heatmap data:', err)
    return { data: [], error: err }
  }
}

// Helper to get advanced activity distribution
export const getAdvancedActivityDistribution = async (days = 30) => {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('admin_activity_logs')
      .select('activity_type')
      .gte('created_at', startDate.toISOString())

    if (error) throw error

    const counts = {}
    data?.forEach(log => {
      counts[log.activity_type] = (counts[log.activity_type] || 0) + 1
    })

    return { data: counts, error: null }
  } catch (err) {
    console.error('Error fetching activity distribution:', err)
    return { data: {}, error: err }
  }
}

// Helper to log a security alert safely
export const safeLogSecurityAlert = async (alertType, severityLevel, message, detectedIp) => {
  try {
    const { error } = await supabase
      .from('security_alerts')
      .insert({
        alert_type: alertType,
        severity_level: severityLevel, // 'HIGH', 'MEDIUM', 'LOW'
        alert_message: message,
        detected_ip: detectedIp || 'unknown',
        resolved: false,
        created_at: new Date().toISOString()
      })
    if (error) console.warn('Failed to insert security alert:', error.message)
  } catch (err) {
    console.warn('Security alert logging exception:', err.message)
  }
}

// Helper to calculate security health score (0 - 100)
export const calculateSecurityHealthScore = (settings = {}, stats = {}) => {
  let score = 60 // Base score

  // 1. 2FA Configuration (+15)
  if (settings.enable_2fa) score += 10
  if (settings.enforce_super_admin_2fa) score += 5

  // 2. Password Policy Strength (+15)
  if (Number(settings.password_min_length) >= 10) score += 5
  if (settings.password_require_uppercase && settings.password_require_number && settings.password_require_special_char) score += 10

  // 3. Brute Force Protection & reCAPTCHA (+10)
  if (settings.enable_recaptcha) score += 5
  if (Number(settings.max_login_attempts) <= 5) score += 5

  // 4. Session Security (+10)
  if (Number(settings.session_timeout_minutes) <= 30) score += 5
  if (settings.enable_ip_binding) score += 5

  // Deductions for high active security alerts
  const highAlerts = stats.highSeverity || 0
  const totalAlerts = stats.totalAlerts || 0
  score -= (highAlerts * 10)
  score -= (totalAlerts * 2)

  return Math.min(100, Math.max(15, score))
}


