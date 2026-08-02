<template>
  <div id="cesiumContainer" class="map-container">
    <div v-if="panelOpen" class="panel-overlay" @click="panelOpen = false" />

    <div class="top-right-controls" @click.stop>
      <CesiumBasemapSwitcher
        :activate="switchBasemap"
        :initial="currentId"
        @toggle="(v: boolean) => panelOpen = v"
      />
    </div>

    <div class="basemap-label">{{ currentLabel }}</div>

    <div class="left-panel" @click.stop>
      <el-scrollbar max-height="calc(100vh - 80px)">

        <!-- ════════════ 卡片一：地形开挖 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>⛏️ 地形开挖 — Globe 裁剪</template>

          <p class="card-desc">
            参考项目 4.1.1：对开挖区域的每条边构造一个竖直裁剪平面
            （法线朝外），区域内部被 GPU 裁剪掉，再补上底面与侧壁。
          </p>

          <div class="button-row">
            <el-button size="small" :type="globeClipActive ? 'primary' : 'default'"
              @click="toggleGlobeClip">
              {{ globeClipActive ? '关闭开挖' : '开启开挖' }}
            </el-button>
          </div>

          <div class="slider-row" style="margin-top: 8px;">
            <label>开挖深度</label>
            <el-slider v-model="excavateDepth" :min="10" :max="200" :step="10"
              :disabled="!globeClipActive" @update:modelValue="updateExcavateDepth" />
            <span class="slider-val">{{ excavateDepth }}m</span>
          </div>

          <p class="card-desc" style="margin-bottom: 0;">
            裁剪平面本身是固定的，深度滑块控制坑底（底面 polygon 与侧壁 wall）
            下沉的高度。开启后自动旋转到斜视视角观察坑内。
          </p>
        </el-card>

        <!-- ════════════ 卡片二：3D Tiles 裁剪 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🏢 3D Tiles 裁剪 — 建筑剖面</template>

          <p class="card-desc">
            对 <code>tiles-buildings</code> 加载两个正交裁剪平面，
            沿 Y 和 X 反向切除建筑外壁，露出内部楼层结构。
          </p>

          <div class="button-row">
            <el-button size="small" :loading="tilesLoading"
              :disabled="tilesReady || tilesLoading" @click="loadBuildings">
              {{ tilesLoading ? '加载中...' : '加载建筑模型' }}
            </el-button>
            <el-button size="small" :type="tilesClipActive ? 'primary' : 'default'"
              :disabled="!tilesReady" @click="toggleTilesClip">
              {{ tilesClipActive ? '关闭剖面' : '开启剖面' }}
            </el-button>
          </div>

          <p class="card-desc" style="margin-bottom: 0;">
            参考项目虽有「模型压平」但用的是 CustomShader，不是 ClippingPlane。
            此处的 ClippingPlaneCollection 是 GPU 端裁剪，不改数据、不依赖属性。
          </p>
        </el-card>

        <!-- ════════════ 卡片三：淹没分析 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🌊 简易淹没分析</template>

          <p class="card-desc">
            参考项目 4.1.10：Primitive + Water 材质的水域面，几何固定、
            水位通过 <code>modelMatrix</code> 抬升。支持播放、暂停与重置。
          </p>

          <div class="button-row">
            <el-button size="small" :disabled="floodActive" @click="startFlood">
              生成水面
            </el-button>
            <el-button size="small" :type="floodPlaying ? 'primary' : 'default'"
              :disabled="!floodActive" @click="toggleFloodPlay">
              {{ floodPlaying ? '⏸ 暂停' : '▶ 播放' }}
            </el-button>
            <el-button size="small" type="danger" plain :disabled="!floodActive"
              @click="clearFlood">清除</el-button>
          </div>

          <div v-if="floodActive" class="slider-row" style="margin-top: 8px;">
            <label>水位速度</label>
            <el-slider v-model="floodSpeed" :min="1" :max="20" :step="1"
              @update:modelValue="updateFloodSpeed" />
            <span class="slider-val">{{ floodSpeed }}x</span>
          </div>

          <div v-if="floodActive" class="status-box" style="margin-top: 8px;">
            当前水深：{{ floodDepth }}m
          </div>
        </el-card>

      </el-scrollbar>
    </div>
  </div>
