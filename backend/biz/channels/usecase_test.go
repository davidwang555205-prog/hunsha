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
