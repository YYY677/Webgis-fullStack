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
            <el-button :type="mode === 'slope' ? 'primary' : 'default'" :loading="loading"
              @click="start('slope')">坡度坡向</el-button>
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
          <div v-if="slopeResult" class="result-box">
            <span>坡度 / 坡向</span><strong>{{ slopeResult.slope }} / {{ slopeResult.aspect }}</strong>
          </div>
          <div v-if="!elevationResult && !profileSummary && !sightResult && !slopeResult" class="empty-hint">
            选择工具并在地图上完成操作。
          </div>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>剖面采样（{{ profileSamples.length }} 点）</template>
          <div v-if="profileSamples.length" class="sample-list">
            <div v-for="sample in visibleSamples" :key="sample.index" class="sample-row">
              <span>{{ sample.distance }}</span><strong>{{ sample.height }}</strong>
            </div>
          </div>
          <div v-else class="empty-hint">绘制两点后显示等间距地形采样。</div>
          <p class="tip">
            实际计算会保留全部 {{ profileSamples.length }} 个样本；为避免侧栏出现 64 行列表，默认只显示每第 8 个样本和最后一个样本。
            `sampleTerrainMostDetailed` 尽量请求可用最高层级；耗时与采样数量、网络和服务能力有关。
          </p>
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
import { calculateSlopeAndAspect } from "@/utils/terrain-analysis";
import type { Entity } from "cesium";

/** 当前鼠标交互应执行的分析类型；none 表示没有工具处于待点击状态。 */
type AnalysisMode = "none" | "elevation" | "profile" | "sight" | "slope";
/** 剖面线上一个地形样本，既保存用于显示的字符串，也保留原始地理坐标供后续扩展使用。 */
type ProfileSample = { index: number; distance: string; height: string; cartographic: Cartographic };
/** 坡度/坡向分析在结果面板中展示的已格式化数据。 */
type SlopeResult = { slope: string; aspect: string };

// 以下是 Vue 响应式状态：值改变后，模板中的按钮、提示和结果会自动重新渲染。
const panelOpen = ref(false);
const currentId = ref("");
const currentLabel = ref("");
const mode = ref<AnalysisMode>("none");
const loading = ref(false);
// 四种分析结果各自独立保存，完成一种分析不会清空其他分析的面板结果。
const elevationResult = ref("");
const profileSummary = ref("");
const profileSamples = ref<ProfileSample[]>([]);
const sightResult = ref<{ visible: boolean; blockedAt?: number } | null>(null);
const slopeResult = ref<SlopeResult | null>(null);

// Cesium 对象不参与 Vue 模板渲染，使用普通变量保存；页面卸载时必须手动销毁。
let viewer: Viewer | null = null;
let handler: ScreenSpaceEventHandler | null = null;
// 两点分析尚未完成时，鼠标跟随的蓝色预览线。
let preview: ReturnType<Viewer["entities"]["add"]> | null = null;
// 剖面和通视需要先后记录两个已点击的真实世界坐标。
let selectedPositions: Cartesian3[] = [];
// 鼠标当前位置仅用于预览，不会作为分析的正式端点。
let cursorPosition: Cartesian3 | undefined;
// 点高程和坡度/坡向都是单点分析：分别保存最新标记，下一次同类分析时移除旧标记。
let elevationEntity: Entity | null = null;
let slopeEntity: Entity | null = null;
// Horn 3×3 网格中，相邻地形样本之间的水平距离。
const SLOPE_SAMPLE_SPACING_METERS = 30;

/** 根据当前工具和异步状态动态给出用户的下一步操作。 */
const hint = computed(() => {
  if (loading.value) return "正在向地形服务请求采样，请稍候…";
  if (mode.value === "elevation") return "点击任意位置，读取该位置的地形高程。";
  if (mode.value === "profile") return "依次点击剖面起点、终点，自动采样 64 个高程点。";
  if (mode.value === "sight") return "依次点击观察点、目标点，使用地形样本判断两点间是否被遮挡。";
  if (mode.value === "slope") return "点击一个位置，采样周围 30 m 的 3×3 地形网格，计算坡度和坡向。";
  return "选择一种分析工具。";
});

