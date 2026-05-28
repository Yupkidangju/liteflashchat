package main

import (
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"runtime"
)

// enableCORS 미들웨어는 허용된 화이트리스트 로컬 Origin에 대해서만 CORS를 명시적으로 수락합니다 (CSRF 방어).
func enableCORS(next http.Handler) http.Handler {
	// 허용된 안전 오리진 화이트리스트 정의
	allowedOrigins := map[string]bool{
		"http://localhost:5173": true,
		"http://127.0.0.1:5173": true,
		"http://localhost:8080": true,
		"http://127.0.0.1:8080": true,
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		// 요청의 Origin 헤더가 화이트리스트에 부합하는 경우에만 동적으로 헤더를 설정하여 CSRF 접근 차단
		if allowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// openBrowser 함수는 현재 사용자의 운영체제(OS)를 동적으로 진단하여,
// 시스템에 등록된 디폴트 웹 브라우저를 셸 명령어로 지연 없이 자동 기동합니다.
func openBrowser(url string) {
	var err error

	switch runtime.GOOS {
	case "linux":
		// 리눅스 데스크톱 환경의 표준 파일/URL 기동 유틸리티 실행
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		// 윈도우 파일 프로토콜 핸들러 실행
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		// macOS 기본 open 유틸리티 실행
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("지원하지 않는 운영체제(%s) 플랫폼입니다", runtime.GOOS)
	}

	if err != nil {
		log.Printf("[LiteFlashChat] 기본 브라우저 자동 호출 실패 (수동 진입 요망: %s) - 에러: %v\n", url, err)
	} else {
		log.Println("[LiteFlashChat] 기본 웹 브라우저 자동 기동 완료.")
	}
}
