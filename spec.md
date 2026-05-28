# LiteFlashChat 마스터 스펙 (spec.md)

본 문서는 LiteFlashChat 프로젝트의 절대적인 마스터 스펙(Master Plan)으로, AI 구현 표준(`AI_IMPLEMENTATION_DOC_STANDARD.md`)에 정의된 설계 규칙에 의거하여 작성되었습니다. (v1.4.0 구현 완료 및 Phase 12 구조 정리 로드맵 확정 - 스트리밍, 데이터 관리, 검색, Inspector, 프리셋 기능 수록)

---

## 1. 문서 운영 규칙
* **문서의 지위:** 본 문서는 프로젝트의 모든 구현 계약, 타입, 데이터, 공식 및 로드맵의 표준 기점입니다. 소스코드와 다른 모든 하위 문서(`designs.md`, `implementation_summary.md` 등)는 본 문서의 정의를 엄격히 따라야 합니다.
* **변경 관리:** 스펙 변경 시 본 문서를 우선 갱신하며, 변경 이력은 SemVer 버전에 따라 `CHANGELOG.md`에 반드시 한국어로 기록되어야 합니다.

---

## 2. 프로젝트 정체성 및 메타데이터
* **프로젝트명:** LiteFlashChat (라이트플래시챗)
* **버전:** v1.4.0
* **환경:** Local Development & Production Desktop Web App
* **언어 표준:** 백엔드 Go 1.26.1, 프론트엔드 React 19 / TypeScript 6 / Vite 8, UI Vanilla CSS

---

## 3. 목표와 성공 기준
### 3.1 목표 (Goals)
1. **5대 프로바이더 프록시 지원:** OpenRouter, OpenCode Zen, OpenCode Go 및 신규 **LM Studio, Local LLM(OpenAI 호환)** API 연동 및 프록시 중계.
2. **무키 로컬 암호화 (No-Masterkey Cryptography):** 별도의 사용자 마스터 비밀번호 입력 없이, 백엔드가 로컬에 자동 생성한 `.secret.key`를 활용해 API 키를 AES-256-GCM으로 안전하게 암호화 보존.
3. **⚙️ 우측 상단 설정 레이어 통합:** 사이드바 공간을 정돈하고, 헤더 우측 상단 톱니바퀴(`⚙️`) 버튼을 통해 별도의 반투명 오버레이 레이어 안에서 5대 프로바이더의 연동 정보, 활성 상태, 오류 메시지를 일괄 설정 및 확인.
4. **Super Prompt(시스템 프롬프트) CRUD 엔진:** 사용자가 페르소나 지침(Super Prompt)을 저장하면 로컬 파일 `prompts.json`에 보존하고, 설정 모달에서 목록 로딩, 덮어쓰기 편집, 삭제를 수행하며, 사이드바에서 장착한 프롬프트만 채팅 메시지 최상단에 `system` 역할로 자동 주입 연동.
5. **지능형 기능 활성화 (Vision Auto-Detect):** 모델 메타데이터를 백엔드에서 읽어와 Vision 기능 지원 모델일 때만 프론트엔드 이미지/파일 업로드 인터페이스를 자동 활성화.
6. **프리미엄 다크 UI 구현:** Glassmorphism 효과와 미려한 그라데이션, 반응형 사이드바 레이아웃 제공.
7. **기본 웹 브라우저 자동 기동 (Auto-Open Browser):** 백엔드 포트 가동 직후 별도의 비동기 고루틴을 통해 OS 표준 셸 명령어(rundll32/open/xdg-open)를 실행하여 디바이스에 연결된 기본 웹 브라우저에서 `http://localhost:8080`을 자동으로 즉시 기동함.
8. **🔍 모델 탐색기 모달 도입 (v1.2.0):** 대규모 모델 목록을 수월하게 검색하도록 실시간 필터링(Reactive Filtering) 검색창과 푸른색 Vision 배지, 더블클릭 로딩을 제공하는 글래스 모달 UI 구현.
9. **✏️ 활성 프로바이더 수정 모드 및 안전 유지 (v1.2.1):** 설정 모달에서 이미 키가 등록된 프로바이더를 선택할 경우 수정 모드가 활성화되며, API Key를 변경하지 않아도 Base URL 변경만으로 저장이 가능하도록 `__KEEP_EXISTING__` 안전 암호화 플래그 계약 체결.
10. **🛡️ 설정 사이클 복구 및 키 보존 안정화 (v1.2.2):** 테스트가 실제 `.secret.key`를 삭제하지 않도록 격리하고, 기존 키 유지 저장 전에 복호화 검증을 수행하며, `/models` 또는 `/chat/completions`가 포함된 Base URL을 API 루트로 정규화해 모델 선택과 채팅 프록시가 막히지 않도록 보장.
11. **📦 범용 output 빌드 패키징 (v1.2.3):** `npm run build:output` 명령으로 현재 운영체제에 맞는 Go 실행 파일과 React `dist/` 정적 자산을 `output/` 폴더에 함께 배치하며, 로컬 비밀 파일(`.secret.key`, `keys.json`)은 패키징 대상에서 제외.
12. **🔁 웹 설정 즉시 반영 사이클 (v1.2.4):** 설정 모달에서 프로바이더를 저장하면 `/api/providers`를 즉시 재조회하고, 저장된 프로바이더를 활성 프로바이더와 현재 대화방 provider 상태에 반영한 뒤 모델 목록을 재조회하여 새로고침 없이 모델 선택 흐름으로 이어져야 합니다.
13. **🧩 Super Prompt 책임 분리 (v1.2.4):** Super Prompt의 생성/편집/삭제는 설정 모달에서만 수행하고, 대화방 장착/해제는 좌측 사이드바의 전용 선택 컨트롤에서만 수행하여 프로바이더 설정과 프롬프트 적용 흐름이 섞이지 않도록 합니다.
14. **📏 모델 메타데이터 기반 한도 적용 (v1.3.0):** 모델 선택 시 원격 모델 메타데이터의 최대 컨텍스트, 입력 토큰 한도, 출력 토큰 한도, 지원 파라미터 목록을 `ModelInfo`에 반영하고 채팅 발송 payload에 확정된 출력 한도를 적용합니다.
15. **✏️ 대화 제목 자동/수동 관리 (v1.3.0):** 첫 사용자 메시지를 보낸 대화방의 제목이 자동 생성 상태이면 첫 문장을 기본 제목으로 저장하고, 사용자가 대화 목록에서 제목을 직접 변경하면 이후 자동 제목 갱신을 중단합니다.
16. **🎛️ 우측 모델 파라미터 패널 (v1.3.0):** 채팅 화면 오른쪽에 `temperature`, `top_p`, `top_k`, `repetition_penalty` 설정 패널을 추가하고, 선택 모델의 `supportedParameters`에 명시된 항목만 활성화합니다.
17. **🧮 컨텍스트 사용량 표시 및 압축 (v1.3.0):** 입력창 바로 위에 예상 사용 컨텍스트와 선택 모델 최대 컨텍스트를 표시하며, 설정의 컨텍스트 압축 비율 기본값 `0.7`을 기준으로 오래된 대화를 LLM 요약 방식으로 압축합니다.
18. **🧭 모델 컨텍스트 메타데이터 보정 (v1.3.1):** OpenAI 호환 응답에 컨텍스트 정보가 없으면 임의 추정값을 적용하지 않고, LM Studio `/api/v0/models`의 `max_context_length`를 추가 조회하며, 사용자가 설정에서 입력/출력/전체 컨텍스트 한도를 수동 보정할 수 있게 합니다.
19. **🌊 스트리밍 응답 및 요청 취소 (v1.4.0 구현 완료):** 기본 채팅 전송을 스트리밍 중심으로 전환하고, 수신 중 assistant 메시지를 점진 갱신하며, 사용자가 중간에 요청을 취소할 수 있게 합니다.
20. **💾 대화 내보내기/가져오기 (v1.4.0 구현 완료):** 복원용 JSON 백업과 읽기용 Markdown 내보내기를 지원하고, JSON 가져오기는 기존 데이터를 삭제하지 않는 병합 방식으로 처리합니다.
21. **🔎 대화 검색 (v1.4.0 구현 완료):** 대화 제목, 메시지 본문, provider, model, Super Prompt 이름 기준으로 좌측 대화 목록을 즉시 필터링합니다.
22. **🧪 요청/응답 Inspector (v1.4.0 구현 완료):** 마지막 요청의 sanitized payload, endpoint, streaming 여부, 응답 상태, 오류 본문, 컨텍스트 압축 실행 여부를 API Key 없이 확인할 수 있게 합니다.
23. **🎚️ 채팅 프리셋 (v1.4.0 구현 완료):** provider, model, Super Prompt, 생성 파라미터, 압축 비율, 모델 한도 보정값을 하나의 프리셋으로 저장하고 현재 대화에 적용합니다.
24. **🧱 구조 정리 로드맵 (Phase 12 구현 완료):** v1.4.0 기능 확장 결과 비대해진 `src/App.tsx`, `src/index.css`, `main.go`, `proxy.go`를 기능 동작 변경 없이 유틸, API 클라이언트, 상태 훅, UI 컴포넌트, 스타일, 백엔드 프록시 파일로 단계 분리했습니다.

