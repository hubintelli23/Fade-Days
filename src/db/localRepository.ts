/**
 * 로컬 모드 저장소: 로그인 없이 이 브라우저의 IndexedDB에 저장한다.
 * Firebase 설정이 없을 때 사용되고, 권한 규칙은 Firebase 모드와 똑같이 적용한다.
 */

import { LOCAL_USER_ID } from '../lib/constants';
import { createId, createInviteCode, normalizeInviteCode } from '../lib/id';
import { canAddToAlbum, canManageAlbum, canManageMembers, canRemoveFromAlbum } from '../lib/permissions';
import type {
  Album,
  AlbumInvite,
  AlbumMember,
  AlbumMemory,
  AlbumRole,
  ID,
  LogEntry,
  Memory,
  PhotoDraft,
  PhotoRef,
  User,
} from '../types/models';
import { STORE, getDB, request, transaction } from './database';
import type { LocalPhoto } from './database';
import { assertInviteUsable, byDateDesc, inviteStatus, logOrder, validateLogInput } from './types';
import type { Repository, Snapshot } from './types';

const userId = LOCAL_USER_ID;

async function getAll<T>(store: string): Promise<T[]> {
  const db = await getDB();
  return request(db.transaction(store).objectStore(store).getAll() as IDBRequest<T[]>);
}

async function ensureUser(): Promise<User> {
  return transaction([STORE.users], 'readwrite', async (tx) => {
    const store = tx.objectStore(STORE.users);
    const existing = (await request(store.get(userId))) as User | undefined;
    if (existing) return existing;
    const user: User = { id: userId, displayName: '나', email: null, createdAt: Date.now() };
    store.put(user);
    return user;
  });
}

async function load(): Promise<Snapshot> {
  const user = await ensureUser();
  const [users, memories, albums, members, links, invites, logs] = await Promise.all([
    getAll<User>(STORE.users),
    getAll<Memory>(STORE.memories),
    getAll<Album>(STORE.albums),
    getAll<AlbumMember>(STORE.albumMembers),
    getAll<AlbumMemory>(STORE.albumMemories),
    getAll<AlbumInvite>(STORE.invites),
    getAll<LogEntry>(STORE.logs),
  ]);

  // 내가 멤버인 앨범만, 그리고 내 추억 + 내가 속한 앨범의 추억만 보이게 한다 (Firebase 보안 규칙과 같은 기준)
  const myAlbumIds = new Set(members.filter((m) => m.userId === user.id).map((m) => m.albumId));
  const visibleLinks = links.filter((l) => myAlbumIds.has(l.albumId));
  const sharedMemoryIds = new Set(visibleLinks.map((l) => l.memoryId));

  return {
    user,
    users,
    memories: memories.filter((m) => m.ownerId === user.id || sharedMemoryIds.has(m.id)).sort(byDateDesc),
    albums: albums.filter((a) => myAlbumIds.has(a.id)).sort((a, b) => b.updatedAt - a.updatedAt),
    members: members.filter((m) => myAlbumIds.has(m.albumId)),
    links: visibleLinks,
    invites: invites.filter((i) => i.createdBy === user.id && myAlbumIds.has(i.albumId)).sort((a, b) => b.createdAt - a.createdAt),
    logs: logs.filter((l) => l.ownerId === user.id).sort(logOrder),
  };
}

/* ---------- 변경 알림: 같은 탭의 구독자 + 다른 탭(BroadcastChannel) ---------- */

type Listener = { onData: (s: Snapshot) => void; onError: (e: unknown) => void };
const listeners = new Set<Listener>();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fade-and-days') : null;

async function emit(broadcast: boolean) {
  if (listeners.size > 0) {
    try {
      const snapshot = await load();
      listeners.forEach((l) => l.onData(snapshot));
    } catch (error) {
      listeners.forEach((l) => l.onError(error));
    }
  }
  if (broadcast) channel?.postMessage('changed');
}

if (channel) channel.onmessage = () => void emit(false);

async function mutate<T>(work: () => Promise<T>): Promise<T> {
  const result = await work();
  await emit(true);
  return result;
}

/* ---------- 내부 도우미 ---------- */

async function roleIn(tx: IDBTransaction, albumId: ID, uid: ID): Promise<AlbumRole | null> {
  const member = (await request(tx.objectStore(STORE.albumMembers).get([albumId, uid]))) as AlbumMember | undefined;
  return member?.role ?? null;
}