/**
 * profileSamples 始终保存全部 64 个结果，计算和摘要也基于完整数组。
 * 只有侧栏列表做节选：显示 0、8、16 … 56 和最后一个 63，共 9 行，避免阅读负担。
 */
const visibleSamples = computed(() => {
  if (profileSamples.value.length <= 10) return profileSamples.value;
  const last = profileSamples.value.length - 1;
  return profileSamples.value.filter((sample) => sample.index % 8 === 0 || sample.index === last);
});

function pickWorldPosition(windowPosition: Cartesian2) {
  if (!viewer) return undefined;
  const scene = viewer.scene;
  // 第一层：读取当前画面的深度缓冲。命中 3D Tiles、模型或已渲染地形时，
  // 返回的就是鼠标实际点到的可见表面位置，适合优先响应用户的点击意图。
  if (scene.pickPositionSupported) {
    const picked = scene.pickPosition(windowPosition);
    if (defined(picked)) return picked;
  }

  // 第二层：相机射线与 Globe 的地形表面相交。它不拾取建筑和 3D Tiles，
  // 但在深度拾取不可用时，仍能得到真实山地的经纬度，而非穿过山体后的椭球面位置。
  const ray = viewer.camera.getPickRay(windowPosition);
  if (defined(ray)) {
    const terrainPosition = scene.globe.pick(ray, scene);
    if (defined(terrainPosition)) return terrainPosition;
  }

  // 最后兜底：相机射线与数学椭球相交。它始终可用，但没有地形起伏，
  // 山区点击时经纬度会与真实地表命中点存在偏差。
  return viewer.camera.pickEllipsoid(windowPosition, scene.globe.ellipsoid);
}

/** 移除尚未完成两点分析时的蓝色临时线。 */
function removePreview() {
  if (viewer && preview) viewer.entities.remove(preview);
  preview = null;
}

/** 切换工具、清空或完成分析后，将“正在选择两点”的临时状态归零。 */
function resetActiveLine() {
  removePreview();
  selectedPositions = [];
  cursorPosition = undefined;
}

/** 选择新工具前先丢弃上一个工具未完成的起点和预览线。 */
function start(nextMode: Exclude<AnalysisMode, "none">) {
  if (loading.value) return;
  resetActiveLine();
  mode.value = nextMode;
}

/**
 * 在第一个端点确定后创建唯一的预览线。
 * CallbackProperty 会在 Cesium 渲染时读取最新 cursorPosition，使线的末端跟随鼠标；
 * selectedPositions 本身不会因鼠标移动而增加，只有第二次左键才会提交正式终点。
 */
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

/** 为剖面/通视的已选端点添加视觉标记；颜色区分第一个和第二个端点。 */
function addMarker(position: Cartesian3, color = Color.WHITE) {
  viewer?.entities.add({ position, point: { pixelSize: 9, color, outlineColor: Color.BLACK, outlineWidth: 1 } });
}

/** 删除上一枚点高程标记；结果面板只对应地图上的最新红色点。 */
function removeElevationEntity() {
  if (viewer && elevationEntity) viewer.entities.remove(elevationEntity);
  elevationEntity = null;
}

/** 删除上一枚坡度/坡向中心标记。 */
function removeSlopeEntity() {
  if (viewer && slopeEntity) viewer.entities.remove(slopeEntity);
  slopeEntity = null;
}

/**
 * 查询一个点击位置对应的地形服务高程。
 * position 可能来自模型表面或椭球面，因此只把它的经纬度作为查询位置；最终高度以地形服务返回值为准。
 */
