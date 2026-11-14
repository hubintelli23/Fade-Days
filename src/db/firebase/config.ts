/**
 * Firebase 설정은 .env.local 파일의 VITE_FIREBASE_* 값에서 읽는다. (README의 "Firebase 연결" 참고)
 * 값이 비어 있으면 앱은 로그인 없는 로컬 모드로 동작한다.
 */

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

/**
 * 사진을 어디에 저장할지
 *  - 'firestore' (기본): Firestore 문서에 사진 데이터를 직접 저장. 무료(Spark) 플랜에서도 동작. 사진 한 장 900KB 이하로 자동 압축.
 *  - 'storage'          : Cloud Storage for Firebase. Blaze 요금제가 필요하지만 원본에 가까운 화질로 저장 가능.
 */
export const photoBackend: 'firestore' | 'storage' = env.VITE_PHOTO_BACKEND === 'storage' ? 'storage' : 'firestore';
