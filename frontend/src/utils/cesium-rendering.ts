export type SceneModeName = "SCENE2D" | "COLUMBUS_VIEW" | "SCENE3D"

/**
 * 将天空盒六个朝向映射为 Cesium 所需的字段。
 * px/mx、py/my、pz/mz 分别是局部 X/Y/Z 轴的正负方向；六张图必须来自同一套立方体贴图，
 * 否则接缝处会出现方向错乱或明显断层。
 */
export function createSkyBoxSources(base = "/cesium-data/skybox") {
  return {
    positiveX: `${base}/tycho2t3_80_px.jpg`,
    negativeX: `${base}/tycho2t3_80_mx.jpg`,
    positiveY: `${base}/tycho2t3_80_py.jpg`,
    negativeY: `${base}/tycho2t3_80_my.jpg`,
    positiveZ: `${base}/tycho2t3_80_pz.jpg`,
    negativeZ: `${base}/tycho2t3_80_mz.jpg`,
  }
}

/**
 * 使用 UTC 生成与本机时区无关、可排序的导出文件名。
 * 月份从 0 开始是 JavaScript Date 的约定，因此需要加 1；其他时间字段可直接使用。
 */
export function formatSceneExportName(date: Date) {
  const parts = [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  ].map((part) => String(part).padStart(2, "0"))

  return `cesium-scene-${parts.slice(0, 3).join("")}-${parts.slice(3).join("")}.png`
}

/** 将 Cesium 的内部场景模式常量转换为面板中更易理解的名称。 */
export function getSceneModeLabel(mode: SceneModeName) {
  const labels: Record<SceneModeName, string> = {
    SCENE2D: "2D 地图",
    COLUMBUS_VIEW: "2.5D 哥伦布视图",
    SCENE3D: "3D 地球",
  }

  return labels[mode]
}
