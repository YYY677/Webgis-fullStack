<template>
  <div id="cesiumContainer" class="map-container">
    <!-- 遮罩层：面板打开时覆盖地图，点击关闭面板 -->
    <div v-if="panelOpen" class="panel-overlay" @click="panelOpen = false" />

    <!-- 右上角浮动控制区 -->
    <div class="map-controls" @click.stop>
      <CesiumBasemapSwitcher :activate="switchBasemap" :initial="currentId" @toggle="(v: boolean) => panelOpen = v" />
    </div>

    <!-- 左下角当前底图名称 -->
    <div class="basemap-label">{{ currentLabel || "加载中..." }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"
import { ElMessage } from "element-plus"
import { Viewer, Ion } from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"

import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"

const panelOpen = ref(false)
const currentId = ref("")
const currentLabel = ref("")
let viewer: Viewer | null = null

/** 切换底图 */
async function switchBasemap(item: CesiumBasemapItem) {
  if (item.id === currentId.value || !viewer) return
  try {
    await item.activate(viewer)
    currentId.value = item.id
    currentLabel.value = item.label
  } catch (e: any) {
    ElMessage.error(`底图切换失败: ${e.message}`)
  }
}

onMounted(() => {
  // 设置 Cesium Ion token（默认底图需要）
  const token = import.meta.env.VITE_CESIUM_TOKEN
  Ion.defaultAccessToken = token

  // 不加载 Cesium 默认底图，手动加载本地世界图
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

.panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 99;
}

:deep(.cesium-viewer-bottom) { display: none !important; }
:deep(.cesium-viewer-toolbar) { display: none !important; }

.map-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 100;
}

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
