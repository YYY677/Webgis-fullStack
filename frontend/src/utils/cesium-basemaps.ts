/**
 * Cesium 底图工厂 — 封装常见底图的激活逻辑
 *
 * 用法：
 *   const item = CESIUM_BASEMAP_LIST.find(i => i.id === "osm")
 *   await item.activate(viewer)
 *
 * 每条底图的 activate(viewer) 负责清空旧图层 + 加载自己的内容。
 * 这样可以灵活支持 ImageryProvider、ImageryLayer、terrain 等不同场景。
 *
 * Cesium 概念速查：
 *   ImageryProvider — 影像瓦片提供者，决定地图长什么样
 *   ImageryLayer    — 包裹 ImageryProvider 的图层对象，可调透明度/亮度
 *   addImageryProvider(p) — 自动创建图层 + 添加到场景
 *   viewer.imageryLayers.add(layer) — 添加已创建好的图层
 *   TerrainProvider — 地形高程提供者，决定三维地形起伏
 *   UrlTemplateImageryProvider 的 URL 占位符:
 *     {z} — 缩放级别 (0=最顶层)
 *     {x} — 瓦片列号 (西→东)
 *     {y} — 瓦片行号 (北→南)
 *     {s} — 子域名，从 subdomains 数组中随机选一个，用于浏览器并发限制
 *     {reverseY} — {y} 的反转（南→北）
 *   maximumLevel — 最大瓦片级别，避免请求不存在的级别
 */
import {
  ImageryLayer,
  CesiumTerrainProvider,
  EllipsoidTerrainProvider,
  ArcGISTiledElevationTerrainProvider,
  OpenStreetMapImageryProvider,
  SingleTileImageryProvider,
  UrlTemplateImageryProvider,
  WebMapTileServiceImageryProvider,
  WebMapServiceImageryProvider,
  GeographicTilingScheme,
} from "cesium"
import type { Viewer } from "cesium"

// ── 类型 ──────────────────────────────────────────────────────────

export interface CesiumBasemapItem {
  id: string
  label: string
  group: string
  groupLabel: string
  /** 激活此底图：viewer 已就绪，负责清理旧层 + 加载新内容 */
  activate: (viewer: Viewer) => Promise<void>
}

// ── 常量 ──────────────────────────────────────────────────────────

function getTdtKey(): string {
  return import.meta.env.VITE_TIANDITU_KEY
}

/** 清理所有影像图层 */
function clearLayers(viewer: Viewer) {
  // 始终删索引 0：remove 后后续图层自动补到 0 位，重复即可删完所有层
  while (viewer.imageryLayers.length > 0) {
    viewer.imageryLayers.remove(viewer.imageryLayers.get(0))
  }
}

// ── 底图注册表 ────────────────────────────────────────────────────

