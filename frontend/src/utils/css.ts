// setCssVar 是一个“传令兵”：它负责把 JS 运行时算出来的坐标、半径等动态数据，
// 以 CSS 变量的形式写入 HTML 根节点，从而让 CSS 动画能够“感知”到用户的交互动作（比如鼠标点击位置）
export function setCssVar(key: string, value: string) {
  document.documentElement.style.setProperty(key, value)
}

export function getCssVar(key: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(key).trim()
}