import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";
import {
  isStorageCoverPath,
  MAX_COVER_SIZE_BYTES,
  validateCoverImage,
} from "./coverImageValidation";

export function toObjectEntityPath(coverImageUrl: string): string {
  const trimmed = coverImageUrl.trim();
  if (trimmed.startsWith("/api/storage")) {
    return trimmed.replace(/^\/api\/storage/, "");
  }
  return trimmed;
}

/**
 * Validates a cover already stored in object storage (submission safety net).
 * Returns a Russian error message or null when valid / not applicable.
 */
export async function validateStoredCoverImageUrl(
  coverImageUrl: string,
  objectStorageService = new ObjectStorageService(),
): Promise<string | null> {
  if (!coverImageUrl.trim() || !isStorageCoverPath(coverImageUrl)) {
    return null;
  }

  try {
    const objectPath = toObjectEntityPath(coverImageUrl);
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size ?? 0);
    if (size > MAX_COVER_SIZE_BYTES) {
      return "Обложка должна быть не больше 2 МБ";
    }

    const [buf] = await file.download();
    const result = validateCoverImage(buf);
    return result.ok ? null : result.error;
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      return "Обложка не найдена в хранилище";
    }
    throw err;
  }
}