</template>

<script lang="ts">
import {
  Cartesian3,
  ClippingPlane,
  Color,
  Material,
  Plane,
  buildModuleUrl,
} from "cesium"

/** 地形开挖区域的四个角点（逆时针：西南 → 东南 → 东北 → 西北） */
export const EXCAVATE_CORNERS: [number, number][] = [
  [116.30, 39.85],
  [116.42, 39.85],
  [116.42, 39.90],
  [116.30, 39.90],
]

/**
 * 参考项目 excavateTerrain.js 的平面构造算法：
 * 每条边取中点，法线 = 边方向 × 径向（指向多边形外部），
 * 距离 = 平面到地心的距离。四个平面围出的区域内部被裁剪掉。
 */
export function createExcavationPlanes(corners: [number, number][]): ClippingPlane[] {
  const points = corners.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat))
  const planes: ClippingPlane[] = []

  //遍历点数组，计算每个点与下一个点之间的中点，并基于中点生成裁剪平面
  for (let i = 0; i < points.length; i++) {
    // 最后一条边（i=3）直接 i+1 会访问 points[4]——不存在。取模让索引在末尾回绕到 0，生成闭合边。
    const next = points[(i + 1) % points.length]
    // 计算当前点与下一个点的中点
    const midpoint = Cartesian3.add(points[i], next, new Cartesian3())
    // 将中点坐标乘以0.5，确保中点位于两点的中间位置
    Cartesian3.multiplyByScalar(midpoint, 0.5, midpoint)

    // up = normalize(midpoint)：地心 → 边中点的向量，归一化就是"当地天顶"（径向向外）。
    const up = Cartesian3.normalize(midpoint, new Cartesian3())
    // right = normalize(next - midpoint)：下一个点减中点 = 边的方向（弦方向，近似水平切向）。
    const right = Cartesian3.normalize(
      Cartesian3.subtract(next, midpoint, new Cartesian3()),
      new Cartesian3(),
    )
    // normal = right × up：叉积的结果同时垂直于边方向和天顶 → 必然水平、且垂直于边。
    const normal = Cartesian3.normalize(
      Cartesian3.cross(right, up, new Cartesian3()),
      new Cartesian3(),
    )
    // 计算中点到平面的距离
    const distance = Plane.getPointDistance(new Plane(normal, 0.0), midpoint)
    // 将生成的裁剪平面添加到数组中
    planes.push(new ClippingPlane(normal, distance))
  }

  return planes
}

/**
 * 生成参考项目 4.1.10 风格的 Water fabric 材质配置。
 * 关键：baseWaterColor/blendColor 的 alpha 必须为 1（不透明）——
 * Entity polygon 走半透明混合管线会压暗颜色，Primitive + EllipsoidSurfaceAppearance
 * 直接输出材质色，颜色才亮。
 */
