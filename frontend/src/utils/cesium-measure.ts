export interface GeographicPoint {
  longitude: number;
  latitude: number;
}

const EARTH_RADIUS_METERS = 6_378_137;
const DEGREE_TO_RADIAN = Math.PI / 180;

function toRadians(degrees: number) {
  return degrees * DEGREE_TO_RADIAN;
}

/** 计算相邻经纬度点之间的球面距离，适用于折线量算。 */
export function calculateSurfaceDistanceMeters(points: GeographicPoint[]) {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    const latitudeDelta = toRadians(point.latitude - previous.latitude);
    const longitudeDelta = toRadians(point.longitude - previous.longitude);
    const latitude1 = toRadians(previous.latitude);
    const latitude2 = toRadians(point.latitude);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;

    return total + 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
  }, 0);
}

/**
 * 在多边形中心建立等距矩形近似投影，再用鞋带公式求面积。
 * 适合交互量算中的小范围区域，不应用于跨大范围或跨极区的面积统计。
 */
export function calculateLocalPolygonAreaMeters2(points: GeographicPoint[]) {
  if (points.length < 3) return 0;

  const centerLatitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const centerLongitude = points.reduce((sum, point) => sum + point.longitude, 0) / points.length;
  const cosLatitude = Math.cos(toRadians(centerLatitude));
  const projected = points.map((point) => ({
    x: toRadians(point.longitude - centerLongitude) * EARTH_RADIUS_METERS * cosLatitude,
    y: toRadians(point.latitude - centerLatitude) * EARTH_RADIUS_METERS,
  }));

  const doubleArea = projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);

  return Math.abs(doubleArea) / 2;
}

export function formatDistance(meters: number) {
  return meters < 1_000 ? `${meters.toFixed(1)} m` : `${(meters / 1_000).toFixed(2)} km`;
}

export function formatArea(squareMeters: number) {
  return squareMeters < 1_000_000
    ? `${squareMeters.toFixed(1)} m²`
    : `${(squareMeters / 1_000_000).toFixed(2)} km²`;
}
