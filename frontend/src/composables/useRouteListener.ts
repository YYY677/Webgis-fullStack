import { watch } from "vue"
import { useRoute } from "vue-router"
import type { RouteLocationNormalizedGeneric } from "vue-router"

type Callback = (route: RouteLocationNormalizedGeneric) => void

export function useRouteListener() {
  const route = useRoute()

  function listenerRouteChange(callback: Callback, immediate = false) {
    watch(
      () => route.path,
      () => callback(route),
      { immediate }
    )
  }

  return { listenerRouteChange }
}