export function createWaterMaterial(): Material {
  return new Material({
    fabric: {
      type: "Water",
      uniforms: {
        // waterNormals.jpg 是 CesiumJS npm 包自带的资源，不是项目文件
        normalMap: buildModuleUrl("Assets/Textures/waterNormals.jpg"),
        frequency: 1000.0,
        animationSpeed: 0.01,
        amplitude: 10.0,
        baseWaterColor: new Color(0.4, 0.75, 1.0, 1.0),
        blendColor: new Color(0.3, 0.65, 0.95, 1.0),
        specularIntensity: 0.8,
      },
    },
  })
}
</script>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"
import { ElMessage } from "element-plus"
import {
  Viewer,
  Ion,
  Cartographic,
  Math as CesiumMath,
  ClippingPlaneCollection,
  Cesium3DTileset,
  Entity,
  Primitive,
  GeometryInstance,
  PolygonGeometry,
  PolygonHierarchy,
  EllipsoidSurfaceAppearance,
  Matrix4,
  sampleTerrainMostDetailed,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"

import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"

// ── UI 状态 ──
const panelOpen = ref(false)
const currentId = ref("")
const currentLabel = ref("")

// 地形开挖
const globeClipActive = ref(false)
const excavateDepth = ref(100)
let globeClipCollection: ClippingPlaneCollection | null = null
// 开挖坑底与侧壁的 entity 列表（更新深度时先移除再重建）
let excavateFloor: Entity | null = null
let excavateWalls: Entity | null = null
// 开挖区域采样到的最低地形高程
let excavateMinHeight = 0

// 3D Tiles 裁剪
const tilesLoading = ref(false)
const tilesReady = ref(false)
const tilesClipActive = ref(false)
let buildingTileset: Cesium3DTileset | null = null
let tilesClipCollection: ClippingPlaneCollection | null = null

// 淹没
const floodActive = ref(false)
const floodPlaying = ref(false)
const floodSpeed = ref(5)
const floodDepth = ref(0)
let floodPrimitive: Primitive | null = null
// 水面区域中心的径向单位向量，用于按水位高度抬升 modelMatrix
let floodUpNormal: Cartesian3 | null = null
let floodStartTime: number = 0
let floodMinHeight = 0
let floodRange = 0 // 水位最大上升幅度（米）
let floodAnimationFrame: number = 0

// ── Cesium ──
let viewer: Viewer | null = null

// ── 工具 ──

function resetView(height: number = 10000) {
  if (!viewer) return
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(116.39, 39.91, height),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

/** 重建坑底 polygon 与侧壁 wall（深度变化时调用） */
function rebuildExcavationFloor() {
  if (!viewer) return

  // 移除旧的底面与侧壁
  if (excavateFloor) { viewer.entities.remove(excavateFloor); excavateFloor = null }
  if (excavateWalls) { viewer.entities.remove(excavateWalls); excavateWalls = null }

  const floorHeight = excavateMinHeight - excavateDepth.value

  // 坑底：土色半透明面
  excavateFloor = viewer.entities.add({
    polygon: {
      hierarchy: Cartesian3.fromDegreesArray(
        EXCAVATE_CORNERS.map(([lon, lat]) => [lon, lat]).flat(),
      ),
      height: floorHeight,
      material: Color.fromCssColorString("#cbc6c2").withAlpha(0.9),
    },
  })

  // 侧壁：4 个角点围成的竖直墙。顶沿用统一地形最低高程（平坦区域近似贴地，
  // 不做逐点采样保持简单）；下沿为坑底
  // WallGeometry 只连接相邻两个点、不会自动闭合首尾，末尾重复第一个角点才能把
  // 最后一条边（西北 → 西南，即西侧墙）补上，否则西侧会露出裁切后的黑色空洞
  const corners = EXCAVATE_CORNERS.map(([lon, lat]) => [lon, lat]).flat()
  const wallPositions = Cartesian3.fromDegreesArray([...corners, corners[0], corners[1]])
  excavateWalls = viewer.entities.add({
    wall: {
      positions: wallPositions,
      maximumHeights: Array(wallPositions.length).fill(excavateMinHeight),
      minimumHeights: Array(wallPositions.length).fill(floorHeight),
      material: Color.fromCssColorString("#a89f94").withAlpha(0.95),
    },
  })
}

async function toggleGlobeClip() {
  if (!viewer) return

  if (globeClipActive.value) {
    // 关闭：只禁用不置 undefined —— 置 undefined 会立即 destroy collection，
    // 而渲染帧中旧 draw command 的 uniform 闭包仍引用它，导致 _target 报错
    if (globeClipCollection) globeClipCollection.enabled = false
    if (excavateFloor) { viewer.entities.remove(excavateFloor); excavateFloor = null }
    if (excavateWalls) { viewer.entities.remove(excavateWalls); excavateWalls = null }
    globeClipActive.value = false
    resetView()
    return
  }

  // 采样开挖区域内地形的最低高程
  const samplePoints: Cartographic[] = []
  for (const [lon, lat] of EXCAVATE_CORNERS) {
    samplePoints.push(Cartographic.fromDegrees(lon, lat))
  }
  let minH = 0
  try {
    // 使用terrainProvider对采样点进行最详细的地形采样
    // sampleTerrainMostDetailed函数返回更新后的采样点信息，包含高度等数据
    const updated = await sampleTerrainMostDetailed(viewer.terrainProvider, samplePoints)
    // 从更新后的采样点中找出最小高度值
    // 使用map函数提取所有高度值，然后使用Math.min和展开运算符找出最小值
    minH = Math.min(...updated.map(c => c.height))
  } catch {
    minH = 0
  }
  excavateMinHeight = minH

  // 四条边的竖直裁剪平面（法线朝外），区域内部被 GPU 裁掉
  globeClipCollection = new ClippingPlaneCollection({
    planes: createExcavationPlanes(EXCAVATE_CORNERS),
    edgeWidth: 2.0,
    edgeColor: Color.OLIVE,
  })
  // 设置地球的裁剪平面，用于显示特定区域的3D场景
  // viewer.scene.globe 表示场景中的地球对象
  // clippingPlanes 属性用于设置地球的裁剪平面集合
  // globeClipCollection 是一个包含裁剪平面数据的集合对象
  viewer.scene.globe.clippingPlanes = globeClipCollection
  globeClipActive.value = true

  // 重建坑底 polygon 与侧壁 wall
  rebuildExcavationFloor()

  // 斜视角度观察坑内
  const cx = (EXCAVATE_CORNERS[0][0] + EXCAVATE_CORNERS[2][0]) / 2
  const cy = (EXCAVATE_CORNERS[0][1] + EXCAVATE_CORNERS[2][1]) / 2
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(cx-0.05, cy-0.15, 15000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-40), roll: 0 },
    duration: 1.5,
  })
}

