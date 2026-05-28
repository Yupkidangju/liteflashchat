# LiteFlashChat 시스템 구현 요약 (implementation_summary.md)

본 문서는 LiteFlashChat 프로젝트의 아키텍처 구조를 파일 책임과 흐름 수준으로 상세 해체하여, 새로운 개발자나 AI 에이전트가 코드 베이스를 분석하고 작업을 실행할 수 있는 종합 참조 가이드를 제공합니다. (v1.4.0 구현 완료 및 Phase 12 구조 정리 로드맵 확정 - 스트리밍/API 플랫폼 기능 구현 결과 수록)

---

## 1. 전체 런타임 흐름 (Runtime Flow)
1. **서버 시작 (Go):**
   - 백엔드 프로세스 구동 시 `.secret.key`가 존재하는지 체크하고, 없으면 암호학적으로 강력한 32바이트 AES 키를 즉시 생성 및 파일로 고정 보존합니다.
   - 로컬 `keys.json` 파일 및 `prompts.json` 파일을 파싱하여 활성화된 API 프로바이더 정보와 Super Prompt 목록을 초기 메모리 맵에 적재합니다.
2. **프론트엔드 로딩 (Vite/React):**
   - 브라우저 진입 시 `/api/providers` 및 `/api/prompts`를 조회하여 설정 모달의 프로바이더 상태 카드와 사이드바 Super Prompt 선택 목록을 채워넣습니다.
   - 대화 세션은 브라우저 `localStorage`의 `litechat_sessions` 키에서 복원하며, 파일 시스템의 `chats.json`은 사용하지 않습니다.
   - 프로바이더 저장 성공 시 `/api/providers`를 다시 조회하고 저장 대상 프로바이더를 활성 프로바이더, 현재 대화방 provider, 모델 목록에 즉시 반영합니다.
3. **대화 송수신 프록시 루틴:**
   - 사용자 입력 이벤트 발생 -> 프론트엔드가 백엔드 `/api/chat`에 payload 전달.
   - 이때 사용자가 Super Prompt를 장착하여 전송했다면, 백엔드가 메시지를 원격지로 전달하기 직전에 OpenAI 메시지 목록의 0번 인덱스에 `{role: "system", content: "시스템 프롬프트 지침"}` 객체를 가로채어 강제 인젝션(Interception & Injection) 처리한 후 중계합니다.
4. **v1.4.0 스트리밍 플랫폼 루틴:**
   - 사용자 입력 이벤트 발생 -> 프론트엔드가 assistant placeholder 메시지를 `streaming` 상태로 생성 -> 백엔드 `/api/chat/stream`에 요청.
   - 백엔드는 기존 payload 정리 및 system prompt 주입 후 원격 API에 `stream: true`로 요청하고, 원격 SSE delta를 브라우저 SSE로 중계합니다.
   - 프론트엔드는 delta를 같은 assistant 메시지에 누적하며, 취소 시 `cancelled`, 오류 시 `error`, 정상 종료 시 `complete` 상태로 저장합니다.

---

## 2. 시스템 분해 및 파일 책임 (File Responsibilities)

| 파일 경로 | 담당 핵심 역할 및 책임 범위 | 주요 함수 / 컴포넌트 시그니처 |
| --- | --- | --- |
| `main.go` | HTTP 서버 초기화, API Keys/Prompts CRUD 통합 핸들러, v1.4.0 stream 라우팅 | `func handleSaveKeys()`, `func handleGetProviders()`, `func handlePromptsCRUD()`, `func handleStreamChat()` |
| `crypto.go` | 32바이트 AES Key 생성/유지 및 AES-256-GCM 양방향 암호화 처리 | `func getOrInitKey()`, `func encrypt()`, `func decrypt()` |
| `config.go` | `keys.json` 및 `prompts.json` 파일 데이터베이스 I/O 관리 | `func loadConfig()`, `func saveConfig()`, `func loadPrompts()`, `func savePrompts()` |
| `providers.go` | 5대 프로바이더 메타데이터, Base URL 정규화, 로컬 키 정책, 기존 키 복호화 검증 | `normalizeProviderBaseURL()`, `validateExistingProviderKey()`, `providerAPIKey()` |
| `proxy.go` | 5대 프로바이더 API 중계 프록시, System Prompt 주입, 모델 메타데이터 병합, v1.4.0 SSE stream 중계 | `func handleProxyChat()`, `func handleProxyChatStream()`, `func fetchRemoteModels()`, `func fetchAndMergeLMStudioV0Metadata()` |
| `src/App.tsx` | UI 렌더링, 상태 제어, 모델 탐색기, Super Prompt 장착, 세션/파라미터/컨텍스트/수동 보정, v1.4.0 스트리밍/검색/Inspector/프리셋/데이터 관리 상태 관리 | `handleStreamChat()`, `handleCancelStream()`, `handleExportJson()`, `handleImportJson()`, `handleSavePreset()`, `handleApplyPreset()`, `buildPayloadMessages()` |
| `scripts/build-output.mjs` | 모든 운영체제 공통 output 패키징 빌드 자동화 | `npm run build:output` |

