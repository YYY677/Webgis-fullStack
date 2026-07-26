<template>
  <div id="cesiumContainer" class="map-container">
    <div v-if="panelOpen" class="panel-overlay" @click="panelOpen = false" />
    <div class="top-right-controls" @click.stop>
      <CesiumBasemapSwitcher :activate="switchBasemap" :initial="currentId"
        @toggle="(value: boolean) => (panelOpen = value)" />
    </div>
    <div class="basemap-label">{{ currentLabel }}</div>

    <div class="left-panel" @click.stop>
      <el-scrollbar max-height="calc(100vh - 80px)">
        <el-card shadow="never" class="panel-card">
          <template #header>11 · 动态材质</template>
          <p class="card-desc">一套自定义流动材质同时作用在线和墙上；扩散圆则用动态几何属性与颜色属性组合实现。</p>
          <div class="slider-row">
            <span>流动速度</span>
            <el-slider v-model="speed" :min="0.2" :max="3" :step="0.1" @update:model-value="applySpeed" />
            <strong>{{ speed.toFixed(1) }}×</strong>
          </div>
          <div class="slider-row">
            <span>扩散半径</span>
            <el-slider v-model="maxRadius" :min="400" :max="3000" :step="100" />
            <strong>{{ maxRadius }} m</strong>
          </div>
          <el-switch v-model="running" active-text="动画运行" inactive-text="动画暂停" @change="toggleClock" />
          <el-button size="small" plain class="reset-button" @click="resetEffects">恢复默认</el-button>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header><code>Material</code> 与 <code>MaterialProperty</code></template>
          <div class="compare-row"><code>Material</code><span>描述 Fabric / GLSL 与 uniform 的形状，交给 GPU 渲染。</span></div>
          <div class="compare-row"><code>MaterialProperty</code><span>在每个时间点返回材质类型和 uniform 值，供 Entity 更新。</span></div>
          <pre class="code-note">getType() → "DemoFlowLine"
    getValue(time) → { color, speed, time }</pre>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>当前效果</template>
          <ul class="effect-list">
            <li><i class="line-icon" />流动线：自定义 <code>FlowLineMaterialProperty</code></li>
            <li><i class="wall-icon" />动态墙：复用同一材质，改变承载几何</li>
            <li><i class="ring-icon" />扩散圆：<code>CallbackProperty</code> 驱动半径与透明度</li>
          </ul>
          <p class="tip">自定义材质只注册一次。若仅是颜色、宽度等常规动态值，优先使用 Cesium 内置 MaterialProperty，避免过早写 GLSL。</p>
        </el-card>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import {
  CallbackProperty,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  Event,
  Ion,
  JulianDate,
  Material,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue";
import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps";
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps";

const FLOW_LINE_TYPE = "CesiumDemoFlowLine";

type MaterialCache = { addMaterial: (type: string, options: Record<string, unknown>) => void };
const materialCache = (Material as unknown as { _materialCache: MaterialCache })._materialCache;

// Fabric 定义的是 GPU 材质：time、speed 和 color 是会被 MaterialProperty 更新的 uniform。
materialCache.addMaterial(FLOW_LINE_TYPE, {
  fabric: {
    type: FLOW_LINE_TYPE,
    uniforms: { color: Color.CYAN, speed: 1, time: 0 },
    source: `
      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        float phase = fract(time * speed - materialInput.st.s);
        float head = smoothstep(0.0, 0.12, phase);
        float tail = 1.0 - smoothstep(0.35, 0.7, phase);
        material.diffuse = color.rgb;
        material.alpha = color.a * head * tail;
        return material;
      }
    `,
  },
  translucent: () => true,
});

class FlowLineMaterialProperty {
  readonly definitionChanged = new Event();
  readonly isConstant = false;
  private readonly startTime = JulianDate.now();

  constructor(public color: Color, public speed: number) { }

  getType() {
    return FLOW_LINE_TYPE;
  }

  getValue(time: JulianDate, result: Record<string, unknown> = {}) {
    result.color = Color.clone(this.color, result.color as Color);
    result.speed = this.speed;
    result.time = JulianDate.secondsDifference(time, this.startTime);
    return result;
  }

  equals(other?: unknown) {
    return other instanceof FlowLineMaterialProperty && Color.equals(this.color, other.color) && this.speed === other.speed;
  }
}

const panelOpen = ref(false);
const currentId = ref("");
const currentLabel = ref("");
const speed = ref(1.2);
const maxRadius = ref(1600);
const running = ref(true);

let viewer: Viewer | null = null;
const flowMaterials: FlowLineMaterialProperty[] = [];

function addEffects() {
  if (!viewer) return;
  const lineMaterial = new FlowLineMaterialProperty(Color.fromCssColorString("#00e5ff"), speed.value);
  const wallMaterial = new FlowLineMaterialProperty(Color.fromCssColorString("#a0ff00"), speed.value * 0.7);
  flowMaterials.push(lineMaterial, wallMaterial);

  viewer.entities.add({
    polyline: {
      positions: Cartesian3.fromDegreesArrayHeights([
        116.35, 39.88, 80,
        116.39, 39.91, 120,
        116.44, 39.89, 90,
        116.47, 39.93, 140,
      ]),
      width: 7,
      material: lineMaterial,
    },
  });
  viewer.entities.add({
    wall: {
      positions: Cartesian3.fromDegreesArray([116.365, 39.865, 116.405, 39.865, 116.405, 39.895, 116.365, 39.895, 116.365, 39.865]),
      minimumHeights: [0, 0, 0, 0, 0],
      maximumHeights: [500, 650, 550, 700, 500],
      material: wallMaterial,
    },
  });
  const ringCenter = Cartesian3.fromDegrees(116.43, 39.93, 20);
  const ringStart = JulianDate.now();
  viewer.entities.add({
    position: ringCenter,
    ellipse: {
      semiMajorAxis: new CallbackProperty((time) => {
        const currentTime = time ?? JulianDate.now();
        const phase = (JulianDate.secondsDifference(currentTime, ringStart) * 0.25) % 1;
        return 120 + maxRadius.value * phase;
      }, false),
      semiMinorAxis: new CallbackProperty((time) => {
        const currentTime = time ?? JulianDate.now();
        const phase = (JulianDate.secondsDifference(currentTime, ringStart) * 0.25) % 1;
        return 120 + maxRadius.value * phase;
      }, false),
      material: new ColorMaterialProperty(
        new CallbackProperty((time, result) => {
          const currentTime = time ?? JulianDate.now();
          const phase = (JulianDate.secondsDifference(currentTime, ringStart) * 0.25) % 1;
          return Color.fromCssColorString("#1677ff").withAlpha(0.45 * (1 - phase), result);
        }, false),
      ),
      outline: true,
      outlineColor: Color.fromCssColorString("#1677ff"),
      height: 30,
    },
  });
}

function applySpeed() {
  if (flowMaterials.length !== 2) return;
  flowMaterials[0].speed = speed.value;
  flowMaterials[1].speed = speed.value * 0.7;
}

function toggleClock() {
  if (viewer) viewer.clock.shouldAnimate = running.value;
}

function resetEffects() {
  speed.value = 1.2;
  maxRadius.value = 1600;
  running.value = true;
  applySpeed();
  toggleClock();
}

async function switchBasemap(item: CesiumBasemapItem) {
  if (!viewer || item.id === currentId.value) return;
  await item.activate(viewer);
  currentId.value = item.id;
  currentLabel.value = item.label;
}

onMounted(() => {
  Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;
  viewer = new Viewer("cesiumContainer", {
    baseLayer: false,
    baseLayerPicker: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    navigationHelpButton: false,
    homeButton: false,
    projectionPicker: false,
  });
  const defaultItem = CESIUM_BASEMAP_LIST.find((item) => item.id === "mars3d")!;
  defaultItem.activate(viewer).then(() => {
    currentId.value = defaultItem.id;
    currentLabel.value = defaultItem.label;
  });
  viewer.camera.setView({ destination: Cartesian3.fromDegrees(116.41, 39.9, 24_000) });
  viewer.clock.shouldAnimate = true;
  addEffects();
});

onUnmounted(() => {
  flowMaterials.splice(0);
  if (viewer) viewer.destroy();
  viewer = null;
});
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
  bottom: 16px;
  left: 16px;
  z-index: 100;
  padding: 4px 12px;
  border-radius: 4px;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
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

.slider-row {
  display: grid;
  grid-template-columns: 64px 1fr 48px;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
}

.slider-row strong {
  color: var(--el-color-primary);
  font: 11px Consolas, monospace;
  text-align: right;
}

.reset-button {
  margin-left: 12px;
}

.compare-row {
  display: grid;
  grid-template-columns: 118px 1fr;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.compare-row code {
  color: var(--el-color-primary);
}

.code-note {
  margin: 10px 0 0;
  padding: 8px;
  overflow: auto;
  border-radius: 4px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  font: 11px/1.5 Consolas, monospace;
}

.effect-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.effect-list li {
  display: flex;
  align-items: center;
  gap: 7px;
}

.line-icon,
.wall-icon,
.ring-icon {
  display: inline-block;
  width: 18px;
  height: 4px;
  background: #00e5ff;
}

.wall-icon {
  height: 12px;
  background: #a0ff00;
}

.ring-icon {
  width: 12px;
  height: 12px;
  border: 2px solid #1677ff;
  border-radius: 50%;
  background: transparent;
}
</style>
