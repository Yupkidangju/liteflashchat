package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
)

// handleChatStreamProxy 핸들러는 원격 OpenAI 호환 스트림을 내부 SSE 이벤트로 변환해 중계합니다.
func handleChatStreamProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "허용되지 않는 HTTP 메서드입니다", http.StatusMethodNotAllowed)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "요청 본문 읽기 실패: "+err.Error(), http.StatusBadRequest)
		return
	}

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

	processedPayload, err := PrepareChatPayloadForProxy(bodyBytes, tempReq.SystemPrompt)
	if err != nil {
		http.Error(w, "스트리밍 챗 페이로드 정리 처리 에러: "+err.Error(), http.StatusInternalServerError)
		return
	}
	streamPayload, err := AddStreamFlagToPayload(processedPayload)
	if err != nil {
		http.Error(w, "스트리밍 챗 페이로드 생성 에러: "+err.Error(), http.StatusInternalServerError)
		return
	}

	resp, err := handleProxyChatStream(tempReq.Provider, streamPayload, config, r)
	if err != nil {
		http.Error(w, "원격 AI 서버 스트리밍 프록싱 예외: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		http.Error(w, string(bodyBytes), resp.StatusCode)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "현재 HTTP writer는 스트리밍 flush를 지원하지 않습니다", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	flushWriter := flushAfterWriteWriter{writer: w, flusher: flusher}
	if err := StreamOpenAICompatibleResponse(flushWriter, resp.Body); err != nil {
		log.Printf("[LiteFlashChat] 스트림 중계 종료: %v", err)
	}
}

type flushAfterWriteWriter struct {
	writer  io.Writer
	flusher http.Flusher
}

func (w flushAfterWriteWriter) Write(p []byte) (int, error) {
	n, err := w.writer.Write(p)
	w.flusher.Flush()
	return n, err
}

// WriteStreamEvent 함수는 내부 스트리밍 이벤트를 브라우저 SSE 형식으로 기록합니다.
func WriteStreamEvent(w io.Writer, event StreamProxyEvent) error {
	eventBytes, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("스트림 이벤트 직렬화 실패: %w", err)
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", eventBytes); err != nil {
		return fmt.Errorf("스트림 이벤트 쓰기 실패: %w", err)
	}
	return nil
}

// StreamOpenAICompatibleResponse 함수는 원격 OpenAI 호환 SSE를 LiteFlashChat 내부 이벤트로 변환합니다.
func StreamOpenAICompatibleResponse(dst io.Writer, src io.Reader) error {
	scanner := bufio.NewScanner(src)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}
		if !strings.HasPrefix(line, "data:") {
			continue
		}

		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			return WriteStreamEvent(dst, StreamProxyEvent{Type: "done"})
		}

		var parsed struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
				FinishReason interface{} `json:"finish_reason"`
			} `json:"choices"`
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal([]byte(data), &parsed); err != nil {
			_ = WriteStreamEvent(dst, StreamProxyEvent{Type: "error", Content: "원격 스트림 JSON 파싱 실패: " + err.Error()})
			return fmt.Errorf("원격 스트림 JSON 파싱 실패: %w", err)
		}
		if parsed.Error.Message != "" {
			_ = WriteStreamEvent(dst, StreamProxyEvent{Type: "error", Content: parsed.Error.Message})
			return fmt.Errorf("원격 스트림 오류: %s", parsed.Error.Message)
		}
		for _, choice := range parsed.Choices {
			content := choice.Delta.Content
			if content == "" {
				content = choice.Message.Content
			}
			if content != "" {
				if err := WriteStreamEvent(dst, StreamProxyEvent{Type: "delta", Content: content}); err != nil {
					return err
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		_ = WriteStreamEvent(dst, StreamProxyEvent{Type: "error", Content: "원격 스트림 읽기 실패: " + err.Error()})
		return fmt.Errorf("원격 스트림 읽기 실패: %w", err)
	}
	return WriteStreamEvent(dst, StreamProxyEvent{Type: "done"})
}

// handleProxyChatStream 함수는 stream=true payload를 원격 API에 전달하고 원격 SSE 응답을 반환합니다.
func handleProxyChatStream(provider string, streamRequestPayload []byte, config AppConfig, sourceRequest *http.Request) (*http.Response, error) {
	provCfg, exists := config[provider]
	if !exists {
		return nil, fmt.Errorf("프로바이더(%s)의 연동 키가 활성화되지 않았습니다", provider)
	}

	apiKey, err := providerAPIKey(provider, provCfg)
	if err != nil {
		return nil, fmt.Errorf("인증 토큰 복구 오류: %w", err)
	}

	baseURL, err := normalizeProviderBaseURL(provider, provCfg.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("Base URL 정규화 실패: %w", err)
	}

	chatURL := fmt.Sprintf("%s/chat/completions", strings.TrimSuffix(baseURL, "/"))
	req, err := http.NewRequestWithContext(sourceRequest.Context(), "POST", chatURL, bytes.NewBuffer(streamRequestPayload))
	if err != nil {
		return nil, fmt.Errorf("스트리밍 중계 HTTP 요청 구성 실패: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	if provider == "openrouter" {
		req.Header.Set("HTTP-Referer", "http://localhost:8080")
		req.Header.Set("X-Title", "LiteFlashChat")
	}

	client := &http.Client{}
	return client.Do(req)
}
