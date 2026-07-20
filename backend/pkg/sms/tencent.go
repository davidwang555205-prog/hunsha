// Package sms 封装腾讯云短信发送与验证码服务（短信验证码注册 / 重置密码）。
package sms

import (
	"context"
	"fmt"
	"strings"

	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	tcSMS "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/sms/v20210111"

	"bridal/backend/config"
	"bridal/backend/errcode"
)

// Sender 短信发送接口（抽象便于测试 mock 与禁用态替换）。
type Sender interface {
	Send(ctx context.Context, phone, code string) error
}

// NewSender 按 config 构造短信发送器。Enabled=false 时返回 disabledSender，
// 调用 Send 直接返回 ErrSmsSendFailed（开发期未配腾讯云凭据时阻断短信链路）。
func NewSender(cfg config.SMSConfig) (Sender, error) {
	if !cfg.Enabled {
		return &disabledSender{}, nil
	}
	credential := common.NewCredential(cfg.SecretID, cfg.SecretKey)
	cpf := profile.NewClientProfile()
	cpf.HttpProfile.Endpoint = "sms.tencentcloudapi.com"
	client, err := tcSMS.NewClient(credential, cfg.Region, cpf)
	if err != nil {
		return nil, err
	}
	return &tencentSender{client: client, cfg: cfg}, nil
}

type tencentSender struct {
	client *tcSMS.Client
	cfg    config.SMSConfig
}

// Send 调腾讯云 SendSms 发送验证码。模板参数顺序：{1}=验证码，{2}=有效期分钟。
func (s *tencentSender) Send(ctx context.Context, phone, code string) error {
	req := tcSMS.NewSendSmsRequest()
	req.SmsSdkAppId = common.StringPtr(s.cfg.AppID)
	req.SignName = common.StringPtr(s.cfg.SignName)
	req.TemplateId = common.StringPtr(s.cfg.TemplateID)
	req.PhoneNumberSet = common.StringPtrs([]string{normalizePhone(phone)})
	expireMin := s.cfg.CodeExpireMin
	if expireMin <= 0 {
		expireMin = 5
	}
	req.TemplateParamSet = common.StringPtrs([]string{code, fmt.Sprintf("%d", expireMin)})

	resp, err := s.client.SendSmsWithContext(ctx, req)
	if err != nil {
		return errcode.ErrSmsSendFailed.Wrap(err)
	}
	if resp.Response == nil || len(resp.Response.SendStatusSet) == 0 {
		return errcode.ErrSmsSendFailed
	}
	status := resp.Response.SendStatusSet[0]
	if status.Code == nil || *status.Code != "Ok" {
		msg := "tencent sms send failed"
		if status.Message != nil {
			msg = *status.Message
		}
		return errcode.ErrSmsSendFailed.Wrap(fmt.Errorf("%s", msg))
	}
	return nil
}

// normalizePhone 规范化为腾讯云要求的 +86 国际号码格式（去 + / 前缀 86 / 前导 0）。
func normalizePhone(phone string) string {
	p := strings.TrimSpace(phone)
	p = strings.TrimPrefix(p, "+")
	p = strings.TrimPrefix(p, "86")
	p = strings.TrimLeft(p, "0")
	return "+86" + p
}

// disabledSender 短信未启用时的占位实现，Send 直接返回 ErrSmsSendFailed。
type disabledSender struct{}

func (s *disabledSender) Send(context.Context, string, string) error {
	return errcode.ErrSmsSendFailed
}
