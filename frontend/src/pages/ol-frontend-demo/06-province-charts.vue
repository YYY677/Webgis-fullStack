<template>
  <div id="map" class="map-container" style="position: relative">
    <div class="map-controls-right">
      <BasemapSwitcher :set-base-layer="setBaseLayer" />
      <MapSetting v-if="map" :map="map" />
    </div>

    <!-- 图表面板 -->
    <div class="chart-panel">
      <el-tabs v-model="activeTab" class="chart-tabs" @tab-change="onTabChange">
        <el-tab-pane label="柱状图" name="bar" />
        <el-tab-pane label="饼图" name="pie" />
        <el-tab-pane label="散点图" name="scatter" />
        <el-tab-pane label="折线图" name="line" />
      </el-tabs>
      <div ref="chartRef" class="chart-box" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue"
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"
import MapSetting from "@/components/MapSetting.vue"
import { publicUrl } from "@/utils/public-url"
import GeoJSON from "ol/format/GeoJSON"
import { Vector as VectorSource } from "ol/source"
import { Vector as VectorLayer } from "ol/layer"
import { Style, Fill, Stroke } from "ol/style"
import Select from "ol/interaction/Select"
import { transform } from "ol/proj"
import * as echarts from "echarts"

// ── 地图初始化 ────────────────────────────────────────────
const { map, setBaseLayer } = useMap("map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [110, 35],
  view: { zoom: 5 }
})

// #region 添加模拟数据，可以不用关注。
// ── 省份数据 ──────────────────────────────────────────────

interface ProvinceData {
  name: string
  /** 模拟 GDP（亿元） */
  gdp: number
  /** 模拟人口（万人） */
  population: number
  /** 模拟面积（万 km²） */
  area: number
  /** 教育投入（亿元） */
  eduSpending: number
  /** 增长率（%） */
  growth: number
  /** 所属区域 */
  region: string
  /** 逐年 GDP（2015-2025） */
  gdpTrend: number[]
}

const REGION_MAP: Record<string, string[]> = {
  "华北": ["北京市", "天津市", "河北省", "山西省", "内蒙古自治区"],
  "东北": ["辽宁省", "吉林省", "黑龙江省"],
  "华东": ["上海市", "江苏省", "浙江省", "安徽省", "福建省", "江西省", "山东省"],
  "华中": ["河南省", "湖北省", "湖南省"],
  "华南": ["广东省", "广西壮族自治区", "海南省", "香港特别行政区", "澳门特别行政区"],
  "西南": ["重庆市", "四川省", "贵州省", "云南省", "西藏自治区"],
  "西北": ["陕西省", "甘肃省", "青海省", "宁夏回族自治区", "新疆维吾尔自治区"],
}

function getRegion(name: string): string {
  // Object.entries 遍历 REGION_MAP，找到包含该省份的区域
  for (const [region, names] of Object.entries(REGION_MAP)) {
    if (names.includes(name)) return region
  }
  return "其他"
}

/** 生成 [min, max] 之间的随机整数 */
function rand(min: number, max: number): number {
  return Math.round(Math.random() * (max - min) + min)
}

/** 生成带一位小数的随机数 */
function randFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10
}

/** 为每个省份生成模拟数据 */
function generateProvinceData(names: string[]): ProvinceData[] {
  return names.map((name) => {
    const base = rand(500, 8000)
    const pop = rand(200, 5000)
    const area = randFloat(1, 70)
    // 逐年 GDP（2015-2025），基准值 + 年增长 3-12%
    const trend: number[] = []
    let val = base * 0.6  // 2015 基准
    for (let y = 2015; y <= 2025; y++) {
      val = Math.round(val * (1 + randFloat(0.03, 0.12)))
      trend.push(val)
    }

    return {
      name,
      gdp: base,
      population: pop,
      area,
      eduSpending: Math.round(base * randFloat(0.02, 0.05)),
      growth: randFloat(3, 12),
      region: getRegion(name),
      gdpTrend: trend,
    }
  })
}
//#endregion

