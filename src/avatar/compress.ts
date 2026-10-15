/**
 * 照片压缩
 *
 * 桌面端不引入 sharp 之类的原生图像库——WebView 里 Canvas 就能做，
 * 零依赖、零体积，且 WKWebView 与 WebView2 都原生支持。
 *
 * 目标：年会现场 200 张头像，从几十 MB 压到几 MB，
 * 同时保证标签云里 58×76 的显示尺寸仍然清晰。
 */

import { MAX_EDGE, JPEG_QUALITY } from './validate';

export interface CompressResult {
  bytes: Uint8Array;
  width: number;
  height: number;
  /** 压缩前字节数 */
  originalBytes: number;
}

/**
 * 等比缩放至最长边 MAX_EDGE，输出 JPEG。
 *
 * 只在需要缩小时才重绘：小于上限的小图直接原样返回，
 * 避免无谓的有损重编码（年会合影里的小头像本来就很小）。
 */
export async function compressImage(
  bytes: Uint8Array,
): Promise<CompressResult> {
  const blob = new Blob([bytes as BlobPart]);
  const bitmap = await createImageBitmap(blob);

  const longestEdge = Math.max(bitmap.width, bitmap.height);
  // 超过上限才缩放；等比不裁剪，避免把人脸切掉
  const scale = longestEdge > MAX_EDGE ? MAX_EDGE / longestEdge : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  if (scale === 1) {
    bitmap.close();
    return { bytes, width, height, originalBytes: bytes.length };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return {
      bytes,
      width: bitmap.width,
      height: bitmap.height,
      originalBytes: bytes.length,
    };
  }

  // 透明 PNG 转 JPEG 后透明区会变黑，先铺一层白底
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const outBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!outBlob) {
    return { bytes, width, height, originalBytes: bytes.length };
  }

  const out = new Uint8Array(await outBlob.arrayBuffer());
  return { bytes: out, width, height, originalBytes: bytes.length };
}

/** 人类可读的体积 */
export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