/** 화면의 사진 목록(drafts)대로 photos 저장소를 맞추고 새 PhotoRef 배열을 돌려준다 */
function applyPhotos(tx: IDBTransaction, parentId: ID, drafts: PhotoDraft[], prev: PhotoRef[]): PhotoRef[] {
  const store = tx.objectStore(STORE.photos);
  const keep = new Set(drafts.flatMap((d) => (d.kind === 'existing' ? [d.ref.id] : [])));
  prev.filter((ref) => !keep.has(ref.id)).forEach((ref) => store.delete(ref.id));

  const prevIds = new Set(prev.map((ref) => ref.id));
  const now = Date.now();
  const result: PhotoRef[] = [];
  for (const draft of drafts) {
    if (draft.kind === 'existing') {
      if (prevIds.has(draft.ref.id)) result.push(draft.ref);
      continue;
    }
    const photo: LocalPhoto = {
      id: createId(),
      parentId,
      ownerId: userId,
      blob: draft.blob,
      mimeType: draft.mimeType,
      width: draft.width,
      height: draft.height,
      createdAt: now,
    };
    store.put(photo);
    result.push({ id: photo.id, width: photo.width, height: photo.height, path: null });
  }
  return result;
}

function deletePhotos(tx: IDBTransaction, refs: PhotoRef[]) {
  const store = tx.objectStore(STORE.photos);
  refs.forEach((ref) => store.delete(ref.id));
}

/* ---------- 구현 ---------- */

