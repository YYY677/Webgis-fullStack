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
              点击「默认」按钮恢复
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
            <label class="sgl">Z 偏移</label>
            <el-slider v-model="editTz" :min="-200" :max="200" :step="1"
              :disabled="!tilesetReady" @update:model-value="applyTransform" />
            <span class="slider-val">{{ editTz }}m</span>
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
  ScreenSpaceEventHandler,
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

// 样式
const activeStyle = ref("")

// 拾取
const featureProps = ref<Record<string, any> | null>(null)

// 编辑
const editTx = ref(0)
const editTy = ref(0)
const editTz = ref(0)
const editHeading = ref(0)
const editScale = ref(1)

// 加载信息
const loadedInfo = ref("")

// tileset 就绪状态（用于模板响应）
const tilesetReady = ref(false)
const propsAvailable = ref("")

// ── Cesium 引用 ──
let viewer: Viewer | null = null
let pickHandler: ScreenSpaceEventHandler | null = null
let currentTileset: Cesium3DTileset | null = null
let lastFeature: any = null
let isPickingEnabled = true

// 存储 tileset 原始 root.transform（用于变换复位）
let originalRootTransform: Matrix4 | null = null

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

  // 保存原始 root.transform 用于复位
  originalRootTransform = tileset.root.transform.clone()

  // 提取属性信息，信息存储于 tileset.json 元数据中。
  const props = tileset.properties
  if (props) {
    // 获取props对象的所有属性名，并转换为数组
    const names = Object.keys(props)
    // 将属性名数组用逗号和空格连接成字符串，并赋值给propsAvailable.value
    propsAvailable.value = names.join(", ")
    // 将属性名数组用逗号和空格连接成字符串，并添加"属性: "前缀，赋值给loadedInfo.value
    loadedInfo.value = `数据加载完毕，属性: ${names.join(", ")}`
  } else {
    propsAvailable.value = ""
    loadedInfo.value = "该数据无属性，样式着色不可用"
  }

  // 重置 UI 状态
  clearPick()
  resetTransform()
  activeStyle.value = ""

  // 飞入视角
  // viewer.flyTo的使用对象包括：Entity、EntityCollection、Primitive、Cesium3DTileset、DataSource
  viewer.flyTo(tileset, {
    // HeadingPitchRange这个主要用于：相机围绕目标观察（Camera Orbit）
    // HeadingPitchRoll表示：一个物体自身的旋转姿态（orientation）
    offset: new HeadingPitchRange(0, CesiumMath.toRadians(-35), 3500),
    duration: 1.0,
  })
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
      // style = undefined 即可恢复默认外观
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
  // lastFeature = 选中的要素
  lastFeature = null
  // featureProps是选中要素的属性
  featureProps.value = null
}

function onPick(movement: any) {
  if (!viewer || !currentTileset || !isPickingEnabled) return

  // 方法	                    用途
  // scene.pick()	            拾取屏幕上的对象
  // scene.drillPick()	      拾取多个对象
  // camera.pickEllipsoid()	  拾取地球表面坐标，不包含高度。
  // scene.pickPosition()	    拾取三维位置，包含高度（地形高度 + 模型高度）。
  // globe.pick()	            拾取地形位置，包含地形高度。
  const picked = viewer.scene.pick(movement.position)
  if (!picked) { clearPick(); return }

  console.log("Picked object:", picked)

  // Cesium 1.142 中 getPropertyNames() 已改为 getPropertyIds()
  // scene.pick 直接返回 Cesium3DTileFeature
  const hasMethod = (obj: any, name: string) =>
    obj && typeof obj[name] === "function"

  const idMethod = hasMethod(picked, "getPropertyIds")
    ? "getPropertyIds"
    : hasMethod(picked, "getPropertyNames")
      ? "getPropertyNames"
      : null

  if (!idMethod) { clearPick(); return }

  // 获取属性名列表
  const names: string[] = picked[idMethod]()
  if (!names || names.length === 0) { clearPick(); return }

  // 将上次高亮的 feature 恢复为白色（默认）
  // !currentTileset.style → 只有没开自定义样式时才尝试高亮，亮了才不会闪一下又消失
  // Cesium3DTileStyle 每帧覆盖 feature.color，设了也白设。
  if (lastFeature && currentTileset && !currentTileset.style) {
    try { lastFeature.color = Color.WHITE } catch {}
  }

  // 高亮当前
  if (!currentTileset.style) {
    try { picked.color = Color.CYAN } catch {}
  }
  lastFeature = picked

  // 提取属性
  const props: Record<string, any> = {}
  names.forEach((n: string) => { props[n] = picked.getProperty(n) })
  featureProps.value = props
}

// ══════════════════════════════════════════
// 卡片四：偏移编辑
//  Cesium 处理地球空间模型编辑的经典方式：
//  1. 根据模型的包围球中心建立局部东-北-上（ENU）坐标系
//  2. 在局部ENU坐标系做平移/旋转/缩放
//  3. 将局部ENU坐标系做逆矩阵变换转换回世界坐标系
//  4. 赋值给 tileset.modelMatrix
//  
//  为什么这么麻烦？
//  世界坐标example:(-2181734,4384314,4072670)
//  东移100m、旋转30°、缩放2倍，这些操作天然属于局部坐标。
//   
//  关于Matrix3 和 Matrix4：
//  Matrix3是3x3矩阵，主要用于旋转。因为旋转天然是3×3。
//  Matrix4是4x4矩阵，包含旋转、缩放和平移。
// ══════════════════════════════════════════

