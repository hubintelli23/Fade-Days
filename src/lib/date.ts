import type { ISODate, TimeOfDay } from '../types/models';

const pad = (n: number) => String(n).padStart(2, '0');

/** 로컬 시간 기준 오늘 날짜. toISOString()은 UTC라서 한국 오전에 하루 전 날짜가 나온다. */
export function todayISO(now: Date = new Date()): ISODate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function nowTime(now: Date = new Date()): TimeOfDay {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function parseISO(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISO(date);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

/** 2026.11.14 */
export function formatDot(date: ISODate): string {
  return date.replaceAll('-', '.');
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 2026년 11월 14일 토요일 */
export function formatLong(date: ISODate): string {
  const d = parseISO(date);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}

/** 11월 14일 (토) */
export function formatShort(date: ISODate): string {
  const d = parseISO(date);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

/** 오후 2:30 */
export function formatTime(time: TimeOfDay): string {
  const [h, m] = time.split(':').map(Number);
  const period = h < 12 ? '오전' : '오후';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${hour12}:${pad(m)}`;
}

export function yearOf(date: ISODate): number {
  return Number(date.slice(0, 4));
}

export function monthOf(date: ISODate): number {
  return Number(date.slice(5, 7));
}

/** 방금 전 / 5분 전 / 3시간 전 / 어제 / 3일 전 / 2026.11.02 */
export function formatRelative(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return formatDot(todayISO(new Date(timestamp)));
}

/** MM-DD 가 같고 연도만 다른지 */
export function isSameDayOfYear(a: ISODate, b: ISODate): boolean {
  return a.slice(5) === b.slice(5);
}
