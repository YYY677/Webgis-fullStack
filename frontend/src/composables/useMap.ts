/**
 * useMap — OpenLayers Map 生命周期管理
 *
 * 职责：
 *  1. onMounted 时创建 Map 实例
 *  2. onUnmounted 时销毁（解除 target 绑定，释放资源）
 *  3. 提供 setBaseLayer() 方便切换底图
 *  4. 响应浏览器 resize（OL 默认已监听 window resize，无需额外处理）
 *
 * 用法：
 *   const { map, setBaseLayer } = useMap("container-id", {
 *     layers: [createTdtLayer("vec")],
 *     view: { center: [12958000, 4850000], zoom: 5 }
 *   })
 *
 *   setBaseLayer(newLayer)    // 替换底图
 *   map.value!.addLayer(...)  // 叠加业务图层
 */
import { onMounted, onUnmounted, shallowRef, type ShallowRef } from "vue"
import Map from "ol/Map"
import View from "ol/View"
import { fromLonLat } from "ol/proj"
import type BaseLayer from "ol/layer/Base"
import type { ViewOptions } from "ol/View"

export interface UseMapOptions {
  /** 初始图层（第 0 个会被记录为"当前底图"，供 setBaseLayer 替换） */
  layers?: BaseLayer[]
  /** View 构造参数 */
  view?: ViewOptions
  /**
   * 地图中心经纬度 [经度, 纬度]。
   * 如果传了这个，会自动通过 fromLonLat 转成 view.center（EPSG:3857），
   * 你不需要手动去管投影转换。
   */
  centerLonLat?: [number, number]
}

export function useMap(containerId: string, options: UseMapOptions = {}) {
  const map: ShallowRef<Map | null> = shallowRef(null)

  /** 记录当前底图层，setBaseLayer 时据此移除旧图层 */
  let currentBaseLayer: BaseLayer | null = null

  onMounted(() => {
    if (options.layers?.length) {
      currentBaseLayer = options.layers[0]
    }

    // 如果传了 centerLonLat，自动把经纬度转成 View 的投影坐标（默认 EPSG:3857）
    const viewOpts: ViewOptions = { ...options.view }
    if (options.centerLonLat) {
      viewOpts.center = fromLonLat(options.centerLonLat)
    }

    map.value = new Map({
      target: containerId,
      layers: options.layers ?? [],
      view: new View(viewOpts)
    })
  })

  onUnmounted(() => {
    if (map.value) {
      // setTarget(undefined) 相当于 OL 的 "销毁"：清除 DOM 绑定、移除事件监听
      map.value.setTarget(undefined)
      map.value = null
    }
  })

  /**
   * 替换底图（移除旧底图 → 添加新底图）
   * 注意：OL 的图层顺序是后添加的在上面，所以先移除旧的再加新的，顺序不变。
   */
  function setBaseLayer(layer: BaseLayer) {
    const m = map.value
    if (!m) {
      console.warn("[useMap] map 尚未初始化，setBaseLayer 延迟到 onMounted 后调用")
      return
    }
    if (currentBaseLayer) {
      m.removeLayer(currentBaseLayer)
    }
    m.addLayer(layer)
    currentBaseLayer = layer
  }

  return { map, setBaseLayer }
}
