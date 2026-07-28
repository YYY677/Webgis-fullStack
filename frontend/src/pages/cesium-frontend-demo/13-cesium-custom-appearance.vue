<template>
  <div id="cesiumContainer" class="map-container">
    <div v-if="panelOpen" class="panel-overlay" @click="panelOpen = false" />
    <div class="top-right-controls" @click.stop>
      <CesiumBasemapSwitcher :activate="switchBasemap" :initial="currentId" @toggle="panelOpen = $event" />
    </div>
    <div class="basemap-label">{{ currentLabel }}</div>

    <div class="left-panel" @click.stop>
      <el-scrollbar max-height="calc(100vh - 80px)">
        <el-card shadow="never" class="panel-card">
          <template #header>13 · 自定义 Appearance</template>
          <p class="card-desc">Primitive 不接收 MaterialProperty。这里直接给 <code>Appearance</code> 传入顶点和片元 GLSL，掌握几何属性进入 GPU
            的最短路径。</p>
          <div class="legend"><i class="gradient-dot" />静态渐变面 <i class="scan-dot" />动态扫描面</div>
          <p class="tip">顶点 Shader 传出 <code>st</code> 纹理坐标；片元 Shader 用它计算颜色。动态效果读取 Cesium 内置
            <code>czm_frameNumber</code>，不需要
            DrawCommand。<code>batchId</code> 虽未由本页 GLSL 手写使用，仍须声明给 Cesium 的 Primitive 批处理管线。</p>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>RenderState</template>
          <div class="switch-row"><span>深度测试</span><el-switch v-model="depthTest" @change="rebuildPrimitives" /></div>
          <div class="switch-row"><span>透明混合</span><el-switch v-model="alphaBlend" @change="rebuildPrimitives" /></div>
          <div class="switch-row"><span>背面剔除</span><el-switch v-model="backFaceCulling" @change="rebuildPrimitives" />
          </div>
          <p class="tip">这些状态不改变几何或 Shader 本身，却决定像素是否通过深度、如何和背景混合、是否渲染背面。</p>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>Primitive 渲染链</template>
          <pre>RectangleGeometry
    → POSITION_AND_ST
    → Appearance(vertex + fragment)
    → Primitive
    → DrawCommand（Cesium 内部生成）</pre>
          <p class="tip">第 05 页的 <code>MaterialAppearance</code> 让 Cesium 拼装材质 Shader；本页直接提供完整的顶点 / 片元入口。</p>
        </el-card>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"