export const localRepository: Repository = {
  mode: 'local',
  maxPhotoBytes: null,

  subscribe(onData, onError) {
    const listener = { onData, onError };
    listeners.add(listener);
    load().then(onData, onError);
    return () => listeners.delete(listener);
  },

  async getPhotoSrc(ref) {
    const db = await getDB();
    const photo = (await request(db.transaction(STORE.photos).objectStore(STORE.photos).get(ref.id))) as LocalPhoto | undefined;
    return photo ? URL.createObjectURL(photo.blob) : null;
  },

  updateDisplayName: (name) =>
    mutate(() =>
      transaction([STORE.users], 'readwrite', async (tx) => {
        const store = tx.objectStore(STORE.users);
        const user = (await request(store.get(userId))) as User | undefined;
        if (user) store.put({ ...user, displayName: name.trim() });
      }),
    ),

  /* ---------------- 추억 ---------------- */

  saveMemory: (input, id) =>
    mutate(() =>
      transaction([STORE.memories, STORE.photos, STORE.albumMemories, STORE.albumMembers], 'readwrite', async (tx) => {
        const memories = tx.objectStore(STORE.memories);
        const links = tx.objectStore(STORE.albumMemories);
        const now = Date.now();

        const prev = id ? ((await request(memories.get(id))) as Memory | undefined) : undefined;
        if (id && !prev) throw new Error('기록을 찾을 수 없어요.');
        if (prev && prev.ownerId !== userId) throw new Error('다른 사람이 쓴 기록은 수정할 수 없어요.');
        const memoryId = prev?.id ?? createId();

        const memory: Memory = {
          id: memoryId,
          ownerId: userId,
          title: input.title.trim(),
          date: input.date,
          note: input.note.trim(),
          photos: applyPhotos(tx, memoryId, input.photos, prev?.photos ?? []),
          createdAt: prev?.createdAt ?? now,
          updatedAt: now,
        };
        memories.put(memory);

        // 앨범 연결: 추가는 owner/editor 앨범에만, 빼기는 권한이 있는 것만
        const current = (await request(links.index('byMemory').getAll(memoryId))) as AlbumMemory[];
        const currentIds = new Set(current.map((l) => l.albumId));
        const wanted = new Set(input.albumIds);
        for (const link of current) {
          if (wanted.has(link.albumId)) continue;
          if (canRemoveFromAlbum(await roleIn(tx, link.albumId, userId), link.addedBy, userId)) {
            links.delete([link.albumId, memoryId]);
          }
        }
        for (const albumId of wanted) {
          if (currentIds.has(albumId)) continue;
          if (!canAddToAlbum(await roleIn(tx, albumId, userId))) throw new Error('추억을 올릴 권한이 없는 앨범이 있어요.');
          links.put({ albumId, memoryId, addedBy: userId, addedAt: now } satisfies AlbumMemory);
        }
        return memory;
      }),
    ),

  deleteMemory: (id) =>
    mutate(() =>
      transaction([STORE.memories, STORE.photos, STORE.albumMemories], 'readwrite', async (tx) => {
        const memory = (await request(tx.objectStore(STORE.memories).get(id))) as Memory | undefined;
        if (!memory) return;
        if (memory.ownerId !== userId) throw new Error('다른 사람이 쓴 기록은 삭제할 수 없어요.');
        deletePhotos(tx, memory.photos);
        const links = tx.objectStore(STORE.albumMemories);
        const keys = await request(links.index('byMemory').getAllKeys(id));
        keys.forEach((key) => links.delete(key));
        tx.objectStore(STORE.memories).delete(id);
      }),
    ),

  /* ---------------- 앨범 ---------------- */

  saveAlbum: (input, id) =>
    mutate(() =>
      transaction([STORE.albums, STORE.albumMembers, STORE.invites], 'readwrite', async (tx) => {
        const albums = tx.objectStore(STORE.albums);
        const now = Date.now();
        if (id) {
          const prev = (await request(albums.get(id))) as Album | undefined;
          if (!prev) throw new Error('앨범을 찾을 수 없어요.');
          if (!canManageAlbum(await roleIn(tx, id, userId))) throw new Error('앨범 소유자만 수정할 수 있어요.');
          const album: Album = { ...prev, title: input.title.trim(), description: input.description.trim(), updatedAt: now };
          albums.put(album);
          return album;
        }
        const album: Album = {
          id: createId(),
          ownerId: userId,
          title: input.title.trim(),
          description: input.description.trim(),
          createdAt: now,
          updatedAt: now,
        };
        albums.put(album);
        tx.objectStore(STORE.albumMembers).put({
          albumId: album.id,
          userId,
          role: 'owner',
          joinedAt: now,
          invitedBy: null,
        } satisfies AlbumMember);
        return album;
      }),
    ),

  /** 앨범만 지운다. 추억 자체는 작성자에게 그대로 남는다. */
  deleteAlbum: (id) =>
    mutate(() =>
      transaction([STORE.albums, STORE.albumMembers, STORE.albumMemories, STORE.invites], 'readwrite', async (tx) => {
        if (!canManageAlbum(await roleIn(tx, id, userId))) throw new Error('앨범 소유자만 삭제할 수 있어요.');
        for (const name of [STORE.albumMembers, STORE.albumMemories, STORE.invites] as const) {
          const store = tx.objectStore(name);
          const keys = await request(store.index('byAlbum').getAllKeys(id));
          keys.forEach((key) => store.delete(key));
        }
        tx.objectStore(STORE.albums).delete(id);
      }),
    ),

  removeFromAlbum: (albumId, memoryId) =>
    mutate(() =>
      transaction([STORE.albumMemories, STORE.albumMembers], 'readwrite', async (tx) => {
        const links = tx.objectStore(STORE.albumMemories);
        const link = (await request(links.get([albumId, memoryId]))) as AlbumMemory | undefined;
        if (!link) return;
        if (!canRemoveFromAlbum(await roleIn(tx, albumId, userId), link.addedBy, userId)) {
          throw new Error('이 추억을 앨범에서 뺄 권한이 없어요.');
        }
        links.delete([albumId, memoryId]);
      }),
    ),

  /* ---------------- 초대 ---------------- */

  createInvite: (albumId, input) =>
    mutate(() =>
      transaction([STORE.invites, STORE.albumMembers, STORE.albums], 'readwrite', async (tx) => {
        if (!canManageMembers(await roleIn(tx, albumId, userId))) throw new Error('앨범 소유자만 초대할 수 있어요.');
        const album = (await request(tx.objectStore(STORE.albums).get(albumId))) as Album | undefined;
        const now = Date.now();
        const code = createInviteCode();
        const invite: AlbumInvite = {
          id: code,
          albumId,
          albumTitle: album?.title ?? '',
          code,
          role: input.role,
          createdBy: userId,
          createdAt: now,
          expiresAt: now + input.days * 24 * 60 * 60 * 1000,
          maxUses: input.maxUses,
          useCount: 0,
          revoked: false,
        };
        tx.objectStore(STORE.invites).add(invite); // code는 unique 인덱스라 겹치면 실패한다
        return invite;
      }),
    ),

  revokeInvite: (inviteId) =>
    mutate(() =>
      transaction([STORE.invites, STORE.albumMembers], 'readwrite', async (tx) => {
        const store = tx.objectStore(STORE.invites);
        const invite = (await request(store.get(inviteId))) as AlbumInvite | undefined;
        if (!invite) return;
        if (!canManageMembers(await roleIn(tx, invite.albumId, userId))) throw new Error('권한이 없어요.');
        store.put({ ...invite, revoked: true });
      }),
    ),

  previewInvite: (code) =>
    transaction([STORE.invites, STORE.albums, STORE.albumMembers], 'readonly', async (tx) => {
      const invite = (await request(tx.objectStore(STORE.invites).index('byCode').get(normalizeInviteCode(code)))) as
        | AlbumInvite
        | undefined;
      if (!invite) return { status: 'not-found' as const };
      const album = (await request(tx.objectStore(STORE.albums).get(invite.albumId))) as Album | undefined;
      if (!album) return { status: 'not-found' as const };
      if (await roleIn(tx, album.id, userId)) return { status: 'already-member' as const, albumId: album.id, albumTitle: album.title };
      const status = inviteStatus(invite);
      if (status !== 'ok') return { status };
      const memberCount = await request(tx.objectStore(STORE.albumMembers).index('byAlbum').count(album.id));
      return { status: 'ok' as const, invite: { ...invite, albumTitle: album.title }, memberCount };
    }),

  acceptInvite: (code) =>
    mutate(() =>
      transaction([STORE.invites, STORE.albums, STORE.albumMembers], 'readwrite', async (tx) => {
        const invites = tx.objectStore(STORE.invites);
        const invite = (await request(invites.index('byCode').get(normalizeInviteCode(code)))) as AlbumInvite | undefined;
        if (!invite) throw new Error('초대 코드를 찾을 수 없어요.');
        const album = (await request(tx.objectStore(STORE.albums).get(invite.albumId))) as Album | undefined;
        if (!album) throw new Error('앨범이 삭제됐어요.');
        if (await roleIn(tx, album.id, userId)) throw new Error('이미 참여 중인 앨범이에요.');
        assertInviteUsable(invite);
        tx.objectStore(STORE.albumMembers).put({
          albumId: album.id,
          userId,
          role: invite.role,
          joinedAt: Date.now(),
          invitedBy: invite.createdBy,
        } satisfies AlbumMember);
        invites.put({ ...invite, useCount: invite.useCount + 1 });
        return album.id;
      }),
    ),

  changeMemberRole: (albumId, targetUserId, role) =>
    mutate(() =>
      transaction([STORE.albumMembers], 'readwrite', async (tx) => {
        if (!canManageMembers(await roleIn(tx, albumId, userId))) throw new Error('앨범 소유자만 역할을 바꿀 수 있어요.');
        const store = tx.objectStore(STORE.albumMembers);
        const member = (await request(store.get([albumId, targetUserId]))) as AlbumMember | undefined;
        if (!member) throw new Error('멤버를 찾을 수 없어요.');
        if (member.role === 'owner') throw new Error('소유자의 역할은 바꿀 수 없어요.');
        store.put({ ...member, role });
      }),
    ),

  removeMember: (albumId, targetUserId) =>
    mutate(() =>
      transaction([STORE.albumMembers, STORE.albumMemories], 'readwrite', async (tx) => {
        const store = tx.objectStore(STORE.albumMembers);
        const member = (await request(store.get([albumId, targetUserId]))) as AlbumMember | undefined;
        if (!member) return;
        if (member.role === 'owner') throw new Error('소유자는 앨범을 나갈 수 없어요. 앨범을 삭제해 주세요.');
        if (targetUserId !== userId && !canManageMembers(await roleIn(tx, albumId, userId))) throw new Error('권한이 없어요.');
        store.delete([albumId, targetUserId]);
        // 나간 사람이 올린 추억은 앨범에서 빠진다 (추억 자체는 그 사람에게 남음)
        const links = tx.objectStore(STORE.albumMemories);
        const albumLinks = (await request(links.index('byAlbum').getAll(albumId))) as AlbumMemory[];
        albumLinks.filter((l) => l.addedBy === targetUserId).forEach((l) => links.delete([l.albumId, l.memoryId]));
      }),
    ),

  /* ---------------- 시간 로그 ---------------- */

  saveLog: (input, id) =>
    mutate(() => {
      validateLogInput(input);
      return transaction([STORE.logs, STORE.photos], 'readwrite', async (tx) => {
        const store = tx.objectStore(STORE.logs);
        const now = Date.now();
        const prev = id ? ((await request(store.get(id))) as LogEntry | undefined) : undefined;
        if (id && !prev) throw new Error('로그를 찾을 수 없어요.');
        const logId = prev?.id ?? createId();
        const entry: LogEntry = {
          id: logId,
          ownerId: userId,
          date: input.date,
          time: input.time,
          text: input.text.trim(),
          tag: input.tag,
          photos: applyPhotos(tx, logId, input.photos, prev?.photos ?? []),
          createdAt: prev?.createdAt ?? now,
          updatedAt: now,
        };
        store.put(entry);
        return entry;
      });
    }),

  deleteLog: (id) =>
    mutate(() =>
      transaction([STORE.logs, STORE.photos], 'readwrite', async (tx) => {
        const store = tx.objectStore(STORE.logs);
        const entry = (await request(store.get(id))) as LogEntry | undefined;
        if (!entry) return;
        deletePhotos(tx, entry.photos);
        store.delete(id);
      }),
    ),
};
