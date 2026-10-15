/**
 * 照片校验
 *
 * 只看扩展名是不够的：把 .exe 改名成 .jpg 就能混进来，
 * 写盘失败后用户只会看到「导入成功但照片不显示」。
 * 因此按顺序做四道校验，每道失败都给出可执行的原因。
 */

/** 允许的图片扩展名 */
export const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

/** 大小上限：10 MB */
export const MAX_BYTES = 10 * 1024 * 1024;

/** 压缩后的最长边 */
export const MAX_EDGE = 512;

/** 压缩质量 */
export const JPEG_QUALITY = 0.85;

export interface ValidationResult {
  ok: boolean;
  /** 统一的小写扩展名，不含点 */
  ext?: string;
  reason?: string;
}

function extOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index > 0 ? fileName.slice(index + 1).toLowerCase() : '';
}

/**
 * 校验文件头（magic number）。
 * 只用前 12 字节即可区分 jpg / png / webp。
 */
export function sniffFormat(bytes: Uint8Array): 'jpg' | 'png' | 'webp' | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

/**
 * 基础校验：扩展名 + 大小 + 文件头。
 * 这一步不需要解码，代价极低，适合对整批文件先跑一遍。
 */
export function validateFile(
  fileName: string,
  bytes: Uint8Array,
): ValidationResult {
  const ext = extOf(fileName);

  if (!ext) {
    return { ok: false, reason: '没有扩展名，无法识别格式' };
  }
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return {
      ok: false,
      reason: `不支持的格式 .${ext}（仅支持 ${ALLOWED_EXTENSIONS.join(' / ')}）`,
    };
  }
  if (bytes.length > MAX_BYTES) {
    return {
      ok: false,
      reason: `文件 ${(bytes.length / 1024 / 1024).toFixed(1)} MB，超过 ${MAX_BYTES / 1024 / 1024} MB 上限`,
    };
  }
  if (bytes.length === 0) {
    return { ok: false, reason: '文件为空' };
  }

  const sniffed = sniffFormat(bytes);
  if (!sniffed) {
    return { ok: false, reason: '文件内容不是有效的图片（扩展名可能被改过）' };
  }
  // 扩展名与真实格式对不上时按真实格式为准，只在 jpg/jpeg 这种等价写法上容忍
  const equivalent =
    (ext === 'jpeg' && sniffed === 'jpg') ||
    (ext === 'jpg' && sniffed === 'jpg');
  if (sniffed !== ext && !equivalent) {
    return {
      ok: false,
      reason: `扩展名 .${ext} 与实际格式（${sniffed.toUpperCase()}）不符`,
    };
  }

  return { ok: true, ext: sniffed };
}

/** 读取图片尺寸，失败返回 null */
export async function readSize(
  bytes: Uint8Array,
): Promise<{ width: number; height: number } | null> {
  try {
    const blob = new Blob([bytes as BlobPart]);
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

/**
 * 可解码性校验：真正让浏览器解一次码。
 * 文件头对了不代表图片能被解码（截断文件、伪造头都会到这里被拦住）。
 */
export async function validateDecodable(
  bytes: Uint8Array,
): Promise<ValidationResult> {
  const blob = new Blob([bytes as BlobPart]);
  try {
    const bitmap = await createImageBitmap(blob);
    if (bitmap.width === 0 || bitmap.height === 0) {
      bitmap.close();
      return { ok: false, reason: '图片尺寸为 0，无法使用' };
    }
    bitmap.close();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: `图片无法解码，可能已损坏（${error instanceof Error ? error.message : '未知原因'}）`,
    };
  }
}
