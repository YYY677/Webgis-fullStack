package com.webgis.geoserver.service;

import com.webgis.geoserver.client.GeoServerClient;
import com.webgis.geoserver.dto.DataStoreInfo;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Service
public class DataStoreService {

    private final GeoServerClient client;

    public DataStoreService(GeoServerClient client) {
        this.client = client;
    }

    @SuppressWarnings("unchecked")
    public Mono<List<DataStoreInfo>> list(String workspace) {
        // 案例：
        // http://localhost:8081/geoserver/rest/workspaces/webgistest/datastores.json
        // {"dataStores":{"dataStore":[{"name":"pg-webgistest","href":"http://localhost:8081/geoserver/rest/workspaces/webgistest/datastores/pg-webgistest.json"}]}}
        return client.get("/workspaces/" + workspace + "/datastores.json", Map.class)
                // root 是 GeoServer 返回的 JSON 对象，类型为 Map<String, Object>，包含 dataStores 字段
                .map(root -> {
                    Map<String, Object> ds = (Map<String, Object>) root.get("dataStores");
                    if (ds == null || ds.get("dataStore") == null) return List.<DataStoreInfo>of();
                    return WorkspaceService.normalizeList(ds.get("dataStore")).stream()
                            .map(m -> new DataStoreInfo((String) m.get("name"), null, (String) m.get("href")))
                            .toList(); // 将 List<Map<String, Object>> 转换为 List<DataStoreInfo>
                });
    }

    public Mono<String> createPostGIS(String workspace, String name,
                                       String host, int port, String database,
                                       String user, String password, String schema) {

        Map<String, Object> connectionParams = Map.of(
                "dbtype", "postgis", "host", host, "port", String.valueOf(port),
                "database", database, "user", user, "passwd", password, "schema", schema);
        //{
        //  "dataStore": {
        //    "name": "my_postgis_store",
        //    "connectionParameters": {
        //      "entry": [
        //        { "@key": "dbtype", "$": "postgis" },
        //        { "@key": "host", "$": "localhost" },
        //        { "@key": "port", "$": "5432" },
        //        { "@key": "database", "$": "webgistest" },
        //        { "@key": "user", "$": "postgres" },
        //        { "@key": "passwd", "$": "123456" },
        //        { "@key": "schema", "$": "public" }
        //      ]
        //    }
        //  }
        //}
        Map<String, Object> body = Map.of("dataStore",
                Map.of("name", name,
                        "connectionParameters", Map.of("entry",
                                // connectionParams.entrySet()：把 Map 的每一对键值变成一个GeoServer 要求的 Entry 对象
                                // 比如 dbtype=postgis 这一对，就变成了 { "@key": "dbtype", "$": "postgis" }
                                connectionParams.entrySet().stream()
                                        .map(e -> Map.of("@key", e.getKey(), "$", e.getValue()))
                                        .toList())));

        return client.post("/workspaces/" + workspace + "/datastores.json", body, String.class);
    }
}