---

## 3. 핵심 알고리즘 메모 (Algorithm Memo)

### 3.1 Go System Prompt 주입 및 프록시 가로채기
사용자가 지정한 Super Prompt가 존재할 경우, 백엔드는 원격지로 페이로드를 원시 카피하기 전에 `ProxyChatRequest` 구조체로 언마샬링하여, 메시지의 0번째 요소로 `system` 메시지를 삽입하고 다시 마샬링하여 POST 요청을 발송합니다.

```go
// proxy.go 에 들어갈 메시지 가로채기 및 시스템 프롬프트 인터셉트 주입 예시
package main

import (
	"encoding/json"
	"fmt"
)

// InjectSystemPrompt 함수는 원시 payload 바이트 배열에서 메시지 필드를 추출해
// 0번 인덱스 위치에 system 롤 메시지를 이식하고 재직렬화합니다.
func InjectSystemPrompt(payloadBytes []byte, systemPrompt string) ([]byte, error) {
	if systemPrompt == "" {
		return payloadBytes, nil
	}

	var rawMap map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &rawMap); err != nil {
		return nil, fmt.Errorf("페이로드 파싱 실패: %w", err)
	}

	messagesRaw, exists := rawMap["messages"]
	if !exists {
		return payloadBytes, nil
	}

	messagesSlice, ok := messagesRaw.([]interface{})
	if !ok {
		return payloadBytes, nil
	}

	// 0번 위치에 system 역할 객체를 주입하기 위해 임시 슬라이스를 생성합니다.
	systemMsg := map[string]interface{}{
		"role":    "system",
		"content": systemPrompt,
	}

	newMessages := make([]interface{}, 0, len(messagesSlice)+1)
	newMessages = append(newMessages, systemMsg)
	newMessages = append(newMessages, messagesSlice...)

	// 원래 맵에 새 메시지 배열을 오버라이트합니다.
	rawMap["messages"] = newMessages

	// 다시 JSON 직렬화를 수행하여 가공된 바이트 배열을 추출합니다.
	processedBytes, err := json.Marshal(rawMap)
	if err != nil {
		return nil, fmt.Errorf("페이로드 재직렬화 실패: %w", err)
	}

	return processedBytes, nil
}
```

---

## 4. [v1.2.2 개정] 프로바이더 기존 키 유지 및 Base URL 갱신 알고리즘
API Key 유출 방지 및 기 등록 사용자의 재입력 번거로움을 제거하기 위한 백엔드(`main.go`)의 조건부 저장 알고리즘 구조입니다.

```go
// main.go - handleSaveKeys 내부 구현 흐름
if req.APIKey == "__KEEP_EXISTING__" {
    // 1. 기존에 저장된 암호화 키가 있는지 조회
    existing, exists := config[req.Provider]
    if !exists {
        http.Error(w, "기존 키가 존재하지 않아 수정할 수 없습니다.", http.StatusBadRequest)
        return
    }
    // 2. 기존 암호문이 현재 .secret.key로 복호화 가능한지 먼저 검증
    if err := validateExistingProviderKey(existing); err != nil {
        http.Error(w, err.Error(), http.StatusConflict)
        return
    }
    // 3. 검증된 EncryptedAPIKey와 IV를 그대로 보존하며 Base URL만 원자적으로 업데이트
    config[req.Provider] = ProviderConfig{
        EncryptedAPIKey: existing.EncryptedAPIKey,
        IV:              existing.IV,
        BaseURL:         baseUrl,
    }
} else {
    // 4. 신규 등록 또는 API Key 변경 시: 입력된 평문 Key를 AES-256-GCM 암호화 후 신규 생성된 IV와 저장
    encryptedText, iv, err := Encrypt(req.APIKey)
    if err != nil {
        http.Error(w, "API 키 암호화 에러", http.StatusInternalServerError)
        return
    }
    config[req.Provider] = ProviderConfig{
        EncryptedAPIKey: encryptedText,
        IV:              iv,
        BaseURL:         baseUrl,
    }
}
```
이로써 클라이언트의 브라우저 메모리에 복호화된 키를 되돌려 전송할 필요가 전혀 없어져, **보안 경계(Zero-Exposure Privacy)**가 완벽히 보장됩니다.

