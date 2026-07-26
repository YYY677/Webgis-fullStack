export interface GeographicPoint {
  /** 十进制度经度，例如北京约为 116.397。 */
  longitude: number;
  /** 十进制度纬度，例如北京约为 39.908。 */
  latitude: number;
}

// 采用 Web Mercator 使用的地球半径。这里把地球近似为球体，而不是严格椭球体。
const EARTH_RADIUS_METERS = 6_378_137;
// JavaScript 的三角函数接收弧度；地理坐标通常以角度提供，所以要先转换。
const DEGREE_TO_RADIAN = Math.PI / 180;

function toRadians(degrees: number) {
  return degrees * DEGREE_TO_RADIAN;
}

/**
 * 使用 Haversine（半正矢）公式计算相邻经纬度点的球面弧长，并累加为折线距离。
 * 结果不包含高程差，也不是严格椭球测地线；用于普通交互量算足够。
 */
export function calculateSurfaceDistanceMeters(points: GeographicPoint[]) {
  // 从第二个点开始遍历：当 index 为 0 时，points[0] 正好是当前点的前一个点。
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    // 两点的纬度差、经度差必须先换成弧度，才能参与三角函数计算。
    const latitudeDelta = toRadians(point.latitude - previous.latitude);
    const longitudeDelta = toRadians(point.longitude - previous.longitude);
    const latitude1 = toRadians(previous.latitude);
    const latitude2 = toRadians(point.latitude);

    // Haversine 公式中的 a：它由两点的经纬度差推得两点在球面上的夹角。
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;

    // 球面弧长 = 2 × 地球半径 × asin(sqrt(a))；每段弧长累加得到折线总长。
    return total + 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
  }, 0);
}

/**
 * 在多边形中心建立等距矩形近似投影，再用鞋带公式求面积。
 * 适合交互量算中的小范围区域，不应用于跨大范围或跨极区的面积统计。
 */
export function calculateLocalPolygonAreaMeters2(points: GeographicPoint[]) {
  // 少于三个点无法构成面，直接返回 0，避免后续投影与鞋带公式无意义。
  if (points.length < 3) return 0;

  // 以顶点平均经纬度作为局部投影中心，减小“小范围内把球面摊平”的误差。
  const centerLatitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const centerLongitude = points.reduce((sum, point) => sum + point.longitude, 0) / points.length;
  // 相同经度差在高纬度对应的实际东西距离更短，因此 x 方向需要乘 cos(中心纬度)。
  const cosLatitude = Math.cos(toRadians(centerLatitude));
  const projected = points.map((point) => ({
    // 将经纬度差转换为局部平面米坐标：x 为东西方向，y 为南北方向。
    x: toRadians(point.longitude - centerLongitude) * EARTH_RADIUS_METERS * cosLatitude,
    y: toRadians(point.latitude - centerLatitude) * EARTH_RADIUS_METERS,
  }));

  // 鞋带公式：依次连接当前点和下一个点，最后一个点通过取模与第一个点闭合。
  const doubleArea = projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);

  // 鞋带公式求得的是带符号的两倍面积；取绝对值消除顺逆时针方向影响，再除以 2。
  return Math.abs(doubleArea) / 2;
}

export function formatDistance(meters: number) {
  // 仅负责展示单位，不参与实际距离计算。
  return meters < 1_000 ? `${meters.toFixed(1)} m` : `${(meters / 1_000).toFixed(2)} km`;
}

export function formatArea(squareMeters: number) {
  // 仅负责展示单位：1 km² = 1,000,000 m²。
  return squareMeters < 1_000_000
    ? `${squareMeters.toFixed(1)} m²`
    : `${(squareMeters / 1_000_000).toFixed(2)} km²`;
}
