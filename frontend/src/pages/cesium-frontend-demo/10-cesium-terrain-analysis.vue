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
          <template #header>10 · 地形采样与分析</template>
          <p class="card-desc">本页使用地形服务，而不是把椭球面高度当作真实高程。所有采样都是异步请求。</p>
          <div class="button-grid">
            <el-button :type="mode === 'elevation' ? 'primary' : 'default'" :loading="loading"
              @click="start('elevation')">点高程</el-button>
            <el-button :type="mode === 'profile' ? 'primary' : 'default'" :loading="loading"
              @click="start('profile')">地形剖面</el-button>
            <el-button :type="mode === 'sight' ? 'primary' : 'default'" :loading="loading"
              @click="start('sight')">通视判断</el-button>
          </div>
          <div class="status-box">{{ hint }}</div>
          <el-button size="small" plain type="danger" class="clear-button" @click="clearAll">清空分析</el-button>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>采样结果</template>
          <div v-if="elevationResult" class="result-box">
            <span>点高程</span><strong>{{ elevationResult }}</strong>
          </div>
          <div v-if="profileSummary" class="result-box">
            <span>剖面范围</span><strong>{{ profileSummary }}</strong>
          </div>
          <div v-if="sightResult" class="result-box" :class="sightResult.visible ? 'visible' : 'blocked'">
            <span>通视结论</span><strong>{{ sightResult.visible ? '可通视' : `被地形遮挡（第 ${sightResult.blockedAt} 个采样点）`
              }}</strong>
          </div>
          <div v-if="!elevationResult && !profileSummary && !sightResult" class="empty-hint">选择工具并在地图上完成操作。</div>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>剖面采样（{{ profileSamples.length }} 点）</template>
          <div v-if="profileSamples.length" class="sample-list">
            <div v-for="sample in visibleSamples" :key="sample.index" class="sample-row">
              <span>{{ sample.distance }}</span><strong>{{ sample.height }}</strong>
            </div>
          </div>
          <div v-else class="empty-hint">绘制两点后显示等间距地形采样。</div>
          <p class="tip">`sampleTerrainMostDetailed` 尽量请求可用最高层级；耗时与采样数量、网络和服务能力有关。</p>
        </el-card>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  defined,
  EllipsoidGeodesic,
  Ion,
  Math as CesiumMath,
  sampleTerrainMostDetailed,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue";
import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps";
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps";
import { formatDistance } from "@/utils/cesium-measure";

type AnalysisMode = "none" | "elevation" | "profile" | "sight";
type ProfileSample = { index: number; distance: string; height: string; cartographic: Cartographic };

const panelOpen = ref(false);
const currentId = ref("");
const currentLabel = ref("");
const mode = ref<AnalysisMode>("none");
const loading = ref(false);
const elevationResult = ref("");
const profileSummary = ref("");
const profileSamples = ref<ProfileSample[]>([]);
const sightResult = ref<{ visible: boolean; blockedAt?: number } | null>(null);

let viewer: Viewer | null = null;
let handler: ScreenSpaceEventHandler | null = null;
let preview: ReturnType<Viewer["entities"]["add"]> | null = null;
let selectedPositions: Cartesian3[] = [];
let cursorPosition: Cartesian3 | undefined;

const hint = computed(() => {
  if (loading.value) return "正在向地形服务请求采样，请稍候…";
  if (mode.value === "elevation") return "点击任意位置，读取该位置的地形高程。";
  if (mode.value === "profile") return "依次点击剖面起点、终点，自动采样 64 个高程点。";
  if (mode.value === "sight") return "依次点击观察点、目标点，使用地形样本判断两点间是否被遮挡。";
  return "选择一种分析工具。";
});

const visibleSamples = computed(() => {
  if (profileSamples.value.length <= 10) return profileSamples.value;
  const last = profileSamples.value.length - 1;
  return profileSamples.value.filter((sample) => sample.index % 8 === 0 || sample.index === last);
});

function pickWorldPosition(windowPosition: Cartesian2) {
  if (!viewer) return undefined;
  const scene = viewer.scene;
  if (scene.pickPositionSupported) {
    const picked = scene.pickPosition(windowPosition);
    if (defined(picked)) return picked;
  }
  return viewer.camera.pickEllipsoid(windowPosition, scene.globe.ellipsoid);
}

function removePreview() {
  if (viewer && preview) viewer.entities.remove(preview);
  preview = null;
}

function resetActiveLine() {
  removePreview();
  selectedPositions = [];
  cursorPosition = undefined;
}

function start(nextMode: Exclude<AnalysisMode, "none">) {
  if (loading.value) return;
  resetActiveLine();
  mode.value = nextMode;
}

function ensurePreview() {
  if (!viewer || preview || selectedPositions.length !== 1) return;
  preview = viewer.entities.add({
    polyline: {
      positions: new CallbackProperty(
        () => (cursorPosition ? [selectedPositions[0], cursorPosition] : selectedPositions),
        false,
      ),
      width: 3,
      material: Color.fromCssColorString("#1677ff").withAlpha(0.8),
    },
  });
}

function addMarker(position: Cartesian3, color = Color.WHITE) {
  viewer?.entities.add({ position, point: { pixelSize: 9, color, outlineColor: Color.BLACK, outlineWidth: 1 } });
}

