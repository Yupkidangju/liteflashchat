import { useState } from 'react';
import type { InspectorSnapshot } from '../types';

export function useInspector() {
  const [inspectorSnapshot, setInspectorSnapshot] = useState<InspectorSnapshot | null>(null);

  const copyInspector = async (mode: 'request' | 'response' | 'all') => {
    if (!inspectorSnapshot) return;
    const payload = mode === 'request'
      ? inspectorSnapshot.sanitizedRequest
      : mode === 'response'
        ? { status: inspectorSnapshot.responseStatus, preview: inspectorSnapshot.responsePreview, error: inspectorSnapshot.errorMessage }
        : inspectorSnapshot;
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  return {
    inspectorSnapshot,
    setInspectorSnapshot,
    copyInspector
  };
}
