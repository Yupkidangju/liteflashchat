// [v1.2.2] 최초 작성
// 이 모듈은 5대 프로바이더의 식별자, 기본 Base URL, 로컬 키 정책,
// 저장 전 URL 정규화 규칙을 한 곳에 모아 설정/모델/채팅 경로가 같은 계약을 공유하게 합니다.

package main

import (
	"fmt"
	"net/url"
	"strings"
)

const (
	providerStatusMissing    = "missing"
	providerStatusReady      = "ready"
	providerStatusInvalidKey = "invalid_key"
	localProviderDummyAPIKey = "liteflashchat-local-provider"
)

type providerDefinition struct {
	Name        string
	DisplayName string
	DefaultURL  string
	Local       bool
}

var providerDefinitions = []providerDefinition{
	{"openrouter", "OpenRouter", "https://openrouter.ai/api/v1", false},
	{"opencode_zen", "OpenCode Zen", "https://opencode.ai/zen/v1", false},
	{"opencode_go", "OpenCode Go", "https://opencode.ai/zen/go/v1", false},
	{"lm_studio", "LM Studio", "http://localhost:1234/v1", true},
	{"local_llm", "Local LLM (OpenAI)", "http://localhost:8000/v1", true},
}

func providerByName(name string) (providerDefinition, bool) {
	for _, provider := range providerDefinitions {
		if provider.Name == name {
			return provider, true
		}
	}
	return providerDefinition{}, false
}

func isLocalProvider(name string) bool {
	provider, ok := providerByName(name)
	return ok && provider.Local
}

// normalizeProviderBaseURL 함수는 사용자가 /models 또는 /chat/completions 같은
// 하위 엔드포인트를 붙여 넣어도 내부 저장값은 API 루트만 남기도록 정규화합니다.
func normalizeProviderBaseURL(providerName string, rawBaseURL string) (string, error) {
	provider, ok := providerByName(providerName)
	if !ok {
		return "", fmt.Errorf("지원하지 않는 프로바이더입니다: %s", providerName)
	}

	baseURL := strings.TrimSpace(rawBaseURL)
	if baseURL == "" {
		baseURL = provider.DefaultURL
	}

	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", fmt.Errorf("Base URL은 http:// 또는 https:// 로 시작하는 완전한 주소여야 합니다")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("Base URL 스킴은 http 또는 https만 지원합니다")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("Base URL에는 query string 또는 fragment를 포함할 수 없습니다")
	}

	path := strings.TrimRight(parsed.EscapedPath(), "/")
	for {
		changed := false
		for _, suffix := range []string{"/chat/completions", "/models"} {
			if strings.HasSuffix(path, suffix) {
				path = strings.TrimRight(strings.TrimSuffix(path, suffix), "/")
				changed = true
			}
		}
		if !changed {
			break
		}
	}
	parsed.Path = path
	parsed.RawPath = ""

	return strings.TrimRight(parsed.String(), "/"), nil
}

// validateExistingProviderKey 함수는 기존 암호문을 유지 저장하기 전에 실제 복호화가 가능한지 확인합니다.
// 깨진 키를 보존하면 사용자가 설정을 저장해도 모델/채팅 사이클이 계속 막히므로 즉시 재등록을 요구합니다.
func validateExistingProviderKey(config ProviderConfig) error {
	if config.EncryptedAPIKey == "" || config.IV == "" {
		return fmt.Errorf("기존 API Key 정보가 비어 있어 재등록이 필요합니다")
	}
	if _, err := Decrypt(config.EncryptedAPIKey, config.IV); err != nil {
		return fmt.Errorf("기존 API Key 복호화에 실패했습니다. API Key를 다시 입력해 주십시오: %w", err)
	}
	return nil
}

func providerAPIKey(providerName string, config ProviderConfig) (string, error) {
	if config.EncryptedAPIKey == "" || config.IV == "" {
		if isLocalProvider(providerName) {
			return localProviderDummyAPIKey, nil
		}
		return "", fmt.Errorf("해당 프로바이더(%s)의 API 키가 등록되지 않았습니다", providerName)
	}

	apiKey, err := Decrypt(config.EncryptedAPIKey, config.IV)
	if err != nil {
		return "", fmt.Errorf("API 키 복호화 실패: %w", err)
	}
	return apiKey, nil
}
