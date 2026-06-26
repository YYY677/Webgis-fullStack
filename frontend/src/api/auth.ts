import { request } from "./request"

interface LoginData {
  username: string
  password: string
}

interface LoginResult {
  token: string
  username: string
  displayName: string
  role: string
}

interface UserInfo {
  username: string
  roles: string[]
}

// 你调用时，T 变成了 { data: LoginResult }
// 但 config 依然是 { url: '/login', method: 'post', data: ... }
export function loginApi(data: LoginData) {
  return request<{ data: LoginResult }>({
    url: "/auth/login",
    method: "post",
    data
  })
}

export function getUserInfoApi() {
  return request<{ data: UserInfo }>({
    url: "/auth/me",
    method: "get"
  })
}
