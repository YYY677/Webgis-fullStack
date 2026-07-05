<template>
  <div id="map" class="map-container">
    <SearchBox v-if="map" :map="map" />

    <!-- GeoServer 管理 -->
    <div class="gs-manager">
      <el-button :icon="Setting" @click="panelOpen = !panelOpen" :type="panelOpen ? 'primary' : 'default'">
        GeoServer 管理
      </el-button>

      <Transition name="fade">
        <div v-if="panelOpen" class="gs-panel">
          <el-tabs v-model="activeTab" class="gs-tabs" @tab-change="onTabChange">
            <el-tab-pane label="工作空间" name="workspace" />
            <el-tab-pane label="数据存储" name="datastore" />
            <el-tab-pane label="要素类型" name="featuretype" />
            <el-tab-pane label="图层" name="layer" />
          </el-tabs>

          <div class="gs-mode-hint" v-if="activeTab === 'featuretype'">
            数据源层：数据库中的空间表，可点击"发布"变成地图图层
          </div>
          <div class="gs-mode-hint" v-else-if="activeTab === 'layer'">
            使用 WFS 矢量服务加载，支持属性表查询
          </div>

          <div class="gs-toolbar">
            <el-button size="small" :icon="Refresh" @click="doRefresh" :loading="loading">刷新</el-button>
            <el-button v-if="activeTab !== 'featuretype'" size="small" type="primary" :icon="Plus"
              @click="doCreate">{{ activeTab === 'layer' ? '发布' : '创建' }}</el-button>
          </div>

          <!-- 列表 -->
          <el-table :data="tableData" stripe size="small" max-height="240" style="width: 100%"
            v-loading="loading" empty-text="暂无数据">
            <el-table-column prop="name" label="名称" show-overflow-tooltip />
            <el-table-column v-if="activeTab === 'layer'" label="操作" width="130" fixed="right">
              <template #default="{ row }">
                <el-button v-if="!addedLayerNames.has(row.name)" size="small" text type="primary"
                  @click="addLayer(row.name)">加载</el-button>
                <el-button v-else size="small" text type="danger"
                  @click="removeLayer(row.name)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- 级联选择器 -->
          <div v-if="activeTab !== 'workspace'" class="gs-cascade">
            <div class="cascade-row">
              <span class="cascade-label">工作空间</span>
              <el-select v-model="selectedWs" size="small" placeholder="选工作空间" style="width: 140px"
                clearable @change="onWsChange">
                <el-option v-for="w in wsList" :key="w.name" :label="w.name" :value="w.name" />
              </el-select>
            </div>
            <div class="cascade-row" v-if="activeTab === 'featuretype'">
              <span class="cascade-label">数据存储</span>
              <el-select v-model="selectedDs" size="small" placeholder="选数据存储" style="width: 140px" @change="doRefresh">
                <el-option v-for="d in dsList" :key="d.name" :label="d.name" :value="d.name" />
              </el-select>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <div class="map-controls-right">
      <BasemapSwitcher :set-base-layer="setBaseLayer" />
      <BasicToolBox v-if="map" :map="map" />
      <LayerControl v-if="map" :map="map" :layers="layerInfos" />
      <MapSetting v-if="map" :map="map" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, shallowRef, markRaw, reactive } from "vue"
import { Setting, Refresh, Plus } from "@element-plus/icons-vue"
import { ElMessage, ElMessageBox } from "element-plus"
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import GeoJSON from "ol/format/GeoJSON"
import { bbox as bboxStrategy } from "ol/loadingstrategy"
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"
import BasicToolBox from "@/components/BasicToolBox.vue"
import LayerControl from "@/components/LayerControl.vue"
import MapSetting from "@/components/MapSetting.vue"
import SearchBox from "@/components/SearchBox.vue"
import {
  getWorkspaces, getDataStores, getFeatureTypes, getLayers,
  createWorkspace, createDataStore, publishLayer,
  type WorkspaceItem, type DataStoreItem, type FeatureTypeItem
} from "@/api/geoserver"
import type { LayerInfo } from "@/components/LayerControl.vue"

// ── 地图 ────────────────────────────────────────────────────
const { map, setBaseLayer } = useMap("map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [110, 35],
  view: { zoom: 5, maxZoom: 20, minZoom: 2 }
})
const layerInfos = shallowRef<LayerInfo[]>([])

