// [v1.4.0] 파일명, 다운로드, Markdown export 생성 유틸리티입니다.
// 데이터 관리 UI와 순수 변환 로직을 분리합니다.

import type { ChatSession } from '../types';

export function makeTimestampForFile(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function buildMarkdownExport(sessionsToExport: ChatSession[]): string {
  const lines: string[] = [
    '# LiteFlashChat 대화 내보내기',
    '',
    `생성 시각: ${new Date().toISOString()}`,
    ''
  ];

  sessionsToExport.forEach((session, index) => {
    lines.push(`## ${index + 1}. ${session.title}`);
    lines.push('');
    lines.push(`- Provider: ${session.provider}`);
    lines.push(`- Model: ${session.model || '미선택'}`);
    lines.push(`- Super Prompt: ${session.activeSystemPromptName || '미적용'}`);
    lines.push('');

    session.messages.forEach(message => {
      lines.push(`### ${message.role.toUpperCase()} · ${message.timestamp}`);
      if (message.status && message.status !== 'complete') {
        lines.push(`상태: ${message.status}`);
      }
      lines.push('');
      lines.push(message.content || '(내용 없음)');
      if (message.attachments?.length) {
        lines.push('');
        lines.push(`첨부: ${message.attachments.map(attachment => attachment.name).join(', ')}`);
      }
      lines.push('');
    });
  });

  return `${lines.join('\n')}\n`;
}