### 3.2 성공 기준 (Success Criteria)
1. **API 키 노출 완전 방지:** 프론트엔드의 네트워크 탭에서 OpenRouter 등 원격 서비스의 API 키가 절대 노출되지 않아야 함 (모든 통신은 Go backend proxy를 경유).
2. **정적 검증 완료:** 백엔드 암호화/복호화 및 프롬프트 CRUD 모듈은 `go test`로 검증 시 100% 성공 통과해야 하며, 테스트는 실제 사용자 `.secret.key`와 `keys.json` 조합을 훼손하지 않아야 함.
3. **Super Prompt 정합성:** 사용자가 지정한 프롬프트 장착 후 대화 시 백엔드 프록시가 송신하는 JSON Payload의 최상단 메시지 객체에 `{role: "system", content: "..."}`이 정교하게 이식되어야 함.
4. **설정-모델-대화 순환성:** 프로바이더 저장 후 Base URL 정규화, 키 복호화 가능성, 모델 목록 로드, 모델 선택 및 채팅 발송 단계가 한 사이클로 이어져야 하며, 실패 시 UI가 원인을 직접 표시해야 함.
5. **설정 UI 명도 대비:** 설정 모달의 일반 텍스트, 라벨, 입력 필드, 목록 미리보기는 최소 4.5:1 대비를 목표로 하며, 상태 표시를 사이드바가 아닌 설정 모달 안에서 확인할 수 있어야 함.
6. **모델 한도 정합성:** 모델 선택 후 헤더, 입력창 위 컨텍스트 바, 우측 파라미터 패널, `/api/chat` payload가 동일한 `ModelInfo` 메타데이터를 기준으로 동작해야 합니다.
7. **제목 저장 정합성:** 첫 메시지 자동 제목은 `litechat_sessions`에 저장되어 새로고침 뒤에도 유지되어야 하며, 수동으로 변경한 제목은 새 메시지 발송으로 덮어쓰지 않아야 합니다.
8. **컨텍스트 압축 정합성:** 예상 전송 컨텍스트가 `maxInputTokens * compressionRatio`를 초과하면 동일 provider/model로 요약 요청을 먼저 수행하고, 성공한 요약만 이후 채팅 payload에 포함해야 합니다.
9. **불명확한 메타데이터 표시:** 모델이 입력/출력/전체 컨텍스트를 명시하지 않으면 UI는 `알 수 없음`과 `수동 보정 필요`를 표시해야 하며, 임의 8K 같은 추정값을 확정값처럼 적용하지 않아야 합니다.
10. **스트리밍 정합성:** `/api/chat/stream`으로 받은 chunk는 같은 assistant 메시지에 순서대로 누적되어야 하며, 취소 시 부분 응답은 삭제하지 않고 `cancelled` 상태로 남겨야 합니다.
11. **백업 정합성:** JSON 내보내기는 세션과 사용자 설정을 복원 가능한 형태로 포함해야 하지만 API Key, `.secret.key`, `keys.json` 암호문은 절대 포함하지 않아야 합니다.
12. **검색 정합성:** 검색어 입력 시 대화 제목, 메시지 본문, provider, model, Super Prompt 이름이 같은 기준으로 필터링되어야 하며, 원본 세션 배열은 변경되지 않아야 합니다.
13. **Inspector 보안 정합성:** Inspector와 복사 버튼은 원격 요청 분석에 필요한 sanitized 데이터만 노출하고 Authorization, API Key, 암호문, 로컬 secret 값을 표시하지 않아야 합니다.
14. **프리셋 정합성:** 프리셋 적용은 현재 대화방의 provider/model/prompt/settings/compressionRatio/model override를 갱신하되, provider API Key와 Base URL은 포함하거나 변경하지 않아야 합니다.
15. **구조 정리 무회귀 기준:** Phase 12 리팩터링은 사용자 기능과 API 계약을 변경하지 않아야 하며, 각 단계 완료 후 `npm run lint`, `npm run build`, `go test ./...`, `npm run build:output`이 모두 통과해야 합니다.

---

