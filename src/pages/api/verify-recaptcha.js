export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { token } = req.body

  if (!token) {
    return res.status(400).json({ success: false, error: 'Missing token' })
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`
    })

    const data = await response.json()
    
    if (data.success && data.score >= 0.5) {
      return res.status(200).json({ success: true })
    } else {
      return res.status(400).json({ success: false, error: 'Verification failed' })
    }
  } catch (error) {
    console.error('reCAPTCHA verification error:', error)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
}