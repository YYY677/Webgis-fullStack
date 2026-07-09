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
          <el-tabs v-model="activeTab" @tab-change="onTabChange">
            <el-tab-pane label="工作空间" name="workspace" />
            <el-tab-pane label="数据存储" name="datastore" />
            <el-tab-pane label="要素类型" name="featuretype" />
            <el-tab-pane label="图层" name="layer" />
          </el-tabs>

          <!-- 工具栏 -->
          <div class="gs-toolbar">
            <el-button size="small" :icon="Refresh" @click="doRefresh" :loading="loading">刷新</el-button>
            <el-button v-if="activeTab !== 'layer'" size="small" type="primary" :icon="Plus"
              @click="showCreateDialog">创建</el-button>
          </div>

          <!-- ── 工作空间列表 ── -->
          <template v-if="activeTab === 'workspace'">
            <el-table :data="wsList" stripe size="small" max-height="280" style="width: 100%" v-loading="loading"
              empty-text="暂无工作空间">
              <el-table-column prop="name" label="名称" show-overflow-tooltip />
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="info" @click="showWsDetail(row.name)">详情</el-button>
                  <el-button size="small" text type="danger" @click="deleteWs(row.name)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>

          <!-- ── 数据存储列表 ── -->
          <template v-if="activeTab === 'datastore'">
            <div class="gs-cascade">
              <span class="cascade-label">工作空间</span>
              <el-select v-model="selectedWs" size="small" placeholder="选工作空间" style="width: 160px" clearable
                @change="onWsChange">
                <el-option v-for="w in wsList" :key="w.name" :label="w.name" :value="w.name" />
              </el-select>
            </div>
            <el-table :data="tableData" stripe size="small" max-height="220" style="width: 100%" v-loading="loading"
              empty-text="暂无数据存储">
              <el-table-column prop="name" label="名称" show-overflow-tooltip />
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" text type="info" @click="showDsDetail(row.name)">详情</el-button>
                  <el-button size="small" text type="danger" @click="deleteDs(row.name)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>

          <!-- ── 要素类型列表 ── -->
          <template v-if="activeTab === 'featuretype'">
            <div class="gs-cascade" style="margin-bottom: 4px">
              <span class="cascade-label">工作空间</span>
              <el-select v-model="ftWs" size="small" placeholder="选工作空间" style="width: 110px" @change="onFtWsChange">
                <!-- value 绑到 v-model，label 只是下拉框里显示的文字 -->
                <el-option v-for="w in wsList" :key="w.name" :label="w.name" :value="w.name" />
              </el-select>
              <span class="cascade-label" style="margin-left: 6px">数据存储</span>
              <el-select v-model="ftDs" size="small" placeholder="选数据存储" style="width: 110px" @change="loadFt">
                <el-option v-for="d in dsList" :key="d.name" :label="d.name" :value="d.name" />
              </el-select>
              <el-tag v-if="loading" size="small" type="warning" effect="plain" style="margin-left: 6px">加载中...</el-tag>
            </div>
            <el-table :data="ftCombined" stripe size="small" max-height="200" style="width: 100%"
              empty-text="请选择工作空间和数据存储">
              <el-table-column prop="name" label="表名" show-overflow-tooltip width="120" />
              <el-table-column label="状态" width="70">
                <template #default="{ row }">
                  <el-tag :type="row.published ? 'success' : 'info'" size="small">
                    {{ row.published ? "已发布" : "未发布" }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="230" fixed="right">
                <template #default="{ row }">
                  <el-button v-if="row.published" size="small" text type="warning"
                    @click="deleteFt(row.name)">取消发布</el-button>
                  <el-button v-else size="small" text type="primary" @click="publishFt(row.name)">发布</el-button>
                  <el-button size="small" text type="danger" @click="dropFt(row.name, row.published)">删除</el-button>
                  <el-button size="small" text type="info" @click="showFtDetail(row.name, row.published)">详情</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>

          <!-- ── 图层列表 ── -->
          <template v-if="activeTab === 'layer'">
            <div class="gs-cascade">
              <span class="cascade-label">工作空间</span>
              <el-select v-model="selectedWs" size="small" placeholder="全部" clearable style="width: 160px"
                @change="doRefresh">
                <el-option v-for="w in wsList" :key="w.name" :label="w.name" :value="w.name" />
              </el-select>
            </div>
            <el-table :data="tableData" stripe size="small" max-height="240" style="width: 100%" v-loading="loading"
              empty-text="暂无已发布图层">
              <el-table-column prop="name" label="图层名" show-overflow-tooltip />
              <el-table-column label="操作" width="190" fixed="right">
                <template #default="{ row }">
                  <el-button v-if="!addedLayerNames.has(row.name)" size="small" text type="primary"
                    @click="addLayer(row.name)">加载</el-button>
                  <el-button v-else size="small" text type="warning" @click="removeLayer(row.name)">移除</el-button>
                  <el-button size="small" text type="info" @click="showLayerDetail(row.name)">详情</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </div>
      </Transition>
    </div>

    <!-- 右侧控件列 -->
    <div class="map-controls-right">
      <BasemapSwitcher :set-base-layer="setBaseLayer" />
      <BasicToolBox v-if="map" :map="map" />
      <LayerControl v-if="map" :map="map" :layers="layerInfos" />
      <MapSetting v-if="map" :map="map" />
    </div>

    <!-- ── 详情弹窗（通用） ────────────────────────────────── -->
    <el-dialog v-model="detailVisible" :title="detailTitle" width="55%" top="5vh" destroy-on-close>
      <template v-if="detailType === 'datastore' && detailData?.dataStore">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="名称">{{
            detailData.dataStore.name
            }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{
            detailData.dataStore.type
            }}</el-descriptions-item>
          <el-descriptions-item label="启用">{{
            detailData.dataStore.enabled ? "是" : "否"
            }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{
            detailData.dataStore.dateCreated
            }}</el-descriptions-item>
        </el-descriptions>
        <h4 style="margin: 12px 0 6px">连接参数</h4>
        <el-table :data="dsConnParams" stripe size="small" max-height="300">
          <el-table-column prop="key" label="参数名" width="180" />
          <el-table-column prop="value" label="值" show-overflow-tooltip />
        </el-table>
      </template>

      <template v-else-if="detailType === 'featuretype' && detailData?.featureType">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="名称">{{
            detailData.featureType.name
            }}</el-descriptions-item>
          <el-descriptions-item label="数据库表">{{
            detailData.featureType.nativeName
            }}</el-descriptions-item>
          <el-descriptions-item label="坐标系">{{
            detailData.featureType.srs
            }}</el-descriptions-item>
          <el-descriptions-item label="启用">{{
            detailData.featureType.enabled ? "是" : "否"
            }}</el-descriptions-item>
        </el-descriptions>
        <h4 style="margin: 12px 0 6px">字段列表</h4>
        <el-table :data="ftAttributes" stripe size="small" max-height="300">
          <el-table-column prop="name" label="字段名" width="130" />
          <el-table-column prop="binding" label="类型" width="250" />
          <el-table-column prop="nillable" label="可为空">
            <template #default="{ row }">{{
              row.nillable ? "是" : "否"
              }}</template>
          </el-table-column>
        </el-table>
      </template>

      <template v-else-if="detailType === 'layer' && detailData?.layer">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="名称">{{
            detailData.layer.name
            }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{
            detailData.layer.type
            }}</el-descriptions-item>
          <el-descriptions-item label="默认样式">{{
            detailData.layer.defaultStyle?.name
            }}</el-descriptions-item>
          <el-descriptions-item label="数据源">{{
            detailData.layer.resource?.name
            }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{
            detailData.layer.dateCreated
            }}</el-descriptions-item>
          <el-descriptions-item label="修改时间">{{
            detailData.layer.dateModified
            }}</el-descriptions-item>
        </el-descriptions>
      </template>

      <template v-else-if="detailType === 'workspace'">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="名称">{{
            detailWsName
            }}</el-descriptions-item>
          <el-descriptions-item label="说明">工作空间是 GeoServer 资源的命名空间容器</el-descriptions-item>
        </el-descriptions>
      </template>

      <div v-else style="color: #999; text-align: center; padding: 20px">
        暂无详细信息
      </div>
    </el-dialog>

    <!-- ── 创建对话框 ──────────────────────────────────────── -->
    <el-dialog v-model="createVisible" :title="createTitle" width="420px" top="20vh" destroy-on-close>
      <!-- 创建工作空间 -->
      <template v-if="activeTab === 'workspace'">
        <el-form label-width="100px">
          <el-form-item label="名称">
            <el-input v-model="createName" placeholder="字母数字下划线" />
          </el-form-item>
          <el-form-item label="说明">
            <span style="font-size: 13px; color: #999">
              工作空间是资源的命名空间。创建后自动启用 WMS/WFS/WMTS/WCS 服务。
            </span>
          </el-form-item>
        </el-form>
      </template>

      <!-- 创建数据存储 -->
      <template v-if="activeTab === 'datastore'">
        <el-form label-width="100px">
          <el-form-item label="名称">
            <el-input v-model="createName" placeholder="如 pg-webgistest" />
          </el-form-item>
          <el-form-item label="主机">
            <el-input v-model="createHost" placeholder="localhost" />
          </el-form-item>
          <el-form-item label="端口">
            <el-input-number v-model="createPort" :min="1" :max="65535" style="width: 140px" />
          </el-form-item>
          <el-form-item label="数据库名">
            <el-input v-model="createDb" placeholder="webgistest" />
          </el-form-item>
          <el-form-item label="用户名">
            <el-input v-model="createUser" placeholder="postgres" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="createPwd" type="password" placeholder="123456" />
          </el-form-item>
          <el-form-item label="Schema">
            <el-input v-model="createSchema" placeholder="public" />
          </el-form-item>
        </el-form>
      </template>

      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="doCreate" :loading="creating">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- ── 文件上传对话框（FeatureType 创建） ────────────────── -->
    <el-dialog v-model="uploadVisible" title="上传空间数据" width="420px" top="20vh" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="格式">
          <el-radio-group v-model="uploadFormat">
            <el-radio value="shp">Shapefile (.zip)</el-radio>
            <el-radio value="geojson">GeoJSON (.geojson)</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="图层名称">
          <el-input v-model="uploadName" placeholder="字母数字下划线，对应 PostGIS 表名" />
        </el-form-item>
        <el-form-item v-if="uploadFormat === 'shp'" label="文件">
          <input type="file" accept=".zip,.shp,.shx,.dbf,.prj,.sbn,.sbx,.cpg,.xml" multiple @change="onFileSelected" />
          <span style="font-size: 12px; color: #999; margin-left: 8px">
            支持 .zip（含 .shp+.shx+.dbf）或直接多选 .shp+.shx+.dbf 文件
          </span>
        </el-form-item>
        <el-form-item v-if="uploadFormat === 'geojson'" label="文件">
          <input type="file" accept=".geojson,.json" @change="onFileSelected" />
        </el-form-item>
        <el-form-item label="强制坐标系">
          <span style="font-size: 13px; color: #999">EPSG:4326（不匹配将拒绝导入）</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadVisible = false">取消</el-button>
        <el-button type="primary" @click="handleUpload" :loading="uploading" :disabled="uploadFiles.length === 0">
          {{ uploading ? "上传中..." : "确认上传" }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, shallowRef, markRaw, reactive } from "vue";