## 4. 비목표 (Non-Goals)
1. **다중 사용자 계정 관리:** 단일 로컬 사용자 기기를 기준으로 하며, 로그인/회원가입 등 다중 사용자 세션 관리는 범위에서 제외합니다.
2. **원격 데이터베이스 동기화:** API 키와 Super Prompt는 서버나 클라우드가 아닌 로컬 파일 시스템(`keys.json`, `prompts.json`)에 저장하고, 대화 세션은 브라우저 `localStorage`의 `litechat_sessions` 키에 저장합니다. 원격 DB 동기화와 `chats.json` 파일 저장은 범위에서 제외합니다.
3. **프론트엔드 상태 라이브러리 도입:** Redux, Recoil 등은 사용하지 않으며, React 기본 State 및 Context API만으로 가볍고 정교하게 상태를 제어합니다.
4. **정밀 토크나이저 의존성 도입:** v1.4.0에서도 모델별 전용 tokenizer 패키지를 추가하지 않고, 일관된 로컬 추정식과 원격 응답의 `usage` 필드를 보조 정보로 사용합니다.
5. **불명확한 파라미터 강제 전송:** 모델 메타데이터가 `temperature`, `top_p`, `top_k`, `repetition_penalty` 지원을 명시하지 않으면 UI와 payload 모두에서 해당 항목을 비활성/제외합니다.
6. **스트리밍 자동 폴백:** v1.4.0에서는 스트리밍 실패 시 non-stream `/api/chat`으로 자동 재시도하지 않습니다. 실제 요청 방식 오인을 막기 위해 오류를 명확히 표시합니다.
7. **원격 동기화/계정/공유 링크:** 대화 백업은 로컬 파일 다운로드/가져오기까지만 지원하며, 계정 기반 동기화, 클라우드 저장, 공유 URL은 범위에서 제외합니다.
8. **전문 검색 엔진:** v1.4.0 검색은 `localStorage` 세션 배열에 대한 클라이언트 필터이며, 별도 인덱스 DB나 외부 검색 엔진은 도입하지 않습니다.

---

## 5. 기술 스택과 아키텍처 원칙
* **Backend:** Go 1.26.1 (표준 라이브러리 `net/http` 활용, 외부 라우터 프레임워크 미사용으로 경량성 극대화)
* **Frontend:** React 19, Vite 8, TypeScript 6, Vanilla CSS
* **CORS Policy:** 백엔드에서 포트 `8080`으로 구동되며, 프론트엔드는 개발 시 Vite Dev Server(`5173`)로 동작하며 백엔드가 CORS 허용 정책을 구성하고, 프로덕션 빌드 시에는 Go 서버가 직접 `dist/` 폴더를 정적 파일로 서빙함.

---

## 6. 저장 및 설정 정책
* **암호화 사양 (AES-256-GCM):**
  - **Key Size:** 32 Bytes (256 bits)
  - **IV Size:** 12 Bytes (보안 난수)
  - **Key File:** `.secret.key` (프로젝트 루트에 저장하며 절대 Git에 미포함)
  - **Test Isolation:** 단위 테스트는 테스트 전용 임시 키 파일을 주입해야 하며, 실제 `.secret.key`를 삭제하거나 재생성해서는 안 됩니다.
  - **Keep Existing Guard:** `__KEEP_EXISTING__` 저장은 기존 암호문을 먼저 복호화 검증한 뒤에만 허용하며, 실패 시 기존 키 유지를 거부하고 재등록을 요구합니다.
* **Base URL 저장 규칙:**
  - 저장값은 `https://.../v1` 또는 `http://localhost:.../v1` 같은 API 루트만 보존합니다.
  - 사용자가 `/models` 또는 `/chat/completions`까지 붙여 넣은 경우 백엔드는 저장 전에 해당 하위 엔드포인트를 제거하고 API 루트로 정규화합니다.
  - 지원하지 않는 프로바이더 이름, 스킴 없는 URL, query string, fragment는 저장을 거부합니다.
* **로컬 프로바이더 키 정책:**
  - `lm_studio`, `local_llm`은 사용자가 API Key를 비워도 저장 가능하며, 백엔드는 내부 더미 토큰을 암호화 저장하여 모델 조회와 채팅 프록시의 Authorization 흐름을 일관되게 유지합니다.
* **데이터 저장 형식 (`keys.json`):**
  - API 키 정보는 암호문과 IV 값을 합쳐 16진수 문자열로 구성하여 보관합니다.
  ```json
  {
    "openrouter": {
      "encrypted_api_key": "4f9a0c...",
      "iv": "9a12c4bf...",
      "base_url": "https://openrouter.ai/api/v1"
    },
    "lm_studio": {
      "encrypted_api_key": "bc340d...",
      "iv": "3aef4c1a...",
      "base_url": "http://localhost:1234/v1"
    }
  }
  ```
* **프롬프트 저장 형식 (`prompts.json`):**
  - 디버깅 편의성을 제공하기 위해 평문 JSON 파일로 프로젝트 루트에 안전 보관합니다.
  ```json
  [
    {
      "name": "번역 전문가",
      "content": "당신은 세계 최고의 번역가입니다. 한글 입력을 영문으로 격조 있게 번역하십시오."
    }
  ]
  ```
* **v1.4.0 브라우저 저장 키:**
  - `litechat_sessions`: 대화방, 메시지, 컨텍스트 요약, 메시지 상태를 저장합니다.
  - `litechat_model_overrides`: provider/model별 전체 컨텍스트, 입력 한도, 출력 한도 보정값을 저장합니다.
  - `litechat_presets`: 채팅 프리셋 목록을 저장합니다. API Key와 Base URL은 포함하지 않습니다.
  - Inspector snapshot은 저장 키를 만들지 않고 React 런타임 상태에만 보관합니다.
* **v1.4.0 내보내기 정책:**
  - JSON은 복원용 백업이며 `sessions`, `modelOverrides`, `presets`, `exportedAt`, `schemaVersion`을 포함합니다.
  - Markdown은 사람이 읽기 위한 로그이며 가져오기 대상이 아닙니다.
  - API Key 원문, `.secret.key`, `keys.json`, Authorization 헤더, 암호문은 모든 내보내기에서 제외합니다.

---

## 7. 경계 타입과 계약 (Typed Contracts)

### 7.1 Go Backend 구조체 정의

```go
// Config 구조체는 각 프로바이더의 연동 정보 및 Base URL을 관리합니다.
type ProviderConfig struct {
	EncryptedAPIKey string `json:"encrypted_api_key"`
	IV              string `json:"iv"`
	BaseURL         string `json:"base_url"`
}

type UIProviderResponse struct {
	Name          string `json:"name"`
	DisplayName   string `json:"displayName"`
	HasKey        bool   `json:"hasKey"`
	BaseURL       string `json:"baseUrl"`
	ConfigStatus  string `json:"configStatus"`  // "missing" | "ready" | "invalid_key"
	StatusMessage string `json:"statusMessage"` // UI에 표시할 설정 상태 안내
}

type AppConfig map[string]ProviderConfig

// API Key 등록 요청 payload
type SaveKeyRequest struct {
	Provider string `json:"provider"` // "openrouter", "opencode_zen", "opencode_go", "lm_studio", "local_llm"
	APIKey   string `json:"api_key"`
	BaseURL  string `json:"base_url"` 
}

// Super Prompt 데이터 구조체
type SuperPrompt struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// Proxy 요청 payload (중계 프록싱 및 System Prompt 주입용)
type ProxyChatRequest struct {
	Provider     string      `json:"provider"`
	Model        string      `json:"model"`
	Messages     []interface{} `json:"messages"` // OpenAI format
	SystemPrompt string      `json:"system_prompt,omitempty"` // 주입할 Super Prompt 내용
	Temperature  *float64    `json:"temperature,omitempty"`
	TopP         *float64    `json:"top_p,omitempty"`
	TopK         *int        `json:"top_k,omitempty"`
	RepetitionPenalty *float64 `json:"repetition_penalty,omitempty"`
	MaxCompletionTokens *int  `json:"max_completion_tokens,omitempty"`
}

type SummaryRequest struct {
	Provider    string        `json:"provider"`
	Model       string        `json:"model"`
	Messages    []interface{} `json:"messages"`
	TargetRatio float64       `json:"target_ratio"`
}

type SummaryResponse struct {
	Summary              string   `json:"summary"`
	SummarizedMessageIDs []string `json:"summarized_message_ids"`
}

type StreamProxyEvent struct {
	Type    string `json:"type"`              // "delta" | "done" | "error"
	Content string `json:"content,omitempty"` // delta 텍스트 또는 오류 설명
}
```

