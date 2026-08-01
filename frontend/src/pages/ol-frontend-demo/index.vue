<script setup lang="ts">
import LearningCatalogHome from "@/components/LearningCatalogHome.vue"
import { olFrontendLessons } from "./ol-learning-catalog"
</script>

<template>
  <LearningCatalogHome
    eyebrow="OPENLAYERS FRONTEND LAB"
    title="静态 OL Demo"
    description="从底图、图层到交互与数据可视化，所有示例都在浏览器端完成。"
    :lessons="olFrontendLessons"
  />
</template>
