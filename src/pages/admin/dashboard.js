// After successful authentication and admin check
const sessionData = {
  user: {
    id: authData.user.id,
    email: authData.user.email,
    created_at: authData.user.created_at
  },
  admin: {
    admin_id: adminData.admin_id,
    full_name: adminData.full_name,
    email: adminData.email,
    is_active: adminData.is_active,
    is_super_admin: adminData.is_super_admin,
    role_id: adminData.role_id
  },
  role: role,
  sessionId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
  loggedInAt: new Date().toISOString(),
  ipAddress: await getClientIP()
}

console.log('Storing session:', sessionData) // Debug log
localStorage.setItem('adminSession', JSON.stringify(sessionData))