# LiteFlashChat

[한국어](#한국어) | [English](#english) | [日本語](#日本語) | [繁體中文](#繁體中文) | [简体中文](#简体中文)

---

## 한국어

LiteFlashChat은 OpenRouter, OpenCode Zen, OpenCode Go, LM Studio, Local LLM API 연동을 지원하는 프리미엄 웹 기반 로컬 AI 채팅 프로그램입니다. 

### 주요 특징
1. **무키 로컬 암호화 (No-Masterkey Cryptography):** 백엔드가 시작될 때 고유한 보안 키(`.secret.key`)를 자동으로 생성하여, 별도 암호 입력 없이 사용자의 API 키를 AES-256-GCM 알고리즘으로 디스크에 안전하게 암호화 보존합니다.
2. **CORS 우회 및 API 키 숨김:** 브라우저에서 직접 외부 API를 호출하지 않고 Go net/http 백엔드의 API 프록시 기능을 우회 통과하여, API 키 노출 위협을 완전히 소거합니다.
3. **지능형 Vision 활성화 (Model-aware UI):** 불러온 모델 정보를 스캔하여 이미지/파일 전송이 불가능한 일반 텍스트 모델인 경우 업로드 버튼을 100ms 이내에 즉각 비활성화하고 툴팁 안내를 띄웁니다.
4. **프리미엄 Midnight 테마 UI:** 아웃핏 폰트, 미려한 그라데이션 및 반투명 유리(Glassmorphism) 효과를 버무린 다크 테마 채팅 인터페이스를 기본 장착합니다.
5. **⚙️ 통합 설정 및 Super Prompt CRUD (v1.1.0):** 톱니바퀴 단추 클릭 시 반투명 설정 창이 노출되며, `prompts.json` 기반 시스템 페르소나 지침의 저장, 편집 및 메시지 0번 인덱스 system 동적 주입 연동.
6. **🔍 모델 탐색기 및 안전 수정 저장 (v1.2.1):** 수백 개 모델의 실시간 필터링 검색창과 Vision 배지 모달을 제공하며, 이미 연동된 프로바이더의 API Key 유출 없는 원자적 Base URL 부분 수정 모드(`__KEEP_EXISTING__` 플래그) 지원.
7. **🛡️ 키 보존 및 설정 순환 안정화 (v1.2.2):** 테스트가 실제 `.secret.key`를 훼손하지 않으며, Base URL 오입력 정규화, 로컬 프로바이더 무키 저장, 모델 로드 실패 원인 표시를 지원합니다.
8. **🔁 즉시 반영 설정 UI (v1.2.4):** 프로바이더 저장 후 새로고침 없이 활성 프로바이더와 모델 목록을 갱신하며, Super Prompt 관리는 설정에서, 대화방 장착은 사이드바에서 분리 수행합니다.
9. **📏 모델 한도/컨텍스트 압축 구현 (v1.3.1):** 모델별 전체/입력/출력 컨텍스트와 지원 파라미터를 반영하고, LM Studio 메타데이터 보강, 수동 한도 보정, 대화 제목 편집, 기본 비율 0.7의 LLM 요약 압축을 제공합니다.

### 구현 완료
* **v1.4.0 API 채팅 플랫폼 확장:** 스트리밍 응답과 요청 취소, JSON/Markdown 내보내기, JSON 가져오기, 대화 검색, 요청/응답 Inspector, 채팅 프리셋을 구현했습니다.

### 기동 방법
1. **의존성 로드 및 빌드:**
   ```bash
   npm install
   npm run build
   ```
2. **Go 백엔드 구동:**
   ```bash
   go build -buildvcs=false -o liteflashchat .
   ./liteflashchat
   ```
   이후 브라우저에서 `http://localhost:8080`으로 진입합니다.
3. **통합 output 패키징:**
   ```bash
   npm run build:output
   ```
   `output/` 폴더에 실행 파일과 `dist/`가 함께 생성됩니다.

---

## English

LiteFlashChat is a premium web-based local AI chat client supporting OpenRouter, OpenCode Zen, OpenCode Go, LM Studio, and Local LLM APIs.

### Key Features
1. **No-Masterkey Local Encryption:** Automatically generates a unique secure key (`.secret.key`) on startup, securely encrypting your API keys using the AES-256-GCM algorithm without requiring a master password.
2. **CORS Bypass & API Key Hiding:** All requests are proxied via the Go net/http backend, preventing API keys from ever leaking into the browser developer console.
3. **Intelligent Vision Enablement (Model-aware UI):** Scans model metadata in real-time. Automatically disables the image upload button with an intuitive tooltip if the selected model does not support multimodal vision inputs.
4. **Premium Midnight Theme UI:** A sleek dark-themed interface built with Outfit typography, elegant gradients, and translucent glassmorphism effects.
5. **⚙️ Integrated Settings Overlay & Super Prompt CRUD (v1.1.0):** Manage system persona instructions via `prompts.json` and inject system role prompts at index 0 of message payloads dynamically.
6. **🔍 Model Explorer & Secure Modification Mode (v1.2.1):** Live model searching, pastel Vision tags, and safe provider config modification using the `__KEEP_EXISTING__` security flag.
7. **🛡️ Key Preservation & Settings Cycle Stabilization (v1.2.2):** Tests no longer touch the real `.secret.key`; Base URLs are normalized, local providers can be saved without a key, and model-load failures show actionable causes.
8. **🔁 Immediate Settings Sync UI (v1.2.4):** Provider saves refresh the active provider and model list without a browser reload, while Super Prompt management stays in settings and room application stays in the sidebar.
9. **📏 Model Limits & Context Compression (v1.3.1):** Applies model context/input/output limits, supported generation parameters, LM Studio metadata enrichment, manual limit overrides, editable chat titles, and LLM summary compression with a default ratio of 0.7.

### Confirmed Roadmap
* **v1.4.0 API Chat Platform Expansion:** Streaming responses, request cancellation, JSON/Markdown export, JSON import, chat search, request/response Inspector, and chat presets are implemented.

### How to Run
1. **Install Dependencies & Build:**
   ```bash
   npm install
   npm run build
   ```
2. **Run Go Backend:**
   ```bash
   go build -buildvcs=false -o liteflashchat .
   ./liteflashchat
   ```
   Open your browser and navigate to `http://localhost:8080`.
3. **Build Output Package:**
   ```bash
   npm run build:output
   ```
   The executable and `dist/` assets are created under `output/`.

---

## 日本語

LiteFlashChatは、OpenRouter, OpenCode Zen, OpenCode Go, LM Studio, Local LLM APIの連携に対応したプレミアムなウェブベースのローカルAIチャットプログラムです。

### 主な特徴
1. **パスワード不要のローカル暗号化:** 起動時に独自のセキュリティキー（`.secret.key`）を自動生成し、マスターパスワードなしでAPIキーをAES-256-GCMアルゴリズムでローカルディスクに安全に暗号化保存します。
2. **CORS回避とAPIキー隠蔽:** ブラウザから直接APIを叩かず、Go net/httpバックエンドのプロキシ機能を経由するため、APIキーがブラウザのコンソールに漏洩する心配はありません。
3. **インテリジェントVision有効化:** 選択されたモデルのメタデータを検出し、画像添付が不可能なテキスト専用モデルの場合は100ms以内にアップロードボタンを無効化してツールチップで案内します。
4. **プレミアムなミッドナイトテーマUI:** Outfitフォント、美麗なグラデーション、半透明ガラス（Glassmorphism）効果を融合した上品なダークモードチャット画面を提供します。
5. **⚙️ 統合設定およびSuper Prompt CRUD (v1.1.0):** 歯車ボタンから半透明設定を開き、`prompts.json`ベースのペルソナの作成・読込・削除、およびシステムプロンプトの動的挿入。
6. **🔍 モデルエクスプローラーと安全な修正モード (v1.2.1):** リアルタイム検索フィルターとVisionバッジ、既存キーの漏洩なしにURL等の部分修正が可能な`__KEEP_EXISTING__`安全プロトコルの実装。
7. **🛡️ キー保全と設定サイクル安定化 (v1.2.2):** テストは実際の`.secret.key`を変更せず、Base URLの正規化、ローカルプロバイダーのキーなし保存、モデル読込失敗理由の表示に対応します。
8. **🔁 即時反映設定UI (v1.2.4):** プロバイダー保存後にブラウザ再読み込みなしで有効プロバイダーとモデル一覧を更新し、Super Promptの管理は設定、会話への適用はサイドバーで分離します。
9. **📏 モデル上限とコンテキスト圧縮 (v1.3.1):** モデル別の全体・入力・出力コンテキスト、対応パラメーター、LM Studioメタデータ補完、手動上限補正、会話タイトル編集、既定比率0.7のLLM要約圧縮に対応します。

### 確定ロードマップ
* **v1.4.0 APIチャットプラットフォーム拡張:** ストリーミング応答、リクエスト中止、JSON/Markdownエクスポート、JSONインポート、会話検索、リクエスト/レスポンスInspector、チャットプリセットを実装しました。

### 起動方法
1. **依存関係の導入とビルド:**
   ```bash
   npm install
   npm run build
   ```
2. **Goバックエンドの起動:**
   ```bash
   go build -buildvcs=false -o liteflashchat .
   ./liteflashchat
   ```
   ブラウザで `http://localhost:8080` を開きます。
3. **統合outputパッケージ作成:**
   ```bash
   npm run build:output
   ```
   実行ファイルと `dist/` が `output/` に生成されます。

---

## 繁體中文

LiteFlashChat 是一款支援 OpenRouter、OpenCode Zen、OpenCode Go、LM Studio 與 Local LLM API 的高階網頁端本地 AI 聊天應用程式。

### 核心特點
1. **免主密碼本地加密 (No-Masterkey Cryptography)：** 後端啟動時會自動生成獨立的安全性金鑰 (`.secret.key`)，無需手動輸入密碼，即可以 AES-256-GCM 演算法將 API 金鑰安全地加密保存在本地檔案中。
2. **CORS 繞過與 API 金鑰防護：** 透過 Go net/http 後端代理所有 API 請求，徹底消除 API 金鑰在瀏覽器開發者工具網絡控制台中洩露的風險。
3. **智慧型 Vision 感知 (Model-aware UI)：** 即時掃描模型元數據，若選取不支援多模態的純文字模型，會在 100 毫秒內自動禁用圖片上傳按鈕並顯示導引提示。
4. **頂級 Midnight 玻璃擬態 UI：** 搭配 Outfit 字型、極致漸層與半透明玻璃擬態（Glassmorphism）設計，帶來無與倫比的暗黑風格聊天體驗。
5. **⚙️ 整合設定與 Super Prompt CRUD (v1.1.0)：** 點擊齒輪開啟半透明控制板，透過 `prompts.json` 實現系統角色設定之儲存、載入與 payload system 動態插入。
6. **🔍 模型搜尋器與安全修正儲存 (v1.2.1)：** 支援數百個模型的即時搜尋篩選與 Vision 標章，並利用 `__KEEP_EXISTING__` 機制免除重複輸入金鑰即可安全修正 Base URL。
7. **🛡️ 金鑰保全與設定循環穩定化 (v1.2.2)：** 測試不再碰觸真實 `.secret.key`，並支援 Base URL 正規化、本地供應商免金鑰儲存，以及模型載入失敗原因提示。
8. **🔁 即時同步設定 UI (v1.2.4)：** 儲存供應商後無需重新整理即可更新啟用供應商與模型清單，Super Prompt 管理由設定執行，聊天室套用則由側邊欄執行。
9. **📏 模型限制與上下文壓縮 (v1.3.1)：** 依模型套用整體/輸入/輸出上下文、支援參數、LM Studio 元資料補強、手動限制校正、聊天室標題編輯，以及預設比例 0.7 的 LLM 摘要壓縮。

### 確定路線圖
* **v1.4.0 API 聊天平台擴充：** 已完成串流回應、請求取消、JSON/Markdown 匯出、JSON 匯入、聊天搜尋、請求/回應 Inspector，以及聊天預設。

### 啟動步驟
1. **安裝依賴並建置：**
   ```bash
   npm install
   npm run build
   ```
2. **運行 Go 後端：**
   ```bash
   go build -buildvcs=false -o liteflashchat .
   ./liteflashchat
   ```
   隨後在瀏覽器訪問 `http://localhost:8080`。
3. **建立整合 output 套件：**
   ```bash
   npm run build:output
   ```
   執行檔與 `dist/` 會一併產生於 `output/`。

---

## 简体中文

LiteFlashChat 是一款支持 OpenRouter、OpenCode Zen、OpenCode Go、LM Studio 和 Local LLM API 的高端网页端本地 AI 聊天应用程序。

### 核心特点
1. **免主密码本地加密 (No-Masterkey Cryptography)：** 后端启动时会自动生成独立的安全密钥 (`.secret.key`)，无需手动输入密码，即可使用 AES-256-GCM 算法将 API 密钥安全地加密保存在本地文件中。
2. **CORS 绕过与 API 密钥防护：** 通过 Go net/http 后端代理所有 API 请求，彻底消除 API 密钥在浏览器开发者工具网络控制台中泄露的风险。
3. **智能 Vision 感知 (Model-aware UI)：** 实时扫描模型元数据，若选取不支持多模态的纯文本模型，会在 100 毫秒内自动禁用图片上传按钮并显示引导提示。
4. **顶级 Midnight 玻璃拟态 UI：** 搭配 Outfit 字体、极致渐变与半透明玻璃拟态（Glassmorphism）设计，带来无与伦比的暗黑风格聊天体验。
5. **⚙️ 整合设置与 Super Prompt CRUD (v1.1.0)：** 点击齿轮开启半透明控制板，通过 `prompts.json` 实现系统角色设定之储存、载入与 payload system 动态插入。
6. **🔍 模型搜寻器与安全修正储存 (v1.2.1)：** 支持数百个模型的即时搜寻筛选与 Vision 标章，并利用 `__KEEP_EXISTING__` 机制免除重复输入金钥即可安全修正 Base URL。
7. **🛡️ 密钥保全与设置循环稳定化 (v1.2.2)：** 测试不再触碰真实 `.secret.key`，并支持 Base URL 规范化、本地提供方免密钥保存，以及模型加载失败原因提示。
8. **🔁 即时同步设置 UI (v1.2.4)：** 保存提供方后无需刷新即可更新启用提供方与模型列表，Super Prompt 管理由设置执行，聊天室应用则由侧边栏执行。
9. **📏 模型限制与上下文压缩 (v1.3.1)：** 按模型应用整体/输入/输出上下文、支持参数、LM Studio 元数据补强、手动限制校正、聊天室标题编辑，以及默认比例 0.7 的 LLM 摘要压缩。

### 确定路线图
* **v1.4.0 API 聊天平台扩展：** 已完成流式响应、请求取消、JSON/Markdown 导出、JSON 导入、聊天搜索、请求/响应 Inspector，以及聊天预设。

### 启动步骤
1. **安装依赖并构建：**
   ```bash
   npm install
   npm run build
   ```
2. **运行 Go 後端:**
   ```bash
   go build -buildvcs=false -o liteflashchat .
   ./liteflashchat
   ```
   随后在浏览器访问 `http://localhost:8080`。
3. **构建整合 output 包：**
   ```bash
   npm run build:output
   ```
   执行文件与 `dist/` 会一并生成到 `output/`。
