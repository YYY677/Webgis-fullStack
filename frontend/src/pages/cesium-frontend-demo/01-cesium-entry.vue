<template>
  <div id="cesiumContainer" class="map-container">
    <!-- 遮罩层：面板打开时覆盖地图，点击关闭面板 -->
    <div v-if="panelOpen" class="panel-overlay" @click="panelOpen = false" />

    <!-- 右上角浮动控制区（@click.stop 阻止点击穿透到遮罩） -->
    <div class="map-controls" @click.stop>
      <el-tooltip content="切换底图" placement="left">
        <el-button class="trigger-btn" :icon="MapLocation" circle @click="panelOpen = !panelOpen" />
      </el-tooltip>

      <!-- 底图选择面板 -->
      <Transition name="fade">
        <div v-if="panelOpen" class="switcher-panel">
          <div class="panel-header">底图选择</div>

          <template v-for="group in groupedBasemaps" :key="group.group">
            <div class="group-header">{{ group.groupLabel }}</div>
            <div v-for="item in group.items" :key="item.id" class="switcher-item"
              :class="{ active: item.id === currentId }" @click="switchBasemap(item)">
              <span class="item-label">{{ item.label }}</span>
              <el-icon v-if="item.id === currentId" class="check-icon">
                <Check />
              </el-icon>
            </div>
          </template>
        </div>
      </Transition>
    </div>

    <!-- 左下角当前底图名称 -->
    <div class="basemap-label">{{ currentLabel || "加载中..." }}</div>
  </div>
</template>

<script setup lang="ts">
/**
 * Cesium 底图展示页 — 19 种底图一键切换
 *
 * Cesium 相关概念：
 *   - ImageryProvider: 影像瓦片提供者（决定地图长什么样）
 *   - ImageryLayer:   影像图层（包裹 Provider，控制透明度/亮度等）
 *   - TerrainProvider: 地形高程提供者（决定地形起伏）
 *   - addImageryProvider vs add: 前者传 Provider 直接创建图层，后者传已创建好的 Layer
 */
import { ref, computed, onMounted, onUnmounted } from "vue"
import { MapLocation, Check } from "@element-plus/icons-vue"
import { ElMessage } from "element-plus"
import { Viewer, Ion } from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"

import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"

// ── 状态 ──────────────────────────────────────────────────────

const panelOpen = ref(false)
const currentId = ref("") // 空 = Viewer 自带 Cesium Ion 默认，不在列表中
const currentLabel = ref("")
let viewer: Viewer | null = null

// 按 group 分组
const groupedBasemaps = computed(() => {
  const groups = new Map<
    string, // 键（key）是 string — 存分组的标识
    // 值（value）是对象，包含 group、groupLabel 和 items 数组，可以多不可以少。
    { group: string; groupLabel: string; items: CesiumBasemapItem[] }
  >()
  for (const item of CESIUM_BASEMAP_LIST) {
    // 如果当前组暂未添加到groups，则添加
    if (!groups.has(item.group)) {
      // group当作键
      groups.set(item.group, {
        group: item.group,
        groupLabel: item.groupLabel,
        items: [],
      })
    }
    // 在当前组内添加底图项
    groups.get(item.group)!.items.push(item)
  }
  return Array.from(groups.values()) // 返回数组形式，方便 v-for 渲染
})

// ── 辅助函数 ──────────────────────────────────────────────────

/** 切换底图 */
async function switchBasemap(item: CesiumBasemapItem) {
  if (item.id === currentId.value) return
  if (!viewer) return

  try {
    await item.activate(viewer)
    currentId.value = item.id
    currentLabel.value = item.label
    panelOpen.value = false
  } catch (e: any) {
    ElMessage.error(`底图切换失败: ${e.message}`)
  }
}

// ── 生命周期 ──────────────────────────────────────────────────

onMounted(() => {
  // 设置 Cesium Ion token（默认底图需要）
  const token = import.meta.env.VITE_CESIUM_TOKEN
  Ion.defaultAccessToken = token
  // Viewer 默认会创建 Cesium Ion 世界影像（Bing Maps），工作正常
  viewer = new Viewer("cesiumContainer", {
    // 阻止自动加载 Cesium Ion，改用手动加载本地世界图
    baseLayer: false,
    // 底图选择器，设置为false表示不显示底图选择控件
    baseLayerPicker: false,
    // 动画效果，设置为false表示禁用场景动画
    animation: false,
    // 时间轴控件，设置为false表示不显示时间轴
    timeline: false,
    // 全屏按钮，设置为false表示不显示全屏控件
    fullscreenButton: false,
    // 导航帮助按钮，设置为false表示不显示帮助导航控件
    navigationHelpButton: false,
    // 首页按钮，设置为false表示不显示返回初始视角的按钮
    homeButton: false,
    // 投影选择器，设置为false表示不显示地图投影方式选择控件
    projectionPicker: false,
  })

  // 默认加载本地世界图
  const defaultItem = CESIUM_BASEMAP_LIST.find(i => i.id === "single-world")!
  // activate 方法使用 async 返回 Promise，确保底图加载完成后再更新状态
  defaultItem.activate(viewer).then(() => {
    // 底图加载成功再更新状态，符合逻辑。
    currentId.value = defaultItem.id
    currentLabel.value = defaultItem.label
  })
})

onUnmounted(() => {
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
})
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

/* 遮罩层：覆盖地图，点击关闭面板 */
/* inset: 0 是 top: 0; right: 0; bottom: 0; left: 0; 的简写。父元素 .map-container 是 
position: relative 的，子元素 absolute + inset:0 就自动拉伸到和父元素一样大，不用写宽高。 */
.panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 99;
}

/* 隐藏 Cesium 默认 UI */
:deep(.cesium-viewer-bottom) {
  display: none !important;
}

:deep(.cesium-viewer-toolbar) {
  display: none !important;
}

/* ── 浮动控制区 ──────────────────────────────────────────────── */

.map-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.trigger-btn {
  font-size: 24px;
  --el-bg-color: var(--el-bg-color-overlay);
  backdrop-filter: blur(4px);
}

/* ── 底图选择面板 ────────────────────────────────────────────── */

.switcher-panel {
  position: absolute;
  right: 0;
  top: 44px;
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(8px);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 6px;
  min-width: 200px;
  max-height: 60vh;
  overflow-y: auto;
  box-shadow: var(--el-box-shadow-light);
}

.panel-header {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 6px 10px 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 2px;
}

.group-header {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  padding: 8px 10px 2px;
  margin-top: 2px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.group-header:first-of-type {
  border-top: none;
  margin-top: 0;
}

.switcher-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-primary);
  transition: background 0.15s;
}

.switcher-item:hover {
  background: var(--el-fill-color-light);
}

.switcher-item.active {
  color: var(--el-color-primary);
  font-weight: 600;
}

.check-icon {
  font-size: 14px;
}

/* ── 淡入淡出动画 ────────────────────────────────────────────── */

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ── 左下角底图名称 ──────────────────────────────────────────── */

.basemap-label {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 100;
  padding: 3px 10px;
  font-size: 12px;
  color: var(--el-color-white);
  background: rgba(0, 0, 0, 0.45);
  border-radius: 4px;
  pointer-events: none;
}
</style>