### 7.2 Frontend TypeScript 타입 인터페이스

```typescript
export type ProviderType = 'openrouter' | 'opencode_zen' | 'opencode_go' | 'lm_studio' | 'local_llm';

export interface ProviderState {
  name: ProviderType;
  displayName: string;
  hasKey: boolean;
  baseUrl: string;
  configStatus: 'missing' | 'ready' | 'invalid_key';
  statusMessage: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextLength: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  supportedParameters: string[];
  supportsVision: boolean;
  supportsTemperature: boolean;
  supportsTopP: boolean;
  supportsTopK: boolean;
  supportsRepetitionPenalty: boolean;
  metadataSource: 'openrouter' | 'lm_studio_api_v0' | 'openai_compatible' | 'manual' | 'unknown';
  isContextEstimated: boolean;
}

export interface GenerationSettings {
  temperature: number;        // 기본값 1.0, 허용 범위 0.0~2.0
  topP: number;               // 기본값 0.95, 허용 범위 0.0~1.0
  topK: number;               // 기본값 40, 허용 범위 0 이상 정수
  repetitionPenalty: number;  // 기본값 1.1, 허용 범위 0.0~2.0
}

export interface ContextCompressionSettings {
  compressionRatio: number;   // 기본값 0.7, 허용 범위 0.1~1.0
}

export interface SuperPrompt {
  name: string;
  content: string;
}

export interface AttachmentInfo {
  name: string;
  type: string;
  size: number;
  url: string;
}

export type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface OpenAIMessagePayload {
  role: ChatMessage['role'];
  content: string | OpenAIContentPart[];
}

export interface ChatCompletionResponse {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachments?: AttachmentInfo[];
  status?: 'complete' | 'streaming' | 'cancelled' | 'error';
  errorMessage?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  isTitleAutoGenerated?: boolean; // true면 첫 사용자 메시지로 제목 자동 갱신 가능
  messages: ChatMessage[];
  provider: ProviderType;
  model: string;
  activeSystemPromptName?: string; // 활성화된 Super Prompt 이름
  generationSettings?: GenerationSettings;
  compressionRatio?: number;
  contextSummary?: string;
  summarizedMessageIds?: string[];
}

export interface ModelMetadataOverride {
  contextLength: number;
  maxInputTokens: number;
  maxOutputTokens: number;
}

export interface ChatPreset {
  id: string;
  name: string;
  provider: ProviderType;
  model: string;
  activeSystemPromptName?: string;
  generationSettings: GenerationSettings;
  compressionRatio: number;
  modelOverride?: ModelMetadataOverride;
  createdAt: string;
  updatedAt: string;
}

export interface ChatExportBundle {
  schemaVersion: 'liteflashchat.v1.4.0';
  exportedAt: string;
  sessions: ChatSession[];
  modelOverrides: Record<string, ModelMetadataOverride>;
  presets: ChatPreset[];
}

export interface InspectorSnapshot {
  id: string;
  timestamp: string;
  provider: ProviderType;
  model: string;
  endpoint: '/api/chat' | '/api/chat/stream' | '/api/chat/summary';
  streaming: boolean;
  sanitizedRequest: Record<string, unknown>;
  responseStatus?: number;
  responsePreview?: string;
  errorMessage?: string;
  usedContextSummary: boolean;
}
```

### 7.3 v1.3.1 모델 메타데이터 및 파라미터 계약

| 필드 | 생성 위치 | 의미 | 기본/폴백 |
| --- | --- | --- | --- |
| `contextLength` | `/api/models` 또는 수동 보정 | 모델 전체 컨텍스트 윈도우 | OpenRouter `context_length`, LM Studio `/api/v0/models.max_context_length`, OpenAI 호환 명시 필드만 사용. 명시값 없으면 `0` |
| `maxInputTokens` | `/api/models` 또는 수동 보정 | 프롬프트/히스토리 입력에 사용할 수 있는 최대 토큰 | `contextLength - maxOutputTokens`, 출력 한도 없으면 `contextLength`, 명시값 없으면 `0` |
| `maxOutputTokens` | `/api/models` | 응답 생성 상한 | OpenRouter는 `top_provider.max_completion_tokens`; 명시값 없으면 `0`으로 저장하고 payload에는 미전송 |
| `supportedParameters` | `/api/models` | 모델이 명시적으로 지원하는 요청 파라미터 배열 | 명시값 없으면 빈 배열 |
| `metadataSource` | `/api/models` 또는 프론트 수동 보정 | 메타데이터 출처 | `openrouter`, `lm_studio_api_v0`, `openai_compatible`, `manual`, `unknown` |
| `isContextEstimated` | `/api/models` 또는 프론트 수동 보정 | 컨텍스트 값 확정 여부 | 명시/수동 보정이면 `false`, 알 수 없음이면 `true` |
| `supportsTemperature` | 프론트 파생 | `temperature` UI/Payload 활성 여부 | `supportedParameters.includes("temperature")` |
| `supportsTopP` | 프론트 파생 | `top_p` UI/Payload 활성 여부 | `supportedParameters.includes("top_p")` |
| `supportsTopK` | 프론트 파생 | `top_k` UI/Payload 활성 여부 | `supportedParameters.includes("top_k")` |
| `supportsRepetitionPenalty` | 프론트 파생 | `repetition_penalty` UI/Payload 활성 여부 | `supportedParameters.includes("repetition_penalty")` |

**동결 결정:** 모델 파라미터 지원 여부는 확실할 때만 활성화합니다. 불명확한 로컬/OpenAI 호환 모델은 항목을 비활성화하고, 사용자가 임의로 payload에 넣지 못하게 합니다.

### 7.4 v1.3.1 컨텍스트 계산 및 압축 공식

| 항목 | 공식/값 |
| --- | --- |
| 기본 압축 비율 | `compressionRatio = 0.7` |
| 허용 범위 | `0.1 <= compressionRatio <= 1.0` |
| 압축 트리거 | `maxInputTokens > 0 && estimatedPromptTokens > maxInputTokens * compressionRatio` |
| 예상 토큰 산식 | `Math.ceil(text.length / 4)`를 기본 추정식으로 사용하고, 이미지 첨부는 파일명/메타 텍스트만 추정 대상에 포함 |
| 요약 방식 | 동일 `provider`, 동일 `model`에 별도 요약 요청을 보내 오래된 메시지 묶음을 한국어 요약으로 압축 |
| 요약 저장 | `ChatSession.contextSummary`, `ChatSession.summarizedMessageIds`에 저장 |
| 실패 정책 | 요약 실패 시 실제 사용자 메시지 전송을 중단하고 오류를 UI에 표시 |