---

## 5. [v1.2.2 신규] 확정 구현 로드맵 및 완료 상태

| 구현 단위 | 상태 | 완료 기준 |
| --- | --- | --- |
| Unit 6-1 키 보존 테스트 격리 | 완료 | `crypto_test.go`가 실제 `.secret.key` 대신 임시 키 파일을 사용 |
| Unit 6-2 프로바이더 메타 계약 통합 | 완료 | `providers.go`가 provider 정의, 기본 URL, 로컬 여부를 단일 관리 |
| Unit 6-3 Base URL 정규화 | 완료 | `/models`, `/chat/completions` 입력을 API 루트로 정규화 |
| Unit 6-4 기존 키 유지 가드 | 완료 | `__KEEP_EXISTING__` 저장 전 기존 암호문 복호화 검증 |
| Unit 6-5 로컬 프로바이더 무키 저장 | 완료 | `lm_studio`, `local_llm`은 Key 없이 저장 가능 |
| Unit 6-6 모델 로드 실패 UX | 완료 | UI가 복호화 실패, 설정 누락, 연결 실패 안내를 표시 |
| Unit 6-7 품질 게이트 복구 | 완료 | `go test ./...`, `npm run lint`, `npm run build` 통과 |

### 5.1 남은 실행 점검 항목
* 실제 LM Studio 또는 OpenAI 호환 로컬 서버를 구동한 상태에서 `Base URL 저장 -> 모델 목록 로드 -> 모델 선택 -> 채팅 발송` 수동 E2E를 수행해야 합니다.
* 외부 OpenRouter/OpenCode 계열은 실제 유효 API Key가 필요하므로, 키 재등록 후 원격 401/403/모델 JSON 형태를 한 번 더 확인합니다.

---

## 6. [v1.2.3 신규] output 패키징 빌드 구조

`npm run build:output`은 Node 기반 스크립트로 실행되어 운영체제별 shell 명령 차이를 제거합니다.

1. `npm run build`로 Vite `dist/`를 생성합니다.
2. `go build -buildvcs=false -o output/liteflashchat[.exe] .`로 현재 운영체제용 실행 파일을 생성합니다.
3. `dist/`를 `output/dist/`로 복사합니다.
4. `output/` 내 실행 파일과 `output/dist/index.html` 존재 여부를 검증합니다.

보안상 `.secret.key`, `keys.json`, `prompts.json`은 output 패키징에 포함하지 않습니다.

---

## 7. [v1.2.4 신규] 웹 설정 즉시 반영 및 Super Prompt 분리 구조

### 7.1 프로바이더 저장 즉시 반영 흐름
1. 설정 모달에서 저장 버튼을 누르면 백엔드 `/api/keys`가 키 암호화 또는 `__KEEP_EXISTING__` 보존 저장을 수행합니다.
2. 성공 응답 후 프론트엔드는 `/api/providers`를 즉시 재호출하고 최신 Base URL, 활성 상태, 상태 메시지를 설정 모달 카드에 반영합니다.
3. 저장 대상 프로바이더를 `activeProvider`와 현재 대화방 `provider` 필드에 동기화합니다.
4. 저장 대상이 활성 상태이면 `/api/models?provider=<provider>`를 다시 호출하여 모델 선택 버튼과 오류 영역을 새로고침 없이 갱신합니다.

### 7.2 Super Prompt 책임 경계
* **설정 모달:** 생성, 편집 폼 적재, 저장, 삭제만 담당합니다.
* **사이드바 Super Prompt 패널:** 현재 대화방의 장착 상태 표시, 저장된 프롬프트 선택, 적용, 해제만 담당합니다.
* **의도:** 프로바이더 설정과 Super Prompt 적용이 같은 모달에서 섞여 사용자가 저장 후 실제 대화방에 적용됐는지 혼동하는 경로를 제거합니다.

