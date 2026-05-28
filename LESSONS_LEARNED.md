# LiteFlashChat 자가 치유 교훈 및 복구 DNA (LESSONS_LEARNED.md)

본 문서는 프로젝트 전역 지침(Master Rules)에 정의된 **AI 학습 및 복구 자가 치유 루프(AI Learning and Recovery DNA)** 정책에 의거하여 작성되었습니다. 
소스 코드가 완전히 유실되거나 손상되더라도, 후속 AI 에이전트가 본 문서에 기록된 설계 의도와 핵심 교훈을 참고하여 시스템 아키텍처를 95% 이상 원형 복구할 수 있는 유전 설계 지침입니다.

---

## 1. 아키텍처 요약 및 유전 복구 정보 (System DNA)

LiteFlashChat은 데스크톱 웹 환경에서 사용되는 **안전 로컬 AI 허브 프록시(Secure Local AI Hub Proxy)** 시스템입니다.

* **백엔드 (Go):** 표준 라이브러리 `net/http` 단독 구동. 포트 `8080` 루프백(`127.0.0.1`) 바인딩으로 외부 접근 완벽 차단.
* **프론트엔드 (React + TS):** Vite 번들러 기반, Obsidian Dark 및 Glassmorphism UI/UX 테마 구현.
* **설정 데이터베이스:** 루트 경로의 `keys.json`, `prompts.json` 파일과 브라우저 `localStorage`의 `litechat_sessions` 기반 데이터 관리. `chats.json` 파일 저장은 현재 범위에서 제외합니다.

---

## 2. 핵심 구현 아키텍처 및 교훈 (Key Lessons)

### 2.1 무키 로컬 암호화 (No-Masterkey Encryption)
* **문제:** 로컬 AI 클라이언트에서 API 키를 안전하게 보관하려면 암호화가 필수적이지만, 매번 마스터 패스워드를 물어보는 구조는 대화 경험을 심각하게 손상시킵니다.
* **해결 (교훈):** 
  - 백엔드가 로컬에 자동 인스톨하는 32바이트 대칭키 파일(`.secret.key`)을 기반으로 삼아 사용자 개입 없는 AES-256-GCM 암호화를 확립합니다.
  - 암호학적 정합성을 위해 암호화할 때마다 고유한 암호화 난수 IV(12 Bytes)를 재생성하고, `EncryptedAPIKey`와 `IV`를 동시에 `keys.json`에 분리 저장함으로써 Replay Attack 취약점을 완전 차단합니다.
  - **복구 가이드:** `.secret.key`가 유실되면 기존 암호화된 API Key는 복구 불가능하므로, 백엔드는 키 파일 존재 여부를 부팅 시 무조건 체크하고 없을 때만 원자적으로 단 1회 생성해야 합니다.

### 2.2 React 비동기 렌더링 및 수정 모드 상태 기계 (State Machine)
* **문제 (v1.2.1 버그 원인):** 이미 API Key가 활성화된 상태에서 Base URL만 변경하려 했을 때, `inputApiKey`가 빈 문자열(`""`)로 렌더링되면서 저장 버튼이 비활성화되거나 키 수정을 강제하는 아키텍처 결함이 발생했습니다.
* **해결 (교훈):**
  - 컴포넌트의 단순 input value 바인딩에 의존하지 않고, **수정 편집 모드 상태(`isProviderEditMode`)**와 **진입 시점의 원본 Base URL 상태(`originalBaseUrl`)**를 격리 추적하는 가상의 상태 기계를 구성했습니다.
  - 이를 통해 `inputApiKey`가 빈 값일지라도, `isProviderEditMode === true`인 상태에서 `inputBaseUrl !== originalBaseUrl` 변경이 감지되면 즉시 수정 저장 단추를 활성화하는 정교함을 확보했습니다.

