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

        <!-- ════════════ 卡片一：加载与调试 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🚀 加载与调试</template>

          <p class="card-desc">
            3D Tiles 是 Cesium 三维数据核心标准。建筑白模带有属性（高度等），
            倾斜摄影是纯网格。
          </p>

          <div class="button-row">
            <el-button size="small" :loading="loadingBuildings" @click="loadBuildings">加载建筑白模</el-button>
            <el-button size="small" :loading="loadingOblique" @click="loadOblique">加载倾斜摄影</el-button>
          </div>

          <div v-if="tilesetReady" class="debug-row">
            <div class="toggle-item">
              <el-switch v-model="debugColorize" size="small" @change="setDebug" />
              <span class="toggle-label">瓦片着色</span>
            </div>
            <div class="toggle-item">
              <el-switch v-model="debugBV" size="small" @change="setDebug" />
              <span class="toggle-label">包围盒</span>
            </div>
            <div class="toggle-item">
              <el-switch v-model="debugCBV" size="small" @change="setDebug" />
              <span class="toggle-label">内容包围盒</span>
            </div>
          </div>

          <div v-if="loadedInfo" class="info-box">{{ loadedInfo }}</div>
        </el-card>

        <!-- ════════════ 卡片二：样式着色 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🎨 样式着色 — <code>Cesium3DTileStyle</code></template>

          <p class="card-desc">
            不修改数据，用条件表达式按属性动态着色。
          </p>

          <div v-if="propsAvailable" class="card-desc" style="margin-bottom:6px;">
            可用属性：<code>{{ propsAvailable }}</code>
          </div>
          <div v-else class="card-warn">
            ⚠️ 当前 tileset 无属性，仅「默认」样式可用
          </div>

          <div class="button-row">
            <el-button size="small" :disabled="!tilesetReady" @click="applyStyle('default')">⬜ 默认</el-button>
            <el-button size="small" :disabled="!tilesetReady || !propsAvailable" @click="applyStyle('height')">📊 按高度</el-button>
            <el-button size="small" :disabled="!tilesetReady || !propsAvailable" @click="applyStyle('random')">🎲 随机</el-button>
            <el-button size="small" :disabled="!tilesetReady || !propsAvailable" @click="applyStyle('byId')">🔢 按 ID</el-button>
          </div>

          <div v-if="activeStyle" class="info-box">
            样式：{{ activeStyle }}
            <span v-if="activeStyle !== '默认'" style="margin-left:8px;font-size:11px;color:var(--el-text-color-secondary)">
              （点击右上角回退按钮取消）
            </span>
          </div>
        </el-card>

        <!-- ════════════ 卡片三：点击拾取 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🔍 点击拾取属性</template>

          <p class="card-desc">
            点击建筑或倾斜摄影表面获取属性信息。
            选中项会高亮（默认样式下）。
          </p>

          <div v-if="featureProps" class="props-table">
            <div v-for="(v, k) in featureProps" :key="k" class="prop-row">
              <span class="prop-key">{{ k }}</span>
              <span class="prop-val">{{ formatProp(v) }}</span>
            </div>
          </div>
          <div v-else class="card-hint">点击任意建筑查看属性</div>
        </el-card>

        <!-- ════════════ 卡片四：偏移编辑 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🔧 偏移编辑 — <code>modelMatrix</code></template>

          <p class="card-desc">
            对 tileset 整体平移/旋转/缩放，读写分离，不修改源数据。
          </p>

          <div class="slider-group">
            <label class="sgl">X 偏移</label>
            <el-slider v-model="editTx" :min="-200" :max="200" :step="1"
              :disabled="!tilesetReady" @update:model-value="applyTransform" />
            <span class="slider-val">{{ editTx }}m</span>
          </div>
          <div class="slider-group">
            <label class="sgl">Y 偏移</label>
            <el-slider v-model="editTy" :min="-200" :max="200" :step="1"
              :disabled="!tilesetReady" @update:model-value="applyTransform" />
            <span class="slider-val">{{ editTy }}m</span>
          </div>
          <div class="slider-group">
            <label class="sgl">旋转</label>
            <el-slider v-model="editHeading" :min="0" :max="360" :step="1"
              :disabled="!tilesetReady" @update:model-value="applyTransform" />
            <span class="slider-val">{{ editHeading }}°</span>
          </div>
          <div class="slider-group">
            <label class="sgl">缩放</label>
            <el-slider v-model="editScale" :min="0.5" :max="3" :step="0.05"
              :disabled="!tilesetReady" @update:model-value="applyTransform" />
            <span class="slider-val">{{ editScale }}x</span>
          </div>

          <div style="margin-top: 8px;">
            <el-button size="small" type="danger" plain :disabled="!tilesetReady" @click="resetTransform">
              重置变换
            </el-button>
          </div>
        </el-card>

      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"
