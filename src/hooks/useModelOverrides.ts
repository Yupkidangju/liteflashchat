import { useEffect, useState } from 'react';
import { MODEL_OVERRIDES_STORAGE_KEY } from '../constants';
import type { ModelOverrideMap } from '../utils/modelMetadata';

export function useModelOverrides(initialOverrides: ModelOverrideMap) {
  const [modelOverrides, setModelOverrides] = useState<ModelOverrideMap>(initialOverrides);

  useEffect(() => {
    localStorage.setItem(MODEL_OVERRIDES_STORAGE_KEY, JSON.stringify(modelOverrides));
  }, [modelOverrides]);

  return { modelOverrides, setModelOverrides };
}