### 7.5 v1.3.1 외부 메타데이터 기준
* **OpenRouter:** 모델 목록 응답의 `context_length`, `top_provider.max_completion_tokens`, `supported_parameters`를 신뢰 가능한 1차 메타데이터로 사용합니다.
* **OpenRouter 파라미터:** `temperature`, `top_p`, `top_k`, `repetition_penalty`, `max_completion_tokens`는 공식 파라미터 문서의 이름을 그대로 사용합니다.
* **LM Studio:** OpenAI 호환 `/v1/models`만으로 컨텍스트를 알 수 없으면 `/api/v0/models`를 추가 조회하고 `id` 또는 파일 경로 표시명과 일치하는 항목의 `max_context_length`를 반영합니다.
* **OpenAI 호환/Local LLM:** `context_length`, `max_context_length`처럼 응답에 명시된 숫자 필드만 사용합니다. 명시값이 없으면 `contextLength=0`, `maxInputTokens=0`, `metadataSource=unknown`, `isContextEstimated=true`로 반환합니다.
* **수동 보정:** 설정 모달 일반 설정 탭의 모델 메타데이터 보정값은 `localStorage`에 provider/model 키로 저장하고, 적용 시 `metadataSource=manual`, `isContextEstimated=false`로 표시합니다.
* **보수적 원칙:** 위 필드가 없거나 provider 응답 형태가 불명확하면 컨텍스트와 파라미터 지원을 추정하지 않습니다.

### 7.6 v1.4.0 플랫폼 기능 계약

| 기능 | 동결 결정 | 데이터/상태 |
| --- | --- | --- |
| 스트리밍 채팅 | 기본 전송 경로는 `/api/chat/stream`이며 자동 non-stream 폴백은 금지 | `ChatMessage.status`, `AbortController`, SSE delta 누적 |
| 요청 취소 | 취소 시 부분 응답을 보존하고 assistant 메시지는 `cancelled` 상태로 종료 | `status="cancelled"`, `errorMessage` 없음 |
| JSON 내보내기 | 복원용 백업만 담당하며 API Key와 Base URL은 제외 | `ChatExportBundle.schemaVersion="liteflashchat.v1.4.0"` |
| Markdown 내보내기 | 사람이 읽는 로그 전용이며 가져오기 대상이 아님 | 현재 대화 또는 전체 대화 텍스트 |
| JSON 가져오기 | 기존 데이터 삭제 없이 세션 ID 충돌 시 새 ID를 부여해 병합 | `session_<timestamp>_<index>` 형식 새 ID |
| 대화 검색 | 제목, 본문, provider, model, Super Prompt 이름을 소문자 비교로 필터 | 원본 `sessions` 배열 불변 |
| Inspector | 마지막 요청/응답 snapshot만 런타임 상태에 보존 | Authorization/API Key/암호문 마스킹 |
| 프리셋 | provider/model/prompt/settings/compression/override 묶음을 저장 | `litechat_presets`, API Key/Base URL 제외 |

### 7.7 프론트엔드 상태 플래그 및 CTA 계약

| 상태/CTA | 타입 | 생성 조건 | 소비 위치 | 후속 상태 |
| --- | --- | --- | --- | --- |
| `isProviderEditMode` | `boolean` | 설정 모달에서 선택한 `ProviderState.hasKey === true` | 프로바이더 저장 버튼 활성화 조건, 수정 안내 배너 | `POST /api/keys` 성공 후 최신 provider 상태 기준으로 재설정 |
| `originalBaseUrl` | `string` | 프로바이더 선택 또는 설정 모달 열기 시 현재 Base URL 저장 | 수정 저장 버튼 비활성화 조건 | 저장 성공 후 최신 Base URL로 갱신 |
| `promptSelection` | `string` | 현재 대화방의 `activeSystemPromptName` 또는 사이드바 선택 박스 변경 | 사이드바 `[적용]` 버튼 | 적용 성공 시 현재 세션 `activeSystemPromptName` 갱신 |
| `litechat_sessions` | `localStorage string` | 대화 세션 배열이 1개 이상 존재할 때 JSON 문자열로 저장 | 앱 초기 렌더 전 `readStoredSessions()` | 세션 배열이 비면 제거 |
| `[프로바이더 설정 저장]` | 버튼 | 신규 원격 provider는 API Key 필수, 로컬 provider는 Base URL만으로 가능, 수정 모드는 Key 변경 또는 Base URL 변경 시 활성화 | 설정 모달 프로바이더 탭 | `/api/providers` 재조회, active provider 및 모델 목록 즉시 갱신 |
| `[Super Prompt 편집]` | 버튼 | 저장된 프롬프트 행이 존재할 때 활성화 | 설정 모달 Super Prompt 관리 탭 | 이름/내용 입력 폼에 해당 프롬프트 로드, 대화방 장착 상태는 변경하지 않음 |
| `[Super Prompt 적용]` | 버튼 | 현재 대화방이 있고 선택된 프롬프트가 현재 장착값과 다를 때 활성화 | 좌측 사이드바 Super Prompt 패널 | 현재 세션 `activeSystemPromptName` 갱신 |
| `[Super Prompt 해제]` | 버튼 | 현재 대화방에 `activeSystemPromptName`이 있을 때 활성화 | 좌측 사이드바 Super Prompt 패널 | 현재 세션 `activeSystemPromptName` 제거 |
| `[대화 제목 편집]` | 버튼/더블클릭 | 대화 목록 항목이 존재할 때 활성화 | 좌측 대화 목록 | `title` 갱신, `isTitleAutoGenerated=false`, `litechat_sessions` 저장 |
| `[모델 파라미터 슬라이더]` | 입력 컨트롤 | 선택 모델의 지원 플래그가 true일 때 활성화 | 우측 모델 파라미터 패널 | 현재 세션 `generationSettings` 갱신 |
| `[컨텍스트 압축 비율]` | 숫자/슬라이더 | 설정 모달 일반 설정 탭에서 상시 활성화 | 설정 모달 | `compressionRatio`를 `localStorage`와 현재 세션 기본값에 저장 |
| `[모델 메타데이터 보정]` | 숫자 입력/버튼 | 선택 모델이 있을 때 활성화 | 설정 모달 일반 설정 탭 | provider/model별 입력/출력/전체 컨텍스트 보정값 저장 또는 제거 |
| `[전송]` | 버튼 | 입력 텍스트 또는 첨부가 있고 스트리밍 중이 아닐 때 활성화 | 입력창 | `/api/chat/stream` 호출, assistant 메시지 `streaming` 생성 |
| `[중지]` | 버튼 | assistant 메시지가 `streaming` 상태일 때 활성화 | 입력창 | `AbortController.abort()`, 메시지 `cancelled` 처리 |
| `[대화 검색]` | 입력 | 세션이 1개 이상일 때 상시 활성화 | 좌측 사이드바 | 필터된 대화 목록과 결과 개수 표시 |
| `[JSON 내보내기]` | 버튼 | 세션 또는 프리셋 데이터가 있을 때 활성화 | 데이터 관리 영역 | `ChatExportBundle` 다운로드 |
| `[JSON 가져오기]` | 파일 선택 | `.json` 파일 선택 시 활성화 | 데이터 관리 영역 | 검증 통과 시 세션/프리셋/보정값 병합 |
| `[Markdown 내보내기]` | 버튼 | 현재 대화 또는 전체 대화가 있을 때 활성화 | 데이터 관리 영역 | 읽기용 `.md` 다운로드 |
| `[Inspector 복사]` | 버튼 | `InspectorSnapshot`이 있을 때 활성화 | 우측 Inspector 패널 | sanitized request/response 텍스트 클립보드 복사 |
| `[프리셋 저장]` | 버튼 | provider와 model이 선택되어 있을 때 활성화 | 설정 모달 프리셋 탭 | 현재 대화 설정을 `litechat_presets`에 저장 |
| `[프리셋 적용]` | 버튼 | 프리셋 provider가 설정되어 있고 모델 조회 가능할 때 활성화 | 설정 모달 프리셋 탭 | 현재 세션 provider/model/prompt/settings/compression/override 갱신 |

