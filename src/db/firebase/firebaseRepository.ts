/**
 * Firebase 저장소: 로그인한 사용자의 데이터를 Firestore에 저장하고 기기 간 실시간으로 동기화한다.
 *
 * Firestore 구조
 *  users/{uid}                         프로필 { displayName, email, createdAt }
 *  users/{uid}/memories/{memoryId}     내 추억 (본인만 읽기·쓰기)  + albumIds
 *  users/{uid}/logs/{logId}            내 시간 로그 (본인만)
 *  users/{uid}/photos/{photoId}        사진 데이터 (VITE_PHOTO_BACKEND=firestore 일 때)
 *  albums/{albumId}                    앨범 { ownerId, title, memberIds[], members{uid: {role, displayName…}} }
 *  albums/{albumId}/entries/{memoryId} 앨범에 넣은 추억의 사본 (앨범 멤버가 읽음)
 *  invites/{CODE}                      초대 코드
 *
 * 공유 앨범의 추억은 "사본(entry)" 방식이다. 작성자가 추억을 저장하면 그 추억이 들어간 앨범마다
 * entries 문서를 같이 고쳐 쓴다(writeBatch). 덕분에 보안 규칙은 "앨범 멤버면 entries를 읽을 수 있다"
 * 한 줄로 끝나고, 개인 추억은 users/{uid} 아래에서 본인만 볼 수 있다.
 * 권한 규칙 전체는 프로젝트 루트의 firestore.rules 참고.
 */

