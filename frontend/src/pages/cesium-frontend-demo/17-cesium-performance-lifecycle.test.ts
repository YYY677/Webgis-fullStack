import { describe, expect, it } from "vitest"
import { createDisposables } from "./17-cesium-performance-lifecycle.vue"

describe("17 资源生命周期", () => {
  it("按逆序释放已注册资源，且重复释放不会重复执行", () => {
    const disposables = createDisposables()
    const calls: string[] = []
    disposables.add(() => calls.push("first"))
    disposables.add(() => calls.push("second"))

    disposables.dispose()
    disposables.dispose()

    expect(calls).toEqual(["second", "first"])
  })

  it("在容器已经释放后注册资源时立即执行清理", () => {
    const disposables = createDisposables()
    const calls: string[] = []
    disposables.dispose()
    disposables.add(() => calls.push("late"))

    expect(calls).toEqual(["late"])
  })
})
