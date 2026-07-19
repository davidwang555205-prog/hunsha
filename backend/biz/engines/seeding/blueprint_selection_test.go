package seeding

import "testing"

func TestSelectBlueprintsFamilySamplingIsDeterministicAndDistinct(t *testing.T) {
	blueprints := []XhsImageBlueprint{
		{Name: "A｜F01-a"}, {Name: "B｜F01-b"}, {Name: "C｜F02-a"},
		{Name: "D｜F03-a"}, {Name: "E｜F04-a"}, {Name: "F｜F05-a"},
	}
	rule := BlueprintSelectionRule{Strategy: "familySampling"}
	first := selectBlueprints(blueprints, rule, 3, "same-seed")
	second := selectBlueprints(blueprints, rule, 3, "same-seed")
	if len(first) != 3 || len(second) != 3 {
		t.Fatalf("want 3 blueprints")
	}
	seen := map[string]bool{}
	for index, bp := range first {
		if seen[blueprintFamily(bp.Name)] {
			t.Fatalf("family duplicated: %s", bp.Name)
		}
		seen[blueprintFamily(bp.Name)] = true
		if bp.Name != second[index].Name {
			t.Fatal("same seed must be deterministic")
		}
	}
}

func TestSelectBlueprintsKeepsRequiredBlueprint(t *testing.T) {
	blueprints := []XhsImageBlueprint{
		{Name: "PMS-001｜F01-front"}, {Name: "B｜F02-a"}, {Name: "C｜F03-a"}, {Name: "D｜F04-a"},
	}
	selected := selectBlueprints(blueprints, BlueprintSelectionRule{Strategy: "familySamplingWithRequiredFirst", RequiredNamePrefix: "PMS-001｜F01-"}, 3, "seed")
	found := false
	for _, bp := range selected {
		found = found || bp.Name == "PMS-001｜F01-front"
	}
	if !found {
		t.Fatal("required blueprint must be selected")
	}
}
