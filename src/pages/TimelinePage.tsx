import { useMemo, useState } from 'react';
import { LogTimeline } from '../components/LogTimeline';
import { MemoryCard, MemoryGrid } from '../components/MemoryCard';
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from '../components/icons';
import { Button, Chip, EmptyState, PageTitle } from '../components/ui';
import { addDays, formatLong, formatShort, monthOf, todayISO, yearOf } from '../lib/date';
import { updateSettings, useSettings } from '../lib/settings';
import { useData } from '../store/DataContext';
import type { ID, ISODate, LogEntry, Memory } from '../types/models';

export type TimelineMode = 'all' | 'day';

export interface TimelineState {
  mode: TimelineMode;
  date: ISODate;
  mineOnly: boolean;
}

export function TimelinePage({
  state,
  onChange,
  onOpenMemory,
  onCreateMemory,
  onOpenLog,
}: {
  state: TimelineState;
  onChange: (patch: Partial<TimelineState>) => void;
  onOpenMemory: (id: ID) => void;
  onCreateMemory: (date?: ISODate) => void;
  onOpenLog: (entry?: LogEntry, date?: ISODate) => void;
}) {
  return (
    <>
      <PageTitle eyebrow="Your days, in order" title="타임라인" sub="시간을 따라 다시 만나는 기록." />
      <div className="mb-6 inline-flex rounded-full border border-line bg-paper p-1">
        {(
          [
            ['all', '전체 추억'],
            ['day', '하루 보기'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange({ mode: id })}
            className={`rounded-full px-5 py-2 text-[13px] transition-colors ${state.mode === id ? 'bg-soft text-ink' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {state.mode === 'all' ? (
        <AllMemories
          mineOnly={state.mineOnly}
          onMineOnlyChange={(mineOnly) => onChange({ mineOnly })}
          onOpenDay={(date) => onChange({ mode: 'day', date })}
          onOpenMemory={onOpenMemory}
          onCreateMemory={() => onCreateMemory()}
        />
      ) : (
        <DayView
          date={state.date}
          onDateChange={(date) => onChange({ date })}
          onOpenMemory={onOpenMemory}
          onCreateMemory={onCreateMemory}
          onOpenLog={onOpenLog}
        />
      )}
    </>
  );
}

/* ---------------- 전체 추억: 연도 → 월 ---------------- */

function AllMemories({
  mineOnly,
  onMineOnlyChange,
  onOpenDay,
  onOpenMemory,
  onCreateMemory,
}: {
  mineOnly: boolean;
  onMineOnlyChange: (v: boolean) => void;
  onOpenDay: (date: ISODate) => void;
  onOpenMemory: (id: ID) => void;
  onCreateMemory: () => void;
}) {
  const data = useData();
  const { timelineOrder } = useSettings();
  const [year, setYear] = useState<number | 'all'>('all');
  const [month, setMonth] = useState<number | 'all'>('all');
  const newestFirst = timelineOrder === 'newest';

  const hasShared = data.memories.some((m) => m.ownerId !== data.user.id);
  const source = useMemo(
    () => data.memories.filter((m) => !mineOnly || m.ownerId === data.user.id),
    [data.memories, data.user.id, mineOnly],
  );
  const years = useMemo(() => [...new Set(source.map((m) => yearOf(m.date)))], [source]);
  const months = useMemo(
    () => (year === 'all' ? [] : [...new Set(source.filter((m) => yearOf(m.date) === year).map((m) => monthOf(m.date)))].sort((a, b) => a - b)),
    [source, year],
  );

  const groups = useMemo(() => {
    const list = source.filter((m) => (year === 'all' || yearOf(m.date) === year) && (month === 'all' || monthOf(m.date) === month));
    if (!newestFirst) list.reverse();
    const result: { year: number; months: { month: number; items: Memory[] }[] }[] = [];
    for (const m of list) {
      const y = yearOf(m.date);
      const mo = monthOf(m.date);
      let yg = result.at(-1);
      if (!yg || yg.year !== y) result.push((yg = { year: y, months: [] }));
      let mg = yg.months.at(-1);
      if (!mg || mg.month !== mo) yg.months.push((mg = { month: mo, items: [] }));
      mg.items.push(m);
    }
    return result;
  }, [source, year, month, newestFirst]);

  if (data.memories.length === 0) {
    return (
      <EmptyState
        action={
          <Button onClick={onCreateMemory}>
            <PlusIcon size={16} /> 기록 추가
          </Button>
        }
      >
        아직 남긴 기록이 없어요.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <div className="scrollbar-none -mx-4 flex flex-1 gap-2 overflow-x-auto px-4">
          <Chip
            active={year === 'all'}
            onClick={() => {
              setYear('all');
              setMonth('all');
            }}
          >
            전체
          </Chip>
          {years.map((y) => (
            <Chip
              key={y}
              active={year === y}
              onClick={() => {
                setYear(y);
                setMonth('all');
              }}
            >
              {y}
            </Chip>
          ))}
        </div>
        <button
          type="button"
          onClick={() => updateSettings({ timelineOrder: newestFirst ? 'oldest' : 'newest' })}
          className="shrink-0 text-[13px] text-accent"
        >
          {newestFirst ? '최신순' : '오래된순'} ⇅
        </button>
      </div>
      {months.length > 0 && (
        <div className="scrollbar-none -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
          <Chip active={month === 'all'} onClick={() => setMonth('all')}>
            {year}년 전체
          </Chip>
          {months.map((m) => (
            <Chip key={m} active={month === m} onClick={() => setMonth(m)}>
              {m}월
            </Chip>
          ))}
        </div>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[13px]">
        {hasShared && (
          <label className="flex items-center gap-1.5 text-muted">
            <input type="checkbox" checked={mineOnly} onChange={(e) => onMineOnlyChange(e.target.checked)} className="accent-[#9a7658]" />
            내가 쓴 기록만
          </label>
        )}
        <label className="relative ml-auto text-accent">
          날짜로 찾기
          <input
            type="date"
            max={todayISO()}
            onChange={(e) => e.target.value && onOpenDay(e.target.value)}
            className="absolute inset-0 opacity-0"
            aria-label="날짜로 찾기"
          />
        </label>
      </div>

      {groups.length === 0 && <EmptyState>조건에 맞는 기록이 없어요.</EmptyState>}
      {groups.map((yg) => (
        <section key={yg.year}>
          <h2 className="sticky top-0 z-10 -mx-4 mt-6 bg-bg/90 px-4 py-2 font-serif text-[28px] font-normal backdrop-blur-sm">{yg.year}</h2>
          {yg.months.map((mg) => (
            <div key={mg.month} className="mt-3 mb-6">
              <h3 className="mb-3 flex items-center gap-3 text-[13px] text-muted">
                {mg.month}월<span className="h-px flex-1 bg-line" />
                <span className="text-[11px]">{mg.items.length}개</span>
              </h3>
              <MemoryGrid>
                {mg.items.map((m) => (
                  <MemoryCard
                    key={m.id}
                    memory={m}
                    onOpen={onOpenMemory}
                    showNote
                    ownerName={m.ownerId !== data.user.id ? data.userById.get(m.ownerId)?.displayName : undefined}
                  />
                ))}
              </MemoryGrid>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

/* ---------------- 하루 보기: 그날의 추억 + 시간 로그 ---------------- */

function DayView({
  date,
  onDateChange,
  onOpenMemory,
  onCreateMemory,
  onOpenLog,
}: {
  date: ISODate;
  onDateChange: (date: ISODate) => void;
  onOpenMemory: (id: ID) => void;
  onCreateMemory: (date?: ISODate) => void;
  onOpenLog: (entry?: LogEntry, date?: ISODate) => void;
}) {
  const data = useData();
  const today = todayISO();
  const memories = data.memories.filter((m) => m.date === date);
  const logs = data.logs.filter((l) => l.date === date);

  const recordedDays = useMemo(() => {
    const counts = new Map<ISODate, number>();
    for (const item of [...data.memories, ...data.logs]) counts.set(item.date, (counts.get(item.date) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 21);
  }, [data.memories, data.logs]);

  return (
    <>
      <div className="flex items-center justify-between rounded-2xl border border-line bg-paper px-2 py-2">
        <button type="button" aria-label="이전 날" onClick={() => onDateChange(addDays(date, -1))} className="rounded-full p-2.5 text-muted hover:bg-soft">
          <ArrowLeftIcon size={18} />
        </button>
        <label className="relative text-center">
          <div className="font-serif text-lg">{date === today ? '오늘' : formatShort(date)}</div>
          <div className="text-[11px] text-muted">{formatLong(date)}</div>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            className="absolute inset-0 opacity-0"
            aria-label="날짜 선택"
          />
        </label>
        <button
          type="button"
          aria-label="다음 날"
          onClick={() => onDateChange(addDays(date, 1))}
          disabled={date >= today}
          className="rounded-full p-2.5 text-muted hover:bg-soft disabled:opacity-30"
        >
          <ArrowRightIcon size={18} />
        </button>
      </div>

      <div className="mt-6 mb-3 flex items-center justify-between">
        <h3 className="font-serif text-lg">이날의 추억</h3>
        <button type="button" className="text-[13px] text-accent" onClick={() => onCreateMemory(date)}>
          + 추억 추가
        </button>
      </div>
      {memories.length > 0 ? (
        <MemoryGrid>
          {memories.map((m) => (
            <MemoryCard key={m.id} memory={m} onOpen={onOpenMemory} ownerName={m.ownerId !== data.user.id ? data.userById.get(m.ownerId)?.displayName : undefined} />
          ))}
        </MemoryGrid>
      ) : (
        <p className="rounded-2xl border border-dashed border-line bg-paper py-5 text-center text-sm text-muted">이날 남긴 추억이 없어요.</p>
      )}

      <h3 className="mt-8 mb-3 font-serif text-lg">시간 로그</h3>
      <div className="rounded-2xl border border-line bg-paper p-4">
        {logs.length > 0 ? (
          <LogTimeline logs={logs} onOpen={(entry) => onOpenLog(entry)} />
        ) : (
          <p className="py-4 text-center text-sm text-muted">이날 남긴 로그가 없어요.</p>
        )}
        <button
          type="button"
          onClick={() => onOpenLog(undefined, date)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-[13px] text-muted hover:bg-soft/40"
        >
          <PlusIcon size={16} /> 이날에 로그 추가
        </button>
      </div>

      {recordedDays.length > 0 && (
        <>
          <h3 className="mt-8 mb-3 text-[13px] text-muted">기록이 있는 날</h3>
          <div className="flex flex-wrap gap-2">
            {recordedDays.map(([d, count]) => (
              <Chip key={d} active={d === date} onClick={() => onDateChange(d)}>
                {d === today ? '오늘' : formatShort(d)}
                {yearOf(d) !== yearOf(today) && ` ${yearOf(d)}`} · {count}
              </Chip>
            ))}
          </div>
        </>
      )}
    </>
  );
}
