import { useEffect, useRef } from 'react'

export default function OnlineHeartbeat({ userId, userEmail, userName, userRole }) {
  const heartbeatInterval = useRef(null)

  useEffect(() => {
    if (!userId) return

    // Get client IP and device info
    const getClientInfo = async () => {
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipResponse.json()
        return {
          ip: ipData.ip || 'unknown',
          device: navigator.userAgent,
          screen: `${screen.width}x${screen.height}`,
          language: navigator.language
        }
      } catch {
        return { ip: 'unknown', device: navigator.userAgent, screen: 'unknown', language: 'unknown' }
      }
    }

    const updateOnlineStatus = async () => {
      const clientInfo = await getClientInfo()
      
      try {
        await fetch('/api/online-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            userEmail,
            userName,
            userRole,
            ipAddress: clientInfo.ip,
            deviceInfo: JSON.stringify({
              device: clientInfo.device,
              screen: clientInfo.screen,
              language: clientInfo.language,
              timestamp: new Date().toISOString()
            })
          })
        })
      } catch (err) {
        console.error('Heartbeat failed:', err)
      }
    }

    // Update immediately
    updateOnlineStatus()

    // Update every 30 seconds
    heartbeatInterval.current = setInterval(updateOnlineStatus, 30000)

    // Update on page visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateOnlineStatus()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Update before page unload
    window.addEventListener('beforeunload', updateOnlineStatus)

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', updateOnlineStatus)
      
      // Send final offline status
      fetch('/api/online-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userEmail,
          userName,
          userRole,
          ipAddress: 'unknown',
          deviceInfo: 'offline'
        })
      }).catch(() => {})
    }
  }, [userId, userEmail, userName, userRole])

  return null
}