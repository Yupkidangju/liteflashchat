# LiteFlashChat 빌드 및 운영 가이드 (BUILD_GUIDE.md)

본 문서는 LiteFlashChat 프로젝트의 의존성 설치, 로컬 개발 구동 및 배포 빌드 단계를 순차적으로 안내하는 가이드라인입니다. (v1.4.0 구현 완료 및 Phase 12 구조 정리 로드맵 확정 - 스트리밍/API 플랫폼 기능 검증 기준 반영)

---

## 1. 사전 준비 (Prerequisites)
본 프로젝트는 Go 백엔드와 Node.js 프론트엔드가 하이브리드로 결합된 환경입니다.
* **Go Compiler:** v1.26.1 기준 검증
* **Node.js:** v24.14.1 및 npm 기준 검증
* **Operating System:** Linux, macOS, Windows (UTF-8 환경 권장)

---

## 2. 안전한 스캐폴딩 절차 (Safe Scaffolding)
글로벌 안전 규칙인 `NO_DESTRUCTIVE_INIT` 및 `Merge Pattern`에 따라 프론트엔드 프로젝트 초기화 시 기존 DNA 문서(`spec.md`, `designs.md` 등)를 훼손하지 않기 위해 다음 단계를 고수합니다.

1. **임시 폴더에 프론트엔드 빌드 초기화:**
   ```bash
   npx -y create-vite@latest ./_scaffold_temp --template react-ts --no-interactive
   ```
2. **선택적 파일 병합:**
   - 임시 폴더에서 `package.json`, `vite.config.ts`, `tsconfig.json` 및 `src/` 디렉터리 자원만 프로젝트 루트로 무비하게 이동시킵니다.
   - 이때 기존 문서 파일이 덮어쓰여지지 않도록 병합 경계를 보호합니다.
3. **정리:** `_scaffold_temp` 폴더를 즉시 영구 삭제합니다.

---

## 3. 5대 프로바이더 로컬 구동 가이드라인

본 채팅 프로그램은 로컬 LLM 서버와의 완벽한 연동을 지원합니다. 설정 탭에서 아래의 포트 주소를 확인하십시오.

1. **OpenRouter:**
   - Base URL: `https://openrouter.ai/api/v1` (외부 인터넷 연동 필요, API Key 등록 필수)
2. **LM Studio:**
   - Base URL: `http://localhost:1234/v1`
   - LM Studio 앱의 'Local Server' 기능을 켜고 'Server Port'를 `1234`로 설정하십시오. API Key 입력란은 비워도 저장되며, 백엔드가 내부 더미 토큰을 암호화 저장해 OpenAI 호환 요청 형태를 유지합니다.
3. **Local LLM (OpenAI 호환):**
   - Base URL: `http://localhost:8000/v1`
   - Llama.cpp, Ollama, vLLM 등의 OpenAI 호환 서버 포트가 `8000`에서 가동 중인지 확인해 주십시오. API Key가 필요 없는 서버는 Key 입력 없이 Base URL만 저장합니다.
4. **Base URL 입력 규칙:**
   - 저장값은 `/v1` 같은 API 루트까지만 입력하는 것을 권장합니다.
   - 실수로 `/models` 또는 `/chat/completions`까지 붙여 넣어도 백엔드가 저장 전에 API 루트로 정규화합니다.
5. **저장 직후 반영 규칙:**
   - 설정 모달에서 프로바이더 저장에 성공하면 브라우저 새로고침 없이 현재 대화방의 프로바이더와 모델 목록이 즉시 갱신됩니다.
   - 프로바이더 활성 상태와 오류 메시지는 좌측 하단 목록이 아니라 설정 모달 내부 상태 카드에서 확인합니다.
6. **모델 메타데이터 적용 규칙 (v1.3.1):**
   - OpenRouter는 원격 모델 메타데이터의 컨텍스트, 출력 한도, 지원 파라미터를 UI에 적용합니다.
   - LM Studio는 OpenAI 호환 `/v1/models` 조회 뒤 `/api/v0/models`의 `max_context_length`를 추가 병합합니다.
   - Local LLM/OpenCode 계열은 `/models` 응답에 명시된 필드만 적용하고, 컨텍스트가 없으면 `알 수 없음`으로 표시합니다.
   - 메타데이터가 부족한 모델은 설정 모달 일반 설정 탭의 모델 메타데이터 보정에서 전체/입력/출력 한도를 수동 저장할 수 있습니다.
