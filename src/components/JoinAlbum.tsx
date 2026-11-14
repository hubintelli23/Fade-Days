import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { InvitePreview } from '../db/types';
import { formatInviteCode, normalizeInviteCode } from '../lib/id';
import { ROLE_DESCRIPTION, ROLE_LABEL } from '../lib/permissions';
import { useData } from '../store/DataContext';
import type { ID } from '../types/models';
import { Button, Field, Modal } from './ui';

const STATUS_MESSAGE: Record<Exclude<InvitePreview['status'], 'ok' | 'already-member'>, string> = {
  'not-found': '초대 코드를 찾을 수 없어요. 코드를 다시 확인해 주세요.',
  expired: '기간이 지난 초대예요. 초대한 사람에게 새 코드를 요청해 주세요.',
  revoked: '취소된 초대예요.',
  'used-up': '이미 사용된 초대예요.',
};

export function JoinAlbum({ initialCode = '', onClose, onJoined }: { initialCode?: string; onClose: () => void; onJoined: (albumId: ID) => void }) {
  const data = useData();
  const [code, setCode] = useState(formatInviteCode(normalizeInviteCode(initialCode)));
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [joining, setJoining] = useState(false);

  async function check(value: string) {
    if (normalizeInviteCode(value).length < 8) return;
    setChecking(true);
    try {
      setPreview(await data.repository.previewInvite(value));
    } catch {
      setPreview({ status: 'not-found' });
    } finally {
      setChecking(false);
    }
  }

  // 링크(?invite=)로 들어온 경우 바로 확인
  useEffect(() => {
    if (initialCode) void check(initialCode);
  }, [initialCode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (preview?.status !== 'ok') {
      await check(code);
      return;
    }
    setJoining(true);
    try {
      onJoined(await data.acceptInvite(code));
    } catch {
      setJoining(false);
    }
  }

  return (
    <Modal
      title="초대 코드로 참여"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
          {preview?.status === 'already-member' ? (
            <Button onClick={() => onJoined(preview.albumId)}>앨범 보기</Button>
          ) : (
            <Button type="submit" form="join-form" disabled={checking || joining || normalizeInviteCode(code).length < 8}>
              {preview?.status === 'ok' ? (joining ? '참여 중…' : '참여하기') : '확인'}
            </Button>
          )}
        </>
      }
    >
      <form id="join-form" onSubmit={handleSubmit}>
        <Field label="초대 코드">
          <input
            className="field text-center font-mono text-xl tracking-[0.2em] uppercase"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setPreview(null);
            }}
            placeholder="ABCD-EFGH"
            maxLength={9}
            autoCapitalize="characters"
            autoComplete="off"
            autoFocus={!initialCode}
          />
        </Field>
      </form>

      {preview?.status === 'ok' && (
        <div className="rounded-2xl bg-bg p-4">
          <div className="eyebrow">YOU'RE INVITED</div>
          <div className="mt-1.5 font-serif text-xl">{preview.invite.albumTitle || '이름 없는 앨범'}</div>
          <p className="mt-3 text-[13px]">
            <strong className="font-semibold">{ROLE_LABEL[preview.invite.role]}</strong>로 참여해요 · {ROLE_DESCRIPTION[preview.invite.role]}
          </p>
          {preview.memberCount !== null && <p className="mt-1 text-xs text-muted">현재 멤버 {preview.memberCount}명</p>}
        </div>
      )}
      {preview?.status === 'already-member' && (
        <p className="rounded-xl bg-bg p-4 text-[13px]">이미 '{preview.albumTitle}' 앨범의 멤버예요.</p>
      )}
      {preview && preview.status !== 'ok' && preview.status !== 'already-member' && (
        <p className="rounded-xl bg-danger/8 p-4 text-[13px] text-danger">{STATUS_MESSAGE[preview.status]}</p>
      )}

      {data.mode === 'local' && (
        <p className="mt-4 text-[11px] leading-relaxed text-muted">
          지금은 로컬 모드라서 같은 기기에서 만든 초대만 확인할 수 있어요. 다른 기기 간 초대는 Firebase를 연결하면 열려요.
        </p>
      )}
    </Modal>
  );
}
