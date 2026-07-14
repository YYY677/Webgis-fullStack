<template>
  <div class="style-manager">
    <el-button :icon="Setting" @click="panelOpen = !panelOpen" :type="panelOpen ? 'primary' : 'default'">
      样式管理
    </el-button>

    <Transition name="fade">
      <div v-if="panelOpen" class="sm-panel">
        <div class="sm-header">样式管理</div>

        <!-- 工具栏 -->
        <div class="sm-toolbar">
          <el-button size="small" :icon="Refresh" @click="loadStyles" :loading="loading">刷新</el-button>
          <el-button size="small" type="primary" :icon="Plus" @click="showCreate">新建样式</el-button>
        </div>

        <!-- 样式列表 -->
        <el-table :data="styleList" stripe size="small" max-height="260" style="width: 100%" v-loading="loading"
          empty-text="暂无样式" @row-click="onRowClick">
          <el-table-column prop="name" label="名称" show-overflow-tooltip />
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button size="small" text type="primary" @click.stop="editStyle(row.name)">编辑</el-button>
              <el-button size="small" text type="primary" @click.stop="assignStyle(row.name)">应用</el-button>
              <el-button size="small" text type="danger" @click.stop="removeStyle(row.name)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </Transition>

    <!-- ── 编辑弹窗 ──────────────────────────────────────── -->
    <el-dialog v-model="editVisible" :title="'编辑样式 — ' + editingName" width="600px" top="5vh" destroy-on-close>
      <el-tabs v-model="editTab">
        <!-- 表单编辑 Tab — 读取 SLD → MapStyle 表单 -->
        <el-tab-pane label="表单编辑" name="form">
          <!-- 加载提示 -->
          <div v-if="styleLoading" style="text-align: center; padding: 40px; color: #999">解析中...</div>
          <div v-else-if="!editingValue.length" style="text-align: center; padding: 40px; color: #999">
            无法解析样式参数，请在「SLD 源码」Tab 中手动编辑
          </div>

          <div v-else class="edit-layout">
            <!-- 左侧：表单 -->
            <div class="edit-form">
              <!-- 样式名称 + 描述 -->
              <div class="meta-fields">
                <div class="desc-field">
                  <span class="desc-label">名称</span>
                  <el-input v-model="editingNewName" placeholder="样式名" size="small" style="width: 140px" />
                </div>
                <div class="desc-field">
                  <span class="desc-label">描述</span>
                  <el-input v-model="editingDescription" placeholder="样式的描述信息" type="textarea" :rows="2" size="small" style="width: 100%" />
                </div>
              </div>

              <!-- Rule 选择器 -->
              <div class="rule-selector">
                <span class="rule-label">Rule：</span>
                <el-radio-group v-model="currentRuleIdx" size="small" style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; width: 100%">
                  <el-radio-button v-for="(r, i) in editingValue" :key="i" :value="i">
                    {{ r.legendTitle || r.name }}（{{ r.geomType === 'POLYGON' ? '面' : r.geomType === 'LINE' ? '线' : r.geomType === 'RASTER' ? '栅格' : '点' }}）
                  </el-radio-button>
                </el-radio-group>
              </div>

              <!-- 表单区域 -->
              <el-form v-if="currentRule" label-width="80px" size="small" class="style-form">
                <!-- 图例标题 -->
                <el-form-item label="图例名称">
                  <el-input v-model="currentRule.legendTitle" placeholder="显示在图例中的名称" style="width: 180px" />
                </el-form-item>

                <!-- 面参数 -->
                <template v-if="currentRule.geomType === 'POLYGON'">
                  <el-form-item label="填充色">
                    <el-input v-model="currentRule.fillcolor" placeholder="#AAAAAA" style="width: 120px" />
                    <el-color-picker v-model="currentRule.fillcolor" size="small" style="margin-left: 6px" />
                  </el-form-item>
                  <el-form-item label="填充透明度"><el-slider v-model="fillOpacityNum" :min="0" :max="1" :step="0.1" style="width: 180px" /></el-form-item>
                  <el-form-item label="边框色">
                    <el-input v-model="currentRule.bordercolor" placeholder="#000000" style="width: 120px" />
                    <el-color-picker v-model="currentRule.bordercolor" clearable size="small" style="margin-left: 6px" />
                  </el-form-item>
                  <el-form-item label="边框宽"><el-slider v-model="borderWidthNum" :min="1" :max="5" :step="0.5" style="width: 180px" /></el-form-item>
                  <el-form-item label="边框透明度"><el-slider v-model="borderOpacityNum" :min="0" :max="1" :step="0.1" style="width: 180px" /></el-form-item>
                  <el-form-item label="虚线">
                    <el-input v-model="currentRule.dash" placeholder="如 5 2" style="width: 120px" />
                    <span style="font-size:11px;color:#999;margin-left:6px">实线长 间隔长，空格分隔</span>
                  </el-form-item>
                </template>

                <!-- 线参数 -->
                <template v-if="currentRule.geomType === 'LINE'">
                  <el-form-item label="线条色">
                    <el-input v-model="currentRule.bordercolor" placeholder="#0000FF" style="width: 120px" />
                    <el-color-picker v-model="currentRule.bordercolor" clearable size="small" style="margin-left: 6px" />
                  </el-form-item>
                  <el-form-item label="线宽"><el-slider v-model="borderWidthNum" :min="1" :max="10" :step="0.5" style="width: 180px" /></el-form-item>
                  <el-form-item label="透明度"><el-slider v-model="borderOpacityNum" :min="0" :max="1" :step="0.1" style="width: 180px" /></el-form-item>
                  <el-form-item label="虚线">
                    <el-input v-model="currentRule.dash" placeholder="如 5 2" style="width: 120px" />
                    <span style="font-size:11px;color:#999;margin-left:6px">实线长 间隔长，空格分隔</span>
                  </el-form-item>
                </template>

                <!-- 点参数 -->
                <template v-if="currentRule.geomType === 'POINT'">
                  <el-form-item label="形状">
                    <el-select v-model="currentRule.markname" placeholder="默认为方形" style="width: 130px">
                      <el-option value="circle" label="圆形" /><el-option value="square" label="方形" />
                      <el-option value="triangle" label="三角" /><el-option value="star" label="星形" />
                      <el-option value="cross" label="十字" /><el-option value="x" label="X" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="大小"><el-slider v-model="sizeNum" :min="3" :max="30" :step="1" style="width: 180px" /></el-form-item>
                  <el-form-item label="填充色">
                    <el-input v-model="currentRule.fillcolor" placeholder="#FF0000" style="width: 120px" />
                    <el-color-picker v-model="currentRule.fillcolor" size="small" style="margin-left: 6px" />
                  </el-form-item>
                  <el-form-item label="边框色">
                    <el-input v-model="currentRule.bordercolor" placeholder="#000000" style="width: 120px" />
                    <el-color-picker v-model="currentRule.bordercolor" clearable size="small" style="margin-left: 6px" />
                  </el-form-item>
                  <el-form-item label="边框宽"><el-slider v-model="borderWidthNum" :min="0" :max="5" :step="0.5" style="width: 180px" /></el-form-item>
                  <el-form-item label="旋转角度"><el-slider v-model="rotationNum" :min="0" :max="360" :step="1" style="width: 180px" /></el-form-item>
                </template>

                <!-- 栅格参数 -->
                <template v-if="currentRule.geomType === 'RASTER'">
                  <el-form-item label="透明度"><el-slider v-model="rasterOpacityNum" :min="0" :max="1" :step="0.1" style="width: 180px" /></el-form-item>

                  <el-divider style="margin: 8px 0" />
                  <div class="cm-title">ColorMap 颜色分级</div>

                  <div class="cm-table">
                    <div class="cm-header-row">
                      <span class="cm-col-color">颜色</span>
                      <span class="cm-col-qty">数值</span>
                      <span class="cm-col-label">图例</span>
                      <span class="cm-col-act" style="width:28px"></span>
                    </div>
                    <div v-for="(entry, ci) in currentRule.colorMapEntries" :key="ci" class="cm-row">
                      <el-color-picker v-model="entry.color" size="small" class="cm-col-color" show-alpha />
                      <el-input-number v-model="entry.quantity" :min="0" :step="100" size="small" class="cm-col-qty" controls-position="right" />
                      <el-input v-model="entry.label" placeholder="图例名" size="small" class="cm-col-label" />
                      <el-button size="small" text type="danger" :icon="Delete" class="cm-col-act" @click="removeColorMapEntry(ci)" />
                    </div>
                  </div>
                  <el-button size="medium" @click="addColorMapEntry" style="margin-top:6px">+ 添加分级</el-button>
                </template>
              </el-form>
            </div>

            <!-- 右侧：图例预览 -->
            <div class="edit-legend">
              <div class="legend-title">图例预览</div>
              <div class="legend-list">
                <div v-for="(r, i) in editingValue" :key="i" class="legend-row">
                  <span v-if="r.geomType === 'POLYGON'" class="lg-swatch" :style="{ background: r.fillcolor || '#ccc' }"></span>
                  <span v-else-if="r.geomType === 'LINE'" class="lg-line" :style="{ background: r.bordercolor || '#00f' }"></span>
                  <span v-else-if="r.geomType === 'POINT'" class="lg-dot" :style="{ background: r.fillcolor || '#3388ff' }"></span>
                  <span v-else class="lg-swatch" :style="{ background: `rgba(128,128,128,${parseFloat(r.opacity||'1')})` }"></span>
                  <span class="lg-label">{{ r.legendTitle || r.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- SLD 源码 Tab -->
        <el-tab-pane label="SLD 源码" name="source">
          <div class="sld-editor">
            <textarea v-model="sldContent" class="sld-textarea" spellcheck="false"></textarea>
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存样式</el-button>
      </template>
    </el-dialog>

    <!-- ── 新建弹窗 ──────────────────────────────────────── -->
    <el-dialog v-model="createVisible" title="新建样式" width="480px" top="20vh" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="样式名称">
          <el-input v-model="createName" placeholder="字母数字下划线（必填）" />
        </el-form-item>
        <el-form-item label="样式描述">
          <el-input v-model="createDescription" placeholder="样式的描述信息（选填）" />
        </el-form-item>
        <el-form-item label="样式类型">
          <el-radio-group v-model="createType">
            <el-radio value="point">点</el-radio>
            <el-radio value="line">线</el-radio>
            <el-radio value="polygon">面</el-radio>
            <el-radio value="raster">栅格</el-radio>
            <el-radio value="generic">通用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="图例标题">
          <span style="font-size:13px; color:#777">创建后可在编辑页面自定义图例名称</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="doCreate" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- ── 应用样式到图层 ────────────────────────────────── -->
    <el-dialog v-model="assignVisible" :title="'应用样式 — ' + assignStyleName" width="400px" top="20vh" destroy-on-close>
      <el-form label-width="80px">
        <el-form-item label="图层">
          <el-select v-model="assignLayer" filterable style="width: 260px" placeholder="选图层">
            <el-option v-for="l in layerList" :key="l.name" :label="l.name" :value="l.name" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" @click="doAssign" :loading="assigning">应用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import { Setting, Refresh, Plus, Delete } from "@element-plus/icons-vue"
import { ElMessage, ElMessageBox } from "element-plus"
import {
  getStyles,
  getStyleSld,
  createStyle,
  updateStyleSld,
  deleteStyle,
  renameStyle,
  getStyleValue,
  updateStyleValue,
  getLayers,
  assignLayerStyle,
  type StyleItem,
  type MapStyleItem,
} from "@/api/geoserver"

// ── 面板 ──────────────────────────────────────────────────────
const panelOpen = ref(false)
const loading = ref(false)
const styleList = ref<StyleItem[]>([]) // StyleItem格式为 { name: string, href: string }

async function loadStyles() {
  loading.value = true
  try {
    const res = await getStyles()
    styleList.value = res.data ?? []
  } catch { styleList.value = [] }
  finally { loading.value = false }
}

// ── 编辑 ──────────────────────────────────────────────────────
const editVisible = ref(false)
const editingName = ref("")
const editTab = ref("form")
const styleLoading = ref(false)

// 表单编辑 — 从后端 MapStyle 解析结果
const editingValue = ref<MapStyleItem[]>([])
const currentRuleIdx = ref(0)

const currentRule = computed(() => editingValue.value[currentRuleIdx.value] ?? null)

// 滑块用数字（因为 slider 绑定 number，MapStyle 字段都是 string）
const fillOpacityNum = computed({
  get: () => currentRule.value?.fillopacity ? parseFloat(currentRule.value.fillopacity) : 1,
  set: (v: number) => { if (currentRule.value) currentRule.value.fillopacity = v.toString() }
})
const borderWidthNum = computed({
  get: () => currentRule.value?.borderwidth ? parseFloat(currentRule.value.borderwidth) : 0,
  set: (v: number) => { if (currentRule.value) currentRule.value.borderwidth = v.toString() }
})
const borderOpacityNum = computed({
  get: () => currentRule.value?.borderopacity ? parseFloat(currentRule.value.borderopacity) : 1,
  set: (v: number) => { if (currentRule.value) currentRule.value.borderopacity = v.toString() }
})
const sizeNum = computed({
  get: () => currentRule.value?.size ? parseInt(currentRule.value.size) : 8,
  set: (v: number) => { if (currentRule.value) currentRule.value.size = v.toString() }
})
const rasterOpacityNum = computed({
  get: () => currentRule.value?.opacity ? parseFloat(currentRule.value.opacity) : 1,
  set: (v: number) => { if (currentRule.value) currentRule.value.opacity = v.toString() }
})
const rotationNum = computed({
  get: () => currentRule.value?.rotation ? parseInt(currentRule.value.rotation) : 0,
  set: (v: number) => { if (currentRule.value) currentRule.value.rotation = v.toString() }
})

// ── ColorMap 编辑 ──────────────────────────────────────
function addColorMapEntry() {
  if (!currentRule.value) return
  if (!currentRule.value.colorMapEntries) currentRule.value.colorMapEntries = []
  // 计算当前规则中颜色映射条目的最大数量值
  // 使用reduce方法遍历colorMapEntries数组，找到quantity属性的最大值
  // 如果quantity不存在，则默认为0
  const max = currentRule.value.colorMapEntries.reduce((m, e) => Math.max(m, +(e.quantity || 0)), 0)
  // 向当前规则的颜色映射条目中添加一个新的条目
  // 新条目的颜色设置为黑色(#000000)
  // 数量值为最大值加500，并转换为字符串类型
  // 标签设置为"values"
  currentRule.value.colorMapEntries.push({ color: "#000000", quantity: (max + 500).toString(), label: "values" })
}

function removeColorMapEntry(idx: number) {
  if (!currentRule.value?.colorMapEntries) return
  currentRule.value.colorMapEntries.splice(idx, 1)
}

// SLD 源码
const sldContent = ref("")
const saving = ref(false)
const editingNewName = ref("")
const editingDescription = ref("")

async function editStyle(name: string) {
  editingName.value = name
  editingNewName.value = name
  editingValue.value = []
  sldContent.value = ""
  currentRuleIdx.value = 0
  editTab.value = "form"
  editVisible.value = true
  styleLoading.value = true
  try {
    // 同时获取表单参数和 SLD 源码
    const [valRes, sldRes] = await Promise.all([
      getStyleValue(name),
      getStyleSld(name),
    ])
    const val = valRes.data ?? []
    console.log("解析样式参数", val)
    editingValue.value = val
    editingDescription.value = val[0]?.description ?? ""
    sldContent.value = sldRes.data ?? ""
  } catch {
    editingValue.value = []
  } finally {
    styleLoading.value = false
  }
}

/** 表单编辑：保存 MapStyle → 后端 DOM+XPath 修改 SLD */
async function saveStyleValue() {
  if (!editingValue.value.length) { ElMessage.warning("没有可保存的参数"); return }
  saving.value = true
  // 如果名称变了，先重命名
  if (editingNewName.value !== editingName.value) {
    try {
      await renameStyle(editingName.value, editingNewName.value)
      editingName.value = editingNewName.value
    } catch (e: any) {
      ElMessage.error("重命名失败: " + (e.message || "")); saving.value = false; return
    }
  }
  // 同步样式描述到所有 MapStyle
  editingValue.value.forEach(r => r.description = editingDescription.value)
  saving.value = true
  try {
    await updateStyleValue(editingName.value, editingValue.value)
    ElMessage.success(`样式 ${editingName.value} 已更新`)
    editVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.message || "保存失败")
  } finally {
    saving.value = false
  }
}

/** SLD 源码编辑：直接 PUT 原始 SLD */
async function saveSldDirect() {
  if (!sldContent.value.trim()) { ElMessage.warning("SLD 内容不能为空"); return }
  saving.value = true
  try {
    await updateStyleSld(editingName.value, sldContent.value)
    ElMessage.success(`样式 ${editingName.value} 已保存`)
    editVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.message || "保存失败")
  } finally {
    saving.value = false
  }
}

