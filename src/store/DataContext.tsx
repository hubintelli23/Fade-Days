import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Repository, RepositoryMode, Snapshot } from '../db/types';
import { errorMessage } from '../lib/errors';
import { releaseUnusedPhotos, setPhotoSource } from '../lib/photoUrls';
import type {
  Album,
  AlbumInput,
  AlbumInvite,
  AlbumMember,
  AlbumRole,
  ID,
  InviteInput,
  LogInput,
  Memory,
  MemoryInput,
  User,
} from '../types/models';

interface Derived {
  roleByAlbum: Map<ID, AlbumRole>;
  albumIdsByMemory: Map<ID, ID[]>;
  memoriesByAlbum: Map<ID, Memory[]>;
  membersByAlbum: Map<ID, AlbumMember[]>;
  invitesByAlbum: Map<ID, AlbumInvite[]>;
  userById: Map<ID, User>;
}

interface Actions {
  saveMemory(input: MemoryInput, id?: ID): Promise<Memory>;
  deleteMemory(id: ID): Promise<void>;
  saveAlbum(input: AlbumInput, id?: ID): Promise<Album>;
  deleteAlbum(id: ID): Promise<void>;
  removeFromAlbum(albumId: ID, memoryId: ID): Promise<void>;
  createInvite(albumId: ID, input: InviteInput): Promise<AlbumInvite>;
  revokeInvite(id: ID): Promise<void>;
  acceptInvite(code: string): Promise<ID>;
  changeMemberRole(albumId: ID, userId: ID, role: Exclude<AlbumRole, 'owner'>): Promise<void>;
  removeMember(albumId: ID, userId: ID): Promise<void>;
  saveLog(input: LogInput, id?: ID): Promise<void>;
  deleteLog(id: ID): Promise<void>;
  updateDisplayName(name: string): Promise<void>;
}

type DataValue =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | ({ status: 'ready'; mode: RepositoryMode; repository: Repository; version: number } & Snapshot & Derived & Actions);

interface ToastValue {
  message: string | null;
  notify: (message: string) => void;
}

const DataContext = createContext<DataValue | null>(null);
const ToastContext = createContext<ToastValue | null>(null);

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function derive(s: Snapshot): Derived {
  const memoryById = new Map(s.memories.map((m) => [m.id, m]));
  const order = new Map(s.memories.map((m, i) => [m.id, i]));
  const memoriesByAlbum = new Map<ID, Memory[]>();
  const albumIdsByMemory = new Map<ID, ID[]>();
  for (const link of s.links) {
    const memory = memoryById.get(link.memoryId);
    if (!memory) continue;
    memoriesByAlbum.set(link.albumId, [...(memoriesByAlbum.get(link.albumId) ?? []), memory]);
    albumIdsByMemory.set(link.memoryId, [...(albumIdsByMemory.get(link.memoryId) ?? []), link.albumId]);
  }
  // s.memories가 날짜 내림차순이므로 그 순서를 따른다
  for (const list of memoriesByAlbum.values()) list.sort((a, b) => order.get(a.id)! - order.get(b.id)!);

  const roleOrder: Record<AlbumRole, number> = { owner: 0, editor: 1, viewer: 2 };
  const membersByAlbum = groupBy(s.members, (m) => m.albumId);
  for (const list of membersByAlbum.values()) list.sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.joinedAt - b.joinedAt);

  return {
    roleByAlbum: new Map(s.members.filter((m) => m.userId === s.user.id).map((m) => [m.albumId, m.role])),
    albumIdsByMemory,
    memoriesByAlbum,
    membersByAlbum,
    invitesByAlbum: groupBy(s.invites, (i) => i.albumId),
    userById: new Map(s.users.map((u) => [u.id, u])),
  };
}