async function sampleElevation(position: Cartesian3) {
  if (!viewer) return;
  // 点击新位置时立即移除旧点，避免“一个结果对应多个红色点”。
  removeElevationEntity();
  elevationResult.value = "";
  loading.value = true;
  try {
    // 地形服务按经纬度切分瓦片，不认识地心坐标 (x, y, z)；所以必须转换。
    const [sample] = await sampleTerrainMostDetailed(viewer.terrainProvider, [Cartographic.fromCartesian(position)]);
    // sampleTerrainMostDetailed 会原地补写 Cartographic.height；没有可用高程时以 0 作为安全回退值。
    const height = sample.height ?? 0;
    // Cartographic 内部经纬度单位是弧度；面板面向用户展示时转换回常见的十进制度。
    const longitude = CesiumMath.toDegrees(sample.longitude).toFixed(5);
    const latitude = CesiumMath.toDegrees(sample.latitude).toFixed(5);
    elevationResult.value = `${height.toFixed(1)} m（${longitude}°, ${latitude}°）`;
    // Cesium Entity 的 position 使用 Cartesian3，因此将服务返回的经纬度和高程再转回地心坐标。
    elevationEntity = viewer.entities.add({
      position: Cartesian3.fromRadians(sample.longitude, sample.latitude, height),
      point: {
        pixelSize: 12, color: Color.fromCssColorString("#ff4d4f"),
        outlineColor: Color.WHITE, outlineWidth: 2,
        // 对当前绘制要素禁用深度检测，保证地图信息要素不被地形遮挡。
        // POSITIVE_INFINITY 表示在任意距离都禁用深度检测。
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  } catch (error) {
    ElMessage.error(`地形采样失败：${error instanceof Error ? error.message : "未知错误"}`);
  } finally {
    loading.value = false;
  }
}

/** 将中心点周围 30 m 的 3×3 网格转换为弧度，顺序与 Horn 算法的输入一致。
 * 函数做的事很简单：以 C 为中心，向北、中、南各取一行；每一行再向西、中、东各取一个点，组成 3×3：
*/
function createSlopeSamplePositions(center: Cartographic) {
  if (!viewer) return [];
  // maximumRadius 是椭球长半轴。用“米 / 半径”得到对应的纬度弧度增量。
  const radius = viewer.scene.globe.ellipsoid.maximumRadius;
  const latitudeOffset = SLOPE_SAMPLE_SPACING_METERS / radius;
  // 同样的东西向米距离在高纬度对应更大的经度变化量，需除以 cos(latitude)。
  const longitudeOffset = SLOPE_SAMPLE_SPACING_METERS / (radius * Math.max(Math.abs(Math.cos(center.latitude)), 1e-6));

  const positions: Cartographic[] = [];
  // 外层依次生成北、中、南三行；内层生成西、中、东三列。
  // 最终顺序是 [NW, N, NE, W, C, E, SW, S, SE]，必须与 calculateSlopeAndAspect 的 Horn 网格顺序一致。
  for (const northOffset of [1, 0, -1]) {
    for (const eastOffset of [-1, 0, 1]) {
      positions.push(
        new Cartographic(
          center.longitude + eastOffset * longitudeOffset,
          center.latitude + northOffset * latitudeOffset,
        ),
      );
    }
  }

  return positions;
}

/** 将方位角转换为便于阅读的八方向名称。 */
function formatAspect(aspectDegrees: number | null) {
  if (aspectDegrees === null) return "平坦";
  const directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  const direction = directions[Math.round(aspectDegrees / 45) % directions.length];
  return `${aspectDegrees.toFixed(1)}°（${direction}）`;
}

/**
 * 以点击位置为中心请求 9 个地形高程，再通过 Horn 3×3 邻域法计算局部坡度与最大下坡方向。
 * 30 m 间距是局部估算尺度：数值会受地形服务分辨率和该间距影响，不是测绘级成果。
 */
async function sampleSlope(position: Cartesian3) {
  if (!viewer) return;
  removeSlopeEntity();
  slopeResult.value = null;
  const terrainPositions = createSlopeSamplePositions(Cartographic.fromCartesian(position));
  if (terrainPositions.length !== 9) return;

  loading.value = true;
  try {
    // 返回数组顺序与 terrainPositions 完全一致，因此可直接作为 Horn 网格的 9 个高程输入。
    const samples = await sampleTerrainMostDetailed(viewer.terrainProvider, terrainPositions);
    const result = calculateSlopeAndAspect(
      samples.map((sample) => sample.height ?? 0),
      SLOPE_SAMPLE_SPACING_METERS,
    );
    // 索引 4 是 3×3 网格的中心 C 点。
    const center = samples[4];
    slopeResult.value = {
      slope: `${result.slopeDegrees.toFixed(1)}°`,
      aspect: formatAspect(result.aspectDegrees),
    };
    // 中心点高程来自地形服务，而不是点击时的椭球高度，因此标记可准确贴合采样地形。
    slopeEntity = viewer.entities.add({
      position: Cartesian3.fromRadians(center.longitude, center.latitude, (center.height ?? 0)),
      point: {
        pixelSize: 12, color: Color.fromCssColorString("#722ed1"), outlineColor: Color.WHITE, outlineWidth: 2
      },
    });
  } catch (error) {
    ElMessage.error(`坡度坡向采样失败：${error instanceof Error ? error.message : "未知错误"}`);
  } finally {
    loading.value = false;
  }
}

/**
 * 沿两个点击端点之间的椭球测地线均匀采样地形。
 * useForSight 为 false 时生成剖面数据；为 true 时复用同一批样本做简化通视判断。
 */
async function sampleLine(positions: Cartesian3[], useForSight: boolean) {
  if (!viewer) return;
  // EllipsoidGeodesic 只使用经纬度描述地球表面的最短路径，不以点击时携带的高度决定路径。
  const start = Cartographic.fromCartesian(positions[0]);
  const end = Cartographic.fromCartesian(positions[1]);
  const geodesic = new EllipsoidGeodesic(start, end);
  // 采样越密越可能发现狭窄山脊，但请求更慢；64 是本教学页的平衡值。
  const sampleCount = 64;
  const terrainPositions = Array.from({ length: sampleCount }, (_, index) =>
    // 插值生成起始终点之间的等间距点，作为地形服务的请求位置。
    // fraction 从 0 到 1：首尾恰好是用户点击的两个端点，中间点在测地线上等比例分布。
    geodesic.interpolateUsingFraction(index / (sampleCount - 1)),
  );

  loading.value = true;
  try {
    // 一次请求全部 64 个位置，比循环发起 64 次请求更合适。
    const samples = await sampleTerrainMostDetailed(viewer.terrainProvider, terrainPositions);
    // 单独抽出数值高程，后面的最值统计和通视比较都使用它。
    const heights = samples.map((sample) => sample.height ?? 0);
    // surfaceDistance 是椭球表面的测地线长度，不是沿真实地形起伏累加的三维距离。
    const distance = geodesic.surfaceDistance;
    // profile 保存完整 64 点；visibleSamples 仅影响侧栏显示，不会丢失这些数据。
    const profile = samples.map((sample, index) => ({
      index,
      distance: formatDistance((distance * index) / (sampleCount - 1)),
      height: `${(sample.height ?? 0).toFixed(1)} m`,
      cartographic: sample,
    }));

    if (useForSight) {
      // 观察者与目标各加 2 m，模拟人的视线高度，而非让视线从地面出发。
      const observerHeight = heights[0] + 2;
      const targetHeight = heights[heights.length - 1] + 2;
      const blockedAt = heights.findIndex((height, index) => {
        // 起点、终点本身不可能构成遮挡物，只检查中间的地形样本。
        if (index === 0 || index === heights.length - 1) return false;
        // 在两端视线高度之间做线性插值；若中间地形高于该线，则判为遮挡。
        // 公式：行高 = 观察者高度 + ((目标高度 - 观察者高度) * 当前索引) / (高度数组长度 - 1)
        // 这是局部的简化通视模型，不计算地球曲率、大气折射、建筑和树木遮挡。
        const lineHeight = observerHeight + ((targetHeight - observerHeight) * index) / (heights.length - 1);
        // 如果当前地形高度大于计算出的视线高，返回 true，说明存在遮挡，blockedAt 记录遮挡位置
        return height > lineHeight;
      });
      const visible = blockedAt === -1;
      sightResult.value = visible ? { visible } : { visible, blockedAt };
      // 绿色表示未检测到遮挡，红色表示至少有一个中间样本高于视线。
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
          // 显示线比地形高 3 m，避免开启深度检测后被地形表面遮住；不影响样本高程和统计结果。
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

/**
 * 本页所有工具共用的左键入口：先把屏幕像素坐标拾取为世界坐标，再按当前模式分派。
 * loading 期间忽略点击，避免同一时间发起多组地形服务请求并让结果互相覆盖。
 */
function handleLeftClick(event: { position: Cartesian2 }) {
  const position = pickWorldPosition(event.position);
  if (!position || mode.value === "none" || loading.value) return;

  if (mode.value === "elevation") {
    // 单点分析一次点击即完成，因此立刻退出工具状态。
    sampleElevation(position);
    mode.value = "none";
    return;
  }

  if (mode.value === "slope") {
    sampleSlope(position);
    mode.value = "none";
    return;
  }

  // 剖面和通视都需要两个端点：第一次点击创建预览，第二次点击才发起地形采样。
  selectedPositions.push(position);
  addMarker(position, selectedPositions.length === 1 ? Color.fromCssColorString("#1677ff") : Color.fromCssColorString("#faad14"));
  if (selectedPositions.length === 1) {
    ensurePreview();
    return;
  }

  // 保存当前模式，随后会重置 mode；否则异步函数无法知道这条线应做剖面还是通视。
  const useForSight = mode.value === "sight";
  removePreview();
  const positions = selectedPositions.slice();
  selectedPositions = [];
  mode.value = "none";
  sampleLine(positions, useForSight);
}

/** 鼠标移动只更新尚未提交的预览终点，真正的分析端点仍由左键决定。 */
function handleMouseMove(event: { endPosition: Cartesian2 }) {
  if (selectedPositions.length !== 1) return;
  cursorPosition = pickWorldPosition(event.endPosition);
}

/** 同时清除地图 Entity、所有面板结果和正在进行的两点选择状态。 */
function clearAll() {
  resetActiveLine();
  viewer?.entities.removeAll();
  elevationResult.value = "";
  profileSummary.value = "";
  profileSamples.value = [];
  sightResult.value = null;
  slopeResult.value = null;
  elevationEntity = null;
  slopeEntity = null;
  mode.value = "none";
}

/** 由底图切换组件调用；activate 负责替换影像/地形，页面仅同步显示名称。 */
async function switchBasemap(item: CesiumBasemapItem) {
  if (!viewer || item.id === currentId.value) return;
  await item.activate(viewer);
  currentId.value = item.id;
  currentLabel.value = item.label;
}

// #cesiumContainer 只有组件挂载后才存在，因此 Viewer 和鼠标 Handler 在这里创建。
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
  // 本章需要 terrainProvider，所以默认选择包含地形服务的底图项。
  const defaultItem = CESIUM_BASEMAP_LIST.find((item) => item.id === "mars3d-terrain")!;
  defaultItem.activate(viewer).then(() => {
    currentId.value = defaultItem.id;
    currentLabel.value = defaultItem.label;
  });
  // fromDegrees 的第三个参数是相机相对椭球面的高度（米），此处定位到教学区域上空。
  viewer.camera.setView({ destination: Cartesian3.fromDegrees(110.15, 32.55, 22_000) });
  // 让被地形挡住的几何真实发生遮挡；需要显示在线上的剖面线会自行抬高 3 m。
  viewer.scene.globe.depthTestAgainstTerrain = true;
  // Viewer 默认会在双击实体时设置 trackedEntity，使相机进入跟踪状态。
  // 本页的地形分析只使用左键，因此移除该默认动作，避免双击新标记后镜头被锁定。
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);

  handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(handleLeftClick, ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction(handleMouseMove, ScreenSpaceEventType.MOUSE_MOVE);
});

// 销毁 Handler 和 Viewer，释放事件监听及 WebGL 资源，避免切页后重复响应或占用显存。
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
  grid-template-columns: repeat(2, 1fr);
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
