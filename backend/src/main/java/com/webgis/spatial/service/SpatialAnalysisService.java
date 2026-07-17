package com.webgis.spatial.service;

import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.io.ParseException;
import org.locationtech.jts.io.WKTReader;
import org.locationtech.jts.io.WKTWriter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 空间分析 — JTS 几何运算 + pgRouting 最短路径
 * <p>
 * 所有几何输入输出格式为 WKT（EPSG:4326）。
 */
@Service
public class SpatialAnalysisService {

    private static final GeometryFactory GEOM_FACTORY = new GeometryFactory();
    private static final WKTReader WKT_READER = new WKTReader(GEOM_FACTORY);
    private static final WKTWriter WKT_WRITER = new WKTWriter();

    private final JdbcTemplate jdbcTemplate;

    public SpatialAnalysisService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** 缓冲区分析 */
    public String buffer(String wkt, double distance) {
        try {
            Geometry g = WKT_READER.read(wkt);
            Geometry result = g.buffer(distance);
            return WKT_WRITER.write(result);
        } catch (ParseException e) {
            throw new IllegalArgumentException("WKT 解析失败: " + e.getMessage());
        }
    }

    /** 叠加分析（交集） */
    public String intersection(String wkt1, String wkt2) {
        try {
            Geometry g1 = WKT_READER.read(wkt1);
            Geometry g2 = WKT_READER.read(wkt2);
            return WKT_WRITER.write(g1.intersection(g2));
        } catch (ParseException e) {
            throw new IllegalArgumentException("WKT 解析失败: " + e.getMessage());
        }
    }

    /** 合并分析 */
    public String union(String wkt1, String wkt2) {
        try {
            Geometry g1 = WKT_READER.read(wkt1);
            Geometry g2 = WKT_READER.read(wkt2);
            return WKT_WRITER.write(g1.union(g2));
        } catch (ParseException e) {
            throw new IllegalArgumentException("WKT 解析失败: " + e.getMessage());
        }
    }

    /** 差异分析 */
    public String difference(String wkt1, String wkt2) {
        try {
            Geometry g1 = WKT_READER.read(wkt1);
            Geometry g2 = WKT_READER.read(wkt2);
            return WKT_WRITER.write(g1.difference(g2));
        } catch (ParseException e) {
            throw new IllegalArgumentException("WKT 解析失败: " + e.getMessage());
        }
    }

    /** 对称差异分析 */
    public String symDifference(String wkt1, String wkt2) {
        try {
            Geometry g1 = WKT_READER.read(wkt1);
            Geometry g2 = WKT_READER.read(wkt2);
            return WKT_WRITER.write(g1.symDifference(g2));
        } catch (ParseException e) {
            throw new IllegalArgumentException("WKT 解析失败: " + e.getMessage());
        }
    }

    /** 空间关系判断 */
    public Map<String, Boolean> relation(String wkt1, String wkt2) {
        try {
            Geometry g1 = WKT_READER.read(wkt1);
            Geometry g2 = WKT_READER.read(wkt2);
            Map<String, Boolean> result = new LinkedHashMap<>();
            result.put("equals", g1.equals(g2));
            result.put("disjoint", g1.disjoint(g2));
            result.put("intersects", g1.intersects(g2));
            result.put("touches", g1.touches(g2));
            result.put("crosses", g1.crosses(g2));
            result.put("within", g1.within(g2));
            result.put("contains", g1.contains(g2));
            result.put("overlaps", g1.overlaps(g2));
            return result;
        } catch (ParseException e) {
            throw new IllegalArgumentException("WKT 解析失败: " + e.getMessage());
        }
    }

    /** 最短路径分析（pgRouting pgr_dijkstra） */
    public Map<String, Object> shortestPath(double x1, double y1, double x2, double y2) {
        // 1. 查找最近的路网节点
        String nodeSql = "SELECT id FROM shenzhen_roads_vertices_pgr " +
                "ORDER BY geom <-> st_setsrid(st_makepoint(?, ?), 4326) LIMIT 1";
        Integer sourceId = jdbcTemplate.queryForObject(nodeSql, Integer.class, x1, y1);
        Integer targetId = jdbcTemplate.queryForObject(nodeSql, Integer.class, x2, y2);

        if (sourceId == null || targetId == null) {
            throw new IllegalArgumentException("未找到附近的路网节点");
        }

        // 2. pgr_dijkstra 计算最短路径，PostGIS 直接合并成一条 LINESTRING
        String pgrSql = "SELECT st_astext(st_linemerge(st_collect(r.geom ORDER BY seq))) AS wkt," +
                "sum(pgr.cost) AS total_cost " +
                "FROM pgr_dijkstra('SELECT gid AS id, source, target, cost " +
                "FROM shenzhen_roads', ?, ?, false) AS pgr " +
                "JOIN shenzhen_roads r ON pgr.edge = r.gid";

        Map<String, Object> row = jdbcTemplate.queryForMap(pgrSql, sourceId, targetId);

        if (row == null || row.get("wkt") == null) {
            throw new IllegalArgumentException("未找到路径");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("wkt", row.get("wkt"));
        result.put("totalCost", Math.round(((Number) row.get("total_cost")).doubleValue() * 100) / 100.0);
        result.put("sourceId", sourceId);
        result.put("targetId", targetId);
        return result;
    }
}
