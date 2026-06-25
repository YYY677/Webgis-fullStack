import { ElLoading } from "element-plus"

export function useFullscreenLoading() {
  function showLoading(text = "加载中...") {
    const instance = ElLoading.service({
      fullscreen: true,
      text
    })
    return instance
  }

  return { showLoading }
}
