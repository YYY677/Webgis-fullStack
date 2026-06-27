/**
 * 底图工厂 — 封装常见底图的创建逻辑
 *
 * 用法：
 *   const layer = createTdtLayer("vec")    // 天地图矢量
 *   const layer = createOSMLayer()          // OSM
 *
 * 每调一次返回一个新 Layer 实例（而非缓存单例），
 * 因为 OL 不允许同一 Layer 对象被添加到多个 Map 中。
 *
 * 注意：
 *   使用 OpenLayers 10.x API。
 *   WMTS TileGrid 在第一次 import 时完成初始化，
 *   避免每个页面重复计算分辨率和 matrixIds。
 */
import TileLayer from "ol/layer/Tile"
import Group from "ol/layer/Group"
import type BaseLayer from "ol/layer/Base"
import WMTS from "ol/source/WMTS"
import WMTSGrid from "ol/tilegrid/WMTS"
import XYZ from "ol/source/XYZ"
import { getTopLeft } from "ol/extent"
import { get as getProjection } from "ol/proj"

// ── 类型 ──────────────────────────────────────────────────────────

/** 天地图图层类型（含注记层） */
export type TdtType = "vec" | "img" | "ter" | "cva" | "cia" | "cta"

/** 天地图复合底图的"基础"类型（不含注记层） */
export type TdtBaseType = "vec" | "img" | "ter"

/** 高德地图样式 */
export type GaodeStyle = 6 | 7 | 8

// ── 常量 ──────────────────────────────────────────────────────────

/** 天地图各图层的 URL path 片段 */
// Record<TdtType, string> 是 TypeScript 的一个内置类型，它表示一个对象类型，
// 其中键的类型是 TdtType，值的类型是 string。
// 也就是说，TDT_LAYER 是一个对象，它的键只能是 "vec"、"img"、"ter"、"cva"、"cia" 或 "cta"，
// 对应的值都是字符串类型。
const TDT_LAYER: Record<TdtType, string> = {
  vec: "vec",
  img: "img",
  ter: "ter",
  cva: "cva",
  cia: "cia",
  cta: "cta"
}

const TDT_LABEL: Record<TdtType, string> = {
  vec: "矢量底图",
  img: "影像底图",
  ter: "地形底图",
  cva: "矢量注记",
  cia: "影像注记",
  cta: "地形注记"
}

/** 天地图密钥（优先走环境变量，无配置时使用硬编码 fallback） */
function getTdtKey(): string {
  return import.meta.env.VITE_TIANDITU_KEY || "cebaba44acf46ca9eb3d146728f39dcd"
}

// ── WMTS TileGrid（算一次全局复用） ──────────────────────────────────

/**
 * EPSG:3857 下天地图 WMTS 所需的瓦片网格。
 *
 * 之所以放到模块顶层执行，是因为这段计算（投影范围、18 级分辨率、矩阵 ID）
 * 对任何依赖 WMTS 的地图服务（天地图、ArcGIS Online 等）都一样，
 * 无需在每个页面 onMounted 里重复算。
 */
const TDT_TILE_GRID = (() => {
  const projection = getProjection("EPSG:3857")!
  const extent = projection.getExtent()
  const size = 256
  const resolutions: number[] = []
  const matrixIds: string[] = []
  // 循环遍历，从0到18
  for (let z = 0; z <= 18; z++) {
    // 计算每个级别的分辨率
    // 分辨率计算公式：地图范围宽度除以图片大小再除以2的z次方
    /*
    当 z=0 时：2^0 = 1，不切。分辨率 = 156,250 米/像素（全世界挤在一张图里，极其模糊）。
    当 z=1 时：2^1 = 2，把披萨横向切成 2 份。相当于整张披萨现在用 2 张瓦片（总像素 512）来拼。
    当 z=2 时：2^2 = 4，切成 4 份。分辨率 = 156,250 ÷ 4 = 39,062 米/像素。
    ...直到 z=18 时：2^18 = 262,144，切成 26 万份。分辨率 ≈ 0.6 米/像素（足以看清房屋和道路）。
    */
    resolutions[z] = (extent[2] - extent[0]) / size / Math.pow(2, z)
    // 为每个级别创建矩阵ID
    // 将z值转换为字符串作为矩阵ID
    matrixIds[z] = String(z)
  }
  return {
    projection,
    grid: new WMTSGrid({
      origin: getTopLeft(extent),
      resolutions,
      matrixIds
    })
  }
})()

// ── 工厂函数 ──────────────────────────────────────────────────────

