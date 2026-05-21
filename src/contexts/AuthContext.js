import { createContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const session = localStorage.getItem('adminSession')
    if (session) {
      setAdmin(JSON.parse(session))
    }
    setLoading(false)
  }

  const logout = async () => {
    localStorage.removeItem('adminSession')
    await supabase.auth.signOut()
    setAdmin(null)
  }

  return (
    <AuthContext.Provider value={{ admin, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}