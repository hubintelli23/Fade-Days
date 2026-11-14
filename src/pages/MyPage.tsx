import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { MemoryCard, MemoryGrid } from '../components/MemoryCard';
import { ChevronRightIcon, LockIcon, UsersIcon } from '../components/icons';
import { Badge, Button, PageTitle, SectionHead } from '../components/ui';
import { APP_VERSION, LIMITS } from '../lib/constants';
import { isIOS, isStandalone, promptInstall, useCanInstall } from '../lib/install';
import { ROLE_LABEL } from '../lib/permissions';
import { updateSettings, useSettings } from '../lib/settings';
import { useAuth } from '../store/AuthContext';
import { useData } from '../store/DataContext';
import type { ID } from '../types/models';

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
}

function Row({ label, children, onClick }: { label: ReactNode; children?: ReactNode; onClick?: () => void }) {
  const content = (
    <>
      <span className="min-w-0 flex-1">{label}</span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
        {children}
        {onClick && <ChevronRightIcon size={15} />}
      </span>
    </>
  );
  const cls = 'flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-sm';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:bg-soft/40`}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line'}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <section className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-paper">{children}</section>;
}

export function MyPage({
  onJoin,
  onOpenMemory,
  onOpenAlbum,
  onSeeMyMemories,
}: {
  onJoin: () => void;
  onOpenMemory: (id: ID) => void;
  onOpenAlbum: (id: ID) => void;
  onSeeMyMemories: () => void;
}) {
  const data = useData();
  const auth = useAuth();
  const settings = useSettings();
  const canInstall = useCanInstall();
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(data.user.displayName);

  useEffect(() => {
    if (data.mode !== 'local') return;
    void navigator.storage?.estimate?.().then((e) => setStorage({ usage: e.usage ?? 0, quota: e.quota ?? 0 }));
  }, [data.version, data.mode]);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await data.updateDisplayName(name.trim()).then(() => setEditing(false), () => undefined);
  }

  const me = data.user.id;
  const myMemories = data.memories.filter((m) => m.ownerId === me);
  const myAlbums = data.albums.filter((a) => a.ownerId === me);
  const joinedAlbums = data.albums.filter((a) => a.ownerId !== me);
  const photoCount = [...myMemories, ...data.logs].reduce((n, item) => n + item.photos.length, 0);

  const stats = [
    { label: '추억', value: myMemories.length },
    { label: '사진', value: photoCount },
    { label: '시간 로그', value: data.logs.length },
    { label: '앨범', value: data.albums.length },
  ];

  const albumRow = (albumId: ID, title: string) => {
    const members = data.membersByAlbum.get(albumId)?.length ?? 1;
    const role = data.roleByAlbum.get(albumId);
    return (
      <Row
        key={albumId}
        label={
          <span className="flex items-center gap-2">
            <span className="truncate">{title}</span>
            {role && role !== 'owner' && <Badge>{ROLE_LABEL[role]}</Badge>}
          </span>
        }
        onClick={() => onOpenAlbum(albumId)}
      >
        기록 {data.memoriesByAlbum.get(albumId)?.length ?? 0}
        {members > 1 ? (
          <>
            {' · '}
            <UsersIcon size={12} /> {members}
          </>
        ) : (
          <>
            {' · '}
            <LockIcon size={11} />
          </>
        )}
      </Row>
    );
  };

  return (
    <>
      <PageTitle eyebrow="Your space" title="마이" sub="나만의 기록 공간을 관리해요." />

      {/* 프로필 */}
      <section className="rounded-3xl border border-line bg-paper p-6">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-soft font-serif text-[26px]">{data.user.displayName.slice(0, 1)}</div>
          {editing ? (
            <form onSubmit={saveName} className="flex flex-1 gap-2">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.displayName} autoFocus />
              <Button type="submit">저장</Button>
            </form>
          ) : (
            <div className="min-w-0 flex-1">
              <strong className="text-lg font-semibold">{data.user.displayName}</strong>
              <p className="mt-0.5 truncate text-xs text-muted">{data.user.email ?? '로컬 모드 · 이 기기에만 저장'}</p>
            </div>
          )}
          {!editing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              편집
            </Button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-4 divide-x divide-line rounded-2xl bg-bg py-4 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="font-serif text-2xl">{s.value}</div>
              <div className="mt-1 text-[11px] text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 내가 작성한 추억 */}
      <SectionHead
        title="내가 작성한 추억"
        action={
          myMemories.length > 4 && (
            <button type="button" className="text-[13px] text-accent" onClick={onSeeMyMemories}>
              모두 보기 →
            </button>
          )
        }
      />
      {myMemories.length > 0 ? (
        <MemoryGrid>
          {myMemories.slice(0, 4).map((m) => (
            <MemoryCard key={m.id} memory={m} onOpen={onOpenMemory} />
          ))}
        </MemoryGrid>
      ) : (
        <p className="rounded-2xl border border-dashed border-line bg-paper py-5 text-center text-sm text-muted">아직 작성한 추억이 없어요.</p>
      )}

      {/* 앨범 */}
      <SectionHead title="내 앨범" />
      <Card>
        {myAlbums.length > 0 ? myAlbums.map((a) => albumRow(a.id, a.title)) : <Row label={<span className="text-muted">내가 만든 앨범이 없어요</span>} />}
      </Card>
      {joinedAlbums.length > 0 && (
        <>
          <h3 className="mt-5 mb-2 px-1 text-[13px] text-muted">참여 중인 공유 앨범</h3>
          <Card>{joinedAlbums.map((a) => albumRow(a.id, a.title))}</Card>
        </>
      )}

      {/* 계정 및 공유 */}
      <SectionHead title="계정 및 공유" />
      <Card>
        <Row label="저장 방식">{data.mode === 'firebase' ? '계정에 저장 · 기기 간 동기화' : '이 기기에만 저장'}</Row>
        {data.user.email && <Row label="이메일">{data.user.email}</Row>}
        <Row label="초대 코드로 앨범 참여" onClick={onJoin} />
        {data.mode === 'firebase' ? (
          <Row
            label={<span className="text-danger">로그아웃</span>}
            onClick={() => {
              if (window.confirm('로그아웃할까요? 기록은 계정에 안전하게 남아 있어요.')) void auth.signOut();
            }}
          />
        ) : (
          <div className="px-5 py-3.5 text-xs leading-relaxed text-muted">
            로그인과 기기 간 동기화, 다른 사람과의 앨범 공유는 Firebase를 연결하면 사용할 수 있어요. (README의 "Firebase 연결" 참고)
          </div>
        )}
      </Card>

      {/* 앱 설정 */}
      <SectionHead title="앱 설정" />
      <Card>
        <Row label="타임라인 정렬">
          <select
            className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs text-ink"
            value={settings.timelineOrder}
            onChange={(e) => updateSettings({ timelineOrder: e.target.value as 'newest' | 'oldest' })}
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
          </select>
        </Row>
        <Row
          label={
            <>
              사진 저장 화질
              {data.repository.maxPhotoBytes && <span className="block text-[11px] text-muted">무료 플랜 모드에서는 한 장 900KB 이하로 자동 조절돼요</span>}
            </>
          }
        >
          <select
            className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs text-ink"
            value={settings.photoQuality}
            onChange={(e) => updateSettings({ photoQuality: e.target.value as 'standard' | 'high' })}
          >
            <option value="standard">표준</option>
            <option value="high">고화질</option>
          </select>
        </Row>
        <Row label="홈에 오늘의 로그 보이기">
          <Toggle label="홈에 오늘의 로그 보이기" checked={settings.showTodayLogOnHome} onChange={(v) => updateSettings({ showTodayLogOnHome: v })} />
        </Row>
        <Row label="홈에 최근 활동 보이기">
          <Toggle label="홈에 최근 활동 보이기" checked={settings.showActivityOnHome} onChange={(v) => updateSettings({ showActivityOnHome: v })} />
        </Row>
        {!isStandalone() &&
          (canInstall ? (
            <Row label="홈 화면에 앱 추가" onClick={() => void promptInstall()} />
          ) : isIOS() ? (
            <Row label="홈 화면에 앱 추가">Safari 공유 버튼 → 홈 화면에 추가</Row>
          ) : null)}
        {data.mode === 'local' && (
          <Row label="저장 공간">{storage ? `${formatBytes(storage.usage)} 사용 중${storage.quota ? ` / ${formatBytes(storage.quota)}` : ''}` : '확인 중…'}</Row>
        )}
        <Row label="백업 · 복원">준비 중</Row>
      </Card>

      {data.mode === 'local' && (
        <p className="mt-5 px-2 text-xs leading-relaxed text-muted">
          지금은 모든 기록이 이 기기의 브라우저 안에만 저장돼요. 브라우저의 사이트 데이터를 지우면 기록도 함께 사라지니 주의해 주세요.
        </p>
      )}
      <p className="mt-6 text-center text-[10px] tracking-[0.2em] text-[#aaa092]">FADE & DAYS · v{APP_VERSION}</p>
    </>
  );
}
