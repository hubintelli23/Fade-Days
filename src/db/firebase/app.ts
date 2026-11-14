import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from './config';

/**
 * 이 파일은 Firebase 설정이 있을 때만 동적으로 import 된다.
 * (로컬 모드에서는 Firebase SDK를 내려받지 않아 첫 화면이 가볍다)
 */

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

let firestore: Firestore;
try {
  // 오프라인 캐시: 인터넷이 끊겨도 마지막으로 본 기록을 보여 주고, 작성한 글은 연결되면 올라간다
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });
} catch {
  // 개발 서버의 HMR 등으로 이미 초기화된 경우
  firestore = getFirestore(app);
}
export const db = firestore;

/** Storage는 VITE_PHOTO_BACKEND=storage 일 때만 쓰므로 필요할 때 만든다 */
export const getStorageInstance = () => getStorage(app);
