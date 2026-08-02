package channels

import "testing"

func TestValidateRequestTimeoutMs(t *testing.T) {
	cases := []struct {
		name    string
		value   *int
		want    int
		wantErr bool
	}{
		{name: "未配置继承", value: nil, want: 0},
		{name: "零值继承", value: intPtr(0), want: 0},
		{name: "有效值", value: intPtr(420_000), want: 420_000},
		{name: "过短拒绝", value: intPtr(29_999), wantErr: true},
		{name: "过长拒绝", value: intPtr(600_001), wantErr: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := validateRequestTimeoutMs(tc.value)
			if (err != nil) != tc.wantErr {
				t.Fatalf("err=%v，wantErr=%v", err, tc.wantErr)
			}
			if got != tc.want {
				t.Fatalf("got=%d，want=%d", got, tc.want)
			}
		})
	}
}

func intPtr(v int) *int { return &v }

func TestValidateProxyURL(t *testing.T) {
	cases := []struct {
		name    string
		value   *string
		want    string
		wantErr bool
	}{
		{name: "未配置直连", value: nil, want: ""},
		{name: "空串直连", value: strPtr(""), want: ""},
		{name: "空白直连", value: strPtr("   "), want: ""},
		{name: "http 代理", value: strPtr("http://127.0.0.1:7890"), want: "http://127.0.0.1:7890"},
		{name: "socks5 代理", value: strPtr("socks5://127.0.0.1:1080"), want: "socks5://127.0.0.1:1080"},
		{name: "去首尾空白", value: strPtr("  http://127.0.0.1:7890  "), want: "http://127.0.0.1:7890"},
		{name: "缺协议拒绝", value: strPtr("127.0.0.1:7890"), wantErr: true},
		{name: "非法协议拒绝", value: strPtr("ftp://127.0.0.1:7890"), wantErr: true},
		{name: "缺主机拒绝", value: strPtr("http://"), wantErr: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := validateProxyURL(tc.value)
			if (err != nil) != tc.wantErr {
				t.Fatalf("err=%v，wantErr=%v", err, tc.wantErr)
			}
			if got != tc.want {
				t.Fatalf("got=%q，want=%q", got, tc.want)
			}
		})
	}
}

func strPtr(v string) *string { return &v }

