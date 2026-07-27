/** Horn 3×3 邻域法计算出的局部地形指标。 */
export interface SlopeAndAspect {
  /** 地表相对水平面的倾角，范围为 0° 到 90°。 */
  slopeDegrees: number;
  /** 最大下坡方向：北为 0°，顺时针增加；完全平坦时没有坡向。 */
  aspectDegrees: number | null;
}

/**
 * 根据 3×3 网格高程计算中心点的坡度和坡向。
 *
 * heights 的顺序固定为：[NW, N, NE, W, C, E, SW, S, SE]。
 * cellSizeMeters 是相邻网格点的水平距离（米）。
 */
export function calculateSlopeAndAspect(heights: readonly number[], cellSizeMeters: number): SlopeAndAspect {
  if (heights.length !== 9) {
    throw new RangeError("A terrain slope grid must contain exactly 9 height values.");
  }
  if (cellSizeMeters <= 0) {
    throw new RangeError("Terrain grid cell size must be greater than zero.");
  }

  const [northWest, north, northEast, west, , east, southWest, south, southEast] = heights;

  // Horn 算法将东西、南北两侧的三个高程按 1:2:1 加权，
  // 得到中心点向东（x）和向北（y）的高程变化率。
  // 向东每走 1m，大约升高多少米
  const risePerMeterEast = 
    (northEast + 2 * east + southEast - northWest - 2 * west - southWest) / (8 * cellSizeMeters);
  // 向北每走 1m，大约升高多少米
  const risePerMeterNorth = 
    (northWest + 2 * north + northEast - southWest - 2 * south - southEast) / (8 * cellSizeMeters);
  // gradient 梯度表示“向上爬升最快”的坡度。hypot 表示勾股定理，计算斜边长度。
  const gradient = Math.hypot(risePerMeterEast, risePerMeterNorth);

  if (gradient === 0) {
    return { slopeDegrees: 0, aspectDegrees: null };
  }

  // aspectDegrees 坡向通常定义为“水会往哪里流、沿哪里下坡最快”，也就是下坡方向，因此代码取反。
  const aspectDegrees = (Math.atan2(-risePerMeterEast, -risePerMeterNorth) * 180) / Math.PI;
  return {
    slopeDegrees: (Math.atan(gradient) * 180) / Math.PI,
    aspectDegrees: (aspectDegrees + 360) % 360,
  };
}
