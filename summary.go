package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// handleChatSummaryProxy 핸들러는 오래된 메시지 묶음을 같은 모델로 요약하여
// 프론트엔드 컨텍스트 압축 상태에 저장할 수 있는 압축 문자열을 반환합니다.
func handleChatSummaryProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "허용되지 않는 HTTP 메서드입니다", http.StatusMethodNotAllowed)
		return
	}

	var req SummaryProxyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "요약 요청 본문(JSON) 데이터 포맷이 불량합니다", http.StatusBadRequest)
		return
	}

	payload, summarizedIDs, err := BuildSummaryPayload(req)
	if err != nil {
		http.Error(w, "요약 payload 생성 실패: "+err.Error(), http.StatusBadRequest)
		return
	}

	config, err := loadConfig()
	if err != nil {
		http.Error(w, "설정을 조회하지 못했습니다: "+err.Error(), http.StatusInternalServerError)
		return
	}

	resp, err := handleProxyChat(req.Provider, payload, config)
	if err != nil {
		http.Error(w, "원격 AI 서버 요약 프록싱 예외: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "요약 응답 본문 읽기 실패: "+err.Error(), http.StatusBadGateway)
		return
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		http.Error(w, string(bodyBytes), resp.StatusCode)
		return
	}

	summary, err := ExtractSummaryFromChatResponse(bodyBytes)
	if err != nil {
		http.Error(w, "요약 응답 추출 실패: "+err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(SummaryProxyResponse{
		Summary:              summary,
		SummarizedMessageIDs: summarizedIDs,
	})
}

// BuildSummaryPayload 함수는 오래된 대화 묶음을 원격 chat/completions 요약 요청으로 변환합니다.
func BuildSummaryPayload(req SummaryProxyRequest) ([]byte, []string, error) {
	if strings.TrimSpace(req.Provider) == "" {
		return nil, nil, fmt.Errorf("요약 provider가 누락되었습니다")
	}
	if strings.TrimSpace(req.Model) == "" {
		return nil, nil, fmt.Errorf("요약 model이 누락되었습니다")
	}
	if len(req.Messages) == 0 {
		return nil, nil, fmt.Errorf("요약할 메시지가 없습니다")
	}

	messageLines := []string{}
	summarizedIDs := []string{}
	for _, msg := range req.Messages {
		content := strings.TrimSpace(msg.Content)
		if content == "" {
			continue
		}
		role := strings.TrimSpace(msg.Role)
		if role == "" {
			role = "unknown"
		}
		messageLines = append(messageLines, fmt.Sprintf("[%s] %s", role, content))
		if strings.TrimSpace(msg.ID) != "" {
			summarizedIDs = append(summarizedIDs, msg.ID)
		}
	}
	if len(messageLines) == 0 {
		return nil, nil, fmt.Errorf("요약 가능한 메시지 본문이 없습니다")
	}

	payload := map[string]interface{}{
		"model": req.Model,
		"messages": []map[string]string{
			{
				"role":    "system",
				"content": "다음 대화 기록을 후속 대화 맥락 보존에 필요한 핵심 사실, 결정, 미해결 과제 중심으로 한국어로 간결하게 요약하십시오.",
			},
			{
				"role":    "user",
				"content": strings.Join(messageLines, "\n"),
			},
		},
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, fmt.Errorf("요약 payload 직렬화 실패: %w", err)
	}
	return payloadBytes, summarizedIDs, nil
}

// ExtractSummaryFromChatResponse 함수는 OpenAI 호환 chat/completions 응답에서 요약 본문을 추출합니다.
func ExtractSummaryFromChatResponse(bodyBytes []byte) (string, error) {
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(bodyBytes, &parsed); err != nil {
		return "", fmt.Errorf("요약 응답 파싱 실패: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("요약 응답에 choices가 없습니다")
	}
	summary := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if summary == "" {
		return "", fmt.Errorf("요약 응답이 비어 있습니다")
	}
	return summary, nil
}
