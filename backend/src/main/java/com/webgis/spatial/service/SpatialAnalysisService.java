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
 * 所有几何输入输出格式均为 WKT。JTS 将坐标按平面坐标处理，不识别或转换坐标参考系；
 * 调用方必须保证每次运算的输入处于同一投影坐标系。
 * 当前 OL 页面中的常规分析使用 EPSG:3857，最短路径接口单独使用 EPSG:4326。
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

    /*
     * 文中的空间分析功能主要依赖 JTS（Java Topology Suite）库来进行几何运算，并使用
     * pgRouting 来计算最短路径。所有几何数据的输入和输出格式为 WKT（Well-Known Text）。
     * 
     * 整体分析使用的jts的geometry对象，没有使用其子类，比如Polygon、LineString、Point等。
     * Geometry 父类只有通用方法（如 buffer、intersection），多态带来了灵活性。
     * 而子类才有特定方法（如 Polygon 的 getArea、LineString 的 getLength、Point 的 getX）。
     */

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

    /** 距离测量（两个几何之间的最短距离） */
    public double distance(String wkt1, String wkt2) {
        try {
            Geometry g1 = WKT_READER.read(wkt1);
            Geometry g2 = WKT_READER.read(wkt2);
            return g1.distance(g2);
        } catch (ParseException e) {
            throw new IllegalArgumentException("WKT 解析失败: " + e.getMessage());
        }
    }

    /** 面积测量（适用于 Polygon） */
    public double area(String wkt) {
        try {
            Geometry g = WKT_READER.read(wkt);
            return g.getArea();
        } catch (ParseException e) {
            throw new IllegalArgumentException("WKT 解析失败: " + e.getMessage());
        }
    }

    /** 长度/周长测量（适用于 LineString / Polygon） */
    public double length(String wkt) {
        try {
            Geometry g = WKT_READER.read(wkt);
            return g.getLength();
        } catch (ParseException e) {
            throw new IllegalArgumentException("WKT 解析失败: " + e.getMessage());
        }
    }

    /** 获取几何中心点 */
    public String centroid(String wkt) {
        try {
            Geometry g = WKT_READER.read(wkt);
            return WKT_WRITER.write(g.getCentroid());
        } catch (ParseException e) {
            throw new IllegalArgumentException("WKT 解析失败: " + e.getMessage());
        }
    }

    /** 空间关系判断 */
    public Map<String, Boolean> relation(String wkt1, String wkt2) {
        try {
            Geometry g1 = WKT_READER.read(wkt1);
            Geometry g2 = WKT_READER.read(wkt2);
            // Map是接口，LinkedHashMap是实现类，LinkedHashMap可以保证插入顺序。HashMap是无序的实现类。
            Map<String, Boolean> result = new LinkedHashMap<>();
            // equals: 判断两个几何对象是否相等
            // 记住 equals() 是“结构相同”（点完全一样），equalsTopo() 是“空间重合”（覆盖区域一样）。
            result.put("equals", g1.equals(g2));
            // disjoint: 判断两个几何对象是否不相交
            result.put("disjoint", g1.disjoint(g2));
            // intersects: 判断两个几何对象是否相交
            result.put("intersects", g1.intersects(g2));
            // touches: 判断两个几何对象是否仅仅是边界相接
            // 只碰边界，不允许内部相交，碰到了，但没有压进去。
            result.put("touches", g1.touches(g2));
            // crosses: 判断两个几何对象是否交叉
            // 面与面相交不算crosses，线穿过面或者线线相交才叫crosses。
            result.put("crosses", g1.crosses(g2));
            // within: 判断g1是否完全包含于g2中，被动态
            result.put("within", g1.within(g2));
            // contains: 判断g1是否完全包含g2，主动态
            result.put("contains", g1.contains(g2));
            // overlaps: 判断两个几何对象是否重叠
            result.put("overlaps", g1.overlaps(g2));
            return result;
        } catch (ParseException e) {
            throw new IllegalArgumentException("WKT 解析失败: " + e.getMessage());
        }
    }

    /**
     * 最短路径分析完整链路（pgRouting + PostGIS）
     *
     * 1. 原始数据准备（shenzhen_roads）：
     * 表必须包含：主键 id（或 gid）、线几何列（geom），并预先创建两个空的整型字段 source / target。
     *
     * 2. 拓扑构建（pgr_createTopology）：
     * 执行该函数后，会自动完成两件事：
     * a) 计算所有线段的端点和交点，为每条线填充 source / target（指向节点的 ID），构建“边”的拓扑关系。
     * b) 生成配套的顶点表（shenzhen_roads_vertices_pgr），存储每个节点 ID 对应的精确坐标（点几何）。
     *
     * 3. 坐标转节点（KNN 查询）：
     * 前端传入的经纬度无法直接用于算法，需通过顶点表查找最近节点：
     * SELECT id FROM vertices_pgr ORDER BY geom <-> ST_SetSRID(ST_MakePoint(?, ?),
     * 4326) LIMIT 1;
     * 得到起点 ID 和终点 ID。
     *
     * 4. 最短路径计算（pgr_dijkstra）：
     * 调用函数：pgr_dijkstra('SELECT id, source, target, cost FROM 路网表', 起点ID, 终点ID,
     * false)
     * 返回路径经过的边序列，再 JOIN 原表获取几何，最后用 ST_LineMerge / ST_Collect 合并为一条完整线路。
     */
    public Map<String, Object> shortestPath(double x1, double y1, double x2, double y2) {
        // 1. 查找最近的路网节点
        // <-> 是 PostGIS 的 KNN 算法，计算表中每个节点的 geom 与构造的输入点之间的距离。
        // st_setsrid(st_makepoint(x, y), 4326) 是构造一个点几何对象。
        // ORDER BY ... LIMIT 1：按照距离从小到大排序，并只取第一条记录，即距离最近的节点 ID。
        String nodeSql = "SELECT id FROM shenzhen_roads_vertices_pgr " +
                "ORDER BY geom <-> st_setsrid(st_makepoint(?, ?), 4326) LIMIT 1";
        Integer sourceId = jdbcTemplate.queryForObject(nodeSql, Integer.class, x1, y1);
        Integer targetId = jdbcTemplate.queryForObject(nodeSql, Integer.class, x2, y2);

        if (sourceId == null || targetId == null) {
            throw new IllegalArgumentException("未找到附近的路网节点");
        }

        // 2. pgr_dijkstra 计算最短路径，PostGIS 直接合并成一条 LINESTRING
        /*
         * 这段Java代码拼接了一条复杂的SQL查询语句，核心逻辑全在SQL中，主要用到了PostgreSQL的三个重要扩展：
         * pgRouting（路径规划）、PostGIS（空间数据处理）和原生聚合函数。
         * 
         * 1. pgr_dijkstra(...) AS pgr：这是路径规划的核心。
         * pgr_dijkstra 是 pgRouting 扩展中实现 Dijkstra 算法 的函数。
         * 它把道路网看作一个数学上的“图”来求解最短路径。
         * 该函数对你的路网数据有明确的格式要求：gid是边ID，source是起点节点，target是终点节点，cost是通行成本。
         * 外部参数：?, ?, false：Java中的占位符，分别代表路径起点节点ID、终点节点ID，以及是否双向
         * （false表示有向图，即单行道等限制）。
         * 返回结果包含路径经过的边序列和对应的成本。
         * 
         * 2. JOIN shenzhen_roads r ON pgr.edge = r.gid：
         * 将pgRouting计算出的路径边序列（pgr.edge）与原始路网表（shenzhen_roads）进行连接，
         * 从而获取路径中每一段道路的实际空间几何信息（r.geom）。
         * 
         * 3. st_collect(r.geom ORDER BY seq) + st_linemerge(...)：
         * pgr_dijkstra 返回的是路径经过的边序列——每条边就是路网中的一段路：
         * seq | edge | geom
         * -----+------+--------------------
         * 1 | 235 | LINESTRING(A, B)
         * 2 | 512 | LINESTRING(B, C)
         * 3 | 183 | LINESTRING(C, D)
         * st_collect 把多行合成一个 MultiLineString(AB, BC, CD)，然后 st_linemerge
         * 识别端点相连的线段，首尾拼接成 LINESTRING(A, B, C, D)。
         * 
         * 4. st_astext(...)：
         * PostGIS函数。将合并后的几何对象转换为**WKT（Well-Known Text）**格式字符串，
         * 例如：LINESTRING(114.05 22.5, 114.06 22.51, ...)，方便Java端解析和前端展示。
         * 
         * 5. sum(pgr.cost) AS total_cost：
         * 计算该路径所有路段的通行成本总和，即最短路径的总成本。
         */
        String pgrSql = "SELECT st_astext(st_linemerge(st_collect(r.geom ORDER BY seq))) AS wkt," +
                "sum(pgr.cost) AS total_cost " +
                "FROM pgr_dijkstra('SELECT gid AS id, source, target, cost FROM shenzhen_roads', ?, ?, false) AS pgr " +
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
