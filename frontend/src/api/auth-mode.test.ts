import { describe, expect, it } from "vitest"
import { createMockLoginResult, createMockUserInfoResult, resolveAuthMode, resolveMockUsername } from "./auth-mode"

describe("认证模式", () => {
  it("未配置时默认使用前端 mock 登录", () => {
    expect(resolveAuthMode({})).toBe("mock")
  })

  it("显式配置 remote 时使用真实后端认证", () => {
    expect(resolveAuthMode({ VITE_AUTH_MODE: "remote" })).toBe("remote")
  })

  it("为模拟登录返回学习者身份", () => {
    expect(createMockLoginResult("atlas")).toEqual({
      code: 200,
      message: "mock login success",
      data: {
        token: "mock-token-atlas",
        username: "atlas",
        displayName: "学习者",
        role: "demo",
      },
    })
  })

  it("为模拟会话返回 demo 角色", () => {
    expect(createMockUserInfoResult("atlas")).toEqual({
      code: 200,
      message: "mock user info success",
      data: { username: "atlas", roles: ["demo"] },
    })
  })

  it("从模拟 token 还原登录时填写的用户名", () => {
    expect(resolveMockUsername("mock-token-atlas")).toBe("atlas")
  })
})
