export const permissions = {
  'super_admin': ['all'],
  'moderator': ['manage_users', 'manage_posts', 'view_reports'],
  'viewer': ['view_dashboard', 'view_users']
}

export function hasPermission(adminRole, requiredPermission) {
  const rolePermissions = permissions[adminRole]
  if (!rolePermissions) return false
  if (rolePermissions.includes('all')) return true
  return rolePermissions.includes(requiredPermission)
}