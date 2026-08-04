#!/bin/sh
# GeoServer 完整 Data Directory 的一次性初始化器。
# 规则：已有 global.xml 代表目录已经可用，绝不解压覆盖；非空但不完整则停止，避免把两套目录混在一起。
set -eu

DATA_DIR="${GEOSERVER_DATA_DIR:-/opt/geoserver_data}"

if [ -f "$DATA_DIR/global.xml" ]; then
  echo "GeoServer Data Directory already exists; skip ZIP extraction."
  exit 0
fi

if [ -n "$(find "$DATA_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]; then
  echo "GeoServer Data Directory is not empty but global.xml is missing: $DATA_DIR" >&2
  echo "Refusing to merge GeoServer.zip into a partial directory." >&2
  exit 1
fi

echo "Extracting the complete GeoServer Data Directory into $DATA_DIR ..."
unzip -q /bootstrap/GeoServer.zip -d "$DATA_DIR"

# 官方 GeoServer 镜像默认使用 UID/GID 999 运行；预先调整权限，避免首启无法写日志、锁或缓存。
chown -R 999:999 "$DATA_DIR"

test -f "$DATA_DIR/global.xml"
echo "GeoServer Data Directory initialization completed."
