import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function BlockedPage() {
  const router = useRouter()

  useEffect(() => {
    // Auto redirect to login after 5 seconds (in case of false positive)
    const timer = setTimeout(() => {
      router.push('/admin/login')
    }, 5000)
    
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="text-center">
        <div className="bg-white rounded-circle d-flex align-items-center justify-content-center mx-auto mb-4" style={{ width: '80px', height: '80px' }}>
          <i className="bi bi-ban fs-1 text-danger"></i>
        </div>
        <h1 className="text-white mb-3">Access Denied</h1>
        <p className="text-white-50 mb-4">
          Your IP address has been blocked from accessing the admin panel.<br />
          Please contact the system administrator if you believe this is an error.
        </p>
        <div className="bg-white bg-opacity-10 rounded p-3 d-inline-block">
          <code className="text-white">IP Blocked</code>
        </div>
        <p className="text-white-50 mt-4 small">
          Redirecting to login page in 5 seconds...
        </p>
      </div>
    </div>
  )
}