function updateExcavateDepth(_val: number) {
  if (!globeClipActive.value) return
  rebuildExcavationFloor()
}

// ══════════════════════════════════════════
// 3D Tiles 裁剪
// ══════════════════════════════════════════

async function loadBuildings() {
  if (!viewer) return
  tilesLoading.value = true
  try {
    buildingTileset = await Cesium3DTileset.fromUrl("/cesium-data/tiles-buildings/tileset.json")
    viewer.scene.primitives.add(buildingTileset)
    tilesReady.value = true
    viewer.flyTo(buildingTileset, { duration: 1.5 })
  } catch (e: any) {
    ElMessage.error(`建筑加载失败: ${e.message}`)
  } finally {
    tilesLoading.value = false
  }
}

function toggleTilesClip() {
  if (!buildingTileset) return

  if (tilesClipActive.value) {
    // 关闭：只禁用不置 undefined（原因同 Globe 裁剪，见 toggleGlobeClip）
    if (tilesClipCollection) tilesClipCollection.enabled = false
    tilesClipActive.value = false
    return
  }

  // 两个互相垂直的裁剪平面，切出建筑剖面，在模型局部坐标系中：Y 轴通常为北，X 轴为东
  // 含义是：在模型自己的坐标系里（tileset.json 的 root.transform 定义，
  // 这个白模是 ENU 局部系，+Y=北、+X=东、原点在模型中心附近），距离 distance 
  // 是沿法线距原点多少米——15m 就是"原点北侧 15 米处立一堵墙"，把更北的片元裁掉。
  // 所以：distance = 0 → 平面从模型中心切过
  //      法线 + 距离一起定义了一堵"墙"，墙哪侧的片元 n·p + d ≤ 0 被 discard
  tilesClipCollection = new ClippingPlaneCollection({
    planes: [
      // new Cartesian3(0.0, -1.0, 0.0)
      //  │       │     └─ z 分量：0，不朝上下
      //  │       └─ y 分量：-1，朝 Y 负方向（南）
      //  └─ x 分量：0，不朝东西
      // (0,-1,0) 就是"朝南"。同理 (-1,0,0) 是"朝西"、(0,0,1) 是"朝上"。
      // 保留规则（GLSL n·p + d > 0 保留）：法线指向的一侧保留
      // (0.0, -1.0, 0.0), 15.0)——墙以南的片元保留，以北（y ≥ 15）的片元裁剪。
      new ClippingPlane(new Cartesian3(0.0, -1.0, 0.0), 15.0),
      new ClippingPlane(new Cartesian3(-1.0, 0.0, 0.0), 10.0),
    ],
    edgeWidth: 1.0,
    edgeColor: Color.YELLOW,
  })
  // 交集 = "大家一致同意才裁"（4 面墙围出井），默认就是交集模式。
  // 并集 = "一个说要裁就裁"（2 面墙各切各的）。
  // 剖面要并集，挖坑要交集。
  tilesClipCollection.unionClippingRegions = true
  buildingTileset.clippingPlanes = tilesClipCollection
  tilesClipActive.value = true
}

