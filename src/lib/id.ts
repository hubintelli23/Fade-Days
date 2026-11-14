export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // randomUUID가 없는 환경(http로 접속한 일부 모바일 브라우저 등) 대비
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 헷갈리는 글자(0/O, 1/I/L)를 뺀 문자 */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** 초대 코드: 8자리, 표시할 때는 4자리씩 끊는다(ABCD-EFGH) */
export function createInviteCode(length = 8): string {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => CODE_CHARS[v % CODE_CHARS.length]).join('');
}

export function formatInviteCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** 사용자가 입력한 코드를 정규화(공백·하이픈 제거, 대문자) */
export function normalizeInviteCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}
