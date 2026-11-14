import { photoMaxEdge } from './settings';

export interface ProcessedImage {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // 아래 <img> 방식으로 다시 시도
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * 사진을 긴 변 maxEdge 이하로 줄여 WebP(지원하지 않으면 JPEG)로 바꾼다.
 * maxBytes를 주면 그 크기 아래로 내려갈 때까지 화질과 크기를 낮춘다.
 * (Firestore 문서 하나는 1MiB까지라서 Firebase 무료 플랜 모드에서 사용)
 */
export async function processImage(file: File, options: { maxEdge?: number; maxBytes?: number } = {}): Promise<ProcessedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name}: 이미지 파일이 아니에요.`);
  }

  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new Error(`${file.name}: 이 브라우저에서 열 수 없는 형식이에요. (HEIC는 JPG로 바꿔서 올려 주세요)`);
  }

  try {
    let edge = options.maxEdge ?? photoMaxEdge();
    let quality = 0.82;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, edge / Math.max(decoded.width, decoded.height));
      const width = Math.round(decoded.width * scale);
      const height = Math.round(decoded.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas를 사용할 수 없어요.');
      ctx.drawImage(decoded.source, 0, 0, width, height);

      // 일부 브라우저(구형 Safari)는 WebP 인코딩을 못 해서 PNG를 돌려준다 → JPEG로 다시
      let blob = await toBlob(canvas, 'image/webp', quality);
      if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
      if (!blob) throw new Error('사진 변환에 실패했어요.');

      if (!options.maxBytes || blob.size <= options.maxBytes) {
        return { blob, mimeType: blob.type, width, height };
      }
      quality = Math.max(0.5, quality - 0.1);
      edge = Math.round(edge * 0.85);
    }
    throw new Error(`${file.name}: 사진이 너무 커서 저장할 수 없어요.`);
  } finally {
    decoded.close();
  }
}