---

## 8. API 명세 및 메서드 계약

### 8.1 `GET /api/providers`
* **설명:** 현재 등록된 5대 프로바이더의 연동 여부 및 Base URL 조회.
* **응답 포맷:** `configStatus`는 `missing`, `ready`, `invalid_key` 중 하나입니다. `invalid_key`는 `.secret.key`와 `keys.json` 불일치 등으로 기존 암호문 복호화가 불가능하여 API Key 재등록이 필요한 상태입니다.
  ```json
  [
    { "name": "openrouter", "displayName": "OpenRouter", "hasKey": true, "baseUrl": "https://openrouter.ai/api/v1", "configStatus": "ready", "statusMessage": "프로바이더 설정이 준비되었습니다." },
    { "name": "opencode_zen", "displayName": "OpenCode Zen", "hasKey": false, "baseUrl": "https://opencode.ai/zen/v1", "configStatus": "missing", "statusMessage": "API Key가 아직 등록되지 않았습니다." },
    { "name": "opencode_go", "displayName": "OpenCode Go", "hasKey": false, "baseUrl": "https://opencode.ai/zen/go/v1", "configStatus": "invalid_key", "statusMessage": "저장된 키를 복호화할 수 없어 API Key 재등록이 필요합니다." },
    { "name": "lm_studio", "displayName": "LM Studio", "hasKey": true, "baseUrl": "http://localhost:1234/v1", "configStatus": "ready", "statusMessage": "로컬 프로바이더가 Base URL 중심으로 준비되었습니다." }
  ]
  ```

### 8.2 `POST /api/keys`
* **설명:** 프로바이더별 API Key 및 Base URL 암호화 저장. 수정 모드 시 `api_key`에 `__KEEP_EXISTING__` 플래그를 담아 전송하면, 기존에 안전하게 보존 중인 암호화 키를 유지하며 Base URL만 원자적으로 갱신합니다. 단, 기존 암호문 복호화가 실패하면 저장을 거부하고 재등록을 요구합니다.
* **요청 포맷:**
  ```json
  {
    "provider": "opencode_zen",
    "api_key": "sk-... 또는 __KEEP_EXISTING__",
    "base_url": "https://opencode.ai/zen/v1"
  }
  ```
* **정규화 규칙:** `base_url`에 `/models` 또는 `/chat/completions`가 포함되면 저장 전 API 루트까지만 보존합니다.

### 8.3 `GET /api/prompts`
* **설명:** 저장된 모든 Super Prompt 목록을 조회합니다.
* **응답 포맷:**
  ```json
  [
    { "name": "번역가", "content": "..." }
  ]
  ```

### 8.4 `POST /api/prompts`
* **설명:** 새로운 Super Prompt를 추가하거나 기존 이름을 매핑하여 덮어씁니다.
* **요청 포맷:**
  ```json
  { "name": "번역가", "content": "새로운 지침 내용" }
  ```

### 8.5 `DELETE /api/prompts?name={name}`
* **설명:** 지정된 이름의 Super Prompt를 영구 삭제합니다.

### 8.6 `POST /api/chat`
* **설명:** 프록시를 통해 대화를 시도하고 AI의 답변을 수신합니다. 만약 `system_prompt` 속성이 빈 문자열이 아니면, 백엔드가 중계 발송 시 최상단 메시지 배열에 `{role: "system", content: system_prompt}`를 강제 주입해 원격지로 중계합니다.
* **v1.3.1 요청 확장:** 프론트엔드는 선택 모델의 지원 플래그가 true인 샘플링 파라미터만 payload에 포함합니다. 기본값은 `temperature=1`, `top_p=0.95`, `top_k=40`, `repetition_penalty=1.1`입니다. `maxOutputTokens > 0`이면 OpenRouter/OpenAI 호환 경계에 맞춰 `max_completion_tokens` 또는 `max_tokens`를 전송합니다.
  ```json
  {
    "provider": "openrouter",
    "model": "anthropic/claude-3.5-sonnet",
    "messages": [{ "role": "user", "content": "안녕하세요" }],
    "system_prompt": "선택된 Super Prompt",
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 40,
    "repetition_penalty": 1.1,
    "max_completion_tokens": 4096
  }
  ```
* **v1.3.1 컨텍스트 압축 선행 조건:** 예상 전송 컨텍스트가 `maxInputTokens * compressionRatio`를 넘으면 프론트엔드는 일반 채팅 요청 전에 요약 요청을 먼저 수행하고, 성공한 요약만 `messages` 앞쪽에 압축 문맥으로 포함합니다. 입력 한도가 `0`이면 확정 한도를 알 수 없으므로 자동 압축을 보류하고 수동 보정 UI를 안내합니다.

### 8.7 `POST /api/chat/summary` (v1.3.0)
* **설명:** 오래된 대화 메시지 묶음을 동일 provider/model로 요약하여 컨텍스트 압축 결과를 생성합니다.
* **요청 포맷:**
  ```json
  {
    "provider": "openrouter",
    "model": "anthropic/claude-3.5-sonnet",
    "messages": [
      { "role": "user", "content": "첫 질문" },
      { "role": "assistant", "content": "첫 답변" }
    ],
    "target_ratio": 0.7
  }
  ```
* **응답 포맷:**
  ```json
  {
    "summary": "이전 대화 요약...",
    "summarized_message_ids": ["msg_1", "msg_2"]
  }
  ```
* **실패 정책:** 원격 요약 요청이 실패하거나 빈 요약을 반환하면 HTTP 502 또는 500을 반환하고, 프론트엔드는 실제 채팅 발송을 중단합니다.

### 8.8 `POST /api/chat/stream` (v1.4.0 확정)
* **설명:** OpenAI 호환 streaming 응답을 브라우저로 중계합니다. 일반 채팅과 같은 `ProxyChatRequest` 입력을 사용하되 백엔드는 원격 payload에 `stream: true`를 추가합니다.
* **요청 포맷:** `/api/chat`과 동일합니다.
* **응답 형식:** `Content-Type: text/event-stream`이며 각 이벤트는 아래 JSON 문자열을 `data:` 라인으로 전달합니다.
  ```json
  { "type": "delta", "content": "부분 응답 텍스트" }
  ```
  ```json
  { "type": "done" }
  ```
  ```json
  { "type": "error", "content": "원격 스트림 오류 설명" }
  ```
