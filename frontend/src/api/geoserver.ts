/**
 * GeoServer 管理 API — 调用后端 /api/geoserver/** 代理接口
 */
import { request } from "./request"

// ── 类型 ──────────────────────────────────────────────────────

export interface WorkspaceItem {
  name: string
  href: string
}

export interface DataStoreItem {
  name: string
  type: string
  href: string
  workspaceName?: string
}

export interface FeatureTypeItem {
  name: string
  title: string
  nativeName: string
  nativeBoundingBox?: string
}

export interface LayerItem {
  name: string
  title: string
  type: string
  defaultStyle?: string
  href?: string
}

// ── Workspace ────────────────────────────────────────────────

export function getWorkspaces() {
  return request<{ code: number; data: WorkspaceItem[] }>({
    url: "/geoserver/workspaces",
    method: "get"
  })
}

export function createWorkspace(name: string) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/workspaces",
    method: "post",
    data: { name }
  })
}

// ── DataStore ────────────────────────────────────────────────

export function getDataStores(workspace: string) {
  return request<{ code: number; data: DataStoreItem[] }>({
    url: "/geoserver/datastores",
    method: "get",
    params: { ws: workspace }
  })
}

export function createDataStore(params: {
  workspace: string
  name: string
  host: string
  port: number
  database: string
  user: string
  password: string
  schema: string
}) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/datastores",
    method: "post",
    data: params
  })
}

// ── FeatureType ──────────────────────────────────────────────

export function getFeatureTypes(workspace: string, datastore: string) {
  return request<{ code: number; data: FeatureTypeItem[] }>({
    url: "/geoserver/featuretypes",
    method: "get",
    params: { ws: workspace, ds: datastore }
  })
}

// ── Layer ────────────────────────────────────────────────────

export function getLayers(workspace?: string) {
  return request<{ code: number; data: LayerItem[] }>({
    url: "/geoserver/layers",
    method: "get",
    params: workspace ? { ws: workspace } : {}
  })
}

export function publishLayer(params: {
  workspace: string
  datastore: string
  featureType: string
}) {
  return request<{ code: number; data: string }>({
    url: "/geoserver/layers/publish",
    method: "post",
    data: params
  })
}
