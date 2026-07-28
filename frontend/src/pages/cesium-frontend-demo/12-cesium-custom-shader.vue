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
          <template #header>12 · CustomShader</template>
          <p class="card-desc">同一段 GLSL 同时用于 glTF 模型和 3D Tiles；它们保留自己的几何与加载方式，只在模型渲染管线的材质阶段注入代码。</p>
          <el-button-group>
            <el-button :type="effect === 'none' ? 'primary' : 'default'" size="small"
              @click="setEffect('none')">原始材质</el-button>
            <el-button :type="effect === 'gradient' ? 'primary' : 'default'" size="small"
              @click="setEffect('gradient')">高度渐变</el-button>
            <el-button :type="effect === 'scan' ? 'primary' : 'default'" size="small"
              @click="setEffect('scan')">动态扫描</el-button>
          </el-button-group>
          <div class="switch-row"><span>显示 GLB 模型</span><el-switch v-model="showModel" @change="syncVisibility" /></div>
          <div class="switch-row"><span>显示建筑 Tiles</span><el-switch v-model="showTiles" @change="syncVisibility" />
          </div>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>动态 uniform</template>
          <div class="slider-row"><span>扫描速度</span><el-slider v-model="scanSpeed" :min="0.1" :max="2"
              :step="0.1" /><strong>{{
                scanSpeed.toFixed(1) }}×</strong></div>
          <div class="slider-row"><span>扫描宽度</span><el-slider v-model="scanWidth" :min="0.02" :max="0.28" :step="0.01"
              @change="syncShaderUniforms" /><strong>{{ scanWidth.toFixed(2) }}</strong></div>
          <div class="color-row"><span>高亮颜色</span><el-color-picker v-model="scanColor" show-alpha
              @change="syncShaderUniforms" /></div>
          <el-switch v-model="running" active-text="动画运行" inactive-text="动画暂停" />
          <p class="tip"><code>setUniform()</code> 只更新 GPU 输入值，不重新加载模型或 Tileset。</p>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>渲染位置</template>
          <div class="compare-row"><code>vertexMain</code><span>读取模型坐标，将顶点高度通过 <code>v_height</code> 传给片元阶段。</span>
          </div>
          <div class="compare-row"><code>fragmentMain</code><span>根据高度、时间和宽度修改 <code>material.diffuse</code>
              与发光强度。</span></div>
          <div class="compare-row"><code>MODIFY_MATERIAL</code><span>先保留 glTF 的材质计算，再叠加渐变或扫描；本页默认使用这一模式。</span></div>
        </el-card>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"
