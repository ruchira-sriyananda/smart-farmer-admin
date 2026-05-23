import { supabase } from '@/lib/supabaseClient'

export default async function handler(req, res) {
  try {
    // Try different queries to find the issue
    const results = {
      direct_select: null,
      count: null,
      error: null,
      column_names: null
    }

    // Try direct select
    const { data, error } = await supabase
      .from('admin_roles')
      .select('*')

    results.direct_select = data
    results.error = error?.message

    // Try count
    const { count, error: countError } = await supabase
      .from('admin_roles')
      .select('*', { count: 'exact', head: true })

    results.count = count
    results.count_error = countError?.message

    // Get column names
    const { data: columns } = await supabase
      .rpc('get_table_columns', { table_name: 'admin_roles' })
      .catch(() => null)

    results.column_names = columns

    return res.status(200).json(results)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}