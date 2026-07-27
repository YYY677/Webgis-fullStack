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
          <template #header>内置材质：优先这样使用</template>
          <p class="card-desc">下方新增的图形都在地图中，可直接观察“同一个 <code>material</code> 字段，不同材质类”的视觉差异。</p>
          <ul class="effect-list builtin-material-list">
            <li><i class="dash-icon" /><code>PolylineDashMaterialProperty</code>：黄色虚线</li>
            <li><i class="glow-icon" /><code>PolylineGlowMaterialProperty</code>：橙色发光线</li>
            <li><i class="grid-icon" /><code>GridMaterialProperty</code>：蓝色网格面</li>
            <li><i class="stripe-icon" /><code>StripeMaterialProperty</code>：青色条纹椭圆</li>
          </ul>
          <p class="tip">面、墙、圆和三维体可优先尝试纯色、网格、条纹或贴图；折线优先选择虚线、发光线、箭头线。内置材质无法表达效果时，再写 Fabric GLSL。</p>
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
  Cartesian2,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  Event,
  GridMaterialProperty,
  Ion,
  JulianDate,
  Material,
  PolylineDashMaterialProperty,
  PolylineGlowMaterialProperty,
  StripeMaterialProperty,
  StripeOrientation,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue";
import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps";
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps";

/**
 * ColorMaterialProperty 是 Cesium 内置的“纯色材质属性”。常用的内置材质属性可以先掌握这些：
 * 类	                              效果	                    常见目标
 * ColorMaterialProperty	          单色、可透明、可动态变色	  面、墙、圆、盒子、线
 * ImageMaterialProperty	          图片纹理贴图，可平移/重复	  面、墙、走廊、部分三维体
 * GridMaterialProperty      	      网格	                    范围面、体积示意
 * CheckerboardMaterialProperty	    棋盘格	                  测试面、区域强调
 * StripeMaterialProperty	          条纹	                    面、墙、走廊
 * PolylineGlowMaterialProperty	    发光线                    polyline
 * PolylineOutlineMaterialProperty	描边线                    polyline
 * PolylineDashMaterialProperty	    虚线	                    polyline
 * PolylineArrowMaterialProperty	  箭头线	                  polyline
 */

// 自定义材质在 Cesium 全局缓存中的唯一名称；getType() 必须返回完全相同的字符串。
const FLOW_LINE_TYPE = "CesiumDemoFlowLine";

const materialCache = (Material as any)._materialCache;

