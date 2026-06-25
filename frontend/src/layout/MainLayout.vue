<script lang="ts" setup>
import { ref, computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useAppStore } from "@/stores/app"
import { useUserStore } from "@/stores/user"
import {
  Expand, Fold, Search, FullScreen, Moon, Sunny, UserFilled,
  HomeFilled, Grid, MapLocation
} from "@element-plus/icons-vue"

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()

const sidebarWidth = computed(() => appStore.sidebarOpened ? "200px" : "64px")

// 侧边栏菜单（icon 直接传组件引用，不传字符串）
const menuList = [
  { path: "/dashboard", title: "首页", icon: HomeFilled },
  {
    title: "组件示例", icon: Grid,
    children: [
      { path: "/demo/element-plus", title: "Element Plus" }
    ]
  },
  {
    title: "Map Demo", icon: MapLocation,
    children: [
      { path: "/map-demo/tianditu", title: "天地图" },
      { path: "/map-demo/wfs", title: "WFS 查询" },
      { path: "/map-demo/cesium", title: "Cesium 3D" }
    ]
  }
]

// 搜索弹窗
const searchVisible = ref(false)
const searchKeyword = ref("")

const searchResults = computed(() => {
  if (!searchKeyword.value) return []
  const kw = searchKeyword.value.toLowerCase()
  const all: { title: string; path: string }[] = []
  for (const item of menuList) {
    if (item.children) {
      for (const child of item.children) {
        if (child.title.toLowerCase().includes(kw)) all.push(child)
      }
    } else if (item.title.toLowerCase().includes(kw)) {
      all.push(item)
    }
  }
  return all
})

function goToMenu(path: string) {
  searchVisible.value = false
  searchKeyword.value = ""
  router.push(path)
}

// 主题
const isDark = ref(false)

function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem("theme", isDark.value ? "dark" : "light")
  document.documentElement.classList.toggle("dark", isDark.value)
}

// 全屏
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function handleLogout() {
  userStore.logout()
  router.push("/login")
}

function handleCommand(cmd: string) {
  if (cmd === "logout") handleLogout()
}

// 从 localStorage 恢复主题
const savedTheme = localStorage.getItem("theme")
if (savedTheme === "dark") {
  isDark.value = true
  document.documentElement.classList.add("dark")
}
</script>

<template>
  <el-container class="app-wrapper">
    <!-- 侧边栏 -->
    <el-aside :width="sidebarWidth" class="sidebar">
      <div class="sidebar-logo">
        <svg class="logo-img" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" />
        </svg>
        <span v-show="appStore.sidebarOpened" class="logo-text">WebGIS</span>
      </div>
      <el-menu
        :default-active="route.path"
        :collapse="!appStore.sidebarOpened"
        :router="true"
        class="sidebar-menu"
      >
        <template v-for="item in menuList" :key="item.path || item.title">
          <el-sub-menu v-if="item.children" :index="item.title">
            <template #title>
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.title }}</span>
            </template>
            <el-menu-item v-for="child in item.children" :key="child.path" :index="child.path">
              {{ child.title }}
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <!-- 主区域 -->
    <el-container class="main-container">
      <!-- 顶栏 -->
      <el-header class="header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="appStore.toggleSidebar">
            <Fold v-if="appStore.sidebarOpened" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="›">
            <el-breadcrumb-item v-for="item in route.matched.filter(r => r.meta?.title)" :key="item.path">
              {{ item.meta?.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-tooltip content="搜索菜单" effect="dark">
            <el-icon class="header-btn" @click="searchVisible = true"><Search /></el-icon>
          </el-tooltip>
          <el-tooltip :content="isDark ? '浅色模式' : '深色模式'" effect="dark">
            <el-icon class="header-btn" @click="toggleTheme">
              <Moon v-if="!isDark" />
              <Sunny v-else />
            </el-icon>
          </el-tooltip>
          <el-tooltip content="全屏" effect="dark">
            <el-icon class="header-btn" @click="toggleFullscreen"><FullScreen /></el-icon>
          </el-tooltip>
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" icon="UserFilled" />
              <span class="username">{{ userStore.username || "用户" }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="content">
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>

      <!-- 页脚 -->
      <el-footer class="footer">WebGIS 全栈平台 &copy; {{ new Date().getFullYear() }}</el-footer>
    </el-container>

    <!-- 搜索弹窗 -->
    <el-dialog v-model="searchVisible" title="搜索菜单" width="400px" top="15vh">
      <el-input v-model="searchKeyword" placeholder="输入菜单名称..." clearable />
      <div v-if="searchResults.length" class="search-results">
        <div v-for="r in searchResults" :key="r.path" class="search-item" @click="goToMenu(r.path)">
          {{ r.title }}
        </div>
      </div>
      <div v-else-if="searchKeyword && !searchResults.length" class="search-empty">
        未找到匹配菜单
      </div>
    </el-dialog>
  </el-container>
</template>

<style lang="scss" scoped>
.app-wrapper {
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  background-color: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);
  transition: width 0.3s;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .sidebar-logo {
    height: 60px;
    display: flex;
    align-items: center;
    padding: 0 18px;
    gap: 10px;
    white-space: nowrap;
    .logo-img {
      width: 30px;
      height: 30px;
      flex-shrink: 0;
      color: var(--el-color-primary);
    }
    .logo-text {
      font-size: 20px;
      font-weight: 700;
    }
  }

  .sidebar-menu {
    flex: 1;
    border-right: none;
  }
}

.main-container {
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  background-color: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);

  .header-left {
    display: flex;
    align-items: center;
    gap: 18px;
    :deep(.el-breadcrumb__inner) {
      color: var(--el-text-color-primary) !important;
      font-weight: 500;
    }
  }

  .collapse-btn {
    font-size: 24px;
    cursor: pointer;
    color: var(--el-text-color-primary);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
    .header-btn {
      font-size: 22px;
      cursor: pointer;
      color: var(--el-text-color-regular);
      transition: color 0.2s;
      &:hover { color: var(--el-color-primary); }
    }
    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      .username { font-size: 14px; color: var(--el-text-color-primary); }
    }
  }
}

.content {
  flex: 1;
  padding: 0;
  overflow: auto;
  background-color: var(--el-bg-color-page);
}

.footer {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 25px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);
}

.search-results {
  margin-top: 12px;
  .search-item {
    padding: 8px 12px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 14px;
    &:hover { background-color: var(--el-fill-color-light); }
  }
}

.search-empty {
  margin-top: 12px;
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
}
</style>
