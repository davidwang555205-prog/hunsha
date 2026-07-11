//go:build ignore

package main

import (
	"log"

	"entgo.io/ent/entc"
	"entgo.io/ent/entc/gen"
	"bridal/backend/pkg/entx"
)

func main() {
	if err := entc.Generate(
		"./schema",
		&gen.Config{
			Target:  "../db",
			Package: "bridal/backend/db",
			Features: []gen.Feature{
				gen.FeatureUpsert,
				gen.FeatureModifier,
				gen.FeatureExecQuery,
				gen.FeatureIntercept,
				gen.FeatureLock,
			},
		},
		entc.Extensions(
			&entx.Cursor{},
			&entx.Page{},
		),
	); err != nil {
		log.Fatal("running ent codegen:", err)
	}
}
