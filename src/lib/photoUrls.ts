import type { Repository } from '../db/types';
import type { ID, PhotoRef } from '../types/models';

/**
 * 사진 → 화면용 URL 캐시
 * 같은 사진이 홈·타임라인·앨범에 동시에 보여도 한 번만 읽는다.
 */
let source: Repository | null = null;
const cache = new Map<ID, Promise<string | null>>();

function revoke(entry: Promise<string | null>) {
  void entry.then((url) => url?.startsWith('blob:') && URL.revokeObjectURL(url));
}

/** 로그인 사용자가 바뀌면 저장소를 바꾸고 캐시를 비운다 */
export function setPhotoSource(repository: Repository | null) {
  if (source === repository) return;
  source = repository;
  cache.forEach(revoke);
  cache.clear();
}

export function getPhotoUrl(ref: PhotoRef): Promise<string | null> {
  let entry = cache.get(ref.id);
  if (!entry) {
    entry = source ? source.getPhotoSrc(ref).catch(() => null) : Promise.resolve(null);
    cache.set(ref.id, entry);
    // 실패한 것은 다음에 다시 시도할 수 있게 지운다
    void entry.then((url) => url === null && cache.get(ref.id) === entry && cache.delete(ref.id));
  }
  return entry;
}

/** 더 이상 어디에도 없는 사진의 URL을 메모리에서 해제 */
export function releaseUnusedPhotos(aliveIds: Set<ID>) {
  for (const [id, entry] of cache) {
    if (aliveIds.has(id)) continue;
    revoke(entry);
    cache.delete(id);
  }
}
