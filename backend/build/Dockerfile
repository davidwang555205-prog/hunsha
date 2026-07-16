# Go 后端镜像（多阶段构建）
# 构建：docker compose build go-backend
FROM golang:1.25-alpine AS builder
WORKDIR /app
# 先复制依赖，利用层缓存
COPY backend/go.mod backend/go.sum ./
ENV GOPROXY=https://goproxy.cn,direct
RUN go mod download
# 复制源码
COPY backend/ ./
# 静态构建（CGO_ENABLED=0，适合 alpine）
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# 运行阶段
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
ENV TZ=Asia/Shanghai
WORKDIR /app
# 二进制
COPY --from=builder /out/server /app/server
# 默认配置模板（docker-compose 用 env 覆盖 DB/Redis/MinIO 连接字段）
COPY backend/config/server/config.yaml.example /app/config/server/config.yaml
# 迁移文件（首启 store.MigrateSQL 读 file://migration，相对 WORKDIR /app）
COPY backend/migration /app/migration
EXPOSE 8888
CMD ["/app/server"]
