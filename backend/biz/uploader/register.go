package uploader

import (
	"github.com/samber/do"

	v1 "bridal/backend/biz/uploader/handler/http/v1"
	"bridal/backend/config"
)

func ProvideUploader(i *do.Injector) {
	do.Provide(i, v1.NewUploaderHandler)
}

func InvokeUploader(i *do.Injector) {
	cfg := do.MustInvoke[*config.Config](i)
	if !cfg.ObjectStorage.Enabled {
		return
	}
	do.MustInvoke[*v1.UploaderHandler](i)
}
