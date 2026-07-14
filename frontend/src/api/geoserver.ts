/**
 * GeoServer 管理 API — 调用后端 /api/geoserver/** 代理接口
 */
import { request } from "./request"

// ── 通用类型 ──────────────────────────────────────────────────

export interface NameHrefItem {
  name: string
  href: string
}

export interface WorkspaceItem extends NameHrefItem {}
export interface DataStoreItem extends NameHrefItem {}
export interface FeatureTypeItem extends NameHrefItem {}
export interface LayerItem extends NameHrefItem {}

// ══════════════════════════════════════════════════════════════
// Workspace
// ══════════════════════════════════════════════════════════════

export function getWorkspaces() {
  return request<{ code: number; data: WorkspaceItem[] }>({
    url: "/geoserver/workspaces", method: "get"
  })
}

export function createWorkspace(name: string) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/workspaces", method: "post",
    data: { name }
  })
}

export function deleteWorkspace(name: string) {
  return request<{ code: number; data: string }>({
    url: `/geoserver/workspaces/${encodeURIComponent(name)}`, method: "delete"
  })
}

// ══════════════════════════════════════════════════════════════
// DataStore
// ══════════════════════════════════════════════════════════════

export function getDataStores(workspace: string) {
  return request<{ code: number; data: DataStoreItem[] }>({
    url: "/geoserver/datastores", method: "get",
    params: { ws: workspace }
  })
}

export function createDataStore(params: {
  workspace: string; name: string; host: string; port: number
  database: string; user: string; password: string; schema: string
}) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/datastores", method: "post", data: params
  })
}

export function getDataStoreDetail(workspace: string, name: string) {
  return request<{ code: number; data: any }>({
    url: "/geoserver/datastores/detail", method: "get",
    params: { ws: workspace, name }
  })
}

export function deleteDataStore(workspace: string, name: string) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/datastores", method: "delete",
    params: { ws: workspace, name }
  })
}

// ══════════════════════════════════════════════════════════════
// FeatureType
// ══════════════════════════════════════════════════════════════

/** 已发布的要素类型列表 */
export function getFeatureTypes(workspace: string, datastore: string) {
  return request<{ code: number; data: FeatureTypeItem[] }>({
    url: "/geoserver/featuretypes", method: "get",
    params: { ws: workspace, ds: datastore }
  })
}

/** 所有表名（含未发布的） */
export function listAllFeatureTypes(workspace: string, datastore: string) {
  return request<{ code: number; data: string[] }>({
    url: "/geoserver/featuretypes/all", method: "get",
    params: { ws: workspace, ds: datastore }
  })
}

/** 发布要素类型 */
export function publishFeatureType(workspace: string, datastore: string, tableName: string, srs?: string) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/featuretypes/publish", method: "post",
    data: { workspace, datastore, tableName, srs }
  })
}

/** 要素类型详情 */
export function getFeatureTypeDetail(workspace: string, datastore: string, name: string) {
  return request<{ code: number; data: any }>({
    url: "/geoserver/featuretypes/detail", method: "get",
    params: { ws: workspace, ds: datastore, name }
  })
}

/** 取消发布（从 GeoServer 移除，保留数据库表） */
export function deleteFeatureType(workspace: string, datastore: string, name: string) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/featuretypes", method: "delete",
    params: { ws: workspace, ds: datastore, name }
  })
}

/** 彻底从数据库删除（DROP TABLE + 从 GeoServer 移除） */
export function dropFeatureType(workspace: string, datastore: string, name: string) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/featuretypes/drop", method: "delete",
    params: { ws: workspace, ds: datastore, name }
  })
}

// ══════════════════════════════════════════════════════════════
// Layer
// ══════════════════════════════════════════════════════════════

export function getLayers(workspace?: string) {
  return request<{ code: number; data: LayerItem[] }>({
    url: "/geoserver/layers", method: "get",
    params: workspace ? { ws: workspace } : {}
  })
}

export function getLayerDetail(name: string) {
  return request<{ code: number; data: any }>({
    url: "/geoserver/layers/detail", method: "get",
    params: { name }
  })
}

