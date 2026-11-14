import { useState } from 'react';
import type { FormEvent } from 'react';
import { LIMITS, MAX_PHOTOS_PER_LOG } from '../lib/constants';
import { nowTime, todayISO } from '../lib/date';
import { LOG_TAGS } from '../lib/logTags';
import { useData } from '../store/DataContext';
import type { ISODate, LogEntry, LogTag } from '../types/models';
import { PhotoPicker, itemsFromRefs } from './PhotoPicker';
import type { PhotoItem } from './PhotoPicker';
import { Button, Chip, Field, Modal } from './ui';

/** 셋로그 스타일: 지금 이 순간의 사진 + 시간 + 덧붙이는 글 */
export function LogEditor({ entry, date, onClose }: { entry?: LogEntry; date?: ISODate; onClose: () => void }) {
  const data = useData();
  const [day, setDay] = useState(entry?.date ?? date ?? todayISO());
  const [time, setTime] = useState(entry?.time ?? nowTime());
  const [text, setText] = useState(entry?.text ?? '');
  const [tag, setTag] = useState<LogTag | null>(entry?.tag ?? null);
  const [items, setItems] = useState<PhotoItem[]>(() => itemsFromRefs(entry?.photos ?? []));
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const empty = !text.trim() && items.length === 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (empty) {
      setError('사진이나 글 중 하나는 남겨 주세요.');
      return;
    }
    setSaving(true);
    try {
      await data.saveLog({ date: day, time, text, tag, photos: items.map((i) => i.draft) }, entry?.id);
      onClose();
    } catch {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry || !window.confirm('이 로그를 지울까요?')) return;
    await data.deleteLog(entry.id).then(onClose, () => undefined);
  }

  return (
    <Modal
      title={entry ? '로그 수정' : '지금 이 순간'}
      onClose={onClose}
      footer={
        <>
          {entry && (
            <Button variant="danger" onClick={handleDelete} className="mr-auto">
              삭제
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="log-form" disabled={saving || processing || empty}>
            {saving ? '저장 중…' : '남기기'}
          </Button>
        </>
      }
    >
      <form id="log-form" onSubmit={handleSubmit}>
        <PhotoPicker
          items={items}
          onChange={setItems}
          max={MAX_PHOTOS_PER_LOG}
          maxBytes={data.repository.maxPhotoBytes}
          onError={setError}
          onBusyChange={setProcessing}
          hint="순서대로 보여요"
          capture
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="날짜">
            <input className="field" type="date" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value)} required />
          </Field>
          <Field label="시간">
            <input className="field" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </Field>
        </div>
        <Field label="글 (선택)" hint={`${text.length}/${LIMITS.logText}`}>
          <textarea
            className="field min-h-20 resize-none leading-relaxed"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={LIMITS.logText}
            placeholder="예) 창가 자리에서 책 읽는 중"
          />
        </Field>
        <div className="mt-1 mb-1.5 text-xs text-muted">분류 (선택)</div>
        <div className="flex flex-wrap gap-2">
          {LOG_TAGS.map((t) => (
            <Chip key={t.id} active={tag === t.id} onClick={() => setTag(tag === t.id ? null : t.id)}>
              {t.icon} {t.label}
            </Chip>
          ))}
        </div>
        {error && <p className="mt-4 rounded-xl bg-danger/8 px-3 py-2.5 text-[13px] text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