import { Setting, Refresh, Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useMap } from "@/composables/useMap";
import { BASEMAP_LIST } from "@/utils/basemaps";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { bbox as bboxStrategy } from "ol/loadingstrategy";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import BasemapSwitcher from "@/components/BasemapSwitcher.vue";
import BasicToolBox from "@/components/BasicToolBox.vue";
import LayerControl from "@/components/LayerControl.vue";
import MapSetting from "@/components/MapSetting.vue";
import SearchBox from "@/components/SearchBox.vue";
import {
  getWorkspaces,
  getDataStores,
  getLayers,
  listAllFeatureTypes,
  getFeatureTypes,
  getDataStoreDetail,
  getFeatureTypeDetail,
  getLayerDetail,
  createWorkspace,
  deleteWorkspace,
  createDataStore,
  deleteDataStore,
  publishFeatureType,
  deleteFeatureType,
  dropFeatureType,
  uploadFeatureTypeFile,
  type WorkspaceItem,
  type DataStoreItem,
} from "@/api/geoserver";
import type { LayerInfo } from "@/components/LayerControl.vue";

// ── 地图 ────────────────────────────────────────────────────
const { map, setBaseLayer } = useMap("map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [110, 35],
  view: { zoom: 5, maxZoom: 20, minZoom: 2 },
});
// shallowRef — 只追踪 .value 赋值，不递归代理内部对象。
// LayerControl 需要接收原生的 OL 图层实例，Vue 深度代理会破坏 OL 的内部引用。
const layerInfos = shallowRef<LayerInfo[]>([]);

