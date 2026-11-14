import { useEffect, useRef, useState } from 'react';
import { createId } from '../lib/id';
import { processImage } from '../lib/image';
import type { PhotoDraft, PhotoRef } from '../types/models';
import { ArrowLeftIcon, CameraIcon, CloseIcon } from './icons';
import { PhotoImage } from './PhotoImage';

export interface PhotoItem {
  key: string;
  draft: PhotoDraft;
  /** 새로 고른 사진의 미리보기 URL */
  previewUrl?: string;
}

export function itemsFromRefs(refs: PhotoRef[]): PhotoItem[] {
  return refs.map((ref) => ({ key: ref.id, draft: { kind: 'existing', ref } }));
}

/**
 * 사진 고르기 + 순서 바꾸기 + 빼기
 * 추억 작성과 시간 로그에서 함께 쓴다.
 */
export function PhotoPicker({
  items,
  onChange,
  max,
  maxBytes,
  onError,
  onBusyChange,
  hint = '첫 사진이 대표 사진이에요',
  capture = false,
}: {
  items: PhotoItem[];
  onChange: (updater: (prev: PhotoItem[]) => PhotoItem[]) => void;
  max: number;
  maxBytes?: number | null;
  onError: (message: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
  hint?: string;
  /** 휴대폰에서 바로 카메라를 열 수 있는 버튼도 보여 준다 */
  capture?: boolean;
}) {
  const [processing, setProcessing] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const previewUrls = useRef<string[]>([]);
  const remaining = max - items.length - processing;

  useEffect(() => onBusyChange?.(processing > 0), [processing, onBusyChange]);
  // 닫힐 때 미리보기 URL 해제
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const picked = Array.from(files).slice(0, Math.max(0, remaining));
    onError(files.length > picked.length ? `사진은 ${max}장까지 넣을 수 있어요.` : null);

    setProcessing((n) => n + picked.length);
    for (const file of picked) {
      try {
        const img = await processImage(file, { maxBytes: maxBytes ?? undefined });
        const previewUrl = URL.createObjectURL(img.blob);
        previewUrls.current.push(previewUrl);
        onChange((prev) => [...prev, { key: createId(), draft: { kind: 'new', ...img }, previewUrl }]);
      } catch (e) {
        onError(e instanceof Error ? e.message : '사진을 불러오지 못했어요.');
      } finally {
        setProcessing((n) => n - 1);
      }
    }
  }

  const remove = (key: string) => onChange((prev) => prev.filter((item) => item.key !== key));
  const moveToFront = (key: string) =>
    onChange((prev) => {
      const target = prev.find((item) => item.key === key);
      return target ? [target, ...prev.filter((item) => item.key !== key)] : prev;
    });

  const addButton = (label: string, onClick: () => void, icon = <CameraIcon />) => (
    <button
      type="button"
      onClick={onClick}
      className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-white text-[11px] text-muted hover:bg-soft/40"
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="mt-2">
      <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted">
        <span>사진</span>
        <span className="text-[11px]">
          {items.length}/{max}
          {items.length > 1 && ` · ${hint}`}
        </span>
      </div>
      <div className="scrollbar-none -mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
        {items.map((item, index) => (
          <div key={item.key} className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-line">
            {item.draft.kind === 'existing' ? (
              <PhotoImage photo={item.draft.ref} seed={item.key} className="size-full" />
            ) : (
              <img src={item.previewUrl} alt="" className="size-full object-cover" />
            )}
            {index === 0 && items.length > 1 ? (
              <span className="absolute bottom-1 left-1 rounded-full bg-ink/75 px-1.5 py-0.5 text-[10px] text-white">대표</span>
            ) : index > 0 ? (
              <button
                type="button"
                onClick={() => moveToFront(item.key)}
                aria-label="맨 앞으로"
                className="absolute bottom-1 left-1 rounded-full bg-black/40 p-1 text-white"
              >
                <ArrowLeftIcon size={12} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => remove(item.key)}
              aria-label="사진 빼기"
              className="absolute top-1 right-1 rounded-full bg-black/40 p-1 text-white"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        ))}
        {Array.from({ length: processing }, (_, i) => (
          <div key={`loading-${i}`} className="size-24 shrink-0 animate-pulse rounded-xl bg-soft" />
        ))}
        {remaining > 0 && capture && addButton('지금 찍기', () => cameraInput.current?.click())}
        {remaining > 0 && addButton(capture ? '앨범에서' : '사진 추가', () => fileInput.current?.click())}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {capture && (
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      )}
    </div>
  );
}