// ── UI 状态 ────────────────────────────────────────────────
const activeTab = ref("bar")
const chartRef = ref<HTMLDivElement | null>(null)
// chartInstance 是 ECharts 图表库的实例对象。你可以把它理解为画图的“总控制器”。
let chartInstance: echarts.ECharts | null = null
let provinceData: ProvinceData[] = []
let provinceLayer: VectorLayer<any> | null = null
const selectedProvince = ref("")

// ── 图表初始化 ─────────────────────────────────────────────

function initChart() {
  // chartRef 可能还没渲染到 DOM，所以要加个保护
  if (!chartRef.value) return
  // 如果已经有实例了，先销毁再创建新实例
  if (chartInstance) chartInstance.dispose()
  // 把 ECharts 和那个空的 div 绑定起来，初始化一个画布
  chartInstance = echarts.init(chartRef.value)

  // 点击事件 → 地图高亮省份
  chartInstance.on("click", (params: any) => {
    // 不同图表类型的数据结构不一样：
    //   柱状图 → params.name = 省份名
    //   散点图 → params.data.value[2] = 省份名
    //   折线图 → params.seriesName = 省份名
    const name = params.data?.value?.[2] || params.name || params.seriesName
    if (name) highlightProvince(name) // ← 跳到 highlightProvince
  })

  renderChart()
  // 窗口 resize 时自适应
  window.addEventListener("resize", onResize)
}

function onResize() {
  chartInstance?.resize()
}

function renderChart() {
  if (!chartInstance) return

  const option = activeTab.value === "bar" ? getBarOption()
    : activeTab.value === "pie" ? getPieOption()
      : activeTab.value === "scatter" ? getScatterOption()
        : getLineOption()

  chartInstance.setOption(option, true) // 第二个参数 true 表示完全替换（notMerge）
}

function onTabChange() {
  // nextTick 等待 DOM 更新完成后再执行回调，确保 chartRef 的尺寸已经更新
  nextTick(() => {
    // el-tabs 切换后 chartRef 的容器尺寸可能变化，重建实例
    if (chartInstance) chartInstance.dispose()
    chartInstance = null
    initChart() // 重新创建实例
  })
}

// ── 图表配置 ───────────────────────────────────────────────

const REGION_COLORS: Record<string, string> = {
  "华北": "#5470c6", "东北": "#91cc75", "华东": "#fac858",
  "华中": "#ee6666", "华南": "#73c0de", "西南": "#3ba272",
  "西北": "#fc8452", "其他": "#9a60b4",
}

function getTopProvinces(n: number): ProvinceData[] {
  return [...provinceData].sort((a, b) => b.gdp - a.gdp).slice(0, n)
}

/** 柱状图：GDP Top 10 */
function getBarOption(): echarts.EChartsOption {
  const top = getTopProvinces(10)
  return {
    title: { text: "GDP Top 10", left: "center", textStyle: { fontSize: 13 }, top: 0 },
    // tooltip – 提示框（鼠标悬停时显示的数据浮层）
    // trigger: "axis"：触发方式为 坐标轴触发。
    // 鼠标移到柱子所在的分类轴上（或柱子上）时，会显示该分类下所有系列的数据
    tooltip: { trigger: "axis" },
    grid: { left: 50, right: 10, top: 40, bottom: 50 },
    xAxis: {
      type: "category", // 类别轴，即离散的字符串数据（这里是省份名称）。
      data: top.map((p) => p.name), // X 轴的刻度标签数组，从 top 数据中提取所有省份的 name。
      axisLabel: { rotate: 30, fontSize: 10 }, // 标签旋转 30 度，避免名称重叠
    },
    yAxis: { type: "value", name: "亿元" }, // 数值轴，用于显示 GDP 数值。
    series: [
      {
        type: "bar", // 指定图表类型为柱状图。
        data: top.map((p) => ({
          value: p.gdp, // 柱子的高度（GDP 数值）。
          itemStyle: { // 柱子的样式
            color: REGION_COLORS[p.region],
          },
        })),
        emphasis: { itemStyle: { color: "#e74c3c" } }, // 鼠标悬停高亮
      },
    ],
  }
}

