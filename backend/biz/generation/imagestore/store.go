// Package imagestore 封装 bridal 生图图片的 MinIO/S3 存储与读取，复用 pkg/oss.Client。
// key 格式：generated/{recordId}-{imageNumber}.png（与 Node putImage 对齐，加 generated 前缀便于隔离）。
package imagestore

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"io"
	"log/slog"
	"path/filepath"
	"strings"

	"github.com/samber/do"
	"golang.org/x/image/draw"

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
	if err := s.client.PutFile(ctx, imagePrefix, filename, bytes.NewReader(data)); err != nil {
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

// PublicURL 返回图片公开访问 URL。
// public_read=true（COS 公有读桶）返回 COS 公开直连 URL（浏览器直达 CDN，省 Go 代理中转）；
// 否则回退代理路径（dev 私有 MinIO 桶兜底，不破坏本地开发）。
func (s *Store) PublicURL(filename string) string {
	if s.client == nil || !s.cfg.ObjectStorage.PublicRead {
		return ImageProxyPath(filename)
	}
	return s.client.GetURL(imagePrefix, filename)
}

// ThumbURL 返回历史图缩略图 URL（历史图无存储缩略图对象的兜底）。
// public_read=true 时为 COS 公开 URL + imageMogr2 等比缩放（480px，2.3MB 原图->~260KB）；
// 否则返回空串（dev MinIO 不支持 imageMogr2，前端兜底用原图 URL）。
// 新生成图用 PutThumbnail 存储的缩略图对象，不走此方法。
func (s *Store) ThumbURL(filename string) string {
	if s.client == nil || !s.cfg.ObjectStorage.PublicRead {
		return ""
	}
	return s.client.GetURL(imagePrefix, filename) + "?imageMogr2/thumbnail/480x480"
}

// PutThumbnail 从原图 data 生成缩略图（480 宽等比 JPEG 质量 85）并存储，返回代理路径。
// 缩略图对象 key = generated/{原图basename去ext}.thumb.jpg。生图时调用，ThumbURL 存 DB。
func (s *Store) PutThumbnail(ctx context.Context, origFilename string, data []byte) (string, error) {
	if s.client == nil {
		return "", fmt.Errorf("object storage disabled")
	}
	// 解码原图（PNG/JPEG，image/png + image/jpeg side-effect import 注册解码器）
	srcImg, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("decode image %s: %w", origFilename, err)
	}
	// 等比缩放到 480 宽（小图不放大）
	const maxW = 480
	bounds := srcImg.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w > maxW {
		h = h * maxW / w
		w = maxW
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.CatmullRom.Scale(dst, dst.Rect, srcImg, bounds, draw.Over, nil)
	// 编码 JPEG 质量 85（婚纱图无透明需求，JPEG 体积小）
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 85}); err != nil {
		return "", fmt.Errorf("encode jpeg: %w", err)
	}
	// thumbFilename = 原图 basename 去 ext + .thumb.jpg
	base := strings.TrimSuffix(origFilename, filepath.Ext(origFilename))
	thumbFilename := base + ".thumb.jpg"
	if err := s.client.PutFile(ctx, imagePrefix, thumbFilename, &buf); err != nil {
		return "", err
	}
	return ImageProxyPath(thumbFilename), nil
}
