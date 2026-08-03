import { existsSync } from "node:fs"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, it } from "vitest"
import { relocateCesiumOutput } from "./relocate-cesium-output.mjs"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("Cesium 构建产物整理", () => {
  it("将嵌套的 cesium 目录移动到 dist 根目录", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "webgis-cesium-output-"))
    temporaryDirectories.push(outDir)
    const nestedCesiumDir = join(outDir, "Webgis-fullStack", "cesium")
    await mkdir(nestedCesiumDir, { recursive: true })
    await writeFile(join(nestedCesiumDir, "Cesium.js"), "cesium-global")

    await relocateCesiumOutput(outDir)

    expect(existsSync(join(outDir, "cesium", "Cesium.js"))).toBe(true)
    expect(existsSync(nestedCesiumDir)).toBe(false)
  })
})
