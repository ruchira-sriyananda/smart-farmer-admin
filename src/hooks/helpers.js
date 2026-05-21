export const formatDate = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleString()
}

export const formatRelativeTime = (date) => {
  const now = new Date()
  const diff = now - new Date(date)
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minutes ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hours ago`
  return `${Math.floor(minutes / 1440)} days ago`
}

export const truncateText = (text, maxLength = 100) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export const getInitials = (name) => {
  if (!name) return 'A'
  return name.charAt(0).toUpperCase()
}