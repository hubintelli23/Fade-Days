import { useMemo } from 'react';
import { formatRelative, formatShort } from '../lib/date';
import type { ReadyData } from '../store/DataContext';
import type { ID, ISODate } from '../types/models';

type Target = { type: 'memory'; id: ID } | { type: 'album'; id: ID } | { type: 'day'; date: ISODate };

interface Activity {
  key: string;
  at: number;
  icon: string;
  text: string;
  target: Target;
}

/** 추억·로그·앨범의 변화를 시간순으로 모은다 */
export function buildActivities(data: ReadyData, limit = 6): Activity[] {
  const me = data.user.id;
  const nameOf = (id: ID) => data.userById.get(id)?.displayName ?? '멤버';
  const albumTitle = (id: ID) => data.albums.find((a) => a.id === id)?.title ?? '앨범';
  const list: Activity[] = [];

  for (const m of data.memories) {
    if (m.ownerId !== me) continue;
    const edited = m.updatedAt - m.createdAt > 60_000;
    list.push({
      key: `m-${m.id}`,
      at: m.updatedAt,
      icon: '📷',
      text: `‘${m.title}’ 기록을 ${edited ? '수정했어요' : '남겼어요'}`,
      target: { type: 'memory', id: m.id },
    });
  }

  const memoryTitle = new Map(data.memories.map((m) => [m.id, m.title]));
  for (const l of data.links) {
    if (l.addedBy === me) continue;
    list.push({
      key: `l-${l.albumId}-${l.memoryId}`,
      at: l.addedAt,
      icon: '🤝',
      text: `${nameOf(l.addedBy)} 님이 ‘${albumTitle(l.albumId)}’에 ‘${memoryTitle.get(l.memoryId) ?? '기록'}’을 올렸어요`,
      target: { type: 'memory', id: l.memoryId },
    });
  }

  const logsByDate = new Map<ISODate, { count: number; at: number }>();
  for (const log of data.logs) {
    const prev = logsByDate.get(log.date);
    logsByDate.set(log.date, { count: (prev?.count ?? 0) + 1, at: Math.max(prev?.at ?? 0, log.createdAt) });
  }
  for (const [date, { count, at }] of logsByDate) {
    list.push({ key: `g-${date}`, at, icon: '🕰', text: `${formatShort(date)} 시간 로그 ${count}개`, target: { type: 'day', date } });
  }

  for (const a of data.albums) {
    if (a.ownerId === me) {
      list.push({ key: `a-${a.id}`, at: a.createdAt, icon: '▧', text: `‘${a.title}’ 앨범을 만들었어요`, target: { type: 'album', id: a.id } });
    }
  }
  for (const member of data.members) {
    if (member.role === 'owner') continue;
    const text =
      member.userId === me ? `‘${albumTitle(member.albumId)}’ 앨범에 참여했어요` : `${nameOf(member.userId)} 님이 ‘${albumTitle(member.albumId)}’에 참여했어요`;
    list.push({ key: `j-${member.albumId}-${member.userId}`, at: member.joinedAt, icon: '✉', text, target: { type: 'album', id: member.albumId } });
  }

  return list.sort((a, b) => b.at - a.at).slice(0, limit);
}

export function ActivityList({
  data,
  onOpenMemory,
  onOpenAlbum,
  onOpenDay,
}: {
  data: ReadyData;
  onOpenMemory: (id: ID) => void;
  onOpenAlbum: (id: ID) => void;
  onOpenDay: (date: ISODate) => void;
}) {
  const activities = useMemo(() => buildActivities(data), [data]);
  if (activities.length === 0) return <p className="rounded-2xl border border-line bg-paper px-5 py-6 text-center text-sm text-muted">아직 활동이 없어요.</p>;

  const open = (t: Target) => (t.type === 'memory' ? onOpenMemory(t.id) : t.type === 'album' ? onOpenAlbum(t.id) : onOpenDay(t.date));

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
      {activities.map((a) => (
        <li key={a.key}>
          <button type="button" onClick={() => open(a.target)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-soft/40">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-soft text-sm">{a.icon}</span>
            <span className="min-w-0 flex-1 truncate text-[13px]">{a.text}</span>
            <span className="shrink-0 text-[11px] text-muted">{formatRelative(a.at)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
