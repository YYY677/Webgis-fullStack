package com.webgis.geoserver.service;

import org.geotools.api.feature.simple.SimpleFeature;
import org.geotools.api.feature.simple.SimpleFeatureType;
import org.geotools.api.feature.type.AttributeDescriptor;
import org.geotools.api.feature.type.GeometryDescriptor;
import org.geotools.api.referencing.crs.CoordinateReferenceSystem;
import org.geotools.data.simple.SimpleFeatureCollection;
import org.geotools.data.simple.SimpleFeatureIterator;
import org.geotools.geojson.feature.FeatureJSON;
import org.geotools.referencing.CRS;
import org.locationtech.jts.geom.Geometry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.sql.DataSource;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * 数据上传服务 — 解析 Shapefile(.zip/多文件) / GeoJSON → 写入 PostGIS → 发布到 GeoServer
 * <p>
 * 支持三种上传方式：
 * <ol>
 * <li>Shapefile zip 包（.shp + .shx + .dbf）</li>
 * <li>Shapefile 多文件（同时拖选 .shp / .shx / .dbf）</li>
 * <li>GeoJSON 单文件</li>
 * </ol>
 */
@Service
public class DataUploadService {

    private static final Logger log = LoggerFactory.getLogger(DataUploadService.class);
    private static final String TARGET_EPSG = "EPSG:4326";

    private final DataSource dataSource;
    private final FeatureTypeService featureTypeService;

    public DataUploadService(DataSource dataSource, FeatureTypeService featureTypeService) {
        this.dataSource = dataSource;
        this.featureTypeService = featureTypeService;
    }

    // ═══════════════════════════════════════════════════════════════
    // 入口
    // ═══════════════════════════════════════════════════════════════

    public String upload(String workspace, String datastore,
            String tableName, String format,
            MultipartFile[] files) throws Exception {
        log.info("上传: {} 格式={} 文件数={}", tableName, format, files.length);

        SimpleFeatureCollection features = switch (format.toLowerCase()) {
            case "shp" -> parseShapefile(files);
            case "geojson" -> parseGeoJSON(files[0]);
            default -> throw new IllegalArgumentException("仅支持 shp / geojson");
        };

        checkCRS(features.getSchema());
        checkTableNotExists(tableName);
        createTableAndInsert(features.getSchema(), features, tableName);

        try {
            featureTypeService.publish(workspace, datastore, tableName, TARGET_EPSG);
        } catch (Exception e) {
            log.warn("发布失败（表已创建）: {}", e.getMessage());
        }

        return workspace + ":" + tableName;
    }

    // ── 彻底删除 ─────────────────────────────────────────────

