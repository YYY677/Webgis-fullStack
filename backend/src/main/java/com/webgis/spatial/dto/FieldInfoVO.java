package com.webgis.spatial.dto;

/**
 * 表字段元数据
 */
public class FieldInfoVO {

    private String name; // 字段名 
    private String type; // 字段类型
    private boolean geom; // 是否为 geometry 字段
    private boolean pk; // 是否为主键字段

    public FieldInfoVO() {}

    public FieldInfoVO(String name, String type, boolean geom, boolean pk) {
        this.name = name;
        this.type = type;
        this.geom = geom;
        this.pk = pk;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public boolean isGeom() { return geom; }
    public void setGeom(boolean geom) { this.geom = geom; }

    public boolean isPk() { return pk; }
    public void setPk(boolean pk) { this.pk = pk; }
}
