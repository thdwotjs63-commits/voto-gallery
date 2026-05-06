import type { VotoCategoryId } from "@/lib/voto-categories";
import { VOTO_CATEGORIES } from "@/lib/voto-categories";

export type VotoImage = {
  id: string;
  categoryId: VotoCategoryId;
  name: string;
  baseName: string;
  description: string;
  /** Grid / preview: Drive `thumbnailLink` when present, else lh3 `=s1000` (no Vercel IO). */
  thumbSrc: string;
  /** Lightbox / full view: lh3 `=s2000` (loaded with `unoptimized` in UI). */
  fullSrc: string;
  downloadUrl: string;
  width: number;
  height: number;
  /** Google photo metadata capture timestamp (`imageMediaMetadata.time`) in ms. */
  capturedAtMs: number | null;
  /** Parsed date from filename (e.g. 20260505 / 2026-05-05) in ms. */
  fileNameDateMs: number | null;
  /** Parsed date token from filename (YYMMDD / YYYYMMDD), if present. */
  fileNameDateToken: string | null;
  /** Drive file createdTime in ms (fallback when capture metadata is missing). */
  createdAtMs: number | null;
  /** Primary sort key: capturedAtMs -> fileNameDateMs -> createdAtMs -> 0 */
  sortTimeMs: number;
  /** Lightbox info title (category-specific: hyundai hides team). */
  infoTitle: string;
  /** Smart hashtags shown in the lightbox info panel. */
  smartTags: string[];
};

const DRIVE_FETCH_INIT = { cache: "no-store" as RequestCache };

const DRIVE_LIST_EXTRA_PARAMS = {
  supportsAllDrives: "true",
  includeItemsFromAllDrives: "true",
} as const;

const IMAGE_FIELDS =
  "id,name,description,createdTime,imageMediaMetadata(time,width,height),thumbnailLink";

type DriveFileRow = {
  id: string;
  name: string;
  description?: string;
  createdTime?: string;
  imageMediaMetadata?: { width?: number; height?: number; time?: string };
  thumbnailLink?: string;
};

function toEpochMs(input?: string): number | null {
  if (!input) return null;
  const ms = Date.parse(input);
  if (!Number.isFinite(ms)) return null;
  return ms;
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim();
}

function parseYyMmDdToken(token: string): number | null {
  const m = token.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  const yy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
  return Date.parse(`${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}T00:00:00Z`);
}

function parseDateFromFilename(name: string): { ms: number | null; token: string | null } {
  const text = stripExtension(name);
  if (!text) return { ms: null, token: null };

  // Priority 1: leading YYMMDD (요청 사항)
  const leadingYyMmDd = text.match(/^(\d{6})\b/);
  if (leadingYyMmDd) {
    const ms = parseYyMmDdToken(leadingYyMmDd[1]);
    if (ms !== null) return { ms, token: leadingYyMmDd[1] };
  }

  // Priority: YYYYMMDD
  const ymdPlain = text.match(/\b(19\d{2}|20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])\b/);
  if (ymdPlain) {
    const iso = `${ymdPlain[1]}-${ymdPlain[2]}-${ymdPlain[3]}T00:00:00Z`;
    return { ms: toEpochMs(iso), token: `${ymdPlain[1]}${ymdPlain[2]}${ymdPlain[3]}` };
  }

  // Fallback: YYYY-MM-DD / YYYY.MM.DD / YYYY_MM_DD / YYYY MM DD
  const ymdSep = text.match(/\b(19\d{2}|20\d{2})[.\-_ ](0[1-9]|1[0-2])[.\-_ ]([0-2]\d|3[01])\b/);
  if (ymdSep) {
    const iso = `${ymdSep[1]}-${ymdSep[2]}-${ymdSep[3]}T00:00:00Z`;
    return { ms: toEpochMs(iso), token: `${ymdSep[1]}${ymdSep[2]}${ymdSep[3]}` };
  }

  return { ms: null, token: null };
}

