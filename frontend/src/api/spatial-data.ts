/**
 * 空间数据 CRUD API — 调用后端 /api/spatial/** 接口
 */
import { request } from "./request"

// ── 类型定义 ──────────────────────────────────────────────────

export interface SpatialTableVO {
  id: number
  name: string
  tableName: string
  geometryType: string
  geomColumn: string
  srid: number
  description: string
  rowCount: number
  rowKeyColumn: string
}

export interface FieldInfoVO {
  name: string
  type: string
  geom: boolean
  pk: boolean
}

export interface PageResultVO {
  rows: Record<string, any>[]
  fields: FieldInfoVO[]
  total: number
  page: number
  size: number
}

export interface RowSaveRequest {
  geomColumn: string
  rowKeyColumn: string
  rowKeyValue: any
  newRow: Record<string, any>
  fields: string[]
  wkt?: string
}

// ── API 函数 ──────────────────────────────────────────────────

/** 获取所有已注册的空间表列表 */
export function getSpatialTables() {
  return request<{ code: number; data: SpatialTableVO[] }>({
    url: "/spatial/tables", method: "get"
  })
}

/** 获取指定表的字段列表 */
export function getTableFields(tableName: string) {
  return request<{ code: number; data: FieldInfoVO[] }>({
    url: `/spatial/data/${encodeURIComponent(tableName)}/fields`, method: "get"
  })
}

/** 分页查询表数据 */
export function getTableData(tableName: string, page = 1, size = 50) {
  return request<{ code: number; data: PageResultVO }>({
    // encodeURIComponent 用于对表名进行 URL 编码，防止特殊字符导致请求失败
    url: `/spatial/data/${encodeURIComponent(tableName)}`, method: "get",
    params: { page, size }
  })
}

/** 全字段模糊搜索 */
export function searchTableData(tableName: string, q: string, page = 1, size = 50) {
  return request<{ code: number; data: PageResultVO }>({
    url: `/spatial/data/${encodeURIComponent(tableName)}/search`, method: "get",
    params: { q, page, size }
  })
}

/** 新增一行 */
export function addTableRow(tableName: string, dto: RowSaveRequest) {
  return request<{ code: number; data: string }>({
    url: `/spatial/data/${encodeURIComponent(tableName)}/row`, method: "post",
    data: dto
  })
}

/** 更新一行 */
export function updateTableRow(tableName: string, dto: RowSaveRequest) {
  return request<{ code: number; data: string }>({
    url: `/spatial/data/${encodeURIComponent(tableName)}/row`, method: "put",
    data: dto
  })
}

/** 删除一行 */
export function deleteTableRow(tableName: string, dto: RowSaveRequest) {
  return request<{ code: number; data: string }>({
    url: `/spatial/data/${encodeURIComponent(tableName)}/row`, method: "delete",
    data: dto
  })
}