async function sampleElevation(position: Cartesian3) {
  if (!viewer) return;
  loading.value = true;
  try {
    const [sample] = await sampleTerrainMostDetailed(viewer.terrainProvider, [Cartographic.fromCartesian(position)]);
    const height = sample.height ?? 0;
    const longitude = CesiumMath.toDegrees(sample.longitude).toFixed(5);
    const latitude = CesiumMath.toDegrees(sample.latitude).toFixed(5);
    elevationResult.value = `${height.toFixed(1)} m（${longitude}°, ${latitude}°）`;
    viewer.entities.add({
      position: Cartesian3.fromRadians(sample.longitude, sample.latitude, height),
      point: { pixelSize: 12, color: Color.fromCssColorString("#ff4d4f"), outlineColor: Color.WHITE, outlineWidth: 2 },
    });
  } catch (error) {
    ElMessage.error(`地形采样失败：${error instanceof Error ? error.message : "未知错误"}`);
  } finally {
    loading.value = false;
  }
}

async function sampleLine(positions: Cartesian3[], useForSight: boolean) {
  if (!viewer) return;
  const start = Cartographic.fromCartesian(positions[0]);
  const end = Cartographic.fromCartesian(positions[1]);
  const geodesic = new EllipsoidGeodesic(start, end);
  const sampleCount = 64;
  const terrainPositions = Array.from({ length: sampleCount }, (_, index) =>
    geodesic.interpolateUsingFraction(index / (sampleCount - 1)),
  );

  loading.value = true;
  try {
    const samples = await sampleTerrainMostDetailed(viewer.terrainProvider, terrainPositions);
    const heights = samples.map((sample) => sample.height ?? 0);
    const distance = geodesic.surfaceDistance;
    const profile = samples.map((sample, index) => ({
      index,
      distance: formatDistance((distance * index) / (sampleCount - 1)),
      height: `${(sample.height ?? 0).toFixed(1)} m`,
      cartographic: sample,
    }));

    if (useForSight) {
      const observerHeight = heights[0] + 2;
      const targetHeight = heights[heights.length - 1] + 2;
      const blockedAt = heights.findIndex((height, index) => {
        if (index === 0 || index === heights.length - 1) return false;
        const lineHeight = observerHeight + ((targetHeight - observerHeight) * index) / (heights.length - 1);
        return height > lineHeight;
      });
      const visible = blockedAt === -1;
      sightResult.value = visible ? { visible } : { visible, blockedAt };
      viewer.entities.add({
        polyline: {
          positions: [
            Cartesian3.fromRadians(start.longitude, start.latitude, observerHeight),
            Cartesian3.fromRadians(end.longitude, end.latitude, targetHeight),
          ],
          width: 4,
          material: visible ? Color.fromCssColorString("#00b96b") : Color.fromCssColorString("#ff4d4f"),
        },
      });
    } else {
      profileSamples.value = profile;
      profileSummary.value = `${formatDistance(distance)}；最低 ${Math.min(...heights).toFixed(1)} m，最高 ${Math.max(...heights).toFixed(1)} m`;
      viewer.entities.add({
        polyline: {
          positions: samples.map((sample) => Cartesian3.fromRadians(sample.longitude, sample.latitude, (sample.height ?? 0) + 3)),
          width: 4,
          material: Color.fromCssColorString("#faad14"),
        },
      });
    }
  } catch (error) {
    ElMessage.error(`地形线采样失败：${error instanceof Error ? error.message : "未知错误"}`);
  } finally {
    loading.value = false;
  }
}

function handleLeftClick(event: { position: Cartesian2 }) {
  const position = pickWorldPosition(event.position);
  if (!position || mode.value === "none" || loading.value) return;

  if (mode.value === "elevation") {
    sampleElevation(position);
    mode.value = "none";
    return;
  }

  selectedPositions.push(position);
  addMarker(position, selectedPositions.length === 1 ? Color.fromCssColorString("#1677ff") : Color.fromCssColorString("#faad14"));
  if (selectedPositions.length === 1) {
    ensurePreview();
    return;
  }

  const useForSight = mode.value === "sight";
  removePreview();
  const positions = selectedPositions.slice();
  selectedPositions = [];
  mode.value = "none";
  sampleLine(positions, useForSight);
}

function handleMouseMove(event: { endPosition: Cartesian2 }) {
  if (selectedPositions.length !== 1) return;
  cursorPosition = pickWorldPosition(event.endPosition);
}

function clearAll() {
  resetActiveLine();
  viewer?.entities.removeAll();
  elevationResult.value = "";
  profileSummary.value = "";
  profileSamples.value = [];
  sightResult.value = null;
  mode.value = "none";
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
  const defaultItem = CESIUM_BASEMAP_LIST.find((item) => item.id === "mars3d-terrain")!;
  defaultItem.activate(viewer).then(() => {
    currentId.value = defaultItem.id;
    currentLabel.value = defaultItem.label;
  });
  viewer.camera.setView({ destination: Cartesian3.fromDegrees(110.15, 32.55, 22_000) });
  viewer.scene.globe.depthTestAgainstTerrain = true;

  handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(handleLeftClick, ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction(handleMouseMove, ScreenSpaceEventType.MOUSE_MOVE);
});

onUnmounted(() => {
  if (handler) handler.destroy();
  if (viewer) viewer.destroy();
  handler = null;
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
  width: 360px;
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

.button-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.status-box {
  margin-top: 10px;
  padding: 8px;
  border-radius: 4px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  font-size: 12px;
  line-height: 1.5;
}

.clear-button {
  width: 100%;
  margin-top: 10px;
}

.result-box {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  padding: 8px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-size: 12px;
}

.result-box strong {
  color: var(--el-color-primary);
  text-align: right;
}

.result-box.visible strong {
  color: var(--el-color-success);
}

.result-box.blocked strong {
  color: var(--el-color-danger);
}

.sample-list {
  display: grid;
  gap: 3px;
  max-height: 190px;
  overflow: auto;
}

.sample-row {
  display: flex;
  justify-content: space-between;
  padding: 5px 7px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font: 11px Consolas, monospace;
}

.sample-row strong {
  color: var(--el-color-primary);
}

.empty-hint {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  text-align: center;
}
</style>
