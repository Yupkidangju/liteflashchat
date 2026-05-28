package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// OpenAI Compatible Models API 응답 구조체 정의
type OpenAIModelInfo struct {
	ID                  string   `json:"id"`
	ContextLength       int      `json:"context_length"`
	MaxContextLength    int      `json:"max_context_length"`
	MaxCompletionTokens int      `json:"max_completion_tokens"`
	MaxTokens           int      `json:"max_tokens"`
	SupportedParameters []string `json:"supported_parameters"`
}

type OpenAIModelsResponse struct {
	Data []OpenAIModelInfo `json:"data"`
}

type LMStudioV0ModelInfo struct {
	ID               string `json:"id"`
	Path             string `json:"path"`
	MaxContextLength int    `json:"max_context_length"`
}

type LMStudioV0ModelsResponse struct {
	Data []LMStudioV0ModelInfo `json:"data"`
}

// OpenRouter 전용 모델 리스트 파싱을 위한 아키텍처 모델 정보 구조체
type OpenRouterModelArchitecture struct {
	Modality string `json:"modality"`
}

type OpenRouterModelInfo struct {
	ID                  string                      `json:"id"`
	Name                string                      `json:"name"`
	ContextLimit        int                         `json:"context_length"`
	MaxCompletionTokens int                         `json:"max_completion_tokens"`
	TopProvider         OpenRouterTopProvider       `json:"top_provider"`
	SupportedParameters []string                    `json:"supported_parameters"`
	Architecture        OpenRouterModelArchitecture `json:"architecture"`
}

type OpenRouterModelsResponse struct {
	Data []OpenRouterModelInfo `json:"data"`
}

type OpenRouterTopProvider struct {
	MaxCompletionTokens int `json:"max_completion_tokens"`
}

// Frontend Model Output API 반환 규격 구조체 정의
type UIModelInfo struct {
	ID                        string   `json:"id"`
	Name                      string   `json:"name"`
	ContextLength             int      `json:"contextLength"`
	MaxInputTokens            int      `json:"maxInputTokens"`
	MaxOutputTokens           int      `json:"maxOutputTokens"`
	SupportedParameters       []string `json:"supportedParameters"`
	SupportsVision            bool     `json:"supportsVision"`
	SupportsTemperature       bool     `json:"supportsTemperature"`
	SupportsTopP              bool     `json:"supportsTopP"`
	SupportsTopK              bool     `json:"supportsTopK"`
	SupportsRepetitionPenalty bool     `json:"supportsRepetitionPenalty"`
	MetadataSource            string   `json:"metadataSource"`
	IsContextEstimated        bool     `json:"isContextEstimated"`
}

type SummaryMessage struct {
	ID      string `json:"id"`
	Role    string `json:"role"`
	Content string `json:"content"`
}

type SummaryProxyRequest struct {
	Provider    string           `json:"provider"`
	Model       string           `json:"model"`
	Messages    []SummaryMessage `json:"messages"`
	TargetRatio float64          `json:"target_ratio"`
}

type SummaryProxyResponse struct {
	Summary              string   `json:"summary"`
	SummarizedMessageIDs []string `json:"summarized_message_ids"`
}

type StreamProxyEvent struct {
	Type    string `json:"type"`
	Content string `json:"content,omitempty"`
}

