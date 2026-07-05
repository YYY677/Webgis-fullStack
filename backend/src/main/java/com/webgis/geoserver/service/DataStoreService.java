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
        return client.get("/workspaces/" + workspace + "/datastores.json", Map.class)
                .map(root -> {
                    Map<String, Object> ds = (Map<String, Object>) root.get("dataStores");
                    if (ds == null || ds.get("dataStore") == null) return List.<DataStoreInfo>of();
                    return WorkspaceService.normalizeList(ds.get("dataStore")).stream()
                            .map(m -> new DataStoreInfo((String) m.get("name"), null, (String) m.get("href")))
                            .toList();
                });
    }

    public Mono<String> createPostGIS(String workspace, String name,
                                       String host, int port, String database,
                                       String user, String password, String schema) {

        Map<String, Object> connectionParams = Map.of(
                "dbtype", "postgis", "host", host, "port", String.valueOf(port),
                "database", database, "user", user, "passwd", password, "schema", schema);

        Map<String, Object> body = Map.of("dataStore",
                Map.of("name", name,
                        "connectionParameters", Map.of("entry",
                                connectionParams.entrySet().stream()
                                        .map(e -> Map.of("@key", e.getKey(), "$", e.getValue()))
                                        .toList())));

        return client.post("/workspaces/" + workspace + "/datastores.json", body, String.class);
    }
}