* **중계 규칙:** 원격 SSE의 `choices[].delta.content`를 추출해 `delta` 이벤트로 전달하고, `[DONE]` 또는 정상 EOF를 받으면 `done` 이벤트로 종료합니다.
* **취소 규칙:** 브라우저가 연결을 닫으면 백엔드는 원격 요청 context를 취소하고 추가 쓰기를 중단합니다.
* **보안 규칙:** Authorization 헤더, API Key, 암호문, 내부 `system_prompt` 원문 외의 secret 값은 stream 이벤트, Inspector, 로그에 포함하지 않습니다.
* **오류 정책:** 스트리밍 요청 실패, 원격 4xx/5xx, malformed chunk는 `error` 이벤트 또는 HTTP 오류로 표시하며, v1.4.0에서는 `/api/chat`으로 자동 폴백하지 않습니다.

---

## 9. 보안/구현 경계
1. **로컬 루프백 격리 바인딩 (SEC-F001 방어):** 백엔드 HTTP 서버는 오직 `127.0.0.1` 루프백 인터페이스에만 포트 바인딩되어 동작하며, 외부 네트워크(LAN/WAN) 상의 제3자 기기에서의 무단 연결을 완벽히 소거합니다.
2. **CORS 화이트리스트 엄격 검증 (CSRF 방어):** `Access-Control-Allow-Origin: *`과 같은 와일드카드 정책을 전면 파기하고, 사전에 신뢰 가능한 로컬 기기 기동 호스트(`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:8080`, `http://127.0.0.1:8080`)의 헤더 검증을 거친 Origin에 대해서만 명시적으로 응답하도록 제어합니다.
3. **API Key 완전 은닉:** 모든 LLM API의 실제 연동은 Go 백엔드 서버에서만 발생하며, 브라우저 메모리나 로컬 스토리지에 API Key 원본이 평문으로 적재되는 것을 철저히 통제합니다.
4. **정적 파일 제공 무해성:** Go 백엔드 서버가 로컬 포트 `8080`에서 서빙하는 정적 자산은 빌드 시 완전히 정제된 HTML/CSS/JS 파일만 로드하며, 디렉터리 탐색(Directory Traversal) 취약점을 완벽히 방어합니다.

---

## 10. 런타임/빌드 파이프라인 및 디렉터리 기준
* **개발 런타임:** React Vite 개발 서버는 `npm run dev`로 `5173` 포트에서 실행하고, Go 백엔드는 `go run -buildvcs=false .`로 `127.0.0.1:8080`에 바인딩합니다.
* **프로덕션 런타임:** `npm run build`가 `dist/`를 생성하고, Go 서버는 `dist/index.html`을 SPA 폴백으로 제공하며 `/api/*`는 API 핸들러로 라우팅합니다.
* **output 패키징:** `npm run build:output`은 현재 운영체제용 실행 파일 `output/liteflashchat` 또는 `output/liteflashchat.exe`와 `output/dist/index.html`을 생성합니다.
* **비밀 파일 제외:** `.secret.key`, `keys.json`, `prompts.json`은 런타임 로컬 파일이며 `output/` 패키징 대상이 아닙니다.

| 경로 | 책임 |
| --- | --- |
| `main.go` | HTTP 라우팅, CORS, 정적 자산 서빙, API 핸들러 |
| `providers.go` | provider 정의, Base URL 정규화, 로컬 provider 키 정책 |
| `proxy.go` | 모델 조회, 채팅 프록시, system prompt 주입 |
| `config.go` | `keys.json`, `prompts.json` 파일 I/O |
| `src/App.tsx` | React 상태, 설정 모달, 사이드바 Super Prompt 장착, 모델 탐색기 |
| `src/index.css` | 전역 디자인 토큰 및 UI 스타일 |
| `scripts/build-output.mjs` | OS 공통 `output/` 패키징 |

---

## 11. 구현 순서 및 로드맵 기준
1. **Provider 계약 고정:** `providers.go`, `ProviderState`, `/api/providers` 응답이 같은 provider ID와 상태값을 공유해야 합니다.
2. **키 저장 안정화:** `/api/keys`는 Base URL 정규화, `__KEEP_EXISTING__`, 로컬 provider 무키 저장을 모두 통과해야 합니다.
3. **모델 조회 연결:** 저장 성공 후 프론트엔드는 `/api/providers`와 `/api/models`를 순차 호출해 모델 선택 UI를 갱신해야 합니다.
4. **Super Prompt CRUD 분리:** 설정 모달은 CRUD만 수행하고, 사이드바는 선택/적용/해제만 수행해야 합니다.
5. **채팅 프록시 검증:** 적용된 Super Prompt가 있을 때만 `/api/chat` payload의 `system_prompt`에 내용이 들어가고, 백엔드가 `messages[0]`에 system role을 주입해야 합니다.
6. **모델 메타데이터 확장:** `/api/models`가 `contextLength`, `maxInputTokens`, `maxOutputTokens`, `supportedParameters`, `metadataSource`, `isContextEstimated`를 반환하고, 프론트엔드는 이를 모델 선택/우측 패널/컨텍스트 바에 같은 기준으로 반영해야 합니다.
7. **세션 제목 관리:** 첫 사용자 메시지 자동 제목과 수동 제목 변경을 `ChatSession` 계약으로 저장해야 합니다.
8. **컨텍스트 압축:** `compressionRatio=0.7` 기본값과 LLM 요약 흐름을 구현하고, 실패 시 조용히 메시지를 누락하지 않아야 합니다.
9. **v1.4.0 플랫폼 확장:** 스트리밍, 요청 취소, 내보내기/가져오기, 검색, Inspector, 프리셋을 `ChatSession`, `ChatExportBundle`, `InspectorSnapshot`, `ChatPreset` 계약 기준으로 구현해야 합니다.
10. **패키징 검증:** 모든 기능 변경 후 `npm run build:output`으로 `output/` 산출물을 확인해야 합니다.

### 11.1 v1.4.0 구현 완료 로드맵
1. **문서 선반영:** 본 `spec.md`, `designs.md`, `audit_roadmap.md`, `implementation_summary.md`, `DESIGN_DECISIONS.md`, `BUILD_GUIDE.md`, `LESSONS_LEARNED.md`, `CHANGELOG.md`, `README.md`에 v1.4.0 계약을 동결했습니다.
2. **스트리밍 백엔드:** `/api/chat/stream`을 추가하고 기존 payload 정리, system prompt 주입, provider API Key 은닉 규칙을 그대로 재사용했습니다.
3. **스트리밍 프론트:** 기본 전송을 stream 경로로 전환하고 assistant placeholder, chunk 누적, `[중지]`, `cancelled/error/complete` 상태를 구현했습니다.
4. **데이터 관리:** JSON export/import와 Markdown export를 구현하고, JSON 가져오기는 삭제 없는 병합 정책을 적용했습니다.
5. **대화 검색:** 좌측 사이드바에 검색 입력, 결과 개수, 빈 상태를 추가하고 제목/본문/provider/model/Super Prompt 기준 필터를 구현했습니다.
6. **Inspector:** 마지막 요청/응답 snapshot을 런타임 상태에 저장하고 우측 패널에서 sanitized payload와 응답을 복사할 수 있게 했습니다.
7. **프리셋:** 설정 모달 프리셋 탭에서 현재 설정 저장, 적용, 이름 변경, 삭제를 구현했습니다.
8. **검증 및 패키징:** Go 테스트, 프론트 lint/build, output 패키징, 런타임 스모크 검증을 수행합니다.