func handleGetModels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "허용되지 않는 HTTP 메서드입니다", http.StatusMethodNotAllowed)
		return
	}

	provider := r.URL.Query().Get("provider")
	if provider == "" {
		http.Error(w, "프로바이더 쿼리 파라미터가 누락되었습니다", http.StatusBadRequest)
		return
	}

	config, err := loadConfig()
	if err != nil {
		http.Error(w, "로컬 설정을 불러오지 못했습니다: "+err.Error(), http.StatusInternalServerError)
		return
	}

	uiModels, err := fetchRemoteModels(provider, config)
	if err != nil {
		http.Error(w, "원격 모델 목록 페치 중 실패: "+err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(uiModels)
}

// fetchRemoteModels 함수는 원격 호스트에서 모델 목록을 다운로드하고 Vision 지원 여부를 진단합니다.
func fetchRemoteModels(provider string, config AppConfig) ([]UIModelInfo, error) {
	provCfg, exists := config[provider]
	if !exists {
		return nil, fmt.Errorf("해당 프로바이더(%s)의 API 키가 등록되지 않았습니다", provider)
	}

	// 저장된 API 키를 해독합니다.
	apiKey, err := providerAPIKey(provider, provCfg)
	if err != nil {
		return nil, fmt.Errorf("API 키 복호화 실패: %w", err)
	}

	baseURL, err := normalizeProviderBaseURL(provider, provCfg.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("Base URL 정규화 실패: %w", err)
	}

	// Base URL 뒤에 /models를 부착합니다. (OpenAI 표준 규격)
	modelsURL := fmt.Sprintf("%s/models", strings.TrimSuffix(baseURL, "/"))

	req, err := http.NewRequest("GET", modelsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("HTTP 요청 객체 생성 실패: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
	req.Header.Set("Content-Type", "application/json")
	if provider == "openrouter" {
		req.Header.Set("HTTP-Referer", "http://localhost:8080")
		req.Header.Set("X-Title", "LiteFlashChat")
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("원격 모델 목록 페치 요청 실패: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("원격 API 서버 에러 (상태코드: %d, URL: %s) - %s", resp.StatusCode, modelsURL, string(bodyBytes))
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("응답 바디 리딩 실패: %w", err)
	}

	uiModels, err := parseRemoteModels(provider, bodyBytes)
	if err != nil {
		return nil, err
	}
	if provider == "lm_studio" {
		enrichedModels, err := fetchAndMergeLMStudioV0Metadata(uiModels, baseURL, apiKey)
		if err == nil {
			return enrichedModels, nil
		}
	}
	return uiModels, nil
}

// parseRemoteModels 함수는 provider별 원격 모델 목록 응답을 프론트엔드 UI 계약으로 변환합니다.
func parseRemoteModels(provider string, bodyBytes []byte) ([]UIModelInfo, error) {
	var uiModels []UIModelInfo
	if provider == "openrouter" {
		var orResp OpenRouterModelsResponse
		if err := json.Unmarshal(bodyBytes, &orResp); err != nil {
			return nil, fmt.Errorf("OpenRouter JSON Unmarshal 실패: %w", err)
		}

		for _, item := range orResp.Data {
			supportsVision := false
			lowerID := strings.ToLower(item.ID)
			lowerName := strings.ToLower(item.Name)

			if strings.Contains(lowerID, "vision") ||
				strings.Contains(lowerName, "vision") ||
				strings.Contains(lowerID, "multimodal") ||
				strings.Contains(lowerID, "claude-3-opus") ||
				strings.Contains(lowerID, "claude-3-sonnet") ||
				strings.Contains(lowerID, "claude-3.5-sonnet") ||
				strings.Contains(lowerID, "gpt-4o") ||
				strings.Contains(lowerID, "gemini-1.5") {
				supportsVision = true
			}

			if strings.Contains(strings.ToLower(item.Architecture.Modality), "multimodal") ||
				strings.Contains(strings.ToLower(item.Architecture.Modality), "image") {
				supportsVision = true
			}

			maxOutputTokens := item.TopProvider.MaxCompletionTokens
			if maxOutputTokens == 0 {
				maxOutputTokens = item.MaxCompletionTokens
			}

			uiModels = append(uiModels, buildUIModelInfo(
				item.ID,
				item.Name,
				item.ContextLimit,
				maxOutputTokens,
				item.SupportedParameters,
				supportsVision,
				"openrouter",
				item.ContextLimit <= 0,
			))
		}
	} else {
		// OpenAI 표준 호환 API 파싱 규격 (OpenCode Zen, OpenCode Go, LM Studio, Local LLM 공통)
		var oaResp OpenAIModelsResponse
		if err := json.Unmarshal(bodyBytes, &oaResp); err != nil {
			return nil, fmt.Errorf("OpenAI 모델 리스트 Unmarshal 실패: %w", err)
		}

		for _, item := range oaResp.Data {
			if provider == "opencode_go" && !isOpenCodeGoChatCompletionsModel(item.ID) {
				continue
			}

			lowerID := strings.ToLower(item.ID)
			supportsVision := false

			if strings.Contains(lowerID, "vision") ||
				strings.Contains(lowerID, "multimodal") ||
				strings.Contains(lowerID, "gpt-4o") ||
				strings.Contains(lowerID, "llava") ||
				strings.Contains(lowerID, "gemini") {
				supportsVision = true
			}

			displayName := item.ID
			if parts := strings.Split(item.ID, "/"); len(parts) > 1 {
				displayName = parts[len(parts)-1]
			}

			contextLength := firstPositiveInt(item.ContextLength, item.MaxContextLength)
			maxOutputTokens := firstPositiveInt(item.MaxCompletionTokens, item.MaxTokens, 0)
			metadataSource := "openai_compatible"
			isContextEstimated := contextLength <= 0
			if isContextEstimated {
				metadataSource = "unknown"
			}

			uiModels = append(uiModels, buildUIModelInfo(
				item.ID,
				displayName,
				contextLength,
				maxOutputTokens,
				item.SupportedParameters,
				supportsVision,
				metadataSource,
				isContextEstimated,
			))
		}
	}

	return uiModels, nil
}

func buildUIModelInfo(id string, name string, contextLength int, maxOutputTokens int, supportedParameters []string, supportsVision bool, metadataSource string, isContextEstimated bool) UIModelInfo {
	if maxOutputTokens < 0 {
		maxOutputTokens = 0
	}

	maxInputTokens := 0
	if contextLength > 0 {
		maxInputTokens = contextLength
	}
	if contextLength > 0 && maxOutputTokens > 0 && maxOutputTokens < contextLength {
		maxInputTokens = contextLength - maxOutputTokens
	}
	if metadataSource == "" {
		metadataSource = "unknown"
	}

	normalizedParameters := normalizeSupportedParameters(supportedParameters)

	return UIModelInfo{
		ID:                        id,
		Name:                      name,
		ContextLength:             contextLength,
		MaxInputTokens:            maxInputTokens,
		MaxOutputTokens:           maxOutputTokens,
		SupportedParameters:       normalizedParameters,
		SupportsVision:            supportsVision,
		SupportsTemperature:       containsParameter(normalizedParameters, "temperature"),
		SupportsTopP:              containsParameter(normalizedParameters, "top_p"),
		SupportsTopK:              containsParameter(normalizedParameters, "top_k"),
		SupportsRepetitionPenalty: containsParameter(normalizedParameters, "repetition_penalty"),
		MetadataSource:            metadataSource,
		IsContextEstimated:        isContextEstimated,
	}
}

func fetchAndMergeLMStudioV0Metadata(models []UIModelInfo, baseURL string, apiKey string) ([]UIModelInfo, error) {
	rootURL := strings.TrimSuffix(baseURL, "/")
	rootURL = strings.TrimSuffix(rootURL, "/v1")
	modelsURL := fmt.Sprintf("%s/api/v0/models", rootURL)

	req, err := http.NewRequest("GET", modelsURL, nil)
	if err != nil {
		return models, fmt.Errorf("LM Studio v0 모델 요청 객체 생성 실패: %w", err)
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return models, fmt.Errorf("LM Studio v0 모델 목록 요청 실패: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return models, fmt.Errorf("LM Studio v0 모델 목록 상태코드 실패: %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return models, fmt.Errorf("LM Studio v0 모델 목록 읽기 실패: %w", err)
	}

	var v0Resp LMStudioV0ModelsResponse
	if err := json.Unmarshal(bodyBytes, &v0Resp); err != nil {
		return models, fmt.Errorf("LM Studio v0 모델 JSON 파싱 실패: %w", err)
	}

	return mergeLMStudioV0Metadata(models, v0Resp.Data), nil
}

func mergeLMStudioV0Metadata(models []UIModelInfo, v0Models []LMStudioV0ModelInfo) []UIModelInfo {
	contextByID := map[string]int{}
	for _, model := range v0Models {
		if model.MaxContextLength <= 0 {
			continue
		}
		for _, key := range []string{model.ID, model.Path, modelDisplayName(model.ID), modelDisplayName(model.Path)} {
			key = strings.ToLower(strings.TrimSpace(key))
			if key != "" {
				contextByID[key] = model.MaxContextLength
			}
		}
	}

	merged := make([]UIModelInfo, len(models))
	copy(merged, models)
	for idx, model := range merged {
		contextLength := contextByID[strings.ToLower(model.ID)]
		if contextLength == 0 {
			contextLength = contextByID[strings.ToLower(model.Name)]
		}
		if contextLength == 0 {
			continue
		}
		merged[idx].ContextLength = contextLength
		merged[idx].MaxInputTokens = contextLength
		if merged[idx].MaxOutputTokens > 0 && merged[idx].MaxOutputTokens < contextLength {
			merged[idx].MaxInputTokens = contextLength - merged[idx].MaxOutputTokens
		}
		merged[idx].MetadataSource = "lm_studio_api_v0"
		merged[idx].IsContextEstimated = false
	}
	return merged
}

func modelDisplayName(modelID string) string {
	if parts := strings.Split(modelID, "/"); len(parts) > 1 {
		return parts[len(parts)-1]
	}
	return modelID
}

func normalizeSupportedParameters(params []string) []string {
	seen := map[string]bool{}
	normalized := []string{}
	for _, param := range params {
		key := strings.ToLower(strings.TrimSpace(param))
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		normalized = append(normalized, key)
	}
	return normalized
}

func containsParameter(params []string, target string) bool {
	for _, param := range params {
		if param == target {
			return true
		}
	}
	return false
}

func firstPositiveInt(values ...int) int {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

func isOpenCodeGoChatCompletionsModel(modelID string) bool {
	switch strings.ToLower(modelID) {
	case "glm-5.1", "glm-5",
		"kimi-k2.5", "kimi-k2.6",
		"deepseek-v4-pro", "deepseek-v4-flash",
		"mimo-v2.5", "mimo-v2.5-pro":
		return true
	default:
		return false
	}
}
