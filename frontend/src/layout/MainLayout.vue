<script lang="ts" setup>
import { ref, computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { setCssVar } from "@/utils/css"
import { routes } from "@/router"
import { cesiumLessons } from "@/pages/cesium-frontend-demo/cesium-learning-catalog"
// 把 Store 的定义（蓝图/构造函数） 拉进来，此时内存里什么都没有。
import { useAppStore } from "@/stores/app"
import { useUserStore } from "@/stores/user"
const route = useRoute()
const router = useRouter()
const appStore = useAppStore() // “运行”这个工厂函数。如果只导入不调用，组件根本无法获得状态数据。
const userStore = useUserStore()

const sidebarWidth = computed(() => appStore.sidebarOpened ? "220px" : "64px")
const sidebarActivePath = computed(() => route.path)

// 菜单 = 路由表 / 的子路由中 meta.hidden 不为 true 的那些
const menuList = computed(() => {
  const root = routes.find(r => r.path === "/")
  const items = root?.children?.filter(r => !r.meta?.hidden) ?? []
  return items.map(r => {
    // Cesium 章节的菜单、首页卡片和路由标题统一由 catalog.ts 管理，
    // 因此这里不能直接复用通用的 r.children，避免出现顺序或标题不一致。
    if (r.name === "CesiumDemo") {
      return {
        title: r.meta?.title as string,
        icon: r.meta?.icon as string,
        children: [
          { path: "/cesium-demo", title: "Cesium 学习首页" },
          ...cesiumLessons.map(lesson => ({
            path: lesson.path,
            title: lesson.title,
          })),
        ],
      }
    }
    if (!r.children) {
      // 叶子菜单（无子路由）
      return { path: "/" + r.path, title: r.meta?.title as string, icon: r.meta?.icon as string }
    }
    // 父级菜单（有子路由）
    return {
      title: r.meta?.title as string,
      icon: r.meta?.icon as string,
      children: r.children.map(c => ({
        path: "/" + r.path + "/" + c.path,
        title: c.meta?.title as string
      }))
    }
  })
})

// 搜索弹窗
const searchVisible = ref(false)
const searchKeyword = ref("")

const searchResults = computed(() => {
  if (!searchKeyword.value) return []
  const kw = searchKeyword.value.toLowerCase()
  const all: { title: string; path: string }[] = []
  for (const item of menuList.value) {
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

function toggleTheme(event: MouseEvent) {
  isDark.value = !isDark.value
  // 把用户偏好存进 localStorage，这样用户刷新页面后，主题不会重置
  localStorage.setItem("theme", isDark.value ? "dark" : "light")

  // 圆形扩散动画（View Transition API，Chrome 111+）
  const x = event.clientX
  const y = event.clientY
  // Math.hypot 计算了从点击点到屏幕最远角落的距离。这样算出来的半径，
  // 无论你在哪里点击，生成的圆都能恰好覆盖整个屏幕。
  const maxRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  // “JS 操控 CSS 变量”，让 CSS 动画里的 clip-path 知道了“圆要从哪里开始画，画多大”。
  setCssVar("--v3-theme-x", `${x}px`)
  setCssVar("--v3-theme-y", `${y}px`)
  setCssVar("--v3-theme-r", `${maxRadius}px`)
  // documentElement.classList为所有 HTML 元素的根节点 <html> 的 class 列表。切换 dark 类，触发暗黑模式。
  const toggle = () => document.documentElement.classList.toggle("dark", isDark.value)
  // 如果浏览器支持 View Transition API，就用它来做圆形扩散动画；否则直接切换主题。
  document.startViewTransition ? document.startViewTransition(toggle) : toggle()
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
        <!-- <svg> — 画布，坐标系 0~24，宽高 24 个单位，不填充，跟随当前文本颜色，线条粗细 2 个单位 -->
        <svg class="logo-img" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <!-- 圆心在画布正中央 (12, 12)，半径 10 个单位 → 地球的外轮廓。 -->
          <circle cx="12" cy="12" r="10" />
          <!-- d 属性是一串绘图指令，每个字母代表一个动作 -->
          <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" />
        </svg>
        <span v-show="appStore.sidebarOpened" class="logo-text">WebGIS</span>
      </div>
      <!-- 
        default-active用于高亮当前激活的菜单项 
        collapse控制菜单是否折叠（只显示图标）
        router启用 Vue Router 模式，点击菜单项时会自动调用 router.push()，根据 index 属性进行路由跳转
      -->
      <el-menu
        :default-active="sidebarActivePath"
        :collapse="!appStore.sidebarOpened"
        :router="true"
        class="sidebar-menu"
      >
        <template v-for="item in menuList" :key="item.path || item.title">
          <!-- sub-menu的index作为子菜单展开/折叠的唯一标识，不参与路由跳转 -->
          <el-sub-menu v-if="item.children" :index="item.title">
            <!-- #title插槽	自定义子菜单标题区域，内部包含图标和文本。 -->
            <template #title>
              <!-- <component> 是一个Vue核心框架内置的动态渲染的“占位符”。
                它的核心作用是：根据 is 属性的值，决定最终渲染成哪个具体的组件。 
                如果传的是字符串，Vue 会去查找“全局注册”的组件。
                该项目中，所有图标都是采用plugin方式全局注册的icon图标，所以可以直接传字符串。  
              -->
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.title }}</span>
            </template>
            <!-- menu-item的index绑定路由路径，参与路由跳转 + 高亮匹配 -->
            <el-menu-item v-for="child in item.children" :key="child.path" :index="child.path">
              <el-tooltip :content="child.title" placement="right" :show-after="250">
                <span class="sidebar-menu-title">{{ child.title }}</span>
              </el-tooltip>
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
          <!-- 侧边栏折叠/展开按钮 -->
          <el-icon class="collapse-btn" @click="appStore.toggleSidebar">
            <!-- 当侧边栏处于展开状态时显示折叠图标 -->
            <Fold v-if="appStore.sidebarOpened" />
            <!-- 当侧边栏处于折叠状态时显示展开图标 -->
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="›">
            <!-- 
              route 是 Vue Router 提供的当前路由信息对象。route.matched 是一个数组，
              它包含了当前 URL 匹配到的所有路由记录，按层级从父到子排列。
              当用户访问 /user/list 时，route.matched 的值就是：
              [
                { path: '/user', meta: { title: '用户管理' }, ... },
                { path: '/user/list', meta: { title: '用户列表' }, ... }
              ]
              filter 是 JavaScript 的数组方法，用来筛选符合条件的元素。
              结合上面的路由例子，面包屑导航就是：用户管理 › 用户列表
            -->
            <el-breadcrumb-item v-for="item in route.matched.filter(r => r.meta?.title)" :key="String(item.name || item.path)">
              {{ item.meta?.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <!-- <el-tooltip> 鼠标悬停时显示提示文字，effect="dark"：设置提示框的风格为深色背景 -->
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
          <!-- @command="handleCommand"：这是 Element Plus 下拉菜单的核心事件。
          当下拉菜单中的某一项被点击时，会触发该事件，并将被点击项的 command 值作为参数传入。 -->
          <el-dropdown @command="handleCommand">
            <!-- 触发区（default 插槽） -->
            <span class="user-info">
              <el-avatar :size="32" icon="UserFilled" />
              <span class="username">{{ userStore.username || "用户" }}</span>
            </span>
            <!-- 下拉菜单列表（#dropdown 插槽） -->
            <template #dropdown>
              <el-dropdown-menu>
                <!-- command="logout" 点击它时，外层的 @command 会收到这个字符串。 -->
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="content">
        <!-- 
          v-slot="{ Component }" 是 Vue 3 的插槽语法，Component 就是当前路由对应的组件。
          为什么非要这么写？ 因为只有把 Component 变量抓在手里，你才能手动控制它何时渲染、
          怎么渲染——这就是下一步要做的事，既方便我们给他添加过渡动画。
        --> 
        <router-view v-slot="{ Component }">
          <!-- 
            name="fade-transform"：指定了 CSS 动画类的前缀。意味着你要在样式表里写 
            .fade-transform-enter-active、.fade-transform-leave-active 
            等类来控制淡入淡出和位移效果。

            mode="out-in"：这是非常关键的配置！
            默认情况下，旧页面消失和新页面出现是同时进行的，容易产生“重叠闪动”。
            加上 mode="out-in" 后，旧页面必须彻底淡出消失后，新页面才会开始淡入出现。
            避免了切换时两个页面上下堆叠的尴尬，视觉上极其丝滑。
          -->
          <transition name="fade-transform" mode="out-in">
            <!-- 当路由改变时，Component 变量会变成新页面的组件对象。由于它被包裹在 <transition> 
              内部，这个变量的变化会触发 <transition> 的进入/离开钩子，从而启动动画。 -->
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
  overflow: hidden; // 防止滚动条出现
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
    // 菜单内容再高也不能压缩 Logo；超出的部分由下方菜单滚动承载。
    // flex-grow: 0、 flex-shrink: 0、flex-basis: 60px → flex: 0 0 60px 
    // 元素始终占 60px，打死也不变。有多余空间不拉伸，空间不足不压缩。
    flex: 0 0 60px;
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
    // 允许菜单收缩到侧栏剩余高度，并在展开项过多时独立纵向滚动。
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    border-right: none;

    .sidebar-menu-title {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
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
    gap: 16px; // 按钮之间的间距
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
