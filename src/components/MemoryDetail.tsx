import { useRef, useState } from 'react';
import { formatLong } from '../lib/date';
import { canEditMemory, canRemoveFromAlbum } from '../lib/permissions';
import { useData } from '../store/DataContext';
import type { ID } from '../types/models';
import { PenIcon, TrashIcon } from './icons';
import { PhotoImage } from './PhotoImage';
import { Badge, Button, Modal } from './ui';

export function MemoryDetail({
  memoryId,
  fromAlbumId,
  onClose,
  onEdit,
  onOpenAlbum,
}: {
  memoryId: ID;
  /** 앨범 상세에서 열었으면 그 앨범 (앨범에서 빼기 버튼용) */
  fromAlbumId?: ID;
  onClose: () => void;
  onEdit: (id: ID) => void;
  onOpenAlbum: (id: ID) => void;
}) {
  const data = useData();
  const memory = data.memories.find((m) => m.id === memoryId);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const strip = useRef<HTMLDivElement>(null);

  if (!memory) return null;

  const albums = (data.albumIdsByMemory.get(memory.id) ?? [])
    .map((id) => data.albums.find((a) => a.id === id))
    .filter((a) => a !== undefined);
  const editable = canEditMemory(memory, data.user.id);
  const owner = data.userById.get(memory.ownerId);
  const link = fromAlbumId ? data.links.find((l) => l.albumId === fromAlbumId && l.memoryId === memory.id) : undefined;
  const removable = link && canRemoveFromAlbum(data.roleByAlbum.get(link.albumId) ?? null, link.addedBy, data.user.id);

  async function handleDelete() {
    const shared = albums.some((a) => (data.membersByAlbum.get(a.id)?.length ?? 0) > 1);
    const message = shared
      ? '이 기록을 삭제할까요?\n공유 앨범의 다른 멤버에게서도 사라져요.'
      : '이 기록을 삭제할까요? 사진도 함께 지워져요.';
    if (!window.confirm(message)) return;
    setBusy(true);
    try {
      await data.deleteMemory(memoryId);
      onClose();
    } catch {
      setBusy(false);
    }
  }

  async function handleRemoveFromAlbum() {
    if (!link || !window.confirm('이 추억을 앨범에서 뺄까요? 추억 자체는 지워지지 않아요.')) return;
    setBusy(true);
    try {
      await data.removeFromAlbum(link.albumId, memoryId);
      onClose();
    } catch {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} wide>
      <div className="-mx-6">
        {memory.photos.length === 0 ? (
          <PhotoImage photo={null} seed={memory.id} className="aspect-[16/10]" />
        ) : (
          <div className="relative bg-[#1e1b18]">
            <div
              ref={strip}
              className="scrollbar-none flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto"
              onScroll={(e) => {
                const el = e.currentTarget;
                setIndex(Math.round(el.scrollLeft / el.clientWidth));
              }}
            >
              {memory.photos.map((photo) => (
                <PhotoImage key={photo.id} photo={photo} seed={photo.id} fit="contain" className="h-full w-full shrink-0 snap-center" />
              ))}
            </div>
            {memory.photos.length > 1 && (
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                {memory.photos.map((photo, i) => (
                  <button
                    key={photo.id}
                    type="button"
                    aria-label={`${i + 1}번째 사진`}
                    onClick={() => strip.current?.scrollTo({ left: i * strip.current.clientWidth, behavior: 'smooth' })}
                    className={`size-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-6">
        <div className="eyebrow">{formatLong(memory.date)}</div>
        <h2 className="mt-2 font-serif text-[27px] leading-snug font-normal">{memory.title}</h2>
        {owner && owner.id !== data.user.id && <p className="mt-1 text-xs text-muted">{owner.displayName} 님의 기록</p>}
        {memory.note && <p className="mt-4 text-[15px] leading-[1.85] whitespace-pre-wrap">{memory.note}</p>}

        {albums.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {albums.map((album) => (
              <button key={album.id} type="button" onClick={() => onOpenAlbum(album.id)}>
                <Badge tone="accent">▧ {album.title}</Badge>
              </button>
            ))}
          </div>
        )}

        {(editable || removable) && (
          <div className="mt-7 flex flex-wrap gap-2">
            {editable && (
              <>
                <Button variant="secondary" onClick={() => onEdit(memory.id)} disabled={busy}>
                  <PenIcon size={15} /> 수정
                </Button>
                <Button variant="danger" onClick={handleDelete} disabled={busy}>
                  <TrashIcon size={15} /> 삭제
                </Button>
              </>
            )}
            {removable && (
              <Button variant="secondary" onClick={handleRemoveFromAlbum} disabled={busy}>
                앨범에서 빼기
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
