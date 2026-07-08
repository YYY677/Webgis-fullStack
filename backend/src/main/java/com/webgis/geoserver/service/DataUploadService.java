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
 *   <li>Shapefile zip 包（.shp + .shx + .dbf）</li>
 *   <li>Shapefile 多文件（同时拖选 .shp / .shx / .dbf）</li>
 *   <li>GeoJSON 单文件</li>
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

        try { featureTypeService.publish(workspace, datastore, tableName, TARGET_EPSG); }
        catch (Exception e) { log.warn("发布失败（表已创建）: {}", e.getMessage()); }

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
        Path tmp = Files.createTempDirectory("shp_");
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

            File shpFile = firstFile(tmp.toFile(), ".shp");
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
            org.geotools.api.data.SimpleFeatureSource src = store.getFeatureSource(store.getTypeNames()[0]);
            // getFeatures() 返回懒加载集合，必须在删除临时文件前急切复制到内存
            SimpleFeatureCollection lazyCol = src.getFeatures();
            return new org.geotools.feature.DefaultFeatureCollection(lazyCol);
        } finally {
            deleteRec(tmp.toFile());
        }
    }

    /** 判断是否只有一个 zip 文件 */
    private boolean isZip(MultipartFile[] files) {
        if (files.length != 1) return false;
        String n = files[0].getOriginalFilename();
        return n != null && n.toLowerCase().endsWith(".zip");
    }

    /** 解压 zip 到目标目录（平铺，忽略目录结构） */
    private void extractZip(byte[] zipBytes, Path target) throws IOException {
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            ZipEntry e;
            while ((e = zis.getNextEntry()) != null) {
                String name = new File(e.getName()).getName(); // 去掉目录前缀
                if (name.isEmpty()) continue;
                Path f = target.resolve(name);
                try (FileOutputStream os = new FileOutputStream(f.toFile())) {
                    byte[] buf = new byte[8192];
                    int len;
                    while ((len = zis.read(buf)) > 0) os.write(buf, 0, len);
                }
                zis.closeEntry();
            }
        }
    }

    /** 解析 GeoJSON */
    private SimpleFeatureCollection parseGeoJSON(MultipartFile file) throws Exception {
        byte[] bytes = file.getBytes();
        if (bytes.length == 0) throw new IllegalArgumentException("GeoJSON 文件为空");
        FeatureJSON fj = new FeatureJSON();
        SimpleFeatureCollection fc = (SimpleFeatureCollection) fj.readFeatureCollection(new ByteArrayInputStream(bytes));
        if (fc.size() == 0) throw new IllegalArgumentException("GeoJSON 无要素");
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
        g.setSRID(4326);   // 显式标记 SRID
        return g.toText();  // WKT 不含 SRID，配合 ST_GeomFromText(?, 4326) 一起用
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
            if (e instanceof IllegalArgumentException) throw (IllegalArgumentException) e;
            throw new RuntimeException(e);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 建表 + 写入
    // ═══════════════════════════════════════════════════════════════

    private void createTableAndInsert(SimpleFeatureType schema, SimpleFeatureCollection features, String table) throws Exception {
        GeometryDescriptor geomDesc = schema.getGeometryDescriptor();
        List<AttributeDescriptor> attrs = new ArrayList<>();
        for (AttributeDescriptor ad : schema.getAttributeDescriptors())
            if (!ad.equals(geomDesc)) attrs.add(ad);

        String geomType = geomDesc.getType().getBinding().getSimpleName().toUpperCase();
        String ddl = "CREATE TABLE public.\"" + table + "\" (\"fid\" SERIAL PRIMARY KEY";
        for (AttributeDescriptor ad : attrs)
            ddl += ", \"" + ad.getLocalName() + "\" " + toSqlType(ad.getType().getBinding());
        ddl += ", \"geom\" geometry(" + geomType + ", 4326))";

        try (Connection c = dataSource.getConnection()) {
            c.setAutoCommit(false);
            try (Statement s = c.createStatement()) { s.execute(ddl); }
            int n = insert(c, table, attrs, geomDesc, features);
            c.commit();
            log.info("{} → {} 条", table, n);
        }
    }

    private int insert(Connection c, String table, List<AttributeDescriptor> attrs,
                       GeometryDescriptor geomDesc, SimpleFeatureCollection features) throws Exception {
        StringBuilder cols = new StringBuilder("\"fid\""), vals = new StringBuilder("DEFAULT");
        for (AttributeDescriptor a : attrs) {
            cols.append(", \"").append(a.getLocalName()).append("\"");
            vals.append(", ?");
        }
        cols.append(", \"geom\"");
        vals.append(", ST_GeomFromText(?, 4326)");
        String sql = "INSERT INTO public.\"" + table + "\" (" + cols + ") VALUES (" + vals + ")";

        int cnt = 0;
        try (PreparedStatement ps = c.prepareStatement(sql);
             SimpleFeatureIterator it = features.features()) {
            while (it.hasNext()) {
                SimpleFeature f = it.next();
                int i = 1;
                for (AttributeDescriptor a : attrs) {
                    Object v = f.getAttribute(a.getLocalName());
                    if (v == null) ps.setNull(i++, Types.NULL);
                    else ps.setObject(i++, v);
                }
                Geometry g = (Geometry) f.getDefaultGeometry();
                if (g != null) ps.setString(i, geomToWKT4326(g));
                else ps.setNull(i, Types.VARCHAR);
                ps.addBatch();
                if (++cnt % 500 == 0) ps.executeBatch();
            }
            ps.executeBatch();
        }
        return cnt;
    }

    // ═══════════════════════════════════════════════════════════════
    // 工具
    // ═══════════════════════════════════════════════════════════════

    private String toSqlType(Class<?> b) {
        if (b == null || b == String.class) return "TEXT";
        if (b == Integer.class || b == int.class) return "INTEGER";
        if (b == Long.class || b == long.class) return "BIGINT";
        if (b == Double.class || b == double.class) return "DOUBLE PRECISION";
        if (b == Float.class || b == float.class) return "REAL";
        if (b == Boolean.class || b == boolean.class) return "BOOLEAN";
        if (java.util.Date.class.isAssignableFrom(b)
            || java.sql.Date.class.isAssignableFrom(b)
            || Timestamp.class.isAssignableFrom(b)) return "TIMESTAMP";
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
        if (f.isDirectory()) { File[] ch = f.listFiles(); if (ch != null) for (File c : ch) deleteRec(c); }
        f.delete();
    }
}