/** 饼图：各区域 GDP 占比 */
function getPieOption(): echarts.EChartsOption {
  const regionSum: Record<string, number> = {}
  // 计算每个区域的 GDP 总和
  provinceData.forEach((p) => {
    regionSum[p.region] = (regionSum[p.region] || 0) + p.gdp
  })
  // 这是一条典型的 “对象 → 二维数组 → 新对象数组” 的数据流水线。
  // Object.entries(regionSum)：把对象 { '华北': 1000, '华东': 2000 } 转换成键值对数组：
  // [ ['华北', 1000], ['华东', 2000] ]。
  // map(([name, value]) => ({ name, value }))：
  // 把二维数组映射成对象数组：[ { name: '华北', value: 1000 }, { name: '华东', value: 2000 } ]。
  const data = Object.entries(regionSum).map(([name, value]) => ({
    name,
    value,
    itemStyle: { color: REGION_COLORS[name] },
  }))

  return {
    title: { text: "各区域 GDP 占比", left: "center", textStyle: { fontSize: 13 } },
    // 在 ECharts 的 formatter 字符串模板中，{a}、{b}、{c}、{d}、{e} 是内置的占位符变量。
    // {a}：系列名称（series name），即图例或图表的标题。
    // {b}：数据项名称（data name），即当前数据项的名称。
    // {c}：数据项数值（data value），即当前数据项的数值。
    // {d}：百分比（percentage），即当前数据项占总数值的百分比。
    // {e}：自定义数据项的额外信息（extra info），通常用于显示额外的标签或信息。
    tooltip: { trigger: "item", formatter: "{b}: {c} 亿元 ({d}%)" },
    series: [
      {
        type: "pie",
        radius: ["30%", "60%"], // 内外半径
        center: ["50%", "55%"], // 圆心位置，这里差不多是垂直居中
        data, // 数据协议中，它硬性规定了：必须用 name 属性表示名称，必须用 value 属性表示数值。
        label: { fontSize: 11 },
      },
    ],
  }
}

/** 散点图：GDP vs 人口 */
function getScatterOption(): echarts.EChartsOption {
  return {
    title: { text: "GDP vs 人口", left: "center", textStyle: { fontSize: 13 }, top: 0 },
    tooltip: {
      trigger: "item",
      // params哪来的？
      // ECharts 内部会在触发 tooltip 时传入一个 params 对象，里面包含了当前悬停的数据项信息。
      formatter: (params: any) => {
        // params.value 是当前悬停的数据项的值数组，结构是 [GDP, 人口, 省份名]。
        const v = params.value || params.data.value
        return `${v[2]}<br/>GDP: ${v[0]} 亿元<br/>人口: ${v[1]} 万人`
      },
    },
    grid: { left: 10, right: 0, top: 20, bottom: 10 },
    xAxis: { type: "value", name: "GDP（亿元）" },
    yAxis: { type: "value", name: "人口（万人）" },
    series: [
      {
        type: "scatter",
        data: provinceData.map((p) => ({
          value: [p.gdp, p.population, p.name],
          itemStyle: {
            color: REGION_COLORS[p.region],
          },
        })),
        symbolSize: 8, // 散点的大小
        emphasis: { itemStyle: { color: "#e74c3c" } },
      },
    ],
  }
}

/** 折线图：Top 7 省份 GDP 逐年趋势 */
function getLineOption(): echarts.EChartsOption {
  const top7 = getTopProvinces(7)
  const years = ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"]

  return {
    title: { text: "Top 7 GDP 趋势", left: "center", textStyle: { fontSize: 13 }, top: 0 },
    tooltip: { trigger: "axis" },
    // 图例会自动读取每个 series 的 name，生成对应的图例项。
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 10, right: 10, top: 10, bottom: 60 },
    xAxis: { type: "category", data: years, axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", name: "亿元" },
    series: top7.map((p) => ({
      name: p.name,
      type: "line",
      data: p.gdpTrend,
      smooth: true,
      emphasis: { focus: "series" },
    })),
  }
}

