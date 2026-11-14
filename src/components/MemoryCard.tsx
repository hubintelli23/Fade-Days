import type { ReactNode } from 'react';
import { formatDot } from '../lib/date';
import type { Memory } from '../types/models';
import { PhotoImage } from './PhotoImage';

export function MemoryCard({
  memory,
  onOpen,
  showNote = false,
  ownerName,
}: {
  memory: Memory;
  onOpen: (id: string) => void;
  showNote?: boolean;
  /** 공유 앨범에서 다른 사람이 올린 추억일 때 이름 표시 */
  ownerName?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(memory.id)}
      className="group overflow-hidden rounded-2xl border border-line bg-paper text-left transition-shadow hover:shadow-[0_6px_24px_#40332214]"
    >
      <div className="relative">
        <PhotoImage photo={memory.photos[0]} seed={memory.id} alt={memory.title} className="aspect-[4/3]" />
        {memory.photos.length > 1 && (
          <span className="absolute top-2 right-2 rounded-full bg-black/35 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
            {memory.photos.length}장
          </span>
        )}
      </div>
      <div className="p-3.5">
        <strong className="line-clamp-1 text-sm font-semibold">{memory.title}</strong>
        <small className="mt-1.5 block text-[11px] text-muted">
          {formatDot(memory.date)}
          {ownerName && ` · ${ownerName}`}
        </small>
        {showNote && memory.note && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{memory.note}</p>}
      </div>
    </button>
  );
}

export function MemoryGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4">{children}</div>;
}
