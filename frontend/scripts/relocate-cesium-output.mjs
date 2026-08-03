import { existsSync } from "node:fs"
import { cp, mkdir, readdir, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export async function relocateCesiumOutput(outDir) {
  const resolvedOutDir = resolve(outDir)
  const entries = await readdir(resolvedOutDir, { withFileTypes: true })
  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(resolvedOutDir, entry.name, "cesium"))
    .filter((candidate) => existsSync(join(candidate, "Cesium.js")))

  if (candidates.length === 0) return false
  if (candidates.length > 1) {
    throw new Error(`发现多个嵌套 Cesium 目录：${candidates.join(", ")}`)
  }

  const nestedCesiumDir = candidates[0]
  const publicCesiumDir = join(resolvedOutDir, "cesium")
  await rm(publicCesiumDir, { recursive: true, force: true })
  await mkdir(dirname(publicCesiumDir), { recursive: true })
  await cp(nestedCesiumDir, publicCesiumDir, { recursive: true })
  await rm(nestedCesiumDir, { recursive: true, force: true })

  const nestedParent = dirname(nestedCesiumDir)
  if ((await readdir(nestedParent)).length === 0) {
    await rm(nestedParent, { recursive: true, force: true })
  }

  return true
}

const scriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] === scriptPath) {
  const moved = await relocateCesiumOutput(process.argv[2] || "dist")
  console.log(moved ? "Cesium 资源已整理到 dist/cesium" : "未发现需要整理的 Cesium 资源")
}