import {
  Appearance,
  BlendingState,
  Cartesian3,
  GeometryInstance,
  Ion,
  Primitive,
  PrimitiveCollection,
  Rectangle,
  RectangleGeometry,
  VertexFormat,
  Viewer,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"
import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"

const panelOpen = ref(false)
const currentId = ref("")
const currentLabel = ref("")
const depthTest = ref(true)
const alphaBlend = ref(true)
const backFaceCulling = ref(false)

let viewer: Viewer | null = null
let primitiveCollection: PrimitiveCollection | null = null

const vertexShader = `
  // Cesium 把高精度世界坐标拆成 high/low 两部分传入 GPU，避免大范围地理坐标在 float 精度下发生抖动。
  // 这两被 czm_computePosition() 间接读取.
  in vec3 position3DHigh;
  in vec3 position3DLow;
  // Cesium 把 geometry 的 st 属性绑定进来，所以 vertex shader 里可以直接声明它。
  // st 是 Cesium 的 geometry 属性命名约定，不能随便更改。
  in vec2 st;
  // batchId 表示“当前顶点属于当前 Primitive 批次中的第几个 GeometryInstance”。
  // Cesium 会为 Primitive 的批处理管线拼接对 batchId 的访问。
  in float batchId;
  // 传给片元 shader 的插值变量。顶点 shader 里写入它，片元 shader 就能读取。
  out vec2 v_st;
  // main() 是 WebGL/GLSL 的固定入口；结果通过全局输出变量交给 GPU，当然没有返回值。
  void main() {
    // czm_computePosition()：Cesium 内建函数，负责处理地球大坐标的高低位精度拆分，得到可安全渲染的顶点位置。
    vec4 position = czm_computePosition();
    v_st = st;
    // gl_Position：GLSL 顶点阶段的内建输出变量必须写入它，GPU 才知道顶点应投影到屏幕什么位置。
    // czm_modelViewProjectionRelativeToEye：Cesium 内建矩阵，用于把顶点从模型/世界空间变换到裁剪空间，并保持远距离精度。
    gl_Position = czm_modelViewProjectionRelativeToEye * position;
  }
`

const gradientFragmentShader = `
  // v_st 是顶点 shader 传过来的插值变量，表示当前片元在矩形表面上的相对位置。 
  in vec2 v_st;
  // main() 是 WebGL/GLSL 的固定入口；结果通过全局输出变量交给 GPU，当然没有返回值。
  void main() {
    vec3 low = vec3(0.03, 0.18, 0.45);
    vec3 high = vec3(0.10, 0.95, 0.88);
    vec3 color = mix(low, high, v_st.y);
    // out_FragColor：Cesium 的 Appearance shader 片元颜色输出，必须写入它，GPU 才知道当前像素最终绘制什么颜色。
    out_FragColor = vec4(color, 0.72);
  }
`

const scanFragmentShader = `
  in vec2 v_st;
  void main() {
    // czm_frameNumber 每渲染一帧增长一次。它很适合演示动画，但速度会随实际帧率轻微变化；
    // /240.0 表示约 240 帧完成一轮；若约 60 FPS，大约每 4 秒从下扫到上一次。
    float phase = fract(czm_frameNumber / 240.0);
    // 动态扫描：扫描线所在位置 phase 与当前片元纵向位置比较
    // 例如当前 phase = 0.50：
    // 片元位置 v_st.y     abs(v_st.y - phase)     line
    // 0.10                0.40                    0.00，扫描线之外，不额外变亮
    // 0.47                0.03                    约 0.5，平滑过渡
    // 0.50                0.00                    1.00，扫描线中心，最亮
    // 0.53                0.03                    约 0.5，平滑过渡
    // 0.70                0.20                    0.00，扫描线之外，不额外变亮
    float line = 1.0 - smoothstep(0.0, 0.055, abs(v_st.y - phase));
    // 横向比例决定底色
    vec3 base = mix(vec3(0.13, 0.05, 0.32), vec3(0.55, 0.12, 0.95), v_st.x);
    // out_FragColor：Cesium 的 Appearance shader 片元颜色输出，必须写入它，GPU 才知道当前像素最终绘制什么颜色。
    out_FragColor = vec4(base + vec3(0.4, 0.95, 1.0) * line, 0.76);
  }
`

/**
| 部分 | 作用 |
|---|---|
| `vertexShaderSource` | 每个顶点如何变换位置、传递数据 |
| `fragmentShaderSource` | 每个片元最终输出什么颜色 |
| `renderState` | 深度测试、透明混合、背面剔除等 GPU 状态 |
| `translucent` | 是否可能产生半透明像素 |
| `closed` | 几何是否是封闭体，影响正反面等渲染判断 |
 */
function createAppearance(fragmentShaderSource: string) {
  return new Appearance({
    translucent: alphaBlend.value,
    // closed 描述几何是否是封闭体；平面矩形不是封闭体。
    closed: false,
    vertexShaderSource: vertexShader,
    fragmentShaderSource,
    renderState: {
      // RenderState 不改 GLSL 的颜色公式，而是规定 GPU 如何测试、混合和丢弃像素。
      depthTest: { enabled: depthTest.value },
      blending: alphaBlend.value ? BlendingState.ALPHA_BLEND : undefined,
      cull: { enabled: backFaceCulling.value }, // 背面剔除
    },
  })
}

function addRectangle(rectangle: Rectangle, height: number, fragmentShaderSource: string) {
  if (!primitiveCollection) return
  // POSITION_AND_ST 同时声明位置和纹理坐标；少了 ST，vertex shader 中的 `st` 就没有数据来源。
  // st 是二维纹理坐标，表示这个矩形表面上“每个渲染片元（GPU 准备计算颜色的屏幕采样点）”的相对位置。
  // s：横向 0~1，t：纵向 0~1。所以 v_st.y 不表示“第几个像素”，
  // 而表示“当前片元位于矩形从下到上的百分之多少”。例如 v_st.y = 0.35，就是离矩形底部约 35% 的位置。
  // 左上 (0, 1) ───────── 右上 (1, 1)
  //  │                    │
  //  │       矩形面        │
  //  │                    │
  // 左下 (0, 0) ───────── 右下 (1, 0)
  const geometry = new RectangleGeometry({ rectangle, height, vertexFormat: VertexFormat.POSITION_AND_ST })
  
  // GeometryInstance：画什么、画在哪里、每个对象携带什么数据
  // Appearance：用什么 shader 和渲染状态把它画出来
  // Primitive
  // ├─ geometryInstances
  // │  └─ GeometryInstance × N
  // │     ├─ geometry // 形状本身
  // │     ├─ modelMatrix // 可选：这个实例独有的位置、旋转、缩放
  // │     ├─ attributes // 可选：这个实例附带的 GPU 属性，例如 color、show
  // │     └─ id // 可选：拾取后返回给业务代码的标识
  // └─ appearance
  //    ├─ vertex shader
  //    ├─ fragment shader
  //    ├─ renderState
  //    └─ 材质/渲染相关选项
  primitiveCollection.add(new Primitive({
    // GeometryInstance 是“几何数据 + 可选实例属性”的组合；Primitive 负责把它提交给渲染管线。
    geometryInstances: new GeometryInstance({ geometry }),
    appearance: createAppearance(fragmentShaderSource),
    // 强制同步创建，便于这个教学页在重建后立即看到 shader 编译/渲染结果。
    asynchronous: false,
    allowPicking: false,
  }))
}

function rebuildPrimitives() {
  if (!primitiveCollection) return
  // Appearance 的 renderState 在创建后不适合原地修改，所以控件变化时重建这两个 primitive。
  primitiveCollection.removeAll()
  addRectangle(Rectangle.fromDegrees(116.33, 39.86, 116.39, 39.91), 2_600, gradientFragmentShader)
  addRectangle(Rectangle.fromDegrees(116.41, 39.86, 116.47, 39.91), 3_200, scanFragmentShader)
}

async function switchBasemap(item: CesiumBasemapItem) {
  if (!viewer || item.id === currentId.value) return
  await item.activate(viewer)
  currentId.value = item.id
  currentLabel.value = item.label
}

onMounted(() => {
  Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN
  viewer = new Viewer("cesiumContainer", {
    baseLayer: false, baseLayerPicker: false, animation: false, timeline: false,
    fullscreenButton: false, navigationHelpButton: false, homeButton: false, projectionPicker: false,
  })
  const defaultItem = CESIUM_BASEMAP_LIST.find((item) => item.id === "mars3d")!
  defaultItem.activate(viewer).then(() => { currentId.value = defaultItem.id; currentLabel.value = defaultItem.label })
  primitiveCollection = viewer.scene.primitives.add(new PrimitiveCollection())
  rebuildPrimitives()
  viewer.camera.setView({ destination: Cartesian3.fromDegrees(116.36, 39.88, 30000) })
})

onUnmounted(() => {
  if (viewer) viewer.destroy()
  viewer = null
  primitiveCollection = null
})
</script>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 99;
}

:deep(.cesium-viewer-bottom),
:deep(.cesium-viewer-toolbar) {
  display: none !important;
}

.top-right-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 100;
}

.basemap-label {
  position: absolute;
  left: 16px;
  bottom: 16px;
  z-index: 100;
  padding: 4px 12px;
  border-radius: 4px;
  color: #fff;
  background: rgba(0, 0, 0, .55);
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

.card-desc,
.tip {
  margin: 0 0 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.65;
}

.tip {
  margin: 10px 0 0;
  font-size: 11px;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.gradient-dot,
.scan-dot {
  width: 16px;
  height: 8px;
  border-radius: 3px;
  background: linear-gradient(90deg, #082e73, #1af4e1);
}

.scan-dot {
  background: linear-gradient(90deg, #330d7e, #cb45ff, #82f6ff);
}

pre {
  margin: 0;
  padding: 9px;
  overflow: auto;
  border-radius: 4px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  font: 11px/1.55 Consolas, monospace;
}
</style>
