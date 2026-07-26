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
          <template #header>09 · 绘制与量算</template>
          <p class="card-desc">
            左键加点，鼠标移动预览，右键或双击完成。点、线、面都先是交互几何，完成后才成为固定 Entity。
          </p>
          <div class="button-grid">
            <el-button :type="drawMode === 'point' ? 'primary' : 'default'"
              @click="startDrawing('point')">点位</el-button>
            <el-button :type="drawMode === 'line' ? 'primary' : 'default'"
              @click="startDrawing('line')">折线距离</el-button>
            <el-button :type="drawMode === 'polygon' ? 'primary' : 'default'"
              @click="startDrawing('polygon')">多边形面积</el-button>
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

/** 当前工具状态：none 表示未进入绘制；其余值决定鼠标事件如何解释。 */
type DrawMode = "none" | "point" | "line" | "polygon";
/** 已完成量算在左侧面板中的展示数据，不保存 Cesium Entity 本身。 */
type Measurement = { id: number; type: string; value: string };

// 面板与底图的 Vue 响应式状态：变化后会自动刷新模板。
const panelOpen = ref(false);
const currentId = ref("");
const currentLabel = ref("");
const drawMode = ref<DrawMode>("none");
const measurements = ref<Measurement[]>([]);

// Cesium 对象不需要参与 Vue 渲染，因此用普通变量保存，并在组件卸载时手动销毁。
let viewer: Viewer | null = null;
let handler: ScreenSpaceEventHandler | null = null;
// 鼠标移动时显示的蓝色临时线/面；完成、取消或清空时必须移除。
let previewEntity: Entity | null = null;
// 当前尚未完成的白色顶点 Entity。完成后留在地图上，但不再由该数组跟踪。
let activeVertexEntities: Entity[] = [];
// 当前尚未完成的真实拾取坐标：用于预览、贴地最终图形和距离/面积计算。
let activePositions: Cartesian3[] = [];
// 鼠标当前位置的临时拾取坐标；它只参与预览，左键后才会写入 activePositions。
let cursorPosition: Cartesian3 | undefined;
// 为面板结果生成稳定的 v-for key。
let measurementId = 0;
// 仅影响标记显示高度，不影响 activePositions 中用于量算的真实地表坐标。
const MARKER_HEIGHT_OFFSET_METERS = 20;

// 根据绘制模式动态给出下一步操作提示。
const drawHint = computed(() => {
  if (drawMode.value === "point") return "点击地图放置点位。";
  if (drawMode.value === "line") return "左键连续加点，右键或双击完成折线距离。";
  if (drawMode.value === "polygon") return "左键连续加点，右键或双击闭合并计算面积。";
  return "选择一种工具后开始绘制。";
});

/** 将 Cesium 的三维笛卡尔坐标转换为量算工具需要的十进制度经纬度。 */
function toGeographicPoints(positions: Cartesian3[]): GeographicPoint[] {
  return positions.map((position) => {
    const cartographic = Cartographic.fromCartesian(position);
    return {
      longitude: CesiumMath.toDegrees(cartographic.longitude),
      latitude: CesiumMath.toDegrees(cartographic.latitude),
    };
  });
}

/**
 * 将屏幕像素坐标拾取为世界坐标。
 * 三种策略依次降级，保证有 3D 模型、地形或纯椭球底图时都能尽量得到可用位置。
 */
function pickWorldPosition(windowPosition: Cartesian2) {
  if (!viewer) return undefined;
  const scene = viewer.scene;
  // 第一优先级：从深度缓冲区拾取，可得到 3D Tiles、模型或地形表面的位置。
  if (scene.pickPositionSupported) {
    const picked = scene.pickPosition(windowPosition);
    if (defined(picked)) return picked;
  }

  // 第二优先级：沿相机射线与 Globe 相交，仍会考虑真实地形高程。
  const ray = viewer.camera.getPickRay(windowPosition);
  if (defined(ray)) {
    const terrainPosition = scene.globe.pick(ray, scene);
    if (defined(terrainPosition)) return terrainPosition;
  }

  // 最后才退回椭球面；它不包含地形高程，只用于没有可用地形数据的场景。
  return viewer.camera.pickEllipsoid(windowPosition, scene.globe.ellipsoid);
}