// 两个 FLOW_LINE_TYPE 的含义不同，但必须保持一致：
// 第一个 FLOW_LINE_TYPE：注册到 Cesium 材质缓存里的 key，以后 Cesium 通过这个类型名找到你注册的材质。
// 第二个 FLOW_LINE_TYPE：fabric 材质描述对象内部的类型声明。
// Cesium 在创建材质、生成 shader、管理 uniforms 时，会读取 fabric.type 来识别这个材质。
materialCache.addMaterial(FLOW_LINE_TYPE, {
  fabric: {
    // 材质类型名，类似注册名
    type: FLOW_LINE_TYPE,
    // uniform的值由 FlowLineMaterialProperty.getValue(time) 提供；
    // 每帧更新时，Cesium 会把这些值传给 GLSL。
    uniforms: { color: Color.CYAN, speed: 1, time: 0 },
    /**
     * source 是 GPU 上执行的 GLSL 片段着色器。Cesium 会让 polyline / wall 的每一个像素各执行一次
     * czm_getMaterial，并根据返回的 material 绘制该像素。
     *
     * 这段代码的目标是做出“只有一小段发亮、并且不断沿图形移动”的效果：
     *
     * 1. materialInput.st.s 是当前像素位于图形展开方向的相对位置：起点约为 0，终点约为 1。
     * 2. time * speed 是持续增长的移动进度；减去 s 后，每个位置得到不同进度。
     * 3. fract 将进度折回 0~1。这个数相当于“当前像素是否正好被亮带扫到”。
     * 4. head 和 tail 分别做亮带的淡入、淡出区间；两者相乘后，亮带外的 alpha 为 0，
     *    亮带中间的 alpha 接近 color.a。因此颜色不突变，看起来像一段光在流动。
     *
     * direction 由 `time * speed - s` 中的减号决定；改成 `time * speed + s`，流动方向会反过来。
     */
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
  // 告诉 Cesium 这个材质可能是透明的，请按透明物体的渲染路径处理。
  translucent: () => true,
});

/**
 * FlowLineMaterialProperty 是你自己写的类，含义是：
 * 这个图形使用名为 CesiumDemoFlowLine 的自定义 GPU 材质；每帧提供颜色、速度与时间。
 * Entity 的 polyline.material / wall.material 需要 MaterialProperty，而不是直接传 Fabric 对象。
 * 这个类是“CPU 侧动态数据提供者”：Cesium 渲染每个时间点时调用 getValue，随后把结果传给上面的 GPU 材质。
 *
 * ① 注册 GPU 材质模板
 * materialCache.addMaterial("CesiumDemoFlowLine", { fabric })
 *
 * ② Entity 渲染时询问属性
 * lineMaterial.getType() → "CesiumDemoFlowLine"
 *
 * ③ Cesium 用这个名字从 materialCache 找到 Fabric / GLSL
 *
 * ④ 再调用属性
 * lineMaterial.getValue(time)
 * → { color, speed, time }
 *
 * ⑤ Cesium 将这些值传给 GLSL 同名 uniform
 * uniforms: { color, speed, time }
 */
class FlowLineMaterialProperty {
  // Cesium 通过该事件感知属性定义发生替换；本例 uniform 每帧读取，所以直接更新 speed 也能生效。
  readonly definitionChanged = new Event();
  // false 告诉 Cesium：getValue 的结果会随时间变化，不能作为常量缓存。
  readonly isConstant = false;
  // 每个材质实例各自记录起始时间，确保流动时间从创建时开始计算。
  private readonly startTime = JulianDate.now();

  constructor(public color: Color, public speed: number) { }

  // 返回材质类型名，例如 "FlowLine"；它是查找 Fabric 材质模板的键，不是模板本身。
  getType() {
    return FLOW_LINE_TYPE;
  }

  // 返回 uniforms 的当前值；键名必须和材质模板中的 uniforms、GLSL 变量对应，例如 color、speed、time
  getValue(time: JulianDate, result: Record<string, unknown> = {}) {
    // result 是 Cesium 传入的可复用对象；写入它而非每帧 new 对象，可减少动画时的 GC 压力。
    result.color = Color.clone(this.color, result.color as Color);
    result.speed = this.speed;
    // JulianDate 不使用 JavaScript Date；secondsDifference 得到“距材质创建过去多少秒”。
    result.time = JulianDate.secondsDifference(time, this.startTime);
    return result;
  }

  // 判断两个材质属性是否等价。Cesium 内部做属性比较、变更判断时会用到它，
  // 避免把两个配置相同的材质误判成不同对象。equals 不直接产生视觉效果，也通常不需要你手动调用。
  equals(other?: unknown) {
    return other instanceof FlowLineMaterialProperty && Color.equals(this.color, other.color) && this.speed === other.speed;
  }
}

// Vue 响应式状态：滑块和开关改变后，模板会刷新；动态材质则在后续渲染帧读取对应值。
const panelOpen = ref(false);
const currentId = ref("");
const currentLabel = ref("");
const speed = ref(1.2); // 流动线的基础速度倍率。
// 扩散圆在初始 120m 基础上的额外增长量；当前代码一轮的实际最大半径是 120 + maxRadius（米）。
const maxRadius = ref(1600);
const running = ref(true); // 对应 Cesium Clock.shouldAnimate。

// Cesium Viewer 不需要参与 Vue 响应式追踪；组件卸载时会显式 destroy。
let viewer: Viewer | null = null;
// 滑块修改速度时需要访问已创建的两个材质实例，因此将它们保存在数组中。
const flowMaterials: FlowLineMaterialProperty[] = [];

/** 创建本章的三组 Entity：流动折线、流动墙和扩散圆。 */
function addEffects() {
  if (!viewer) return;
  // 一条线和一面墙使用同一份 Fabric，但分别创建属性实例，从而拥有不同颜色和速度。
  // FlowLineMaterialProperty 不是“所有 Entity 都能用的通用样式对象”，
  // 而是专门用于那些 Entity 图形定义中存在 material 字段的图形。点、标签、图标没有 material 字段。
  // polyline 和 wall 都有 material，所以都能使用 FlowLineMaterialProperty。但“能用”不表示效果一定符合语义：
  // 在线或墙上，st.s 通常可理解为沿展开方向移动，适合流动光带。
  // 用到普通面、圆或立方体上时，st.s 仍是纹理坐标，但它表示的是该表面的 UV 展开方向；效果可能变成“横向扫过表面”，而不是沿边界流动。
  const lineMaterial = new FlowLineMaterialProperty(Color.fromCssColorString("#00e5ff"), speed.value);
  const wallMaterial = new FlowLineMaterialProperty(Color.fromCssColorString("#a0ff00"), speed.value * 0.7);
  flowMaterials.push(lineMaterial, wallMaterial);

  viewer.entities.add({
    polyline: {
      // fromDegreesArrayHeights 按 [经度, 纬度, 高度, ...] 三个一组读取，单位分别是度、度、米。
      positions: Cartesian3.fromDegreesArrayHeights([
        116.35, 39.88, 80,
        116.39, 39.91, 1200,
        116.44, 39.89, 90,
        116.47, 39.93, 1400,
      ]),
      width: 7,
      material: lineMaterial,
    },
  });
  viewer.entities.add({
    wall: {
      // fromDegreesArray 按 [经度, 纬度, ...] 两个一组读取；首尾重复，令墙体轮廓闭合。
      positions: Cartesian3.fromDegreesArray([116.365, 39.865, 116.405, 39.865, 116.405, 39.895, 116.365, 39.895, 116.365, 39.865]),
      // 每个位置各有一个底部高度和顶部高度，长度必须与 positions 中的顶点数对应。
      minimumHeights: [0, 0, 0, 0, 0],
      maximumHeights: [500, 650, 550, 700, 500],
      material: wallMaterial,
    },
  });
  // 椭圆的半长轴和半短轴始终返回相同值，因此实际显示为圆。
  const ringCenter = Cartesian3.fromDegrees(116.43, 39.93);
  // 扩散圆自己的起始时间；与流动材质各自计时，互不依赖。
  const ringStart = JulianDate.now();
  viewer.entities.add({
    position: ringCenter,
    ellipse: {
      // 返回的是 number。数字是基本类型，不能原地修改，因此CallbackProperty参数不需要 result。
      semiMajorAxis: new CallbackProperty((time) => {
        // 动画按 0.25 圈/秒推进：每 4 秒 phase 从 0 回到 0，形成循环扩散。
        const currentTime = time ?? JulianDate.now();
        const phase = (JulianDate.secondsDifference(currentTime, ringStart) * 0.25) % 1;
        return 120 + maxRadius.value * phase;
      }, false),
      semiMinorAxis: new CallbackProperty((time) => {
        // 与 semiMajorAxis 相同，保持圆形；两个 CallbackProperty 都在每次渲染时读取最新 maxRadius。
        const currentTime = time ?? JulianDate.now();
        const phase = (JulianDate.secondsDifference(currentTime, ringStart) * 0.25) % 1;
        return 120 + maxRadius.value * phase;
      }, false),
      // ColorMaterialProperty 是 Cesium 内置的材质属性类，表示图形使用纯颜色材质，颜色可以是动态的。
      // 你只需要提供 Color。不需要自己写 GLSL，不需要注册材质类型。
      material: new ColorMaterialProperty(
        // 返回的是 Color 对象，result 可以作为本帧写入目标，避免反复分配新的颜色对象。
        new CallbackProperty((time, result) => {
          // ColorMaterialProperty 负责把“动态 Color”包装成 ellipse.material 所需的 MaterialProperty。
          const currentTime = time ?? JulianDate.now();
          const phase = (JulianDate.secondsDifference(currentTime, ringStart) * 0.25) % 1;
          // 圆越向外扩散越透明；result 同样是 Cesium 提供的复用对象。
          return Color.fromCssColorString("#1677ff").withAlpha(0.45 * (1 - phase), result);
        }, false),
      ),
      outline: true,
      outlineColor: Color.fromCssColorString("#fff"),
      // 将圆放在椭球面上方 30m，避免与地面重叠时产生视觉闪烁。
      height: 300,
    },
  });
}

/**
 * 用不同几何承载 Cesium 内置材质，方便直接在地图中比较效果。
 * 它们都是固定材质，不需要像 FlowLineMaterialProperty 一样自行实现 getType / getValue。
 */
function addBuiltinMaterialExamples() {
  if (!viewer) return;

  viewer.entities.add({
    polyline: {
      positions: Cartesian3.fromDegreesArray([116.32, 39.845, 116.4, 39.845]),
      width: 4,
      clampToGround: true,
      // dashLength 是单个虚线节的像素长度；材质只适用于 polyline。
      material: new PolylineDashMaterialProperty({
        color: Color.YELLOW,
        gapColor: Color.TRANSPARENT,
        dashLength: 18,
      }),
    },
  });

  viewer.entities.add({
    polyline: {
      positions: Cartesian3.fromDegreesArray([116.32, 39.855, 116.4, 39.855]),
      width: 5,
      clampToGround: true,
      material: new PolylineGlowMaterialProperty({
        color: Color.fromCssColorString("#ff7a45"),
        // glowPower 控制光晕相对线宽的比例；数值越大，边缘发光范围越宽。
        glowPower: 0.2,
        // 锥形衰减参数，用于控制模型边缘的锥形衰减程度，值越大衰减越明显
        taperPower: 1, 
      }),
    },
  });

  viewer.entities.add({
    polygon: {
      hierarchy: Cartesian3.fromDegreesArray([
        116.425, 39.84,
        116.465, 39.84,
        116.465, 39.865,
        116.425, 39.865,
      ]),
      // 高度略高于地面，避免面与地球表面重合时产生深度闪烁。
      height: 30,
      material: new GridMaterialProperty({
        color: Color.fromCssColorString("#36cfc9").withAlpha(0.9),
        cellAlpha: 0.18,
        // lineCount 是横纵线条数量；lineThickness 是线宽，二者单位都是纹理坐标相关参数。
        lineCount: new Cartesian2(8, 6), 
        lineThickness: new Cartesian2(1, 1),
      }),
      outline: true,
      outlineColor: Color.fromCssColorString("#36cfc9"),
    },
  });

  viewer.entities.add({
    position: Cartesian3.fromDegrees(116.47, 39.88),
    ellipse: {
      semiMajorAxis: 650,
      semiMinorAxis: 420,
      height: 30,
      // repeat 指定从椭圆中心向边缘重复多少组条纹；orientation 决定条纹方向。
      material: new StripeMaterialProperty({
        evenColor: Color.fromCssColorString("#1677ff").withAlpha(0.65),
        oddColor: Color.fromCssColorString("#e6f4ff").withAlpha(0.15),
        repeat: 8,
        orientation: StripeOrientation.VERTICAL,
      }),
      outline: true,
      outlineColor: Color.fromCssColorString("#1677ff"),
    },
  });
}

/** 滑块更新 speed 后同步修改两个已创建材质实例；无需删除或重新创建 Entity。 */
function applySpeed() {
  if (flowMaterials.length !== 2) return;
  flowMaterials[0].speed = speed.value;
  // 墙故意比线慢 30%，同一流动材质在不同几何上会有层次感。
  flowMaterials[1].speed = speed.value * 0.7;
}

/** Cesium Clock 是本页所有 time 参数的来源；暂停时 CallbackProperty 仍存在，但时间不再推进。 */
function toggleClock() {
  if (viewer) viewer.clock.shouldAnimate = running.value;
}

/** 恢复 Vue 状态后，还需同步更新非响应式的材质实例和 Cesium Clock。 */
function resetEffects() {
  speed.value = 1.2;
  maxRadius.value = 1600;
  running.value = true;
  applySpeed();
  toggleClock();
}

/** 由底图切换组件调用；底图项负责实际 activate，页面只同步当前名称。 */
async function switchBasemap(item: CesiumBasemapItem) {
  if (!viewer || item.id === currentId.value) return;
  await item.activate(viewer);
  currentId.value = item.id;
  currentLabel.value = item.label;
}

// #cesiumContainer 需要先挂载到 DOM，因此 Viewer 在此处创建。
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
  // 本章只演示材质，不依赖地形服务，使用普通影像底图即可。
  const defaultItem = CESIUM_BASEMAP_LIST.find((item) => item.id === "mars3d")!;
  defaultItem.activate(viewer).then(() => {
    currentId.value = defaultItem.id;
    currentLabel.value = defaultItem.label;
  });
  // fromDegrees 的第三个参数为相机相对椭球面的高度（米）。
  viewer.camera.setView({ destination: Cartesian3.fromDegrees(116.41, 39.9, 24_000) });
  // Cesium 时钟系统默认是暂停的，必须手动设置 shouldAnimate = true 才会驱动材质动画。
  viewer.clock.shouldAnimate = true;
  addEffects();
  addBuiltinMaterialExamples();
});