### 7.3 명도 대비 정책
설정 모달의 라벨, 탭, 입력 필드, 상태 카드, 프롬프트 목록은 `#F8FAFC`, `#CBD5E1`, `#AEB7C6` 계열 토큰을 사용하여 어두운 배경 `#111827` 위에서 일반 텍스트 기준 4.5:1 이상의 대비를 목표로 합니다.

---

## 8. [v1.3.1] 모델 메타데이터, 컨텍스트 압축, 제목 관리 구현 순서

### 8.1 구현 의존성 그래프
1. **모델 계약 확장:** `proxy.go`의 모델 응답 파서와 `src/types.ts`의 `ModelInfo`를 먼저 확장합니다.
2. **세션 저장 계약 확장:** `ChatSession`에 `isTitleAutoGenerated`, `generationSettings`, `compressionRatio`, `contextSummary`, `summarizedMessageIds`를 추가하고 기존 `localStorage` 세션은 필드 누락을 기본값으로 보정합니다.
3. **UI 표시 추가:** 대화 제목 편집, 우측 파라미터 패널, 입력창 위 컨텍스트 바, 설정 모달 일반 설정 탭을 추가합니다.
4. **Payload 구성 분리:** `/api/chat`에 전달할 payload 생성 함수를 분리하고, 지원되는 파라미터와 출력 한도만 포함합니다.
5. **압축 루틴 연결:** 예상 컨텍스트가 `maxInputTokens * compressionRatio`를 넘을 때 `/api/chat/summary`를 먼저 호출하고 성공 결과만 저장합니다.
6. **수동 보정 연결:** 모델 메타데이터가 불명확하면 설정 모달에서 provider/model별 전체/입력/출력 한도를 저장하고 모델 목록 재수화 시 반영합니다.

### 8.2 파일별 구현 메모
| 파일 | v1.3.1 구현 기준 |
| --- | --- |
| `proxy.go` | OpenRouter `context_length`, `top_provider.max_completion_tokens`, `supported_parameters` 파싱. LM Studio `/api/v0/models.max_context_length` 병합. OpenAI 호환 응답은 명시 필드만 사용하고 임의 8K 폴백 금지. |
| `main.go` | `/api/chat/summary` 핸들러 추가, `/api/chat` payload에서 허용 파라미터만 중계. |
| `src/types.ts` | `ModelInfo`, `ModelMetadataOverride`, `GenerationSettings`, `ContextCompressionSettings`, `ChatSession` 확장. |
| `src/App.tsx` | 제목 편집 상태, 우측 파라미터 패널 상태, 컨텍스트 추정/압축 호출, 모델 한도 수동 보정, payload 빌더 구현. |
| `src/index.css` | 우측 패널, 컨텍스트 바, 제목 인라인 편집, 일반 설정 탭 스타일 추가. |

### 8.3 동결 기본값
| 항목 | 값 |
| --- | --- |
| `compressionRatio` | `0.7` |
| `temperature` | `1.0` |
| `topP` | `0.95` |
| `topK` | `40` |
| `repetitionPenalty` | `1.1` |
| 자동 제목 길이 | 최대 32자 |
| 토큰 추정식 | `Math.ceil(text.length / 4)` |

### 8.4 검증 기준
* `go test ./...`에서 모델 메타데이터 파싱, 지원 파라미터 필터, 요약 payload 구성을 검증합니다.
* `npm run lint`와 `npm run build`에서 확장 타입과 React 상태 흐름을 검증합니다.
* 수동 검증은 `모델 선택 -> 우측 패널 활성/비활성 확인 -> 기본값 1/0.95/40/1.1 확인 -> 첫 메시지 제목 자동 저장 -> 제목 수동 변경 -> 컨텍스트 초과 시 요약 시도 -> 채팅 발송` 순서로 수행합니다.

---

## 9. [v1.4.0 구현 완료] API 채팅 플랫폼 확장 구현 결과

