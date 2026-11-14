/*
 * Fade & Days 설정 파일
 *
 * Node.js 없이도 이 파일만 고치면 로그인·기기 간 동기화·공유 앨범(Firebase)이 켜집니다.
 * 값을 비워 두면 로그인 없이 이 기기에만 저장하는 "로컬 모드"로 동작합니다.
 *
 * 값 찾는 곳: Firebase 콘솔 → 프로젝트 설정(톱니바퀴) → 일반 → 내 앱 → SDK 설정 및 구성 → "구성"
 * 이 값들은 비밀번호가 아니라 프로젝트 주소 같은 공개 값이라 GitHub에 올려도 됩니다.
 * 데이터는 firestore.rules 보안 규칙이 지킵니다. (반드시 규칙을 게시하세요)
 */
window.FADE_AND_DAYS_CONFIG = {
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },

  // 사진 저장 위치: 'firestore'(무료 플랜 가능, 기본) 또는 'storage'(Blaze 요금제 필요)
  photoBackend: 'firestore',
};
