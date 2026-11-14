import { useState } from 'react';
import type { FormEvent } from 'react';
import { LIMITS } from '../lib/constants';
import { useData } from '../store/DataContext';
import type { Album, ID } from '../types/models';
import { Button, Field, Modal } from './ui';

export function AlbumEditor({ album, onClose, onSaved }: { album?: Album; onClose: () => void; onSaved?: (id: ID) => void }) {
  const data = useData();
  const [title, setTitle] = useState(album?.title ?? '');
  const [description, setDescription] = useState(album?.description ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const saved = await data.saveAlbum({ title, description }, album?.id);
      onClose();
      onSaved?.(saved.id);
    } catch {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={album ? '앨범 수정' : '새 앨범'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="album-form" disabled={saving || !title.trim()}>
            {album ? '수정 완료' : '만들기'}
          </Button>
        </>
      }
    >
      <form id="album-form" onSubmit={handleSubmit}>
        <Field label="앨범 이름" hint={`${title.length}/${LIMITS.albumTitle}`}>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.albumTitle}
            placeholder="예) 우리의 여름"
            autoFocus
            required
          />
        </Field>
        <Field label="설명" hint={`${description.length}/${LIMITS.albumDescription}`}>
          <input
            className="field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={LIMITS.albumDescription}
            placeholder="어떤 순간을 모을 앨범인가요?"
          />
        </Field>
        {!album && <p className="mt-3 text-xs leading-relaxed text-muted">앨범을 만든 뒤 멤버를 초대하면 공유 앨범이 돼요.</p>}
      </form>
    </Modal>
  );
}
