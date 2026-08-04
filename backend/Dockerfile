# 阶段 1：在 Maven + Java 17 环境编译 Spring Boot 可执行 JAR。
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /workspace

# 先复制 POM 以利于 Docker 复用 Maven 依赖缓存层。
COPY pom.xml ./
RUN mvn -B -q dependency:go-offline

# 再复制源码；源码变化只会使这一层及后续层重新构建。
COPY src ./src
RUN mvn -B -DskipTests package

# 阶段 2：运行镜像不携带 Maven、源码和本地仓库。
FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

COPY --from=build /workspace/target/*.jar /app/webgis-backend.jar

EXPOSE 8080

# 生产配置全部由 Compose 环境变量覆盖 application.yml 中的本地开发值。
ENTRYPOINT ["java", "-jar", "/app/webgis-backend.jar"]