/** 根据当前 Tab 决定保存方式 */
async function handleSave() {
  if (editTab.value === "source") {
    // SLD 源码保存需要 double confirm
    try {
      await ElMessageBox.confirm(
        '⚠️ 直接编辑 SLD 源码可能导致表单编辑功能异常（如 Rule Name 被手动修改后，表单将无法定位该 Rule）。\n\n确定要直接保存 SLD 源码吗？',
        '确认保存 SLD 源码',
        { confirmButtonText: '确认保存', cancelButtonText: '取消', type: 'warning' }
      )
    } catch { return }  // 取消则不做任何事
    saveSldDirect()
  } else {
    saveStyleValue()
  }
}

function onRowClick(row: StyleItem) { editStyle(row.name) }

// ── 新建 ──────────────────────────────────────────────────────
const createVisible = ref(false) // 新建样式弹窗显示
const createName = ref("") // 新建样式名称
const createDescription = ref("") // 新建样式描述
const createType = ref("point") // 默认新建样式类型为点
const creating = ref(false) // 新建样式中

function showCreate() {
  createName.value = ""
  createDescription.value = ""
  createType.value = "point"
  createVisible.value = true
}

async function doCreate() {
  if (!createName.value) { ElMessage.warning("名称不能为空"); return }
  creating.value = true
  try {
    await createStyle(createName.value, {
      description: createDescription.value,
      type: createType.value,
    })
    ElMessage.success(`样式 ${createName.value} 已创建`)
    createVisible.value = false
    loadStyles()
  } catch (e: any) {
    ElMessage.error(e.message || "创建失败")
  } finally {
    creating.value = false
  }
}