export function DataProvider({ repository, children }: { repository: Repository; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // 저장소 구독: 처음 불러오기 + 이후 모든 변경(다른 기기·다른 탭 포함)
  useEffect(() => {
    setPhotoSource(repository);
    setSnapshot(null);
    const unsubscribe = repository.subscribe(
      (next) => {
        setSnapshot(next);
        setVersion((v) => v + 1);
        setError(null);
        releaseUnusedPhotos(new Set([...next.memories, ...next.logs].flatMap((item) => item.photos.map((p) => p.id))));
      },
      (e) => {
        console.error(e);
        setError(errorMessage(e, '기록을 불러오지 못했어요.'));
      },
    );
    return unsubscribe;
  }, [repository]);

  // 실패하면 토스트로 알려 주고 에러를 다시 던져 화면(폼)이 저장 상태를 풀 수 있게 한다
  const run = useCallback(
    async <T,>(work: () => Promise<T>, success?: string): Promise<T> => {
      try {
        const result = await work();
        if (success) notify(success);
        return result;
      } catch (e) {
        console.error(e);
        notify(errorMessage(e));
        throw e;
      }
    },
    [notify],
  );

  const actions = useMemo<Actions>(
    () => ({
      saveMemory: (input, id) => run(() => repository.saveMemory(input, id), id ? '기록을 수정했어요.' : '새로운 기록을 남겼어요.'),
      deleteMemory: (id) => run(() => repository.deleteMemory(id), '기록을 삭제했어요.'),
      saveAlbum: (input, id) => run(() => repository.saveAlbum(input, id), id ? '앨범을 수정했어요.' : '앨범을 만들었어요.'),
      deleteAlbum: (id) => run(() => repository.deleteAlbum(id), '앨범을 삭제했어요.'),
      removeFromAlbum: (albumId, memoryId) => run(() => repository.removeFromAlbum(albumId, memoryId), '앨범에서 뺐어요.'),
      createInvite: (albumId, input) => run(() => repository.createInvite(albumId, input), '초대 코드를 만들었어요.'),
      revokeInvite: (id) => run(() => repository.revokeInvite(id), '초대를 취소했어요.'),
      acceptInvite: (code) => run(() => repository.acceptInvite(code), '앨범에 참여했어요.'),
      changeMemberRole: (albumId, userId, role) => run(() => repository.changeMemberRole(albumId, userId, role), '역할을 바꿨어요.'),
      removeMember: (albumId, userId) => run(() => repository.removeMember(albumId, userId)),
      saveLog: (input, id) =>
        run(async () => {
          await repository.saveLog(input, id);
        }, id ? '로그를 수정했어요.' : undefined),
      deleteLog: (id) => run(() => repository.deleteLog(id), '로그를 지웠어요.'),
      updateDisplayName: (name) => run(() => repository.updateDisplayName(name), '이름을 바꿨어요.'),
    }),
    [run, repository],
  );

  const derived = useMemo(() => (snapshot ? derive(snapshot) : null), [snapshot]);

  const value = useMemo<DataValue>(() => {
    if (error && !snapshot) return { status: 'error', error };
    if (!snapshot || !derived) return { status: 'loading' };
    return { status: 'ready', mode: repository.mode, repository, version, ...snapshot, ...derived, ...actions };
  }, [error, snapshot, derived, actions, version, repository]);

  const toastValue = useMemo(() => ({ message: toast, notify }), [toast, notify]);

  return (
    <DataContext.Provider value={value}>
      <ToastContext.Provider value={toastValue}>{children}</ToastContext.Provider>
    </DataContext.Provider>
  );
}

export function useDataStatus(): DataValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('DataProvider 안에서 사용해야 해요.');
  return value;
}

export type ReadyData = Extract<DataValue, { status: 'ready' }>;

/** 데이터가 준비된 뒤에 그려지는 화면에서 사용 */
export function useData(): ReadyData {
  const value = useDataStatus();
  if (value.status !== 'ready') throw new Error('데이터가 아직 준비되지 않았어요.');
  return value;
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('DataProvider 안에서 사용해야 해요.');
  return value;
}
