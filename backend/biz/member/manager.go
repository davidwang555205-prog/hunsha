package member

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/samber/do"

	"bridal/backend/consts"
	"bridal/backend/db"
	"bridal/backend/db/teamgroup"
	"bridal/backend/db/teamgroupmember"
	"bridal/backend/db/teammember"
	"bridal/backend/db/user"
	"bridal/backend/domain"
	"bridal/backend/pkg/crypto"
	"bridal/backend/pkg/entx"
	"bridal/backend/pkg/random"
)

// defaultTeamGroupName 与 team/repo 默认分组名一致（"默认分组"）。
const defaultTeamGroupName = "默认分组"

// Manager 是 bridal 的 domain.MemberManager 实现。
// bridal 单租户：管理员经 /api/v1/teams/users 增删 subaccount 成员、/api/v1/teams/admin 增 enterprise 管理员。
// 建号逻辑参照 team/repo/user.go 的 InitTeam/ensureInitTeamMember，独立成包避免循环依赖。
type Manager struct {
	db     *db.Client
	logger *slog.Logger
}

// NewManager 创建 MemberManager（samber/do 风格，注入为 domain.MemberManager）。
func NewManager(i *do.Injector) (domain.MemberManager, error) {
	return &Manager{
		db:     do.MustInvoke[*db.Client](i),
		logger: do.MustInvoke[*slog.Logger](i).With("module", "member.manager"),
	}, nil
}

// AddUser 批量建 subaccount 成员（随机密码 + 加入团队 + 默认分组）。
// bridal 不发重置密码邮件，内部生成随机密码但不回传（管理员需用 with-password 接口或 reset 接口拿密码）。
func (m *Manager) AddUser(ctx context.Context, teamUser *domain.TeamUser, req *domain.AddTeamUserReq) (*domain.AddTeamUserResp, error) {
	resp, err := m.addUsersWithPassword(ctx, teamUser, req)
	if err != nil {
		return nil, err
	}
	return &domain.AddTeamUserResp{Users: resp.Users}, nil
}

// AddUserWithPassword 批量建 subaccount 成员，返回初始密码（仅回传一次）。
func (m *Manager) AddUserWithPassword(ctx context.Context, teamUser *domain.TeamUser, req *domain.AddTeamUserReq) (*domain.AddTeamUserWithPasswordResp, error) {
	return m.addUsersWithPassword(ctx, teamUser, req)
}

func (m *Manager) addUsersWithPassword(ctx context.Context, teamUser *domain.TeamUser, req *domain.AddTeamUserReq) (*domain.AddTeamUserWithPasswordResp, error) {
	teamID := teamUser.GetTeamID()
	if teamID == uuid.Nil {
		return nil, fmt.Errorf("团队不存在")
	}
	limit := domain.NormalizeDailyImageLimit(req.DailyImageLimit, domain.DefaultDailyImageLimit)

	users := make([]*domain.TeamUser, 0, len(req.Emails))
	passwords := make([]*domain.TeamUserPassword, 0, len(req.Emails))
	for _, email := range req.Emails {
		tu, pwd, err := m.createSubAccount(ctx, teamID, email, req.GroupID, limit)
		if err != nil {
			m.logger.ErrorContext(ctx, "create subaccount failed", "email", email, "error", err)
			continue
		}
		users = append(users, tu)
		passwords = append(passwords, &domain.TeamUserPassword{Email: email, Password: pwd})
	}
	return &domain.AddTeamUserWithPasswordResp{Users: users, Passwords: passwords}, nil
}

