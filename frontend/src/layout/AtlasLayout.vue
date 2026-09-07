<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
// 这些虚拟导入由 unplugin-icons 在构建时生成 Tabler SVG Vue 组件，供应用外壳的操作按钮使用。
import IconArrowRight from "~icons/tabler/arrow-right"
import IconBrandGithub from "~icons/tabler/brand-github"
import IconCommand from "~icons/tabler/command"
import IconFullscreen from "~icons/tabler/maximize"
import IconLogout from "~icons/tabler/logout"
import IconMenu from "~icons/tabler/menu-2"
import IconMoon from "~icons/tabler/moon"
import IconSearch from "~icons/tabler/search"
import IconSun from "~icons/tabler/sun"
import { routes } from "@/router"
import { useAppStore } from "@/stores/app"
import { useUserStore } from "@/stores/user"
import { backendStatus, backendStatusInfo } from "@/services/backend-status"

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const backendInfo = computed(() => backendStatusInfo[backendStatus.value])
const isCompactViewport = ref(window.matchMedia("(max-width: 680px)").matches)
const sidebarWidth = computed(() => (isCompactViewport.value || !appStore.sidebarOpened ? "72px" : "244px"))
const sidebarActivePath = computed(() => route.path)
type AtlasTheme = "night" | "day"

// `atlas-theme` 是新主题开关；首次使用默认白日主题，用户主动选择后再保存偏好。
const savedTheme = localStorage.getItem("atlas-theme") as AtlasTheme | null
// 只有明确保存为 night 时才显示夜间；没有记录时即为白日默认值。
const isDayTheme = ref(savedTheme !== "night")
const isThemeTransitioning = ref(false)
const searchVisible = ref(false)
const searchKeyword = ref("")

function applyTheme() {
  // Atlas 白日主题和 Element Plus 的 dark class 同步切换，组件也会跟随明暗模式。
  // document.documentElement 就是 <html> 元素; 添加与删除 atlas-day class 来切换白日主题。
  // 主题颜色变量在 frontend/src/assets/styles/variables.scss 中定义，
  // Element Plus 组件的 dark class 也会生效。
  document.documentElement.classList.toggle("atlas-day", isDayTheme.value)
  document.documentElement.classList.toggle("dark", !isDayTheme.value)
}

applyTheme()

function syncCompactViewport() { isCompactViewport.value = window.matchMedia("(max-width: 680px)").matches }
onMounted(() => { syncCompactViewport(); window.addEventListener("resize", syncCompactViewport) })
onBeforeUnmount(() => window.removeEventListener("resize", syncCompactViewport))

const menuList = computed(() => {
  const root = routes.find((item) => item.path === "/")
  return (root?.children?.filter((item) => !item.meta?.hidden) ?? []).map((item) => {
    if (!item.children) return { path: `/${item.path}`, title: item.meta?.title as string, icon: item.meta?.icon as string }
    return { title: item.meta?.title as string, icon: item.meta?.icon as string, children: item.children.map((child) => ({ path: child.path ? `/${item.path}/${child.path}` : `/${item.path}`, title: child.meta?.title as string })) }
  })
})

const searchResults = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return []
  const result: { title: string; path: string }[] = []
  for (const item of menuList.value) {
    if (item.children) result.push(...item.children.filter((child) => child.title.toLowerCase().includes(keyword)))
    else if (item.title.toLowerCase().includes(keyword)) result.push(item)
  }
  return result
})

