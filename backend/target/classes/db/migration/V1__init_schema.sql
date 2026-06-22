-- Initialize business schema and user table
CREATE SCHEMA IF NOT EXISTS business_data;

CREATE TABLE IF NOT EXISTS business_data.sys_user (
    id           BIGSERIAL PRIMARY KEY,
    username     VARCHAR(50) UNIQUE NOT NULL,
    password     VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role         VARCHAR(20)   NOT NULL DEFAULT 'user',
    status       INTEGER       NOT NULL DEFAULT 1,
    created_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sys_user_username ON business_data.sys_user(username);

-- Initialize spatial schema and layer catalog
CREATE SCHEMA IF NOT EXISTS spatial_data;

CREATE TABLE IF NOT EXISTS spatial_data.layer_catalog (
    id             SERIAL       PRIMARY KEY,
    name           VARCHAR(100) UNIQUE NOT NULL,
    geometry_type  VARCHAR(50),
    srid           INTEGER      DEFAULT 4326,
    source         VARCHAR(50)  DEFAULT 'upload',
    description    TEXT,
    table_name     VARCHAR(100),
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_layer_catalog_name ON spatial_data.layer_catalog(name);
