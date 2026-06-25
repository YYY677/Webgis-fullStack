import { ref } from "vue"

interface Option {
  value: string | number
  label: string
}

export function useFetchSelect(fetchFn: (query: string) => Promise<Option[]>) {
  const options = ref<Option[]>([])
  const loading = ref(false)

  async function search(query: string) {
    loading.value = true
    try {
      options.value = await fetchFn(query)
    } finally {
      loading.value = false
    }
  }

  return { options, loading, search }
}
