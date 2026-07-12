package com.webgis.geoserver.web;

import com.webgis.common.Result;
import com.webgis.geoserver.dto.MapStyle;
import com.webgis.geoserver.dto.StyleInfo;
import com.webgis.geoserver.service.StyleService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 样式管理接口 — 代理 GeoServer REST /rest/styles/*
 * <p>
 * 样式是全局资源，不指定工作空间。
 */
@RestController
@RequestMapping("/api/geoserver/styles")
public class StyleController {

    private final StyleService styleService;

    public StyleController(StyleService styleService) {
        this.styleService = styleService;
    }

    /** 获取所有样式 */
    @GetMapping
    public Result<List<StyleInfo>> list() {
        return Result.success(styleService.list());
    }

    /** 获取样式元数据详情 */
    @GetMapping("/detail")
    public Result<Map<String, Object>> detail(@RequestParam String name) {
        return Result.success(styleService.getDetail(name));
    }

    /** 获取 SLD 原始内容 */
    @GetMapping("/sld")
    public Result<String> sld(@RequestParam String name) {
        return Result.success(styleService.getSld(name));
    }

    /** 创建样式 — 按 type 选预设模板 */
    @PostMapping
    public Result<String> create(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        if (name == null || name.isBlank())
            return Result.error(400, "name 不能为空");
        String description = body.getOrDefault("description", "");
        String type = body.getOrDefault("type", "point");
        styleService.createWithSld(name, description, type);
        return Result.success("样式 " + name + " 已创建");
    }

    /** 更新 SLD 内容（body 为纯文本 SLD XML） */
    @PutMapping("/sld")
    public Result<String> updateSld(@RequestParam String name, @RequestBody String sldBody) {
        if (sldBody == null || sldBody.isBlank())
            return Result.error(400, "SLD 内容不能为空");
        styleService.updateSld(name, sldBody);
        return Result.success("样式 " + name + " 已更新");
    }

    /** 解析 SLD → MapStyle 列表（供前端表单编辑） */
    @GetMapping("/value")
    public Result<List<MapStyle>> getStyleValue(@RequestParam String name) {
        try {
            return Result.success(styleService.getStyleValue(name));
        } catch (Exception e) {
            return Result.error(500, "解析 SLD 失败: " + e.getMessage());
        }
    }

    /** DOM+XPath 修改 SLD 并保存 */
    @PutMapping("/value")
    public Result<String> updateStyleValue(@RequestParam String name,
                                            @RequestBody List<MapStyle> mapStyles) {
        try {
            styleService.updateStyleValue(name, mapStyles);
            return Result.success("样式 " + name + " 已更新");
        } catch (Exception e) {
            return Result.error(500, "保存失败: " + e.getMessage());
        }
    }

    /** 重命名样式（同步 GeoServer 注册名 + SLD 内部 Name/Title） */
    @PutMapping("/rename")
    public Result<String> rename(@RequestBody Map<String, String> body) {
        String oldName = body.get("oldName");
        String newName = body.get("newName");
        if (oldName == null || oldName.isBlank() || newName == null || newName.isBlank())
            return Result.error(400, "oldName, newName 不能为空");
        try {
            styleService.rename(oldName, newName);
            return Result.success("样式 " + oldName + " 已重命名为 " + newName);
        } catch (Exception e) {
            return Result.error(500, "重命名失败: " + e.getMessage());
        }
    }

    /** 删除样式 */
    @DeleteMapping
    public Result<String> delete(@RequestParam String name) {
        styleService.delete(name);
        return Result.success("样式 " + name + " 已删除");
    }
}
