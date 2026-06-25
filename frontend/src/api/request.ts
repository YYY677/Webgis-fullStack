import { ElMessage } from "element-plus"
import axios from "axios"
import type { AxiosRequestConfig } from "axios"
import { getToken, removeToken } from "@/utils/localStorage"

const instance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
  timeout: 10000
})

instance.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

instance.interceptors.response.use(
  (response) => {
    const apiData = response.data
    const code = apiData.code
    if (code === 200) {
      return apiData
    }
    ElMessage.error(apiData.message || "请求失败")
    return Promise.reject(apiData)
  },
  (error) => {
    if (error.response?.status === 401) {
      removeToken()
      window.location.hash = "#/login"
    }
    ElMessage.error(error.message || "网络错误")
    return Promise.reject(error)
  }
)

export function request<T>(config: AxiosRequestConfig): Promise<T> {
  return instance(config)
}
