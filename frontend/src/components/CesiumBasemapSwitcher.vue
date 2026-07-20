<template>
  <div class="cesium-switcher">
    <!-- 触发按钮 -->
    <el-tooltip content="切换底图" placement="left">
      <el-button class="trigger-btn" :icon="MapLocation" circle @click="toggle()" />
    </el-tooltip>

    <!-- 下拉面板 -->
    <Transition name="fade">
      <div v-if="open" class="switcher-panel">
        <div class="panel-header">底图选择</div>

        <template v-for="group in groupedBasemaps" :key="group.group">
          <div class="group-header">{{ group.groupLabel }}</div>
          <div
            v-for="item in group.items"
            :key="item.id"
            class="switcher-item"
            :class="{ active: item.id === current }"
            @click="select(item)"
          >
            <span class="item-label">{{ item.label }}</span>
            <el-icon v-if="item.id === current" class="check-icon"><Check /></el-icon>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"
import { MapLocation, Check } from "@element-plus/icons-vue"
import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"

const props = defineProps<{
  activate: (item: CesiumBasemapItem) => Promise<void>
  initial?: string
}>()

const emit = defineEmits<{
  (e: 'toggle', isOpen: boolean): void
}>()

const open = ref(false)
const current = ref(props.initial ?? "")

watch(
  () => props.initial,   // 监听的目标：一个函数，返回 props.initial 的值
  (v) => {               // 回调：当 props.initial 变化时触发，v 是新值
    if (v) current.value = v
  }
)

function toggle() {
  open.value = !open.value
  emit('toggle', open.value)
}

// 按 group 分组
const groupedBasemaps = computed(() => {
  const groups = new Map<string, { group: string; groupLabel: string; items: CesiumBasemapItem[] }>()
  for (const item of CESIUM_BASEMAP_LIST) {
    if (!groups.has(item.group)) {
      groups.set(item.group, { group: item.group, groupLabel: item.groupLabel, items: [] })
    }
    groups.get(item.group)!.items.push(item)
  }
  return Array.from(groups.values())
})

async function select(item: CesiumBasemapItem) {
  if (current.value !== item.id) {
    await props.activate(item)
    current.value = item.id
  }
  open.value = false
  emit('toggle', false)
}
</script>

<style scoped>
.cesium-switcher {
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
