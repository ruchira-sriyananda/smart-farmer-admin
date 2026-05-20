import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function AdminDashboard() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedSession = localStorage.getItem('adminSession')
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession)

        // Validate required fields
        if (!parsed?.admin?.full_name || !parsed?.role) {
          router.push('/admin/login')
        } else {
          setSession(parsed)
        }
      } catch (err) {
        console.error('Invalid session data', err)
        router.push('/admin/login')
      }
    } else {
      router.push('/admin/login')
    }
    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-100">
        <p>Loading dashboard...</p>
      </div>
    )
  }

  if (!session) {
    return null // prevent rendering until redirect happens
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-green-600 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600 mb-4">
          Welcome, <strong>{session.admin.full_name}</strong> <br />
          <span className="text-sm text-gray-500">Role: {session.role}</span>
        </p>
        <button 
          onClick={() => {
            localStorage.removeItem('adminSession')
            document.cookie = 'admin-session=; path=/; max-age=0; samesite=lax'
            router.push('/admin/login')
          }}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
