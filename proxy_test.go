// [v1.1.0] 최초 작성
// 이 테스트 코드는 proxy.go의 InjectSystemPrompt 함수 무결성을 단위 테스트하기 위해 작성되었습니다.
// 다양한 JSON 페이로드 구조에서 system 프롬프트 지침이 정상 인젝션되는지 검증합니다.

package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

// TestInjectSystemPrompt 함수는 정상적인 OpenAI 규격 페이로드 및 비어있는 지침, 오염된 JSON 하에서의 안전 인젝션을 검증합니다.
func TestInjectSystemPrompt(t *testing.T) {
	// 정상적인 OpenAI 대화 페이로드 가정
	rawPayload := `{
		"provider": "openrouter",
		"model": "anthropic/claude-3.5-sonnet",
		"messages": [
			{"role": "user", "content": "안녕하세요"}
		]
	}`

	systemPrompt := "당신은 고양이 페르소나입니다. 말끝마다 냥을 붙이십시오."

	// 1. 정상 주입 스캔 테스트
	processed, err := InjectSystemPrompt([]byte(rawPayload), systemPrompt)
	if err != nil {
		t.Fatalf("정상 주입 과정에서 예외 발생: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(processed, &parsed); err != nil {
		t.Fatalf("가공된 페이로드 JSON Unmarshal 실패: %v", err)
	}

	messagesRaw, exists := parsed["messages"]
	if !exists {
		t.Fatalf("messages 키가 가공된 페이로드에서 유실되었습니다")
	}

	messagesSlice, ok := messagesRaw.([]interface{})
	if !ok || len(messagesSlice) != 2 {
		t.Fatalf("메시지 리스트 크기가 2가 아닙니다. 실제 크기: %d", len(messagesSlice))
	}

	// 0번 인덱스에 system 롤이 안전하게 삽입되었는지 체크합니다.
	firstMsg, ok := messagesSlice[0].(map[string]interface{})
	if !ok {
		t.Fatalf("0번 메시지 맵 변환 실패")
	}

	if firstMsg["role"] != "system" || firstMsg["content"] != systemPrompt {
		t.Errorf("System Prompt 주입 오류. 실제 결과: %v", firstMsg)
	}

	t.Log("정상적인 System Prompt 인젝션 테스트 성공.")

	// 2. 빈 시스템 프롬프트 주입 스캔 테스트 (변화 없이 원본 유지되어야 함)
	processedEmpty, err := InjectSystemPrompt([]byte(rawPayload), "")
	if err != nil {
		t.Fatalf("빈 프롬프트 주입 실패: %v", err)
	}

	if string(processedEmpty) != rawPayload {
		t.Error("빈 프롬프트가 주입되었음에도 원본 페이로드가 변조되었습니다")
	}

	t.Log("빈 System Prompt 전달 시 원본 페이로드 정합성 유지 테스트 성공.")

	// 3. 비정상 JSON 전달 시 에러 리턴 감사 테스트
	_, errInvalid := InjectSystemPrompt([]byte(`{invalid-json`), systemPrompt)
	if errInvalid == nil {
		t.Error("불량 JSON 전달 시 백엔드 오류 감지가 누락되었습니다")
	} else {
		t.Logf("불량 JSON 오류 정상 검출 통과: %v", errInvalid)
	}
}

// TestParseRemoteModelsMetadata 함수는 원격 모델 응답에서 컨텍스트/출력 한도/지원 파라미터가
// 프론트엔드 계약 필드로 손실 없이 매핑되는지 검증합니다.
func TestParseRemoteModelsMetadata(t *testing.T) {
	openRouterPayload := []byte(`{
		"data": [{
			"id": "anthropic/claude-3.5-sonnet",
			"name": "Claude 3.5 Sonnet",
			"context_length": 200000,
			"top_provider": {"max_completion_tokens": 8192},
			"supported_parameters": ["temperature", "top_p", "repetition_penalty"],
			"architecture": {"modality": "text+image"}
		}]
	}`)

	models, err := parseRemoteModels("openrouter", openRouterPayload)
	if err != nil {
		t.Fatalf("OpenRouter 모델 파싱 실패: %v", err)
	}
	if len(models) != 1 {
		t.Fatalf("모델 개수가 기대와 다릅니다: %d", len(models))
	}

	model := models[0]
	if model.ContextLength != 200000 || model.MaxOutputTokens != 8192 || model.MaxInputTokens != 191808 {
		t.Fatalf("토큰 한도 매핑이 잘못되었습니다: %+v", model)
	}
	if !model.SupportsVision || !model.SupportsTemperature || !model.SupportsTopP || !model.SupportsRepetitionPenalty {
		t.Fatalf("지원 플래그 매핑이 누락되었습니다: %+v", model)
	}
	if model.SupportsTopK {
		t.Fatalf("명시되지 않은 top_k가 활성화되었습니다: %+v", model)
	}

	openAICompatiblePayload := []byte(`{
		"data": [{
			"id": "local-model",
			"max_context_length": 32768,
			"supported_parameters": ["temperature"]
		}]
	}`)

	models, err = parseRemoteModels("lm_studio", openAICompatiblePayload)
	if err != nil {
		t.Fatalf("OpenAI 호환 모델 파싱 실패: %v", err)
	}
	if models[0].ContextLength != 32768 || models[0].MaxInputTokens != 32768 {
		t.Fatalf("OpenAI 호환 컨텍스트 매핑이 잘못되었습니다: %+v", models[0])
	}
	if !models[0].SupportsTemperature || models[0].SupportsTopP || models[0].SupportsTopK || models[0].SupportsRepetitionPenalty {
		t.Fatalf("확실하지 않은 파라미터가 활성화되었습니다: %+v", models[0])
	}
	if models[0].MetadataSource != "openai_compatible" || models[0].IsContextEstimated {
		t.Fatalf("OpenAI 호환 메타데이터 출처가 기대와 다릅니다: %+v", models[0])
	}
}

// TestParseRemoteModelsWithoutMetadataDoesNotInvent8192 함수는 메타데이터가 없는 OpenAI 호환
// 모델에 8192 같은 임의 컨텍스트를 확정값처럼 주입하지 않는지 검증합니다.
func TestParseRemoteModelsWithoutMetadataDoesNotInvent8192(t *testing.T) {
	payload := []byte(`{
		"data": [{
			"id": "unknown-context-model"
		}]
	}`)

	models, err := parseRemoteModels("local_llm", payload)
	if err != nil {
		t.Fatalf("메타데이터 없는 모델 파싱 실패: %v", err)
	}
	if len(models) != 1 {
		t.Fatalf("모델 개수가 기대와 다릅니다: %d", len(models))
	}
	model := models[0]
	if model.ContextLength != 0 || model.MaxInputTokens != 0 || !model.IsContextEstimated || model.MetadataSource != "unknown" {
		t.Fatalf("메타데이터 없는 모델이 확정 컨텍스트처럼 표시됩니다: %+v", model)
	}
}

// TestMergeLMStudioV0Metadata 함수는 OpenAI 호환 /v1/models 응답에 없는 LM Studio
// max_context_length를 /api/v0/models 응답으로 보강하는지 검증합니다.
func TestMergeLMStudioV0Metadata(t *testing.T) {
	models := []UIModelInfo{
		buildUIModelInfo("qwen/qwen3", "qwen3", 0, 2048, []string{"temperature"}, false, "unknown", true),
	}
	merged := mergeLMStudioV0Metadata(models, []LMStudioV0ModelInfo{
		{ID: "qwen/qwen3", MaxContextLength: 32768},
	})

	if merged[0].ContextLength != 32768 || merged[0].MaxInputTokens != 30720 {
		t.Fatalf("LM Studio v0 컨텍스트 병합이 기대와 다릅니다: %+v", merged[0])
	}
	if merged[0].MetadataSource != "lm_studio_api_v0" || merged[0].IsContextEstimated {
		t.Fatalf("LM Studio 메타데이터 출처가 기대와 다릅니다: %+v", merged[0])
	}
}

// TestPrepareChatPayloadForProxy 함수는 내부 제어 필드가 원격 LLM API로 누출되지 않고,
// system 프롬프트는 messages 배열에만 주입되는지 검증합니다.
func TestPrepareChatPayloadForProxy(t *testing.T) {
	rawPayload := []byte(`{
		"provider": "openrouter",
		"model": "anthropic/claude-3.5-sonnet",
		"messages": [{"role": "user", "content": "안녕하세요"}],
		"system_prompt": "한국어로 답변하십시오.",
		"temperature": 0.7,
		"top_p": 0.9
	}`)

	processed, err := PrepareChatPayloadForProxy(rawPayload, "한국어로 답변하십시오.")
	if err != nil {
		t.Fatalf("프록시 페이로드 준비 실패: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(processed, &parsed); err != nil {
		t.Fatalf("가공된 페이로드 파싱 실패: %v", err)
	}
	if _, exists := parsed["provider"]; exists {
		t.Fatalf("내부 provider 필드가 원격 payload에 남았습니다: %s", string(processed))
	}
	if _, exists := parsed["system_prompt"]; exists {
		t.Fatalf("내부 system_prompt 필드가 원격 payload에 남았습니다: %s", string(processed))
	}
	if parsed["temperature"].(float64) != 0.7 || parsed["top_p"].(float64) != 0.9 {
		t.Fatalf("지원 파라미터가 보존되지 않았습니다: %+v", parsed)
	}

	messages := parsed["messages"].([]interface{})
	first := messages[0].(map[string]interface{})
	if first["role"] != "system" || first["content"] != "한국어로 답변하십시오." {
		t.Fatalf("system 메시지 주입 결과가 기대와 다릅니다: %+v", first)
	}
}

// TestAddStreamFlagToPayload 함수는 원격 payload에 stream=true가 주입되고 내부 필드가
// 다시 생기지 않는지 검증합니다.
func TestAddStreamFlagToPayload(t *testing.T) {
	payload := []byte(`{
		"model": "local-model",
		"messages": [{"role": "user", "content": "안녕하세요"}]
	}`)

	streamPayload, err := AddStreamFlagToPayload(payload)
	if err != nil {
		t.Fatalf("스트리밍 플래그 주입 실패: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(streamPayload, &parsed); err != nil {
		t.Fatalf("스트리밍 payload 파싱 실패: %v", err)
	}
	if parsed["stream"] != true {
		t.Fatalf("stream=true가 주입되지 않았습니다: %+v", parsed)
	}
	if _, exists := parsed["provider"]; exists {
		t.Fatalf("내부 provider 필드가 스트림 payload에 포함되었습니다: %+v", parsed)
	}
}

// TestStreamOpenAICompatibleResponse 함수는 OpenAI 호환 SSE delta와 DONE 이벤트가
// LiteFlashChat 내부 stream 이벤트로 변환되는지 검증합니다.
func TestStreamOpenAICompatibleResponse(t *testing.T) {
	remoteStream := strings.Join([]string{
		`data: {"choices":[{"delta":{"content":"안녕"}}]}`,
		``,
		`data: {"choices":[{"delta":{"content":"하세요"}}]}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")

	var out bytes.Buffer
	if err := StreamOpenAICompatibleResponse(&out, strings.NewReader(remoteStream)); err != nil {
		t.Fatalf("스트림 변환 실패: %v", err)
	}

	result := out.String()
	if !strings.Contains(result, `"type":"delta","content":"안녕"`) {
		t.Fatalf("첫 delta 이벤트가 없습니다: %s", result)
	}
	if !strings.Contains(result, `"type":"delta","content":"하세요"`) {
		t.Fatalf("두 번째 delta 이벤트가 없습니다: %s", result)
	}
	if !strings.Contains(result, `"type":"done"`) {
		t.Fatalf("done 이벤트가 없습니다: %s", result)
	}
}

// TestStreamOpenAICompatibleResponseError 함수는 원격 오류 이벤트가 내부 error 이벤트로
// 변환되고 호출자에게 실패를 반환하는지 검증합니다.
func TestStreamOpenAICompatibleResponseError(t *testing.T) {
	remoteStream := `data: {"error":{"message":"quota exceeded"}}`

	var out bytes.Buffer
	err := StreamOpenAICompatibleResponse(&out, strings.NewReader(remoteStream))
	if err == nil {
		t.Fatalf("원격 오류가 실패로 반환되지 않았습니다")
	}
	if !strings.Contains(out.String(), `"type":"error","content":"quota exceeded"`) {
		t.Fatalf("error 이벤트가 없습니다: %s", out.String())
	}
}

// TestSummaryPayloadAndResponse 함수는 컨텍스트 압축 요약 요청이 원격 chat/completions
// 형식으로 만들어지고, 응답에서 요약 문자열을 추출하는지 검증합니다.
func TestSummaryPayloadAndResponse(t *testing.T) {
	req := SummaryProxyRequest{
		Provider:    "openrouter",
		Model:       "anthropic/claude-3.5-sonnet",
		TargetRatio: 0.7,
		Messages: []SummaryMessage{
			{ID: "msg_1", Role: "user", Content: "프로젝트 요구사항을 설명합니다."},
			{ID: "msg_2", Role: "assistant", Content: "요구사항을 정리합니다."},
		},
	}

	payload, ids, err := BuildSummaryPayload(req)
	if err != nil {
		t.Fatalf("요약 payload 생성 실패: %v", err)
	}
	if len(ids) != 2 || ids[0] != "msg_1" || ids[1] != "msg_2" {
		t.Fatalf("요약 대상 메시지 ID가 보존되지 않았습니다: %#v", ids)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(payload, &parsed); err != nil {
		t.Fatalf("요약 payload JSON 파싱 실패: %v", err)
	}
	if parsed["provider"] != nil {
		t.Fatalf("요약 원격 payload에 provider가 포함되었습니다: %s", string(payload))
	}
	if parsed["model"] != "anthropic/claude-3.5-sonnet" {
		t.Fatalf("요약 모델이 누락되었습니다: %+v", parsed)
	}

	summary, err := ExtractSummaryFromChatResponse([]byte(`{
		"choices": [{"message": {"content": "압축 요약 결과"}}]
	}`))
	if err != nil {
		t.Fatalf("요약 응답 추출 실패: %v", err)
	}
	if summary != "압축 요약 결과" {
		t.Fatalf("요약 문자열이 기대와 다릅니다: %s", summary)
	}
}
