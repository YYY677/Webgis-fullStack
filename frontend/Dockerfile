# 阶段 1：执行 Vite 的类型检查、构建和 Cesium 资源搬运脚本。
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

# 所有 VITE_* 变量都会在构建后进入浏览器代码；仅传递可公开的地图服务 Token。
ARG VITE_DEPLOY_BASE=/
ARG VITE_BASE_URL=/api
ARG VITE_API_BASE_URL=/api
ARG VITE_AUTH_MODE=remote
ARG VITE_TIANDITU_KEY=
ARG VITE_CESIUM_TOKEN=

ENV VITE_DEPLOY_BASE=$VITE_DEPLOY_BASE \
    VITE_BASE_URL=$VITE_BASE_URL \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_AUTH_MODE=$VITE_AUTH_MODE \
    VITE_TIANDITU_KEY=$VITE_TIANDITU_KEY \
    VITE_CESIUM_TOKEN=$VITE_CESIUM_TOKEN

RUN npm run build

# 阶段 2：Nginx 同时托管静态文件并反向代理后端与 GeoServer。
FROM nginx:1.27-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
