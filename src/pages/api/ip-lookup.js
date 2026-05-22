export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { ip } = req.body

  if (!ip) {
    return res.status(400).json({ error: 'IP address required' })
  }

  try {
    // Use ip-api.com for IP geolocation (free, no API key required)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,isp,org,query`)
    const data = await response.json()

    if (data.status === 'success') {
      return res.status(200).json({
        ip: data.query,
        country: data.country,
        city: data.city,
        isp: data.isp,
        organization: data.org
      })
    } else {
      return res.status(404).json({ error: 'IP not found' })
    }
  } catch (error) {
    console.error('IP lookup error:', error)
    return res.status(500).json({ error: 'Server error' })
  }
}