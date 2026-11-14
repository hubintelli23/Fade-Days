/** Firebase 등에서 온 오류를 사용자에게 보여 줄 한국어 문장으로 */

const MESSAGES: Record<string, string> = {
  // Auth
  'auth/invalid-email': '이메일 형식이 올바르지 않아요.',
  'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않아요.',
  'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않아요.',
  'auth/user-not-found': '가입되지 않은 이메일이에요.',
  'auth/email-already-in-use': '이미 가입된 이메일이에요. 로그인해 주세요.',
  'auth/weak-password': '비밀번호는 6자 이상으로 정해 주세요.',
  'auth/missing-password': '비밀번호를 입력해 주세요.',
  'auth/popup-closed-by-user': '로그인 창이 닫혔어요.',
  'auth/cancelled-popup-request': '로그인 창이 닫혔어요.',
  'auth/popup-blocked': '팝업이 차단됐어요. 브라우저에서 팝업을 허용해 주세요.',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요.',
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.',
  'auth/unauthorized-domain': '이 주소는 Firebase의 승인된 도메인에 등록되어 있지 않아요.',
  'auth/operation-not-allowed': 'Firebase 콘솔에서 이 로그인 방식을 사용 설정해 주세요.',
  // Firestore / Storage
  'permission-denied': '권한이 없어요.',
  'unavailable': '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.',
  'resource-exhausted': '오늘 사용할 수 있는 무료 사용량을 넘었어요.',
  'storage/unauthorized': '사진을 올릴 권한이 없어요.',
  'storage/quota-exceeded': '사진 저장 공간이 가득 찼어요.',
};

export function errorMessage(error: unknown, fallback = '문제가 생겼어요. 다시 시도해 주세요.'): string {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') {
      if (MESSAGES[code]) return MESSAGES[code];
      // firestore/permission-denied 같은 형태
      const short = code.split('/').pop() ?? '';
      if (MESSAGES[short]) return MESSAGES[short];
    }
    if (error instanceof Error && error.message && !error.message.startsWith('Firebase')) return error.message;
  }
  return fallback;
}
