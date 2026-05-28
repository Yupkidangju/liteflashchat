import type { ReactNode } from 'react';

export function renderMessageContent(text: string): ReactNode {
  if (!text) return '';
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```')) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const language = match ? match[1] : 'code';
      const code = match ? match[2] : part.slice(3, -3);

      return (
        <div key={index} style={{ position: 'relative' }}>
          <span style={{ fontSize: '0.65rem', color: '#9ca3af', position: 'absolute', top: '4px', right: '12px' }}>
            {language}
          </span>
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    const lines = part.split('\n');
    return lines.map((line, lineIndex) => (
      <span key={`${index}-${lineIndex}`}>
        {line}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    ));
  });
}
