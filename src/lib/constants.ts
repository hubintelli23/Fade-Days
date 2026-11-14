export const APP_VERSION = '0.2.0';

/** 추억 하나에 넣을 수 있는 사진 수 */
export const MAX_PHOTOS_PER_MEMORY = 10;
/** 시간 로그 하나에 넣을 수 있는 사진 수 */
export const MAX_PHOTOS_PER_LOG = 4;

export const LIMITS = {
  memoryTitle: 50,
  memoryNote: 1000,
  albumTitle: 30,
  albumDescription: 100,
  logText: 300,
  displayName: 20,
} as const;

/** 로컬 모드의 기본 사용자. Firebase 모드에서는 Auth uid를 쓴다. */
export const LOCAL_USER_ID = 'local-user';
