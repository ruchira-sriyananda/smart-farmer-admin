import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client for middleware (server-side)
const createSupabaseClient = () => {
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

export async function middleware(request) {
  const { pathname } = request.nextUrl
  
  // Only check for admin routes
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    try {
      // Get client IP
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                 request.headers.get('x-real-ip') || 
                 'unknown'
      
      // Create Supabase client
      const supabase = createSupabaseClient()
      
      // Check if IP is blacklisted
      const { data: blacklisted, error } = await supabase
        .from('ip_blacklist')
        .select('ip_address, blocked_reason')
        .eq('ip_address', ip)
        .maybeSingle()
      
      if (blacklisted) {
        // IP is blocked - redirect to blocked page
        const url = new URL('/admin/blocked', request.url)
        return NextResponse.redirect(url)
      }
    } catch (err) {
      console.error('Middleware IP check error:', err)
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*'
}