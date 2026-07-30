# Cesium 前端业务操作专题实现计划

> **面向 AI 代理的工作者：** 在当前会话内按任务顺序实现；每个任务先写失败测试，再写最小实现，再运行对应测试。不要提交或推送代码。

**目标：** 新增连续编号的 Cesium 15、16、17 三个前端学习页，并把它们接入现有学习目录。

**架构：** 短小的图层节点、标绘 GeoJSON 转换和一次性清理逻辑直接放在所属页面的普通模块脚本中，并以具名导出供 Vitest 测试；页面的 `script setup` 只持有 Cesium Viewer、事件和交互状态。目录继续作为课程标题的唯一来源，路由使用现有的 `cesiumLessonMeta()` 派生标题。

**技术栈：** Vue 3 Composition API、TypeScript、Cesium 1.142、Element Plus、Vitest、Vite。

---

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `frontend/src/pages/cesium-frontend-demo/15-cesium-layer-management.vue` | 图层集合与业务树适配演示，以及图层树纯状态的具名导出。 |
| `frontend/src/pages/cesium-frontend-demo/15-cesium-layer-management.test.ts` | 直接导入页面模块，测试图层树状态变更与不可操作节点。 |
| `frontend/src/pages/cesium-frontend-demo/16-cesium-annotation-edit.vue` | 标绘、选择、顶点编辑、删除、下载 GeoJSON，以及 GeoJSON 转换的具名导出。 |
| `frontend/src/pages/cesium-frontend-demo/16-cesium-annotation-edit.test.ts` | 直接导入页面模块，测试点、线、面 GeoJSON 坐标与属性。 |
| `frontend/src/pages/cesium-frontend-demo/17-cesium-performance-lifecycle.vue` | 按需渲染、资源销毁治理，以及一次性清理注册表的具名导出。 |
| `frontend/src/pages/cesium-frontend-demo/17-cesium-performance-lifecycle.test.ts` | 直接导入页面模块，测试逆序、仅执行一次、释放后立即执行。 |
| `frontend/public/cesium-data/lesson-thumbnails/placeholder.svg` | 新课共用的本地 16:9 占位缩略图。 |
| `frontend/src/pages/cesium-frontend-demo/cesium-learning-catalog.ts` | 追加 15、16、17 课及专题归类。 |
| `frontend/src/pages/cesium-frontend-demo/cesium-learning-catalog.test.ts` | 断言连续 17 课和三个占位缩略图入口。 |
| `frontend/src/router/index.ts` | 追加三个 Cesium 子路由。 |
| `frontend/src/router/cesium-routes.test.ts` | 断言三个新路由存在并仍从目录派生标题。 |

### 任务 1：实现 15 页中的图层树纯状态逻辑

**文件：**
- 创建：`frontend/src/pages/cesium-frontend-demo/15-cesium-layer-management.vue`
- 创建：`frontend/src/pages/cesium-frontend-demo/15-cesium-layer-management.test.ts`

- [ ] **步骤 1：编写失败测试**

```ts
it("updates only a leaf node visibility and keeps its parent structure", () => {
  const tree = createDemoLayerTree()
  const next = setLayerVisibility(tree, "building-tiles", false)

  expect(findLayer(next, "building-tiles")?.visible).toBe(false)
  expect(next[1].children).toHaveLength(2)
})

it("does not treat group nodes as Cesium-operable leaves", () => {
  expect(getOperableLayerIds(createDemoLayerTree())).not.toContain("business")
})
```

- [ ] **步骤 2：运行失败测试**

运行：`npm test -- 15-cesium-layer-management.test.ts`

预期：失败，提示模块或导出不存在。

- [ ] **步骤 3：编写最小实现**

