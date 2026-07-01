<template>
  <!-- ======================================================== -->
  <!-- 右侧开关面板（负责开关，不负责显示内容）                    -->
  <!-- ======================================================== -->
  <div class="map-setting-trigger">
    <el-tooltip content="地图设置" placement="left">
      <el-button class="trigger-btn" :icon="Setting" circle @click="open = !open" />
    </el-tooltip>
    <Transition name="fade">
      <div v-if="open" class="setting-panel">
        <div class="panel-header">地图设置</div>
        <label class="setting-item">
          <el-switch v-model="showZoom" size="small" />
          <span>缩放控件</span>
        </label>
        <label class="setting-item">
          <el-switch v-model="showCoord" size="small" />
          <span>坐标显示</span>
        </label>
        <label class="setting-item">
          <el-switch v-model="showLevel" size="small" />
          <span>缩放级别</span>
        </label>
      </div>
    </Transition>
  </div>

  <!-- ======================================================== -->
  <!-- 底栏小部件（受上方开关控制，出现在地图右下角）              -->
  <!-- ======================================================== -->

  <!-- 缩放控件 -->
  <div v-if="showZoom" class="zoom-widget">
    <button class="zoom-btn" title="放大" @click="zoomBy(1)">
      <el-icon><Plus /></el-icon>
    </button>
    <div class="zoom-divider" />
    <button class="zoom-btn" title="缩小" @click="zoomBy(-1)">
      <el-icon><Minus /></el-icon>
    </button>
  </div>

  <!-- 坐标 + 缩放级别（合并在右侧底部一行） -->
  <div v-if="showCoord || showLevel" class="status-bar">
    <span v-if="showCoord" class="status-coord">
      经度 {{ mouseLon }} &nbsp;|&nbsp; 纬度 {{ mouseLat }}
    </span>
    <span v-if="showLevel" class="status-level">
      Zoom {{ currentZoom }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"
import { Setting, Minus, Plus } from "@element-plus/icons-vue"
import { transform } from "ol/proj"
import { unByKey } from "ol/Observable"
import type Map from "ol/Map"
import type { EventsKey } from "ol/events"

const props = defineProps<{
  map: Map | null
}>()

// ── 开关 ──────────────────────────────────────────────────
const open = ref(false)           // 面板展开
const showZoom = ref(true)        // 缩放控件
const showCoord = ref(true)       // 坐标
const showLevel = ref(true)       // 缩放级别

// ── 数据 ──────────────────────────────────────────────────
const currentZoom = ref('0')
const mouseLon = ref("--")
const mouseLat = ref("--")

let pointerMoveKey: EventsKey | null = null
let resolutionKey: EventsKey | null = null

onMounted(() => {
  const m = props.map
  if (!m) return

  const view = m.getView()
  currentZoom.value = view.getZoom()?.toFixed(2) ?? '0.00'

  // 监听 zoom 变化
  resolutionKey = view.on("change:resolution", () => {
    currentZoom.value = view.getZoom()?.toFixed(2) ?? '0.00'
  })

  // 监听鼠标 → 实时坐标
  pointerMoveKey = m.on("pointermove", (evt) => {
    if (!evt.coordinate) {
      mouseLon.value = "--"; mouseLat.value = "--"
      return
    }
    const coords = transform(evt.coordinate, "EPSG:3857", "EPSG:4326")
    mouseLon.value = coords[0].toFixed(4)
    mouseLat.value = coords[1].toFixed(4)
  })
})

// 当前代码里保持 unByKey 是防御性写法。即使父组件不销毁 map，
// MapSetting 被 v-if 切掉时也不会残留监听
onUnmounted(() => {
  if (pointerMoveKey) { unByKey(pointerMoveKey); pointerMoveKey = null }
  if (resolutionKey) { unByKey(resolutionKey); resolutionKey = null }
})

function zoomBy(delta: number) {
  const view = props.map?.getView()
  if (!view) return
  view.animate({ zoom: (view.getZoom() ?? 0) + delta, duration: 250 })
}
</script>

<style scoped>
/* ========================================================== */
/* 右侧触发按钮 + 开关面板                                      */
/* ========================================================== */
.map-setting-trigger {
  position: absolute;
  top: 156px;        /* 在 LayerControl (108px) 之下 */
  right: 12px;
  z-index: 10;
}

.trigger-btn { font-size: 24px }

.setting-panel {
  position: absolute;
  right: 35px;
  top: 0;
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(80px);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  min-width: 160px;
  box-shadow: var(--el-box-shadow-light);
}

.panel-header {
  font-size: 13px;
  color: var(--el-text-color-primary);
  padding: 10px 12px 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--el-text-color-primary);
  cursor: pointer;

  &:hover { background: var(--el-fill-color-light) }
}

/* ========================================================== */
/* 缩放控件 — 右下角，竖排 +/-                                 */
/* ========================================================== */
.zoom-widget {
  position: absolute;
  bottom: 48px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  /* 圆角 + 阴影 + hover 效果，必须加 overflow: hidden，否则 hover 背景会溢出圆角 */
  overflow: hidden; 
}

.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: #fff;
  cursor: pointer;
  color: #222;
  font-size: 18px;
  transition: background 0.15s; /* hover 背景过渡动画 */

  &:hover { background: #f0f0f0 }
  &:active { background: #e0e0e0 }
}

.zoom-divider {
  height: 1px;
  background: #eee;
  margin: 0 6px;
}

/* ========================================================== */
/* 底栏状态条 — 坐标 + zoom 级别                               */
/* ========================================================== */
.status-bar {
  position: absolute;
  bottom: 8px;
  right: 12px;       /* 给 zoom widget 留空间 */
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 4px;
  font-size: 14px;
  color: #222;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  font-family: "Liberation Sans";
  pointer-events: none;  /* 不阻挡地图的鼠标事件 */
}

.status-level {
  color: var(--el-color-primary);
  font-weight: 600;
}

/* ── Transition ─────────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
