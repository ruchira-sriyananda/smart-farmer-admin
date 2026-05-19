// src/proxy.js
import { NextResponse } from 'next/server'

export const config = {
  matcher: '/admin/:path*'
}

export function proxy(request) {
  // Protect admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const adminSession = request.cookies.get('admin-session')
    
    if (request.nextUrl.pathname !== '/admin/login' && !adminSession) {
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  return NextResponse.next()
}