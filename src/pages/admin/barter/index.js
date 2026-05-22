import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '@/components/AdminLayout'

export default function BarterTransactions() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    cancelled: 0
  })

  useEffect(() => {
    fetchTransactions()
    
    // Real-time subscription
    const subscription = supabase
      .channel('barter_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'system_analytics' },
        () => fetchTransactions()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [])

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('system_analytics')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        setTransactions(data)
        calculateStats(data)
      }
    } catch (err) {
      console.error('Error fetching transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data) => {
    setStats({
      total: data.reduce((sum, t) => sum + (t.total_barter_transactions || 0), 0),
      completed: data.reduce((sum, t) => sum + (t.completed_barter || 0), 0),
      pending: data.reduce((sum, t) => sum + (t.pending_barter || 0), 0),
      cancelled: data.reduce((sum, t) => sum + (t.cancelled_barter || 0), 0)
    })
  }

  if (loading) {
    return (
      <AdminLayout title="Barter Transactions">
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Barter Transactions">
      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <div className="card border-0 bg-primary bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Total Transactions</h6>
              <h2 className="fw-bold">{stats.total}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-success bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Completed</h6>
              <h2 className="fw-bold text-success">{stats.completed}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-warning bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Pending</h6>
              <h2 className="fw-bold text-warning">{stats.pending}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 bg-danger bg-opacity-10">
            <div className="card-body">
              <h6 className="text-muted">Cancelled</h6>
              <h2 className="fw-bold text-danger">{stats.cancelled}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="bg-light">
                <tr>
                  <th>Date</th>
                  <th>Total Transactions</th>
                  <th>Completed</th>
                  <th>Pending</th>
                  <th>Cancelled</th>
                  <th>Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.analytics_id}>
                    <td>{new Date(tx.generated_at).toLocaleDateString()}</td>
                    <td>{tx.total_barter_transactions || 0}</td>
                    <td className="text-success">{tx.completed_barter || 0}</td>
                    <td className="text-warning">{tx.pending_barter || 0}</td>
                    <td className="text-danger">{tx.cancelled_barter || 0}</td>
                    <td>
                      {tx.total_barter_transactions > 0 
                        ? Math.round((tx.completed_barter / tx.total_barter_transactions) * 100) 
                        : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}