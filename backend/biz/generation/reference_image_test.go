package generation

import (
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
