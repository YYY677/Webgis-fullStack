<script lang="ts" setup>
import { useGreyAndColorWeakness } from "@@/composables/useGreyAndColorWeakness"
import { useTheme } from "@@/composables/useTheme"
import zhCn from "element-plus/es/locale/lang/zh-cn" // Element Plus 中文包

const { initTheme } = useTheme()

const { initGreyAndColorWeakness } = useGreyAndColorWeakness()

// 初始化主题
initTheme()

// 初始化灰色模式和色弱模式
initGreyAndColorWeakness()
</script>

<template>
  <!-- el-config-provider是 Element Plus 的全局配置组件
    locale="zhCn" → 所有 Element Plus 组件的默认文案变中文 -->
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>
