package generation

import (
	"bytes"
	"image"
	"image/png"
	"strings"
	"testing"
)

const validReferencePNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

func TestToWalaFile_DetectsActualImageType(t *testing.T) {
	file, err := toWalaFile(FileInput{
		Name:    "dress.jpg",
		Type:    "image/jpeg",
		DataURL: "data:image/jpeg;base64," + validReferencePNG,
	})
	if err != nil {
		t.Fatalf("有效 PNG 不应被拒绝：%v", err)
	}
	if file.Type != "image/png" || file.Name != "dress.png" {
		t.Fatalf("应按实际字节规范化格式，得 type=%s name=%s", file.Type, file.Name)
	}
}

func TestToWalaFile_RejectsUndecodableImage(t *testing.T) {
	_, err := toWalaFile(FileInput{DataURL: "data:image/jpeg;base64,aGVsbG8="})
	if err == nil || !strings.Contains(err.Error(), "图片无法解析") {
		t.Fatalf("不可解析图片应被拒绝，得 %v", err)
	}
}

func TestNormalizeReferenceImage_ShrinksOversizedEdge(t *testing.T) {
	// 构造 5712x4284 RGBA 图（模拟 iPhone 原图场景图），编码 PNG
	src := image.NewRGBA(image.Rect(0, 0, 5712, 4284))
	var pngBuf bytes.Buffer
	if err := png.Encode(&pngBuf, src); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	out, ct := normalizeReferenceImage(pngBuf.Bytes(), "image/png", maxReferenceImageEdge)
	if ct != "image/jpeg" {
		t.Fatalf("超阈值应转 JPEG，得 %s", ct)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("规范化后应可解码，得 %v", err)
	}
	// 等比缩小：长边 5712 -> 3840，短边 4284*3840/5712 = 2880
	if cfg.Width != 3840 || cfg.Height != 2880 {
		t.Fatalf("等比缩小尺寸不符，得 %dx%d（期望 3840x2880）", cfg.Width, cfg.Height)
	}
}

func TestNormalizeReferenceImage_KeepsSmallImage(t *testing.T) {
	// 小图（长边 ≤3840）原样返回，零额外损耗
	src := image.NewRGBA(image.Rect(0, 0, 1320, 2868))
	var pngBuf bytes.Buffer
	if err := png.Encode(&pngBuf, src); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	orig := pngBuf.Bytes()
	out, ct := normalizeReferenceImage(orig, "image/png", maxReferenceImageEdge)
	if ct != "image/png" {
		t.Fatalf("小图应保持 PNG，得 %s", ct)
	}
	if !bytes.Equal(out, orig) {
		t.Fatalf("小图应原样返回")
	}
}