### 2.3 `__KEEP_EXISTING__` 가상 계약 설계 (Zero-Exposure Privacy)
* **문제:** 수정 모드에서 API Key 원본 노출을 차단하기 위해 백엔드에서 복호화된 원본 키를 다시 프론트엔드로 보내주는 대안이 고려되었으나, 이는 브라우저 메모리에 키가 평문 적재되어 극도로 취약합니다.
* **해결 (교훈):**
  - 프론트엔드와 백엔드 간에 가상의 특수 변경 지시자 지침인 **`__KEEP_EXISTING__` 프로토콜**을 도입했습니다.
  - API Key 인풋 창이 빈 채로 저장이 접수되면 프론트엔드는 API Key 자리에 `__KEEP_EXISTING__`를 전달합니다.
  - 백엔드는 이를 감지 시 기존 디스크에 이미 암호화 보관 중이던 `EncryptedAPIKey`와 `IV`를 덮어쓰지 않고 원형 보존하면서, `BaseURL`만 원자적으로 교체 업데이트합니다.
  - 이로써 API Key 원본은 백엔드 경계 외부로 단 1바이트도 유출되지 않는 절대적 **Zero-Exposure** 보안을 달성했습니다.

### 2.4 v1.3.1 모델 메타데이터 확실성 및 컨텍스트 압축 교훈
* **문제:** 모델별 컨텍스트, 출력 한도, 지원 파라미터가 provider마다 다르며, 일부 OpenAI 호환 서버는 메타데이터를 충분히 제공하지 않습니다.
* **해결 (교훈):**
  - 지원 여부가 확정된 파라미터만 UI에서 활성화하고 payload에 포함해야 원격 API별 실패를 줄일 수 있습니다.
  - 컨텍스트 한도는 임의 추정값을 확정값처럼 표시하지 않아야 합니다. OpenAI 호환 응답에 컨텍스트가 없으면 `알 수 없음`으로 두고, LM Studio는 `/api/v0/models.max_context_length` 또는 사용자의 수동 보정값만 신뢰합니다.
  - 기본 생성값은 사용자가 기대한 `temperature=1`, `top_p=0.95`, `top_k=40`, `repetition_penalty=1.1`을 세션 초기값으로 고정해야 합니다.
  - 컨텍스트 초과 시 오래된 메시지를 조용히 잘라내면 대화 의미가 손상되므로, 기본 압축 전략은 동일 모델을 이용한 LLM 요약으로 고정합니다.
  - 요약 실패는 숨기지 않고 사용자에게 표시하며, 실제 채팅 발송을 중단해 무의식적인 문맥 손실을 차단합니다.
  - **복구 가이드:** 후속 구현자는 `ModelInfo.supportedParameters`, `ModelInfo.metadataSource`, `ModelMetadataOverride`, `ChatSession.contextSummary`, `compressionRatio=0.7` 계약을 먼저 복구해야 v1.3.1 기능을 안전하게 재구성할 수 있습니다.

### 2.5 v1.4.0 API 채팅 플랫폼 확장 교훈
* **문제:** 순수 API 채팅 플랫폼은 단순히 메시지를 보내고 받는 기능만으로는 장기 사용성이 부족합니다. 응답 체감 속도, 백업, 검색, 디버깅, 반복 설정 재사용이 함께 필요합니다.
* **해결 (교훈):**
  - 스트리밍 응답은 별도 임시 메시지가 아니라 기존 assistant 메시지 하나에 delta를 누적해야 대화 저장과 UI가 단순해집니다.
  - 요청 취소는 실패가 아니라 사용자의 의도된 종료이므로, 부분 응답을 삭제하지 않고 `cancelled` 상태로 남겨야 합니다.
  - JSON 백업은 복원용, Markdown은 읽기용으로 역할을 분리해야 가져오기 검증과 사용자 기대가 명확해집니다.
  - Inspector는 API 플랫폼 디버깅에 필수지만, secret 노출 위험이 있으므로 영구 저장하지 않고 sanitized snapshot만 보여줘야 합니다.
  - 프리셋은 API Key와 Base URL을 포함하지 않아야 보안 경계와 provider 설정 책임이 유지됩니다.
  - **복구 가이드:** 후속 구현자는 `/api/chat/stream`, `ChatMessage.status`, `ChatExportBundle`, `InspectorSnapshot`, `ChatPreset`, `litechat_presets` 계약을 먼저 복구해야 v1.4.0 기능을 안전하게 재구성할 수 있습니다.

