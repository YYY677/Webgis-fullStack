<script lang="ts" setup>
import { computed } from "vue"
import { useRouter } from "vue-router"
// 这些虚拟导入由 unplugin-icons 在构建时生成 Tabler SVG Vue 组件，不需要手动维护 SVG 文件。
import IconActivity from "~icons/tabler/activity"
import IconArrowUpRight from "~icons/tabler/arrow-up-right"
import IconCube from "~icons/tabler/cube"
import IconLayers from "~icons/tabler/layers-linked"
import IconMap from "~icons/tabler/map-2"
import IconWorld from "~icons/tabler/world"
import { backendStatus, backendStatusInfo } from "@/services/backend-status"

const router = useRouter()
const backendInfo = computed(() => backendStatusInfo[backendStatus.value])
const learningModules = [
  { title: "OpenLayers 前端学习", subtitle: "二维地图与交互基础", description: "从底图、图层到查询与图表，建立稳定的二维地图能力。", path: "/ol-frontend-demo", icon: IconMap, color: "cyan" },
  { title: "OpenLayers 全栈学习", subtitle: "GeoServer 与空间数据服务", description: "连接 WMS、WFS、空间编辑与数据管理工作流。", path: "/ol-fullstack-demo", icon: IconLayers, color: "green" },
  { title: "Cesium 前端学习", subtitle: "三维地球与场景表达", description: "探索 Entity、Primitive、3D Tiles 与动态时空场景。", path: "/cesium-demo", icon: IconWorld, color: "amber" },
  { title: "Cesium 全栈学习", subtitle: "三维空间数据服务", description: "将 GeoServer 数据与三维场景、空间分析连接起来。", path: "/cesium-fullstack-demo", icon: IconCube, color: "violet" },
]

function enterModule(path: string) { router.push(path) }
</script>

<template>
  <main class="atlas-dashboard">
    <header class="atlas-dashboard__heading">
      <div>
        <p>SPATIAL LEARNING / 01</p>
        <h1>今天，从一个空间问题开始。</h1>
      </div>
      <!-- Motion：状态提示在标题出现后再轻微淡入，避免页面初始画面过于突兀。 -->
      <div v-motion class="atlas-system-status" :class="`is-${backendInfo.tone}`" :initial="{ opacity: 0, x: 10 }" :enter="{ opacity: 1, x: 0 }"
        :delay="180" :duration="420">
        <span class="atlas-system-status__pulse" aria-hidden="true" />
        <IconActivity /><span>{{ backendInfo.label }}</span>
      </div>
    </header>

    <!-- Motion：主视觉区从下方淡入；CSS 扫描线用于强化地图控制台氛围。 -->
    <section v-motion class="atlas-stage" :initial="{ opacity: 0, y: 16 }" :enter="{ opacity: 1, y: 0 }"
      :duration="580">
      <!-- 网格背景，营造地图坐标纸/数据面板感。 -->
      <div class="atlas-stage__grid" aria-hidden="true" />
      <!-- 右上方的多层椭圆等高线，像空间范围或雷达覆盖圈。 -->
      <div class="atlas-stage__contours" aria-hidden="true" />
      <!-- 虚线轨迹和四个定位点 -->
      <div class="atlas-stage__route" aria-hidden="true"><i /><i /><i /><i /></div>
      <!-- 会从左向右移动的半透明光带，也就是“雷达扫描”效果。 -->
      <div class="atlas-stage__scanner" aria-hidden="true" />
      <div class="atlas-stage__copy"><span>ACTIVE LEARNING VIEW</span>
        <h2>Spatial command center</h2>
        <p>选择一条学习路径，继续从数据、图层到三维场景的探索。</p>
      </div>
      <div class="atlas-stage__legend" aria-label="空间视图状态">
        <div><b>31°13′ N</b><span>LATITUDE</span></div>
        <div><b>121°28′ E</b><span>LONGITUDE</span></div>
        <div><b>ZOOM 08</b><span>VIEW SCALE</span></div>
      </div>
    </section>

    <section class="atlas-dashboard__modules" aria-labelledby="learning-modules-title">
      <div class="atlas-dashboard__section-title">
        <div>
          <p>LEARNING MODULES</p>
          <h2 id="learning-modules-title">继续你的学习路径</h2>
        </div><span>4 个已就绪模块</span>
      </div>
      <div class="atlas-module-grid">
        <!-- Motion：卡片按序入场；桌面端悬停上浮，鼠标/触屏按下时轻微缩小形成按压反馈。 -->
        <button v-for="(module, index) in learningModules" :key="module.path" v-motion class="atlas-module"
          :class="`is-${module.color}`" :initial="{ opacity: 0, y: 18 }" :enter="{ opacity: 1, y: 0 }"
          :hovered="{ y: -6, scale: 1.01 }" :tapped="{ scale: 0.985 }" :delay="index * 80" :duration="460"
          type="button" @click="enterModule(module.path)">
          <span class="atlas-module__icon">
            <component :is="module.icon" />
          </span><span class="atlas-module__order">0{{ index + 1 }}</span><strong>{{ module.title }}</strong><small>{{
            module.subtitle }}</small><em>{{ module.description }}</em><span class="atlas-module__enter">进入模块
            <IconArrowUpRight />
          </span>
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
.atlas-dashboard {
  min-height: 100%;
  padding: clamp(24px, 3vw, 46px);
  color: var(--atlas-text);
  background: var(--atlas-dashboard-bg);
}

