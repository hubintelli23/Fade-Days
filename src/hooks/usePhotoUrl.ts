import { useEffect, useState } from 'react';
import { getPhotoUrl } from '../lib/photoUrls';
import type { PhotoRef } from '../types/models';

export function usePhotoUrl(photo: PhotoRef | null | undefined): string | null {
  const [state, setState] = useState<{ id: string; url: string | null } | null>(null);
  const id = photo?.id;

  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    getPhotoUrl(photo).then((url) => {
      if (!cancelled) setState({ id: photo.id, url });
    });
    return () => {
      cancelled = true;
    };
    // 같은 사진(id)이면 다시 읽지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return id && state?.id === id ? state.url : null;
}
