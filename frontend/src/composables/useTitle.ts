export function useTitle() {
  function setTitle(title?: string) {
    const baseTitle = import.meta.env.VITE_APP_TITLE || "WebGIS"
    document.title = title ? `${title} - ${baseTitle}` : baseTitle
  }
  return { setTitle }
}