### 9.1 구현 의존성 그래프
1. **타입 계약 확장:** `ChatMessage.status`, `ChatExportBundle`, `InspectorSnapshot`, `ChatPreset`을 정의했습니다.
2. **스트리밍 백엔드:** `/api/chat/stream`을 추가하고 기존 `PrepareChatPayloadForProxy`와 system prompt 주입 경로를 재사용했습니다.
3. **스트리밍 프론트:** assistant placeholder 생성, chunk 누적, `[중지]`, `complete/cancelled/error` 상태 전이를 구현했습니다.
4. **데이터 관리:** JSON export/import와 Markdown export를 구현했습니다. 가져오기는 삭제 없는 병합으로 고정했습니다.
5. **검색/Inspector/프리셋:** 각각 독립 UI 상태로 추가하되 모두 `ChatSession`과 `localStorage` 경계를 벗어나지 않게 구현했습니다.
6. **문서/패키징:** v1.4.0 완료 상태로 표준 문서와 패키지 버전을 동기화했습니다.

### 9.2 파일별 구현 메모
| 파일 | v1.4.0 구현 기준 |
| --- | --- |
| `proxy.go` | OpenAI 호환 SSE stream 중계, stream 오류 이벤트, 요청 context 취소, secret 마스킹 정책 구현 |
| `main.go` | `/api/chat/stream` 라우팅 및 CORS/SSE 헤더 적용 |
| `src/types.ts` | `ChatMessage.status`, `ChatExportBundle`, `ChatPreset`, `InspectorSnapshot` 타입 추가 |
| `src/App.tsx` | 스트리밍 전송/취소, 데이터 관리, 대화 검색, Inspector, 프리셋 상태 및 UI 연결 |
| `src/index.css` | 스트리밍 상태 라벨, 검색 입력, Inspector 블록, 데이터 관리/프리셋 탭 스타일 추가 |

### 9.3 동결 기본값 및 저장 키
| 항목 | 값 |
| --- | --- |
| 기본 채팅 경로 | `/api/chat/stream` |
| 자동 폴백 | 사용하지 않음 |
| JSON schemaVersion | `liteflashchat.v1.4.0` |
| 프리셋 저장 키 | `litechat_presets` |
| Inspector 저장 방식 | 영구 저장 없음, React 런타임 상태만 사용 |
| JSON 가져오기 정책 | 기존 데이터 삭제 없이 병합 |
| Markdown 가져오기 | 지원하지 않음 |

### 9.4 검증 기준
* `go test ./...`에서 stream payload 정리, SSE delta 파싱, 오류 이벤트, secret 미노출을 검증합니다.
* `npm run lint`와 `npm run build`에서 확장 타입과 React 상태 흐름을 검증합니다.
* 수동 검증은 `스트리밍 응답 -> 중지 -> JSON export/import -> Markdown export -> 검색 -> Inspector 복사 -> 프리셋 저장/적용 -> output 패키징 실행` 순서로 수행합니다.

---

## 10. [Phase 12 완료] 구조 정리 로드맵

### 10.1 현재 구조 진단
현재 기능은 v1.4.0 기준으로 동작하지만, 파일 책임이 커져 후속 API 모델 테스트 플랫폼 기능을 추가하기 어렵습니다.

| 파일 | 현재 줄 수 | 위험 |
| --- | ---: | --- |
| `src/App.tsx` | 2439 | Provider, 모델, 프롬프트, 세션, 스트리밍, export/import, 검색, Inspector, 프리셋, 모달 UI가 한 컴포넌트에 집중 |
| `src/index.css` | 1076 | 사이드바, 채팅, 설정 모달, 우측 패널, Inspector, 프리셋 스타일이 한 전역 파일에 집중 |
| `main.go` | 592 | 라우팅, CORS, 정적 서빙, 키 저장, 모델 조회, 채팅, 프롬프트 CRUD가 한 파일에 집중 |
| `proxy.go` | 723 | 모델 조회, 메타데이터 병합, 채팅 프록시, stream 중계, system prompt 주입 책임이 집중 |

