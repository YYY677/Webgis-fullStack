<template>
  <div id="cesiumContainer" class="map-container">
    <div v-if="panelOpen" class="panel-overlay" @click="panelOpen = false" />

    <div class="top-right-controls" @click.stop>
      <CesiumBasemapSwitcher :activate="switchBasemap" :initial="currentId" @toggle="(value: boolean) => (panelOpen = value)" />
    </div>
    <div class="basemap-label">{{ currentLabel }}</div>

    <div class="left-panel" @click.stop>
      <el-scrollbar max-height="calc(100vh - 80px)">
        <el-card shadow="never" class="panel-card">
          <template #header>09 · 绘制与量算</template>
          <p class="card-desc">
            左键加点，鼠标移动预览，右键完成。点、线、面都先是交互几何，完成后才成为固定 Entity。
          </p>
          <div class="button-grid">
            <el-button :type="drawMode === 'point' ? 'primary' : 'default'" @click="startDrawing('point')">点位</el-button>
            <el-button :type="drawMode === 'line' ? 'primary' : 'default'" @click="startDrawing('line')">折线距离</el-button>
            <el-button :type="drawMode === 'polygon' ? 'primary' : 'default'" @click="startDrawing('polygon')">多边形面积</el-button>
          </div>
          <div class="status-box">{{ drawHint }}</div>
          <el-button size="small" plain type="danger" class="clear-button" @click="clearAll">清空全部</el-button>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header><code>CallbackProperty</code> 为什么适合预览？</template>
          <p class="card-desc">
            鼠标移动时不需要删除再新建线或面；Cesium 每帧读取回调返回的坐标数组，因此临时几何会自然更新。
          </p>
          <pre class="code-note">positions: new CallbackProperty(
  () => [...fixedPositions, cursorPosition], false
)</pre>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>量算结果</template>
          <div v-if="measurements.length" class="result-list">
            <div v-for="item in measurements" :key="item.id" class="result-item">
              <span>{{ item.type }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <div v-else class="empty-hint">完成一次绘制后，结果会保留在这里。</div>
          <p class="tip">面积采用局部等距近似投影，适合小范围交互量算；跨城市、跨区域统计应改用专业投影或后端空间计算。</p>
        </el-card>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  defined,
  Entity,
  Ion,
  LabelStyle,
  Math as CesiumMath,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue";
import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps";
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps";
import {
  calculateLocalPolygonAreaMeters2,
  calculateSurfaceDistanceMeters,
  formatArea,
  formatDistance,
  type GeographicPoint,
} from "@/utils/cesium-measure";

type DrawMode = "none" | "point" | "line" | "polygon";
type Measurement = { id: number; type: string; value: string };

const panelOpen = ref(false);
const currentId = ref("");
const currentLabel = ref("");
const drawMode = ref<DrawMode>("none");
const measurements = ref<Measurement[]>([]);

let viewer: Viewer | null = null;
let handler: ScreenSpaceEventHandler | null = null;
let previewEntity: Entity | null = null;
let activePositions: Cartesian3[] = [];
let cursorPosition: Cartesian3 | undefined;
let measurementId = 0;

const drawHint = computed(() => {
  if (drawMode.value === "point") return "点击地图放置点位。";
  if (drawMode.value === "line") return "左键连续加点，右键完成折线距离。";
  if (drawMode.value === "polygon") return "左键连续加点，右键闭合并计算面积。";
  return "选择一种工具后开始绘制。";
});

function toGeographicPoints(positions: Cartesian3[]): GeographicPoint[] {
  return positions.map((position) => {
    const cartographic = Cartographic.fromCartesian(position);
    return {
      longitude: CesiumMath.toDegrees(cartographic.longitude),
      latitude: CesiumMath.toDegrees(cartographic.latitude),
    };
  });
}

function pickWorldPosition(windowPosition: Cartesian2) {
  if (!viewer) return undefined;
  const scene = viewer.scene;
  if (scene.pickPositionSupported) {
    const picked = scene.pickPosition(windowPosition);
    if (defined(picked)) return picked;
  }
  return viewer.camera.pickEllipsoid(windowPosition, scene.globe.ellipsoid);
}

function addVertex(position: Cartesian3) {
  viewer?.entities.add({
    position,
    point: { pixelSize: 8, color: Color.WHITE, outlineColor: Color.fromCssColorString("#1677ff"), outlineWidth: 2 },
  });
}

function removePreview() {
  if (viewer && previewEntity) viewer.entities.remove(previewEntity);
  previewEntity = null;
}

function createPreview() {
  if (!viewer || previewEntity || drawMode.value === "point") return;

  if (drawMode.value === "line") {
    previewEntity = viewer.entities.add({
      polyline: {
        positions: new CallbackProperty(
          () => (cursorPosition ? [...activePositions, cursorPosition] : activePositions),
          false,
        ),
        width: 3,
        material: Color.fromCssColorString("#1677ff").withAlpha(0.85),
        clampToGround: true,
      },
    });
    return;
  }

  previewEntity = viewer.entities.add({
    polygon: {
      hierarchy: new CallbackProperty(
        () => new PolygonHierarchy(cursorPosition ? [...activePositions, cursorPosition] : activePositions),
        false,
      ),
      material: Color.fromCssColorString("#1677ff").withAlpha(0.25),
      outline: true,
      outlineColor: Color.fromCssColorString("#1677ff"),
      perPositionHeight: false,
    },
  });
}

function cancelActiveDrawing() {
  removePreview();
  activePositions = [];
  cursorPosition = undefined;
}

function startDrawing(mode: Exclude<DrawMode, "none">) {
  cancelActiveDrawing();
  drawMode.value = mode;
}

function addPointMeasurement(position: Cartesian3) {
  const point = toGeographicPoints([position])[0];
  viewer?.entities.add({
    position,
    point: { pixelSize: 11, color: Color.fromCssColorString("#ff4d4f"), outlineColor: Color.WHITE, outlineWidth: 2 },
    label: {
      text: `${point.longitude.toFixed(5)}°, ${point.latitude.toFixed(5)}°`,
      font: "12px sans-serif",
      fillColor: Color.WHITE,
      outlineColor: Color.BLACK,
      outlineWidth: 3,
      style: LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cartesian2(0, -24),
    },
  });
  measurements.value.unshift({
    id: ++measurementId,
    type: "点位",
    value: `${point.longitude.toFixed(5)}°, ${point.latitude.toFixed(5)}°`,
  });
}

function finishDrawing() {
  if (!viewer || drawMode.value === "none") return;
  const positions = activePositions.slice();
  const mode = drawMode.value;
  const minimum = mode === "line" ? 2 : 3;

  if (positions.length < minimum) return;
  removePreview();
  const geographicPoints = toGeographicPoints(positions);

  if (mode === "line") {
    viewer.entities.add({
      polyline: { positions, width: 4, material: Color.fromCssColorString("#00b96b"), clampToGround: true },
    });
    measurements.value.unshift({
      id: ++measurementId,
      type: "地表距离",
      value: formatDistance(calculateSurfaceDistanceMeters(geographicPoints)),
    });
  } else {
    viewer.entities.add({
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: Color.fromCssColorString("#00b96b").withAlpha(0.25),
        outline: true,
        outlineColor: Color.fromCssColorString("#00b96b"),
        perPositionHeight: false,
      },
    });
    measurements.value.unshift({
      id: ++measurementId,
      type: "近似面积",
      value: formatArea(calculateLocalPolygonAreaMeters2(geographicPoints)),
    });
  }

  activePositions = [];
  cursorPosition = undefined;
  drawMode.value = "none";
}