// ══════════════════════════════════════════════════════════════
// 文件上传 (FeatureType)
// ══════════════════════════════════════════════════════════════

/**
 * 上传 Shapefile(.zip 或 多文件) / GeoJSON → 后端解析 → PostGIS → 发布为图层
 *
 * @param workspace GeoServer 工作空间名
 * @param datastore GeoServer 数据存储名
 * @param name      图层名 / PostGIS 表名
 * @param format    "shp" 或 "geojson"
 * @param files     文件数组：zip 传一个，多文件 shp 传多个(.shp .shx .dbf ...)
 */
export function uploadFeatureTypeFile(
  workspace: string, datastore: string, name: string,
  format: string, files: File[]
) {
  const formData = new FormData()
  formData.append("workspace", workspace)
  formData.append("datastore", datastore)
  formData.append("name", name)
  formData.append("format", format)
  files.forEach(f => formData.append("files", f))

  return request<{ code: number; data: string }>({
    url: "/geoserver/featuretypes/upload",
    method: "post",
    data: formData,
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000, // Shapefile 解析 + 数据库写入可能较慢
  })
}

// ══════════════════════════════════════════════════════════════
// Style
// ══════════════════════════════════════════════════════════════

export interface StyleItem extends NameHrefItem {}

/** 所有样式列表 */
export function getStyles() {
  return request<{ code: number; data: StyleItem[] }>({
    url: "/geoserver/styles", method: "get"
  })
}

/** 样式元数据详情 */
export function getStyleDetail(name: string) {
  return request<{ code: number; data: any }>({
    url: "/geoserver/styles/detail", method: "get",
    params: { name }
  })
}

/** 获取 SLD 原始内容（纯文本 XML） */
export function getStyleSld(name: string) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/styles/sld", method: "get",
    params: { name }
  })
}

/** 创建样式 — 按 type 选预设模板 */
export function createStyle(name: string, opts?: { description?: string; type?: string }) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/styles", method: "post",
    data: { name, description: opts?.description ?? "", type: opts?.type ?? "point" }
  })
}

/** 更新 SLD 内容 */
export function updateStyleSld(name: string, sldBody: string) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/styles/sld", method: "put",
    params: { name },
    data: sldBody,
    headers: { "Content-Type": "application/xml" },
  })
}

/** 重命名样式 */
export function renameStyle(oldName: string, newName: string) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/styles/rename", method: "put",
    data: { oldName, newName }
  })
}

/** 删除样式 */
export function deleteStyle(name: string) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/styles", method: "delete",
    params: { name }
  })
}

/** 设置图层的默认样式 */
export function assignLayerStyle(layerName: string, styleName: string) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/layers/style", method: "put",
    data: { layerName, styleName }
  })
}

// ══════════════════════════════════════════════════════════════
// Style Value（SLD 表单编辑）
// ══════════════════════════════════════════════════════════════

export interface MapStyleItem {
  geomType: string     // "POINT" | "LINE" | "POLYGON" | "RASTER"
  name: string          // Rule/Name — 查找钥匙，不可编辑
  description?: string  // UserStyle/Abstract
  legendTitle?: string  // Rule/Title — 图例名称
  fillcolor?: string
  fillopacity?: string
  bordercolor?: string
  borderwidth?: string
  borderopacity?: string
  size?: string
  markname?: string
  rotation?: string
  dash?: string
  opacity?: string      // RASTER: RasterSymbolizer/Opacity
  colorMapEntries?: Array<{ color: string; quantity: string; label?: string }>
}

/** 解析 SLD → MapStyle 列表 */
export function getStyleValue(name: string) {
  return request<{ code: number; data: MapStyleItem[] }>({
    url: "/geoserver/styles/value", method: "get",
    params: { name }
  })
}

/** DOM+XPath 修改 SLD 并保存 */
export function updateStyleValue(name: string, mapStyles: MapStyleItem[]) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/styles/value", method: "put",
    params: { name },
    data: mapStyles
  })
}
