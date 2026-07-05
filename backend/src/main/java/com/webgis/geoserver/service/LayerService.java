package com.webgis.geoserver.service;

import com.webgis.geoserver.client.GeoServerClient;
import com.webgis.geoserver.dto.LayerInfo;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Service
public class LayerService {

    private final GeoServerClient client;

    public LayerService(GeoServerClient client) {
        this.client = client;
    }

    @SuppressWarnings("unchecked")
    public Mono<List<LayerInfo>> list(String workspace) {
        return client.get("/layers.json", Map.class)
                .map(root -> {
                    Map<String, Object> layers = (Map<String, Object>) root.get("layers");
                    if (layers == null || layers.get("layer") == null) return List.<LayerInfo>of();
                    return WorkspaceService.normalizeList(layers.get("layer")).stream()
                            .filter(m -> workspace == null || workspace.isEmpty()
                                    || ((String) m.get("name")).startsWith(workspace + ":"))
                            .map(m -> new LayerInfo((String) m.get("name"), null, null))
                            .toList();
                });
    }

    @SuppressWarnings("unchecked")
    public Mono<String> publish(String workspace, String datastore, String featureType) {
        Map<String, Object> body = Map.of("featureType", Map.of("name", featureType));
        return client.post("/workspaces/" + workspace + "/datastores/" + datastore + "/featuretypes.json", body, String.class);
    }
}