function applyTransform() {
  if (!currentTileset || !originalRootTransform) return

  // 每次从原始状态重新开始，避免累积误差
  currentTileset.root.transform = originalRootTransform.clone()
  // modelMatrix 是整个 tileset 的额外变换矩阵，先恢复为单位矩阵
  currentTileset.modelMatrix = Matrix4.IDENTITY.clone()

  // BoundingSphere = 用一个球把对象完全包住。center: 球心；radius: 半径
  const center = currentTileset.boundingSphere.center
  // 在 tileset 世界中心建立 东-北-上（ENU）局部坐标系 
  // cesium默认世界坐标系是地心地固坐标系（ECEF），对于人来说不好操作。
  // 所以在模型中心建立东-北-上局部坐标，旋转Z轴就是绕地面垂直方向旋转，符合人的直觉
  const enu = Transforms.eastNorthUpToFixedFrame(center)
  const invEnu = new Matrix4() 
  // 计算 enu 的逆矩阵，用于将局部 ENU 坐标系的变换转换回世界坐标系
  Matrix4.inverse(enu, invEnu)

  // 创建平移矩阵，例如：东移100米 北移50米 z方向移动 20
  // [ 1   0   0   100 ]
  // [ 0   1   0    50 ]
  // [ 0   0   1    20 ]
  // [ 0   0   0     1 ]
  const t = Matrix4.fromTranslation(new Cartesian3(editTx.value, editTy.value, editTz.value))
  // 创建旋转矩阵，绕ENU的Z轴旋转，所以就是就是水平旋转。
  // 假设绕Z轴旋转 θ 角度
  // [ cos  -sin   0 ]
  // [ sin   cos   0 ]
  // [  0     0    1 ]
  const rMat3 = Matrix3.fromRotationZ(CesiumMath.toRadians(editHeading.value), new Matrix3())
  // 升维，Matrix3是3x3矩阵，Matrix4是4x4矩阵，旋转矩阵需要升维才能和平移矩阵相乘。
  // [ cos  -sin   0   0 ]
  // [ sin   cos   0   0 ]
  // [  0     0    1   0 ]
  // [  0     0    0   1 ]
  const r = Matrix4.fromRotation(rMat3, new Matrix4()) 
  // 创建缩放矩阵，X、Y、Z一起变化：均匀缩放。
  // 假设：X方向缩放 2倍、Y方向缩放 3倍、Z方向缩放 0.5倍
  // [ 2   0   0   0 ]
  // [ 0   3   0   0 ]
  // [ 0   0 0.5  0 ]
  // [ 0   0   0   1 ]
  const s = Matrix4.fromScale(new Cartesian3(editScale.value, editScale.value, editScale.value))

  // 组合 T R S，这个顺序最常见。TRS不是硬性标准，但它是3D行业最常见约定。
  // 注意！：这里的顺序是先缩放，再旋转，最后平移。因为矩阵乘法是从右到左的。
  // 矩阵顺序非常重要，顺序不一样会导致结果不一样。
  const tr = new Matrix4()
  Matrix4.multiply(t, r, tr) // 得到 T * R
  const trs = new Matrix4()
  Matrix4.multiply(tr, s, trs) // 得到 T * R * S

  // 局部ENU坐标系应用变换矩阵
  const temp = new Matrix4()
  Matrix4.multiply(enu, trs, temp) // 得到 enu * trs
  // 将局部ENU坐标系的变换转换回世界坐标系
  const worldEdit = new Matrix4()
  Matrix4.multiply(temp, invEnu, worldEdit) // 得到 enu * trs * invEnu

  // 你的TRS是在局部ENU做的。但是modelMatrix需要世界坐标。
  currentTileset.modelMatrix = worldEdit

  // 放松视锥体裁剪，防止旋转后包围盒被误裁
  currentTileset.dynamicScreenSpaceError = true
  currentTileset.dynamicScreenSpaceErrorDensity = 0.0001
}

function resetTransform() {
  editTx.value = 0
  editTy.value = 0
  editTz.value = 0
  editHeading.value = 0
  editScale.value = 1
  // 检查当前瓦片集(originalRootTransform)是否存在
  if (currentTileset && originalRootTransform) {
    // 将当前瓦片集的根变换设置为原始根变换的克隆
    currentTileset.root.transform = originalRootTransform.clone()
    // 将当前瓦片集的模型矩阵设置为单位矩阵的克隆
    // modelMatrix是整个tileset额外的变换矩阵，这里使用单位矩阵表示没有额外变换
    currentTileset.modelMatrix = Matrix4.IDENTITY.clone()
    // 禁用当前瓦片集的动态屏幕空间误差
    // false：严格按照 tileset.json 里的 geometricError 走
    // true：Cesium根据距离帮你“放宽标准”，减少加载量
    currentTileset.dynamicScreenSpaceError = false
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

  const defaultItem = CESIUM_BASEMAP_LIST.find(i => i.id === "mars3d")!
  defaultItem.activate(viewer).then(() => {
    currentId.value = defaultItem.id
    currentLabel.value = defaultItem.label
  })

  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(116.39, 39.91, 20000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
  })

  // 参考项目做法：
  // 1. 取消默认单击事件
  // 2. 新建 ScreenSpaceEventHandler 绑定左键
  if (viewer.cesiumWidget?.screenSpaceEventHandler) {
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK)
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  }

  pickHandler = new ScreenSpaceEventHandler(viewer.scene.canvas)
  pickHandler.setInputAction(onPick, ScreenSpaceEventType.LEFT_CLICK)

  // 自动加载建筑白模
  loadBuildings()
})

onUnmounted(() => {
  if (pickHandler) { pickHandler.destroy(); pickHandler = null }
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
