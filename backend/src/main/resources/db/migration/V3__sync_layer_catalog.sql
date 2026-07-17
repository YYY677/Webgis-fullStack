-- ============================================================================
-- V3: 同步 layer_catalog 与 public 中实际空间表
-- ============================================================================
-- 变更说明：
--   1. 删除已不存在的表：layer_edit
--   2. 补充新增的表：Borough_London, chongqing_county_border
--   3. 修正已知 geometry_type：capital/port/port_bak→POINT,
--      shenzhen_roads→MULTILINESTRING, test_polygon→POLYGON
-- ============================================================================

-- 删除已不存在的表
DELETE FROM spatial_data.layer_catalog WHERE table_name = 'layer_edit';

-- 补充新增的表
INSERT INTO spatial_data.layer_catalog (name, geometry_type, srid, source, table_name, description)
VALUES
    ('Borough_London',          'MULTIPOLYGON',     4326, 'pre-existing', 'Borough_London',          '伦敦行政区划'),
    ('chongqing_county_border', 'POLYGON',          4326, 'pre-existing', 'chongqing_county_border', '重庆区县边界')
ON CONFLICT (name) DO NOTHING;

-- 修正 geometry_type（使用更精确的类型）
UPDATE spatial_data.layer_catalog SET geometry_type = 'POINT'         WHERE table_name = 'capital';
UPDATE spatial_data.layer_catalog SET geometry_type = 'POINT'         WHERE table_name = 'port';
UPDATE spatial_data.layer_catalog SET geometry_type = 'POINT'         WHERE table_name = 'port_bak';
UPDATE spatial_data.layer_catalog SET geometry_type = 'MULTILINESTRING' WHERE table_name = 'shenzhen_roads';
UPDATE spatial_data.layer_catalog SET geometry_type = 'POLYGON'       WHERE table_name = 'test_polygon';
