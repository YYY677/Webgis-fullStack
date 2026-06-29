<template>
  <div class="basic-tool-box">
    <!-- 触发按钮 -->
    <el-tooltip content="工具箱" placement="left">
      <el-button class="trigger-btn" :icon="Box" circle @click="open = !open" />
    </el-tooltip>

    <!-- 面板 -->
    <Transition name="fade">
      <div v-if="open" class="tool-panel">
        <div class="panel-header">工具箱</div>

        <!-- 操作提示 -->
        <el-alert class="tip-alert" type="info" :closable="false" show-icon>
          <template #title>
            <span class="tip-text">左键绘制 ｜ 拖拽移动 <br /> 双击完成 ｜ 右键取消</span>
          </template>
        </el-alert>

        <!-- 测量工具 -->
        <div class="tool-group">
          <div class="group-title">测量工具</div>
          <div class="tool-grid">
            <el-button class="tool-btn" :type="activeMeasure === 'LineString' ? 'primary' : 'default'"
              :icon="Coordinate" @click="measureTool('LineString')">距离</el-button>
            <el-button class="tool-btn" :type="activeMeasure === 'Polygon' ? 'primary' : 'default'" :icon="Coin"
              @click="measureTool('Polygon')">面积</el-button>
          </div>
        </div>

        <el-divider class="tool-divider" />

        <!-- 绘制工具 -->
        <div class="tool-group">
          <div class="group-title">绘制工具</div>
          <div class="tool-grid">
            <el-button class="tool-btn" :type="activeDraw === 'Point' ? 'primary' : 'default'"
              @click="drawTool('Point')">点</el-button>
            <el-button class="tool-btn" :type="activeDraw === 'LineString' ? 'primary' : 'default'"
              @click="drawTool('LineString')">线</el-button>
            <el-button class="tool-btn" :type="activeDraw === 'Polygon' ? 'primary' : 'default'"
              @click="drawTool('Polygon')">面</el-button>
            <el-button class="tool-btn" :type="activeDraw === 'Circle' ? 'primary' : 'default'"
              @click="drawTool('Circle')">圆</el-button>
          </div>
        </div>

        <el-divider class="tool-divider" />

        <!-- 底部操作栏 -->
        <div class="tool-group action-row">
          <el-button class="tool-btn" :type="eraserActive ? 'primary' : 'default'" @click="toggleEraser">橡皮擦</el-button>
          <el-button class="tool-btn" type="danger" @click="clearAll">清除全部</el-button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { ElMessageBox } from "element-plus";
import { Box, Coin, Coordinate } from "@element-plus/icons-vue"
// OpenLayers的模块化导入
import { Vector as VectorSource } from "ol/source";
import { Vector as VectorLayer } from "ol/layer";
import Draw from "ol/interaction/Draw";
import { getArea, getLength } from "ol/sphere";
import { Polygon, LineString } from "ol/geom";
import { unByKey } from "ol/Observable";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import { Overlay } from "ol";

const props = defineProps({
  map: { type: Object, required: true }
})

// ── UI 状态 ──────────────────────────────────────────────────
const open = ref(false)
const activeMeasure = ref("")  // 测量工具高亮
const activeDraw = ref("")     // 绘制工具高亮

// ── 矢量图层 ──────────────────────────────────────────────────
const vectorSource = new VectorSource();
const vectorLayer = new VectorLayer({
  source: vectorSource,
  style: new Style({
    fill: new Fill({ color: "rgba(225, 225, 225, 0.4)" }),
    stroke: new Stroke({ color: "#ffcc33", width: 2 }),
    image: new CircleStyle({ radius: 7, fill: new Fill({ color: "#ffcc33" }) }),
  })
});

// ── 状态变量 ──────────────────────────────────────────────────
let draw; // 当前绘制交互对象
let sketch; // 当前绘制的要素
let measureTooltipElement; // 当前测量提示框的DOM元素
let measureTooltip; // 当前测量提示框
const eraserActive = ref(false) // 橡皮擦模式是否激活
let eraserListener = null // 橡皮擦点击事件监听器

// ── 初始化 ─────────────────────────────────────────────────────
onMounted(() => {
  props.map.addLayer(vectorLayer)

  // 右键取消绘制 — capture 阶段拦截
  props.map.getViewport().addEventListener("pointerdown", (e) => {
    if (e.button === 2 && draw) {
      e.stopPropagation()
      if (sketch) vectorSource.removeFeature(sketch)
      resetTool()
    }
  }, { capture: true })

  props.map.getViewport().addEventListener("contextmenu", (e) => {
    e.preventDefault()
  })
})

