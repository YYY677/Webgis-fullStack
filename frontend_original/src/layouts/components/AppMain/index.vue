<script lang="ts" setup>
import { useSettingsStore } from "@/pinia/stores/settings"
import { useTagsViewStore } from "@/pinia/stores/tags-view"
import { Footer } from "../index"

const tagsViewStore = useTagsViewStore()

const settingsStore = useSettingsStore()
</script>

<template>
  <section class="app-main">
    <div class="app-scrollbar">
      <!-- key 采用 route.path 和 route.fullPath 有着不同的效果，大多数时候 path 更通用 -->
      <!-- 第一层：v-slot="{ Component, route }"
不用默认渲染，而是把"当前要渲染的页面组件"和"当前路由"暴露出来，自己控制怎么渲染。Component 就是你的 dashboard 组件。
第二层：<transition>，Vue 自带的，不需要装任何东西
页面切换时的淡入淡出动画。mode="out-in" = 旧页面先消失，新页面再出现，不会闪一下。
第三层：<keep-alive>
把已打开的页面缓存在内存里，切标签页回来时不重新创建，保持之前的状态（滚动位置、表单已填内容等）。:include 指定只缓存哪些页面。
点击侧边栏 "/demo/cesium"
      ↓
Vue Router 跳转
      ↓
router.afterEach → setRouteChange(to)
      ↓
mitt 事件总线发出 "ROUTE_CHANGE"
      ↓
TagsView 收到 → addTags(route)
      ↓
      ├─ addVisitedView → visitedViews 增加     → 顶栏多一个标签
      └─ addCachedView → 检查 route.meta.keepAlive
                              ↓
                        如果 true → cachedViews.push(route.name) → keep-alive 生效
                        如果 false → 不缓存（切页就销毁）
第四层：<component :is="Component">， Vue 内置的动态组件标签，is 属性 = "我要渲染哪个组件"
动态渲染当前页面。:key="route.path" 确保路由变了就重建组件。 -->
      <router-view v-slot="{ Component, route }">
        <transition name="el-fade-in" mode="out-in">
          <keep-alive :include="tagsViewStore.cachedViews">
            <component :is="Component" :key="route.path" class="app-container-grow" />
          </keep-alive>
        </transition>
      </router-view>
      <!-- 页脚 -->
      <Footer v-if="settingsStore.showFooter" />
    </div>
    <!-- 返回顶部 -->
    <el-backtop />
    <!-- 返回顶部（固定 Header 情况下） -->
    <el-backtop target=".app-scrollbar" />
  </section>
</template>

<style lang="scss" scoped>
@import "@@/assets/styles/mixins.scss";

.app-main {
  width: 100%;
  display: flex;
}

.app-scrollbar {
  flex-grow: 1;
  overflow: auto;
  @extend %scrollbar;
  display: flex;
  flex-direction: column;
  .app-container-grow {
    flex-grow: 1;
  }
}
</style>