// ── 面板 ────────────────────────────────────────────────────
const panelOpen = ref(true)
const activeTab = ref("layer")
const loading = ref(false)
const tableData = ref<any[]>([])

const wsList = ref<WorkspaceItem[]>([])
const dsList = ref<DataStoreItem[]>([])
const selectedWs = ref("")
const selectedDs = ref("")

/**
 * 追踪已添加图层：
 *   - `addedLayerNames`: 纯 Set，只存图层名（用于按钮切换）
 *   - `addedLayerNames` 是 reactive, 模板能自动更新
 *   - OL Layer 引用不放进 Vue 响应式系统，避免被 proxy 导致引用失效
 */
const addedLayerNames = reactive(new Set<string>())

/** WFS 默认样式 */
const wfsStyle = new Style({
  stroke: new Stroke({ color: "#3388ff", width: 1.5 }),
  fill: new Fill({ color: "rgba(51, 136, 255, 0.12)" }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "#3388ff" }),
    stroke: new Stroke({ color: "#fff", width: 2 }),
  }),
})

// ── 添加/移除图层 ──────────────────────────────────────────

/**
 * 通过 WFS 加载图层（不是 WMS 瓦片），
 * VectorSource 有 getFeatures()，属性表能正常工作。
 * 图层名格式: workspace:featureType，如 "webgistest:port"
 */
function addLayer(layerFullName: string) {
  const m = map.value
  if (!m || addedLayerNames.has(layerFullName)) return

  const wfsSource = new VectorSource({
    format: new GeoJSON({
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    }),
    url: (extent: any) =>
      `/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature`
      + `&typeName=${layerFullName}`
      + `&outputFormat=application/json`
      + `&srsname=EPSG:3857`
      + `&bbox=${extent.join(",")},EPSG:3857`,
    strategy: bboxStrategy,
  })

  const wfsLayer = new VectorLayer({
    source: wfsSource,
    style: wfsStyle,
  })
  // markRaw 阻止 Vue 对 OL 对象做 proxy，保证 removeLayer 时引用一致
  markRaw(wfsLayer)

  m.addLayer(wfsLayer)
  addedLayerNames.add(layerFullName)

  layerInfos.value = [
    ...layerInfos.value,
    { id: `gs-${layerFullName}`, name: layerFullName, layer: wfsLayer as any },
  ]

  ElMessage.success(`${layerFullName} 已加载`)
}

function removeLayer(layerFullName: string) {
  const m = map.value
  if (!m || !addedLayerNames.has(layerFullName)) return

  // 从 layerInfos 中找到对应 OL layer 引用，从地图移除
  const found = layerInfos.value.find(l => l.id === `gs-${layerFullName}`)
  if (found) {
    m.removeLayer(found.layer as any)
  }

  addedLayerNames.delete(layerFullName)
  layerInfos.value = layerInfos.value.filter(l => l.id !== `gs-${layerFullName}`)

  ElMessage.success(`${layerFullName} 已移除`)
}

// ── 启动 ────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const res = await getWorkspaces()
    wsList.value = res.data ?? []
  } catch { /* */ }

  const tgt = wsList.value.find(w => w.name === "webgistest")
    ?? (wsList.value.length > 0 ? wsList.value[0] : null)
  if (tgt) selectedWs.value = tgt.name

  await doRefresh()
  if (activeTab.value === "layer" && tableData.value.length > 0) {
    addLayer(tableData.value[0].name)
  }
})

// ── 刷新 ────────────────────────────────────────────────────
async function doRefresh() {
  loading.value = true
  try {
    switch (activeTab.value) {
      case "workspace": {
        const res = await getWorkspaces()
        wsList.value = res.data ?? []
        tableData.value = res.data ?? []
        break
      }
      case "datastore": {
        if (!selectedWs.value) { tableData.value = []; break }
        const res = await getDataStores(selectedWs.value)
        dsList.value = res.data ?? []
        tableData.value = res.data ?? []
        break
      }
      case "featuretype": {
        if (!selectedWs.value || !selectedDs.value) { tableData.value = []; break }
        const res = await getFeatureTypes(selectedWs.value, selectedDs.value)
        tableData.value = res.data ?? []
        break
      }
      case "layer": {
        const res = await getLayers(selectedWs.value || undefined)
        tableData.value = res.data ?? []
        break
      }
    }
  } catch {
    tableData.value = []
  } finally {
    loading.value = false
  }
}

