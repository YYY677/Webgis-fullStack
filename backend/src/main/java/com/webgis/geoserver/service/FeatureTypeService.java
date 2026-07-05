package com.webgis.geoserver.service;

import com.webgis.geoserver.client.GeoServerClient;
import com.webgis.geoserver.dto.FeatureTypeInfo;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Service
public class FeatureTypeService {

    private final GeoServerClient client;

    public FeatureTypeService(GeoServerClient client) {
        this.client = client;
    }

    @SuppressWarnings("unchecked")
    public Mono<List<FeatureTypeInfo>> list(String workspace, String datastore) {
        return client.get("/workspaces/" + workspace + "/datastores/" + datastore + "/featuretypes.json", Map.class)
                .map(root -> {
                    Map<String, Object> ft = (Map<String, Object>) root.get("featureTypes");
                    if (ft == null || ft.get("featureType") == null) return List.<FeatureTypeInfo>of();
                    return WorkspaceService.normalizeList(ft.get("featureType")).stream()
                            .map(m -> new FeatureTypeInfo((String) m.get("name"), (String) m.get("title"), null))
                            .toList();
                });
    }
}