```ts
export type LayerKind = "group" | "imagery" | "dataSource" | "entitySource" | "tileset"

export interface LayerNode {
  id: string
  label: string
  kind: LayerKind
  visible: boolean
  children?: LayerNode[]
}

export function setLayerVisibility(nodes: LayerNode[], id: string, visible: boolean): LayerNode[] {
  return nodes.map((node) => ({
    ...node,
    visible: node.id === id ? visible : node.visible,
    children: node.children ? setLayerVisibility(node.children, id, visible) : undefined,
  }))
}
```

- [ ] **步骤 4：运行通过测试**

运行：`npm test -- 15-cesium-layer-management.test.ts`

预期：PASS。

### 任务 2：实现 16 页中的标绘 GeoJSON 转换

**文件：**
- 创建：`frontend/src/pages/cesium-frontend-demo/16-cesium-annotation-edit.vue`
- 创建：`frontend/src/pages/cesium-frontend-demo/16-cesium-annotation-edit.test.ts`

- [ ] **步骤 1：编写失败测试**

```ts
it("exports a ground polygon as two-dimensional WGS84 GeoJSON coordinates", () => {
  const feature = annotationToFeature({
    id: "area-1", name: "范围", type: "polygon", color: "#1677ff",
    coordinates: [[116.39, 39.9], [116.4, 39.9], [116.4, 39.91]],
  })

  expect(feature.geometry).toEqual({
    type: "Polygon",
    coordinates: [[[116.39, 39.9], [116.4, 39.9], [116.4, 39.91], [116.39, 39.9]]],
  })
})
```

- [ ] **步骤 2：运行失败测试**

运行：`npm test -- 16-cesium-annotation-edit.test.ts`

预期：失败，提示模块或导出不存在。

- [ ] **步骤 3：编写最小实现**

```ts
export type AnnotationType = "point" | "line" | "polygon"
export type Wgs84Coordinate = [longitude: number, latitude: number]

export function annotationToFeature(annotation: Annotation): GeoJSON.Feature {
  const coordinates = annotation.type === "polygon"
    ? [closeRing(annotation.coordinates)]
    : annotation.type === "line" ? annotation.coordinates : annotation.coordinates[0]
  return { type: "Feature", id: annotation.id, properties: { name: annotation.name, type: annotation.type, color: annotation.color }, geometry: { type: geometryType[annotation.type], coordinates } }
}
```

- [ ] **步骤 4：运行通过测试**

运行：`npm test -- 16-cesium-annotation-edit.test.ts`

预期：PASS。

### 任务 3：实现 17 页中的一次性资源清理注册表

**文件：**
- 创建：`frontend/src/pages/cesium-frontend-demo/17-cesium-performance-lifecycle.vue`
- 创建：`frontend/src/pages/cesium-frontend-demo/17-cesium-performance-lifecycle.test.ts`

- [ ] **步骤 1：编写失败测试**

```ts
it("disposes registered resources in reverse order exactly once", () => {
  const bag = createDisposables()
  const calls: string[] = []
  bag.add(() => calls.push("first"))
  bag.add(() => calls.push("second"))

  bag.dispose()
  bag.dispose()
  expect(calls).toEqual(["second", "first"])
})
```

- [ ] **步骤 2：运行失败测试**

运行：`npm test -- 17-cesium-performance-lifecycle.test.ts`

预期：失败，提示模块或导出不存在。

- [ ] **步骤 3：编写最小实现**

```ts
export type Dispose = () => void

export function createDisposables() {
  let disposed = false
  const callbacks: Dispose[] = []
  return {
    add(callback: Dispose) {
      if (disposed) callback()
      else callbacks.push(callback)
      return callback
    },
    dispose() {
      if (disposed) return
      disposed = true
      while (callbacks.length) callbacks.pop()?.()
    },
  }
}
```

- [ ] **步骤 4：运行通过测试**

运行：`npm test -- 17-cesium-performance-lifecycle.test.ts`

预期：PASS。

### 任务 4：接入课程目录、路由和占位缩略图