function handleLeftClick(event: { position: Cartesian2 }) {
  const position = pickWorldPosition(event.position);
  if (!position || drawMode.value === "none") return;

  if (drawMode.value === "point") {
    addPointMeasurement(position);
    drawMode.value = "none";
    return;
  }

  activePositions.push(position);
  addVertex(position);
  createPreview();
}

function handleMouseMove(event: { endPosition: Cartesian2 }) {
  if (drawMode.value === "none" || drawMode.value === "point" || !activePositions.length) return;
  cursorPosition = pickWorldPosition(event.endPosition);
}

function clearAll() {
  cancelActiveDrawing();
  viewer?.entities.removeAll();
  measurements.value = [];
  drawMode.value = "none";
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
  viewer.camera.setView({ destination: Cartesian3.fromDegrees(116.397, 39.908, 28_000) });
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.canvas.oncontextmenu = () => false;

  handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(handleLeftClick, ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction(handleMouseMove, ScreenSpaceEventType.MOUSE_MOVE);
  handler.setInputAction(finishDrawing, ScreenSpaceEventType.RIGHT_CLICK);
});

onUnmounted(() => {
  if (handler) handler.destroy();
  if (viewer) {
    viewer.scene.canvas.oncontextmenu = null;
    viewer.destroy();
  }
  handler = null;
  viewer = null;
});
</script>

<style scoped>
.map-container { position: relative; width: 100%; height: 100%; overflow: hidden; }
.panel-overlay { position: absolute; inset: 0; z-index: 99; }
:deep(.cesium-viewer-bottom), :deep(.cesium-viewer-toolbar) { display: none !important; }
.top-right-controls { position: absolute; top: 12px; right: 12px; z-index: 100; }
.basemap-label { position: absolute; bottom: 16px; left: 16px; z-index: 100; padding: 4px 12px; border-radius: 4px; color: #fff; background: rgba(0, 0, 0, 0.55); font-size: 12px; pointer-events: none; }
.left-panel { position: absolute; top: 12px; left: 12px; z-index: 100; width: 360px; }
.panel-card { --el-card-padding: 12px; margin-bottom: 8px; }
.panel-card :deep(.el-card__header) { padding: 10px 14px; font-size: 13px; font-weight: 600; }
.panel-card :deep(.el-card__body) { padding: 12px; }
.card-desc, .tip { margin: 0 0 10px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.65; }
.tip { margin: 10px 0 0; font-size: 11px; }
.button-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.status-box, .code-note { margin-top: 10px; padding: 8px; border-radius: 4px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-size: 12px; line-height: 1.5; white-space: pre-wrap; }
.code-note { overflow: auto; color: var(--el-text-color-secondary); background: var(--el-fill-color-light); font-family: Consolas, monospace; font-size: 11px; }
.clear-button { width: 100%; margin-top: 10px; }
.result-list { display: grid; gap: 6px; }
.result-item { display: flex; justify-content: space-between; padding: 7px 8px; border-radius: 4px; background: var(--el-fill-color-light); font-size: 12px; }
.result-item strong { color: var(--el-color-primary); font-family: Consolas, monospace; }
.empty-hint { color: var(--el-text-color-placeholder); font-size: 12px; text-align: center; }
</style>
