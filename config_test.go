// [v1.1.0] 최초 작성
// 이 테스트 코드는 config.go의 Super Prompt 데이터베이스 I/O(prompts.json) 및
// 덮어쓰기(Overwrite) 수정 기능의 무결성을 단위 테스트하기 위해 작성되었습니다.

package main

import (
	"os"
	"testing"
)

// TestPromptsFileIO 함수는 prompts.json 파일에 새로운 페르소나 지침을 쓰고,
// 동일한 이름으로 재저장 시 덮어쓰기가 원활히 성립되는지 테스트합니다.
func TestPromptsFileIO(t *testing.T) {
	// 기존 prompts.json 파일이 있다면 테스트 정합성을 위해 임시로 지웁니다.
	_ = os.Remove(promptsFilePath)
	defer func() {
		_ = os.Remove(promptsFilePath) // 테스트 종료 후 생성된 파일 자동 삭제 정리
	}()

	// 1. 초기 로딩 테스트 (파일이 없을 때 빈 슬라이스 반환 검증)
	initialList, err := loadPrompts()
	if err != nil {
		t.Fatalf("최초 프롬프트 로딩 에러: %v", err)
	}
	if len(initialList) != 0 {
		t.Errorf("초기 프롬프트 리스트 크기가 0이 아닙니다: %d", len(initialList))
	}

	// 2. 임의의 신규 프롬프트 저장 검증
	p1 := SuperPrompt{Name: "테스트 프롬프트", Content: "원문 지침 내용"}
	err = savePrompts([]SuperPrompt{p1})
	if err != nil {
		t.Fatalf("프롬프트 저장 중 실패: %v", err)
	}

	// 저장된 파일을 파싱하여 읽어오기
	listAfterSave, err := loadPrompts()
	if err != nil {
		t.Fatalf("저장 후 프롬프트 로딩 실패: %v", err)
	}

	if len(listAfterSave) != 1 || listAfterSave[0].Name != p1.Name || listAfterSave[0].Content != p1.Content {
		t.Fatalf("저장된 프롬프트와 로드된 프롬프트가 다릅니다: %v", listAfterSave)
	}

	t.Log("Super Prompt 최초 파일 I/O 저장 및 파싱 테스트 통과 완료.")

	// 3. 동일한 이름으로 덮어쓰기(편집) 처리 검증
	// main.go 에 등록한 덮어쓰기 로직의 시뮬레이션을 구현합니다.
	p2 := SuperPrompt{Name: "테스트 프롬프트", Content: "개정되고 업데이트된 지침 내용"}
	
	// 로드한 뒤 덮어쓴 뒤 다시 세이브
	currentList, err := loadPrompts()
	if err != nil {
		t.Fatalf("수정 전 로드 실패: %v", err)
	}

	foundIdx := -1
	for idx, item := range currentList {
		if item.Name == p2.Name {
			foundIdx = idx
			break
		}
	}

	if foundIdx != -1 {
		currentList[foundIdx].Content = p2.Content
	} else {
		currentList = append(currentList, p2)
	}

	err = savePrompts(currentList)
	if err != nil {
		t.Fatalf("수정된 프롬프트 저장 실패: %v", err)
	}

	// 수정 후 최종 파일 재로드 검증
	finalList, err := loadPrompts()
	if err != nil {
		t.Fatalf("수정 후 재로드 실패: %v", err)
	}

	if len(finalList) != 1 {
		t.Fatalf("수정 후 리스트 크기가 1이 아닙니다: %d", len(finalList))
	}

	if finalList[0].Content != p2.Content {
		t.Errorf("덮어쓰기 편집이 실패했습니다. 실제 내용: %s", finalList[0].Content)
	}

	t.Log("동일 이름 프롬프트 덮어쓰기(수정) 정합성 테스트 통과 완료.")
}
