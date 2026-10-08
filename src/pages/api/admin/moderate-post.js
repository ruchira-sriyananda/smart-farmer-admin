import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { postId, status, reason, adminId, postTitle, userId } = req.body

  if (!postId || !status) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const finalReason = reason || null

    // 1. Check existing moderation record
    const { data: existingMod } = await supabaseAdmin
      .from('content_moderation')
      .select('moderation_id')
      .eq('content_id', postId)
      .eq('content_type', 'POST')
      .maybeSingle()

    const moderationData = {
      content_id: postId,
      content_type: 'POST',
      moderation_status: status,
      reviewed_by: adminId || null,
      reviewed_at: new Date().toISOString(),
      moderation_reason: finalReason
    }

    if (existingMod?.moderation_id) {
      const { error: modErr } = await supabaseAdmin
        .from('content_moderation')
        .update(moderationData)
        .eq('moderation_id', existingMod.moderation_id)
      if (modErr) throw modErr
    } else {
      const { error: modErr } = await supabaseAdmin
        .from('content_moderation')
        .insert(moderationData)
      if (modErr) throw modErr
    }

    // 2. Update posts table
    const postsUpdatePayload = {
      status: status,
      moderation_status: status,
      rejection_reason: status === 'REJECTED' ? finalReason : null,
      rejected_reason: status === 'REJECTED' ? finalReason : null,
      moderation_reason: status === 'REJECTED' ? finalReason : null,
      ...(status === 'REJECTED' ? {
        title: '⚠️ [Content Removed - Rejected Post]',
        content: `This post has been removed from public view due to a violation. Reason: ${finalReason}`,
        image_url: 'https://placehold.co/600x400/fee2e2/dc2626?text=Content+Removed'
      } : {}),
      updated_at: new Date().toISOString()
    }

    const { error: postErr } = await supabaseAdmin
      .from('posts')
      .update(postsUpdatePayload)
      .eq('post_id', postId)

    if (postErr) throw postErr

    // 3. Update post_images if rejected
    if (status === 'REJECTED') {
      await supabaseAdmin.from('post_images').delete().eq('post_id', postId)
      await supabaseAdmin.from('post_images').insert({
        post_id: postId,
        image_url: 'https://placehold.co/600x400/fee2e2/dc2626?text=Content+Removed',
        image_order: 1
      })

      // 4. Insert notification for user if rejected
      if (userId) {
        try {
          await supabaseAdmin
            .from('notifications')
            .insert({
              user_id: userId,
              title: 'Post Rejected',
              message: `Your post "${postTitle || 'Untitled Post'}" was rejected. Reason: ${finalReason}`,
              type: 'POST_REJECTED',
              related_id: postId,
              is_read: false,
              created_at: new Date().toISOString()
            })
        } catch (notifErr) {
          console.warn('User notification insert warning:', notifErr.message)
        }
      }
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Moderation API error:', err)
    return res.status(500).json({ error: err.message })
  }
}
