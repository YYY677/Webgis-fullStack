import { defineStore } from "pinia"
import { ref } from "vue"

export const useAppStore = defineStore("app", () => {
  const sidebarOpened = ref(true)

  function toggleSidebar() {
    sidebarOpened.value = !sidebarOpened.value
  }

  return { sidebarOpened, toggleSidebar }
})
