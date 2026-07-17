package syssetting

import (
	"strings"
	"testing"
	"time"
)

func TestRedfoxKeyCipherRoundTrip(t *testing.T) {
	cipher := newRedfoxKeyCipher("test-session-secret")
	sealed, err := cipher.seal("ak_test_1234567890")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(sealed, "ak_test") {
		t.Fatalf("sealed key leaks plaintext: %q", sealed)
	}
	plain, err := cipher.open(sealed)
	if err != nil {
		t.Fatal(err)
	}
	if plain != "ak_test_1234567890" {
		t.Fatalf("plain = %q", plain)
	}
}

func TestRedfoxSettingResponseDoesNotExposeKey(t *testing.T) {
	cipher := newRedfoxKeyCipher("test-session-secret")
	sealed, err := cipher.seal("ak_test_1234567890")
	if err != nil {
		t.Fatal(err)
	}
	u := &Usecase{keyCipher: cipher}
	resp := u.sanitize(SettingRecord{
		Key:       RedfoxAPISettingKey,
		Value:     map[string]any{redfoxEncryptedAPIKeyField: sealed},
		UpdatedAt: time.Now(),
	})
	if got := resp.Value["apiKey"]; got != nil {
		t.Fatalf("api key leaked in response: %#v", got)
	}
	if got, _ := resp.Value["maskedKey"].(string); got != "****7890" {
		t.Fatalf("masked key = %q", got)
	}
}
