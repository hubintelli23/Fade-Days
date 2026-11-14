/**
 * 데이터 접근 계층의 공통 약속
 *
 * 화면은 Repository 인터페이스만 사용한다. 구현은 두 가지다.
 *  - localRepository     : 로그인 없이 이 브라우저의 IndexedDB에 저장 (Firebase 설정이 없을 때)
 *  - firebaseRepository  : Firebase Auth + Firestore (+ Storage)로 저장하고 기기 간 실시간 동기화
 */

import type {
  Album,
  AlbumInput,
  AlbumInvite,
  AlbumMember,
  AlbumMemory,
  AlbumRole,
  ID,
  InviteInput,
  LogEntry,
  LogInput,
  Memory,
  MemoryInput,
  PhotoRef,
  User,
} from '../types/models';

export type RepositoryMode = 'local' | 'firebase';

export interface Snapshot {
  user: User;
  /** 나와 같은 앨범에 있는 사람들 (이름 표시용) */
  users: User[];
  /** 내 추억 + 내가 속한 앨범에 다른 사람이 올린 추억 (날짜 내림차순) */
  memories: Memory[];
  albums: Album[];
  members: AlbumMember[];
  links: AlbumMemory[];
  /** 내가 소유한 앨범의 초대 */
  invites: AlbumInvite[];
  /** 내 시간 로그 (날짜 내림차순, 같은 날은 시간 오름차순) */
  logs: LogEntry[];
}

export type InvitePreview =
  | { status: 'ok'; invite: AlbumInvite; memberCount: number | null }
  | { status: 'not-found' | 'expired' | 'revoked' | 'used-up' }
  | { status: 'already-member'; albumId: ID; albumTitle: string };

export interface Repository {
  readonly mode: RepositoryMode;

  /** 데이터가 바뀔 때마다(다른 기기에서 바뀐 것 포함) onData가 불린다. 반환값은 구독 해제 함수. */
  subscribe(onData: (snapshot: Snapshot) => void, onError: (error: unknown) => void): () => void;

  /** 화면에 그릴 수 있는 이미지 주소 */
  getPhotoSrc(photo: PhotoRef): Promise<string | null>;
  /** 이 저장소에서 사진 한 장의 최대 바이트 (없으면 제한 없음) */
  readonly maxPhotoBytes: number | null;

  updateDisplayName(name: string): Promise<void>;

  saveMemory(input: MemoryInput, id?: ID): Promise<Memory>;
  deleteMemory(id: ID): Promise<void>;

  saveAlbum(input: AlbumInput, id?: ID): Promise<Album>;
  deleteAlbum(id: ID): Promise<void>;
  removeFromAlbum(albumId: ID, memoryId: ID): Promise<void>;

  createInvite(albumId: ID, input: InviteInput): Promise<AlbumInvite>;
  revokeInvite(inviteId: ID): Promise<void>;
  previewInvite(code: string): Promise<InvitePreview>;
  acceptInvite(code: string): Promise<ID>;
  changeMemberRole(albumId: ID, userId: ID, role: Exclude<AlbumRole, 'owner'>): Promise<void>;
  /** 소유자가 내보내거나 본인이 나가기 */
  removeMember(albumId: ID, userId: ID): Promise<void>;

  saveLog(input: LogInput, id?: ID): Promise<LogEntry>;
  deleteLog(id: ID): Promise<void>;
}

/* ---------- 두 구현이 함께 쓰는 도우미 ---------- */

export function inviteStatus(invite: AlbumInvite, now = Date.now()) {
  if (invite.revoked) return 'revoked' as const;
  if (invite.expiresAt < now) return 'expired' as const;
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return 'used-up' as const;
  return 'ok' as const;
}

export function isInviteActive(invite: AlbumInvite, now = Date.now()) {
  return inviteStatus(invite, now) === 'ok';
}

export function assertInviteUsable(invite: AlbumInvite) {
  const status = inviteStatus(invite);
  if (status === 'expired') throw new Error('기간이 지난 초대예요.');
  if (status === 'revoked') throw new Error('취소된 초대예요.');
  if (status === 'used-up') throw new Error('사용 횟수를 모두 쓴 초대예요.');
}

export function byDateDesc(a: { date: string; createdAt: number }, b: { date: string; createdAt: number }) {
  return a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1;
}

export function logOrder(a: LogEntry, b: LogEntry) {
  return a.date === b.date ? a.time.localeCompare(b.time) : a.date < b.date ? 1 : -1;
}

export function validateLogInput(input: LogInput) {
  if (!input.text.trim() && input.photos.length === 0) throw new Error('사진이나 글 중 하나는 남겨 주세요.');
}
