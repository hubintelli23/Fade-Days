/**
 * Fade & Days 데이터 모델
 *
 * 관계 요약
 *  - User 1 : N Memory         (Memory.ownerId)
 *  - Memory 1 : N PhotoRef     (Memory.photos, 0번이 대표 사진)
 *  - Album N : M Memory        (AlbumMemory: 추억 하나가 여러 앨범에 들어갈 수 있음)
 *  - Album N : M User          (AlbumMember: 역할 owner / editor / viewer)
 *  - Album 1 : N AlbumInvite   (초대 코드)
 *  - User 1 : N LogEntry       (하루 안의 시간별 기록: 사진 + 시간 + 글)
 *
 * 추억은 언제나 작성자 소유이고, 앨범에는 "포함"될 뿐이다.
 * 공유 앨범에 들어간 추억은 그 앨범 멤버에게 보인다.
 */

export type ID = string;
/** YYYY-MM-DD (로컬 날짜) */
export type ISODate = string;
/** HH:mm (24시간) */
export type TimeOfDay = string;
/** Date.now() 값 */
export type Timestamp = number;

export interface User {
  id: ID;
  displayName: string;
  email: string | null;
  createdAt: Timestamp;
}

/**
 * 사진 참조. 실제 이미지 데이터는 저장소마다 다른 곳에 있다.
 *  - 로컬 모드: IndexedDB photos 저장소 (path = null)
 *  - Firebase:  'firestore:users/{uid}/photos/{id}' 또는 'storage:users/{uid}/photos/{id}.webp'
 */
export interface PhotoRef {
  id: ID;
  width: number;
  height: number;
  path: string | null;
}

export interface Memory {
  id: ID;
  ownerId: ID;
  title: string;
  date: ISODate;
  note: string;
  photos: PhotoRef[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AlbumRole = 'owner' | 'editor' | 'viewer';

export interface Album {
  id: ID;
  ownerId: ID;
  title: string;
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AlbumMember {
  albumId: ID;
  userId: ID;
  role: AlbumRole;
  joinedAt: Timestamp;
  /** 초대 코드로 들어온 경우 초대한 사람 */
  invitedBy: ID | null;
}

export interface AlbumMemory {
  albumId: ID;
  memoryId: ID;
  addedBy: ID;
  addedAt: Timestamp;
}

/** 초대로 줄 수 있는 역할. 소유자 권한은 초대로 넘기지 않는다. */
export type InviteRole = Exclude<AlbumRole, 'owner'>;

export interface AlbumInvite {
  id: ID;
  albumId: ID;
  albumTitle: string;
  /** 사람이 읽고 입력하기 쉬운 8자리 코드 */
  code: string;
  role: InviteRole;
  createdBy: ID;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  /** null이면 횟수 제한 없음 */
  maxUses: number | null;
  useCount: number;
  revoked: boolean;
}

export type LogTag = 'meal' | 'cafe' | 'work' | 'study' | 'move' | 'rest' | 'people' | 'etc';

/** 셋로그 스타일 시간 기록: 사진과 시간, 그리고 덧붙이는 글 */
export interface LogEntry {
  id: ID;
  ownerId: ID;
  date: ISODate;
  time: TimeOfDay;
  text: string;
  tag: LogTag | null;
  photos: PhotoRef[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/* ---------- 입력용 타입 ---------- */

export type PhotoDraft =
  | { kind: 'existing'; ref: PhotoRef }
  | { kind: 'new'; blob: Blob; mimeType: string; width: number; height: number };

export interface MemoryInput {
  title: string;
  date: ISODate;
  note: string;
  /** 화면에 놓인 순서 그대로. 0번이 대표 사진이 된다. */
  photos: PhotoDraft[];
  albumIds: ID[];
}

export interface AlbumInput {
  title: string;
  description: string;
}

export interface InviteInput {
  role: InviteRole;
  /** 유효 기간(일) */
  days: number;
  maxUses: number | null;
}

export interface LogInput {
  date: ISODate;
  time: TimeOfDay;
  text: string;
  tag: LogTag | null;
  photos: PhotoDraft[];
}
