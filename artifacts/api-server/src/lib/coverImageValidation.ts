export const MIN_COVER_WIDTH = 300;
export const MIN_COVER_HEIGHT = 170;
export const MAX_COVER_SIZE_BYTES = 2 * 1024 * 1024;

export const ALLOWED_COVER_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export type CoverImageMime = (typeof ALLOWED_COVER_MIMES)[number];

export type CoverValidationResult =
  | { ok: true; mime: CoverImageMime; width: number; height: number }
  | { ok: false; error: string };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function detectImageMime(buf: Buffer): CoverImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function readPngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function readJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (buf[offset] === 0xff) offset += 1;
    const marker = buf[offset];
    if (marker === undefined) return null;
    offset += 1;

    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;

    const segmentLength = buf.readUInt16BE(offset);
    if (segmentLength < 2) return null;

    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const height = buf.readUInt16BE(offset + 3);
      const width = buf.readUInt16BE(offset + 5);
      return { width, height };
    }

    offset += segmentLength;
  }

  return null;
}

function readWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  const chunk = buf.subarray(12, 16).toString("ascii");

  if (chunk === "VP8X" && buf.length >= 30) {
    const width = 1 + buf.readUIntLE(24, 3);
    const height = 1 + buf.readUIntLE(27, 3);
    return { width, height };
  }

  if (chunk === "VP8 " && buf.length >= 30) {
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }

  if (chunk === "VP8L" && buf.length >= 25) {
    const bits = buf.readUInt32LE(21);
    const width = 1 + (bits & 0x3fff);
    const height = 1 + ((bits >> 14) & 0x3fff);
    return { width, height };
  }

  return null;
}

export function getImageDimensions(
  buf: Buffer,
  mime: CoverImageMime,
): { width: number; height: number } | null {
  switch (mime) {
    case "image/png":
      return readPngDimensions(buf);
    case "image/jpeg":
      return readJpegDimensions(buf);
    case "image/webp":
      return readWebpDimensions(buf);
    default:
      return null;
  }
}

export function validateCoverImage(buf: Buffer): CoverValidationResult {
  if (buf.length === 0) {
    return { ok: false, error: "Файл обложки пустой" };
  }
  if (buf.length > MAX_COVER_SIZE_BYTES) {
    return { ok: false, error: "Обложка должна быть не больше 2 МБ" };
  }

  const mime = detectImageMime(buf);
  if (!mime) {
    return {
      ok: false,
      error: "Файл должен быть изображением PNG, JPEG или WebP (проверка по содержимому, не по расширению)",
    };
  }

  const dims = getImageDimensions(buf, mime);
  if (!dims || dims.width <= 0 || dims.height <= 0) {
    return { ok: false, error: "Не удалось прочитать размеры изображения" };
  }

  if (dims.width < MIN_COVER_WIDTH || dims.height < MIN_COVER_HEIGHT) {
    return {
      ok: false,
      error: `Минимальное разрешение обложки — ${MIN_COVER_WIDTH}×${MIN_COVER_HEIGHT} пикселей (загружено ${dims.width}×${dims.height})`,
    };
  }

  return { ok: true, mime, width: dims.width, height: dims.height };
}

/** Storage path from our upload flow, e.g. /api/storage/objects/uuid */
export function isStorageCoverPath(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.startsWith("/api/storage/objects/") || trimmed.startsWith("/objects/");
}
