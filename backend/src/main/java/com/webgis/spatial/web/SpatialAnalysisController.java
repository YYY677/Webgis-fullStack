package com.webgis.spatial.web;

import com.webgis.common.Result;
import com.webgis.spatial.service.SpatialAnalysisService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 空间分析接口 — JTS 几何运算 + pgRouting 最短路径
 */
@RestController
@RequestMapping("/api/spatial/analysis")
public class SpatialAnalysisController {

    private final SpatialAnalysisService spatialAnalysisService;

    public SpatialAnalysisController(SpatialAnalysisService spatialAnalysisService) {
        this.spatialAnalysisService = spatialAnalysisService;
    }

    @PostMapping("/buffer")
    public Result<String> buffer(@RequestBody Map<String, Object> params) {
        String wkt = (String) params.get("wkt");
        double distance = ((Number) params.get("distance")).doubleValue();
        return Result.success(spatialAnalysisService.buffer(wkt, distance));
    }

    @PostMapping("/intersection")
    public Result<String> intersection(@RequestBody Map<String, String> params) {
        return Result.success(spatialAnalysisService.intersection(params.get("wkt1"), params.get("wkt2")));
    }

    @PostMapping("/union")
    public Result<String> union(@RequestBody Map<String, String> params) {
        return Result.success(spatialAnalysisService.union(params.get("wkt1"), params.get("wkt2")));
    }

    @PostMapping("/difference")
    public Result<String> difference(@RequestBody Map<String, String> params) {
        return Result.success(spatialAnalysisService.difference(params.get("wkt1"), params.get("wkt2")));
    }

    @PostMapping("/symdifference")
    public Result<String> symDifference(@RequestBody Map<String, String> params) {
        return Result.success(spatialAnalysisService.symDifference(params.get("wkt1"), params.get("wkt2")));
    }

    @PostMapping("/relation")
    public Result<Map<String, Boolean>> relation(@RequestBody Map<String, String> params) {
        return Result.success(spatialAnalysisService.relation(params.get("wkt1"), params.get("wkt2")));
    }

    @PostMapping("/distance")
    public Result<Double> distance(@RequestBody Map<String, String> params) {
        return Result.success(spatialAnalysisService.distance(params.get("wkt1"), params.get("wkt2")));
    }

    @PostMapping("/area")
    public Result<Double> area(@RequestBody Map<String, String> params) {
        return Result.success(spatialAnalysisService.area(params.get("wkt")));
    }

    @PostMapping("/length")
    public Result<Double> length(@RequestBody Map<String, String> params) {
        return Result.success(spatialAnalysisService.length(params.get("wkt")));
    }

    @PostMapping("/centroid")
    public Result<String> centroid(@RequestBody Map<String, String> params) {
        return Result.success(spatialAnalysisService.centroid(params.get("wkt")));
    }

    @PostMapping("/shortest-path")
    public Result<Map<String, Object>> shortestPath(@RequestBody Map<String, Object> params) {
        double x1 = ((Number) params.get("x1")).doubleValue();
        double y1 = ((Number) params.get("y1")).doubleValue();
        double x2 = ((Number) params.get("x2")).doubleValue();
        double y2 = ((Number) params.get("y2")).doubleValue();
        return Result.success(spatialAnalysisService.shortestPath(x1, y1, x2, y2));
    }
}