onUnmounted(() => {
  resetTool()
  props.map.removeLayer(vectorLayer)
})

// ── 统一清理 ──────────────────────────────────────────────────

/**
 * 全清理 — 关闭所有工具、移除交互和测量提示。在工具切换、取消、清除时调用。
 * drawend 不调此方法（要保留测量结果），而是走行内的局部清理。
 */
function resetTool() {
  if (draw) {
    props.map.removeInteraction(draw)
    draw = null
  }
  sketch = null
  // 注意：不动 measureTooltip/measureTooltipElement，已完成测量的黄底结果留在图上
  deactivateEraser()
  activeMeasure.value = ""
  activeDraw.value = ""
}

// ── 底部操作栏 ───────────────────────────────────────────────

/** 橡皮擦 — 切换擦除模式，点击要素后弹窗确认再删除 */
function toggleEraser() {
  if (eraserActive.value) {
    deactivateEraser()
    return
  }
  resetTool()
  eraserActive.value = true
  props.map.getViewport().style.cursor = "pointer"
  eraserListener = props.map.on("click", (evt) => {
    const feature = props.map.forEachFeatureAtPixel(evt.pixel, (f) => f)
    if (feature) {
      ElMessageBox.confirm("确定要删除这个要素吗？", "确认", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      }).then(() => {
        // 顺带删除附属的测量 tooltip
        const tip = feature.get("_tipOverlay")
        if (tip) {
          if (tip.getElement()) tip.getElement().remove()
          props.map.removeOverlay(tip)
        }
        vectorSource.removeFeature(feature)
      }).catch(() => { })
    }
  })
}

function deactivateEraser() {
  eraserActive.value = false
  props.map.getViewport().style.cursor = ""
  if (eraserListener) {
    unByKey(eraserListener)
    eraserListener = null
  }
}

/** "清除全部" — 弹窗确认后清空所有绘制结果 */
function clearAll() {
  ElMessageBox.confirm("确定要清除所有绘制内容吗？", "确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  }).then(() => {
    resetTool()
    // 清除所有要素绑定的 tooltip Overlay
    vectorSource.getFeatures().forEach((f) => {
      const tip = f.get("_tipOverlay")
      if (tip) {
        if (tip.getElement()) tip.getElement().remove()
        props.map.removeOverlay(tip)
      }
    })
    vectorSource.clear()
  }).catch(() => { })
}

// ── 测量数值提示 ─────────────────────────────────────────────

const createMeasureTooltip = () => {
  if (measureTooltipElement) measureTooltipElement.remove();
  measureTooltipElement = document.createElement("div");
  measureTooltipElement.className = "ol-tooltip ol-tooltip-measure";
  measureTooltip = new Overlay({
    element: measureTooltipElement,
    offset: [0, -15],
    positioning: "bottom-center",
    stopEvent: false,
    insertFirst: false,
  });
  props.map.addOverlay(measureTooltip);
};

// ── 格式化 ──────────────────────────────────────────────────

const formatArea = (polygon) => {
  const area = getArea(polygon);
  let output;
  if (area > 10000) {
    output = Math.round((area / 1000000) * 100) / 100 + " " + "km<sup>2</sup>";
  } else {
    output = Math.round(area * 100) / 100 + " " + "m<sup>2</sup>";
  }
  return output;
};

const formatLength = (line) => {
  const length = getLength(line);
  let output;
  if (length > 100) {
    output = Math.round((length / 1000) * 100) / 100 + " " + "km";
  } else {
    output = Math.round(length * 100) / 100 + " " + "m";
  }
  return output;
};

// ── 测量工具 ────────────────────────────────────────────────

