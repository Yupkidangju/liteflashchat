package main

import (
	"encoding/json"
	"fmt"
)

// InjectSystemPrompt 함수는 프론트엔드가 요청 본문과 함께 선택 전송한 System Prompt 가 존재할 경우,
// 메시지 목록의 인덱스 0번 위치에 {role: "system", content: systemPrompt} 객체를 삽입 재직렬화합니다.
func InjectSystemPrompt(payloadBytes []byte, systemPrompt string) ([]byte, error) {
	if systemPrompt == "" {
		return payloadBytes, nil
	}

	// 원시 JSON을 범용 맵으로 변환합니다.
	var rawMap map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &rawMap); err != nil {
		return nil, fmt.Errorf("페이로드 언마샬 실패: %w", err)
	}

	// messages 슬라이스를 인출합니다.
	messagesRaw, exists := rawMap["messages"]
	if !exists {
		return payloadBytes, nil
	}

	messagesSlice, ok := messagesRaw.([]interface{})
	if !ok {
		return payloadBytes, nil
	}

	// system 롤 객체 조립
	systemMsg := map[string]interface{}{
		"role":    "system",
		"content": systemPrompt,
	}

	// 0번 위치에 이식하고 기존 메시지를 부착합니다.
	newMessages := make([]interface{}, 0, len(messagesSlice)+1)
	newMessages = append(newMessages, systemMsg)
	newMessages = append(newMessages, messagesSlice...)

	rawMap["messages"] = newMessages

	// JSON 재직렬화
	processedBytes, err := json.Marshal(rawMap)
	if err != nil {
		return nil, fmt.Errorf("페이로드 재마샬 실패: %w", err)
	}

	return processedBytes, nil
}

// PrepareChatPayloadForProxy 함수는 내부 UI 제어 필드를 제거하고 system 프롬프트를
// OpenAI 호환 messages 배열에만 반영하여 원격 API로 누출되지 않게 합니다.
func PrepareChatPayloadForProxy(payloadBytes []byte, systemPrompt string) ([]byte, error) {
	processedPayload, err := InjectSystemPrompt(payloadBytes, systemPrompt)
	if err != nil {
		return nil, err
	}

	var rawMap map[string]interface{}
	if err := json.Unmarshal(processedPayload, &rawMap); err != nil {
		return nil, fmt.Errorf("프록시 페이로드 정리용 언마샬 실패: %w", err)
	}

	delete(rawMap, "provider")
	delete(rawMap, "system_prompt")

	cleanedPayload, err := json.Marshal(rawMap)
	if err != nil {
		return nil, fmt.Errorf("프록시 페이로드 정리용 재마샬 실패: %w", err)
	}
	return cleanedPayload, nil
}

// AddStreamFlagToPayload 함수는 원격 OpenAI 호환 요청에 stream=true를 주입합니다.
func AddStreamFlagToPayload(payloadBytes []byte) ([]byte, error) {
	var rawMap map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &rawMap); err != nil {
		return nil, fmt.Errorf("스트리밍 payload 언마샬 실패: %w", err)
	}
	rawMap["stream"] = true
	streamPayload, err := json.Marshal(rawMap)
	if err != nil {
		return nil, fmt.Errorf("스트리밍 payload 재마샬 실패: %w", err)
	}
	return streamPayload, nil
}
