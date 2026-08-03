import { createApp } from "vue"
import { createPinia } from "pinia"
// 注册 v-motion 指令；登录页和 Dashboard 用它声明入场、悬停、按压动画。
import { MotionPlugin } from "@vueuse/motion"
// 注册了 Element Plus 的插件系统（指令、配置等）
import ElementPlus from "element-plus"
import zhCn from "element-plus/es/locale/lang/zh-cn"
import App from "./App.vue"
import router from "./router"
// 注册了 Element Plus 的图标组件
import { installElementPlusIcons } from "@/plugins/element-plus-icons"
import { startBackendMonitoring } from "@/services/backend-status"

// css
/*
import 一个 CSS 文件时，Vite 自动把它注入到页面的 <head> 里变成 <style> 标签。
写在 main.ts 里——应用启动最早执行的代码——这些 <style> 标签就在页面渲染任何组件前插入 DOM。
所有.vue 文件的 <style scoped> 只作用于自身组件。而 main.ts 里的 import 不加 scoped，
所以全局有效。
*/
// 引入 Element Plus 的基础样式文件
import "element-plus/dist/index.css"
// 引入 Element Plus 的暗黑主题 CSS 变量文件
import "element-plus/theme-chalk/dark/css-vars.css"
// 浏览器默认样式统一工具。不同浏览器给 <body> 默认的 margin 不一样，normalize.css 把它们统一成一致的值。
import "normalize.css"
// 我们自己写的全局样式汇总（字体、滚动条美化、.app-container 工具类、页面切换动画等）。
import "./styles/index.scss"

const app = createApp(App)
installElementPlusIcons(app)
app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })
// 全局安装后，任意页面模板都可以使用 v-motion。
app.use(MotionPlugin)
startBackendMonitoring()
app.mount("#app")
