package main

import (
	"encoding/json"
	"net/http"
)

// UIProviderResponse 구조체는 프론트엔드로 연동 정보 요약을 안전하게 반환하기 위해 정의되었습니다.
type UIProviderResponse struct {
	Name          string `json:"name"`
	DisplayName   string `json:"displayName"`
	HasKey        bool   `json:"hasKey"`
	BaseURL       string `json:"baseUrl"`
	ConfigStatus  string `json:"configStatus"`
	StatusMessage string `json:"statusMessage"`
}

// SaveKeyRequest 구조체는 프론트엔드로부터의 API 키 저장 요청 양식을 매핑합니다.
type SaveKeyRequest struct {
	Provider string `json:"provider"`
	APIKey   string `json:"api_key"`
	BaseURL  string `json:"base_url"`
}

// handleGetProviders 핸들러는 5대 프로바이더의 연동 정보 및 Base URL을 정돈하여 반환합니다.
func handleGetProviders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "허용되지 않는 HTTP 메서드입니다", http.StatusMethodNotAllowed)
		return
	}

	config, err := loadConfig()
	if err != nil {
		http.Error(w, "설정 데이터를 불러오는 중 실패: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var response []UIProviderResponse
	for _, p := range providerDefinitions {
		hasKey := false
		customURL := p.DefaultURL
		configStatus := providerStatusMissing
		statusMessage := "API Key가 아직 등록되지 않았습니다."

		if cfg, exists := config[p.Name]; exists {
			if cfg.BaseURL != "" {
				if normalizedURL, err := normalizeProviderBaseURL(p.Name, cfg.BaseURL); err == nil {
					customURL = normalizedURL
				} else {
					customURL = cfg.BaseURL
				}
			}
			if p.Local && cfg.EncryptedAPIKey == "" {
				hasKey = true
				configStatus = providerStatusReady
				statusMessage = "로컬 프로바이더가 Base URL 중심으로 준비되었습니다."
			} else if err := validateExistingProviderKey(cfg); err != nil {
				hasKey = false
				configStatus = providerStatusInvalidKey
				statusMessage = "저장된 키를 복호화할 수 없어 API Key 재등록이 필요합니다."
			} else {
				hasKey = true
				configStatus = providerStatusReady
				statusMessage = "프로바이더 설정이 준비되었습니다."
			}
		} else if p.Local {
			statusMessage = "API Key 없이 Base URL만 저장해도 사용할 수 있습니다."
		}

		response = append(response, UIProviderResponse{
			Name:          p.Name,
			DisplayName:   p.DisplayName,
			HasKey:        hasKey,
			BaseURL:       customURL,
			ConfigStatus:  configStatus,
			StatusMessage: statusMessage,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
}

// [v1.2.1] handleSaveKeys - API Key 등록 및 수정 핸들러
// '__KEEP_EXISTING__' 플래그를 지원하여, 수정 모드에서 API Key를 변경하지 않고
// Base URL만 변경하는 시나리오를 안전하게 처리합니다.
// 기존 암호화된 키를 그대로 유지하면서 Base URL만 업데이트할 수 있습니다.
func handleSaveKeys(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "허용되지 않는 HTTP 메서드입니다", http.StatusMethodNotAllowed)
		return
	}

	var req SaveKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "요청 본문(JSON) 데이터 포맷이 불량합니다", http.StatusBadRequest)
		return
	}

	if req.Provider == "" {
		http.Error(w, "필수 항목(provider)이 누락되었습니다", http.StatusBadRequest)
		return
	}

	baseUrl, err := normalizeProviderBaseURL(req.Provider, req.BaseURL)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.APIKey == "" && !isLocalProvider(req.Provider) {
		http.Error(w, "원격 프로바이더는 API Key가 필요합니다", http.StatusBadRequest)
		return
	}

	config, err := loadConfig()
	if err != nil {
		http.Error(w, "기존 설정을 불러오지 못했습니다: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// [v1.2.1] '__KEEP_EXISTING__' 플래그 처리:
	// 프론트엔드에서 수정 모드로 API Key를 변경하지 않은 경우 이 플래그가 전송됩니다.
	// 기존에 저장된 암호화 키(EncryptedAPIKey, IV)를 그대로 유지하고 Base URL만 업데이트합니다.
	if req.APIKey == "__KEEP_EXISTING__" {
		existing, exists := config[req.Provider]
		if !exists {
			http.Error(w, "기존 키가 존재하지 않아 수정할 수 없습니다. 새로운 API Key를 입력해 주십시오.", http.StatusBadRequest)
			return
		}
		if err := validateExistingProviderKey(existing); err != nil {
			http.Error(w, err.Error(), http.StatusConflict)
			return
		}
		// 기존 암호화 키를 유지하면서 Base URL만 갱신
		config[req.Provider] = ProviderConfig{
			EncryptedAPIKey: existing.EncryptedAPIKey,
			IV:              existing.IV,
			BaseURL:         baseUrl,
		}
	} else {
		apiKey := req.APIKey
		if apiKey == "" && isLocalProvider(req.Provider) {
			apiKey = localProviderDummyAPIKey
		}
		// 신규 등록 또는 키 변경: 새로운 API Key를 암호화하여 저장
		encryptedText, iv, err := Encrypt(apiKey)
		if err != nil {
			http.Error(w, "API 키 암호화 처리 중 예기치 못한 에러: "+err.Error(), http.StatusInternalServerError)
			return
		}
		config[req.Provider] = ProviderConfig{
			EncryptedAPIKey: encryptedText,
			IV:              iv,
			BaseURL:         baseUrl,
		}
	}

	if err := saveConfig(config); err != nil {
		http.Error(w, "암호화 설정 저장 도중 실패: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"success","message":"API Key encrypted and stored successfully."}`))
}