### 10.1.1 2026-05-28 정리 완료 결과
| 파일/영역 | 정리 후 상태 | 책임 |
| --- | ---: | --- |
| `src/App.tsx` | 862줄 | 최상위 상태 연결, 화면 조립, provider/model/session 핸들러 일부 |
| `src/index.css` | 82줄 | 디자인 토큰, 전역 리셋, 기능별 style import |
| `src/styles/*` | 신규 분리 | sidebar, chat, modal, settings, right-panel, code 스타일 |
| `src/components/*` | 신규 분리 | Sidebar, ChatHeader, MessageList, InputPanel, ParamsPanel, SettingsModal, ModelSearchModal |
| `src/hooks/*` | 신규 분리 | 세션/압축률/모델 보정/프리셋/Inspector 상태 저장과 복사 |
| `src/services/chatFlow.ts` | 신규 분리 | 스트리밍 전송, 컨텍스트 압축, assistant 메시지 갱신, Inspector snapshot 기록 |
| `src/services/dataPortability.ts` | 신규 분리 | JSON/Markdown export, JSON import 병합 |
| `src/api/client.ts` | 신규 분리 | provider/model/prompt API 클라이언트 |
| `src/utils/*` | 신규/확장 | storage, export, model metadata, inspector sanitize, provider display helper |
| `main.go` | 62줄 | 서버 부트스트랩과 라우트 등록 |
| `models.go` | 신규 분리 | 모델 조회, 모델 메타데이터 파싱, LM Studio v0 메타데이터 병합 |
| `chat_proxy.go` | 신규 분리 | non-stream chat proxy 핸들러와 원격 chat 요청 |
| `stream_proxy.go` | 신규 분리 | stream proxy 핸들러, 원격 SSE 변환, 취소 context 중계 |
| `summary.go` | 신규 분리 | 컨텍스트 요약 payload/응답 처리 |
| `system_prompt.go` | 신규 분리 | system prompt 주입과 내부 UI 필드 제거 |
| `provider_handlers.go`, `prompts_handler.go`, `server.go` | 신규 분리 | provider/key CRUD, prompt CRUD, CORS/browser helper |

`proxy.go`는 기존 대형 구현이 분리되었음을 알리는 패키지 파일만 유지합니다.

### 10.2 정리 원칙
* 기능 동작, API endpoint, localStorage key, export schemaVersion, provider ID, 저장 파일 형식은 변경하지 않습니다.
* 새 전역 상태 라이브러리는 도입하지 않고 React hook과 props 조합으로만 분리합니다.
* 한 번에 대분리하지 않고, 순수 유틸 -> API 클라이언트 -> 상태 훅 -> UI 컴포넌트 -> CSS -> 백엔드 파일 순서로 이동합니다.
* 각 단위는 `npm run lint`, `npm run build`, `go test ./...`, `npm run build:output` 중 영향 범위에 맞는 검증을 통과해야 다음 단위로 넘어갑니다.

### 10.3 확정 구현 단위
| 단위 | 주요 이동 대상 | 새 책임 경계 |
| --- | --- | --- |
| Unit 12-1 기준선 고정 | 줄 수, 기능 목록, 검증 결과 | 리팩터링 전후 회귀 판단 기준 |
| Unit 12-2 순수 유틸 분리 | token/export/storage/model override/inspector helper | React 렌더링과 무관한 순수 함수 |
| Unit 12-3 API 클라이언트 분리 | provider/model/prompt/chat/stream fetch | HTTP 계약과 UI 상태 분리 |
| Unit 12-4 상태 훅 분리 | provider/model/prompt/session/preset/inspector state | 상태 전이와 화면 렌더링 분리 |
| Unit 12-5 UI 컴포넌트 분리 | Sidebar, ChatHeader, MessageList, InputPanel, SettingsModal, ModelSearchModal, RightPanel | props 기반 표시 컴포넌트 |
| Unit 12-6 스타일 분리 | sidebar/chat/modal/right-panel/settings CSS | 기능 영역별 스타일 소유권 |
| Unit 12-7 백엔드 파일 분리 | models/chat_proxy/stream_proxy/summary/system_prompt | API 라우팅과 프록시 알고리즘 분리 |
| Unit 12-8 문서/검증 마감 | 표준 문서와 changelog | 새 파일 책임과 검증 증거 반영 |

### 10.4 목표 완료 상태
* `src/App.tsx`는 화면 조립자 역할로 축소하고 900줄 이하를 유지합니다.
* `src/index.css`는 전역 토큰과 import 중심으로 축소하고 350줄 이하를 유지합니다.
* Go 백엔드의 공개 라우트와 JSON 계약은 변경하지 않습니다.
* Phase 12 완료 후에도 v1.4.0 수동 검증 순서가 그대로 유효해야 합니다.