import {
  Bytes,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { createInviteCode, normalizeInviteCode } from '../../lib/id';
import { canAddToAlbum, canManageAlbum, canManageMembers, canRemoveFromAlbum } from '../../lib/permissions';
import type {
  Album,
  AlbumInvite,
  AlbumMember,
  AlbumMemory,
  AlbumRole,
  ID,
  InviteRole,
  LogEntry,
  LogTag,
  Memory,
  PhotoDraft,
  PhotoRef,
  User,
} from '../../types/models';
import { assertInviteUsable, byDateDesc, inviteStatus, logOrder, validateLogInput } from '../types';
import type { Repository, Snapshot } from '../types';
import { db, getStorageInstance } from './app';
import type { AuthUser } from './auth';
import { consumePendingDisplayName } from './auth';
import { photoBackend } from './config';

/* ---------- Firestore 문서 모양 ----------
 * interface 대신 type을 쓰는 이유: Firestore의 DocumentData(인덱스 시그니처)에 바로 넣을 수 있게 */

type ProfileDoc = {
  displayName: string;
  email: string | null;
  createdAt: number;
};
type MemoryDoc = {
  ownerId: string;
  title: string;
  date: string;
  note: string;
  photos: PhotoRef[];
  albumIds: string[];
  createdAt: number;
  updatedAt: number;
};
type LogDoc = {
  ownerId: string;
  date: string;
  time: string;
  text: string;
  tag: LogTag | null;
  photos: PhotoRef[];
  createdAt: number;
  updatedAt: number;
};
type MemberInfo = {
  role: AlbumRole;
  joinedAt: number;
  invitedBy: string | null;
  displayName: string;
};
type AlbumDoc = {
  ownerId: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  memberIds: string[];
  members: Record<string, MemberInfo>;
  /** 초대로 참여할 때 사용한 코드 (보안 규칙이 초대를 확인하는 데 씀) */
  joinCode?: string;
};
type EntryDoc = {
  ownerId: string;
  title: string;
  date: string;
  note: string;
  photos: PhotoRef[];
  createdAt: number;
  updatedAt: number;
  addedBy: string;
  addedAt: number;
};
type InviteDoc = {
  albumId: string;
  albumTitle: string;
  role: InviteRole;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  maxUses: number | null;
  useCount: number;
  revoked: boolean;
};
type PhotoDoc = {
  ownerId: string;
  data: Bytes;
  mimeType: string;
  width: number;
  height: number;
  createdAt: number;
};

/** Firestore 문서 한 개는 1MiB까지라 사진은 그보다 작게 줄여서 저장한다 */
const FIRESTORE_PHOTO_LIMIT = 900 * 1024;
/** writeBatch 한 번에 500개까지 가능 */
const BATCH_LIMIT = 450;

type MemoryWithAlbums = Memory & { albumIds: string[] };

export function createFirebaseRepository(authUser: AuthUser): Repository {
  const uid = authUser.uid;

  const userRef = doc(db, 'users', uid);
  const memoriesCol = collection(db, 'users', uid, 'memories');
  const logsCol = collection(db, 'users', uid, 'logs');
  const albumsCol = collection(db, 'albums');
  const invitesCol = collection(db, 'invites');
  const entriesCol = (albumId: ID) => collection(db, 'albums', albumId, 'entries');

  /* ---------- 실시간 상태 ---------- */

  let profile: ProfileDoc | null = null;
  let memories = new Map<ID, MemoryWithAlbums>();
  let logs: LogEntry[] = [];
  let albums = new Map<ID, AlbumDoc>();
  const entries = new Map<ID, Map<ID, EntryDoc>>();
  const entryUnsubs = new Map<ID, Unsubscribe>();
  let invites: AlbumInvite[] = [];
  const loaded = { profile: false, memories: false, logs: false, albums: false, invites: false };
  let listener: { onData: (s: Snapshot) => void; onError: (e: unknown) => void } | null = null;
  let scheduled = false;

  const roleOf = (albumId: ID): AlbumRole | null => albums.get(albumId)?.members?.[uid]?.role ?? null;
  const myName = () => profile?.displayName ?? authUser.displayName ?? '멤버';

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (listener && Object.values(loaded).every(Boolean)) listener.onData(buildSnapshot());
    });
  }

  function buildSnapshot(): Snapshot {
    const user: User = { id: uid, displayName: profile!.displayName, email: profile!.email, createdAt: profile!.createdAt };
    const users = new Map<ID, User>([[uid, user]]);
    const albumList: Album[] = [];
    const members: AlbumMember[] = [];

    for (const [id, a] of albums) {
      albumList.push({ id, ownerId: a.ownerId, title: a.title, description: a.description, createdAt: a.createdAt, updatedAt: a.updatedAt });
      for (const [memberId, info] of Object.entries(a.members ?? {})) {
        members.push({ albumId: id, userId: memberId, role: info.role, joinedAt: info.joinedAt, invitedBy: info.invitedBy ?? null });
        if (!users.has(memberId)) {
          users.set(memberId, { id: memberId, displayName: info.displayName || '멤버', email: null, createdAt: info.joinedAt });
        }
      }
    }

    const memoryMap = new Map<ID, Memory>();
    for (const m of memories.values()) {
      const { albumIds: _albumIds, ...memory } = m;
      void _albumIds;
      memoryMap.set(m.id, memory);
    }
    const links: AlbumMemory[] = [];
    for (const [albumId, map] of entries) {
      if (!albums.has(albumId)) continue;
      for (const [memoryId, e] of map) {
        links.push({ albumId, memoryId, addedBy: e.addedBy, addedAt: e.addedAt });
        if (!memoryMap.has(memoryId)) {
          memoryMap.set(memoryId, {
            id: memoryId,
            ownerId: e.ownerId,
            title: e.title,
            date: e.date,
            note: e.note,
            photos: e.photos ?? [],
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
          });
        }
      }
    }

    return {
      user,
      users: [...users.values()],
      memories: [...memoryMap.values()].sort(byDateDesc),
      albums: albumList.sort((a, b) => b.updatedAt - a.updatedAt),
      members,
      links,
      invites: invites.filter((i) => albums.has(i.albumId)).sort((a, b) => b.createdAt - a.createdAt),
      logs: [...logs].sort(logOrder),
    };
  }

  function syncEntryListeners() {
    for (const albumId of albums.keys()) {
      if (entryUnsubs.has(albumId)) continue;
      entryUnsubs.set(
        albumId,
        onSnapshot(
          entriesCol(albumId),
          (snap) => {
            entries.set(albumId, new Map(snap.docs.map((d) => [d.id, d.data() as EntryDoc])));
            schedule();
          },
          () => {
            // 앨범에서 나가거나 내보내지면 권한 오류로 끊긴다
            entryUnsubs.delete(albumId);
            entries.delete(albumId);
            schedule();
          },
        ),
      );
    }
    for (const [albumId, unsub] of entryUnsubs) {
      if (albums.has(albumId)) continue;
      unsub();
      entryUnsubs.delete(albumId);
      entries.delete(albumId);
    }
  }

  /* ---------- 사진 ---------- */

  async function uploadPhoto(draft: Extract<PhotoDraft, { kind: 'new' }>): Promise<PhotoRef> {
    const id = doc(collection(db, 'users', uid, 'photos')).id;
    if (photoBackend === 'storage') {
      const ext = draft.mimeType === 'image/webp' ? 'webp' : 'jpg';
      const path = `users/${uid}/photos/${id}.${ext}`;
      await uploadBytes(storageRef(getStorageInstance(), path), draft.blob, {
        contentType: draft.mimeType,
        cacheControl: 'public,max-age=31536000,immutable',
      });
      return { id, width: draft.width, height: draft.height, path: `storage:${path}` };
    }
    if (draft.blob.size > FIRESTORE_PHOTO_LIMIT) throw new Error('사진 용량이 너무 커요.');
    const data = Bytes.fromUint8Array(new Uint8Array(await draft.blob.arrayBuffer()));
    const photo: PhotoDoc = { ownerId: uid, data, mimeType: draft.mimeType, width: draft.width, height: draft.height, createdAt: Date.now() };
    await setDoc(doc(db, 'users', uid, 'photos', id), photo);
    return { id, width: draft.width, height: draft.height, path: `firestore:users/${uid}/photos/${id}` };
  }

  /** 지우기는 실패해도 기록 저장에는 영향이 없게 조용히 넘어간다 */
  async function removePhotos(refs: PhotoRef[]) {
    await Promise.all(
      refs.map(async (ref) => {
        try {
          if (ref.path?.startsWith('storage:')) await deleteObject(storageRef(getStorageInstance(), ref.path.slice(8)));
          else if (ref.path?.startsWith('firestore:')) await deleteDoc(doc(db, ref.path.slice(10)));
        } catch {
          // 이미 지워졌거나 권한이 없는 경우
        }
      }),
    );
  }

  /** 화면의 사진 목록대로 새 사진을 올리고, 최종 PhotoRef 목록과 지울 사진을 돌려준다 */
  async function resolvePhotos(drafts: PhotoDraft[], prev: PhotoRef[]) {
    const prevIds = new Set(prev.map((p) => p.id));
    const uploaded: PhotoRef[] = [];
    const photos: PhotoRef[] = [];
    try {
      for (const draft of drafts) {
        if (draft.kind === 'existing') {
          if (prevIds.has(draft.ref.id)) photos.push(draft.ref);
        } else {
          const ref = await uploadPhoto(draft);
          uploaded.push(ref);
          photos.push(ref);
        }
      }
    } catch (error) {
      await removePhotos(uploaded);
      throw error;
    }
    const keep = new Set(photos.map((p) => p.id));
    return { photos, uploaded, removed: prev.filter((p) => !keep.has(p.id)) };
  }

  /* ---------- 일괄 쓰기 ---------- */

  type Op = (batch: ReturnType<typeof writeBatch>) => void;
  async function commit(ops: Op[]) {
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
      await batch.commit();
    }
  }

  const entryRef = (albumId: ID, memoryId: ID) => doc(db, 'albums', albumId, 'entries', memoryId);
  const albumRef = (albumId: ID) => doc(db, 'albums', albumId);

  /* ---------- 구현 ---------- */

  const repository: Repository = {
    mode: 'firebase',
    maxPhotoBytes: photoBackend === 'firestore' ? FIRESTORE_PHOTO_LIMIT : null,

    subscribe(onData, onError) {
      listener = { onData, onError };
      const fail = (error: unknown) => listener?.onError(error);
      const unsubs: Unsubscribe[] = [
        onSnapshot(
          userRef,
          (snap) => {
            if (!snap.exists()) {
              const name = consumePendingDisplayName() || authUser.displayName || authUser.email?.split('@')[0] || '나';
              const created: ProfileDoc = { displayName: name.slice(0, 20), email: authUser.email, createdAt: Date.now() };
              setDoc(userRef, created).catch(fail);
              return;
            }
            profile = snap.data() as ProfileDoc;
            loaded.profile = true;
            schedule();
          },
          fail,
        ),
        onSnapshot(
          memoriesCol,
          (snap) => {
            memories = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as MemoryDoc) }]));
            loaded.memories = true;
            schedule();
          },
          fail,
        ),
        onSnapshot(
          logsCol,
          (snap) => {
            logs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as LogDoc) }));
            loaded.logs = true;
            schedule();
          },
          fail,
        ),
        onSnapshot(
          query(albumsCol, where('memberIds', 'array-contains', uid)),
          (snap) => {
            albums = new Map(snap.docs.map((d) => [d.id, d.data() as AlbumDoc]));
            syncEntryListeners();
            loaded.albums = true;
            schedule();
          },
          fail,
        ),
        onSnapshot(
          query(invitesCol, where('createdBy', '==', uid)),
          (snap) => {
            invites = snap.docs.map((d) => ({ id: d.id, code: d.id, ...(d.data() as InviteDoc) }));
            loaded.invites = true;
            schedule();
          },
          fail,
        ),
      ];
      return () => {
        unsubs.forEach((u) => u());
        entryUnsubs.forEach((u) => u());
        entryUnsubs.clear();
        entries.clear();
        listener = null;
      };
    },

    async getPhotoSrc(ref) {
      if (ref.path?.startsWith('storage:')) {
        return getDownloadURL(storageRef(getStorageInstance(), ref.path.slice(8)));
      }
      if (ref.path?.startsWith('firestore:')) {
        const snap = await getDoc(doc(db, ref.path.slice(10)));
        if (!snap.exists()) return null;
        const photo = snap.data() as PhotoDoc;
        return URL.createObjectURL(new Blob([photo.data.toUint8Array() as Uint8Array<ArrayBuffer>], { type: photo.mimeType }));
      }
      return null;
    },

    async updateDisplayName(name) {
      const displayName = name.trim();
      await commit([
        (b) => b.update(userRef, { displayName }),
        // 공유 앨범의 멤버 목록에 보이는 이름도 함께 바꾼다
        ...[...albums.keys()].map((albumId): Op => (b) => b.update(albumRef(albumId), { [`members.${uid}.displayName`]: displayName })),
      ]);
    },

    /* ---------------- 추억 ---------------- */

    async saveMemory(input, id) {
      const prev = id ? memories.get(id) : undefined;
      if (id && !prev) throw new Error('기록을 찾을 수 없어요.');
      const memoryId = prev?.id ?? doc(memoriesCol).id;

      const wanted = input.albumIds.filter((a) => albums.has(a));
      for (const albumId of wanted) {
        const already = entries.get(albumId)?.has(memoryId);
        if (!already && !canAddToAlbum(roleOf(albumId))) throw new Error('추억을 올릴 권한이 없는 앨범이 있어요.');
      }

      const { photos, uploaded, removed } = await resolvePhotos(input.photos, prev?.photos ?? []);
      const now = Date.now();
      const memory: Memory = {
        id: memoryId,
        ownerId: uid,
        title: input.title.trim(),
        date: input.date,
        note: input.note.trim(),
        photos,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      };
      const { id: _id, ...fields } = memory;
      void _id;

      const ops: Op[] = [(b) => b.set(doc(memoriesCol, memoryId), { ...fields, albumIds: wanted } satisfies MemoryDoc)];
      for (const albumId of wanted) {
        const existing = entries.get(albumId)?.get(memoryId);
        const entry: EntryDoc = { ...fields, addedBy: existing?.addedBy ?? uid, addedAt: existing?.addedAt ?? now };
        ops.push((b) => b.set(entryRef(albumId, memoryId), entry));
      }
      for (const albumId of prev?.albumIds ?? []) {
        if (!wanted.includes(albumId) && entries.get(albumId)?.has(memoryId)) {
          ops.push((b) => b.delete(entryRef(albumId, memoryId)));
        }
      }

      try {
        await commit(ops);
      } catch (error) {
        await removePhotos(uploaded);
        throw error;
      }
      await removePhotos(removed);
      return memory;
    },

    async deleteMemory(id) {
      const prev = memories.get(id);
      if (!prev) throw new Error('다른 사람이 쓴 기록은 삭제할 수 없어요.');
      const ops: Op[] = [(b) => b.delete(doc(memoriesCol, id))];
      for (const albumId of prev.albumIds) {
        if (entries.get(albumId)?.has(id)) ops.push((b) => b.delete(entryRef(albumId, id)));
      }
      await commit(ops);
      await removePhotos(prev.photos);
    },

    /* ---------------- 앨범 ---------------- */

    async saveAlbum(input, id) {
      const now = Date.now();
      if (id) {
        const prev = albums.get(id);
        if (!prev) throw new Error('앨범을 찾을 수 없어요.');
        if (!canManageAlbum(roleOf(id))) throw new Error('앨범 소유자만 수정할 수 있어요.');
        const title = input.title.trim();
        await commit([
          (b) => b.update(albumRef(id), { title, description: input.description.trim(), updatedAt: now }),
          ...invites.filter((i) => i.albumId === id).map((i): Op => (b) => b.update(doc(invitesCol, i.id), { albumTitle: title })),
        ]);
        return { id, ownerId: prev.ownerId, title, description: input.description.trim(), createdAt: prev.createdAt, updatedAt: now };
      }
      const ref = doc(albumsCol);
      const album: AlbumDoc = {
        ownerId: uid,
        title: input.title.trim(),
        description: input.description.trim(),
        createdAt: now,
        updatedAt: now,
        memberIds: [uid],
        members: { [uid]: { role: 'owner', joinedAt: now, invitedBy: null, displayName: myName() } },
      };
      await setDoc(ref, album);
      return { id: ref.id, ownerId: uid, title: album.title, description: album.description, createdAt: now, updatedAt: now };
    },

    /** 앨범과 앨범 안의 사본(entries)만 지운다. 각자의 추억은 그대로 남는다. */
    async deleteAlbum(id) {
      if (!canManageAlbum(roleOf(id))) throw new Error('앨범 소유자만 삭제할 수 있어요.');
      const entrySnap = await getDocs(entriesCol(id));
      await commit([
        ...entrySnap.docs.map((d): Op => (b) => b.delete(d.ref)),
        ...invites.filter((i) => i.albumId === id).map((i): Op => (b) => b.delete(doc(invitesCol, i.id))),
        ...[...memories.values()].filter((m) => m.albumIds.includes(id)).map(
          (m): Op => (b) => b.update(doc(memoriesCol, m.id), { albumIds: arrayRemove(id) }),
        ),
      ]);
      await deleteDoc(albumRef(id));
    },

    async removeFromAlbum(albumId, memoryId) {
      const entry = entries.get(albumId)?.get(memoryId);
      if (!entry) return;
      if (!canRemoveFromAlbum(roleOf(albumId), entry.addedBy, uid)) throw new Error('이 추억을 앨범에서 뺄 권한이 없어요.');
      const ops: Op[] = [(b) => b.delete(entryRef(albumId, memoryId))];
      if (memories.has(memoryId)) ops.push((b) => b.update(doc(memoriesCol, memoryId), { albumIds: arrayRemove(albumId) }));
      await commit(ops);
    },

    /* ---------------- 초대 ---------------- */

    async createInvite(albumId, input) {
      if (!canManageMembers(roleOf(albumId))) throw new Error('앨범 소유자만 초대할 수 있어요.');
      const now = Date.now();
      const code = createInviteCode();
      const data: InviteDoc = {
        albumId,
        albumTitle: albums.get(albumId)?.title ?? '',
        role: input.role,
        createdBy: uid,
        createdAt: now,
        expiresAt: now + input.days * 24 * 60 * 60 * 1000,
        maxUses: input.maxUses,
        useCount: 0,
        revoked: false,
      };
      await setDoc(doc(invitesCol, code), data);
      return { id: code, code, ...data };
    },

    async revokeInvite(inviteId) {
      await updateDoc(doc(invitesCol, inviteId), { revoked: true });
    },

    async previewInvite(input) {
      const code = normalizeInviteCode(input);
      if (code.length !== 8) return { status: 'not-found' };
      const snap = await getDoc(doc(invitesCol, code));
      if (!snap.exists()) return { status: 'not-found' };
      const invite: AlbumInvite = { id: code, code, ...(snap.data() as InviteDoc) };
      if (albums.has(invite.albumId)) {
        return { status: 'already-member', albumId: invite.albumId, albumTitle: albums.get(invite.albumId)!.title };
      }
      const status = inviteStatus(invite);
      if (status !== 'ok') return { status };
      return { status: 'ok', invite, memberCount: null };
    },

    async acceptInvite(input) {
      const code = normalizeInviteCode(input);
      return runTransaction(db, async (tx) => {
        const inviteRef = doc(invitesCol, code);
        const snap = await tx.get(inviteRef);
        if (!snap.exists()) throw new Error('초대 코드를 찾을 수 없어요.');
        const invite: AlbumInvite = { id: code, code, ...(snap.data() as InviteDoc) };
        if (albums.has(invite.albumId)) throw new Error('이미 참여 중인 앨범이에요.');
        assertInviteUsable(invite);
        const member: MemberInfo = { role: invite.role, joinedAt: Date.now(), invitedBy: invite.createdBy, displayName: myName() };
        tx.update(albumRef(invite.albumId), {
          memberIds: arrayUnion(uid),
          [`members.${uid}`]: member,
          joinCode: code,
        });
        tx.update(inviteRef, { useCount: increment(1) });
        return invite.albumId;
      });
    },

    async changeMemberRole(albumId, targetUserId, role) {
      if (!canManageMembers(roleOf(albumId))) throw new Error('앨범 소유자만 역할을 바꿀 수 있어요.');
      if (albums.get(albumId)?.members?.[targetUserId]?.role === 'owner') throw new Error('소유자의 역할은 바꿀 수 없어요.');
      await updateDoc(albumRef(albumId), { [`members.${targetUserId}.role`]: role });
    },

    async removeMember(albumId, targetUserId) {
      const album = albums.get(albumId);
      const target = album?.members?.[targetUserId];
      if (!album || !target) return;
      if (target.role === 'owner') throw new Error('소유자는 앨범을 나갈 수 없어요. 앨범을 삭제해 주세요.');
      const self = targetUserId === uid;
      if (!self && !canManageMembers(roleOf(albumId))) throw new Error('권한이 없어요.');

      // 나가는 사람이 올린 추억은 앨범에서 뺀다 (추억 자체는 그 사람에게 남음)
      const ops: Op[] = [];
      for (const [memoryId, entry] of entries.get(albumId) ?? []) {
        if (entry.ownerId !== targetUserId) continue;
        ops.push((b) => b.delete(entryRef(albumId, memoryId)));
        if (self && memories.has(memoryId)) ops.push((b) => b.update(doc(memoriesCol, memoryId), { albumIds: arrayRemove(albumId) }));
      }
      ops.push((b) => b.update(albumRef(albumId), { memberIds: arrayRemove(targetUserId), [`members.${targetUserId}`]: deleteField() }));
      await commit(ops);
    },

    /* ---------------- 시간 로그 ---------------- */

    async saveLog(input, id) {
      validateLogInput(input);
      const prev = id ? logs.find((l) => l.id === id) : undefined;
      if (id && !prev) throw new Error('로그를 찾을 수 없어요.');
      const logId = prev?.id ?? doc(logsCol).id;
      const { photos, uploaded, removed } = await resolvePhotos(input.photos, prev?.photos ?? []);
      const now = Date.now();
      const entry: LogEntry = {
        id: logId,
        ownerId: uid,
        date: input.date,
        time: input.time,
        text: input.text.trim(),
        tag: input.tag,
        photos,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      };
      const { id: _id, ...fields } = entry;
      void _id;
      try {
        await setDoc(doc(logsCol, logId), fields satisfies LogDoc);
      } catch (error) {
        await removePhotos(uploaded);
        throw error;
      }
      await removePhotos(removed);
      return entry;
    },

    async deleteLog(id) {
      const prev = logs.find((l) => l.id === id);
      await deleteDoc(doc(logsCol, id));
      if (prev) await removePhotos(prev.photos);
    },
  };

  return repository;
}