// 组件切换时清空对材质实例的引用，并销毁 Viewer 释放 WebGL 与事件资源。
onUnmounted(() => {
  // splice(0) 原地清空数组，确保不会留下对已销毁 Viewer 中材质的引用。
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

.builtin-material-list li {
  align-items: flex-start;
}

.line-icon,
.wall-icon,
.ring-icon,
.dash-icon,
.glow-icon,
.grid-icon,
.stripe-icon {
  display: inline-block;
  flex: 0 0 auto;
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

.dash-icon {
  background: repeating-linear-gradient(90deg, #fadb14 0 5px, transparent 5px 8px);
}

.glow-icon {
  background: #ff7a45;
  box-shadow: 0 0 5px #ff7a45;
}

.grid-icon {
  height: 12px;
  border: 1px solid #36cfc9;
  background-color: rgba(54, 207, 201, 0.18);
  background-image: linear-gradient(#36cfc9 1px, transparent 1px), linear-gradient(90deg, #36cfc9 1px, transparent 1px);
  background-size: 5px 5px;
}

.stripe-icon {
  height: 12px;
  border-radius: 50%;
  background: repeating-linear-gradient(90deg, rgba(22, 119, 255, 0.8) 0 3px, rgba(230, 244, 255, 0.25) 3px 6px);
}
</style>