// ── 删除 ──────────────────────────────────────────────────────
async function removeStyle(name: string) {
  try {
    await ElMessageBox.confirm(`确定要删除样式「${name}」吗？`, "确认删除",
      { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" })
    await deleteStyle(name)
    ElMessage.success(`样式 ${name} 已删除`)
    loadStyles()
  } catch { /* */ }
}

// ── 应用到图层 ────────────────────────────────────────────────
const assignVisible = ref(false)
const assignStyleName = ref("")
const assignLayer = ref("")
const layerList = ref<{ name: string }[]>([])
const assigning = ref(false)

async function assignStyle(styleName: string) {
  assignStyleName.value = styleName
  assignLayer.value = ""
  // 获取 webgistest 工作空间下的图层
  try {
    // const res = await getLayers("webgistest")
    const res = await getLayers("")
    layerList.value = res.data ?? []
  } catch { layerList.value = [] }
  assignVisible.value = true
}

async function doAssign() {
  if (!assignLayer.value) { ElMessage.warning("请选择图层"); return }
  assigning.value = true
  try {
    await assignLayerStyle(assignLayer.value, assignStyleName.value)
    ElMessage.success(`样式 ${assignStyleName.value} 已应用到 ${assignLayer.value}`)
    assignVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.message || "应用失败")
  } finally {
    assigning.value = false
  }
}

onMounted(loadStyles)
</script>

<style scoped lang="scss">
.style-manager {
  position: absolute;
  top: 12px;
  left: 460px;
  z-index: 10;
}

.sm-panel {
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

.sm-header {
  font-size: 13px;
  color: var(--el-text-color-primary);
  padding: 10px 0 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 6px;
}

.sm-toolbar {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

/* SLD 编辑器 */
.sld-editor {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.sld-textarea {
  width: 100%;
  min-height: 400px;
  font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
  font-size: 13px;
  line-height: 1.5;
  padding: 12px;
  border: none;
  outline: none;
  resize: vertical;
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
  tab-size: 2;
}

/* ── 编辑弹窗布局 ──────────────────────────────────────── */
.edit-layout {
  display: flex;
  gap: 16px;
}
.edit-form {
  flex: 1; // 1代表占据剩余空间，右侧图例固定宽度
  min-width: 0;
}
.meta-fields {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}
.desc-field {
  display: flex;
  align-items: center;
}
.desc-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  margin-right: 6px;
}
.rule-selector {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}
.rule-label {
  font-size: 13px;
  margin-right: 8px;
  color: var(--el-text-color-secondary);
}
.rule-selector :deep(.el-radio-button__inner) {
  width: 100%;
  justify-content: center;
}
.style-form {
  max-height: 400px;
  overflow-y: auto; // 表单内容过多时出现滚动条
}
.edit-legend {
  width: 160px;
  flex-shrink: 0;
  padding: 10px 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}
.legend-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.legend-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.lg-swatch {
  width: 24px;
  height: 16px;
  border: 1px solid #999;
  border-radius: 2px;
  flex-shrink: 0;
}
.lg-line {
  width: 24px;
  height: 3px;
  border-radius: 1px;
  flex-shrink: 0;
}
.lg-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid #999;
  flex-shrink: 0;
}
.lg-label {
  font-size: 12px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── ColorMap 编辑表格 ────────────────────────────── */
.cm-title {
  font-size: 13px;
  color: var(--el-text-color-lighter);
  margin-bottom: 10px;
}
.cm-table {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cm-header-row,
.cm-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cm-header-row {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  padding: 0 2px;
}
.cm-col-color { width: 80px; flex-shrink: 0; }
.cm-col-qty   { width: 120px; flex-shrink: 0; }
.cm-col-label { width: 120px; min-width: 0; }
.cm-col-act   { flex-shrink: 0; }

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