/** 保持量算坐标不变，仅将视觉标记沿法线方向抬高，避免被地形深度裁掉。 */
function createMarkerPosition(groundPosition: Cartesian3) {
  // Cartesian3 是以地心为原点的 x/y/z 坐标；其中 z 指向全球北极，
  // 不是当前位置的“垂直向上”。因此不能直接给 groundPosition.z 加高度。
  // 先转成经纬度和椭球高，才能只修改当前位置的高度值。
  const cartographic = Cartographic.fromCartesian(groundPosition);
  return Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    // 仅抬高视觉用的白色顶点；groundPosition 原坐标仍用于最终图形和量算。
    cartographic.height + MARKER_HEIGHT_OFFSET_METERS,
  );
}

/**
 * 为一次“尚未完成”的线/面绘制增加白色顶点标记。
 * 该标记用于反馈用户已经点击过哪里；它与 activePositions 一一对应，以便取消或去重时删除。
 */
function addVertex(position: Cartesian3) {
  const vertex = viewer?.entities.add({
    position: createMarkerPosition(position),
    point: { pixelSize: 8, color: Color.WHITE, outlineColor: Color.fromCssColorString("#1677ff"), outlineWidth: 2 },
  });
  if (vertex) activeVertexEntities.push(vertex);
}

/** 当双击产生重复末点时，同步删除最后一个重复的白色顶点标记。 */
function removeLastActiveVertex() {
  const vertex = activeVertexEntities.pop();
  if (viewer && vertex) viewer.entities.remove(vertex);
}

/** 取消当前绘制时，只清除未完成绘制的顶点，不影响此前已经完成的结果。 */
function clearActiveVertices() {
  activeVertexEntities.forEach((vertex) => viewer?.entities.remove(vertex));
  activeVertexEntities = [];
}

/** 移除鼠标跟随的临时蓝色几何。 */
function removePreview() {
  if (viewer && previewEntity) viewer.entities.remove(previewEntity);
  previewEntity = null;
}

/**
 * 首次添加顶点后创建唯一的预览 Entity。
 */
