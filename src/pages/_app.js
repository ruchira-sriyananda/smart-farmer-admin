import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { AuthProvider } from '@/contexts/AuthContext'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@/styles/globals.css'

function MyApp({ Component, pageProps }) {
  const router = useRouter()

  useEffect(() => {
    // Load Bootstrap JS only on client side
    import('bootstrap/dist/js/bootstrap.bundle.min.js')
  }, [])

  // Check if route requires authentication
  const isAdminRoute = router.pathname.startsWith('/admin')
  const isLoginPage = router.pathname === '/admin/login'

  if (isAdminRoute && !isLoginPage) {
    return (
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    )
  }

  return <Component {...pageProps} />
}

export default MyApp  