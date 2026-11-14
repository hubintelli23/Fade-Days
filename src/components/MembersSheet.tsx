import { useState } from 'react';
import { isInviteActive } from '../db/types';
import { formatInviteCode } from '../lib/id';
import { ROLE_DESCRIPTION, ROLE_LABEL, canManageMembers } from '../lib/permissions';
import { useData, useToast } from '../store/DataContext';
import type { AlbumInvite, ID, InviteRole } from '../types/models';
import { LinkIcon } from './icons';
import { Badge, Button, Chip, Modal } from './ui';

export function inviteLink(code: string) {
  return `${window.location.origin}${window.location.pathname}?invite=${code}`;
}

const DAY_OPTIONS = [1, 7, 30];

export function MembersSheet({ albumId, onClose, onLeft }: { albumId: ID; onClose: () => void; onLeft: () => void }) {
  const data = useData();
  const { notify } = useToast();
  const album = data.albums.find((a) => a.id === albumId);
  const myRole = data.roleByAlbum.get(albumId) ?? null;
  const isOwner = canManageMembers(myRole);
  const members = data.membersByAlbum.get(albumId) ?? [];
  const invites = (data.invitesByAlbum.get(albumId) ?? []).filter((i) => isInviteActive(i));

  const [role, setRole] = useState<InviteRole>('editor');
  const [days, setDays] = useState(7);
  const [singleUse, setSingleUse] = useState(false);
  const [creating, setCreating] = useState(false);
  const [latest, setLatest] = useState<AlbumInvite | null>(null);

  if (!album) return null;

  async function createInvite() {
    setCreating(true);
    try {
      setLatest(await data.createInvite(albumId, { role, days, maxUses: singleUse ? 1 : null }));
    } catch {
      // 토스트로 이미 안내됨
    } finally {
      setCreating(false);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify(`${label}를 복사했어요.`);
    } catch {
      window.prompt('아래 내용을 복사해 주세요.', text);
    }
  }

  async function share(invite: AlbumInvite) {
    const text = `Fade & Days의 '${album!.title}' 앨범에 초대해요.\n초대 코드: ${formatInviteCode(invite.code)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Fade & Days 앨범 초대', text, url: inviteLink(invite.code) });
      } catch {
        // 사용자가 공유 창을 닫음
      }
    } else {
      await copy(`${text}\n${inviteLink(invite.code)}`, '초대 메시지');
    }
  }

  async function leave() {
    if (!window.confirm(`'${album!.title}' 앨범에서 나갈까요?\n내가 올린 추억은 앨범에서 빠지고, 내 타임라인에는 그대로 남아요.`)) return;
    try {
      await data.removeMember(albumId, data.user.id);
      onLeft();
    } catch {
      // 토스트로 안내됨
    }
  }

  return (
    <Modal title="멤버와 초대" onClose={onClose}>
      {/* 멤버 목록 */}
      <ul className="mt-2 divide-y divide-line">
        {members.map((member) => {
          const user = data.userById.get(member.userId);
          const isMe = member.userId === data.user.id;
          const name = user?.displayName ?? '알 수 없는 사용자';
          return (
            <li key={member.userId} className="flex items-center gap-3 py-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-soft font-serif text-lg">{name.slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {name}
                  {isMe && name !== '나' && <span className="ml-1 text-xs font-normal text-muted">(나)</span>}
                </div>
                <div className="text-xs text-muted">{ROLE_DESCRIPTION[member.role]}</div>
              </div>
              {isOwner && member.role !== 'owner' ? (
                <div className="flex items-center gap-1">
                  <select
                    className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs"
                    value={member.role}
                    onChange={(e) => void data.changeMemberRole(albumId, member.userId, e.target.value as InviteRole).catch(() => undefined)}
                  >
                    <option value="editor">{ROLE_LABEL.editor}</option>
                    <option value="viewer">{ROLE_LABEL.viewer}</option>
                  </select>
                  <button
                    type="button"
                    className="px-2 py-1 text-xs text-danger"
                    onClick={() => {
                      if (window.confirm(`${name} 님을 앨범에서 내보낼까요?\n이 사람이 올린 추억도 앨범에서 빠져요.`)) {
                        void data.removeMember(albumId, member.userId).catch(() => undefined);
                      }
                    }}
                  >
                    내보내기
                  </button>
                </div>
              ) : (
                <Badge tone={member.role === 'owner' ? 'accent' : 'soft'}>{ROLE_LABEL[member.role]}</Badge>
              )}
            </li>
          );
        })}
      </ul>

      {isOwner ? (
        <section className="mt-6 rounded-2xl bg-bg p-4">
          <h3 className="text-sm font-semibold">새 멤버 초대</h3>
          <div className="mt-3 text-xs text-muted">역할</div>
          <div className="mt-1.5 flex gap-2">
            {(['editor', 'viewer'] as const).map((r) => (
              <Chip key={r} active={role === r} onClick={() => setRole(r)}>
                {ROLE_LABEL[r]}
              </Chip>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted">유효 기간</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {DAY_OPTIONS.map((d) => (
              <Chip key={d} active={days === d} onClick={() => setDays(d)}>
                {d}일
              </Chip>
            ))}
            <Chip active={singleUse} onClick={() => setSingleUse((v) => !v)}>
              한 명만
            </Chip>
          </div>
          <Button className="mt-4 w-full" onClick={createInvite} disabled={creating}>
            <LinkIcon size={16} /> 초대 코드 만들기
          </Button>

          {latest && (
            <div className="mt-4 rounded-xl border border-line bg-paper p-4 text-center">
              <div className="eyebrow">INVITE CODE</div>
              <div className="mt-2 font-serif text-3xl tracking-[0.12em]">{formatInviteCode(latest.code)}</div>
              <div className="mt-1 text-xs text-muted">
                {ROLE_LABEL[latest.role]} · {new Date(latest.expiresAt).toLocaleDateString('ko-KR')}까지
              </div>
              <div className="mt-3 flex justify-center gap-2">
                <Button variant="secondary" onClick={() => copy(formatInviteCode(latest.code), '초대 코드')}>
                  코드 복사
                </Button>
                <Button variant="secondary" onClick={() => share(latest)}>
                  링크 공유
                </Button>
              </div>
            </div>
          )}

          {invites.length > 0 && (
            <div className="mt-5">
              <div className="mb-1 text-xs text-muted">사용 가능한 초대</div>
              <ul className="divide-y divide-line">
                {invites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between py-2.5 text-[13px]">
                    <span>
                      <span className="font-mono tracking-wider">{formatInviteCode(invite.code)}</span>
                      <span className="ml-2 text-xs text-muted">
                        {ROLE_LABEL[invite.role]}
                        {invite.maxUses !== null && ` · ${invite.useCount}/${invite.maxUses}명`}
                      </span>
                    </span>
                    <button type="button" className="text-xs text-danger" onClick={() => void data.revokeInvite(invite.id).catch(() => undefined)}>
                      취소
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            {data.mode === 'firebase'
              ? '초대받은 사람이 로그인한 뒤 코드를 입력하거나 링크를 열면 이 앨범에 참여해요.'
              : '지금은 로컬 모드라서 기록이 이 기기에만 저장돼요. 다른 기기에서 참여하려면 Firebase를 연결해 주세요. (README 참고)'}
          </p>
        </section>
      ) : (
        <div className="mt-6">
          <Button variant="danger" onClick={leave}>
            앨범 나가기
          </Button>
        </div>
      )}
    </Modal>
  );
}