7. **컨텍스트 압축 검증 준비 (v1.3.1):**
   - 긴 대화 압축을 수동 검증하려면 실제 채팅이 가능한 provider/model 설정이 필요합니다.
   - 압축 비율 기본값은 `0.7`이며, 설정 모달 일반 설정 탭에서 변경합니다.
8. **v1.4.0 API 플랫폼 기능 검증 준비:**
   - 스트리밍 검증은 OpenAI 호환 SSE를 지원하는 provider/model이 필요합니다.
   - JSON/Markdown 내보내기는 브라우저 다운로드 권한이 필요합니다.
   - JSON 가져오기 검증은 민감정보가 없는 테스트 백업 파일로 수행합니다.
   - Inspector 검증 시 API Key, Authorization, `.secret.key`, `keys.json` 암호문이 화면과 복사 결과에 없는지 반드시 확인합니다.

---

## 4. 런타임 출력 경로 및 엔트리 포인트
* **Go 백엔드 엔트리:** `/mnt/Projects_SSD/go/liteflashchat/main.go`
* **프론트엔드 소스 엔트리:** `/mnt/Projects_SSD/go/liteflashchat/src/main.tsx`
* **Vite 빌드 출력 경로:** `/mnt/Projects_SSD/go/liteflashchat/dist`
* **통합 패키징 출력 경로:** `/mnt/Projects_SSD/go/liteflashchat/output`

### 4.1 루트 `package.json` 스크립트 계약
| 스크립트 | 명령 | 검증 기준 |
| --- | --- | --- |
| `npm run dev` | `vite` | 개발 서버가 `5173` 포트에서 프론트엔드를 제공 |
| `npm run build` | `tsc -b && vite build` | `dist/index.html` 및 정적 자산 생성 |
| `npm run build:output` | `node scripts/build-output.mjs` | `output/liteflashchat[.exe]`와 `output/dist/index.html` 생성 |
| `npm run lint` | `eslint .` | React Hooks 및 TypeScript lint 오류 0건 |
| `npm run preview` | `vite preview` | Vite 빌드 결과 미리보기 |

---

## 5. 첫 실행 및 개발 환경 구동 명령

### 5.1 로컬 개발 모드 (Vite Dev Server & Go Backend 동시 구동)
1. **의존성 설치 (프론트엔드):**
   ```bash
   npm install
   ```
2. **Vite 개발 서버 기동 (포트 5173):**
   ```bash
   npm run dev
   ```
3. **Go 백엔드 기동 (포트 8080):**
   - 별도의 터미널 창을 열고 루트 경로에서 구동합니다.
   ```bash
   go run -buildvcs=false .
   ```

### 5.2 프로덕션 빌드 및 배포 가동
1. **프론트엔드 리소스 컴파일:**
   ```bash
   npm run build
   ```
2. **Go 백엔드 컴파일:**
   ```bash
   go build -buildvcs=false -o liteflashchat .
   ```
3. **통합 프로덕션 실행:**
   ```bash
   ./liteflashchat
   ```

### 5.3 범용 output 패키징 빌드
Windows, macOS, Linux 모두 같은 npm 명령으로 현재 운영체제용 실행 파일과 정적 웹 자산을 `output/` 폴더에 생성합니다.
```bash
npm run build:output
```
* **Linux/macOS 출력:** `output/liteflashchat`, `output/dist/`
* **Windows 출력:** `output/liteflashchat.exe`, `output/dist/`
* **보안 기준:** `.secret.key`, `keys.json`, `prompts.json` 같은 로컬 런타임 데이터는 `output/`에 복사하지 않습니다. 최초 실행 시 필요한 로컬 키와 설정 파일은 실행 위치 기준으로 새로 생성 또는 저장됩니다.
* **실행 방법:** `output/` 폴더로 이동한 뒤 실행 파일을 기동해야 Go 서버가 같은 폴더의 `dist/`를 정적으로 서빙합니다.

---

## 6. 빌드 품질 검증 및 테스트 가이드 (Verification & Test)

배포 전 정적 타이핑 안정성과 백엔드 암호학 모듈의 완전성을 확인하기 위해 다음의 검증 파이프라인을 무조건 실행해야 합니다.

### 6.1 프론트엔드 타입 정합성 검증
React/TS 컴포넌트의 타입 충돌 여부를 컴파일 빌드 없이 사전에 검출합니다.
```bash
npx tsc --noEmit
```

### 6.2 프론트엔드 Lint 검증
React Hooks 규칙과 명시적 타입 안전성을 확인합니다.
```bash
npm run lint
```

