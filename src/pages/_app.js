import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { AuthProvider } from '@/contexts/AuthContext'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@/styles/globals.css'

function MyApp({ Component, pageProps }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load Bootstrap JS only on client side
  useEffect(() => {
    if (mounted) {
      import('bootstrap/dist/js/bootstrap.bundle.min.js')
        .catch(err => console.error('Failed to load Bootstrap JS:', err))
    }
  }, [mounted])

  // Handle route changes for loading state
  useEffect(() => {
    const handleStart = () => setLoading(true)
    const handleComplete = () => setLoading(false)

    router.events.on('routeChangeStart', handleStart)
    router.events.on('routeChangeComplete', handleComplete)
    router.events.on('routeChangeError', handleComplete)

    return () => {
      router.events.off('routeChangeStart', handleStart)
      router.events.off('routeChangeComplete', handleComplete)
      router.events.off('routeChangeError', handleComplete)
    }
  }, [router])

  // Check if route requires authentication
  const isAdminRoute = router.pathname.startsWith('/admin')
  const isLoginPage = router.pathname === '/admin/login'
  const isPublicRoute = router.pathname === '/' || router.pathname === '/api/auth/callback'

  // Show loading spinner during route changes
  if (loading && mounted) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Loading please wait...</p>
        </div>
      </div>
    )
  }

  // Apply authentication wrapper for admin routes (excluding login page)
  if (isAdminRoute && !isLoginPage && !isPublicRoute) {
    return (
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    )
  }

  return <Component {...pageProps} />
}

export default MyApp