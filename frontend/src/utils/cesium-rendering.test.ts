import { describe, expect, it } from "vitest"
import {
  createSkyBoxSources,
  formatSceneExportName,
  getSceneModeLabel,
} from "./cesium-rendering"

describe("Cesium 渲染与场景工具", () => {
  it("为自定义天空盒映射六个正确方向的本地贴图", () => {
    expect(createSkyBoxSources("/cesium-data/skybox")).toEqual({
      positiveX: "/cesium-data/skybox/tycho2t3_80_px.jpg",
      negativeX: "/cesium-data/skybox/tycho2t3_80_mx.jpg",
      positiveY: "/cesium-data/skybox/tycho2t3_80_py.jpg",
      negativeY: "/cesium-data/skybox/tycho2t3_80_my.jpg",
      positiveZ: "/cesium-data/skybox/tycho2t3_80_pz.jpg",
      negativeZ: "/cesium-data/skybox/tycho2t3_80_mz.jpg",
    })
  })

  it("生成可排序的场景 PNG 文件名", () => {
    expect(formatSceneExportName(new Date("2026-07-27T08:09:10Z")))
      .toBe("cesium-scene-20260727-080910.png")
  })

  it("将 Cesium 场景模式转换为面板可读标签", () => {
    expect(getSceneModeLabel("SCENE2D")).toBe("2D 地图")
    expect(getSceneModeLabel("COLUMBUS_VIEW")).toBe("2.5D 哥伦布视图")
    expect(getSceneModeLabel("SCENE3D")).toBe("3D 地球")
  })
})
