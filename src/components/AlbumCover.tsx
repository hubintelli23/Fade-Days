import type { Memory } from '../types/models';
import { PhotoImage } from './PhotoImage';

/** 앨범 안 추억들의 대표 사진 3장으로 표지를 만든다 */
export function AlbumCover({ albumId, memories, className = '' }: { albumId: string; memories: Memory[]; className?: string }) {
  const covers = memories.flatMap((m) => (m.photos[0] ? [m.photos[0]] : [])).slice(0, 3);
  return (
    <div className={`grid grid-cols-[2fr_1fr] grid-rows-2 gap-1 overflow-hidden rounded-xl ${className}`}>
      <PhotoImage photo={covers[0]} seed={albumId} className="row-span-2" />
      <PhotoImage photo={covers[1]} seed={`${albumId}1`} />
      <PhotoImage photo={covers[2]} seed={`${albumId}2`} />
    </div>
  );
}
