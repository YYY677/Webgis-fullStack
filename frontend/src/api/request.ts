import { ElMessage } from "element-plus"
import axios from "axios"
import type { AxiosRequestConfig } from "axios"
import { getToken, removeToken } from "@/utils/localStorage"

// 创建一个 axios 实例
const instance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL, // “/api”
  timeout: 10000
})

// request.use：在请求发出前执行 从本地存储（localStorage）取出 Token，
// 如果有，就塞进请求头 Authorization 里。这样后端才知道是谁在请求。
instance.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// response.use：在请求返回后执行
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

// 这里的 <T> 是一个占位符（类似数学里的 X）。调用者传什么类型进来，它就代表什么类型。
// 第一个 T（在 <> 里）：相当于 function foo(x) 里的 (x)，告诉 TS “这里有一个类型变量要登场了”。
// 第二个 T（在 Promise 里）：相当于 return x 里的 x，告诉 TS “我返回的数据类型就是刚才声明的那个 T”。

// config：这是一个形参（变量名），通常包含 url、method、data 等属性。
// ：AxiosRequestConfig：这个参数必须是一个符合 Axios 规定格式的对象。
// 比如包含 url、method、data、headers 这些字段

// Promise<T>：这个 request 函数会返回一个 Promise（承诺）。
// 等网络请求搞定了，这个 Promise 会兑现给你一份数据，这份数据的类型就是由你外部传入的 T 决定的。
export function request<T>(config: AxiosRequestConfig): Promise<T> {
  // 拿着你传入的配置参数，去执行真正的 HTTP 请求。
  return instance(config)
}
