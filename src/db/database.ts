/**
 * IndexedDB 연결과 스키마 (로컬 모드 전용)
 *
 * 스키마를 바꿀 때는 DB_VERSION을 올리고 migrate()에 `if (oldVersion < N)` 블록을 추가한다.
 * 기존 블록은 지우지 않는다. (처음 설치하는 사용자는 1번부터 차례로 실행됨)
 */

const DB_NAME = 'fade-and-days';
const DB_VERSION = 2;

export const STORE = {
  users: 'users',
  memories: 'memories',
  photos: 'photos',
  albums: 'albums',
  albumMembers: 'albumMembers',
  albumMemories: 'albumMemories',
  invites: 'invites',
  logs: 'logs',
} as const;

export type StoreName = (typeof STORE)[keyof typeof STORE];

/** photos 저장소의 레코드. 추억과 로그의 사진이 함께 들어간다. */
export interface LocalPhoto {
  id: string;
  /** 사진이 속한 추억 또는 로그의 id */
  parentId: string;
  ownerId: string;
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  createdAt: number;
}

type Row = Record<string, unknown>;

/** 저장소의 모든 레코드를 한 번씩 고친다 (업그레이드 트랜잭션 안에서만 사용) */
function updateEach(store: IDBObjectStore, change: (row: Row) => Row) {
  store.openCursor().onsuccess = (event) => {
    const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
    if (!cursor) return;
    cursor.update(change(cursor.value as Row));
    cursor.continue();
  };
}

function migrate(db: IDBDatabase, tx: IDBTransaction, oldVersion: number) {
  if (oldVersion < 1) {
    db.createObjectStore(STORE.users, { keyPath: 'id' });

    const memories = db.createObjectStore(STORE.memories, { keyPath: 'id' });
    memories.createIndex('byOwner', 'ownerId');
    memories.createIndex('byDate', 'date');

    const photos = db.createObjectStore(STORE.photos, { keyPath: 'id' });
    photos.createIndex('byMemory', 'memoryId');

    const albums = db.createObjectStore(STORE.albums, { keyPath: 'id' });
    albums.createIndex('byOwner', 'ownerId');

    const members = db.createObjectStore(STORE.albumMembers, { keyPath: ['albumId', 'userId'] });
    members.createIndex('byAlbum', 'albumId');
    members.createIndex('byUser', 'userId');

    const links = db.createObjectStore(STORE.albumMemories, { keyPath: ['albumId', 'memoryId'] });
    links.createIndex('byAlbum', 'albumId');
    links.createIndex('byMemory', 'memoryId');

    const invites = db.createObjectStore(STORE.invites, { keyPath: 'id' });
    invites.createIndex('byAlbum', 'albumId');
    invites.createIndex('byCode', 'code', { unique: true });

    const logs = db.createObjectStore(STORE.logs, { keyPath: 'id' });
    logs.createIndex('byOwner', 'ownerId');
    logs.createIndex('byDate', 'date');
  }

  if (oldVersion < 2) {
    // v0.2.0: 사진을 추억·로그 공용으로(parentId), 추억과 로그에 photos 배열을 둔다
    const photos = tx.objectStore(STORE.photos);
    photos.createIndex('byParent', 'parentId');

    photos.getAll().onsuccess = (event) => {
      const all = (event.target as IDBRequest<Row[]>).result;
      const byParent = new Map<string, Row[]>();
      for (const photo of all) {
        const parentId = String(photo.parentId ?? photo.memoryId);
        const next: Row = { ...photo, parentId };
        delete next.memoryId;
        photos.put(next);
        byParent.set(parentId, [...(byParent.get(parentId) ?? []), photo]);
      }
      updateEach(tx.objectStore(STORE.memories), (memory) => {
        const list = (byParent.get(String(memory.id)) ?? []).sort((a, b) => Number(a.order) - Number(b.order));
        const next: Row = { ...memory, photos: list.map((p) => ({ id: p.id, width: p.width, height: p.height, path: null })) };
        delete next.coverPhotoId;
        delete next.photoCount;
        return next;
      });
    };
    if (photos.indexNames.contains('byMemory')) photos.deleteIndex('byMemory');

    updateEach(tx.objectStore(STORE.logs), (log) => ({ ...log, photos: log.photos ?? [] }));
    updateEach(tx.objectStore(STORE.invites), (invite) => ({ ...invite, albumTitle: invite.albumTitle ?? '' }));
    updateEach(tx.objectStore(STORE.users), (user) => ({ ...user, email: user.email ?? null }));
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('이 브라우저는 IndexedDB를 지원하지 않아요.'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => migrate(req.result, req.transaction!, event.oldVersion);
      req.onsuccess = () => {
        const db = req.result;
        // 다른 탭에서 새 버전을 열면 이 연결을 닫아 업그레이드를 막지 않게 함
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error('데이터베이스를 열 수 없어요.'));
      };
      req.onblocked = () => {
        reject(new Error('다른 탭에서 앱이 열려 있어요. 다른 탭을 닫고 새로고침해 주세요.'));
      };
    });
  }
  return dbPromise;
}

/** IDBRequest를 Promise로 */
export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 트랜잭션이 끝날 때까지 기다림 */
export function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('저장이 취소됐어요.'));
  });
}

/**
 * 트랜잭션 안에서 작업을 실행하고 커밋까지 기다린다.
 * 주의: work 안에서는 IndexedDB 요청 외의 비동기 작업(fetch, 이미지 처리 등)을 await 하면 안 된다.
 * 트랜잭션이 자동으로 닫혀 버린다. 그런 작업은 트랜잭션 시작 전에 끝내 둔다.
 */
export async function transaction<T>(
  stores: StoreName[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await getDB();
  const tx = db.transaction(stores, mode);
  const finished = done(tx);
  try {
    const result = await work(tx);
    await finished;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // 이미 끝난 트랜잭션
    }
    finished.catch(() => undefined);
    throw error;
  }
}
