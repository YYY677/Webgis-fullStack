import { ref, onMounted, onUnmounted } from "vue"

export function useDevice() {
  const isMobile = ref(window.innerWidth < 768)

  function handleResize() {
    isMobile.value = window.innerWidth < 768
  }

  onMounted(() => window.addEventListener("resize", handleResize))
  onUnmounted(() => window.removeEventListener("resize", handleResize))

  return { isMobile }
}