// ══════════════════════════════════════════
// 淹没分析
// ══════════════════════════════════════════

async function startFlood() {
  if (!viewer || floodActive.value) return

  // 在北京附近选取一个小范围淹没区域
  const bounds = { west: 116.30, south: 39.85, east: 116.42, north: 39.90 }
  const samplePoints: Cartographic[] = []
  const step = 0.02
  for (let lon = bounds.west; lon <= bounds.east; lon += step) {
    for (let lat = bounds.south; lat <= bounds.north; lat += step) {
      samplePoints.push(Cartographic.fromDegrees(lon, lat))
    }
  }

  let minH = Infinity
  let maxH = -Infinity
  try {
    const updated = await sampleTerrainMostDetailed(viewer.terrainProvider, samplePoints)
    updated.forEach(c => {
      if (c.height < minH) minH = c.height
      if (c.height > maxH) maxH = c.height
    })
  } catch {
    // 无地形服务时用默认值
    minH = 0
    maxH = 100
  }

  floodMinHeight = minH
  floodRange = maxH - minH + 200

  // Primitive + PolygonGeometry + EllipsoidSurfaceAppearance + Water 材质。
  // 几何固定在坑底基准高度（1m 厚），水位动画通过 modelMatrix 抬升，避免每帧重建几何。
  const center = Cartesian3.fromDegrees(
    (bounds.west + bounds.east) / 2,
    (bounds.south + bounds.north) / 2,
  )
  // 计算水面上升的法线方向
  // Cartesian3.fromDegrees(...) 得到的 center，是从地心 (0,0,0) 指向水面区域中心点的位置向量
  // Cartesian3.normalize(center) 把它归一化成单位向量，方向不变——仍从地心穿过这个点指向外。
  // 因为这条向量的起点是地心，指向球面，方向天然是径向朝外的。
  floodUpNormal = Cartesian3.normalize(center, new Cartesian3())

  const waterGeometry = new PolygonGeometry({
    polygonHierarchy: new PolygonHierarchy(
      Cartesian3.fromDegreesArrayHeights([
        bounds.west, bounds.south, floodMinHeight,
        bounds.east, bounds.south, floodMinHeight,
        bounds.east, bounds.north, floodMinHeight,
        bounds.west, bounds.north, floodMinHeight,
      ]),
    ),
    height: floodMinHeight,
    extrudedHeight: floodMinHeight + 1,
  })

  floodPrimitive = new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: waterGeometry,
    }),
    appearance: new EllipsoidSurfaceAppearance({
      material: createWaterMaterial(),
    }),
    modelMatrix: Matrix4.IDENTITY,
  })
  viewer.scene.primitives.add(floodPrimitive)

  floodActive.value = true
  floodStartTime = performance.now()

  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(116.33, 39.78, 15000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-55), roll: 0 },
    duration: 1.5,
  })

  // 自动开始播放
  floodPlaying.value = true
  requestFloodFrame()
}

function getFloodRise(): number {
  if (!floodPlaying.value) return floodDepth.value
  const now = performance.now()
  const elapsed = ((now - floodStartTime) / 1000) * floodSpeed.value
  // 用 sin 产生往返水位波动
  const cycle = (Math.sin(elapsed * 0.5) + 1) / 2 // 0~1 循环
  return cycle * floodRange
}

