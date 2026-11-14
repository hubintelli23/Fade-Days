import { useSyncExternalStore } from 'react';

/** 기기별 앱 설정. 계정과 상관없이 이 브라우저에 저장된다. */
export interface AppSettings {
  /** 타임라인 기본 정렬 */
  timelineOrder: 'newest' | 'oldest';
  /** 사진 저장 크기: 표준(긴 변 1600px) / 고화질(2400px) */
  photoQuality: 'standard' | 'high';
  /** 홈에 오늘의 로그 보이기 */
  showTodayLogOnHome: boolean;
  /** 홈에 최근 활동 보이기 */
  showActivityOnHome: boolean;
}

const KEY = 'fade-and-days:settings';
const DEFAULTS: AppSettings = {
  timelineOrder: 'newest',
  photoQuality: 'standard',
  showTodayLogOnHome: true,
  showActivityOnHome: true,
};

let current: AppSettings = read();
const listeners = new Set<() => void>();

function read(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function getSettings(): AppSettings {
  return current;
}

export function updateSettings(patch: Partial<AppSettings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // 저장 공간이 막힌 환경(사생활 보호 모드 등)에서는 이번 실행 동안만 유지
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}

export function photoMaxEdge(settings: AppSettings = current) {
  return settings.photoQuality === 'high' ? 2400 : 1600;
}