export const CESIUM_BASEMAP_LIST: CesiumBasemapItem[] = [
  // ── 组 1：默认底图 ──────────────────────────────────────────────
  {
    id: "cesium-ion",
    label: "Cesium Ion 默认",
    group: "default",
    groupLabel: "默认底图",
    activate: async (viewer) => {
      clearLayers(viewer)
      // fromWorldImagery是 Cesium Ion 的默认影像服务，需 Ion token 有效
      viewer.imageryLayers.add(ImageryLayer.fromWorldImagery({}))
      try {
        // Cesium World Terrain（assetId=1），全球高程，需 Ion token 有效
        viewer.terrainProvider = await CesiumTerrainProvider.fromIonAssetId(1)
      } catch (e) {
        console.warn("Cesium World Terrain 加载失败，检查 Ion Token 权限:", e)
      }
    },
  },
  {
    id: "osm",
    label: "OSM 标准地图",
    group: "default",
    groupLabel: "默认底图",
    activate: async (viewer) => {
      clearLayers(viewer)
      viewer.imageryLayers.addImageryProvider(
        new OpenStreetMapImageryProvider({
          url: "https://tile.openstreetmap.org/",
        })
      )
    },
  },
  {
    id: "single-world",
    label: "自定义世界地图",
    group: "default",
    groupLabel: "默认底图",
    activate: async (viewer) => {
      clearLayers(viewer)
      viewer.imageryLayers.addImageryProvider(
        new SingleTileImageryProvider({
          url: "/cesium-assets/world_b.jpg",
          tileWidth: 8176,  // world_b.jpg 实际像素宽
          tileHeight: 4032, // world_b.jpg 实际像素高
        })
      )
    },
  },

  // ── 组 2：中国地图服务（直接 XYZ URL，无坐标纠偏） ────────────
  {
    id: "amap-elec",
    label: "高德矢量地图",
    group: "chinese",
    groupLabel: "中国地图服务",
    activate: async (viewer) => {
      clearLayers(viewer)
      viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          // {s} — 子域名占位符，从subdomains随机选一个替换。
          url: "//webrd{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
          subdomains: ["01", "02", "03", "04"], // 高德地图的子域名，用来分散请求，避免浏览器并发限制
          maximumLevel: 18,
        })
      )
    },
  },
  {
    id: "amap-img",
    label: "高德卫星影像",
    group: "chinese",
    groupLabel: "中国地图服务",
    activate: async (viewer) => {
      clearLayers(viewer)
      viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: "//webst{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",
          subdomains: ["01", "02", "03", "04"],
          maximumLevel: 18,
        })
      )
    },
  },
  {
    id: "tencent-elec",
    label: "腾讯地图",
    group: "chinese",
    groupLabel: "中国地图服务",
    activate: async (viewer) => {
      clearLayers(viewer)
      viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: "//rt{s}.map.gtimg.com/tile?z={z}&x={x}&y={reverseY}&styleid=1&scene=0&version=347",
          subdomains: ["0", "1", "2"],
          maximumLevel: 18,
        // as any: Tencent URL 包含 styleid 参数，
        // Cesium 类型定义未覆盖所有可选字段，但运行时接受
        } as any)
      )
    },
  },
  {
    id: "tdt-vec",
    label: "天地图矢量",
    group: "chinese",
    groupLabel: "中国地图服务",
    activate: async (viewer) => {
      clearLayers(viewer)
      const key = getTdtKey()
      viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: `//t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=${key}`,
          subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
          maximumLevel: 18,
        })
      )
    },
  },
  {
    id: "tdt-img",
    label: "天地图影像",
    group: "chinese",
    groupLabel: "中国地图服务",
    activate: async (viewer) => {
      clearLayers(viewer)
      const key = getTdtKey()
      viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: `//t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=${key}`,
          subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
          maximumLevel: 18,
        })
      )
    },
  },

  // ── 组 3：在线标准服务 ──────────────────────────────────────────
  {
    id: "arcgis-img",
    label: "ArcGIS 卫星影像",
    group: "online",
    groupLabel: "在线标准服务",
    activate: async (viewer) => {
      clearLayers(viewer)
      viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          maximumLevel: 19,
        })
      )
      // ArcGIS World Elevation，免费全球地形，无需 key
      try {
        viewer.terrainProvider = await ArcGISTiledElevationTerrainProvider.fromUrl(
          "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer"
        )
      } catch { /* 失败时保留无地形状态 */ }
    },
  },
  {
    id: "arcgis-street",
    label: "ArcGIS 街道地图",
    group: "online",
    groupLabel: "在线标准服务",
    activate: async (viewer) => {
      clearLayers(viewer)
      viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
          maximumLevel: 19,
        })
      )
    },
  },
  {
    id: "arcgis-topo",
    label: "ArcGIS 地形图",
    group: "online",
    groupLabel: "在线标准服务",
    activate: async (viewer) => {
      clearLayers(viewer)
      viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
          maximumLevel: 19,
        })
      )
    },
  },
  {
    id: "mars3d",
    label: "Mars3D 影像",
    group: "online",
    groupLabel: "在线标准服务",
    activate: async (viewer) => {
      clearLayers(viewer)
      viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: "//data.mars3d.cn/tile/img/{z}/{x}/{y}.jpg",
          maximumLevel: 18,
        })
      )
    },
  },
  {
    id: "mars3d-terrain",
    label: "Mars3D 影像+地形",
    group: "online",
    groupLabel: "在线标准服务",
    activate: async (viewer) => {
      clearLayers(viewer)
      viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: "//data.mars3d.cn/tile/img/{z}/{x}/{y}.jpg",
          maximumLevel: 18,
        })
      )
      // CesiumTerrainProvider 在 1.142 中构造函数不再接受 url，
      // 改用静态工厂方法 fromUrl() 异步加载。旧版 new CesiumTerrainProvider({ url })
      // 会创建空 provider 导致地球变透明。
      const fallback = new EllipsoidTerrainProvider()
      viewer.terrainProvider = fallback
      try {
        viewer.terrainProvider = await CesiumTerrainProvider.fromUrl(
          "//data.mars3d.cn/terrain"
        )
      } catch {
        viewer.terrainProvider = fallback
      }
    },
  },

  // ── 组 4：OGC 标准服务 ──────────────────────────────────────────
  {
    id: "tdt-wmts",
    label: "天地图 WMTS (经纬度)",
    group: "ogc",
    groupLabel: "OGC 标准服务",
    activate: async (viewer) => {
      clearLayers(viewer)
      const key = getTdtKey()
      const maxLevel = 18
      // 创建一个数组，用于存储从1到maxLevel+1的字符串形式的数字
      const matrixIds = Array.from({ length: maxLevel + 1 }, (_, i) =>
        // 将索引i加1后转换为字符串，这样matrixIds[0]将是"1"，matrixIds[1]将是"2"，以此类推
        String(i + 1)
      )
      viewer.imageryLayers.addImageryProvider(
        new WebMapTileServiceImageryProvider({
          url: `http://t0.tianditu.gov.cn/img_c/wmts?service=WMTS&version=1.0.0&request=GetTile&tilematrix={TileMatrix}&layer=img&style={style}&tilerow={TileRow}&tilecol={TileCol}&tilematrixset={TileMatrixSet}&format=tiles&tk=${key}`,
          layer: "img",
          style: "default",
          format: "tiles",
          tileMatrixSetID: "c",
          // GeographicTilingScheme = 经纬度直投（不投影），
          // 适用于天地图 _c 系列（CGCS2000 经纬度切图）。
          // 默认为 WebMercatorTilingScheme（墨卡托），用错会导致瓦片错位。
          tilingScheme: new GeographicTilingScheme(),
          tileMatrixLabels: matrixIds,
          maximumLevel: maxLevel,
        })
      )
    },
  },
  {
    id: "iowa-wms",
    label: "WMS 气象雷达",
    group: "ogc",
    groupLabel: "OGC 标准服务",
    activate: async (viewer) => {
      clearLayers(viewer)
      viewer.imageryLayers.addImageryProvider(
        new WebMapServiceImageryProvider({
          url: "https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi",
          layers: "nexrad-n0r",
          parameters: {
            transparent: "true",
            format: "image/png",
          },
        })
      )
    },
  },
]

/** 按 id 查底图配置项 */
export function getCesiumBasemapById(
  id: string
): CesiumBasemapItem | undefined {
  return CESIUM_BASEMAP_LIST.find((item) => item.id === id)
}
