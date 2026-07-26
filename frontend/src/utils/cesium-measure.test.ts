import { describe, expect, it } from "vitest";
import {
  calculateLocalPolygonAreaMeters2,
  calculateSurfaceDistanceMeters,
  formatArea,
  formatDistance,
} from "./cesium-measure";
/**
关键字	           作用
describe	        组织测试的分组容器。把相关的测试用例包在一个"套件"里，输出时能看到层级。
it	              定义一个具体的测试用例。第一个参数是描述文字，第二个参数是执行这个测试的函数。
expect	          断言函数，返回一个"断言对象"，上面挂了一堆匹配方法。
toBeCloseTo	      比较浮点数近似相等（第二个参数是小数精度位数），避免 JS 浮点精度问题。
toBeGreaterThan	  大于某个值。
toBeLessThan	    小于某个值。
 */

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
