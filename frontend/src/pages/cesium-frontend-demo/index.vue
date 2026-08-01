<script setup lang="ts">
import LearningCatalogHome from "@/components/LearningCatalogHome.vue"
import { cesiumLessons } from "./cesium-learning-catalog"
</script>

<template>
  <LearningCatalogHome
    eyebrow="CESIUM LEARNING SPACE"
    title="Cesium 前端 Demo"
    description="从 Viewer 初始化到场景环境，多个示例按现有文件顺序排列；每张卡片都对应一个可独立进入的学习页面。"
    :lessons="cesiumLessons"
  />
</template>