function parseNameParts(baseName: string): { dateToken: string | null; team: string | null; player: string | null } {
  const chunks = baseName
    .split("_")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chunks.length === 0) {
    return { dateToken: null, team: null, player: null };
  }
  const first = chunks[0];
  const hasDate = /^\d{6}$/.test(first) || /^\d{8}$/.test(first);
  if (!hasDate) {
    return { dateToken: null, team: chunks[0] ?? null, player: chunks.slice(1).join(" ").trim() || null };
  }
  const team = chunks[1] ?? null;
  const player = chunks.slice(2).join(" ").trim() || null;
  return { dateToken: first, team, player };
}

function normalizeTagToken(text: string): string {
  return text.replace(/\s+/g, "").replace(/[^\p{L}\p{N}_-]/gu, "");
}

function buildSmartTags(
  categoryId: VotoCategoryId,
  dateToken: string | null,
  team: string | null,
  player: string | null
): string[] {
  const tags: string[] = [];
  const pushTag = (value: string | null | undefined) => {
    if (!value) return;
    const norm = normalizeTagToken(value);
    if (!norm) return;
    const tag = `#${norm}`;
    if (!tags.includes(tag)) tags.push(tag);
  };
  pushTag(dateToken);
  if (categoryId === "hyundai") {
    pushTag("현대건설");
  } else {
    pushTag(team);
  }
  pushTag(player);
  return tags;
}

function buildInfoTitle(
  categoryId: VotoCategoryId,
  dateToken: string | null,
  team: string | null,
  player: string | null,
  fallbackName: string
): string {
  const parts: string[] = [];
  if (dateToken) parts.push(dateToken);
  if (categoryId === "hyundai") {
    if (player) parts.push(player);
  } else {
    if (team) parts.push(team);
    if (player) parts.push(player);
  }
  return parts.length > 0 ? parts.join(" · ") : fallbackName;
}

function buildThumbSrc(file: DriveFileRow): string {
  const link = file.thumbnailLink?.trim();
  if (link) return link;
  return `https://lh3.googleusercontent.com/d/${file.id}=s1000`;
}

function buildFullSrc(id: string): string {
  return `https://lh3.googleusercontent.com/d/${id}=s2000`;
}

function mapRow(file: DriveFileRow, categoryId: VotoCategoryId): VotoImage {
  const baseName = stripExtension(file.name);
  const parsed = parseDateFromFilename(file.name);
  const parts = parseNameParts(baseName);
  const width = file.imageMediaMetadata?.width ?? 1600;
  const height = file.imageMediaMetadata?.height ?? 1200;
  const capturedAtMs = toEpochMs(file.imageMediaMetadata?.time);
  const fileNameDateMs = parsed.ms;
  const fileNameDateToken = parsed.token ?? parts.dateToken;
  const createdAtMs = toEpochMs(file.createdTime);
  const sortTimeMs = capturedAtMs ?? fileNameDateMs ?? createdAtMs ?? 0;
  const infoTitle = buildInfoTitle(
    categoryId,
    fileNameDateToken,
    parts.team,
    parts.player,
    baseName || file.name
  );
  const smartTags = buildSmartTags(categoryId, fileNameDateToken, parts.team, parts.player);
  return {
    id: (file.id ?? "").trim(),
    categoryId,
    name: file.name,
    baseName,
    description: file.description ?? "",
    thumbSrc: buildThumbSrc(file),
    fullSrc: buildFullSrc(file.id),
    downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
    width,
    height,
    capturedAtMs,
    fileNameDateMs,
    fileNameDateToken,
    createdAtMs,
    sortTimeMs,
    infoTitle,
    smartTags,
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
    .map((f) => mapRow(f, categoryId))
    .sort((a, b) => {
      if (b.sortTimeMs !== a.sortTimeMs) return b.sortTimeMs - a.sortTimeMs;
      return b.name.localeCompare(a.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}
