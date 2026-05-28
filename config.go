// [v1.1.0] 개정 반영
// - [v1.0.0] 최초 작성: keys.json 암호화 I/O 및 락 제어 구현.
// - [v1.1.0] 2차 개정: Super Prompt 영구 관리를 위한 prompts.json 평문 파일 DB I/O 추가 및 promptsMutex 동시성 제어 락 수립.

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"
)

// dbFilePath는 각 프로바이더 정보가 암호화되어 기록되는 로컬 JSON 데이터베이스 경로입니다.
const dbFilePath = "keys.json"

// promptsFilePath는 사용자가 등록한 Super Prompt 목록이 보존되는 평문 JSON 경로입니다.
const promptsFilePath = "prompts.json"

// ProviderConfig 구조체는 특정 AI 프로바이더의 물리 연동 정보를 구성합니다.
type ProviderConfig struct {
	EncryptedAPIKey string `json:"encrypted_api_key"`
	IV              string `json:"iv"`
	BaseURL         string `json:"base_url"`
}

// AppConfig 구조체는 전체 애플리케이션의 프로바이더 설정 맵입니다.
type AppConfig map[string]ProviderConfig

// SuperPrompt 구조체는 사용자가 지정한 페르소나 지침 데이터를 매핑합니다.
type SuperPrompt struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// configMutex는 keys.json 용 동동 읽기/쓰기 동기화 락입니다.
var configMutex sync.RWMutex

// promptsMutex는 prompts.json 용 동기화 락입니다.
var promptsMutex sync.RWMutex

// loadConfig 함수는 keys.json 데이터베이스로부터 모든 프로바이더 설정을 안전하게 파싱하여 맵 형태로 로드합니다.
func loadConfig() (AppConfig, error) {
	configMutex.RLock()
	defer configMutex.RUnlock()

	if _, err := os.Stat(dbFilePath); errors.Is(err, os.ErrNotExist) {
		return make(AppConfig), nil
	}

	data, err := os.ReadFile(dbFilePath)
	if err != nil {
		return nil, fmt.Errorf("설정 파일을 읽어오는 도중 예외가 발생했습니다: %w", err)
	}

	var config AppConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("JSON 파싱 에러 - 설정 데이터 복원 실패: %w", err)
	}

	return config, nil
}

// saveConfig 함수는 인수로 받은 AppConfig 상태값을 keys.json 로컬 디스크 파일에 안전하게 기록합니다.
func saveConfig(config AppConfig) error {
	configMutex.Lock()
	defer configMutex.Unlock()

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("설정 직렬화(Serialization) 실패: %w", err)
	}

	if err := os.WriteFile(dbFilePath, data, 0600); err != nil {
		return fmt.Errorf("설정 데이터베이스 저장 실패: %w", err)
	}

	return nil
}

// loadPrompts 함수는 prompts.json 파일로부터 저장된 모든 Super Prompt 슬라이스를 파싱하여 로드합니다.
// 파일이 없을 경우 빈 슬라이스를 리턴하여 안전하게 초기화합니다.
func loadPrompts() ([]SuperPrompt, error) {
	promptsMutex.RLock()
	defer promptsMutex.RUnlock()

	if _, err := os.Stat(promptsFilePath); errors.Is(err, os.ErrNotExist) {
		return []SuperPrompt{}, nil
	}

	data, err := os.ReadFile(promptsFilePath)
	if err != nil {
		return nil, fmt.Errorf("프롬프트 파일을 읽어오는 도중 예외 발생: %w", err)
	}

	var prompts []SuperPrompt
	if err := json.Unmarshal(data, &prompts); err != nil {
		return nil, fmt.Errorf("JSON 파싱 에러 - 프롬프트 데이터 복원 실패: %w", err)
	}

	return prompts, nil
}

// savePrompts 함수는 Super Prompt 목록을 prompts.json 디스크 파일에 미려한 인덴트 포맷으로 기록 보존합니다.
func savePrompts(prompts []SuperPrompt) error {
	promptsMutex.Lock()
	defer promptsMutex.Unlock()

	data, err := json.MarshalIndent(prompts, "", "  ")
	if err != nil {
		return fmt.Errorf("프롬프트 직렬화 실패: %w", err)
	}

	if err := os.WriteFile(promptsFilePath, data, 0600); err != nil {
		return fmt.Errorf("프롬프트 데이터베이스 저장 실패: %w", err)
	}

	return nil
}
