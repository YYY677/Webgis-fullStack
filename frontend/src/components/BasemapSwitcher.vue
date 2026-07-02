<template>
  <div class="basemap-switcher">
    <!-- 触发按钮 -->
    <el-tooltip content="切换底图" placement="left">
      <!-- 这里的 Switch 是 JavaScript 变量值，不是模板组件名。
      Vue 编译器需要它在当前作用域里有定义，全局注册帮不了忙，必须 import。 -->
      <el-button class="trigger-btn" :icon="Switch" circle @click="open = !open" />
    </el-tooltip>

    <!-- 下拉面板 -->
    <Transition name="fade">
      <div v-if="open" class="switcher-panel">
        <div class="panel-header">底图选择</div>
        <div
          v-for="item in BASEMAP_LIST"
          :key="item.id"
          class="switcher-item"
          :class="{ active: item.id === current }"
          @click="select(item)"
        >
          <span class="item-label">{{ item.label }}</span>
          <el-icon v-if="item.id === current" class="check-icon"><Check /></el-icon>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { MapLocation, Check, Switch } from "@element-plus/icons-vue"
import { BASEMAP_LIST } from "@/utils/basemaps"
// type是用来导入类型的关键字，它不会在编译后的代码中生成任何实际的导入语句，
// 只会在类型检查阶段使用。使用type导入可以避免引入不必要的运行时依赖，从而减少打包体积和提高性能。
import type { BasemapItem } from "@/utils/basemaps"

const props = defineProps<{
  // BasemapItem["create"]就是BaseLayer，因为BasemapItem的create方法返回的是BaseLayer类型的对象。
  // ReturnType是TypeScript的一个内置工具类型，用于获取函数类型的返回值类型。
  // => void表示这个函数没有返回值，或者说返回值类型是void。
  setBaseLayer: (layer: ReturnType<BasemapItem["create"]>) => void
  initial?: string
}>()

const open = ref(false)
const current = ref(props.initial ?? BASEMAP_LIST[0].id)

function select(item: BasemapItem) {
  // 如果当前选中的底图与点击的底图不同，
  // 则调用setBaseLayer方法切换底图，并更新current的值为新的底图id。
  if (current.value !== item.id) {
    props.setBaseLayer(item.create())
    current.value = item.id
  }
  open.value = false
}
</script>

<style scoped>
.basemap-switcher {
  position: relative;
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

.switcher-panel {
  position: absolute;
  right: 35px;
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(8px);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 6px;
  min-width: 180px;
  box-shadow: var(--el-box-shadow-light);
}

.panel-header {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 6px 10px 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 2px;
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

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.active {
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.check-icon {
  font-size: 14px;
}

/* 淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
