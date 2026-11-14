import type { AlbumRole, ID, Memory } from '../types/models';

/**
 * 공유 앨범 권한 규칙
 *
 *  | 할 수 있는 일              | owner | editor | viewer |
 *  |---------------------------|:-----:|:------:|:------:|
 *  | 앨범 보기                  |   ✓   |   ✓    |   ✓    |
 *  | 앨범에 추억 추가            |   ✓   |   ✓    |        |
 *  | 앨범에서 추억 빼기          |   ✓   | 본인 것 |        |
 *  | 앨범 이름·설명 수정·삭제     |   ✓   |        |        |
 *  | 멤버 초대·역할 변경·내보내기  |   ✓   |        |        |
 *  | 추억 내용 수정·삭제          | 작성자 본인만 (역할과 무관)  |
 */

export const ROLE_LABEL: Record<AlbumRole, string> = {
  owner: '소유자',
  editor: '편집자',
  viewer: '보기 전용',
};

export const ROLE_DESCRIPTION: Record<AlbumRole, string> = {
  owner: '앨범과 멤버를 모두 관리해요',
  editor: '추억을 함께 올릴 수 있어요',
  viewer: '앨범을 볼 수만 있어요',
};

export const canAddToAlbum = (role: AlbumRole | null) => role === 'owner' || role === 'editor';
export const canManageAlbum = (role: AlbumRole | null) => role === 'owner';
export const canManageMembers = (role: AlbumRole | null) => role === 'owner';

export function canRemoveFromAlbum(role: AlbumRole | null, addedBy: ID, userId: ID) {
  return role === 'owner' || (role === 'editor' && addedBy === userId);
}

export function canEditMemory(memory: Memory, userId: ID) {
  return memory.ownerId === userId;
}
