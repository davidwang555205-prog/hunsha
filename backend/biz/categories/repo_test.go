package categories

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"

	"bridal/backend/consts"
	"bridal/backend/db"
	"bridal/backend/db/enttest"
)

func newCategoryRepoTestDB(t *testing.T) *db.Client {
	t.Helper()
	client := enttest.Open(t, "sqlite3", "file:categories-repo-test?mode=memory&cache=shared&_fk=1")
	t.Cleanup(func() { _ = client.Close() })
	return client
}

func TestListEnabledForUserHonorsVisibleCategoryIDs(t *testing.T) {
	ctx := context.Background()
	client := newCategoryRepoTestDB(t)
	repo := &Repo{db: client, logger: slog.New(slog.NewTextHandler(io.Discard, nil))}

	firstID := uuid.New()
	first, err := client.Category.Create().
		SetID(firstID).
		SetName("婚纱").
		SetEngine("bridal").
		SetSortOrder(1).
		SetIsEnabled(true).
		Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	second, err := client.Category.Create().
		SetName("礼服").
		SetEngine("dress").
		SetSortOrder(2).
		SetIsEnabled(true).
		Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := client.Category.Create().
		SetName("停用类目").
		SetEngine("disabled").
		SetIsEnabled(false).
		Save(ctx); err != nil {
		t.Fatal(err)
	}

	userID := uuid.New()
	if _, err := client.User.Create().
		SetID(userID).
		SetName("成员").
		SetRole(consts.UserRoleSubAccount).
		SetStatus(consts.UserStatusActive).
		SetVisibleCategoryIds([]uuid.UUID{second.ID}).
		Save(ctx); err != nil {
		t.Fatal(err)
	}

	visible, err := repo.ListEnabledForUser(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if len(visible) != 1 || visible[0].ID != second.ID {
		t.Fatalf("visible categories = %#v, want only %s", visible, second.ID)
	}

	if _, err := client.User.UpdateOneID(userID).SetVisibleCategoryIds([]uuid.UUID{}).Save(ctx); err != nil {
		t.Fatal(err)
	}
	visible, err = repo.ListEnabledForUser(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if len(visible) != 2 || visible[0].ID != first.ID || visible[1].ID != second.ID {
		t.Fatalf("unrestricted categories = %#v, want both enabled categories", visible)
	}
}
