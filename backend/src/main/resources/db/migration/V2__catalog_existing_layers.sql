-- ============================================================================
-- V2: 将 public  schema 中已有的空间表编入 spatial_data.layer_catalog
-- ============================================================================
-- 说明：
--   - GeoServer 的数据存储指向物理表，所以物理表不移动（保留在 public）
--   - 仅把元数据（名称、几何类型、SRID、表名）登记到 layer_catalog
--   - ON CONFLICT DO NOTHING：重复执行不会报错（幂等）
-- ============================================================================

INSERT INTO spatial_data.layer_catalog (name, geometry_type, srid, source, table_name, description)
VALUES
    ('capital',                 'GEOMETRY',      4326, 'pre-existing', 'capital',                 '省会城市点位'),
    ('layer_edit',              'GEOMETRY',         0, 'pre-existing', 'layer_edit',              '编辑测试图层'),
    ('layer_university',        'GEOMETRY',      4326, 'pre-existing', 'layer_university',        '大学分布数据'),
    ('port',                    'GEOMETRY',      4326, 'pre-existing', 'port',                    '港口点位（WFS 演示）'),
    ('port_bak',                'GEOMETRY',      4326, 'pre-existing', 'port_bak',                '港口备份'),
    ('province_border',         'MULTIPOLYGON',  4326, 'pre-existing', 'province_border',         '省份边界数据'),
    ('shenzhen_roads',          'GEOMETRY',      4326, 'pre-existing', 'shenzhen_roads',          '深圳路网'),
    ('shenzhen_roads_vertices_pgr', 'POINT',     4326, 'pre-existing', 'shenzhen_roads_vertices_pgr', '路网顶点（pgRouting）'),
    ('test_polygon',            'GEOMETRY',         0, 'pre-existing', 'test_polygon',            '测试面数据')
ON CONFLICT (name) DO NOTHING;
