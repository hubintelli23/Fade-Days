import { usePhotoUrl } from '../hooks/usePhotoUrl';
import type { PhotoRef } from '../types/models';

const PLACEHOLDERS = ['placeholder-1', 'placeholder-2', 'placeholder-3'];

export function placeholderClass(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PLACEHOLDERS[Math.abs(hash) % PLACEHOLDERS.length];
}

/** 저장된 사진을 보여 주고, 사진이 없으면 따뜻한 그라데이션을 보여 준다 */
export function PhotoImage({
  photo,
  seed,
  alt = '',
  className = '',
  fit = 'cover',
}: {
  photo: PhotoRef | null | undefined;
  seed: string;
  alt?: string;
  className?: string;
  fit?: 'cover' | 'contain';
}) {
  const url = usePhotoUrl(photo);
  const background = url ? (fit === 'contain' ? 'bg-[#1e1b18]' : 'bg-soft') : photo ? 'animate-pulse bg-soft' : placeholderClass(seed);
  return (
    <div className={`relative overflow-hidden ${background} ${className}`}>
      {url && (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`}
        />
      )}
    </div>
  );
}
