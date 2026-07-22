package member

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
	"bridal/backend/db/teammember"
	"bridal/backend/db/teamgroup"
	"bridal/backend/db/teamgroupmember"
)

func newManagerTestDB(t *testing.T) *db.Client {
	t.Helper()
	client := enttest.Open(t, "sqlite3", "file:member-test?mode=memory&cache=shared&_fk=1")
	t.Cleanup(func() { _ = client.Close() })
	return client
}

func newManager(client *db.Client) *Manager {
	return &Manager{
		db:     client,
		logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
}

// initAdminTeam 手工创建 admin team（enterprise 管理员 + team + team_member admin + 默认分组）。
func initAdminTeam(ctx context.Context, t *testing.T, client *db.Client) uuid.UUID {
	t.Helper()
	admin, err := client.User.Create().
		SetID(uuid.New()).
		SetName("admin").
		SetEmail("admin@example.com").
		SetPassword("hash").
		SetRole(consts.UserRoleEnterprise).
		SetStatus(consts.UserStatusActive).
		Save(ctx)
	if err != nil {
		t.Fatalf("create admin user failed: %v", err)
	}
	team, err := client.Team.Create().
		SetID(uuid.New()).
		SetName("Admin Team").
		SetMemberLimit(5).
		Save(ctx)
	if err != nil {
		t.Fatalf("create team failed: %v", err)
	}
	if _, err := client.TeamMember.Create().
		SetID(uuid.New()).
		SetTeamID(team.ID).
		SetUserID(admin.ID).
		SetRole(consts.TeamMemberRoleAdmin).
		Save(ctx); err != nil {
		t.Fatalf("create admin team member failed: %v", err)
	}
	if _, err := client.TeamGroup.Create().
		SetID(uuid.New()).
		SetTeamID(team.ID).
		SetName(defaultTeamGroupName).
		Save(ctx); err != nil {
		t.Fatalf("create default group failed: %v", err)
	}
	return team.ID
}

func TestEnsureUserInAdminTeam_AddsIndividualToAdminTeamAndDefaultGroup(t *testing.T) {
	ctx := context.Background()
	client := newManagerTestDB(t)
	m := newManager(client)
	teamID := initAdminTeam(ctx, t, client)

	individual, err := client.User.Create().
		SetID(uuid.New()).
		SetName("individual").
		SetEmail("ind@example.com").
		SetPassword("hash").
		SetRole(consts.UserRoleIndividual).
		SetStatus(consts.UserStatusActive).
		Save(ctx)
	if err != nil {
		t.Fatalf("create individual failed: %v", err)
	}

	if err := m.EnsureUserInAdminTeam(ctx, individual.ID); err != nil {
		t.Fatalf("EnsureUserInAdminTeam failed: %v", err)
	}

	member, err := client.TeamMember.Query().
		Where(teammember.TeamIDEQ(teamID), teammember.UserIDEQ(individual.ID)).
		Only(ctx)
	if err != nil {
		t.Fatalf("expected team member, got: %v", err)
	}
	if member.Role != consts.TeamMemberRoleUser {
		t.Fatalf("role = %s, want %s", member.Role, consts.TeamMemberRoleUser)
	}

	group, err := client.TeamGroup.Query().
		Where(teamgroup.TeamIDEQ(teamID), teamgroup.NameEQ(defaultTeamGroupName)).
		Only(ctx)
	if err != nil {
		t.Fatalf("default group not found: %v", err)
	}
	exists, err := client.TeamGroupMember.Query().
		Where(teamgroupmember.GroupIDEQ(group.ID), teamgroupmember.UserIDEQ(individual.ID)).
		Exist(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !exists {
		t.Fatal("expected individual user in default group")
	}
}

func TestEnsureUserInAdminTeam_Idempotent(t *testing.T) {
	ctx := context.Background()
	client := newManagerTestDB(t)
	m := newManager(client)
	teamID := initAdminTeam(ctx, t, client)

	individual, err := client.User.Create().
		SetID(uuid.New()).
		SetName("individual").
		SetEmail("ind@example.com").
		SetPassword("hash").
		SetRole(consts.UserRoleIndividual).
		SetStatus(consts.UserStatusActive).
		Save(ctx)
	if err != nil {
		t.Fatalf("create individual failed: %v", err)
	}

	for i := 0; i < 2; i++ {
		if err := m.EnsureUserInAdminTeam(ctx, individual.ID); err != nil {
			t.Fatalf("EnsureUserInAdminTeam iteration %d failed: %v", i, err)
		}
	}

	count, err := client.TeamMember.Query().
		Where(teammember.TeamIDEQ(teamID), teammember.UserIDEQ(individual.ID)).
		Count(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("team_member count = %d, want 1", count)
	}
}

func TestEnsureUserInAdminTeam_NoAdminTeamReturnsError(t *testing.T) {
	ctx := context.Background()
	client := newManagerTestDB(t)
	m := newManager(client)

	individual, err := client.User.Create().
		SetID(uuid.New()).
		SetName("individual").
		SetEmail("ind@example.com").
		SetPassword("hash").
		SetRole(consts.UserRoleIndividual).
		SetStatus(consts.UserStatusActive).
		Save(ctx)
	if err != nil {
		t.Fatalf("create individual failed: %v", err)
	}

	if err := m.EnsureUserInAdminTeam(ctx, individual.ID); err == nil {
		t.Fatal("expected error when admin team does not exist")
	}
}