import { ElMessage } from "element-plus"
import {
  Viewer,
  Ion,
  Cartesian3,
  Color,
  Math as CesiumMath,
  Cesium3DTileset,
  Cesium3DTileStyle,
  Matrix3,
  Matrix4,
  Transforms,
  ScreenSpaceEventType,
  HeadingPitchRange,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"

import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"

// ── UI 状态 ──
const panelOpen = ref(false)
const currentId = ref("")
const currentLabel = ref("")

const loadingBuildings = ref(false)
const loadingOblique = ref(false)

// 调试开关
const debugColorize = ref(false)
const debugBV = ref(false)
const debugCBV = ref(false)

// 样式
const activeStyle = ref("")

// 拾取
const featureProps = ref<Record<string, any> | null>(null)

// 编辑
const editTx = ref(0)
const editTy = ref(0)
const editHeading = ref(0)
const editScale = ref(1)

// 加载信息
const loadedInfo = ref("")

// tileset 就绪状态（用于模板响应）
const tilesetReady = ref(false)
const propsAvailable = ref("")

// ── Cesium 引用 ──
let viewer: Viewer | null = null
let currentTileset: Cesium3DTileset | null = null
let lastFeature: any = null
let isPickingEnabled = true

// ── 工具 ──

function resetToDefaultView() {
  if (!viewer) return
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(116.39, 39.91, 10000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

function formatProp(v: any): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "number") return v.toFixed(0)
  return String(v)
}

// ══════════════════════════════════════════
// 卡片一：加载与调试
// ══════════════════════════════════════════

async function loadBuildings() {
  if (!viewer) return
  loadingBuildings.value = true
  try {
    await replaceTileset("/cesium-data/tiles-buildings/tileset.json")
    loadedInfo.value = "建筑白模加载完成 | 属性: _id(1~5442), height(1~74m), 瓦片数: 1"
  } catch (e: any) {
    ElMessage.error(`加载失败: ${e.message}`)
  } finally {
    loadingBuildings.value = false
  }
}

async function loadOblique() {
  if (!viewer) return
  loadingOblique.value = true
  try {
    await replaceTileset("/cesium-data/tiles-oblique/tileset.json")
    loadedInfo.value = "倾斜摄影加载完成 | 无属性(properties: null), 瓦片数: 2"
  } catch (e: any) {
    ElMessage.error(`加载失败: ${e.message}`)
  } finally {
    loadingOblique.value = false
  }
}

async function replaceTileset(url: string) {
  if (!viewer) return

  // 清除旧的 tileset
  if (currentTileset) {
    viewer.scene.primitives.remove(currentTileset)
    currentTileset = null
    tilesetReady.value = false
  }

  const tileset = await Cesium3DTileset.fromUrl(url)
  viewer.scene.primitives.add(tileset)
  currentTileset = tileset
  tilesetReady.value = true

  // 提取属性信息
  const props = tileset.properties
  if (props) {
    const names = Object.keys(props)
    propsAvailable.value = names.join(", ")
    loadedInfo.value = `属性: ${names.join(", ")}`
  } else {
    propsAvailable.value = ""
    loadedInfo.value = "该数据无属性，样式着色不可用"
  }

  // 重置 UI 状态
  clearPick()
  resetTransform()
  debugColorize.value = false
  debugBV.value = false
  debugCBV.value = false
  activeStyle.value = ""

  // 飞入视角
  viewer.flyTo(tileset, {
    offset: new HeadingPitchRange(0, CesiumMath.toRadians(-35), 1500),
    duration: 1.0,
  })
}

// ── 调试开关 ──
function setDebug() {
  if (!currentTileset) return
  currentTileset.debugColorizeTiles = debugColorize.value
  currentTileset.debugShowBoundingVolume = debugBV.value
  currentTileset.debugShowContentBoundingVolume = debugCBV.value
}

// ══════════════════════════════════════════
// 卡片二：样式着色
// ══════════════════════════════════════════

function applyStyle(type: string) {
  if (!currentTileset) return

  // 无属性时禁止应用按属性着色
  if (type !== "default" && !currentTileset.properties) {
    ElMessage.warning("当前 tileset 无属性，无法按属性着色")
    return
  }

  // 清除拾取高亮
  clearPick()

  switch (type) {
    case "default": {
      // 通过给空对象（{"color": "color()"}）来重置样式
      // 直接设置 tileset.style = undefined 可能会保留上一次的状态
      // 这里用透明样式强制刷新，然后置空
      currentTileset.style = new Cesium3DTileStyle({
        color: "color('#ffffff')",
      })
      currentTileset.style = undefined as any
      activeStyle.value = "默认"
      break
    }
    case "height": {
      // 使用 Cesium3DTileStyle 条件表达式
      // height < 10: 绿色, 10~30: 黄绿, 30~50: 橙, >= 50: 红
      currentTileset.style = new Cesium3DTileStyle({
        color: {
          conditions: [
            ["${height} >= 50", "color('#e74c3c')"],
            ["${height} >= 30", "color('#e67e22')"],
            ["${height} >= 15", "color('#f1c40f')"],
            ["${height} >= 5", "color('#2ecc71')"],
            ["true", "color('#1a6b3c')"],
          ],
        },
      })
      activeStyle.value = "按高度着色"
      break
    }
    case "random": {
      // 用 _id 取模8 映射到 8 种固定颜色，避免 HSL 语法兼容问题
      currentTileset.style = new Cesium3DTileStyle({
        color: {
          conditions: [
            ["${_id} % 8 === 0", "color('#e74c3c')"],
            ["${_id} % 8 === 1", "color('#3498db')"],
            ["${_id} % 8 === 2", "color('#2ecc71')"],
            ["${_id} % 8 === 3", "color('#f39c12')"],
            ["${_id} % 8 === 4", "color('#9b59b6')"],
            ["${_id} % 8 === 5", "color('#1abc9c')"],
            ["${_id} % 8 === 6", "color('#e67e22')"],
            ["true", "color('#95a5a6')"],
          ],
        },
      })
      activeStyle.value = "随机色（按 _id 取模8）"
      break
    }
    case "byId": {
      // 按 _id 奇偶分色 + 高度透明
      currentTileset.style = new Cesium3DTileStyle({
        color: {
          conditions: [
            ["${_id} % 2 === 0", "color('#3498db', 0.9)"],
            ["true", "color('#e74c3c', 0.9)"],
          ],
        },
      })
      activeStyle.value = "奇偶 ID 分色"
      break
    }
  }
}

// ══════════════════════════════════════════
// 卡片三：点击拾取
// ══════════════════════════════════════════

function clearPick() {
  // 恢复上次高亮的 feature 颜色
  if (lastFeature && currentTileset && !currentTileset.style) {
    try { (lastFeature as any).color = Color.WHITE } catch {}
  }
  lastFeature = null
  featureProps.value = null
}

function onPick(movement: any) {
  if (!viewer || !currentTileset || !isPickingEnabled) return

  // drillPick 返回该像素下的所有对象，逐个检查是否为 tileset feature
  const all = viewer.scene.drillPick(movement.position)
  let pickedFeature: any = null

  for (const item of all) {
    if (!item) continue
    const candidates = [item, item.primitive, item.feature, item.content]
    for (const c of candidates) {
      if (c && typeof c.getPropertyNames === "function" && c.getPropertyNames().length > 0) {
        pickedFeature = c
        break
      }
    }
    if (pickedFeature) break
  }

  if (!pickedFeature) { clearPick(); return }

  // 恢复上次高亮
  if (lastFeature && currentTileset && !currentTileset.style) {
    try { lastFeature.color = Color.WHITE } catch {}
  }

  // 高亮当前（仅默认样式下有效）
  if (!currentTileset.style) {
    try { pickedFeature.color = Color.CYAN } catch {}
  }
  lastFeature = pickedFeature

  // 提取属性
  const names = pickedFeature.getPropertyNames()
  const props: Record<string, any> = {}
  names.forEach((n: string) => { props[n] = pickedFeature.getProperty(n) })
  featureProps.value = props
}

// ══════════════════════════════════════════
// 卡片四：偏移编辑
// ══════════════════════════════════════════

function applyTransform() {
  if (!currentTileset) return

  // modelMatrix 叠加在 tileset.root.transform 之上。
  // 为了在瓷砖集局部坐标系下做 T/R/S，需要:
  // 1. 在瓷砖集世界中心建立 ENU（东-北-上）局部坐标系
  // 2. 在 ENU 系中组合变换: T * R * S
  // 3. 转回世界: enu * local * inv(enu)
  const center = currentTileset.boundingSphere.center

  // 用独立 result 矩阵避免引用别名字段
  const enu = Transforms.eastNorthUpToFixedFrame(center)
  const invEnu = new Matrix4()
  Matrix4.inverse(enu, invEnu)

  // 局部变换: T * R * S
  const t = Matrix4.fromTranslation(new Cartesian3(editTx.value, editTy.value, 0))
  const r = Matrix4.fromRotation(
    Matrix3.fromRotationZ(CesiumMath.toRadians(editHeading.value), new Matrix3()),
    new Matrix4(),
  )
  const s = Matrix4.fromScale(new Cartesian3(editScale.value, editScale.value, editScale.value))

  const tr = new Matrix4()
  Matrix4.multiply(t, r, tr)
  const trs = new Matrix4()
  Matrix4.multiply(tr, s, trs)

  // 世界变换: enu * trs * invEnu
  const temp = new Matrix4()
  Matrix4.multiply(enu, trs, temp)
  const world = new Matrix4()
  Matrix4.multiply(temp, invEnu, world)

  currentTileset.modelMatrix = world
}

function resetTransform() {
  editTx.value = 0
  editTy.value = 0
  editHeading.value = 0
  editScale.value = 1
  if (currentTileset) {
    currentTileset.modelMatrix = Matrix4.IDENTITY.clone()
  }
}

// ══════════════════════════════════════════
// 底图切换
// ══════════════════════════════════════════

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

// ══════════════════════════════════════════
// 生命周期
// ══════════════════════════════════════════

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
    destination: Cartesian3.fromDegrees(116.39, 39.91, 20000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
  })

  // 点击拾取：使用 Viewer 自带的 handler，避免与默认左键行为冲突
  viewer.screenSpaceEventHandler.setInputAction(onPick, ScreenSpaceEventType.LEFT_CLICK)

  // 自动加载建筑白模
  loadBuildings()
})

