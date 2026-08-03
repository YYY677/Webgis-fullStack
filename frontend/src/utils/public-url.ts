/**
 * joinPublicUrl("/", "/learning-assets/a.png") 
 *    => "/learning-assets/a.png"
 * 
 * joinPublicUrl("/Webgis-fullStack/", "/learning-assets/a.png") 
 *    => "/Webgis-fullStack/learning-assets/a.png"
 * 
 * 这样无论传入的资源路径有没有前导 /，最终都不会拼出错误的双斜杠。
 */
export function joinPublicUrl(baseUrl: string, path: string) {
  // 确保 baseUrl 以斜杠结尾
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  // path 以斜杠开头的部分被去掉
  // replace 是替换字符串；/^\/+/ 表示“字符串开头连续出现的一个或多个 /”。
  return `${normalizedBase}${path.replace(/^\/+/, "")}`
}

export function publicUrl(path: string) {
  // import.meta.env 是 Vite 在前端代码中提供的环境信息；
  // BASE_URL 是 Vite 内置变量，值来自 vite.config.ts 的 base 配置。
  // | 场景 | `BASE_URL` | 最终图片地址 |
  // | 本地开发 | `/` | `/learning-assets/a.png` |
  // | GitHub Pages 构建 | `/Webgis-fullStack/` | `/Webgis-fullStack/learning-assets/a.png` |
  return joinPublicUrl(import.meta.env.BASE_URL, path)
}