function goToMenu(path: string) { searchVisible.value = false; searchKeyword.value = ""; router.push(path) }
function toggleTheme(event: MouseEvent) {
  if (isThemeTransitioning.value) return
  isThemeTransitioning.value = true

  // 以点击处为圆心，并计算足以覆盖整个视口的半径，供 view-transition.scss 裁剪动画使用。
  const x = event.clientX
  const y = event.clientY
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  document.documentElement.style.setProperty("--v3-theme-x", `${x}px`)
  document.documentElement.style.setProperty("--v3-theme-y", `${y}px`)
  document.documentElement.style.setProperty("--v3-theme-r", `${radius}px`)

  const switchTheme = () => {
    isDayTheme.value = !isDayTheme.value
    localStorage.setItem("atlas-theme", isDayTheme.value ? "day" : "night")
    applyTheme()
    isThemeTransitioning.value = false
  }

  // 支持 View Transition 的浏览器让真实的新页面从圆心展开。
  if (document.startViewTransition) document.startViewTransition(switchTheme)
  else {
    // 回退方案：先用目标主题色的圆形遮罩盖住旧页面，再在遮罩下完成切换。
    const ripple = document.createElement("span")
    ripple.className = "atlas-theme-ripple"
    ripple.style.setProperty("--atlas-ripple-x", `${x}px`)
    ripple.style.setProperty("--atlas-ripple-y", `${y}px`)
    ripple.style.setProperty("--atlas-ripple-size", `${radius * 2}px`)
    ripple.style.background = isDayTheme.value ? "#07111f" : "#edf4f7"
    document.body.append(ripple)
    ripple.addEventListener("animationend", () => {
      switchTheme()
      ripple.classList.add("is-fading")
      window.setTimeout(() => ripple.remove(), 120)
    }, { once: true })
  }
}
function toggleFullscreen() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen() }
function handleLogout() { userStore.logout(); router.push("/login") }
</script>

<template>
  <el-container class="atlas-shell">
    <el-aside :width="sidebarWidth" class="atlas-sidebar">
      <div class="atlas-sidebar__brand"><span class="atlas-sidebar__mark">
          <IconCommand />
        </span><span v-show="appStore.sidebarOpened">WebGIS Atlas</span></div>
      <el-menu :default-active="sidebarActivePath" :collapse="isCompactViewport || !appStore.sidebarOpened"
        :router="true" class="atlas-menu">
        <template v-for="item in menuList" :key="item.path || item.title">
          <el-sub-menu v-if="item.children" :index="item.title"><template #title><el-icon>
                <component :is="item.icon" />
              </el-icon><span>{{ item.title }}</span></template><el-menu-item v-for="child in item.children"
              :key="child.path" :index="child.path">{{ child.title }}</el-menu-item></el-sub-menu>
          <el-menu-item v-else :index="item.path"><el-icon>
              <component :is="item.icon" />
            </el-icon><template #title>{{ item.title }}</template></el-menu-item>
        </template>
      </el-menu>
      <div class="atlas-sidebar__foot" :class="`is-${backendInfo.tone}`" v-show="appStore.sidebarOpened"><span />
        <div><b>BACKEND</b><small>{{ backendInfo.label }}</small></div>
      </div>
    </el-aside>

    <el-container class="atlas-main">
      <el-header class="atlas-header">
        <div class="atlas-header__left"><button class="atlas-icon-button" type="button" aria-label="折叠侧边栏"
            @click="appStore.toggleSidebar">
            <IconMenu />
          </button><el-breadcrumb separator="/"><el-breadcrumb-item
              v-for="item in route.matched.filter((record) => record.meta?.title)"
              :key="String(item.name || item.path)">{{
                item.meta?.title }}</el-breadcrumb-item></el-breadcrumb></div>
        <div class="atlas-header__right"><a class="atlas-icon-button" href="https://github.com/YYY677/Webgis-fullStack"
            target="_blank" rel="noopener noreferrer" aria-label="打开 GitHub 项目"><IconBrandGithub /></a><button class="atlas-icon-button" type="button" aria-label="搜索菜单"
            @click="searchVisible = true">
            <IconSearch />
          </button><button class="atlas-icon-button" type="button" :aria-label="isDayTheme ? '切换为夜间主题' : '切换为白日主题'"
            :title="isDayTheme ? '切换为夜间主题' : '切换为白日主题'"
            @click="toggleTheme">
            <IconMoon v-if="isDayTheme" />
            <IconSun v-else />
          </button><button class="atlas-icon-button atlas-fullscreen" type="button" aria-label="切换全屏"
            @click="toggleFullscreen">
            <IconFullscreen />
          </button><el-dropdown trigger="click"><button class="atlas-user" type="button"><el-avatar :size="30"
                icon="UserFilled" /><span>{{ userStore.username || '学习者' }}</span></button><template
              #dropdown><el-dropdown-menu><el-dropdown-item @click="handleLogout">
                  <IconLogout />退出登录
                </el-dropdown-item></el-dropdown-menu></template></el-dropdown>
        </div>
      </el-header>
      <el-main class="atlas-content"><router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view></el-main>
      <el-footer class="atlas-footer">WebGIS Atlas <span>·</span> Spatial Learning Console</el-footer>
    </el-container>

    <el-dialog v-model="searchVisible" class="atlas-search-dialog" width="min(440px, calc(100vw - 32px))"
      :show-close="false">
      <template #header>
        <div class="atlas-search-dialog__title"><span>菜单检索</span><button type="button"
            @click="searchVisible = false">关闭</button></div>
      </template>
      <el-input v-model="searchKeyword" autofocus placeholder="输入模块名称" :prefix-icon="IconSearch" />
      <div v-if="searchResults.length" class="atlas-search-results"><button v-for="result in searchResults"
          :key="result.path" type="button" @click="goToMenu(result.path)"><span>{{ result.title }}</span>
          <IconArrowRight />
        </button></div>
      <p v-else-if="searchKeyword" class="atlas-search-empty">没有找到匹配的模块。</p>
    </el-dialog>
  </el-container>