// ── 面板 ────────────────────────────────────────────────────
const panelOpen = ref(true);
const activeTab = ref("workspace");
const loading = ref(false);
const tableData = ref<any[]>([]);
const wsList = ref<WorkspaceItem[]>([]);
const dsList = ref<DataStoreItem[]>([]);
const selectedWs = ref("");

// reactive(Set) — 跟踪已加载到地图上的 WFS 图层名，用于模板中控制"加载/移除"按钮切换。
// 用 reactive 包装 Set，Vue 能监听到 add/delete 操作。
const addedLayerNames = reactive(new Set<string>());

// ── 要素类型 ─────────────────────────────────────────────────
const ftWs = ref("");
const ftDs = ref("");
const ftPublished = ref<string[]>([]);
const ftAll = ref<string[]>([]);
/** 合并已发布 + 未发布的表名列表，用于统一展示和发布操作 */
const ftCombined = computed(() => {
  const pubSet = new Set(ftPublished.value);
  const items: { name: string; published: boolean }[] = [];
  // 已发布的排前面，带 published: true 标记
  ftPublished.value.forEach((n) => items.push({ name: n, published: true }));
  // 未发布的跟在后面，带 published: false 标记
  ftAll.value.forEach((n) => {
    if (!pubSet.has(n)) items.push({ name: n, published: false });
  });
  return items;
});

