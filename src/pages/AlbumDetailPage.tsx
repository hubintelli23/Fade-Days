import { useEffect, useState } from 'react';
import { MemoryCard, MemoryGrid } from '../components/MemoryCard';
import { BackIcon, PenIcon, PlusIcon, TrashIcon, UsersIcon } from '../components/icons';
import { Badge, Button, EmptyState } from '../components/ui';
import { ROLE_LABEL, canAddToAlbum, canManageAlbum } from '../lib/permissions';
import { useData } from '../store/DataContext';
import type { ID } from '../types/models';

export function AlbumDetailPage({
  albumId,
  onBack,
  onOpenMemory,
  onAddMemory,
  onEditAlbum,
  onOpenMembers,
}: {
  albumId: ID;
  onBack: () => void;
  onOpenMemory: (id: ID) => void;
  onAddMemory: () => void;
  onEditAlbum: () => void;
  onOpenMembers: () => void;
}) {
  const data = useData();
  const album = data.albums.find((a) => a.id === albumId);
  // 초대 수락 직후에는 서버에서 앨범이 내려올 때까지 잠깐 걸릴 수 있다
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaited(true), 4000);
    return () => window.clearTimeout(timer);
  }, [albumId]);

  if (!album && !waited) return <p className="py-20 text-center text-sm text-muted">앨범을 불러오는 중…</p>;
  if (!album) {
    return (
      <EmptyState action={<Button onClick={onBack}>앨범 목록으로</Button>}>앨범을 찾을 수 없어요. 삭제됐거나 나간 앨범이에요.</EmptyState>
    );
  }

  const role = data.roleByAlbum.get(albumId) ?? null;
  const memories = data.memoriesByAlbum.get(albumId) ?? [];
  const members = data.membersByAlbum.get(albumId) ?? [];

  async function handleDelete() {
    if (!window.confirm(`'${album!.title}' 앨범을 삭제할까요?\n앨범 안의 기록은 지워지지 않고 타임라인에 그대로 남아요.`)) return;
    try {
      await data.deleteAlbum(albumId);
      onBack();
    } catch {
      // 토스트로 안내됨
    }
  }

  return (
    <>
      <button type="button" onClick={onBack} className="-ml-2 mb-4 flex items-center gap-1 rounded-full py-1.5 pr-3 pl-2 text-[13px] text-muted hover:bg-soft">
        <BackIcon size={16} /> 앨범
      </button>

      <div className="eyebrow">Album</div>
      <h1 className="mt-2.5 mb-2 font-serif text-[clamp(30px,5vw,44px)] leading-tight font-normal">{album.title}</h1>
      {album.description && <p className="text-sm text-muted">{album.description}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onOpenMembers} className="flex items-center gap-2 rounded-full border border-line bg-paper py-1.5 pr-3.5 pl-1.5 hover:bg-soft/60">
          <span className="flex -space-x-2">
            {members.slice(0, 4).map((m) => (
              <span key={m.userId} className="grid size-7 place-items-center rounded-full border-2 border-paper bg-soft font-serif text-xs">
                {(data.userById.get(m.userId)?.displayName ?? '?').slice(0, 1)}
              </span>
            ))}
          </span>
          <span className="text-[13px]">{members.length > 1 ? `멤버 ${members.length}명` : '멤버 초대'}</span>
          <UsersIcon size={15} className="text-muted" />
        </button>
        {role && role !== 'owner' && <Badge>{ROLE_LABEL[role]}</Badge>}
      </div>

      <div className="mt-6 mb-5 flex flex-wrap gap-2">
        {canAddToAlbum(role) && (
          <Button onClick={onAddMemory}>
            <PlusIcon size={16} /> 기록 추가
          </Button>
        )}
        {canManageAlbum(role) && (
          <>
            <Button variant="secondary" onClick={onEditAlbum}>
              <PenIcon size={15} /> 수정
            </Button>
            <Button variant="secondary" onClick={handleDelete}>
              <TrashIcon size={15} /> 삭제
            </Button>
          </>
        )}
      </div>

      {memories.length === 0 ? (
        <EmptyState>
          아직 이 앨범에 담긴 기록이 없어요.
          {canAddToAlbum(role) && (
            <>
              <br />새 기록을 추가하거나, 기존 기록의 수정 화면에서 이 앨범을 골라 보세요.
            </>
          )}
        </EmptyState>
      ) : (
        <MemoryGrid>
          {memories.map((m) => (
            <MemoryCard
              key={m.id}
              memory={m}
              onOpen={onOpenMemory}
              ownerName={members.length > 1 ? data.userById.get(m.ownerId)?.displayName : undefined}
            />
          ))}
        </MemoryGrid>
      )}
    </>
  );
}