.atlas-dashboard__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 22px;
  max-width: 1440px;
  margin: 0 auto 24px;
}

.atlas-dashboard__heading p,
.atlas-dashboard__section-title p {
  margin: 0 0 8px;
  color: var(--atlas-cyan);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: .15em;
}

.atlas-dashboard__heading h1 {
  margin: 0;
  font-size: clamp(26px, 3vw, 42px);
  font-weight: 720;
  letter-spacing: -.055em;
}

.atlas-system-status {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  color: var(--atlas-green);
  font-size: 13px;
}

.atlas-system-status.is-online { color: var(--atlas-green); }
.atlas-system-status.is-offline { color: #ff8f8f; }
.atlas-system-status.is-unconfigured { color: var(--atlas-amber); }

.atlas-system-status svg {
  width: 17px;
}

.atlas-system-status__pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 0 rgba(104, 224, 174, .62);
  animation: atlas-status-pulse 2.2s ease-out infinite;
}

.atlas-stage {
  position: relative;
  max-width: 1440px;
  min-height: clamp(300px, 34vw, 410px);
  margin: auto;
  overflow: hidden;
  border: 1px solid var(--atlas-stage-contour);
  border-radius: var(--atlas-radius);
  background: var(--atlas-stage-bg);
  box-shadow: var(--atlas-shadow);
  isolation: isolate;
}

/* CSS 动画：不依赖接口状态，仅作为主视觉的低频雷达扫描装饰。 */
.atlas-stage__scanner {
  position: absolute;
  z-index: 0;
  top: -24%;
  bottom: -24%;
  width: 19%;
  left: -24%;
  transform: rotate(18deg);
  background: linear-gradient(90deg, transparent, rgba(120, 229, 255, .02), rgba(120, 229, 255, .19), rgba(120, 229, 255, .02), transparent);
  filter: blur(1px);
  animation: atlas-radar-sweep 5.8s cubic-bezier(.4, 0, .2, 1) infinite;
  pointer-events: none;
}

.atlas-stage__grid {
  position: absolute;
  inset: 0;
  opacity: .58;
  background-image: linear-gradient(var(--atlas-stage-grid) 1px, transparent 1px), linear-gradient(90deg, var(--atlas-stage-grid) 1px, transparent 1px);
  background-size: 38px 38px;
  mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent);
}

.atlas-stage__contours {
  position: absolute;
  width: 80%;
  aspect-ratio: 1.4;
  right: -7%;
  top: -37%;
  border: 1px solid var(--atlas-stage-contour);
  border-radius: 50%;
  box-shadow: 0 0 0 46px rgba(85, 214, 255, .04), 0 0 0 104px rgba(85, 214, 255, .03), 0 0 0 182px rgba(85, 214, 255, .02);
  transform: rotate(-15deg);
}

.atlas-stage__route {
  position: absolute;
  width: 49%;
  height: 38%;
  right: 12%;
  bottom: 22%;
  border: 1px dashed var(--atlas-stage-route);
  border-left: 0;
  border-bottom: 0;
  border-radius: 50% 50% 0 0;
  transform: rotate(-10deg);
}

.atlas-stage__route i {
  position: absolute;
  display: block;
  width: 8px;
  aspect-ratio: 1;
  border: 2px solid var(--atlas-cyan);
  border-radius: 50%;
  background: var(--atlas-ink);
}

.atlas-stage__route i:nth-child(1) {
  left: -4px;
  bottom: -4px;
}

.atlas-stage__route i:nth-child(2) {
  left: 26%;
  top: 2%;
}

.atlas-stage__route i:nth-child(3) {
  left: 61%;
  top: 7%;
}

.atlas-stage__route i:nth-child(4) {
  right: -4px;
  bottom: -4px;
  border-color: var(--atlas-amber);
  background: var(--atlas-amber);
}

.atlas-stage__copy {
  position: relative;
  z-index: 1;
  max-width: 400px;
  padding: clamp(28px, 5vw, 66px);
}

.atlas-stage__copy>span {
  color: var(--atlas-amber);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: .15em;
}

.atlas-stage__copy h2 {
  margin: 12px 0;
  font-size: clamp(31px, 4vw, 54px);
  letter-spacing: -.065em;
  line-height: 1;
}