// ── 创建弹窗 ─────────────────────────────────────────────────
const createVisible = ref(false);
const creating = ref(false);
const createTitle = computed(() =>
  activeTab.value === "workspace" ? "创建工作空间" : "创建数据存储",
);
const createName = ref("");
const createHost = ref("localhost");
const createPort = ref(5432);
const createDb = ref("webgistest");
const createUser = ref("postgres");
const createPwd = ref("123456");
const createSchema = ref("public");

// ── 详情弹窗 ─────────────────────────────────────────────────
const detailVisible = ref(false);
const detailTitle = ref("");
const detailType = ref("");
const detailData = ref<any>(null);
const detailWsName = ref("");

// ── WFS 样式 ─────────────────────────────────────────────────
const wfsStyle = new Style({
  stroke: new Stroke({ color: "#3388ff", width: 1.5 }),
  fill: new Fill({ color: "rgba(51, 136, 255, 0.12)" }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "#3388ff" }),
    stroke: new Stroke({ color: "#fff", width: 2 }),
  }),
});

// ── 文件上传 ─────────────────────────────────────────────────
const uploadVisible = ref(false);
const uploadFormat = ref("shp");
const uploadName = ref("");
const uploadFiles = ref<File[]>([]);
const uploading = ref(false);

function showUploadDialog() {
  uploadFormat.value = "shp";
  uploadName.value = "";
  uploadFiles.value = [];
  uploadVisible.value = true;
}

