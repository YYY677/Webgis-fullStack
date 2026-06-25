export function setCssVar(key: string, value: string) {
  document.documentElement.style.setProperty(key, value)
}

export function getCssVar(key: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(key).trim()
}
