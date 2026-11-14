import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ActivityList } from '../components/ActivityList';
import { AlbumCover } from '../components/AlbumCover';
import { LogTimeline } from '../components/LogTimeline';
import { MemoryCard, MemoryGrid } from '../components/MemoryCard';
import { PhotoImage } from '../components/PhotoImage';
import { AlbumIcon, CameraIcon, ClockIcon, PlusIcon, TimelineIcon, UsersIcon } from '../components/icons';
import { Button, EmptyState, PageTitle, SectionHead } from '../components/ui';
import { formatShort, isSameDayOfYear, todayISO, yearOf } from '../lib/date';
import { useSettings } from '../lib/settings';
import { useData } from '../store/DataContext';
import type { ID, ISODate, LogEntry, Memory } from '../types/models';

/** 오늘의 추억: N년 전 오늘 → 없으면 날짜마다 바뀌는 사진 있는 기록 → 없으면 최근 기록 */
function pickFeatured(memories: Memory[], today: string): { memory: Memory; label: string } | null {
  if (memories.length === 0) return null;
  const onThisDay = memories.find((m) => isSameDayOfYear(m.date, today) && m.date < today);
  if (onThisDay) return { memory: onThisDay, label: `${yearOf(today) - yearOf(onThisDay.date)}년 전 오늘` };

  const withPhoto = memories.filter((m) => m.photos.length > 0);
  if (withPhoto.length > 1) {
    const seed = Number(today.replaceAll('-', ''));
    return { memory: withPhoto[seed % withPhoto.length], label: '다시 꺼내 본 기록' };
  }
  return { memory: withPhoto[0] ?? memories[0], label: '최근의 기록' };
}

function SeeAll({ onClick, children = '모두 보기 →' }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" className="text-[13px] text-accent" onClick={onClick}>
      {children}
    </button>
  );
}

