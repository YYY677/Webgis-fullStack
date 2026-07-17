package com.webgis.spatial.dto;

/**
 * 表字段元数据
 */
public class FieldInfoVO {

    private String name;
    private String type;
    private boolean geom;
    private boolean pk;

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