// createSubAccount 建 subaccount 用户 + TeamMember(user) + TeamGroupMember，返回 TeamUser + 明文密码。
// 幂等：email+subaccount 已存在则复用用户，补建成员关系。
func (m *Manager) createSubAccount(ctx context.Context, teamID uuid.UUID, email string, groupID uuid.UUID, dailyLimit int) (*domain.TeamUser, string, error) {
	pwd := random.String(16)
	hashed, err := crypto.HashPassword(pwd)
	if err != nil {
		return nil, "", err
	}
	var teamUser *domain.TeamUser
	err = entx.WithTx2(ctx, m.db, func(tx *db.Tx) error {
		existing, qerr := tx.User.Query().Where(user.EmailEQ(email), user.RoleEQ(consts.UserRoleSubAccount)).First(ctx)
		if qerr != nil && !db.IsNotFound(qerr) {
			return qerr
		}
		var u *db.User
		if existing != nil {
			u = existing
		} else {
			u, err = tx.User.Create().
				SetID(uuid.New()).
				SetName(email).
				SetEmail(email).
				SetStatus(consts.UserStatusActive).
				SetPassword(hashed).
				SetRole(consts.UserRoleSubAccount).
				SetDailyImageLimit(dailyLimit).
				Save(ctx)
			if err != nil {
				return err
			}
		}
		// TeamMember（role=user）
		memberExists, err := tx.TeamMember.Query().Where(teammember.TeamIDEQ(teamID), teammember.UserIDEQ(u.ID)).Exist(ctx)
		if err != nil {
			return err
		}
		if !memberExists {
			if _, err := tx.TeamMember.Create().
				SetID(uuid.New()).
				SetTeamID(teamID).
				SetUserID(u.ID).
				SetRole(consts.TeamMemberRoleUser).
				Save(ctx); err != nil {
				return err
			}
		}
		// TeamGroupMember（指定分组或默认分组）
		gid := groupID
		if gid == uuid.Nil {
			gid, err = ensureDefaultGroup(ctx, tx, teamID)
			if err != nil {
				return err
			}
		}
		gmExists, err := tx.TeamGroupMember.Query().Where(teamgroupmember.GroupIDEQ(gid), teamgroupmember.UserIDEQ(u.ID)).Exist(ctx)
		if err != nil {
			return err
		}
		if !gmExists {
			if err := tx.TeamGroupMember.Create().
				SetID(uuid.New()).
				SetGroupID(gid).
				SetUserID(u.ID).
				Exec(ctx); err != nil {
				return err
			}
		}
		teamUser = &domain.TeamUser{
			User: (&domain.User{}).From(u),
			Team: &domain.Team{ID: teamID},
		}
		return nil
	})
	if err != nil {
		return nil, "", err
	}
	return teamUser, pwd, nil
}

// AddAdmin 建 enterprise 管理员（团队所有者，不限额度）+ TeamMember(admin)，返回初始密码。
func (m *Manager) AddAdmin(ctx context.Context, teamUser *domain.TeamUser, req *domain.AddTeamAdminReq) (*domain.AddTeamAdminResp, error) {
	teamID := teamUser.GetTeamID()
	if teamID == uuid.Nil {
		return nil, fmt.Errorf("团队不存在")
	}
	pwd := random.String(16)
	hashed, err := crypto.HashPassword(pwd)
	if err != nil {
		return nil, err
	}
	// enterprise 不受限（HasUnlimitedImageGeneration 看 role），DailyImageLimit 仅存档。
	dailyLimit := domain.NormalizeDailyImageLimit(req.DailyImageLimit, domain.DefaultDailyImageLimit)
	var adminUser *domain.TeamUser
	err = entx.WithTx2(ctx, m.db, func(tx *db.Tx) error {
		u, err := tx.User.Create().
			SetID(uuid.New()).
			SetName(req.Name).
			SetEmail(req.Email).
			SetStatus(consts.UserStatusActive).
			SetPassword(hashed).
			SetRole(consts.UserRoleEnterprise).
			SetDailyImageLimit(dailyLimit).
			Save(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.TeamMember.Create().
			SetID(uuid.New()).
			SetTeamID(teamID).
			SetUserID(u.ID).
			SetRole(consts.TeamMemberRoleAdmin).
			Save(ctx); err != nil {
			return err
		}
		adminUser = &domain.TeamUser{
			User: (&domain.User{}).From(u),
			Team: &domain.Team{ID: teamID},
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &domain.AddTeamAdminResp{User: adminUser, Password: pwd}, nil
}

// AutoCreateOIDCMember bridal 不启用 OIDC，返回 not implemented。
// team/usecase/oidc.go 仅在 OIDC 登录流程触发，bridal 不走该路径。
func (m *Manager) AutoCreateOIDCMember(ctx context.Context, teamID uuid.UUID, external *domain.OIDCExternalUser) (*domain.User, error) {
	return nil, fmt.Errorf("OIDC member creation not supported in bridal")
}

// ensureDefaultGroup 查询/创建团队默认分组，返回分组 ID。与 team/repo.ensureDefaultTeamGroupTx 等价。
func ensureDefaultGroup(ctx context.Context, tx *db.Tx, teamID uuid.UUID) (uuid.UUID, error) {
	g, err := tx.TeamGroup.Query().Where(teamgroup.TeamIDEQ(teamID), teamgroup.NameEQ(defaultTeamGroupName)).First(ctx)
	if err == nil {
		return g.ID, nil
	}
	if !db.IsNotFound(err) {
		return uuid.Nil, err
	}
	g, err = tx.TeamGroup.Create().
		SetID(uuid.New()).
		SetTeamID(teamID).
		SetName(defaultTeamGroupName).
		Save(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	return g.ID, nil
}