export function HomePage({
  onOpenMemory,
  onCreateMemory,
  onOpenLog,
  onOpenDay,
  onOpenTimeline,
  onOpenAlbums,
  onOpenAlbum,
}: {
  onOpenMemory: (id: ID) => void;
  onCreateMemory: () => void;
  onOpenLog: (entry?: LogEntry) => void;
  onOpenDay: (date: ISODate) => void;
  onOpenTimeline: () => void;
  onOpenAlbums: () => void;
  onOpenAlbum: (id: ID) => void;
}) {
  const data = useData();
  const settings = useSettings();
  const today = todayISO();
  const featured = useMemo(() => pickFeatured(data.memories, today), [data.memories, today]);
  const todayLogs = data.logs.filter((l) => l.date === today);
  const recent = data.memories.slice(0, 6);

  const quick = [
    { label: '추억 남기기', Icon: CameraIcon, onClick: onCreateMemory },
    { label: '지금 로그', Icon: ClockIcon, onClick: () => onOpenLog() },
    { label: '타임라인', Icon: TimelineIcon, onClick: onOpenTimeline },
    { label: '앨범', Icon: AlbumIcon, onClick: onOpenAlbums },
  ];

  return (
    <>
      <PageTitle eyebrow="A little moment, today" title={`${data.user.displayName}의 오늘`} sub="평범한 하루도 기록하면 오래도록 남으니까." />

      {/* 바로가기 */}
      <div className="mb-6 grid grid-cols-4 gap-2">
        {quick.map(({ label, Icon, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-paper py-3.5 text-[12px] hover:bg-soft/40"
          >
            <span className="grid size-9 place-items-center rounded-full bg-soft text-accent">
              <Icon size={18} />
            </span>
            {label}
          </button>
        ))}
      </div>

      {/* 오늘의 추억 */}
      {featured ? (
        <button
          type="button"
          onClick={() => onOpenMemory(featured.memory.id)}
          className="grid w-full overflow-hidden rounded-3xl border border-line bg-paper text-left sm:grid-cols-[1.1fr_.9fr]"
        >
          <PhotoImage photo={featured.memory.photos[0]} seed={featured.memory.id} className="aspect-[16/10] sm:aspect-auto sm:min-h-64" />
          <div className="flex flex-col justify-center p-6 sm:p-8">
            <div className="eyebrow">{featured.label}</div>
            <h2 className="mt-3 mb-2 font-serif text-[26px] leading-snug font-normal">{featured.memory.title}</h2>
            <p className="text-xs text-muted">{formatShort(featured.memory.date)}</p>
            {featured.memory.note && <p className="mt-3 line-clamp-3 text-sm leading-[1.8] text-muted">{featured.memory.note}</p>}
          </div>
        </button>
      ) : (
        <div className="grid overflow-hidden rounded-3xl border border-line bg-paper sm:grid-cols-[1.1fr_.9fr]">
          <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(135deg,#b7a58d,#e4d5bd_48%,#7e8276)] sm:aspect-auto sm:min-h-64">
            <div className="absolute top-[18%] right-[18%] size-24 rounded-full bg-[#f6e8c6] opacity-90 blur-[1px]" />
            <div className="absolute -inset-x-[10%] -bottom-[7%] h-[45%] bg-[linear-gradient(160deg,#59675f,#899080_55%,#c5b59d)] [clip-path:polygon(0_38%,22%_12%,43%_34%,66%_4%,100%_32%,100%_100%,0_100%)]" />
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-8">
            <div className="eyebrow">Memory of the day</div>
            <h2 className="mt-3 mb-3 font-serif text-[26px] font-normal">첫 번째 순간을 남겨 볼까요?</h2>
            <p className="text-sm leading-[1.8] text-muted">사진 한 장과 짧은 메모면 충분해요.</p>
            <div className="mt-5">
              <Button onClick={onCreateMemory}>
                <PlusIcon size={16} /> 첫 기록 남기기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 오늘의 로그 */}
      {settings.showTodayLogOnHome && (
        <>
          <SectionHead title="오늘의 로그" action={todayLogs.length > 0 && <SeeAll onClick={() => onOpenDay(today)}>하루 보기 →</SeeAll>} />
          <div className="rounded-2xl border border-line bg-paper p-4">
            {todayLogs.length > 0 ? (
              <LogTimeline logs={todayLogs} onOpen={onOpenLog} compact />
            ) : (
              <p className="py-3 text-center text-sm text-muted">지금 이 순간을 사진 한 장과 함께 남겨 보세요.</p>
            )}
            <button
              type="button"
              onClick={() => onOpenLog()}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-[13px] text-muted hover:bg-soft/40"
            >
              <ClockIcon size={16} /> 지금 남기기
            </button>
          </div>
        </>
      )}

      {/* 최근 기록 */}
      <SectionHead title="최근 기록" action={data.memories.length > 0 && <SeeAll onClick={onOpenTimeline} />} />
      {recent.length > 0 ? (
        <MemoryGrid>
          {recent.map((m) => (
            <MemoryCard
              key={m.id}
              memory={m}
              onOpen={onOpenMemory}
              ownerName={m.ownerId !== data.user.id ? data.userById.get(m.ownerId)?.displayName : undefined}
            />
          ))}
        </MemoryGrid>
      ) : (
        <EmptyState>아직 남긴 기록이 없어요.</EmptyState>
      )}

      {/* 앨범 요약 */}
      <SectionHead title="앨범" action={data.albums.length > 0 && <SeeAll onClick={onOpenAlbums} />} />
      {data.albums.length > 0 ? (
        <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-7 sm:px-7">
          {data.albums.slice(0, 8).map((album) => {
            const memories = data.memoriesByAlbum.get(album.id) ?? [];
            const members = data.membersByAlbum.get(album.id)?.length ?? 1;
            return (
              <button
                key={album.id}
                type="button"
                onClick={() => onOpenAlbum(album.id)}
                className="w-40 shrink-0 rounded-2xl border border-line bg-paper p-2.5 text-left sm:w-48"
              >
                <AlbumCover albumId={album.id} memories={memories} className="aspect-[4/3]" />
                <strong className="mt-2.5 block truncate px-1 text-[13px] font-semibold">{album.title}</strong>
                <span className="flex items-center gap-1 px-1 text-[11px] text-muted">
                  기록 {memories.length}
                  {members > 1 && (
                    <>
                      {' · '}
                      <UsersIcon size={11} /> {members}
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState action={<Button variant="secondary" onClick={onOpenAlbums}>앨범 만들기</Button>}>
          주제별로 추억을 모으고, 소중한 사람과 함께 채워 보세요.
        </EmptyState>
      )}

      {/* 최근 활동 */}
      {settings.showActivityOnHome && (
        <>
          <SectionHead title="최근 활동" />
          <ActivityList data={data} onOpenMemory={onOpenMemory} onOpenAlbum={onOpenAlbum} onOpenDay={onOpenDay} />
        </>
      )}
    </>
  );
}
