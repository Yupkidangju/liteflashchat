// [v1.0.0] 최초 작성
// 이 테스트 코드는 crypto.go의 암호화 및 복호화 무결성을 기계적으로 확인하기 위한 유닛 테스트입니다.
// 가상 데이터를 사용하여 암호화 후 원본 값이 복원되는지 검증합니다.

package main

import (
	"os"
	"path/filepath"
	"testing"
)

// useTempKeyFile 함수는 테스트가 실제 .secret.key 파일을 삭제하거나 재생성하지 않도록
// 각 테스트 케이스마다 독립된 임시 키 파일 경로를 주입합니다.
func useTempKeyFile(t *testing.T) {
	t.Helper()

	originalPath := keyFilePath
	keyFilePath = filepath.Join(t.TempDir(), ".secret.key")
	t.Cleanup(func() {
		keyFilePath = originalPath
	})
}

// TestEncryptionDecryption 함수는 임의의 API 키 문자열이 손상 없이 원본 그대로 암복호화되는지 검증합니다.
func TestEncryptionDecryption(t *testing.T) {
	useTempKeyFile(t)

	// 테스트 데이터 준비
	testAPIKey := "sk-or-v1-abcdefghijklmnopqrstuvwxyz1234567890"

	// 1. 암호화 테스트 수행
	encryptedText, iv, err := Encrypt(testAPIKey)
	if err != nil {
		t.Fatalf("API 키 암호화 중 예기치 않은 오류 발생: %v", err)
	}

	if encryptedText == "" || iv == "" {
		t.Fatalf("암호화 결과물 또는 IV가 비어 있습니다")
	}

	// 2. 복호화 테스트 수행
	decryptedText, err := Decrypt(encryptedText, iv)
	if err != nil {
		t.Fatalf("API 키 복호화 중 예기치 않은 오류 발생: %v", err)
	}

	// 3. 무결성 정합성 체크
	if decryptedText != testAPIKey {
		t.Errorf("복호화된 텍스트가 원본과 일치하지 않습니다. 원본: %s, 복호화 결과: %s", testAPIKey, decryptedText)
	}

	t.Logf("정합성 테스트 성공! 복호화된 텍스트: %s", decryptedText)
}

// TestKeyInitialization 함수는 .secret.key 파일 자동 생성 및 지속성이 정상 작동하는지 체크합니다.
func TestKeyInitialization(t *testing.T) {
	useTempKeyFile(t)

	// 사전 정리: 테스트 전용 임시 키 파일만 삭제합니다.
	_ = os.Remove(keyFilePath)

	// 최초 키 획득 시도 (키 자동 생성 발생)
	key1, err := getOrInitKey()
	if err != nil {
		t.Fatalf("보안 키 최초 초기화 실패: %v", err)
	}

	if len(key1) != 32 {
		t.Errorf("생성된 보안 키의 길이가 32바이트(AES-256)가 아닙니다. 실제 크기: %d", len(key1))
	}

	// 두 번째 키 획득 시도 (생성된 기존 키 로드 발생)
	key2, err := getOrInitKey()
	if err != nil {
		t.Fatalf("두 번째 보안 키 조회 실패: %v", err)
	}

	// 동일성 체크 (키가 유실되지 않고 동일하게 유지되어야 복호화 가능)
	for i := range key1 {
		if key1[i] != key2[i] {
			t.Fatalf("새로 가져온 보안 키가 이전 키와 동일하지 않습니다. 키 지속성 소실 예고")
		}
	}

	t.Log("보안 키 자동 생성 및 로드 지속성 테스트 통과 완료.")
}
