import { useState } from 'react';
import type { FormEvent } from 'react';
import { LIMITS, MAX_PHOTOS_PER_MEMORY } from '../lib/constants';
import { todayISO } from '../lib/date';
import { canAddToAlbum } from '../lib/permissions';
import { useData } from '../store/DataContext';
import type { ID, ISODate, Memory } from '../types/models';
import { PhotoPicker, itemsFromRefs } from './PhotoPicker';
import type { PhotoItem } from './PhotoPicker';
import { Button, Chip, Field, Modal } from './ui';

export function MemoryEditor({
  memory,
  presetAlbumId,
  presetDate,
  onClose,
  onSaved,
}: {
  memory?: Memory;
  presetAlbumId?: ID;
  presetDate?: ISODate;
  onClose: () => void;
  onSaved?: (memoryId: ID) => void;
}) {
  const data = useData();
  const [title, setTitle] = useState(memory?.title ?? '');
  const [date, setDate] = useState(memory?.date ?? presetDate ?? todayISO());
  const [note, setNote] = useState(memory?.note ?? '');
  const [albumIds, setAlbumIds] = useState<ID[]>(
    memory ? (data.albumIdsByMemory.get(memory.id) ?? []) : presetAlbumId ? [presetAlbumId] : [],
  );
  const [items, setItems] = useState<PhotoItem[]>(() => itemsFromRefs(memory?.photos ?? []));
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAlbum(id: ID) {
    setAlbumIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('제목을 적어 주세요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await data.saveMemory({ title, date, note, photos: items.map((item) => item.draft), albumIds }, memory?.id);
      onClose();
      onSaved?.(saved.id);
    } catch {
      setSaving(false);
    }
  }

  // 추억을 넣을 수 있는 앨범(소유자·편집자) + 이미 들어가 있는 앨범
  const selectableAlbums = data.albums.filter((a) => canAddToAlbum(data.roleByAlbum.get(a.id) ?? null) || albumIds.includes(a.id));
  const newPhotos = items.filter((i) => i.draft.kind === 'new').length;

  return (
    <Modal
      title={memory ? '기록 수정' : '새로운 기록'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="memory-form" disabled={saving || processing}>
            {saving ? (newPhotos && data.mode === 'firebase' ? '사진 올리는 중…' : '저장 중…') : memory ? '수정 완료' : '기록 남기기'}
          </Button>
        </>
      }
    >
      <form id="memory-form" onSubmit={handleSubmit}>
        <PhotoPicker
          items={items}
          onChange={setItems}
          max={MAX_PHOTOS_PER_MEMORY}
          maxBytes={data.repository.maxPhotoBytes}
          onError={setError}
          onBusyChange={setProcessing}
        />

        <Field label="제목" hint={`${title.length}/${LIMITS.memoryTitle}`}>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.memoryTitle}
            placeholder="오늘의 순간을 적어 주세요"
            required
          />
        </Field>
        <Field label="날짜">
          <input className="field" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="메모" hint={`${note.length}/${LIMITS.memoryNote}`}>
          <textarea
            className="field min-h-24 resize-y leading-relaxed"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={LIMITS.memoryNote}
            placeholder="이날의 기억을 남겨 보세요."
          />
        </Field>

        {selectableAlbums.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-xs text-muted">앨범에 넣기</div>
            <div className="flex flex-wrap gap-2">
              {selectableAlbums.map((album) => (
                <Chip key={album.id} active={albumIds.includes(album.id)} onClick={() => toggleAlbum(album.id)}>
                  {album.title}
                  {(data.membersByAlbum.get(album.id)?.length ?? 0) > 1 && ' · 공유'}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-danger/8 px-3 py-2.5 text-[13px] text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