async function handleUpload() {
  if (!uploadName.value) {
    ElMessage.warning("请输入图层名称");
    return;
  }
  if (uploadFiles.value.length === 0) {
    ElMessage.warning("请选择文件");
    return;
  }
  if (!ftWs.value || !ftDs.value) {
    ElMessage.warning("请先选择工作空间和数据存储");
    return;
  }

  uploading.value = true;
  try {
    const res = await uploadFeatureTypeFile(
      ftWs.value,
      ftDs.value,
      uploadName.value,
      uploadFormat.value,
      uploadFiles.value,
    );
    ElMessage.success(res.data || "上传成功");
    uploadVisible.value = false;
    loadFt();
  } catch (e: any) {
    ElMessage.error(e.message || "上传失败");
  } finally {
    uploading.value = false;
  }
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  // uploadFiles.value 里存的是文件的元数据描述和底层内容流的引用。
  if (input.files) uploadFiles.value = Array.from(input.files); 
}

// ── 详情弹窗数据计算 ─────────────────────────────────────────
// dataStore.connectionParameters.entry 是一个数组，每个元素是一个对象，包含 @key 和 $ 两个属性。如：
// 0: {@key: 'schema', $: 'public'}
// 1: {@key: 'Evictor run periodicity', $: '300'}
// 2: {@key: 'Max open prepared statements', $: '50'}
// 3: {@key: 'encode functions', $: 'true'}
const dsConnParams = computed(() => {
  const store = detailData.value?.dataStore;
  if (!store?.connectionParameters?.entry) return [];
  return store.connectionParameters.entry.map((e: any) => ({
    key: e["@key"],
    value: e["$"],
  }));
});

const ftAttributes = computed(() => {
  const ft = detailData.value?.featureType;
  if (!ft?.attributes?.attribute) return [];
  return ft.attributes.attribute.map((a: any) => ({
    name: a.name,
    binding: a.binding,
    nillable: a.nillable,
  }));
});

// ══════════════════════════════════════════════════════════════
// 显示创建弹窗
// ══════════════════════════════════════════════════════════════
function showCreateDialog() {
  if (activeTab.value === "featuretype") {
    showUploadDialog();
    return;
  }
  createName.value = "";
  createVisible.value = true;
}

// ══════════════════════════════════════════════════════════════
// 创建 (Workspace / DataStore)
// ══════════════════════════════════════════════════════════════
async function doCreate() {
  if (!createName.value) {
    ElMessage.warning("名称不能为空");
    return;
  }
  creating.value = true;
  try {
    if (activeTab.value === "workspace") {
      await createWorkspace(createName.value);
      ElMessage.success(`工作空间 ${createName.value} 已创建`);
    } else if (activeTab.value === "datastore") {
      if (!selectedWs.value) {
        ElMessage.warning("请先选择工作空间");
        return;
      }
      await createDataStore({
        workspace: selectedWs.value,
        name: createName.value,
        host: createHost.value || "localhost",
        port: createPort.value,
        database: createDb.value || "webgistest",
        user: createUser.value || "postgres",
        password: createPwd.value,
        schema: createSchema.value || "public",
      });
      ElMessage.success(`数据存储 ${createName.value} 已创建`);
    }
    createVisible.value = false;
    doRefresh();
  } catch (e: any) {
    ElMessage.error(e.message || "创建失败");
  } finally {
    creating.value = false;
  }
}

// ══════════════════════════════════════════════════════════════
// 详情展示
// ══════════════════════════════════════════════════════════════