### 11.2 Phase 12 구조 정리 로드맵 (완료)
Phase 12는 기능 추가가 아니라 **무회귀 구조 정리**입니다. 기준 측정값은 `src/App.tsx` 2439줄, `src/index.css` 1076줄, `main.go` 592줄, `proxy.go` 723줄이었습니다. 2026-05-28 정리 완료 후 `src/App.tsx`는 862줄, `src/index.css`는 82줄, `main.go`는 62줄, `proxy.go`는 분리 안내 3줄로 축소되었습니다.

| 단위 | 범위 | 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| Unit 12-1 기준선 고정 | 현재 기능/문서/테스트 상태 측정 | 리팩터링 전 줄 수, 기능 목록, 검증 명령 결과 기록 | 문서에 현재 God Component/God file 위험과 목표치가 명시됨 |
| Unit 12-2 순수 유틸 분리 | 토큰 추정, export/import, localStorage, 모델 override, timestamp/download/sanitize 함수 | `src/utils/modelMetadata.ts`, `src/utils/storage.ts`, `src/utils/export.ts`, `src/utils/inspector.ts`, `src/utils/providerDisplay.ts` | 완료: UI JSX 변경 없이 lint/build 통과 |
| Unit 12-3 API 클라이언트 분리 | `/api/providers`, `/api/models`, `/api/prompts`, `/api/chat/summary`, `/api/chat/stream` 호출 | `src/api/client.ts`, `src/services/chatFlow.ts` | 완료: fetch 호출이 컴포넌트 JSX와 분리되고 API 에러 문구가 유지됨 |
| Unit 12-4 상태 훅/서비스 분리 | provider/model/prompt/session/preset/inspector 상태와 핸들러 | `src/hooks/*`, `src/services/chatFlow.ts`, `src/services/dataPortability.ts` | 완료: 저장 상태와 Inspector 복사는 hook으로, 스트리밍/데이터 이식은 service로 분리 |
| Unit 12-5 UI 컴포넌트 분리 | Sidebar, Header, MessageList, InputPanel, SettingsModal, ModelSearchModal, RightPanel | `src/components/*` | 완료: 각 컴포넌트는 props 기반으로 렌더링하고 직접 localStorage/fetch를 호출하지 않음 |
| Unit 12-6 스타일 분리 | 사이드바, 채팅, 모달, 우측 패널, Inspector/프리셋 스타일 | `src/styles/sidebar.css`, `chat.css`, `modal.css`, `right-panel.css`, `settings.css`, `code.css` | 완료: CSS 토큰은 중앙 유지, 시각 변화 없이 build 통과 |
| Unit 12-7 백엔드 프록시 분리 | 모델 조회, 채팅 프록시, stream, summary, system prompt 주입 | `models.go`, `chat_proxy.go`, `stream_proxy.go`, `summary.go`, `system_prompt.go`, `provider_handlers.go`, `prompts_handler.go`, `server.go` | 완료: 공개 API 라우트와 테스트 결과가 변하지 않음 |
| Unit 12-8 문서/검증 마감 | 변경된 파일 책임과 로드맵 완료 상태 반영 | `spec.md`, `implementation_summary.md`, `audit_roadmap.md`, `DESIGN_DECISIONS.md`, `CHANGELOG.md` 갱신 | 완료: 모든 품질 게이트 및 output 패키징 통과 |

**목표치:** Phase 12 완료 시 `src/App.tsx`는 900줄 이하, `src/index.css`는 단일 전역 토큰/공통 스타일 중심으로 350줄 이하를 목표로 합니다. 목표치는 품질 지표이며, 기능 회귀 방지가 우선입니다.

**금지 사항:** Phase 12에서는 Redux/Recoil 등 새 전역 상태 라이브러리를 도입하지 않습니다. 사용자 기능, API endpoint, localStorage key, export schemaVersion, provider ID, prompt 저장 형식은 변경하지 않습니다.

---

## 12. 명령어와 검증 기준
```bash
npm run lint
npm run build
go test ./...
npm run build:output
```
* **성공 기준:** 네 명령 모두 종료 코드 `0`이어야 합니다.
* **산출물 기준:** `output/liteflashchat` 또는 `output/liteflashchat.exe`, `output/dist/index.html`이 존재해야 합니다.
* **수동 UI 기준:** 프로바이더 저장 후 새로고침 없이 모델 목록이 갱신되고, Super Prompt 편집은 설정 모달에서만, 장착/해제는 사이드바에서만 가능해야 합니다. 모델 한도를 알 수 없으면 `알 수 없음`과 수동 보정 UI가 표시되어야 합니다.
* **v1.4.0 수동 UI 기준:** 스트리밍 응답이 점진 표시되고, 중지 시 부분 응답이 보존되며, JSON 백업 병합, Markdown 내보내기, 검색 필터, Inspector 마스킹, 프리셋 적용이 모두 동작해야 합니다.
* **Phase 12 구조 정리 기준:** 각 리팩터링 단위 완료 후 사용자 기능이 동일하게 동작해야 하며, public API, 저장 키, 내보내기 schemaVersion, 설정/모델/채팅 순환 흐름이 변하지 않아야 합니다.

---

## 13. 잔여 리스크
* 실제 OpenRouter/OpenCode 계열 모델 조회와 채팅은 유효한 외부 API Key가 있어야 완전한 수동 E2E를 수행할 수 있습니다.
* LM Studio와 Local LLM은 사용자의 로컬 OpenAI 호환 서버가 실행 중이어야 모델 조회 및 채팅 검증이 가능합니다.
* OpenAI 호환 `/models` 응답이 `supported_parameters`나 출력 토큰 한도를 제공하지 않는 경우 v1.3.1 UI는 해당 파라미터를 비활성화합니다. 컨텍스트 필드도 없으면 임의 한도를 적용하지 않고 수동 보정 전까지 `알 수 없음`으로 표시합니다.
* v1.4.0 스트리밍은 OpenAI 호환 SSE를 우선 기준으로 하며, 일부 provider가 독자적인 streaming 형식을 쓰면 해당 provider는 별도 파서가 추가될 때까지 오류로 표시될 수 있습니다.
* JSON 가져오기는 로컬 백업 복원 목적이므로 신뢰할 수 없는 파일을 가져올 때 브라우저 메모리 내 데이터 오염 가능성이 있습니다. 필수 필드 검증과 secret 제외 정책으로 1차 방어합니다.
* Phase 12 이후 구조 변경은 파일 이동과 책임 분리 과정에서 회귀 위험이 있으므로, 한 번에 대분리하지 않고 현재 Unit 순서와 품질 게이트를 유지해야 합니다.
