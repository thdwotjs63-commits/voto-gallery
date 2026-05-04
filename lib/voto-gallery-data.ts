import type { VotoCategoryId } from "@/lib/voto-categories";
import { VOTO_CATEGORIES } from "@/lib/voto-categories";

export type VotoImage = {
  id: string;
  name: string;
  description: string;
  /** Grid / preview: Drive `thumbnailLink` when present, else lh3 `=s1000` (no Vercel IO). */
  thumbSrc: string;
  /** Lightbox / full view: lh3 `=s2000` (loaded with `unoptimized` in UI). */
  fullSrc: string;
  downloadUrl: string;
  width: number;
  height: number;
};

const DRIVE_FETCH_INIT = { cache: "no-store" as RequestCache };

const DRIVE_LIST_EXTRA_PARAMS = {
  supportsAllDrives: "true",
  includeItemsFromAllDrives: "true",
} as const;

const IMAGE_FIELDS = "id,name,description,imageMediaMetadata(width,height),thumbnailLink";

type DriveFileRow = {
  id: string;
  name: string;
  description?: string;
  imageMediaMetadata?: { width?: number; height?: number };
  thumbnailLink?: string;
};

function buildThumbSrc(file: DriveFileRow): string {
  const link = file.thumbnailLink?.trim();
  if (link) return link;
  return `https://lh3.googleusercontent.com/d/${file.id}=s1000`;
}

function buildFullSrc(id: string): string {
  return `https://lh3.googleusercontent.com/d/${id}=s2000`;
}

function mapRow(file: DriveFileRow): VotoImage {
  const width = file.imageMediaMetadata?.width ?? 1600;
  const height = file.imageMediaMetadata?.height ?? 1200;
  return {
    id: (file.id ?? "").trim(),
    name: file.name,
    description: file.description ?? "",
    thumbSrc: buildThumbSrc(file),
    fullSrc: buildFullSrc(file.id),
    downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
    width,
    height,
  };
}

function resolveFolderId(categoryId: VotoCategoryId): string | null {
  const row = VOTO_CATEGORIES.find((c) => c.id === categoryId);
  if (!row) return null;
  const id = process.env[row.envKey]?.trim();
  return id && id.length > 0 ? id : null;
}

async function driveListAll<T>(apiKey: string, query: string, fields: string): Promise<T[]> {
  let pageToken: string | undefined;
  const items: T[] = [];

  do {
    const params = new URLSearchParams({
      key: apiKey,
      pageSize: "1000",
      q: query,
      fields: `nextPageToken,files(${fields})`,
      ...DRIVE_LIST_EXTRA_PARAMS,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      DRIVE_FETCH_INIT
    );
    if (!response.ok) {
      throw new Error(`Google Drive API error: ${response.status}`);
    }
    const data = (await response.json()) as {
      nextPageToken?: string;
      files?: T[];
    };
    items.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

/**
 * BFS: category 루트와 모든 하위 폴더 안의 이미지를 모읍니다.
 * (직접 자식만 보던 이전 버전에서는 하위 폴더에 올린 사진이 안 보였습니다.)
 */
async function listAllImagesUnderFolder(rootFolderId: string, apiKey: string): Promise<DriveFileRow[]> {
  const unique = new Map<string, DriveFileRow>();
  const queue: string[] = [rootFolderId];
  const visitedFolders = new Set<string>();

  while (queue.length > 0) {
    const folderId = queue.shift();
    if (!folderId || visitedFolders.has(folderId)) continue;
    visitedFolders.add(folderId);

    const [subfolders, imagesInFolder] = await Promise.all([
      driveListAll<{ id: string }>(
        apiKey,
        `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        "id"
      ),
      driveListAll<DriveFileRow>(
        apiKey,
        `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
        IMAGE_FIELDS
      ),
    ]);

    for (const sub of subfolders) {
      if (!visitedFolders.has(sub.id)) queue.push(sub.id);
    }
    for (const img of imagesInFolder) {
      unique.set(img.id, img);
    }
  }

  return Array.from(unique.values());
}

/**
 * Lists images under the Drive folder tree for the Voto category.
 * Uses thumbnailLink when the API returns it; otherwise lh3 `=s1000`.
 */
export async function fetchVotoCategoryImages(categoryId: VotoCategoryId): Promise<VotoImage[]> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY is not set.");
  }
  const folderId = resolveFolderId(categoryId);
  if (!folderId) {
    const row = VOTO_CATEGORIES.find((c) => c.id === categoryId);
    throw new Error(
      `Folder ID for "${row?.label ?? categoryId}" is not configured. Set ${row?.envKey} in the server environment.`
    );
  }

  const rows = await listAllImagesUnderFolder(folderId, apiKey);
  return rows
    .map((f) => mapRow(f))
    .sort((a, b) =>
      b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: "base" })
    );
}