    /**
     * DROP TABLE 从 PostgreSQL 中删除数据表
     */
    public void dropTable(String tableName) {
        String sql = "DROP TABLE IF EXISTS public.\"" + tableName + "\" CASCADE";
        try (Connection c = dataSource.getConnection();
                Statement s = c.createStatement()) {
            s.execute(sql);
            log.info("表 {} 已删除", tableName);
        } catch (Exception e) {
            throw new RuntimeException("删除表失败: " + e.getMessage(), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 解析
    // ═══════════════════════════════════════════════════════════════

    /** 解析 Shapefile：支持 zip 或 多文件 */
    private SimpleFeatureCollection parseShapefile(MultipartFile[] files) throws Exception {
        Path tmp = Files.createTempDirectory("shp_"); // 创建临时目录
        try {
            if (isZip(files)) {
                // 方式 A：单 zip
                extractZip(files[0].getBytes(), tmp);
            } else {
                // 方式 B：多文件（.shp .shx .dbf ...）
                for (MultipartFile f : files) {
                    try (FileOutputStream os = new FileOutputStream(tmp.resolve(f.getOriginalFilename()).toFile())) {
                        os.write(f.getBytes());
                    }
                }
            }

            // 校验必需文件
            boolean hasShp = hasFile(tmp.toFile(), ".shp");
            boolean hasShx = hasFile(tmp.toFile(), ".shx");
            boolean hasDbf = hasFile(tmp.toFile(), ".dbf");
            if (!hasShp || !hasShx || !hasDbf) {
                throw new IllegalArgumentException("缺少必需文件: .shp / .shx / .dbf");
            }

            // 找到 .shp 文件并用 GeoTools 标准 API 打开
            File shpFile = firstFile(tmp.toFile(), ".shp"); // 取第一个 .shp 文件
            if (shpFile == null || !shpFile.canRead()) {
                throw new IllegalArgumentException("找不到可读取的 .shp 文件");
            }
            log.info("读取 Shapefile: {} ({} bytes)", shpFile.getAbsolutePath(), shpFile.length());

            // 用 GeoTools 标准 API 打开（比直接 new ShapefileDataStore 更稳健）
            java.util.HashMap<String, Object> params = new java.util.HashMap<>();
            params.put("url", shpFile.toURI().toURL());
            org.geotools.api.data.DataStore store = org.geotools.api.data.DataStoreFinder.getDataStore(params);
            if (store == null) {
                throw new IllegalArgumentException("无法识别 Shapefile 格式，确认 .shp/.shx/.dbf 文件齐全");
            }
            // 获取要素源并返回（关键！）
            org.geotools.api.data.SimpleFeatureSource src = store.getFeatureSource(store.getTypeNames()[0]);
            // getFeatures() 返回懒加载集合，必须在删除临时文件前复制到内存
            SimpleFeatureCollection lazyCol = src.getFeatures(); // 懒加载
            // 立即遍历 lazyCol，把所有要素急切地复制到内存中
            return new org.geotools.feature.DefaultFeatureCollection(lazyCol);
        } finally {
            // 无论是否发生异常，最后都删除临时目录
            // 因为数据已经复制到内存（DefaultFeatureCollection），删除磁盘文件不影响使用
            deleteRec(tmp.toFile());
        }
    }

    /** 判断是否只有一个 zip 文件 */
    private boolean isZip(MultipartFile[] files) {
        if (files.length != 1)
            return false;
        String n = files[0].getOriginalFilename();
        return n != null && n.toLowerCase().endsWith(".zip");
    }

    /** 解压 zip 到目标目录（平铺，忽略目录结构） */
    private void extractZip(byte[] zipBytes, Path target) throws IOException {
        // ZipInputStream 按 entry 流式读取 zip
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            ZipEntry e; // ZipEntry是 zip 里的每一条记录（文件或目录），包含名字、大小、压缩方式等元信息
            // 逐条读 zip 里的 entry（文件或目录）。每调一次 getNextEntry()，内部游标移到下一条。
            while ((e = zis.getNextEntry()) != null) {
                String name = new File(e.getName()).getName(); // 去掉目录前缀，防止目录遍历攻击
                if (name.isEmpty())
                    continue;
                Path f = target.resolve(name); // 目标文件路径
                // 流式写入：从 zip entry 读一截（8KB 缓冲区），写一截到文件。不一次性把整个 entry 读进内存再写
                try (FileOutputStream os = new FileOutputStream(f.toFile())) {
                    byte[] buf = new byte[8192];
                    int len;
                    while ((len = zis.read(buf)) > 0)
                        os.write(buf, 0, len);
                }
                // 关闭当前 entry，准备读下一条。try-with-resources 确保整个 zis 最后自动关闭。
                zis.closeEntry(); 
            }
        }
    }

    /** 解析 GeoJSON */
    private SimpleFeatureCollection parseGeoJSON(MultipartFile file) throws Exception {
        byte[] bytes = file.getBytes();
        if (bytes.length == 0)
            throw new IllegalArgumentException("GeoJSON 文件为空");
        FeatureJSON fj = new FeatureJSON();
        SimpleFeatureCollection fc = (SimpleFeatureCollection) fj
                .readFeatureCollection(new ByteArrayInputStream(bytes));
        if (fc.size() == 0)
            throw new IllegalArgumentException("GeoJSON 无要素");
        return fc;
    }

    // ═══════════════════════════════════════════════════════════════
    // 校验
    // ═══════════════════════════════════════════════════════════════

    /** 校验坐标系：null 则默认视为 EPSG:4326，Shapefile 无 .prj 时也按此处理 */
    private void checkCRS(SimpleFeatureType schema) throws Exception {
        CoordinateReferenceSystem crs = schema.getCoordinateReferenceSystem();
        if (crs == null) {
            log.warn("数据未定义坐标系，默认视为 {}", TARGET_EPSG);
            return; // GeoJSON 规范 / Shapefile 无 .prj 默认 WGS84
        }
        String code = CRS.lookupIdentifier(crs, true);
        if (!TARGET_EPSG.equals(code))
            throw new IllegalArgumentException("坐标系需 " + TARGET_EPSG + "，当前为 " + code);
    }

    /**
     * 将几何对象转换为 EPSG:4326 的 WKT，并确保 SRID 不会被 PostGIS 误解。
     * <p>
     * 关键：即使 checkCRS 声明是 4326，也要显式设 SRID=4326。
     * 否则 PostGIS 的 ST_GeomFromText(wkt, 4326) 只是"标记"SRID，
     * 不改变坐标值——如果坐标实际上不是度而是米，就会存成错误数据。
     */
    private String geomToWKT4326(Geometry g) {
        g.setSRID(4326); // 显式标记 SRID
        return g.toText(); // WKT 不含 SRID，配合 ST_GeomFromText(?, 4326) 一起用
    }

    private void checkTableNotExists(String name) {
        try (Connection c = dataSource.getConnection();
                PreparedStatement ps = c.prepareStatement(
                        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=?)")) {
            ps.setString(1, name);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next() && rs.getBoolean(1))
                    throw new IllegalArgumentException("表 '" + name + "' 已存在");
            }
        } catch (Exception e) {
            if (e instanceof IllegalArgumentException)
                throw (IllegalArgumentException) e;
            throw new RuntimeException(e);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 建表 + 写入
    // ═══════════════════════════════════════════════════════════════

    /**
     * 根据 GeoTools Schema 自动创建 PostGIS 表 + 批量写入要素数据
     * <p>
     * 整个过程在同一事务内：建表失败则数据也不会写入，避免"有表没数据"的中间状态。
     */
    private void createTableAndInsert(SimpleFeatureType schema, SimpleFeatureCollection features, String table)
            throws Exception {
        // ── 1. 拆出几何列和普通属性列 ──────────────────────────
        // schema 包含所有列的元信息：几何列（如 geom/geometry） + 普通属性（如 name, population）
        // 后面拼 INSERT 时几何列用 ST_GeomFromText，普通列用 ?
        GeometryDescriptor geomDesc = schema.getGeometryDescriptor();             // 几何列的描述信息
        List<AttributeDescriptor> attrs = new ArrayList<>();                       // 非几何的属性列
        for (AttributeDescriptor ad : schema.getAttributeDescriptors())
            if (!ad.equals(geomDesc))
                attrs.add(ad);

        // ── 2. 拼 DDL ───────────────────────────────────────────
        // 产物:
        //   CREATE TABLE public."provinces" (
        //     "fid" SERIAL PRIMARY KEY,
        //     "name" TEXT, "pop" INTEGER,
        //     "geom" geometry(MULTIPOLYGON, 4326)
        //   )
        // 其中 geometry(MULTIPOLYGON, 4326) 是 PostGIS 的类型声明，限制只能存 MULTIPOLYGON + SRID 4326
        String geomType = geomDesc.getType().getBinding().getSimpleName().toUpperCase();  // POLYGON / MULTIPOLYGON / POINT ...
        String ddl = "CREATE TABLE public.\"" + table + "\" (\"fid\" SERIAL PRIMARY KEY";
        for (AttributeDescriptor ad : attrs)
            ddl += ", \"" + ad.getLocalName() + "\" " + toSqlType(ad.getType().getBinding());
        ddl += ", \"geom\" geometry(" + geomType + ", 4326))";

        // ── 3. 建表 + 写入（同一事务） ────────────────────────
        try (Connection c = dataSource.getConnection()) {
            c.setAutoCommit(false);                           // 开启手动事务：DDL 和 INSERT 要么全成功，要么全回滚
            try (Statement s = c.createStatement()) {
                s.execute(ddl);                               // 执行建表 DDL
            }
            int n = insert(c, table, attrs, geomDesc, features);   // JDBC 批量写入数据
            c.commit();                                        // 提交事务
            log.info("{} → {} 条", table, n);
        }  // 抛异常 → commit 没执行 → 自动 rollback
    }

    /**
     * JDBC 批量 INSERT — 遍历 GeoTools 要素，逐条设参数，攒批提交
     * <p>
     * 关键机制：
     * <ul>
     *   <li>addBatch + executeBatch：攒满 500 条发一次，减少数据库网络往返</li>
     *   <li>几何字段转 WKT 用 ST_GeomFromText(?, 4326) 写入，保证 SRID 正确标记</li>
     *   <li>null 属性必须显式 setNull，setObject(null) 会抛异常</li>
     *   <li>fid 是自增主键，传 DEFAULT 让数据库自动生成</li>
     * </ul>
     */
    private int insert(Connection c, String table, List<AttributeDescriptor> attrs,
            GeometryDescriptor geomDesc, SimpleFeatureCollection features) throws Exception {
        // ── 1. 拼 INSERT 模板 ──────────────────────────────────
        // 产物:
        //   INSERT INTO public."provinces" ("fid", "name", "pop", "geom")
        //   VALUES (DEFAULT, ?, ?, ST_GeomFromText(?, 4326))
        StringBuilder cols = new StringBuilder("\"fid\""), vals = new StringBuilder("DEFAULT");
        for (AttributeDescriptor a : attrs) {
            cols.append(", \"").append(a.getLocalName()).append("\"");   // 普通属性列名
            vals.append(", ?");                                           // 对应的 ? 占位
        }
        cols.append(", \"geom\"");                                        // 几何列名
        vals.append(", ST_GeomFromText(?, 4326)");                        // 几何值用 WKT 传 + 指定 SRID
        String sql = "INSERT INTO public.\"" + table + "\" (" + cols + ") VALUES (" + vals + ")";

        // ── 2. 逐条遍历要素，设参，攒批 ──────────────────────
        int cnt = 0;
        try (PreparedStatement ps = c.prepareStatement(sql);
                SimpleFeatureIterator it = features.features()) {     // GeoTools 的迭代器，遍历每条要素
            while (it.hasNext()) {
                SimpleFeature f = it.next();   // 一条要素 = 一行记录
                int i = 1;                     // SQL 参数下标从 1 开始

                // ── 设普通属性 ──
                for (AttributeDescriptor a : attrs) {
                    Object v = f.getAttribute(a.getLocalName());           // 按字段名取值
                    if (v == null)
                        ps.setNull(i++, Types.NULL);      // null 必须显式设，否则报错
                    else
                        ps.setObject(i++, v);             // 非 null 让 JDBC 自动匹配类型
                }

                // ── 设几何值 ──
                Geometry g = (Geometry) f.getDefaultGeometry();            // 要素的几何对象
                if (g != null)
                    ps.setString(i, geomToWKT4326(g));    // JTS Geometry → WKT 字符串，给 ST_GeomFromText 用
                else
                    ps.setNull(i, Types.VARCHAR);

                ps.addBatch();                            // 加入当前批次
                if (++cnt % 500 == 0)
                    ps.executeBatch();                    // 攒够 500 条，先刷一次
            }
            ps.executeBatch();                            // 刷掉最后不足 500 条的那批
        }
        return cnt;
    }

    // ═══════════════════════════════════════════════════════════════
    // 工具
    // ═══════════════════════════════════════════════════════════════

    private String toSqlType(Class<?> b) {
        if (b == null || b == String.class)
            return "TEXT";
        if (b == Integer.class || b == int.class)
            return "INTEGER";
        if (b == Long.class || b == long.class)
            return "BIGINT";
        if (b == Double.class || b == double.class)
            return "DOUBLE PRECISION";
        if (b == Float.class || b == float.class)
            return "REAL";
        if (b == Boolean.class || b == boolean.class)
            return "BOOLEAN";
        if (java.util.Date.class.isAssignableFrom(b)
                || java.sql.Date.class.isAssignableFrom(b)
                || Timestamp.class.isAssignableFrom(b))
            return "TIMESTAMP";
        return "TEXT";
    }

    private boolean hasFile(File dir, String suffix) {
        File[] fs = dir.listFiles((d, n) -> n.toLowerCase().endsWith(suffix));
        return fs != null && fs.length > 0;
    }

    private File firstFile(File dir, String suffix) {
        File[] fs = dir.listFiles((d, n) -> n.toLowerCase().endsWith(suffix));
        return fs != null && fs.length > 0 ? fs[0] : null;
    }

    private void deleteRec(File f) {
        if (f.isDirectory()) {
            File[] ch = f.listFiles();
            if (ch != null)
                for (File c : ch)
                    deleteRec(c);
        }
        f.delete();
    }
}