**文件：**
- 创建：`frontend/public/cesium-data/lesson-thumbnails/placeholder.svg`
- 修改：`frontend/src/pages/cesium-frontend-demo/cesium-learning-catalog.ts`
- 修改：`frontend/src/pages/cesium-frontend-demo/cesium-learning-catalog.test.ts`
- 修改：`frontend/src/router/index.ts`
- 修改：`frontend/src/router/cesium-routes.test.ts`

- [ ] **步骤 1：扩展目录与路由测试为连续 17 课**

```ts
expect(cesiumLessons).toHaveLength(17)
expect(cesiumLessons.slice(-3).map((lesson) => lesson.path)).toEqual([
  "/cesium-demo/layer-management",
  "/cesium-demo/annotation-edit",
  "/cesium-demo/performance-lifecycle",
])
expect(cesiumLessons.slice(-3).every((lesson) => lesson.thumbnail.endsWith("placeholder.svg"))).toBe(true)
```

- [ ] **步骤 2：运行失败测试**

运行：`npm test -- cesium-learning-catalog.test.ts cesium-routes.test.ts`

预期：失败，目录只有 14 课且新路由不存在。

- [ ] **步骤 3：追加元数据、专题引用、子路由和 SVG 占位图**

```ts
{
  title: "15-图层体系与图层树管理",
  path: "/cesium-demo/layer-management",
  summary: "用前端图层树组织影像、数据源、Entity 与 3D Tiles。",
  api: "ImageryLayerCollection · DataSourceCollection · PrimitiveCollection",
  thumbnail: "/cesium-data/lesson-thumbnails/placeholder.svg",
}
```

- [ ] **步骤 4：运行通过测试**

运行：`npm test -- cesium-learning-catalog.test.ts cesium-routes.test.ts`

预期：PASS。

### 任务 5：扩展 15 图层体系与图层树管理页

**文件：**
- 修改：`frontend/src/pages/cesium-frontend-demo/15-cesium-layer-management.vue`

- [ ] **步骤 1：在页面中接入已通过的树工具和 Viewer**

```ts
const layerTree = ref(createDemoLayerTree())
const layerHandles = new Map<string, ManagedLayerHandle>()

function syncVisibility(id: string, visible: boolean) {
  layerTree.value = setLayerVisibility(layerTree.value, id, visible)
  layerHandles.get(id)?.setVisible(visible)
  requestSceneRender()
}
```

- [ ] **步骤 2：为四种对象建立集合适配器**

```ts
layerHandles.set("overlay-imagery", { setVisible: (value) => { overlay.show = value }, remove: () => viewer!.imageryLayers.remove(overlay, true), flyTo: undefined })
layerHandles.set("district-data", { setVisible: (value) => { dataSource.show = value }, remove: () => viewer!.dataSources.remove(dataSource, true), flyTo: () => viewer!.flyTo(dataSource) })
layerHandles.set("business-markers", { setVisible: (value) => { markerSource.show = value }, remove: () => viewer!.dataSources.remove(markerSource, true), flyTo: () => viewer!.flyTo(markerSource) })
layerHandles.set("building-tiles", { setVisible: (value) => { tileset.show = value }, remove: () => viewer!.scene.primitives.remove(tileset), flyTo: () => viewer!.flyTo(tileset) })
```

- [ ] **步骤 3：实现类型适配控件与安全清理**

影像叶节点显示透明度和顺序按钮；可定位对象显示定位；已移除对象可重新添加。页面卸载时通过 `createDisposables()` 逆序清理集合对象、事件和 Viewer。

- [ ] **步骤 4：运行类型检查和浏览器验证**

运行：`npm run build`

预期：构建通过；浏览器验证显隐、透明度、排序、定位、移除/重新添加，且移除业务图层不删除底图。

### 任务 6：扩展 16 前端标绘编辑与 GeoJSON 导出页

**文件：**
- 修改：`frontend/src/pages/cesium-frontend-demo/16-cesium-annotation-edit.vue`

- [ ] **步骤 1：以标绘内存模型为唯一数据源创建 Entity**

