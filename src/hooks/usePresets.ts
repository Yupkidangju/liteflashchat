import { useEffect, useState } from 'react';
import { PRESETS_STORAGE_KEY } from '../constants';
import type { ChatPreset } from '../types';

export function usePresets(initialPresets: ChatPreset[]) {
  const [presets, setPresets] = useState<ChatPreset[]>(initialPresets);
  const [presetNameInput, setPresetNameInput] = useState<string>('');

  useEffect(() => {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  }, [presets]);

  return {
    presets,
    setPresets,
    presetNameInput,
    setPresetNameInput
  };
}
