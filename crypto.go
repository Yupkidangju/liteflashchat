// [v1.0.0] 최초 작성
// 이 모듈은 LiteFlashChat의 핵심 암호화 레이어입니다.
// 로컬 기기에 저장된 API 키를 AES-256-GCM 알고리즘으로 양방향 암호화 처리합니다.
// 보안을 강화하기 위해 별도의 고유 .secret.key 파일을 자동으로 생성하여 관리합니다.

package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"os"
)

// keyFilePath는 프로젝트 루트에 생성할 보안 키의 경로입니다.
// 테스트는 실제 사용자 키를 훼손하지 않도록 이 값을 임시 경로로 교체합니다.
var keyFilePath = ".secret.key"

// getOrInitKey 함수는 .secret.key 파일에서 32바이트 암호화 키를 로드합니다.
// 만약 키 파일이 존재하지 않는 경우, cryptographically secure한 무작위 32바이트 키를 생성하여 저장합니다.
func getOrInitKey() ([]byte, error) {
	// 기존 보안 키 파일이 있는지 먼저 검사합니다.
	if _, err := os.Stat(keyFilePath); err == nil {
		// 파일이 존재하므로 키를 읽어옵니다.
		key, readErr := os.ReadFile(keyFilePath)
		if readErr != nil {
			return nil, fmt.Errorf("보안 키 파일을 읽는 도중 오류가 발생했습니다: %w", readErr)
		}
		if len(key) != 32 {
			return nil, fmt.Errorf("보안 키의 크기가 유효하지 않습니다 (32바이트가 되어야 합니다)")
		}
		return key, nil
	}

	// 보안 키 파일이 없으므로 무작위 32바이트(AES-256 규격) 키를 새롭게 생성합니다.
	newKey := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, newKey); err != nil {
		return nil, fmt.Errorf("무작위 보안 키 생성 중 오류가 발생했습니다: %w", err)
	}

	// 생성된 키를 로컬 파일 시스템에 안전하게 저장합니다.
	// 0600 권한을 설정하여 소유자 본인 외에 다른 사용자가 읽거나 쓰지 못하도록 방어합니다.
	writeErr := os.WriteFile(keyFilePath, newKey, 0600)
	if writeErr != nil {
		return nil, fmt.Errorf("보안 키 파일을 저장하는 도중 오류가 발생했습니다: %w", writeErr)
	}

	return newKey, nil
}

// Encrypt 함수는 평문 데이터를 .secret.key로 로드된 AES 키와 AES-256-GCM 알고리즘을 사용해 암호화합니다.
// 암호문과 함께 복호화에 반드시 페어로 필요한 12바이트 무작위 IV(Initialization Vector)를 16진수 헥사 문자열로 반환합니다.
func Encrypt(plainText string) (string, string, error) {
	// 보안 키를 획득합니다.
	key, err := getOrInitKey()
	if err != nil {
		return "", "", err
	}

	// AES 블록 암호화 객체를 초기화합니다.
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", "", fmt.Errorf("AES 암호화 블록 객체 생성 실패: %w", err)
	}

	// AES-GCM(Galois/Counter Mode) 인증 암호화 모드를 설정합니다.
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", fmt.Errorf("GCM 암호화 객체 초기화 실패: %w", err)
	}

	// AES-GCM 모드에 필요한 12바이트 고유 일회용 IV를 생성합니다.
	iv := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", "", fmt.Errorf("IV(Initialization Vector) 난수 생성 실패: %w", err)
	}

	// 평문 문자열을 바이트 슬라이스로 캐스팅한 뒤 봉인(Seal) 처리를 수행합니다.
	// 첫 번째 인자로 nil을 전달하여 새로운 슬라이스에 결과를 저장하도록 합니다.
	cipherText := gcm.Seal(nil, iv, []byte(plainText), nil)

	// 암호문과 IV를 16진수 문자열로 상호 변환하여 반환합니다.
	return hex.EncodeToString(cipherText), hex.EncodeToString(iv), nil
}

// Decrypt 함수는 hexEncrypted(16진수 암호문)과 hexIV(16진수 IV)를 전달받아
// 로컬 .secret.key 파일의 키 정보를 사용해 평문 상태의 API 키를 복호화해 돌려줍니다.
func Decrypt(hexEncrypted string, hexIV string) (string, error) {
	// 보안 키를 획득합니다.
	key, err := getOrInitKey()
	if err != nil {
		return "", err
	}

	// 16진수 문자열로 보관 중인 암호문을 바이트 배열로 변환합니다.
	cipherText, err := hex.DecodeString(hexEncrypted)
	if err != nil {
		return "", fmt.Errorf("16진수 암호문 디코딩 실패: %w", err)
	}

	// 16진수 문자열로 보관 중인 IV를 바이트 배열로 변환합니다.
	iv, err := hex.DecodeString(hexIV)
	if err != nil {
		return "", fmt.Errorf("16진수 IV 디코딩 실패: %w", err)
	}

	// AES 블록 복호화 객체를 만듭니다.
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("AES 복호화 블록 객체 생성 실패: %w", err)
	}

	// AES-GCM 모드로 진입합니다.
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("GCM 복호화 객체 초기화 실패: %w", err)
	}

	// IV의 크기가 GCM 규격(12바이트)에 맞는지 최종 체크합니다.
	if len(iv) != gcm.NonceSize() {
		return "", fmt.Errorf("전달된 IV의 크기가 유효하지 않습니다")
	}

	// Open 함수를 호출하여 복호화와 동시에 데이터 오염 검증(Integrity Check)을 거칩니다.
	plainTextBytes, err := gcm.Open(nil, iv, cipherText, nil)
	if err != nil {
		return "", fmt.Errorf("GCM 데이터 복호화 또는 위변조 검증 실패: %w", err)
	}

	return string(plainTextBytes), nil
}
