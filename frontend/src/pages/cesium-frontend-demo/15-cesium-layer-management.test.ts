import { describe, expect, it } from "vitest"
import {
  createDemoLayerTree,
  findLayer,
  getOperableLayerIds,
  MARS3D_IMAGE_LAYER_OPTIONS,
  setLayerVisibility,
} from "./15-cesium-layer-management.vue"

describe("15 图层树状态", () => {
  it("只更新目标叶节点的显隐状态，并保留父节点结构", () => {
    const tree = createDemoLayerTree()
    const nextTree = setLayerVisibility(tree, "building-tiles", false)

    expect(findLayer(nextTree, "building-tiles")?.visible).toBe(false)
    expect(nextTree.find((node) => node.id === "business")?.children).toHaveLength(2)
  })

  it("不会把分组节点当成可直接映射到 Cesium 对象的叶节点", () => {
    expect(getOperableLayerIds(createDemoLayerTree())).not.toContain("business")
  })

  it("uses Mars3D tiles for the manageable base imagery instead of one world image", () => {
    expect(MARS3D_IMAGE_LAYER_OPTIONS).toEqual({
      url: "//data.mars3d.cn/tile/img/{z}/{x}/{y}.jpg",
      maximumLevel: 18,
    })
  })
})