### 2.6 Phase 12 구조 정리 교훈
* **문제:** v1.4.0 기능 확장 이후 `src/App.tsx`와 `src/index.css`가 각각 2439줄, 1076줄로 커져 후속 API 모델 테스트 기능을 추가할 때 회귀 위험이 커졌습니다.
* **해결 (교훈):**
  - 구조 정리는 기능 추가와 섞지 않고 독립 Phase로 분리해야 합니다.
  - 순수 유틸 -> API 클라이언트 -> 상태 훅 -> UI 컴포넌트 -> 스타일 -> 백엔드 프록시 파일 순서로 작게 나누면 회귀 원인을 좁힐 수 있습니다.
  - Redux/Recoil 같은 새 상태 라이브러리는 현재 문서 계약을 크게 바꾸므로, Phase 12에서는 React hook과 props 조합으로만 책임을 분리합니다.
  - 줄 수 목표는 품질 지표일 뿐이며, API endpoint, localStorage key, export schemaVersion, provider ID, prompt 저장 형식 무변경이 더 우선입니다.
  - 정리 완료 시 `src/App.tsx` 862줄, `src/index.css` 82줄, `main.go` 62줄까지 줄였고, 백엔드 프록시와 스타일은 책임별 파일로 분리했습니다. 후속 기능 추가도 동일하게 작은 단위와 게이트 검증을 유지해야 합니다.
  - **복구 가이드:** 후속 구현자는 `spec.md`의 Phase 12 표, `audit_roadmap.md`의 Unit 12-1~12-8, `DESIGN_DECISIONS.md`의 ADR-014를 먼저 읽고 같은 순서로만 구조 정리를 진행해야 합니다.

---

## 3. 자가 치유 자가 점검 기준 (Troubleshooting & Auto-Recovery)

후속 AI 에이전트나 코어 시스템이 기능 손상을 복구하거나 재빌드할 때 가동해야 하는 상시 자가 감사 체크리스트입니다.

1. **포트 8080 포트 충돌:** 포트 점유 상태 확인 및 비동기 루프백 격리 정합성 점검.
2. **CORS 헤더 간섭:** 개발 서버(`5173`)와 프로덕션 바인딩 경로 이외의 외부 도메인 CORS 차단 상태 유지 검증.
3. **AES 복호화 실패:** `.secret.key` 파일의 손상 여부 및 32바이트 규격 검사.
4. **JSON 무결성:** `keys.json`, `prompts.json` 파일이 임의 수정되어 JSON 구문 파싱에러가 날 때의 폴백 데이터 방어 로직 상시 구동.
5. **모델 파라미터 오작동:** `supportedParameters`가 비어 있는 모델에서 우측 패널이 활성화되지 않아야 하며, payload에도 샘플링 파라미터가 포함되지 않아야 합니다.
6. **대화 제목 복구:** `litechat_sessions`에 `isTitleAutoGenerated`가 없으면 기존 세션 호환을 위해 false 또는 현재 제목 보존값으로 보정해야 합니다.
7. **컨텍스트 압축 실패:** 요약 API 실패 시 원본 메시지를 삭제하지 않고, 일반 채팅 발송도 중단해야 합니다.
8. **컨텍스트 한도 혼동:** 명시 메타데이터가 없는 모델에서 `8192` 같은 임의값이 다시 나타나면 회귀입니다. 우측 패널과 컨텍스트 바는 `알 수 없음` 및 수동 보정 안내를 표시해야 합니다.
9. **스트리밍 중복 메시지:** delta마다 새 assistant 메시지를 만들면 세션 복구가 깨집니다. 하나의 `streaming` 메시지를 누적 업데이트해야 합니다.
10. **백업 secret 누출:** JSON/Markdown export와 Inspector 복사 결과에 API Key, Authorization, `.secret.key`, `keys.json` 암호문이 보이면 즉시 보안 회귀로 간주합니다.
11. **프리셋 책임 혼동:** 프리셋이 Base URL이나 API Key를 저장하면 provider 설정 경계가 무너집니다. 프리셋은 채팅 실행 설정만 저장해야 합니다.
12. **구조 정리 대분리 위험:** `src/App.tsx`와 `src/index.css`를 한 번에 대분리하면 스트리밍, Inspector, 백업, 프리셋 회귀를 찾기 어렵습니다. Phase 12 Unit 순서를 지키고 각 단위마다 품질 게이트를 실행해야 합니다.