function onTabChange() { doRefresh() }

async function onWsChange() {
  if (selectedWs.value) {
    try { const res = await getDataStores(selectedWs.value); dsList.value = res.data ?? [] }
    catch { dsList.value = [] }
  }
  doRefresh()
}

// ── 创建 / 发布 ──────────────────────────────────────────────
async function doCreate() {
  switch (activeTab.value) {
    case "workspace": return createWs()
    case "datastore": return createDs()
    case "layer": return doPublish()
  }
}

async function createWs() {
  try {
    const { value: name } = await ElMessageBox.prompt("请输入工作空间名称", "创建工作空间", {
      confirmButtonText: "创建", cancelButtonText: "取消",
      inputPattern: /^\w+$/, inputErrorMessage: "仅支持字母、数字、下划线",
    })
    if (name) { await createWorkspace(name); ElMessage.success(`工作空间 ${name} 已创建`); doRefresh() }
  } catch { /* */ }
}

async function createDs() {
  if (!selectedWs.value) { ElMessage.warning("请先选择工作空间"); return }
  try {
    const { value: name } = await ElMessageBox.prompt("请输入数据存储名称", "创建 PostGIS 数据存储", {
      confirmButtonText: "创建", cancelButtonText: "取消",
      inputPattern: /^\w+$/, inputErrorMessage: "仅支持字母、数字、下划线",
    })
    if (!name) return
    await createDataStore({
      workspace: selectedWs.value, name,
      host: "localhost", port: 5432, database: "webgistest",
      user: "postgres", password: "123456", schema: "public",
    })
    ElMessage.success(`数据存储 ${name} 已创建`); doRefresh()
  } catch { /* */ }
}

async function doPublish() {
  if (!selectedWs.value || !selectedDs.value) {
    ElMessage.warning("请先选择工作空间和数据存储"); return
  }
  loading.value = true
  let ftList: FeatureTypeItem[] = []
  try { const res = await getFeatureTypes(selectedWs.value, selectedDs.value); ftList = res.data ?? [] }
  catch { ftList = [] }
  loading.value = false
  if (ftList.length === 0) { ElMessage.warning("当前数据存储下没有要素类型"); return }

  try {
    const { value: name } = await ElMessageBox.prompt(
      `可用: ${ftList.map(f => f.name).join("、")}`,
      "发布图层（输入要素类型名称）",
      { confirmButtonText: "发布", cancelButtonText: "取消" }
    )
    if (!name) return
    if (!ftList.find(f => f.name === name)) { ElMessage.warning(`${name} 不在列表中`); return }
    await publishLayer({ workspace: selectedWs.value, datastore: selectedDs.value, featureType: name })
    ElMessage.success(`图层 ${selectedWs.value}:${name} 已发布`); doRefresh()
  } catch { /* */ }
}
</script>

<style scoped lang="scss">
.map-container { position: relative; width: 100%; height: 100%; }

.gs-manager { position: absolute; top: 12px; left: 370px; z-index: 10; }

.gs-panel {
  position: absolute; left: 0; top: 40px;
  background: var(--el-bg-color-overlay); backdrop-filter: blur(80px);
  border: 1px solid var(--el-border-color-light); border-radius: 8px;
  width: 420px; box-shadow: var(--el-box-shadow-light); padding: 0 12px 12px;
}

.gs-mode-hint {
  font-size: 12px; color: var(--el-color-primary);
  background: var(--el-color-primary-light-9); padding: 4px 8px; border-radius: 4px;
  margin-bottom: 6px;
}

.gs-toolbar { display: flex; gap: 6px; margin-bottom: 8px; }

.gs-cascade {
  margin-top: 8px; padding: 8px;
  background: var(--el-fill-color-light); border-radius: 4px;
}
.cascade-row {
  display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
  &:last-child { margin-bottom: 0; }
  .cascade-label { font-size: 12px; color: var(--el-text-color-secondary); min-width: 56px; }
}

.map-controls-right {
  position: absolute; top: 12px; right: 12px; z-index: 10;
  display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-20px); }
</style>
