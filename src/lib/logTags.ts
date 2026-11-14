import type { LogTag } from '../types/models';

export const LOG_TAGS: { id: LogTag; label: string; icon: string }[] = [
  { id: 'meal', label: '식사', icon: '🍚' },
  { id: 'cafe', label: '카페', icon: '☕' },
  { id: 'work', label: '일', icon: '💼' },
  { id: 'study', label: '공부', icon: '📖' },
  { id: 'move', label: '이동', icon: '🚶' },
  { id: 'rest', label: '휴식', icon: '🌙' },
  { id: 'people', label: '만남', icon: '🤝' },
  { id: 'etc', label: '기타', icon: '·' },
];

export function logTagInfo(tag: LogTag | null) {
  return LOG_TAGS.find((t) => t.id === tag) ?? null;
}
