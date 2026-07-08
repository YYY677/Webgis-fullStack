package com.webgis.common;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

@RestController  // 标识这是一个控制器，所有方法返回的数据直接写入 HTTP 响应体（JSON）
public class HealthController {

    @GetMapping("/api/health")  // 绑定 GET 请求路径
    public Result<Map<String, Object>> health() {
        // 返回一个统一的 Result 包装类（你项目里的标准响应格式）
        return Result.success(Map.of(
                "status", "UP",          // UP 表示服务正常运行（通常还有 DOWN 状态）
                "timestamp", LocalDateTime.now().toString()  // 加上时间戳，方便排查时间点
        ));
    }
}