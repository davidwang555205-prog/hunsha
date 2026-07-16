# nginx + 前端镜像（多阶段：node 构建 -> nginx 运行）
# 构建：docker compose build nginx
FROM node:20-alpine AS builder
WORKDIR /app
# 先装依赖，利用层缓存
COPY package.json package-lock.json ./
RUN npm ci
# 复制前端源码并构建（产出 /app/dist）
COPY . .
RUN npm run build

FROM nginx:1.25-alpine
# 前端产物
COPY --from=builder /app/dist /usr/share/nginx/html
# nginx.conf 由 docker-compose volume 挂载（方便修改，reload 即生效），此处不 COPY
EXPOSE 80
