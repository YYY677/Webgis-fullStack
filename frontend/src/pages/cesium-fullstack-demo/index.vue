<script setup lang="ts">
import LearningCatalogHome from "@/components/LearningCatalogHome.vue"
import { cesiumFullstackLessons } from "./cesium-fullstack-learning-catalog"
</script>

<template>
  <LearningCatalogHome
    eyebrow="CESIUM FULLSTACK LAB"
    title="Cesium 全栈 Demo"
    description="复用现有 GeoServer、PostGIS、JTS 与 pgRouting，观察二维业务数据如何进入三维场景。"
    :lessons="cesiumFullstackLessons"
    tone="green"
  />
</template>
