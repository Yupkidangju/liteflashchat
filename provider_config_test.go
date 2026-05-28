// [v1.2.2] 최초 작성
// 이 테스트 코드는 프로바이더 설정 저장 경로에서 Base URL 정규화와
// 손상된 암호키 유지 방지 계약이 깨지지 않도록 회귀 검증합니다.

package main

import "testing"

// TestNormalizeProviderBaseURL 함수는 사용자가 chat/models 엔드포인트까지 붙여 넣어도
// 내부 저장값은 OpenAI 호환 API 루트까지만 보존되는지 확인합니다.
func TestNormalizeProviderBaseURL(t *testing.T) {
	normalized, err := normalizeProviderBaseURL("opencode_go", "https://opencode.ai/zen/go/v1/chat/completions")
	if err != nil {
		t.Fatalf("Base URL 정규화 실패: %v", err)
	}

	if normalized != "https://opencode.ai/zen/go/v1" {
		t.Fatalf("정규화 결과가 기대와 다릅니다: %s", normalized)
	}

	defaultURL, err := normalizeProviderBaseURL("lm_studio", "")
	if err != nil {
		t.Fatalf("기본 URL 적용 실패: %v", err)
	}
	if defaultURL != "http://localhost:1234/v1" {
		t.Fatalf("LM Studio 기본 URL이 기대와 다릅니다: %s", defaultURL)
	}
}

// TestNormalizeProviderBaseURLSupportsRuntimeCleanup 함수는 기존 keys.json에 이미 잘못 저장된
// chat/models 하위 경로도 런타임 프록시에서 API 루트로 복구할 수 있는지 확인합니다.
func TestNormalizeProviderBaseURLSupportsRuntimeCleanup(t *testing.T) {
	cases := map[string]string{
		"https://openrouter.ai/api/v1/chat/completions/models":  "https://openrouter.ai/api/v1",
		"https://opencode.ai/zen/v1/chat/completions/models":    "https://opencode.ai/zen/v1",
		"https://opencode.ai/zen/go/v1/chat/completions/models": "https://opencode.ai/zen/go/v1",
		"http://localhost:1234/v1/chat/completions/models":      "http://localhost:1234/v1",
		"http://localhost:8000/v1/chat/completions/models":      "http://localhost:8000/v1",
	}

	for input, expected := range cases {
		provider := providerForExpectedBaseURL(expected)
		normalized, err := normalizeProviderBaseURL(provider, input)
		if err != nil {
			t.Fatalf("Base URL 정규화 실패: %v", err)
		}
		if normalized != expected {
			t.Fatalf("정규화 결과가 기대와 다릅니다. input=%s got=%s want=%s", input, normalized, expected)
		}
	}
}

func providerForExpectedBaseURL(expected string) string {
	switch expected {
	case "https://openrouter.ai/api/v1":
		return "openrouter"
	case "https://opencode.ai/zen/v1":
		return "opencode_zen"
	case "https://opencode.ai/zen/go/v1":
		return "opencode_go"
	case "http://localhost:1234/v1":
		return "lm_studio"
	case "http://localhost:8000/v1":
		return "local_llm"
	default:
		return ""
	}
}

// TestNormalizeProviderBaseURLRejectsInvalidInput 함수는 알 수 없는 프로바이더와
// 스킴 없는 URL이 설정 저장으로 흘러가지 않는지 검증합니다.
func TestNormalizeProviderBaseURLRejectsInvalidInput(t *testing.T) {
	if _, err := normalizeProviderBaseURL("unknown", "https://example.com/v1"); err == nil {
		t.Fatal("알 수 없는 프로바이더가 거부되지 않았습니다")
	}

	if _, err := normalizeProviderBaseURL("openrouter", "localhost:1234/v1"); err == nil {
		t.Fatal("스킴 없는 URL이 거부되지 않았습니다")
	}
}

// TestValidateExistingProviderKey 함수는 __KEEP_EXISTING__ 저장 시 깨진 암호문을
// 조용히 유지하지 않고 재등록 필요 상태로 차단하는지 확인합니다.
func TestValidateExistingProviderKey(t *testing.T) {
	useTempKeyFile(t)

	encrypted, iv, err := Encrypt("valid-key")
	if err != nil {
		t.Fatalf("테스트 키 암호화 실패: %v", err)
	}

	valid := ProviderConfig{EncryptedAPIKey: encrypted, IV: iv, BaseURL: "https://example.com/v1"}
	if err := validateExistingProviderKey(valid); err != nil {
		t.Fatalf("정상 키 검증 실패: %v", err)
	}

	invalid := ProviderConfig{EncryptedAPIKey: encrypted, IV: "000000000000000000000000", BaseURL: "https://example.com/v1"}
	if err := validateExistingProviderKey(invalid); err == nil {
		t.Fatal("손상된 키가 검증을 통과했습니다")
	}
}

// TestOpenCodeGoChatCompletionsModelFilter 함수는 현재 앱이 지원하는 chat/completions
// 엔드포인트와 맞지 않는 OpenCode Go messages 계열 모델이 자동 선택되지 않도록 보장합니다.
func TestOpenCodeGoChatCompletionsModelFilter(t *testing.T) {
	allowed := []string{"kimi-k2.6", "glm-5.1", "deepseek-v4-pro", "mimo-v2.5-pro"}
	for _, modelID := range allowed {
		if !isOpenCodeGoChatCompletionsModel(modelID) {
			t.Fatalf("chat/completions 호환 모델이 차단되었습니다: %s", modelID)
		}
	}

	blocked := []string{"minimax-m2.7", "minimax-m2.5", "qwen3.7-max", "qwen3.6-plus", "qwen3.5-plus"}
	for _, modelID := range blocked {
		if isOpenCodeGoChatCompletionsModel(modelID) {
			t.Fatalf("messages 계열 모델이 chat/completions 목록에 노출됩니다: %s", modelID)
		}
	}
}
