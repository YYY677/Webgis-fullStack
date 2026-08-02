import {
  Cartographic,
  Math as CesiumMath,
  WebMercatorProjection,
} from "cesium"
import GeoJSON from "ol/format/GeoJSON"
import WKT from "ol/format/WKT"

export type GeometryKind = "point" | "line" | "polygon"
export type SpatialProjection = "EPSG:4326" | "EPSG:3857"
export type LonLat = [number, number]

const webMercatorProjection = new WebMercatorProjection()
const wktFormat = new WKT()
const geoJsonFormat = new GeoJSON()

export function normalizeGeometryKind(
  geometryType: string | null | undefined,
): GeometryKind {
  const type = geometryType?.toUpperCase() || ""
  if (type.includes("POINT")) return "point"
  if (type.includes("LINE")) return "line"
  if (type.includes("POLYGON") || type.includes("AREA")) return "polygon"
  throw new Error(`不支持的几何类型：${geometryType || "空"}`)
}

export function projectLonLatToWebMercator([longitude, latitude]: LonLat) {
  // WebMercatorProjection 只负责 WGS84 地理坐标与 Web Mercator 的双向转换，它不是通用“任意坐标系转换器”。
  // project()    // 4326 → 3857
  // unproject()  // 3857 → 4326
  const projected = webMercatorProjection.project(
    Cartographic.fromDegrees(longitude, latitude),
  )
  return [projected.x, projected.y] as LonLat
}

function formatCoordinate([x, y]: LonLat) {
  return `${x} ${y}`
}

function sameCoordinate(first: LonLat, second: LonLat) {
  return first[0] === second[0] && first[1] === second[1]
}

export function coordinatesToWkt(
  kind: GeometryKind,
  coordinates: LonLat[],
  projection: SpatialProjection,
) {
  const minimum = kind === "polygon" ? 3 : kind === "line" ? 2 : 1
  if (coordinates.length < minimum) {
    throw new Error(`${kind} 至少需要 ${minimum} 个坐标`)
  }

  const output = coordinates.map((coordinate) =>
    projection === "EPSG:3857"
      ? projectLonLatToWebMercator(coordinate)
      : coordinate,
  )

  if (kind === "point") {
    return `POINT(${formatCoordinate(output[0])})`
  }
  if (kind === "line") {
    return `LINESTRING(${output.map(formatCoordinate).join(", ")})`
  }

  const ring = output.slice()
  if (!sameCoordinate(ring[0], ring[ring.length - 1])) {
    ring.push(ring[0])
  }
  return `POLYGON((${ring.map(formatCoordinate).join(", ")}))`
}

export function wktToGeoJsonFeature(
  wktText: string,
  dataProjection: SpatialProjection,
) {
  const feature = wktFormat.readFeature(wktText, {
    dataProjection,
    featureProjection: "EPSG:4326",
  })
  return geoJsonFormat.writeFeatureObject(feature, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:4326",
  }) as any
}

export function cartographicToLonLat(cartographic: Cartographic): LonLat {
  return [
    CesiumMath.toDegrees(cartographic.longitude),
    CesiumMath.toDegrees(cartographic.latitude),
  ]
}