.atlas-stage__copy p {
  max-width: 310px;
  margin: 0;
  color: var(--atlas-muted);
  font-size: 14px;
  line-height: 1.7;
}

.atlas-stage__legend {
  position: absolute;
  z-index: 1;
  right: 24px;
  bottom: 20px;
  display: flex;
  gap: 20px;
  padding: 12px 14px;
  border: 1px solid var(--atlas-line);
  border-radius: 10px;
  background: var(--atlas-stage-legend);
  backdrop-filter: blur(12px);
}

.atlas-stage__legend div {
  display: grid;
  gap: 4px;
}

.atlas-stage__legend b {
  font: 12px ui-monospace, SFMono-Regular, Consolas, monospace;
}

.atlas-stage__legend span {
  color: var(--atlas-muted);
  font-size: 9px;
  letter-spacing: .1em;
}

.atlas-dashboard__modules {
  max-width: 1440px;
  margin: 30px auto 0;
}

.atlas-dashboard__section-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 15px;
}

.atlas-dashboard__section-title h2 {
  margin: 0;
  font-size: 21px;
  letter-spacing: -.04em;
}

.atlas-dashboard__section-title>span {
  color: var(--atlas-muted);
  font-size: 12px;
}

.atlas-module-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
}

.atlas-module {
  position: relative;
  display: flex;
  min-height: 226px;
  flex-direction: column;
  align-items: flex-start;
  padding: 19px;
  overflow: hidden;
  border: 1px solid var(--atlas-line);
  border-radius: 14px;
  color: var(--atlas-text);
  text-align: left;
  background: var(--atlas-module-bg);
  cursor: pointer;
  transition: border-color 180ms ease, background 180ms ease;
}

.atlas-module::before {
  content: "";
  position: absolute;
  width: 180px;
  height: 180px;
  right: -88px;
  top: -88px;
  border: 1px solid currentColor;
  border-radius: 50%;
  opacity: .14;
}

.atlas-module:hover {
  border-color: currentColor;
  background: var(--atlas-module-hover);
}

.atlas-module:focus-visible {
  outline: 2px solid var(--atlas-cyan);
  outline-offset: 3px;
}

.atlas-module.is-cyan {
  color: var(--atlas-cyan);
}

.atlas-module.is-green {
  color: var(--atlas-green);
}

.atlas-module.is-amber {
  color: var(--atlas-amber);
}

.atlas-module.is-violet {
  color: #b99aff;
}

.atlas-module__icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 10px;
}

.atlas-module__icon svg {
  width: 19px;
}

.atlas-module__order {
  position: absolute;
  top: 21px;
  right: 20px;
  color: var(--atlas-module-order);
  font: 11px ui-monospace, SFMono-Regular, Consolas, monospace;
}

.atlas-module strong {
  margin-top: 38px;
  color: var(--atlas-text);
  font-size: 15px;
}

.atlas-module small {
  margin-top: 6px;
  color: var(--atlas-muted);
  font-size: 12px;
}

.atlas-module em {
  margin-top: 14px;
  color: var(--atlas-module-detail);
  font-size: 12px;
  font-style: normal;
  line-height: 1.65;
}

.atlas-module__enter {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: auto;
  color: currentColor;
  font-size: 12px;
  font-weight: 700;
}

.atlas-module__enter svg {
  width: 15px;
}

@keyframes atlas-status-pulse {
  0%, 28% { box-shadow: 0 0 0 0 rgba(104, 224, 174, .58); }
  52%, 100% { box-shadow: 0 0 0 9px rgba(104, 224, 174, 0); }
}

@keyframes atlas-radar-sweep {
  0%, 14% { left: -24%; opacity: 0; }
  27% { opacity: 1; }
  72% { opacity: .86; }
  88%, 100% { left: 108%; opacity: 0; }
}

@media (max-width: 1040px) {
  .atlas-module-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .atlas-dashboard {
    padding: 22px 16px 34px;
  }

  .atlas-dashboard__heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .atlas-system-status {
    font-size: 12px;
  }

  .atlas-stage {
    min-height: 360px;
  }

  .atlas-stage__legend {
    right: 16px;
    left: 16px;
    justify-content: space-between;
    gap: 8px;
  }

  .atlas-stage__legend b {
    font-size: 10px;
  }

  .atlas-stage__legend span {
    font-size: 8px;
  }

  .atlas-stage__route {
    width: 63%;
    right: 4%;
  }

  .atlas-module {
    min-height: 208px;
  }
}

@media (max-width: 480px) {
  .atlas-module-grid {
    grid-template-columns: 1fr;
  }

  .atlas-dashboard__section-title>span {
    display: none;
  }

  .atlas-stage__copy {
    padding: 28px;
  }

  .atlas-stage__copy h2 {
    font-size: 37px;
  }
}
</style>
