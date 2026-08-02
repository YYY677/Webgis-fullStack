import { describe, expect, it } from "vitest"
import { Cartesian3 } from "cesium"
import {
  EXCAVATE_CORNERS,
  createExcavationPlanes,
} from "./19-cesium-clipping-flood.vue"

describe("19 裁剪与淹没分析", () => {
  describe("EXCAVATE_CORNERS", () => {
    it("逆时针排列 4 个角点", () => {
      expect(EXCAVATE_CORNERS).toHaveLength(4)
      // 逆时针：西南 → 东南 → 东北 → 西北
      expect(EXCAVATE_CORNERS[0][0]).toBeLessThan(EXCAVATE_CORNERS[1][0]) // 西 < 东
      expect(EXCAVATE_CORNERS[1][1]).toBeLessThan(EXCAVATE_CORNERS[2][1]) // 南 < 北
      expect(EXCAVATE_CORNERS[2][0]).toBeGreaterThan(EXCAVATE_CORNERS[3][0]) // 东 > 西
    })
  })

  describe("createExcavationPlanes", () => {
    it("为每条边生成一个裁剪平面", () => {
      const planes = createExcavationPlanes(EXCAVATE_CORNERS)
      expect(planes).toHaveLength(EXCAVATE_CORNERS.length)
    })

    it("平面法线为单位向量，distance 有限", () => {
      const planes = createExcavationPlanes(EXCAVATE_CORNERS)
      for (const plane of planes) {
        const len = Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z)
        expect(len).toBeCloseTo(1, 5)
        expect(Number.isFinite(plane.distance)).toBe(true)
      }
    })

    it("四个顶点都落在裁剪侧（n·x + d < 0），即区域内部被挖掉", () => {
      // GLSL 语义：amount = n·p + distance，amount <= 0 的像素被 discard。
      // 法线朝外，所以矩形内部（四个顶点）都在裁剪侧 —— 这就是"挖坑"。
      const planes = createExcavationPlanes(EXCAVATE_CORNERS)
      const corners = EXCAVATE_CORNERS.map(([lon, lat]) => {
        return Cartesian3.fromDegrees(lon, lat)
      })
      for (const corner of corners) {
        for (const plane of planes) {
          const side =
            plane.normal.x * corner.x +
            plane.normal.y * corner.y +
            plane.normal.z * corner.z +
            plane.distance
          expect(side).toBeLessThan(1e-6)
        }
      }
    })
  })
})
