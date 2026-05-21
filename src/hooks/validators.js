export const validateEmail = (email) => {
  const re = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/
  return re.test(email)
}

export const validatePassword = (password) => {
  return password && password.length >= 8
}

export const validatePhoneNumber = (phone) => {
  const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/
  return re.test(phone)
}

export const validateRequired = (value) => {
  return value && value.trim() !== ''
}