/** 创建天地图 WMTS 底图 */
export function createTdtLayer(type: TdtType): TileLayer<WMTS> {
  const key = getTdtKey()
  const layerId = TDT_LAYER[type]
  return new TileLayer({
    source: new WMTS({
      url: `http://t0.tianditu.gov.cn/${layerId}_w/wmts?tk=${key}`,
      layer: layerId,
      matrixSet: "w",
      format: "tiles",
      style: "default",
      projection: TDT_TILE_GRID.projection,
      tileGrid: TDT_TILE_GRID.grid,
      wrapX: true
    }),
    // 属性标记，方便调试时识别
    properties: { label: TDT_LABEL[type] }
  })
}

/** 创建 OSM XYZ 底图 */
export function createOSMLayer(): TileLayer<XYZ> {
  return new TileLayer({
    source: new XYZ({
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    }),
    properties: { label: "OSM" }
  })
}

// ── 高德地图 ──────────────────────────────────────────────────────

/**
 * 创建高德 XYZ 底图
 *
 * @param style  6 = 纯影像 / 7 = 矢量含标注(默认) / 8 = 影像+路网
 *
 * 高德瓦片子域名是 webrd01 ~ webrd04（带前导零），
 * OL 的 {1-4} 展开成 webrd1 不带零，所以手动列出 urls 数组。
 */
export function createGaodeLayer(style: GaodeStyle = 7): TileLayer<XYZ> {
  // wprd0{1-4} → OL 自动展开为 wprd01 / wprd02 / wprd03 / wprd04
  // 注意 0 在 {1-4} 前面，是字面量，{1-4} 只替换数字部分
  return new TileLayer({
    source: new XYZ({
      url: `https://wprd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=${style}&x={x}&y={y}&z={z}`
    }),
    properties: { label: `高德-${style}` }
  })
}

/** 高德矢量含标注（style=7，默认） */
export function createGaodeVecLayer(): TileLayer<XYZ> {
  return createGaodeLayer(7)
}

/** 高德纯影像（style=6） */
export function createGaodeImgLayer(): TileLayer<XYZ> {
  return createGaodeLayer(6)
}

/** 高德影像+路网（style=8） */
export function createGaodeHybridLayer(): TileLayer<XYZ> {
  return createGaodeLayer(8)
}

// ── 复合底图（底图 + 注记层） ──────────────────────────────────────

/** 天地图各基础类型对应的注记层 */
// Record<TdtBaseType, TdtType>的意思是创建一个对象类型，其中键的类型是TdtBaseType，
// 值的类型是TdtType。也就是说，TDT_ANNO_MAP是一个对象，它的键只能是"vec"、"img"或"ter"，
// 对应的值只能是"cva"、"cia"或"cta"。
const TDT_ANNO_MAP: Record<TdtBaseType, TdtType> = {
  vec: "cva",
  img: "cia",
  ter: "cta"
}

/**
 * 天地图复合底图 — 影像/矢量瓦片 + 对应的地名注记层叠在一起
 *
 * 单张 TileLayer 只能显示一套瓦片，而"带地名的卫星图"其实是两组瓦片叠出来的：
 *   底层：卫星影像（img）
 *   上层：地名注记（cia）
 *
 * 用 ol/layer/Group 把两层打包成一个整体，setBaseLayer 时一次替换。
 */
export function createTdtComposite(type: TdtBaseType): Group {
  const annoType = TDT_ANNO_MAP[type]
  return new Group({
    layers: [createTdtLayer(type), createTdtLayer(annoType)],
    properties: { label: `天地图-${type}+${annoType}` }
  })
}

/**
 * 底图注册表 — 供底图切换组件遍历
 *
 * 每项包含 id / label / create 工厂，组件调用 create() 拿到 Layer 实例。
 * 这样新增底图只需要在这里加一条记录，页面代码不用改。
 */
export interface BasemapItem {
  id: string
  label: string
  create: () => BaseLayer
}

export const BASEMAP_LIST: BasemapItem[] = [
  { id: "gd-vec",   label: "高德矢量（含标注）",  create: () => createGaodeVecLayer() },
  { id: "gd-img",   label: "高德影像",            create: () => createGaodeImgLayer() },
  { id: "gd-hybrid",label: "高德影像+路网",        create: () => createGaodeHybridLayer() },
  { id: "tdt-vec",  label: "天地图矢量（含标注）",  create: () => createTdtComposite("vec") },
  { id: "tdt-img",  label: "天地图影像（含标注）",  create: () => createTdtComposite("img") },
  { id: "tdt-ter",  label: "天地图地形",           create: () => createTdtLayer("ter") },
  { id: "osm",      label: "OSM 标准地图",         create: () => createOSMLayer() }
]

/** 按 id 查底图配置项 */
export function getBasemapById(id: string): BasemapItem | undefined {
  return BASEMAP_LIST.find(item => item.id === id)
}