// ── 省份高亮 ───────────────────────────────────────────────

/** 正常面样式 */
const normalStyle = new Style({
  fill: new Fill({ color: "rgba(52, 152, 219, 0.08)" }),
  stroke: new Stroke({ color: "#2980b9", width: 1.2 }),
})

/** 高亮面样式 */
const highlightStyle = new Style({
  fill: new Fill({ color: "rgba(231, 76, 60, 0.25)" }),
  stroke: new Stroke({ color: "#e74c3c", width: 2.5 }),
})

// 模块级 Select 实例，highlightProvince 和 onMounted 共用
let select: Select

function highlightProvince(name: string) {
  selectedProvince.value = name
  if (chartInstance) renderChart()

  if (!provinceLayer) return
  const features = provinceLayer.getSource().getFeatures()
  const target = features.find((f: any) => f.get("name") === name)
  if (!target) return

  // Select 只操作这一个要素做样式覆盖，不遍历全量
  select!.getFeatures().clear()
  select!.getFeatures().push(target)

  // 缩放到该省份
  map.value?.getView().fit(target.getGeometry().getExtent(), {
    padding: [60, 60, 60, 60],
    duration: 500,
    maxZoom: 8,
  })
}

// ── 生命周期 ───────────────────────────────────────────────

onMounted(async () => {
  const m = map.value!

  // 读取省份数据
  const res = await fetch(publicUrl("test_data/province_border.geojson"))
  const geojson = await res.json()
  const features = new GeoJSON().readFeatures(geojson, {
    featureProjection: "EPSG:3857",
  })

  // 生成模拟数据
  const names = features.map((f: any) => f.get("name"))
  provinceData = generateProvinceData(names)

  // 省份面图层（静态 style，高亮由 Select 负责）
  const source = new VectorSource({ features })
  provinceLayer = new VectorLayer({
    source,
    style: normalStyle,
    zIndex: 5,
  })
  m.addLayer(provinceLayer)

  // Select 交互：只负责渲染高亮样式，不自动响应点击
  // condition: () => false 禁用 Select 的自动选中，全由 highlightProvince 手动控制
  select = new Select({
    layers: [provinceLayer],
    style: highlightStyle,
    condition: () => false, // 禁用 Select 的自动选中，全由 highlightProvince 手动控制
  })
  m.addInteraction(select)

  // 地图点击 → 高亮省份 + 更新图表
  m.on("click", (evt) => {
    m.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
      // 只处理 provinceLayer，排除其他图层（底图、工具图层等）
      if (layer !== provinceLayer) return
      const name = (feature as any).get("name")
      if (name) highlightProvince(name)
    })
  })

  // 鼠标悬停
  m.on("pointermove", (evt) => {
    // hit接收到的是一个布尔值，表示鼠标是否悬停在省份面上
    const hit = m.forEachFeatureAtPixel(evt.pixel, (_, layer) => layer === provinceLayer)
    m.getTargetElement().style.cursor = hit ? "pointer" : ""
  })

  // 初始化图表（等 DOM 渲染）
  await nextTick() // Vue.js 中一个用于等待DOM更新完成的工具函数
  initChart()
})

onUnmounted(() => {
  window.removeEventListener("resize", onResize)
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
}

/* ── 图表面板 ───────────────────────────────────────────── */
.map-controls-right {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.chart-panel {
  display: flex;
  flex-direction: column; /* 纵向排列 */
  height: 320px;
  width: 360px;
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  padding: 8px 8px 4px;
}

.chart-box {
  width: 100%;
  flex: 1; /* 占据剩余所有空间 */
}
</style>