### 6.3 백엔드 회귀 유닛 테스트 실행
암호학(crypto), 로컬 파일 DB(config, prompts), 시스템 프롬프트 인터셉트 주입(proxy_test), 프로바이더 설정 정규화(provider_config_test) 모듈의 안정성을 전체 검증합니다.
```bash
go test -v ./...
```
* **성공 기준:** 전체 유닛 테스트 `PASS` 및 에러율 `0.0%` 확인.
* **키 보존 기준:** 테스트는 실제 `.secret.key`를 삭제하거나 재생성하지 않아야 하며, 테스트 전용 임시 키 파일만 사용해야 합니다.

### 6.4 통합 빌드 검증
```bash
npm run build
go build -buildvcs=false -o /tmp/liteflashchat-audit .
```

### 6.5 output 패키징 검증
```bash
npm run build:output
```
* **성공 기준:** `output/liteflashchat` 또는 `output/liteflashchat.exe`와 `output/dist/index.html`이 존재해야 합니다.

### 6.6 v1.3.1 구현 완료 후 추가 수동 검증
1. 모델 탐색기에서 선택 모델의 전체 컨텍스트, 입력 한도, 출력 한도가 표시되는지 확인합니다.
2. 우측 모델 파라미터 패널에서 지원되지 않는 항목이 disabled 상태인지 확인합니다.
3. 새 대화 첫 메시지 발송 후 대화 목록 제목이 첫 문장으로 저장되는지 확인합니다.
4. 제목을 수동 변경한 뒤 새 메시지를 보내도 제목이 덮어쓰이지 않는지 확인합니다.
5. 긴 대화에서 예상 컨텍스트가 `maxInputTokens * compressionRatio`를 넘을 때 요약 요청이 먼저 실행되는지 확인합니다.
6. 메타데이터가 없는 OpenAI 호환 모델은 임의 `8192`가 아니라 `알 수 없음`으로 표시되는지 확인합니다.
7. 우측 패널 기본값이 Temp `1`, Top P `0.95`, Top K `40`, RP `1.1`인지 확인합니다.

### 6.7 v1.4.0 구현 완료 후 추가 수동 검증
1. `/api/chat/stream` 기반 응답이 assistant 말풍선에 점진 표시되는지 확인합니다.
2. 스트리밍 중 `[중지]` 버튼이 표시되고, 클릭 시 부분 응답이 보존되는지 확인합니다.
3. JSON 내보내기 파일에 `sessions`, `modelOverrides`, `presets`, `schemaVersion`이 있고 API Key/Authorization/암호문이 없는지 확인합니다.
4. JSON 가져오기가 기존 세션을 삭제하지 않고 충돌 ID를 새 ID로 병합하는지 확인합니다.
5. Markdown 내보내기 결과가 사람이 읽을 수 있는 대화 로그로 생성되는지 확인합니다.
6. 좌측 검색이 제목, 본문, provider, model, Super Prompt 이름 기준으로 필터링되는지 확인합니다.
7. Inspector의 요청/응답 복사 결과에 secret 계열 값이 없는지 확인합니다.
8. 프리셋 저장/적용/이름 변경/삭제가 현재 대화 상태와 `localStorage`에 반영되는지 확인합니다.

### 6.8 Phase 12 구조 정리 착수 전/후 검증
Phase 12는 기능 추가가 아닌 무회귀 구조 정리입니다. 각 단위 작업 전후로 아래 기준을 확인합니다.

```bash
npm run lint
npm run build
go test ./...
npm run build:output
```

* **착수 전 기준선:** `src/App.tsx` 2439줄, `src/index.css` 1076줄, `main.go` 592줄, `proxy.go` 723줄을 기준으로 기록합니다.
* **2026-05-28 정리 완료 결과:** `src/App.tsx` 862줄, `src/index.css` 82줄, `main.go` 62줄, `proxy.go` 3줄 안내 파일입니다.
* **완료 목표:** `src/App.tsx` 900줄 이하와 `src/index.css` 350줄 이하 목표를 충족했습니다. 백엔드 파일은 `models.go`, `chat_proxy.go`, `stream_proxy.go`, `summary.go`, `system_prompt.go` 등으로 분리했습니다.
* **금지 변경:** API endpoint, localStorage key, export schemaVersion, provider ID, prompt 저장 형식, API Key 저장 방식은 변경하지 않습니다.
* **수동 회귀 순서:** provider 저장 -> 모델 조회 -> 모델 선택 -> Super Prompt 적용 -> 스트리밍 채팅 -> 중지 -> JSON/Markdown 내보내기 -> JSON 가져오기 -> Inspector 복사 -> 프리셋 적용을 확인합니다.
