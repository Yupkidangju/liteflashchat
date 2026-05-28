import { useEffect, useState } from 'react';
import { COMPRESSION_RATIO_STORAGE_KEY } from '../constants';

export function useCompressionRatio(initialRatio: number) {
  const [compressionRatio, setCompressionRatio] = useState<number>(initialRatio);

  useEffect(() => {
    localStorage.setItem(COMPRESSION_RATIO_STORAGE_KEY, String(compressionRatio));
  }, [compressionRatio]);

  return { compressionRatio, setCompressionRatio };
}
