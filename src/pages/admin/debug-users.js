import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function DebugUsers() {
  const [debugData, setDebugData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    debugDatabase()
  }, [])

  const debugDatabase = async () => {
    const results = {}
    
    // 1. Check users table structure
    const { data: columns, error: columnsError } = await supabase
      .from('users')
      .select('*')
      .limit(1)
    
    results.tableStructure = {
      hasData: columns && columns.length > 0,
      sampleColumns: columns && columns[0] ? Object.keys(columns[0]) : [],
      error: columnsError?.message
    }
    
    // 2. Get total user count
    const { count: totalCount, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
    
    results.totalUsers = { count: totalCount || 0, error: countError?.message }
    
    // 3. Get all users (first 10)
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(10)
    
    results.sampleUsers = { data: allUsers || [], error: usersError?.message }
    
    // 4. Check roles table
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('*')
    
    results.roles = { data: roles || [], error: rolesError?.message }
    
    // 5. Check if users have role_id
    const usersWithRoles = allUsers?.filter(u => u.role_id) || []
    results.usersWithRoles = { count: usersWithRoles.length, sample: usersWithRoles.slice(0, 3) }
    
    // 6. Try to fetch with join
    const { data: joinedData, error: joinError } = await supabase
      .from('users')
      .select(`
        *,
        roles!left (
          role_id,
          role_name
        )
      `)
      .limit(5)
    
    results.joinedData = { data: joinedData || [], error: joinError?.message }
    
    setDebugData(results)
    setLoading(false)
  }

  if (loading) {
    return (
      <AdminLayout title="Debug">
        <div className="text-center py-5">
          <div className="spinner-border text-primary"></div>
          <p>Debugging database...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Database Debug">
      <div className="container py-4">
        <h2 className="mb-4">🔍 Database Debug Information</h2>
        
        {/* Total Users */}
        <div className="card mb-4">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">📊 Total Users in Database</h5>
          </div>
          <div className="card-body">
            <h1 className="display-1 text-center">{debugData.totalUsers?.count}</h1>
            {debugData.totalUsers?.error && (
              <div className="alert alert-danger">{debugData.totalUsers.error}</div>
            )}
          </div>
        </div>
        
        {/* Table Structure */}
        <div className="card mb-4">
          <div className="card-header bg-info text-white">
            <h5 className="mb-0">📋 Users Table Structure</h5>
          </div>
          <div className="card-body">
            <p><strong>Columns found:</strong></p>
            <div className="bg-light p-3 rounded">
              <code>{JSON.stringify(debugData.tableStructure?.sampleColumns, null, 2)}</code>
            </div>
          </div>
        </div>
        
        {/* Sample Users */}
        <div className="card mb-4">
          <div className="card-header bg-success text-white">
            <h5 className="mb-0">👥 Sample Users (First 10)</h5>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-striped mb-0">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Role ID</th>
                    <th>Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {debugData.sampleUsers?.data?.map((user, idx) => (
                    <tr key={idx}>
                      <td><code>{user.user_id?.slice(0, 8)}...</code></td>
                      <td>{user.full_name || 'NULL'}</td>
                      <td>{user.email || 'NULL'}</td>
                      <td>{user.role_id || 'NULL'}</td>
                      <td>{user.is_verified ? '✅ Yes' : '❌ No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* Roles Table */}
        <div className="card mb-4">
          <div className="card-header bg-warning text-dark">
            <h5 className="mb-0">🔑 Roles Table</h5>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-striped mb-0">
                <thead>
                  <tr>
                    <th>Role ID</th>
                    <th>Role Name</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {debugData.roles?.data?.map((role, idx) => (
                    <tr key={idx}>
                      <td><code>{role.role_id?.slice(0, 8)}...</code></td>
                      <td><strong>{role.role_name}</strong></td>
                      <td>{role.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* Users with Roles */}
        <div className="card mb-4">
          <div className="card-header bg-secondary text-white">
            <h5 className="mb-0">👥 Users with Assigned Roles</h5>
          </div>
          <div className="card-body">
            <p><strong>Count:</strong> {debugData.usersWithRoles?.count} out of {debugData.totalUsers?.count}</p>
            {debugData.usersWithRoles?.sample?.length > 0 && (
              <pre className="bg-light p-3 rounded">
                {JSON.stringify(debugData.usersWithRoles.sample, null, 2)}
              </pre>
            )}
          </div>
        </div>
        
        {/* Join Query Result */}
        <div className="card">
          <div className="card-header bg-danger text-white">
            <h5 className="mb-0">🔗 Join Query Result (Users + Roles)</h5>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-striped mb-0">
                <thead>
                  <tr>
                    <th>User Name</th>
                    <th>Role Name</th>
                    <th>Role ID</th>
                  </tr>
                </thead>
                <tbody>
                  {debugData.joinedData?.data?.map((user, idx) => (
                    <tr key={idx}>
                      <td>{user.full_name}</td>
                      <td>
                        {user.roles ? (
                          <span className="badge bg-success">{user.roles.role_name}</span>
                        ) : (
                          <span className="badge bg-secondary">No Role Assigned</span>
                        )}
                      </td>
                      <td><code>{user.role_id || 'NULL'}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Refresh Debug Info
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}