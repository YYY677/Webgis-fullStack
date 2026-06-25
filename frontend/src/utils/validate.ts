export function isExternal(path: string) {
  return /^(https?:|mailto:|tel:)/.test(path)
}

export function isValidUsername(str: string) {
  return str.trim().length >= 2
}
