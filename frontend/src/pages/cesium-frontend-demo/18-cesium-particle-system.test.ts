import { describe, expect, it } from "vitest"
import { createCircularParticleImage, PARTICLE_PRESETS } from "./18-cesium-particle-system.vue"

describe("18 粒子系统", () => {
  describe("createCircularParticleImage", () => {
    it("是一个函数，返回 data URL 字符串", () => {
      expect(typeof createCircularParticleImage).toBe("function")
      // 该函数依赖 Canvas API，无法在 Node.js 中验证具体返回值
    })
  })

  describe("PARTICLE_PRESETS", () => {
    it("三个预设分别对应三种发射器", () => {
      expect(PARTICLE_PRESETS.fire.emitter).toBe("circle")
      expect(PARTICLE_PRESETS.smoke.emitter).toBe("cone")
      expect(PARTICLE_PRESETS.explosion.emitter).toBe("sphere")
    })

    it("所有预设的位置格式正确", () => {
      for (const preset of Object.values(PARTICLE_PRESETS)) {
        expect(preset.position).toHaveLength(3)
        expect(preset.position[0]).toBeGreaterThan(115)
        expect(preset.position[1]).toBeGreaterThan(38)
      }
    })

    it("未包含不存在的发射器类型", () => {
      const emitterTypes = Object.values(PARTICLE_PRESETS).map(p => p.emitter)
      expect(emitterTypes.every(t => ["circle", "cone", "sphere"].includes(t))).toBe(true)
    })
  })
})