</template>

<style scoped lang="scss">
.atlas-shell {
  height: 100vh;
  overflow: hidden;
  color: var(--atlas-text);
  background: var(--atlas-ink);
}

.atlas-sidebar {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--atlas-line);
  background: var(--atlas-sidebar-bg);
  transition: width 240ms ease;
}

.atlas-sidebar__brand {
  display: flex;
  height: 74px;
  flex: 0 0 74px;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  overflow: hidden;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 750;
  letter-spacing: -.035em;
}

.atlas-sidebar__mark {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border: 1px solid var(--atlas-stage-contour);
  border-radius: 10px;
  color: var(--atlas-cyan);
}

.atlas-sidebar__mark svg {
  width: 18px;
}

.atlas-menu {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-right: 0;
  color: var(--atlas-muted);
  background: transparent;

  :deep(.el-menu),
  :deep(.el-sub-menu .el-menu) {
    background: transparent;
  }

  :deep(.el-sub-menu__title),
  :deep(.el-menu-item) {
    height: 46px;
    margin: 2px 10px;
    border-radius: 9px;
    color: var(--atlas-muted);
  }

  :deep(.el-sub-menu__title:hover),
  :deep(.el-menu-item:hover) {
    color: var(--atlas-text);
    background: var(--atlas-interactive-hover);
  }

  :deep(.el-menu-item.is-active) {
    color: var(--atlas-text);
    background: var(--atlas-interactive-active);
    box-shadow: inset 2px 0 var(--atlas-cyan);
  }

  :deep(.el-menu--collapse) {
    width: 72px;
  }
}

.atlas-sidebar__foot {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 14px;
  padding: 12px;
  border: 1px solid var(--atlas-line);
  border-radius: 10px;
  background: var(--atlas-panel-soft);
}

.atlas-sidebar__foot>span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--atlas-cyan);
  box-shadow: 0 0 12px var(--atlas-cyan);
}

.atlas-sidebar__foot.is-online>span {
  background: var(--atlas-green);
  box-shadow: 0 0 12px var(--atlas-green);
}

.atlas-sidebar__foot.is-offline>span { background: #ff8f8f; box-shadow: 0 0 12px #ff8f8f; }
.atlas-sidebar__foot.is-unconfigured>span { background: var(--atlas-amber); box-shadow: 0 0 12px var(--atlas-amber); }

.atlas-sidebar__foot b,
.atlas-sidebar__foot small {
  display: block;
}

.atlas-sidebar__foot b {
  font-size: 10px;
  letter-spacing: .08em;
}

.atlas-sidebar__foot small {
  margin-top: 3px;
  color: var(--atlas-muted);
  font-size: 11px;
}

.atlas-main {
  min-width: 0;
}

.atlas-header {
  display: flex;
  height: 64px;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--atlas-line);
  background: var(--atlas-header-bg);
}

.atlas-header__left,
.atlas-header__right {
  display: flex;
  align-items: center;
  gap: 9px;
}

