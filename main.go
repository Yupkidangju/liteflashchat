// [v1.4.1] 서버 부트스트랩 전용 엔트리입니다. 상세 API 핸들러는 책임별 파일로 분리합니다.

package main

import (
	"log"
	"net/http"
	"os"
	"strings"
)

func main() {
	// 1. 애플리케이션 기동 시 .secret.key 암호화 키를 기계 검사/생성해 둡니다.
	_, err := getOrInitKey()
	if err != nil {
		log.Fatalf("백엔드 핵심 암호화 장치 로딩 실패: %v", err)
	}
	log.Println("[LiteFlashChat] 로컬 암호화 모듈 활성화 완료.")

	// 2. HTTP 라우트 바인딩 시작
	mux := http.NewServeMux()

	// API 라우터 등록
	mux.HandleFunc("/api/providers", handleGetProviders)
	mux.HandleFunc("/api/keys", handleSaveKeys)
	mux.HandleFunc("/api/models", handleGetModels)
	mux.HandleFunc("/api/chat", handleChatProxy)
	mux.HandleFunc("/api/chat/stream", handleChatStreamProxy)
	mux.HandleFunc("/api/chat/summary", handleChatSummaryProxy)
	mux.HandleFunc("/api/prompts", handlePromptsCRUD)

	// 정적 파일 서빙 (React SPA)
	if _, err := os.Stat("dist"); err == nil {
		fileServer := http.FileServer(http.Dir("dist"))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				return
			}
			path := "dist" + r.URL.Path
			if _, err := os.Stat(path); os.IsNotExist(err) {
				http.ServeFile(w, r, "dist/index.html")
				return
			}
			fileServer.ServeHTTP(w, r)
		})
		log.Println("[LiteFlashChat] 컴파일된 정적 웹자원(dist/) 연동 완료.")
	} else {
		log.Println("[LiteFlashChat] 경고: dist/ 폴더가 검출되지 않았습니다. 프론트엔드는 npm run dev 개발 서버를 기동해 주십시오.")
	}

	corsWrappedHandler := enableCORS(mux)

	port := "8080"
	log.Printf("[LiteFlashChat] 백엔드 서버 가동 완료. URL: http://localhost:%s\n", port)

	// 기본 웹 브라우저를 디바이스 OS 규격에 맞춰 자동으로 즉각 기동합니다.
	go openBrowser("http://localhost:" + port)

	if err := http.ListenAndServe("127.0.0.1:"+port, corsWrappedHandler); err != nil {
		log.Fatalf("서버 기동 에러: %v", err)
	}
}