function createPreview() {
  // 若已有预览 Entity，或当前模式为点位，则不再创建新的预览。
  if (!viewer || previewEntity || drawMode.value === "point") return;

  if (drawMode.value === "line") {
    previewEntity = viewer.entities.add({
      polyline: {
        // CallbackProperty 是 Cesium 的“动态属性，每次渲染时都调用这个函数，读取最新结果。
        // activePositions：已经左键确认的固定顶点；cursorPosition：鼠标当前悬停位置，随移动不断变化；
        // [...]：把“已确认顶点 + 当前鼠标位置”拼成预览线；
        // false：明确告诉 Cesium 回调结果会变化，不能当常量缓存。
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

/** 放弃本轮未完成绘制，并将临时状态恢复到“尚未开始”。 */
function cancelActiveDrawing() {
  removePreview();
  clearActiveVertices();
  activePositions = [];
  cursorPosition = undefined;
}

/** 切换工具前先取消旧工具未完成的临时几何，避免不同绘制模式混在一起。 */
function startDrawing(mode: Exclude<DrawMode, "none">) {
  cancelActiveDrawing();
  drawMode.value = mode;
}

/** 点位模式只需一次点击：创建红色点和经纬度标签，并立刻写入结果面板。 */
function addPointMeasurement(position: Cartesian3) {
  const point = toGeographicPoints([position])[0];
  viewer?.entities.add({
    // 数据仍使用 position 换算经纬度；这里只抬高显示 Entity，避免影响量算结果。
    position: createMarkerPosition(position),
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

/**
 * 双击在部分浏览器中会先触发两次 LEFT_CLICK，再触发 LEFT_DOUBLE_CLICK。
 * 这里让坐标数组和白色顶点数组同时去掉重复末点，保持两者一一对应。
 */
function removeRepeatedTerminalPosition() {
  const lastIndex = activePositions.length - 1;
  if (lastIndex < 1) return;
  const previousPosition = activePositions[lastIndex - 1];
  const lastPosition = activePositions[lastIndex];
  // 连续两个末点相差超过 1 cm 则判定为不重复，直接返回。
  if (!Cartesian3.equalsEpsilon(previousPosition, lastPosition, 0, 0.01)) return;

  activePositions.pop();
  removeLastActiveVertex();
}

/**
 * 将当前临时绘制固化为最终绿色 Entity，并计算对应距离或面积。
 * 点位模式已经在第一次点击时完成，因此这里仅处理线和面。
 */
function finishDrawing() {
  if (!viewer || drawMode.value === "none") return;
  // 去掉可能的重复末点
  removeRepeatedTerminalPosition();
  // 先复制一份顶点：函数末尾会清空 activePositions，但最终 Entity 与量算仍需这些坐标。
  const positions = activePositions.slice();
  const mode = drawMode.value;
  // 线至少需要两个点，面至少需要三个点；顶点不足时保留当前绘制状态，允许继续点击。
  const minimum = mode === "line" ? 2 : 3;

  if (positions.length < minimum) return;
  // 临时蓝色预览已经被最终绿色结果替代，因此不再保留。
  removePreview();
  // Cesium Entity 使用 Cartesian3；量算函数使用十进制度经纬度，所以在此转换一次。
  const geographicPoints = toGeographicPoints(positions);

  if (mode === "line") {
    viewer.entities.add({
      // clampToGround 让最终折线贴随地形，而不是连接三维坐标形成悬空直线。
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
        // PolygonHierarchy 根据顶点顺序自动闭合多边形，无需重复添加第一个点。
        hierarchy: new PolygonHierarchy(positions),
        material: Color.fromCssColorString("#00b96b").withAlpha(0.25),
        outline: true,
        outlineColor: Color.fromCssColorString("#00b96b"),
        // 是否启用每个位置的高度计算
        perPositionHeight: false,  // 默认为false，表示不启用每个位置的高度计算
      },
    });
    measurements.value.unshift({
      id: ++measurementId,
      type: "近似面积",
      value: formatArea(calculateLocalPolygonAreaMeters2(geographicPoints)),
    });
  }

  // 已完成的顶点要保留在地图上，只清空“当前绘制过程”的跟踪引用。
  activeVertexEntities = [];
  activePositions = [];
  cursorPosition = undefined;
  drawMode.value = "none";
}

// 它明确规定了传入的 event 参数必须是一个对象，并且该对象必须包含一个名为 position 的属性。
// Cartesian2 是 Cesium 库中代表二维屏幕坐标（像素坐标）的类型。
/** 左键负责“提交一个顶点”；屏幕坐标需先通过 pickWorldPosition 转成世界坐标。 */
function handleLeftClick(event: { position: Cartesian2 }) {
  const position = pickWorldPosition(event.position);
  // 没有命中地球/模型，或尚未选择绘制工具时，不产生任何结果。
  if (!position || drawMode.value === "none") return;

  // 若模式为生成点
  if (drawMode.value === "point") {
    addPointMeasurement(position);
    drawMode.value = "none";
    return;
  }

  // 线和面模式：先记录真实坐标，再创建视觉顶点，并确保预览 Entity 存在。
  activePositions.push(position);
  addVertex(position); // 添加线/面的顶点
  createPreview(); // 添加线/面要素
}

/** 鼠标移动只更新预览终点，不直接新增真实顶点。 */
function handleMouseMove(event: { endPosition: Cartesian2 }) {
  if (drawMode.value === "none" || drawMode.value === "point" || !activePositions.length) return;
  cursorPosition = pickWorldPosition(event.endPosition);
}

/** 双击可作为右键的替代完成操作，并兼容不同浏览器的单击/双击事件顺序。 */
function handleDoubleClick(event: { position: Cartesian2 }) {
  if (drawMode.value === "none" || drawMode.value === "point") return;

  const position = pickWorldPosition(event.position);
  if (!position) return;

  const lastPosition = activePositions[activePositions.length - 1];
  // 含义是：
  // 没有已有顶点：补加当前双击位置；
  // 最后一个顶点与双击位置不同：补加当前双击位置；
  // 最后一个顶点已经是当前位置：不再加，避免第三次重复
  if (!lastPosition || !Cartesian3.equalsEpsilon(lastPosition, position, 0, 0.01)) {
    activePositions.push(position);
    addVertex(position);
  }
  finishDrawing();
}

/** 清空当前临时绘制、已完成 Entity，以及左侧量算结果。 */
function clearAll() {
  cancelActiveDrawing();
  viewer?.entities.removeAll();
  measurements.value = [];
  drawMode.value = "none";
}

/** 由底图切换组件调用：激活新底图后同步更新左下角显示名称。 */
async function switchBasemap(item: CesiumBasemapItem) {
  if (!viewer || item.id === currentId.value) return;
  await item.activate(viewer);
  currentId.value = item.id;
  currentLabel.value = item.label;
}

// Vue 挂载完成后才有 #cesiumContainer，因此在这里创建 Viewer 和注册鼠标事件。
onMounted(() => {
  Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;
  // 关闭非本章重点的 Cesium 默认控件，让页面只聚焦绘制与量算 API。
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
  // 底图列表封装了不同影像源的 activate 行为；本章默认加载 mars3d 底图。
  const defaultItem = CESIUM_BASEMAP_LIST.find((item) => item.id === "mars3d")!;
  defaultItem.activate(viewer).then(() => {
    currentId.value = defaultItem.id;
    currentLabel.value = defaultItem.label;
  });
  // fromDegrees 接收经纬度和高度（米），这里将相机定位到北京上空。
  viewer.camera.setView({ destination: Cartesian3.fromDegrees(116.397, 39.908, 28000) });
  // 双击默认会缩放镜头；本页将它改为“结束绘制”。
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  // 开启后，地形会遮挡位于其后的几何；绘制标记因此需要单独抬高显示高度。
  viewer.scene.globe.depthTestAgainstTerrain = true;
  // 右键用于完成绘制，因此禁用浏览器默认右键菜单。
  viewer.scene.canvas.oncontextmenu = () => false;

  // 独立 Handler 只管理本章交互，避免把页面逻辑混入 Viewer 自带的默认事件处理器。
  handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(handleLeftClick, ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction(handleMouseMove, ScreenSpaceEventType.MOUSE_MOVE);
  handler.setInputAction(finishDrawing, ScreenSpaceEventType.RIGHT_CLICK);
  handler.setInputAction(handleDoubleClick, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
});

// 组件离开页面时销毁事件处理器和 Viewer，避免 WebGL 资源与事件监听泄漏。
onUnmounted(() => {
  if (handler) handler.destroy();
  if (viewer) {
    // destroy 会释放 WebGL 与事件资源；Vue 页面切换时必须执行，避免重复监听和显存泄漏。
    viewer.destroy();
  }
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

.status-box,
.code-note {
  margin-top: 10px;
  padding: 8px;
  border-radius: 4px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.code-note {
  overflow: auto;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  font-family: Consolas, monospace;
  font-size: 11px;
}

.clear-button {
  width: 100%;
  margin-top: 10px;
}

.result-list {
  display: grid;
  gap: 6px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  padding: 7px 8px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-size: 12px;
}

.result-item strong {
  color: var(--el-color-primary);
  font-family: Consolas, monospace;
}

.empty-hint {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  text-align: center;
}
</style>