async function showWsDetail(name: string) {
  detailWsName.value = name;
  detailType.value = "workspace";
  detailData.value = null;
  detailTitle.value = `工作空间 — ${name}`;
  detailVisible.value = true;
}

async function showDsDetail(name: string) {
  detailType.value = "datastore";
  detailTitle.value = `数据存储 — ${name}`;
  detailData.value = null;
  detailVisible.value = true;
  try {
    const res = await getDataStoreDetail(selectedWs.value, name);
    console.log("getDataStoreDetail的返回值:", res);
    detailData.value = res.data;
  } catch {
    /* */
  }
}

async function showFtDetail(name: string, published: boolean) {
  detailType.value = "featuretype";
  detailTitle.value = `要素类型 — ${name}`;
  detailData.value = null;
  detailVisible.value = true;
  if (published) {
    try {
      const res = await getFeatureTypeDetail(ftWs.value, ftDs.value, name);
      console.log("getFeatureTypeDetail的返回值:", res);
      detailData.value = res.data;
    } catch {
      /* */
    }
  }
}

async function showLayerDetail(name: string) {
  detailType.value = "layer";
  detailTitle.value = `图层 — ${name}`;
  detailData.value = null;
  detailVisible.value = true;
  try {
    const res = await getLayerDetail(name);
    console.log("getLayerDetail的返回值:", res);
    detailData.value = res.data;
  } catch {
    /* */
  }
}

// ══════════════════════════════════════════════════════════════
// 删除操作
// ══════════════════════════════════════════════════════════════

async function deleteWs(name: string) {
  // 二次确认：第一次 confirm，第二次 prompt 输入工作空间名
  try {
    await ElMessageBox.confirm(
      `确定要删除工作空间「${name}」吗？\n此操作将同时删除其下的所有数据存储、要素类型和图层。`,
      "确认删除",
      { confirmButtonText: "继续", cancelButtonText: "取消", type: "warning" },
    );
    const { value } = await ElMessageBox.prompt(
      `请输入工作空间名称「${name}」以确认删除：`,
      "二次确认",
      {
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
        inputPattern: new RegExp(`^${name}$`),
        inputErrorMessage: `输入必须与 "${name}" 完全一致`,
      },
    );
    if (value) {
      await deleteWorkspace(name);
      ElMessage.success(`工作空间 ${name} 已删除`);
      doRefresh();
    }
  } catch {
    /* */
  }
}

async function deleteDs(name: string) {
  if (!selectedWs.value) return;
  try {
    await ElMessageBox.confirm(
      `确定要删除数据存储「${name}」吗？\n其下的要素类型将同时被删除。`,
      "确认删除",
      { confirmButtonText: "继续", cancelButtonText: "取消", type: "warning" },
    );
    const { value } = await ElMessageBox.prompt(
      `请输入数据存储名称「${name}」以确认删除：`,
      "二次确认",
      {
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
        inputPattern: new RegExp(`^${name}$`),
        inputErrorMessage: `输入必须与 "${name}" 完全一致`,
      },
    );
    if (value) {
      await deleteDataStore(selectedWs.value, name);
      ElMessage.success(`数据存储 ${name} 已删除`);
      doRefresh();
    }
  } catch {
    /* */
  }
}

