import { formatTime } from '../lib/date';
import { logTagInfo } from '../lib/logTags';
import type { LogEntry } from '../types/models';
import { PhotoImage } from './PhotoImage';

/** 하루의 로그를 세로 타임라인으로 보여 준다 (시간 오름차순). 사진이 있으면 크게. */
export function LogTimeline({ logs, onOpen, compact = false }: { logs: LogEntry[]; onOpen: (entry: LogEntry) => void; compact?: boolean }) {
  return (
    <ol className="relative ml-[3.25rem] border-l border-line">
      {logs.map((entry) => {
        const tag = logTagInfo(entry.tag);
        const [hh, mm] = entry.time.split(':');
        const photos = compact ? entry.photos.slice(0, 1) : entry.photos;
        return (
          <li key={entry.id} className="relative pb-2 last:pb-0">
            <span className="absolute top-3 -left-[3.25rem] w-11 text-right text-[11px] text-muted tabular-nums">
              {formatTime(entry.time).replace(/^(오전|오후) /, '')}
              <span className="block text-[10px] opacity-70">{Number(hh) < 12 ? 'AM' : 'PM'}</span>
              <span className="sr-only">{`${hh}시 ${mm}분`}</span>
            </span>
            <span className="absolute top-4 -left-[5px] size-[9px] rounded-full border-2 border-paper bg-accent" />
            <button
              type="button"
              onClick={() => onOpen(entry)}
              className="ml-4 w-[calc(100%-1rem)] rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-soft/60"
            >
              {photos.length > 0 && (
                <div
                  className={`mb-2 grid gap-1 overflow-hidden rounded-xl ${
                    photos.length === 1 ? 'grid-cols-1' : photos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                  }`}
                >
                  {photos.map((photo, i) => (
                    <PhotoImage
                      key={photo.id}
                      photo={photo}
                      seed={photo.id}
                      className={photos.length === 1 ? (compact ? 'aspect-[16/9]' : 'aspect-[4/3]') : photos.length === 4 && i === 0 ? 'col-span-3 aspect-[16/9]' : 'aspect-square'}
                    />
                  ))}
                </div>
              )}
              {(entry.text || tag) && (
                <span className="block text-[14px] leading-relaxed">
                  {tag && <span className="mr-1.5">{tag.icon}</span>}
                  {entry.text}
                </span>
              )}
              {compact && entry.photos.length > 1 && <span className="mt-1 block text-[11px] text-muted">사진 {entry.photos.length}장</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