function requestFloodFrame() {
  if (!floodActive.value) return
  floodDepth.value = parseFloat(getFloodRise().toFixed(1))
  // 用 requestAnimationFrame 驱动水面高度刷新：
  // 水面几何固定，水位动画通过 modelMatrix 沿径向抬升
  floodAnimationFrame = requestAnimationFrame(() => {
    if (viewer && floodPrimitive && floodUpNormal) {
      const rise = getFloodRise()
      floodPrimitive.modelMatrix = Matrix4.fromTranslation(
        Cartesian3.multiplyByScalar(floodUpNormal, rise, new Cartesian3()),
      )
    }
    if (viewer?.scene) viewer.scene.requestRender()
    requestFloodFrame()
  })
}

function toggleFloodPlay() {
  floodPlaying.value = !floodPlaying.value
  if (floodPlaying.value) {
    floodStartTime = performance.now()
    if (!floodAnimationFrame) requestFloodFrame()
  }
}

function updateFloodSpeed(_val: number) {
  floodStartTime = performance.now()
}

function clearFlood() {
  if (floodAnimationFrame) {
    cancelAnimationFrame(floodAnimationFrame)
    floodAnimationFrame = 0
  }
  if (viewer && floodPrimitive) {
    viewer.scene.primitives.remove(floodPrimitive)
    floodPrimitive = null
  }
  floodUpNormal = null
  floodActive.value = false
  floodPlaying.value = false
  floodDepth.value = 0
}

// ── 底图切换 ──

async function switchBasemap(item: CesiumBasemapItem) {
  if (item.id === currentId.value || !viewer) return
  try {
    await item.activate(viewer)
    currentId.value = item.id
    currentLabel.value = item.label
  } catch (e: any) {
    ElMessage.error(`底图切换失败: ${e.message}`)
  }
}

// ── 生命周期 ──

onMounted(() => {
  Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN

  viewer = new Viewer("cesiumContainer", {
    baseLayer: false,
    baseLayerPicker: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    navigationHelpButton: false,
    homeButton: false,
    projectionPicker: false,
  })

  const defaultItem = CESIUM_BASEMAP_LIST.find(i => i.id === "mars3d-terrain")!
  defaultItem.activate(viewer).then(() => {
    currentId.value = defaultItem.id
    currentLabel.value = defaultItem.label
  })

  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(116.39, 39.91, 10000),
  })
})

onUnmounted(() => {
  cancelAnimationFrame(floodAnimationFrame)
  if (viewer) {
    // 先禁用裁剪再销毁 viewer，避免渲染帧中引用被销毁的 collection
    if (globeClipCollection) globeClipCollection.enabled = false
    if (tilesClipCollection) tilesClipCollection.enabled = false
    viewer.destroy()
    viewer = null
  }
})
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 99;
}

:deep(.cesium-viewer-bottom) { display: none !important; }
:deep(.cesium-viewer-toolbar) { display: none !important; }

.top-right-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 100;
}

.basemap-label {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 100;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
}

/* ── 左侧面板 ── */
.left-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 100;
  width: 340px;
}

.panel-card {
  --el-card-padding: 12px;
  --el-card-border-radius: 8px;
  margin-bottom: 8px;
}

.panel-card :deep(.el-card__header) {
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
}

.panel-card :deep(.el-card__body) {
  padding: 12px;
}

/* ── 卡片描述 ── */
.card-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin: 0 0 10px;
}

/* ── 按钮 ── */
.button-row {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.button-row .el-button {
  flex: 1;
  font-size: 12px;
  padding: 8px 4px;
  min-width: 0;
}

.toolbar-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.toolbar-row .el-button {
  flex: 1;
  font-size: 12px;
  padding: 6px 4px;
}

/* ── 滑块 ── */
.slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.slider-row label {
  min-width: 80px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.slider-row .slider-val {
  min-width: 52px;
  text-align: right;
  font-size: 12px;
  font-family: monospace;
  color: var(--el-color-primary);
}

.slider-row .el-slider {
  flex: 1;
}

.status-box {
  font-size: 12px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  padding: 6px 10px;
  border-radius: 4px;
}
</style>
