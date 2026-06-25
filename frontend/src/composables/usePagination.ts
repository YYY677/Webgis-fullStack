import { ref, reactive, computed } from "vue"

interface PaginationData {
  currentPage: number
  pageSize: number
  total: number
}

export function usePagination(initialPageSize = 10) {
  const paginationData = reactive<PaginationData>({
    currentPage: 1,
    pageSize: initialPageSize,
    total: 0
  })

  function handleCurrentChange(val: number) {
    paginationData.currentPage = val
  }

  function handleSizeChange(val: number) {
    paginationData.pageSize = val
    paginationData.currentPage = 1
  }

  return { paginationData, handleCurrentChange, handleSizeChange }
}
