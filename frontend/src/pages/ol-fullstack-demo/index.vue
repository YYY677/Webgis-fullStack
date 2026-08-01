<script setup lang="ts">
import LearningCatalogHome from "@/components/LearningCatalogHome.vue"
import { olFullstackLessons } from "./ol-learning-catalog"
</script>

<template>
  <LearningCatalogHome
    eyebrow="OPENLAYERS FULLSTACK LAB"
    title="全栈 OL Demo"
    description="从 GeoServer 服务到 Spring Boot、PostGIS 和空间分析，串起完整的二维 GIS 数据链路。"
    :lessons="olFullstackLessons"
    tone="green"
  />
</template>
