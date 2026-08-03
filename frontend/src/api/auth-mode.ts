export type AuthMode = "mock" | "remote"

interface AuthModeEnvironment {
  VITE_AUTH_MODE?: string
}

export interface MockLoginResult {
  code: number
  message: string
  data: {
    token: string
    username: string
    displayName: string
    role: string
  }
}

export interface MockUserInfoResult {
  code: number
  message: string
  data: {
    username: string
    roles: string[]
  }
}

/** 默认使用 mock；未来配置 VITE_AUTH_MODE=remote 后再切换到真实认证。 */
export function resolveAuthMode(environment: AuthModeEnvironment): AuthMode {
  return environment.VITE_AUTH_MODE === "remote" ? "remote" : "mock"
}

export function createMockLoginResult(username: string): MockLoginResult {
  const learner = username.trim() || "learner"
  return {
    code: 200,
    message: "mock login success",
    data: {
      token: `mock-token-${learner}`,
      username: learner,
      displayName: "学习者",
      role: "demo",
    },
  }
}

export function createMockUserInfoResult(username: string): MockUserInfoResult {
  return {
    code: 200,
    message: "mock user info success",
    data: { username: username || "learner", roles: ["demo"] },
  }
}

/** 从仅供前端演示的 token 中还原登录名。 */
export function resolveMockUsername(token: string) {
  const prefix = "mock-token-"
  if (!token.startsWith(prefix)) return "learner"

  return token.slice(prefix.length) || "learner"
}