onUnmounted(() => {
  if (viewer) {
    if (currentTileset) {
      viewer.scene.primitives.remove(currentTileset)
      currentTileset = null
      tilesetReady.value = false
    }
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
  background: rgba(0, 0, 0, .55);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
}

.left-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 100;
  width: 370px;
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

.card-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin: 0 0 10px;
}

.card-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  text-align: center;
  margin: 4px 0;
}

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

/* ── 调试开关行 ── */
.debug-row {
  display: flex;
  gap: 14px;
  margin-top: 8px;
  padding: 8px 10px;
  background: var(--el-color-info-light-9);
  border-radius: 6px;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.toggle-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

/* ── 信息框 ── */
.card-warn {
  font-size: 11px;
  color: var(--el-color-warning);
  padding: 4px 8px;
  margin-bottom: 8px;
  background: var(--el-color-warning-light-9);
  border-radius: 4px;
  line-height: 1.5;
}

.info-box {
  margin-top: 6px;
  padding: 6px 8px;
  font-size: 11px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 4px;
  line-height: 1.5;
}

/* ── 属性表格 ── */
.props-table {
  max-height: 240px;
  overflow-y: auto;
  font-size: 12px;
}

.prop-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}

.prop-row:last-child { border-bottom: none; }

.prop-key {
  color: var(--el-text-color-secondary);
  font-family: monospace;
  font-size: 11px;
}

.prop-val {
  color: var(--el-text-color-primary);
  font-weight: 600;
  font-size: 11px;
}

/* ── 滑块组 ── */
.slider-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.slider-group .sgl {
  min-width: 50px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.slider-group .el-slider { flex: 1; }

.slider-val {
  min-width: 44px;
  text-align: right;
  font-size: 11px;
  font-family: monospace;
  color: var(--el-color-primary);
}
</style>
