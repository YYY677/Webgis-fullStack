import { watchEffect } from "vue"

export function useTheme() {
  function initTheme() {
    watchEffect(() => {
      const saved = localStorage.getItem("theme")
      const isDark = saved === "dark"
      document.documentElement.classList.toggle("dark", isDark)
    })
  }
  return { initTheme }
}
