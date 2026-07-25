import { describe, expect, it } from "vitest";
import {
  calculateLocalPolygonAreaMeters2,
  calculateSurfaceDistanceMeters,
  formatArea,
  formatDistance,
} from "./cesium-measure";

describe("Cesium 量算工具", () => {
  it("按地表弧线计算折线距离", () => {
    const distance = calculateSurfaceDistanceMeters([
      { longitude: 0, latitude: 0 },
      { longitude: 1, latitude: 0 },
    ]);

    expect(distance).toBeCloseTo(111_319.49, 1);
  });

  it("用局部投影近似计算多边形面积", () => {
    const area = calculateLocalPolygonAreaMeters2([
      { longitude: 0, latitude: 0 },
      { longitude: 0.01, latitude: 0 },
      { longitude: 0.01, latitude: 0.01 },
      { longitude: 0, latitude: 0.01 },
    ]);

    expect(area).toBeGreaterThan(1_200_000);
    expect(area).toBeLessThan(1_300_000);
  });

  it("按合适单位格式化距离和面积", () => {
    expect(formatDistance(850)).toBe("850.0 m");
    expect(formatDistance(1_250)).toBe("1.25 km");
    expect(formatArea(800)).toBe("800.0 m²");
    expect(formatArea(1_250_000)).toBe("1.25 km²");
  });
});
