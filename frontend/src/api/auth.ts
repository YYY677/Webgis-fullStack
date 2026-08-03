import { request } from "./request"
import { createMockLoginResult, createMockUserInfoResult, resolveAuthMode, resolveMockUsername } from "./auth-mode"
import { getToken } from "@/utils/localStorage"

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
  if (resolveAuthMode(import.meta.env) === "mock") {
    return Promise.resolve(createMockLoginResult(data.username))
  }

  return request<{ data: LoginResult }>({
    url: "/auth/login",
    method: "post",
    data
  })
}

export function getUserInfoApi() {
  if (resolveAuthMode(import.meta.env) === "mock") {
    return Promise.resolve(createMockUserInfoResult(resolveMockUsername(getToken() || "")))
  }

  return request<{ data: UserInfo }>({
    url: "/auth/me",
    method: "get"
  })
}