```ts
const annotations = ref<Annotation[]>([])
const selectedId = ref<string>()

function addAnnotation(type: AnnotationType, coordinates: Wgs84Coordinate[]) {
  const annotation = { id: crypto.randomUUID(), name: `${type}-${annotations.value.length + 1}`, type, color: "#1677ff", coordinates }
  annotations.value.push(annotation)
  syncAnnotationEntity(annotation)
}
```

- [ ] **步骤 2：实现绘制预览、选择和顶点拖动**

```ts
handler.setInputAction((movement) => {
  const vertexId = pickVertexId(movement.position)
  if (!vertexId) return
  viewer!.scene.screenSpaceCameraController.enableInputs = false
  dragState = vertexId
}, ScreenSpaceEventType.LEFT_DOWN)

handler.setInputAction((movement) => {
  if (!dragState) return
  updateVertex(dragState, pickWgs84(movement.endPosition))
  requestSceneRender()
}, ScreenSpaceEventType.MOUSE_MOVE)
```

- [ ] **步骤 3：实现删除、清空和客户端导出**

```ts
function exportGeoJson() {
  const data = annotationsToFeatureCollection(annotations.value)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/geo+json" })
  const url = URL.createObjectURL(blob)
  const anchor = Object.assign(document.createElement("a"), { href: url, download: createGeoJsonFilename() })
  anchor.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **步骤 4：运行构建和浏览器验证**

运行：`npm run build`

预期：构建通过；浏览器验证点线面创建、选中、顶点拖拽、删除、下载并解析导出的 GeoJSON，且浏览器网络面板无 API 请求。

### 任务 7：扩展 17 性能优化与资源生命周期页

**文件：**
- 修改：`frontend/src/pages/cesium-frontend-demo/17-cesium-performance-lifecycle.vue`

- [ ] **步骤 1：提供按需渲染的统一入口与观测器**

```ts
function requestSceneRender() {
  viewer?.scene.requestRender()
}

const removePostRender = viewer.scene.postRender.addEventListener(() => {
  renderedFrames.value += 1
})
disposables.add(removePostRender)
```

- [ ] **步骤 2：实现受控动态对象与可取消外部更新**

动态对象仅在已启用时更新；定时器和模拟异步任务都将取消逻辑登记到 `createDisposables()`，回调内先检查页面仍处于活动状态，再更新 Vue 或 Cesium 对象。

- [ ] **步骤 3：实现连续/显式渲染切换与销毁顺序**

```ts
function setRequestRenderMode(value: boolean) {
  if (!viewer) return
  viewer.scene.requestRenderMode = value
  requestSceneRender()
}

onUnmounted(() => {
  disposables.dispose()
  if (viewer && !viewer.isDestroyed()) viewer.destroy()
  viewer = null
})
```

- [ ] **步骤 4：运行构建和浏览器验证**

运行：`npm run build`

预期：构建通过；浏览器验证显式模式在静止时帧数停止增长，切换 Vue 控件/模拟更新后场景恢复；离开页面后无控制台销毁错误。

### 任务 8：全量验证与人工回归

**文件：**
- 修改：本计划涉及的全部文件。

- [ ] **步骤 1：运行全量单元测试**

运行：`npm test`

预期：所有 Vitest 用例 PASS。

- [ ] **步骤 2：运行生产构建**

运行：`npm run build`

预期：`vue-tsc --noEmit` 和 Vite build 均通过。

- [ ] **步骤 3：浏览器回归三个新路由**

依次访问 `/cesium-demo/layer-management`、`/cesium-demo/annotation-edit`、`/cesium-demo/performance-lifecycle`，验证设计稿中的核心交互和控制台无未处理异常。

- [ ] **步骤 4：核对变更范围**

运行：`git diff --check` 与 `git status --short`

预期：无空白错误；仅出现本任务创建或追加的文件，已有未提交的目录/布局改造不被覆盖。
