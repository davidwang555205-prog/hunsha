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
	maxActive := domain.NormalizeMaxActiveTasks(req.MaxActiveTasks, domain.DefaultMaxActiveTasks)

	users := make([]*domain.TeamUser, 0, len(req.Phones))
	passwords := make([]*domain.TeamUserPassword, 0, len(req.Phones))
	for _, phone := range req.Phones {
		tu, pwd, err := m.createSubAccount(ctx, teamID, phone, req.GroupID, limit, maxActive)
		if err != nil {
			m.logger.ErrorContext(ctx, "create subaccount failed", "phone", phone, "error", err)
			continue
		}
		users = append(users, tu)
		passwords = append(passwords, &domain.TeamUserPassword{Account: phone, Password: pwd})
	}
	return &domain.AddTeamUserWithPasswordResp{Users: users, Passwords: passwords}, nil
}

// createSubAccount 建 subaccount 用户 + TeamMember(user) + TeamGroupMember，返回 TeamUser + 明文密码。
// 手机号唯一：已被任何用户占用则报错（phone 部分唯一索引）。
func (m *Manager) createSubAccount(ctx context.Context, teamID uuid.UUID, phone string, groupID uuid.UUID, dailyLimit, maxActive int) (*domain.TeamUser, string, error) {
	pwd := random.String(16)
	hashed, err := crypto.HashPassword(pwd)
	if err != nil {
		return nil, "", err
	}
	var teamUser *domain.TeamUser
	err = entx.WithTx2(ctx, m.db, func(tx *db.Tx) error {
		existing, qerr := tx.User.Query().Where(user.PhoneEQ(phone)).First(ctx)
		if qerr != nil && !db.IsNotFound(qerr) {
			return qerr
		}
		if existing != nil {
			return fmt.Errorf("手机号 %s 已被使用", phone)
		}
		u, err := tx.User.Create().
			SetID(uuid.New()).
			SetName(phone).
			SetPhone(phone).
			SetStatus(consts.UserStatusActive).
			SetPassword(hashed).
			SetRole(consts.UserRoleSubAccount).
			SetDailyImageLimit(dailyLimit).
			SetMaxActiveTasks(maxActive).
			SetMustChangePassword(true).
			Save(ctx)
		if err != nil {
			return err
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
	// enterprise 不受限（HasUnlimitedImageGeneration 看 role），DailyImageLimit / MaxActiveTasks 仅存档。
	dailyLimit := domain.NormalizeDailyImageLimit(req.DailyImageLimit, domain.DefaultDailyImageLimit)
	maxActive := domain.NormalizeMaxActiveTasks(req.MaxActiveTasks, domain.DefaultMaxActiveTasks)
	var adminUser *domain.TeamUser
	err = entx.WithTx2(ctx, m.db, func(tx *db.Tx) error {
		u, err := tx.User.Create().
			SetID(uuid.New()).
			SetName(req.Name).
			SetPhone(req.Phone).
			SetStatus(consts.UserStatusActive).
			SetPassword(hashed).
			SetRole(consts.UserRoleEnterprise).
			SetDailyImageLimit(dailyLimit).
			SetMaxActiveTasks(maxActive).
			SetMustChangePassword(true).
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

// EnsureUserInAdminTeam 把指定用户加入 admin team（enterprise 用户所在的团队）。
// bridal 单租户：自助注册的 individual 用户默认没有 team_member 记录，管理后台看不到；
// 注册成功后调用本方法将其加入 admin team，role=user，并加入默认分组。
func (m *Manager) EnsureUserInAdminTeam(ctx context.Context, userID uuid.UUID) error {
	return entx.WithTx2(ctx, m.db, func(tx *db.Tx) error {
		// 定位 admin team：任意 enterprise 用户作为 admin 的 team。
		adminMember, err := tx.TeamMember.Query().
			Where(teammember.HasUserWith(user.RoleEQ(consts.UserRoleEnterprise))).
			First(ctx)
		if err != nil {
			if db.IsNotFound(err) {
				return fmt.Errorf("admin team not found")
			}
			return err
		}
		teamID := adminMember.TeamID

		exists, err := tx.TeamMember.Query().
			Where(teammember.TeamIDEQ(teamID), teammember.UserIDEQ(userID)).
			Exist(ctx)
		if err != nil {
			return err
		}
		if exists {
			return nil
		}

		if _, err := tx.TeamMember.Create().
			SetID(uuid.New()).
			SetTeamID(teamID).
			SetUserID(userID).
			SetRole(consts.TeamMemberRoleUser).
			Save(ctx); err != nil {
			return err
		}

		gid, err := ensureDefaultGroup(ctx, tx, teamID)
		if err != nil {
			return err
		}
		gmExists, err := tx.TeamGroupMember.Query().
			Where(teamgroupmember.GroupIDEQ(gid), teamgroupmember.UserIDEQ(userID)).
			Exist(ctx)
		if err != nil {
			return err
		}
		if !gmExists {
			if err := tx.TeamGroupMember.Create().
				SetID(uuid.New()).
				SetGroupID(gid).
				SetUserID(userID).
				Exec(ctx); err != nil {
				return err
			}
		}
		return nil
	})
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
