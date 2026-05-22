import { supabase } from '@/lib/supabaseClient'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { adminId, fullName } = req.body

  if (!adminId) {
    return res.status(400).json({ error: 'Admin ID required' })
  }

  try {
    // Test update
    const { data, error } = await supabase
      .from('admin_users')
      .update({ 
        full_name: fullName || 'Test Update',
        updated_at: new Date().toISOString()
      })
      .eq('admin_id', adminId)
      .select()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Update successful',
      data: data 
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}