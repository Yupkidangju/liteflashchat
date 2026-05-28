package main

import (
	"encoding/json"
	"net/http"
)

// handlePromptsCRUD 함수는 Super Prompt의 저장(POST), 로드(GET), 삭제(DELETE) CRUD 라이프사이클을 매핑합니다.
func handlePromptsCRUD(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		// 프롬프트 전체 목록 반환
		prompts, err := loadPrompts()
		if err != nil {
			http.Error(w, "프롬프트 목록 조회 중 에러: "+err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(prompts)

	case http.MethodPost:
		// 신규 저장 및 기존 이름 매핑 덮어쓰기 편집
		var reqPrompt SuperPrompt
		if err := json.NewDecoder(r.Body).Decode(&reqPrompt); err != nil {
			http.Error(w, "요청 본문 포맷이 올바르지 않습니다", http.StatusBadRequest)
			return
		}

		if reqPrompt.Name == "" || reqPrompt.Content == "" {
			http.Error(w, "프롬프트 이름(name) 및 지침 내용(content)은 필수 항목입니다", http.StatusBadRequest)
			return
		}

		prompts, err := loadPrompts()
		if err != nil {
			http.Error(w, "기존 프롬프트 조회 중 실패: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// 동일 이름 프롬프트가 존재한다면 덮어쓰기(수정) 처리합니다.
		foundIdx := -1
		for idx, p := range prompts {
			if p.Name == reqPrompt.Name {
				foundIdx = idx
				break
			}
		}

		if foundIdx != -1 {
			prompts[foundIdx].Content = reqPrompt.Content
		} else {
			prompts = append(prompts, reqPrompt)
		}

		if err := savePrompts(prompts); err != nil {
			http.Error(w, "프롬프트 저장 중 예외: "+err.Error(), http.StatusInternalServerError)
			return
		}

		_, _ = w.Write([]byte(`{"status":"success","message":"Super Prompt saved successfully."}`))

	case http.MethodDelete:
		// 지정된 프롬프트 영구 삭제
		nameToDelete := r.URL.Query().Get("name")
		if nameToDelete == "" {
			http.Error(w, "삭제할 프롬프트 이름이 제공되지 않았습니다", http.StatusBadRequest)
			return
		}

		prompts, err := loadPrompts()
		if err != nil {
			http.Error(w, "기존 프롬프트 로딩 실패: "+err.Error(), http.StatusInternalServerError)
			return
		}

		newPrompts := []SuperPrompt{}
		found := false
		for _, p := range prompts {
			if p.Name == nameToDelete {
				found = true
				continue
			}
			newPrompts = append(newPrompts, p)
		}

		if !found {
			http.Error(w, "지정된 이름의 프롬프트를 찾을 수 없습니다", http.StatusNotFound)
			return
		}

		if err := savePrompts(newPrompts); err != nil {
			http.Error(w, "프롬프트 영구 삭제 실패: "+err.Error(), http.StatusInternalServerError)
			return
		}

		_, _ = w.Write([]byte(`{"status":"success","message":"Super Prompt deleted successfully."}`))

	default:
		http.Error(w, "허용되지 않는 HTTP 메서드입니다", http.StatusMethodNotAllowed)
	}
}