const measureTool = (type) => {
  // 点击已激活的测量工具则取消
  if (activeMeasure.value === type) {
    resetTool()
    return
  }
  resetTool()
  activeMeasure.value = type

  draw = new Draw({
    source: vectorSource,
    type: type,
    style: new Style({
      fill: new Fill({ color: "rgba(255, 255, 255, 0.2)" }),
      stroke: new Stroke({ color: "rgba(0, 0, 0, 0.5)", lineDash: [10, 10], width: 2 }),
      image: new CircleStyle({ radius: 5, stroke: new Stroke({ color: "rgba(0, 0, 0, 0.7)" }), fill: new Fill({ color: "rgba(255, 255, 255, 0.2)" }) }),
    }),
  });
  props.map.addInteraction(draw);
  createMeasureTooltip();

  let listener;
  draw.on("drawstart", (evt) => {
    sketch = evt.feature;
    let tooltipCoord = evt.coordinate;
    listener = sketch.getGeometry().on("change", () => {
      const geom = sketch.getGeometry();
      let output;
      if (geom instanceof Polygon) {
        output = formatArea(geom);
        tooltipCoord = geom.getInteriorPoint().getCoordinates();
      } else if (geom instanceof LineString) {
        output = formatLength(geom);
        tooltipCoord = geom.getLastCoordinate();
      }
      measureTooltipElement.innerHTML = output;
      measureTooltip.setPosition(tooltipCoord);
    });
  });

  draw.on("drawend", () => {
    // 固化测量数值：改成黄底固定样式留在图上
    measureTooltipElement.className = "ol-tooltip ol-tooltip-static";
    measureTooltip.setOffset([0, -7]);
    // feature.set(key, value) 是 OL 给每个要素挂载自定义属性的方法
    // 任何类型——字符串、数字、对象、OL 实例（Overlay、Layer）、函数，都能装。
    // 把 tooltip Overlay 挂到要素上，橡皮擦能顺带删除
    sketch.set("_tipOverlay", measureTooltip);
    // 断开引用：tooltip 已绑定给 feature，measureTooltip 不再管理它
    measureTooltip = null;
    measureTooltipElement = null;
    // 局部清理：移除 draw 交互、重置状态
    if (draw) { props.map.removeInteraction(draw); draw = null }
    sketch = null;
    unByKey(listener);
    activeMeasure.value = "";
  });

  draw.on("drawcancel", () => { resetTool() });
}

// ── 绘制工具 ────────────────────────────────────────────────

const drawTool = (type) => {
  if (activeDraw.value === type) {
    resetTool()
    return
  }
  resetTool()
  activeDraw.value = type

  draw = new Draw({
    source: vectorSource,
    type: type,
  })
  props.map.addInteraction(draw)

  draw.on("drawend", () => {
    if (draw) { props.map.removeInteraction(draw); draw = null }
    activeDraw.value = ""
  })
  draw.on("drawcancel", () => { resetTool() })
}
</script>

<style scoped>
.basic-tool-box {
  position: absolute;
  top: 60px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.trigger-btn {
  font-size: 24px;
}

.tool-panel {
  position: absolute;
  right: 35px;
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(80px);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  min-width: 200px;
  box-shadow: var(--el-box-shadow-light);
}

.panel-header {
  font-size: 13px;
  color: var(--el-text-color-primary);
  padding: 10px 12px 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.tip-alert {
  /* margin: 6px 10px; */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px !important;
  --el-alert-padding: 4px 8px;
}

.tip-alert :deep(.el-alert__icon) {
  font-size: 20px;
  width: 20px;
}

.tip-text {
  font-size: 13px;
  line-height: 1.5;
}

.tool-group {
  padding: 6px 10px;
}

.group-title {
  font-size: 12px;
  color: var(--el-text-color-primary);
  padding: 4px 4px 6px;
}

.tool-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.tool-btn {
  width: 100%;
  padding: 10px 4px;
  font-size: 13px;
}

.action-row {
  display: flex;
  gap: 6px;
}

.action-row .tool-btn {
  flex: 1;
}

.el-button {
  margin-left: 0px;
}

.tool-divider {
  margin: 4px 0;
}

/* Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* OL tooltip */
:global(.ol-tooltip) {
  position: relative;
  background: rgba(0, 0, 0, 1);
  border-radius: 4px;
  color: white;
  padding: 4px 8px;
  opacity: 0.7;
  white-space: nowrap;
  font-size: 13px;
  cursor: default;
  user-select: none;
}

:global(.ol-tooltip-measure) {
  opacity: 1;
  font-weight: bold;
}

:global(.ol-tooltip-static) {
  background-color: #ffcc33;
  color: black;
  border: 1px solid white;
}

:global(.ol-tooltip-measure:before),
:global(.ol-tooltip-static:before) {
  border-top: 6px solid rgba(0, 0, 0, 0.5);
  border-right: 6px solid transparent;
  border-left: 6px solid transparent;
  content: "";
  position: absolute;
  bottom: -6px;
  margin-left: -7px;
  left: 50%;
}

:global(.ol-tooltip-static:before) {
  border-top-color: #ffcc33;
}
</style>