import {
  Cartesian3,
  Cesium3DTileset,
  Color,
  CustomShader,
  CustomShaderMode,
  Ion,
  JulianDate,
  Model,
  Transforms,
  UniformType,
  VaryingType,
  Viewer,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"
import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"

// 这里切换的是同一份模型的“材质修改策略”，不是重新创建另一种几何。
type ShaderEffect = "none" | "gradient" | "scan"

const panelOpen = ref(false)
const currentId = ref("")
const currentLabel = ref("")
const effect = ref<ShaderEffect>("none")
const showModel = ref(true)
const showTiles = ref(true)
const scanSpeed = ref(0.7)
const scanWidth = ref(0.08)
const scanColor = ref("#00e5ff")
const running = ref(true)

let viewer: Viewer | null = null
let model: Model | null = null
let tileset: Cesium3DTileset | null = null
let modelShader: CustomShader | undefined
let tilesShader: CustomShader | undefined
let removeClockListener: (() => void) | null = null
let shaderStartTime: JulianDate | null = null

function toShaderColor(value: string) {
  const color = Color.fromCssColorString(value)
  // CustomShader 的 VEC3 uniform 只接收三个数值分量；Color 还包含 alpha，
  // 因此转换为 Cartesian3，正好对应 GLSL 中的 vec3。
  return new Cartesian3(color.red, color.green, color.blue)
}

function createShader(kind: Exclude<ShaderEffect, "none">) {
  const isScan = kind === "scan"
  return new CustomShader({
    // MODIFY_MATERIAL 表示先执行 glTF/PBR 的原始材质计算，
    // 再允许 fragmentMain 修改计算结果；它不会替换模型本身的顶点处理流程。
    mode: CustomShaderMode.MODIFY_MATERIAL,
    uniforms: {
      // uniform 是 CPU 每帧/交互时传给 GPU 的只读输入，不需要重新加载模型。
      u_color: { type: UniformType.VEC3, value: toShaderColor(scanColor.value) },
      u_scanWidth: { type: UniformType.FLOAT, value: scanWidth.value },
      u_time: { type: UniformType.FLOAT, value: 0 },
    },
    // varyings 是“顶点阶段传给片元阶段的数据通道”，这里注册的浮点传递变量。
    varyings: { v_height: VaryingType.FLOAT },
    // vertexShaderText：每个顶点执行一次，计算/传递数据
    /**
    vertexMain：CustomShader 的顶点阶段钩子，函数名固定不能改，Cesium 会在模型顶点处理的指定位置调用它。
    VertexInput：CustomShader 的顶点输入结构体，里面有当前顶点的属性，如 vsInput.attributes.positionMC。
    czm_modelVertexOutput：Cesium 提供的顶点输出结构；需要改顶点位置、法线等时会用到它。本页不改，所以没有使用。
    inout：表示该参数既能读取也能修改；这里可以理解成“Cesium 把可修改的顶点结果交给你”。
    */
    vertexShaderText: `
      void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
        // positionMC 是模型坐标（model coordinates），不是经纬度或世界坐标，类型是 vec3；
        // 此 demo 以 y 轴作为“高度”；不同模型的局部坐标轴可能需要改成 x/z。
        v_height = vsInput.attributes.positionMC.y;
      }
    `,
    // fragmentShaderText：每个屏幕像素执行一次，决定最终材质颜色
    /*
    fragmentMain：CustomShader 的片元阶段钩子，固定不能改，Cesium 在模型 PBR 材质计算后调用它，让你改材质结果。
    FragmentInput：CustomShader 的片元输入结构体，代表当前正在处理的片元相关输入；当前示例没有实际使用它。
    czm_modelMaterial：Cesium 的 glTF/PBR 模型材质结构体，CustomShader 用它承接模型原本算出的颜色、发光等结果。
    
    material.diffuse：表面的基础颜色。
    material.emissive   叠加扫描线发光

    u_color：由 JavaScript 用 setUniform() 传入 GPU 的颜色。
    u_scanWidth：传入的扫描宽度
    u_time：传入的时间，随时钟增长
    v_height：从顶点阶段传过来、且已插值后的高度。

    名称	              含义	                   例子
    clamp(x, min, max)	把数值限制在范围内	      clamp(1.4, 0, 1) 得到 1
    fract(x)	          只保留小数部分，制造循环	 fract(2.35) 得到 0.35
    abs(x)	            绝对值，忽略正负	        abs(-0.2) 得到 0.2
    smoothstep(a, b, x)	从 0 平滑过渡到 1	        x 从 a 到 b 时，结果平滑从 0 变 1
    mix(a, b, t)	      在 a、b 之间混合	        t=0 取 a；t=1 取 b
    band	              普通变量名	              本页用它表示扫描线强度
    */
    fragmentShaderText: isScan
      ? `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
          // /50.0：规定从最低到最高的有效范围是 50 个模型坐标单位。
          float height = clamp((v_height) / 50.0, 0.0, 1.0);
          float phase = fract(u_time);

          // band表示扫描线强度，0~1 之间。具体逻辑如下：
          // 例如当前某个像素固定在 height = 0.30：
          // phase = 0.30 → 距离 0.00，扫描线正好经过它
          // phase = 0.34 → 距离 0.04，扫描线靠近它
          // phase = 0.50 → 距离 0.20，扫描线已经离开
          // 默认 u_scanWidth = 0.08，表示扫描线从中心向上下各延伸 0.08 个归一化高度。
          // 距离 d                  band
          // d = 0.00                1.00，最亮
          // d = 0.04                约 0.50，半亮
          // d >= 0.08               0.00，不亮
          // 注意：影响范围从中心向上下各是 0.08，完整淡入淡出区域约为 0.16，不是只有 0.08。
          // 如果高度映射范围是 50 个模型单位，那么：单侧扫描宽度 ≈ 50 × 0.08 = 4 个模型单位
          float band = 1.0 - smoothstep(0.0, u_scanWidth, abs(height - phase));

          // material.diffuse：glTF 模型原本的表面颜色；u_color：面板传入的高亮色；height * 0.45：
          // 混合程度，最高处最多混入 45% 高亮色。mix(A, B, t) = A * (1-t) + B * t
          material.diffuse = mix(material.diffuse, u_color, height * 0.45);
          
          // material.emissive：叠加扫描线发光，band 越大越亮。
          material.emissive += u_color * band * 1.5;
        }
      `
      : `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
          float height = clamp((v_height) / 50.0, 0.0, 1.0);
          // 飞机的一直保持原色，因为飞机的v_height在模型坐标系中是负数，经过 clamp 后为 0.0。
          material.diffuse = mix(material.diffuse, u_color, height);
        }
      `,
  })
}

function setCustomShader(target: { customShader?: CustomShader }, shader?: CustomShader) {
  // 传入 undefined 是“解绑”已附着的 shader。解绑必须先于 destroy，
  // 否则渲染目标仍可能在下一帧访问已销毁的 GPU 资源。
  target.customShader = shader
}

function destroyCustomShader(shader?: CustomShader) {
  if (shader && !shader.isDestroyed()) shader.destroy()
}

function clearShaders() {
  if (model) setCustomShader(model, undefined)
  if (tileset) setCustomShader(tileset, undefined)
  destroyCustomShader(modelShader)
  destroyCustomShader(tilesShader)
  modelShader = undefined
  tilesShader = undefined
}

function applyShader() {
  if (!model || !tileset) return
  // CustomShader 自己持有 WebGL 资源；切换效果时先解除旧 shader，避免重复创建后泄漏。
  clearShaders()
  if (effect.value === "none") {
    return
  }

  // Model 与 Cesium3DTileset 各自持有一个 CustomShader 实例，
  // 这样两者的 uniform 和销毁生命周期互不影响。
  modelShader = createShader(effect.value)
  tilesShader = createShader(effect.value)
  setCustomShader(model, modelShader)
  setCustomShader(tileset, tilesShader)
  syncShaderUniforms()
}

function setEffect(value: ShaderEffect) {
  effect.value = value
  applyShader()
}

function syncShaderUniforms() {
  for (const shader of [modelShader, tilesShader]) {
    if (!shader) continue
    // setUniform 只更新 uniform 缓冲输入，不会重新编译 GLSL 或请求资源。
    shader.setUniform("u_color", toShaderColor(scanColor.value))
    shader.setUniform("u_scanWidth", scanWidth.value)
  }
}

function syncVisibility() {
  if (model) model.show = showModel.value
  if (tileset) tileset.show = showTiles.value
}

async function switchBasemap(item: CesiumBasemapItem) {
  if (!viewer || item.id === currentId.value) return
  await item.activate(viewer)
  currentId.value = item.id
  currentLabel.value = item.label
}

async function loadScene() {
  if (!viewer) return
  const [loadedModel, loadedTileset] = await Promise.all([
    Model.fromGltfAsync({
      url: "/cesium-data/models/737/scene.gltf",
      modelMatrix: Transforms.eastNorthUpToFixedFrame(Cartesian3.fromDegrees(116.44, 39.93, 800)),
      scale: 10,
      minimumPixelSize: 80,
    }),
    // 该 tileset 的 tileset.json 已带有地理定位变换，不能再额外套 ENU modelMatrix，
    // 否则会把整套建筑平移到错误位置。
    Cesium3DTileset.fromUrl("/cesium-data/tiles-buildings/tileset.json"),
  ])
  model = viewer.scene.primitives.add(loadedModel)
  tileset = viewer.scene.primitives.add(loadedTileset)
  syncVisibility()
  applyShader()
  viewer.camera.setView({ destination: Cartesian3.fromDegrees(116.44, 39.93, 10000) })
}

onMounted(() => {
  Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN
  viewer = new Viewer("cesiumContainer", {
    baseLayer: false, baseLayerPicker: false, animation: false, timeline: false,
    fullscreenButton: false, navigationHelpButton: false, homeButton: false, projectionPicker: false,
  })
  const defaultItem = CESIUM_BASEMAP_LIST.find((item) => item.id === "mars3d")!
  defaultItem.activate(viewer).then(() => { currentId.value = defaultItem.id; currentLabel.value = defaultItem.label })
  viewer.clock.shouldAnimate = true
  shaderStartTime = JulianDate.clone(viewer.clock.currentTime)
  removeClockListener = viewer.clock.onTick.addEventListener((clock) => {
    if (!running.value) return
    const elapsedSeconds = JulianDate.secondsDifference(clock.currentTime, shaderStartTime!)
    // Cesium 时钟驱动 u_time；GLSL 中只需读取它，不必自己维护 JavaScript 动画循环。
    for (const shader of [modelShader, tilesShader]) shader?.setUniform("u_time", elapsedSeconds * scanSpeed.value)
  })
  void loadScene()
})

onUnmounted(() => {
  removeClockListener?.()
  // Viewer 销毁不会替我们销毁已独立创建的 CustomShader，因此先显式释放。
  clearShaders()
  if (viewer) viewer.destroy()
  viewer = null
  model = null
  tileset = null
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

.switch-row,
.color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 12px;
}

.slider-row {
  display: grid;
  grid-template-columns: 64px 1fr 44px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.slider-row strong {
  color: var(--el-color-primary);
  font: 11px Consolas, monospace;
  text-align: right;
}

.compare-row {
  display: grid;
  grid-template-columns: 125px 1fr;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.compare-row code {
  color: var(--el-color-primary);
}
</style>
