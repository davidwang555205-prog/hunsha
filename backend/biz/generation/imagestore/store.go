// Package imagestore 封装 bridal 生图图片的 MinIO/S3 存储与读取，复用 pkg/oss.Client。
// key 格式：generated/{recordId}-{imageNumber}.png（与 Node putImage 对齐，加 generated 前缀便于隔离）。
package imagestore

import (
	"context"
	"fmt"
	"io"
	"log/slog"

	"github.com/samber/do"

	"bridal/backend/config"
	"bridal/backend/pkg/oss"
)

// 生成图在 MinIO 中的 key 前缀。
const imagePrefix = "generated"

// Store 图片存储。
type Store struct {
	client *oss.Client
	cfg    *config.Config
	logger *slog.Logger
}

// NewStore 创建图片存储。ObjectStorage 未启用时返回 nil client 的降级实例（仅 remote 图可用）。
func NewStore(i *do.Injector) (*Store, error) {
	cfg := do.MustInvoke[*config.Config](i)
	logger := do.MustInvoke[*slog.Logger](i).With("module", "imagestore")

	s := &Store{cfg: cfg, logger: logger}
	if !cfg.ObjectStorage.Enabled {
		logger.Warn("object storage disabled, local generated images will be unavailable")
		return s, nil
	}
	opt := oss.S3Option{
		ForcePathStyle: cfg.ObjectStorage.ForcePathStyle,
		InitBucket:     cfg.ObjectStorage.InitBucket,
	}
	client, err := oss.NewS3Compatible(context.Background(), cfg.ObjectStorage, opt)
	if err != nil {
		return nil, fmt.Errorf("new s3 client: %w", err)
	}
	s.client = client
	return s, nil
}

// PutImage 上传生成图，返回访问代理路径（/api/v1/generation/images/{filename}）。
// filename 形如 "{recordId}-{n}.png"。
func (s *Store) PutImage(ctx context.Context, filename string, data []byte, contentType string) (string, error) {
	if s.client == nil {
		return "", fmt.Errorf("object storage disabled")
	}
	if err := s.client.PutFile(ctx, imagePrefix, filename, bytesReader(data)); err != nil {
		return "", err
	}
	// 返回后端代理路径（不暴露 MinIO 直连），与 Node saveGeneratedImages 的 url 设计一致。
	return ImageProxyPath(filename), nil
}

// GetImage 从 MinIO 读取图片流。
func (s *Store) GetImage(ctx context.Context, filename string) (io.ReadCloser, error) {
	if s.client == nil {
		return nil, fmt.Errorf("object storage disabled")
	}
	key := imagePrefix + "/" + filename
	return s.client.GetObject(ctx, key)
}

// ImageProxyPath 返回后端代理访问路径。前端用此 URL 加载 local 图。
func ImageProxyPath(filename string) string {
	return "/api/v1/generation/images/" + filename
}

// bytesReader 避免每次 import bytes。
func bytesReader(data []byte) io.Reader {
	return &byteReader{data: data}
}

type byteReader struct {
	data []byte
	off  int
}

func (r *byteReader) Read(p []byte) (int, error) {
	if r.off >= len(r.data) {
		return 0, io.EOF
	}
	n := copy(p, r.data[r.off:])
	r.off += n
	return n, nil
}
