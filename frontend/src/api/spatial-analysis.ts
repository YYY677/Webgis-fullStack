/**
 * 空间分析 API — 调用后端 /spatial/analysis/** 接口
 */
import { request } from "./request"

export function bufferAnalysis(wkt: string, distance: number) {
  return request<{ code: number; data: string }>({
    url: "/spatial/analysis/buffer", method: "post",
    data: { wkt, distance }
  })
}

export function intersectionAnalysis(wkt1: string, wkt2: string) {
  return request<{ code: number; data: string }>({
    url: "/spatial/analysis/intersection", method: "post",
    data: { wkt1, wkt2 }
  })
}

export function unionAnalysis(wkt1: string, wkt2: string) {
  return request<{ code: number; data: string }>({
    url: "/spatial/analysis/union", method: "post",
    data: { wkt1, wkt2 }
  })
}

export function differenceAnalysis(wkt1: string, wkt2: string) {
  return request<{ code: number; data: string }>({
    url: "/spatial/analysis/difference", method: "post",
    data: { wkt1, wkt2 }
  })
}

export function symdiffAnalysis(wkt1: string, wkt2: string) {
  return request<{ code: number; data: string }>({
    url: "/spatial/analysis/symdifference", method: "post",
    data: { wkt1, wkt2 }
  })
}

export function relationAnalysis(wkt1: string, wkt2: string) {
  return request<{ code: number; data: Record<string, boolean> }>({
    url: "/spatial/analysis/relation", method: "post",
    data: { wkt1, wkt2 }
  })
}

export function distanceAnalysis(wkt1: string, wkt2: string) {
  return request<{ code: number; data: number }>({
    url: "/spatial/analysis/distance", method: "post",
    data: { wkt1, wkt2 }
  })
}

export function areaAnalysis(wkt: string) {
  return request<{ code: number; data: number }>({
    url: "/spatial/analysis/area", method: "post",
    data: { wkt }
  })
}

export function lengthAnalysis(wkt: string) {
  return request<{ code: number; data: number }>({
    url: "/spatial/analysis/length", method: "post",
    data: { wkt }
  })
}

export function centroidAnalysis(wkt: string) {
  return request<{ code: number; data: string }>({
    url: "/spatial/analysis/centroid", method: "post",
    data: { wkt }
  })
}

export function shortestPath(x1: number, y1: number, x2: number, y2: number) {
  return request<{ code: number; data: { wkt: string; totalCost: number } }>({
    url: "/spatial/analysis/shortest-path", method: "post",
    data: { x1, y1, x2, y2 }
  })
}
