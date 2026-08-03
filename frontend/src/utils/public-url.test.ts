import { describe, expect, it } from "vitest"
import { joinPublicUrl } from "./public-url"

describe("joinPublicUrl", () => {
  it("preserves the root base path for local development", () => {
    expect(joinPublicUrl("/", "/learning-assets/thumbnail.png"))
      .toBe("/learning-assets/thumbnail.png")
  })

  it("prefixes runtime public assets with a GitHub Pages project path", () => {
    expect(joinPublicUrl("/Webgis-fullStack/", "/cesium-data/world_b.jpg"))
      .toBe("/Webgis-fullStack/cesium-data/world_b.jpg")
  })
})
