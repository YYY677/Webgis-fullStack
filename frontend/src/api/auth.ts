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