/** 取消发布：从 GeoServer 移除，保留数据库表 */
async function deleteFt(name: string) {
  try {
    await ElMessageBox.confirm(
      `确定要取消发布「${name}」吗？\n该操作仅从 GeoServer 移除图层，数据库表保留不变。`,
      "取消发布",
      { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" },
    );
    await deleteFeatureType(ftWs.value, ftDs.value, name);
    ElMessage.success(`${name} 已取消发布`);
    loadFt();
  } catch {
    /* */
  }
}

/** 彻底删除：DROP TABLE + 从 GeoServer 移除 */
async function dropFt(name: string, published: boolean) {
  const publishHint = published
    ? "此操作将删除数据库表及 GeoServer 发布记录，数据不可恢复！"
    : "此操作将删除数据库表，数据不可恢复！";
  try {
    await ElMessageBox.confirm(
      `确定要彻底删除「${name}」吗？\n${publishHint}`,
      "确认删除",
      { confirmButtonText: "继续", cancelButtonText: "取消", type: "error" },
    );
    const { value } = await ElMessageBox.prompt(
      `请输入表名「${name}」以确认删除：`,
      "二次确认",
      {
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
        inputPattern: new RegExp(`^${name}$`),
        inputErrorMessage: `输入必须与 "${name}" 完全一致`,
      },
    );
    if (value) {
      await dropFeatureType(ftWs.value, ftDs.value, name);
      ElMessage.success(`${name} 已彻底删除`);
      loadFt();
    }
  } catch {
    /* */
  }
}

async function publishFt(tableName: string) {
  try {
    await ElMessageBox.confirm(
      `确定要发布「${tableName}」为要素类型 + 图层吗？`,
      "确认发布",
      { confirmButtonText: "发布", cancelButtonText: "取消", type: "info" },
    );
    await publishFeatureType(ftWs.value, ftDs.value, tableName);
    ElMessage.success(`${tableName} 已发布`);
    loadFt();
  } catch {
    /* */
  }
}

// ══════════════════════════════════════════════════════════════
// WFS 加载/移除图层（不变）
// ══════════════════════════════════════════════════════════════

function addLayer(layerFullName: string) {
  const m = map.value;
  if (!m || addedLayerNames.has(layerFullName)) return;
  const source = new VectorSource({
    format: new GeoJSON({
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    }),
    url: (extent: any) =>
      `/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature` +
      `&typeName=${layerFullName}&outputFormat=application/json` +
      `&srsname=EPSG:3857&bbox=${extent.join(",")},EPSG:3857`,
    strategy: bboxStrategy,
  });
  // markRaw — 阻止 Vue 对 OL 图层对象做 Proxy 代理。
  // Vue 的响应式代理会破坏 OL 内部的事件系统和引用对比（如 map.removeLayer 按引用查找）。
  const wfsLayer = markRaw(new VectorLayer({ source, style: wfsStyle }));
  m.addLayer(wfsLayer);
  addedLayerNames.add(layerFullName);
  // layerInfos 是 shallowRef，必须整体替换数组才能触发响应式更新，不能 push。
  // LayerControl 通过这个数组知道哪些图层在地图上、以及它的 OL 实例引用。
  layerInfos.value = [
    ...layerInfos.value,
    { id: `gs-${layerFullName}`, name: layerFullName, layer: wfsLayer as any },
  ];
  ElMessage.success(`${layerFullName} 已加载`);
}

function removeLayer(layerFullName: string) {
  const m = map.value;
  if (!m || !addedLayerNames.has(layerFullName)) return;
  const found = layerInfos.value.find((l) => l.id === `gs-${layerFullName}`);
  if (found) m.removeLayer(found.layer as any);
  addedLayerNames.delete(layerFullName);
  // 同样整体替换数组触发 shallowRef 更新
  layerInfos.value = layerInfos.value.filter(
    (l) => l.id !== `gs-${layerFullName}`,
  );
  ElMessage.success(`${layerFullName} 已移除`);
}

// ══════════════════════════════════════════════════════════════
// 数据加载
// ══════════════════════════════════════════════════════════════

onMounted(async () => {
  try {
    const res = await getWorkspaces();
    console.log("getWorkspaces的结果", res);
    wsList.value = res.data ?? [];
  } catch {
    // catch捕获request传出的Promise.reject(xxx)
    // 但拦截器已经 ElMessage.error 弹过提示了，catch 空着也行
  }
  // 优先选 webgistest 工作空间，不存在则取第一个
  const tgt =
    wsList.value.find((w) => w.name === "webgistest") ?? wsList.value[0];
  if (tgt) selectedWs.value = tgt.name;

  // 切到图层 Tab 再刷新，自动加载第一个图层
  activeTab.value = "layer";
  await doRefresh(); // 刷新图层列表
  // 初始加载时，如果当前在图层标签页且有数据，则加载第一个图层
  if (activeTab.value === "layer" && tableData.value.length > 0) {
    console.log("初始加载时，当前工作空间的图层", tableData.value);
    addLayer(tableData.value[0].name); // name: 'webgistest:Borough_London'
  }
});

// 刷新数据
async function doRefresh() {
  loading.value = true;
  try {
    switch (activeTab.value) {
      case "workspace": {
        const res = await getWorkspaces();
        wsList.value = res.data ?? [];
        tableData.value = res.data ?? [];
        break;
      }
      case "datastore": {
        if (!selectedWs.value) {
          tableData.value = [];
          break;
        }
        const res = await getDataStores(selectedWs.value);
        dsList.value = res.data ?? [];
        tableData.value = res.data ?? [];
        break;
      }
      case "featuretype": {
        if (ftWs.value && ftDs.value) await loadFt();
        break;
      }
      case "layer": {
        // 获取当前工作空间下的所有图层列表，若未选工作空间则获取全部图层
        const res = await getLayers(selectedWs.value || undefined);
        tableData.value = res.data ?? [];
        break;
      }
    }
  } catch {
    tableData.value = [];
  } finally {
    loading.value = false;
  }
}

function onTabChange() {
  doRefresh();
}

async function onWsChange() {
  dsList.value = [];
  if (selectedWs.value) {
    try {
      const res = await getDataStores(selectedWs.value);
      dsList.value = res.data ?? [];
    } catch {
      dsList.value = [];
    }
  }
  doRefresh();
}

// ── FeatureType 级联 ─────────────────────────────────────────
// onFtWsChange表示工作空间选择变化时，清空数据存储和要素类型列表，并重新获取数据存储列表。
async function onFtWsChange() {
  ftDs.value = "";
  ftAll.value = [];
  ftPublished.value = [];
  if (ftWs.value) {
    try {
      const res = await getDataStores(ftWs.value);
      dsList.value = res.data ?? [];
    } catch {
      dsList.value = [];
    }
  }
}
// loadFt函数用于加载要素类型列表。它会根据当前选择的工作空间和数据存储，
// 获取所有要素类型和已发布的要素类型，并将结果存储在 ftAll 和 ftPublished 中。
// 如果没有选择工作空间或数据存储，则清空要素类型列表。
async function loadFt() {
  if (!ftWs.value || !ftDs.value) {
    ftAll.value = [];
    ftPublished.value = [];
    return;
  }
  loading.value = true;
  try {
    const [allRes, pubRes] = await Promise.all([
      listAllFeatureTypes(ftWs.value, ftDs.value),
      getFeatureTypes(ftWs.value, ftDs.value),
    ]);
    console.log("listAllFeatureTypes的结果", allRes); 
    console.log("getFeatureTypes的结果", pubRes);
    ftAll.value = allRes.data ?? []; //['Borough_London', 'capital', ...]
    ftPublished.value = (pubRes.data ?? []).map((f: any) => f.name);  //[{name: 'Borough_London', ...}, {name: 'capital', ...}, ...]
  } catch {
    ftAll.value = [];
    ftPublished.value = [];
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped lang="scss">
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.gs-manager {
  position: absolute;
  top: 12px;
  left: 370px;
  z-index: 10;
}

.gs-panel {
  position: absolute;
  left: 0;
  top: 40px;
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(80px);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  width: 450px;
  box-shadow: var(--el-box-shadow-light);
  padding: 0 12px 12px;
}

.gs-toolbar {
  display: flex;
  gap: 6px;
  margin: 6px 0 8px;
}

.gs-cascade {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  margin-bottom: 6px;

  .cascade-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }
}

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

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
