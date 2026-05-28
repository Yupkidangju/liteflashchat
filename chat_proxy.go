package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// handleChatProxy 핸들러는 챗 페이로드를 전달받고, system_prompt 지침을 이식하여 프록시 중계합니다.
func handleChatProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "허용되지 않는 HTTP 메서드입니다", http.StatusMethodNotAllowed)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "요청 본문 읽기 실패: "+err.Error(), http.StatusBadRequest)
		return
	}

	// 1. 프론트엔드가 전달한 페이로드에서 provider 및 system_prompt 인출
	var tempReq struct {
		Provider     string `json:"provider"`
		SystemPrompt string `json:"system_prompt"`
	}
	if err := json.Unmarshal(bodyBytes, &tempReq); err != nil || tempReq.Provider == "" {
		http.Error(w, "프로바이더 속성을 검출할 수 없습니다", http.StatusBadRequest)
		return
	}

	config, err := loadConfig()
	if err != nil {
		http.Error(w, "설정을 조회하지 못했습니다: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. 메시지에 System Prompt 지침을 주입하고 내부 UI 제어 필드는 원격 payload에서 제거합니다.
	processedPayload, err := PrepareChatPayloadForProxy(bodyBytes, tempReq.SystemPrompt)
	if err != nil {
		http.Error(w, "챗 페이로드 정리 처리 에러: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 3. 중계 프록싱 전달
	resp, err := handleProxyChat(tempReq.Provider, processedPayload, config)
	if err != nil {
		http.Error(w, "원격 AI 서버 챗 프록싱 예외: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// handleProxyChat 함수는 프론트엔드로부터의 대화 메시지 세션을 복호화된 키와 함께 대상 API로 안전하게 릴레이합니다.
func handleProxyChat(provider string, baseRequestPayload []byte, config AppConfig) (*http.Response, error) {
	provCfg, exists := config[provider]
	if !exists {
		return nil, fmt.Errorf("프로바이더(%s)의 연동 키가 활성화되지 않았습니다", provider)
	}

	// 키 복호화 처리
	apiKey, err := providerAPIKey(provider, provCfg)
	if err != nil {
		return nil, fmt.Errorf("인증 토큰 복구 오류: %w", err)
	}

	baseURL, err := normalizeProviderBaseURL(provider, provCfg.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("Base URL 정규화 실패: %w", err)
	}

	chatURL := fmt.Sprintf("%s/chat/completions", strings.TrimSuffix(baseURL, "/"))

	// 원격지로 보낼 POST 요청 객체를 재조립합니다.
	req, err := http.NewRequest("POST", chatURL, bytes.NewBuffer(baseRequestPayload))
	if err != nil {
		return nil, fmt.Errorf("중계 HTTP 요청 구성 실패: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
	req.Header.Set("Content-Type", "application/json")
	if provider == "openrouter" {
		req.Header.Set("HTTP-Referer", "http://localhost:8080")
		req.Header.Set("X-Title", "LiteFlashChat")
	}

	client := &http.Client{}
	return client.Do(req)
}