.atlas-header__left {
  gap: 18px;
}

.atlas-header :deep(.el-breadcrumb__inner),
.atlas-header :deep(.el-breadcrumb__inner a) {
  color: var(--atlas-muted);
  font-weight: 500;
}

.atlas-header :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: var(--atlas-text);
}

.atlas-header :deep(.el-breadcrumb__separator) {
  color: rgba(142, 168, 187, .5);
}

.atlas-icon-button,
.atlas-user {
  display: inline-flex;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--atlas-muted);
  background: transparent;
  cursor: pointer;
  transition: 160ms ease;
}

.atlas-icon-button {
  width: 34px;
}

.atlas-icon-button svg {
  width: 18px;
}

.atlas-icon-button:hover,
.atlas-user:hover {
  border-color: var(--atlas-line);
  color: var(--atlas-text);
  background: var(--atlas-interactive-hover);
}

.atlas-icon-button:focus-visible,
.atlas-user:focus-visible {
  outline: 2px solid var(--atlas-cyan);
  outline-offset: 2px;
}

.atlas-user {
  gap: 8px;
  padding: 2px 8px 2px 3px;
  color: var(--atlas-text);
  font-size: 13px;
}

.atlas-user :deep(.el-avatar) {
  color: var(--atlas-accent-contrast);
  background: var(--atlas-cyan);
}

.atlas-content {
  padding: 0;
  overflow: auto;
  background: var(--atlas-ink);
}

.atlas-footer {
  display: flex;
  height: 30px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  border-top: 1px solid var(--atlas-line);
  color: var(--atlas-muted);
  font-size: 11px;
  letter-spacing: .04em;
  background: var(--atlas-footer-bg);
}

.atlas-footer span {
  color: var(--atlas-cyan);
}

:deep(.atlas-search-dialog) {
  overflow: hidden;
  border: 1px solid rgba(85, 214, 255, .3);
  border-radius: 16px;
  background: var(--atlas-overlay-bg);
  box-shadow: var(--atlas-shadow);
}

.atlas-search-dialog__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--atlas-text);
  font-size: 17px;
  font-weight: 700;
}

.atlas-search-dialog__title button {
  border: 0;
  color: var(--atlas-muted);
  background: transparent;
  cursor: pointer;
}

.atlas-search-dialog :deep(.el-dialog__header) {
  margin: 0;
  padding: 20px 22px 14px;
}

.atlas-search-dialog :deep(.el-dialog__body) {
  padding: 10px 22px 22px;
}

.atlas-search-dialog :deep(.el-input__wrapper) {
  background: var(--atlas-input-bg);
  box-shadow: 0 0 0 1px var(--atlas-line) inset;
}

.atlas-search-dialog :deep(.el-input__inner) {
  color: var(--atlas-text);
}

.atlas-search-results {
  display: grid;
  gap: 7px;
  margin-top: 14px;
}

.atlas-search-results button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 9px;
  color: var(--atlas-text);
  text-align: left;
  background: var(--atlas-panel-soft);
  cursor: pointer;
}

.atlas-search-results button:hover {
  border-color: var(--atlas-line);
  background: var(--atlas-interactive-active);
}

.atlas-search-results svg {
  width: 16px;
  color: var(--atlas-cyan);
}

.atlas-search-empty {
  margin: 18px 0 0;
  color: var(--atlas-muted);
  font-size: 13px;
  text-align: center;
}

@media (max-width: 680px) {
  .atlas-sidebar__brand {
    justify-content: center;
    padding: 0;
  }

  .atlas-sidebar__brand>span:last-child,
  .atlas-sidebar__foot {
    display: none !important;
  }

  .atlas-header {
    height: 58px;
    padding: 0 12px;
  }

  .atlas-header__left {
    gap: 8px;
  }

  .atlas-header :deep(.el-breadcrumb) {
    max-width: 150px;
    overflow: hidden;
    white-space: nowrap;
  }

  .atlas-header__right {
    gap: 2px;
  }

  .atlas-fullscreen,
  .atlas-user span {
    display: none;
  }

  .atlas-user {
    padding: 2px;
  }

  .atlas-footer {
    font-size: 9px;
  }
}
</style>
