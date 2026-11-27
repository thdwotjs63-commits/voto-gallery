/** Lightbox / hero / high-res: lh3 직접, long edge ≈2000px (Next 이미지 최적화 미사용 시 브라우저 직행). */
export function driveLh3FullDisplayUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=s2000`;
}

/** Quiz 등 중간 해상도: lh3 `=s1000`, Vercel IO 없이 브라우저가 Google CDN으로 직접 요청. */
export function driveLh3S1000Url(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId.trim()}=s1000`;
}

export type DriveImage = {
  id: string;
  name: string;
  description: string;
  story?: string;
  tags: string[];
  dateTag?: string;
  locationTag?: string;
  momentTag?: string;
  /** 4번째 description/파일명 태그부터 — 함께 있는 사람(복수) */
  withTags: string[];
  /** @deprecated 첫 번째 with만 — withTags[0]과 동일, 하위 호환 */
  withTag?: string;
  folderName: string;
  scheduleDateKey: number;
  scheduleLabel: string;
  scheduleDisplay: string;
  scheduleYear: string;
  folderSortKey: number;
  thumbnailUrl: string;
  originalUrl: string;
  downloadUrl: string;
  ratio: "portrait" | "landscape";
  width: number;
  height: number;
};

type FetchDriveGalleryImagesOptions = {
  excludeFolderIds?: string[];
  /** 폴더 이름(소문자) 일치 시 하위 탐색 제외 — selfie 등 */
  excludeFolderNames?: string[];
};

const DEFAULT_EXCLUDED_FOLDER_NAMES = ["selfie"];

function isExcludedFolderName(name: string, excludedNames: Set<string>): boolean {
  return excludedNames.has(name.trim().toLowerCase());
}

const GOOGLE_DRIVE_API_KEY_ENV_KEY = "NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY";
const GOOGLE_DRIVE_FOLDER_ID_ENV_KEY = "NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID";
const META_POSITIONAL_TAGS = new Set(["#hero", "#banner"]);

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  return Array.from(new Set(matches.map((tag) => tag.toLowerCase())));
}

function normalizeTag(raw: string): string {
  return raw
    .replace(/-?\s*\(\s*\d+\s*of\s*\d+\s*\)/gi, "")
    .replace(/^[-_\s]+|[-_\s]+$/g, "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
}

function normalizeTagToken(token: string): string {
  const normalized = normalizeTag(token);
  return normalized ? `#${normalized}` : "";
}

function filenamePartToTag(part: string): string | null {
  const trimmed = part.trim();
  if (!trimmed) return null;

  const ymdSeparated = trimmed.match(
    /^(19\d{2}|20\d{2})[.\-_](0[1-9]|1[0-2])[.\-_]([0-2]\d|3[01])$/
  );
  if (ymdSeparated) {
    return `#${ymdSeparated[1]}${ymdSeparated[2]}${ymdSeparated[3]}`.toLowerCase();
  }

  if (/^(19\d{2}|20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])$/.test(trimmed)) {
    return `#${trimmed}`.toLowerCase();
  }

  const normalized = normalizeTagToken(trimmed);
  return normalized || null;
}

function extractTagsFromFilename(name: string): string[] {
  const nameNoExt = (name ?? "").replace(/\.[^.]+$/, "");
  const tags: string[] = [];
  for (const part of nameNoExt.split("_")) {
    const tag = filenamePartToTag(part);
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

function dedupeNormalizedTags(rawTags: string[]): string[] {
  return Array.from(new Set(rawTags.map(normalizeTagToken).filter(Boolean)));
}

function extractMetaTagsFromFilename(name: string): string[] {
  return extractTagsFromFilename(name).filter((tag) => META_POSITIONAL_TAGS.has(tag));
}

function parseTags(description: string, name: string): string[] {
  const descTags = dedupeNormalizedTags(extractHashtags(description));
  if (descTags.length > 0) {
    const metaFromName = dedupeNormalizedTags(extractMetaTagsFromFilename(name)).filter(
      (tag) => !descTags.includes(tag)
    );
    return [...descTags, ...metaFromName];
  }
  return dedupeNormalizedTags(extractTagsFromFilename(name));
}

function extractStory(text: string): string | undefined {
  const withoutHashtags = text.replace(/#[\p{L}\p{N}_-]+/gu, " ");
  const normalized = withoutHashtags.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseDateKeyFromFolderLabel(text: string): number {
  let best = 0;
  const eight = text.match(/\b(19\d{6}|20\d{6})\b/g);
  if (eight) {
    for (const m of eight) {
      const n = Number(m);
      if (n > best) best = n;
    }
  }
  const stripped = text.replace(/\b(19\d{6}|20\d{6})\b/g, " ");
  const yymmdd = stripped.matchAll(/\b(\d{2})(\d{2})(\d{2})\b/g);
  for (const m of yymmdd) {
    const yy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) continue;
    const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
    const key = yyyy * 10000 + mm * 100 + dd;
    if (key > best) best = key;
  }
  return best;
}

function parseScheduleFromFolderName(folderName: string): {
  dateKey: number;
  label: string;
  display: string;
  year: string;
} {
  const trimmed = folderName.trim();
  const match = trimmed.match(/^(\d{8})_(.+)$/);
  if (!match) {
    const fallbackKey = parseDateKeyFromFolderLabel(trimmed);
    const fallbackYear =
      fallbackKey >= 10000000 ? String(Math.floor(fallbackKey / 10000)) : "기타";
    return {
      dateKey: fallbackKey,
      label: trimmed || "미분류",
      display: trimmed || "미분류",
      year: fallbackYear,
    };
  }

  const ymd = match[1];
  const label = match[2].trim() || "미분류";
  const yyyy = ymd.slice(0, 4);
  const mm = ymd.slice(4, 6);
  const dd = ymd.slice(6, 8);
  return {
    dateKey: Number(ymd),
    label,
    display: `${yyyy}.${mm}.${dd} - ${label}`,
    year: yyyy,
  };
}

const DRIVE_FETCH_INIT = { next: { revalidate: 3600 } } as const;

/** 팀/공유 드라이브 안의 파일도 list/get 이 동작하도록 */
const DRIVE_LIST_EXTRA_PARAMS = {
  supportsAllDrives: "true",
  includeItemsFromAllDrives: "true",
} as const;

/** 김다인월드컵(/exhibition) 전용 폴더 — 일반 갤러리·피드에서는 항상 제외 */
export const WORLDCUP_FOLDER_ID_ENV_KEY = "WORLDCUP_DRIVE_FOLDER_ID";

async function listDriveFiles<T>(apiKey: string, query: string, fields: string): Promise<T[]> {
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

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

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

export type DriveFolderImage = {
  id: string;
  name: string;
  width: number;
  height: number;
};

/** 한 폴더 바로 안의 이미지 파일만 (하위 폴더·동영상 제외), 파일 이름 오름차순 */
export async function fetchDriveFolderImages(folderId: string): Promise<DriveFolderImage[]> {
  const apiKey = process.env[GOOGLE_DRIVE_API_KEY_ENV_KEY]?.trim();
  const id = folderId.trim();
  if (!apiKey || !id) {
    throw new Error(
      `Missing environment variables: ${[
        ...(!apiKey ? [GOOGLE_DRIVE_API_KEY_ENV_KEY] : []),
        ...(!id ? ["folderId"] : []),
      ].join(", ")}`
    );
  }

  const files = await listDriveFiles<{
    id?: string;
    name?: string;
    mimeType?: string;
    imageMediaMetadata?: { width?: number; height?: number };
  }>(
    apiKey,
    `'${id}' in parents and mimeType contains 'image/' and trashed = false`,
    "id,name,mimeType,imageMediaMetadata(width,height)"
  );

  return files
    .filter((file) => file.id && file.mimeType?.startsWith("image/"))
    .map((file) => ({
      id: (file.id ?? "").trim(),
      name: file.name ?? "",
      width: file.imageMediaMetadata?.width ?? 1200,
      height: file.imageMediaMetadata?.height ?? 1800,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

type DriveFileRow = {
  id: string;
  name: string;
  description?: string;
  imageMediaMetadata?: { width?: number; height?: number };
  /** Short-lived Google-hosted thumbnail; avoids lh3 resize when present. */
  thumbnailLink?: string;
  folderName: string;
  folderSortKey: number;
};

function hasKorean(tag: string): boolean {
  return /[가-힣]/.test(tag);
}

/**
 * 함께 찍힌 "사람"으로 분류할 태그 목록(앞의 # 제외, 소문자).
 * 파일명/디스크립션에서 이 이름이 나오면 위치와 상관없이 withTags(함께)로 보낸다.
 * 새 인물이 생기면 여기에 추가하면 된다. 김다인은 주인공이지만 '함께' 필터에도 뜨도록 포함.
 */
const PERSON_TAGS = new Set<string>([
  "김다인",
  "나현수",
  "이예림",
  "이주아",
  "강소휘",
  "정호영",
  "문정원",
  "최윤영",
  "고예림",
  "자스티스",
]);

/** 장소(체육관 등)로 분류할 태그. 정확 일치 목록 + "체육관/경기장/커피차" 같은 키워드. */
const LOCATION_TAGS = new Set<string>([
  "수원실내체육관",
  "수원실내체육",
  "염주체육관",
  "대전충무체육관",
  "화성실내체육관",
  "그랜드워커힐",
  "청담 리베라호텔",
  "리베라호텔",
  "아레나 코마키",
  "텐진아레나경기장",
  "홍콩퀸엘리자베스스타디움",
  "여수 진남체육관 코보컵 b조 예선",
  "진남체육관",
]);
// 장소성 접미사·키워드. "커피차"는 상황(생일커피차 등)이라 제외한다.
const LOCATION_KEYWORDS = [
  "체육관",
  "체육",
  "경기장",
  "아레나",
  "스타디움",
  "공항",
  "호텔",
  "워커힐",
  "리베라",
  "다이닝룸",
];

/** # 를 떼고 소문자로. */
function bareTag(tag: string): string {
  return tag.replace(/^#/, "").trim().toLowerCase();
}

/**
 * "버릴" 토큰인지 — 태그/필터 어디에도 넣지 않는다.
 * 파일명·디스크립션에서 날짜·장수번호·편집본 표시 등이 태그로 잡혀 들어온다.
 */
function isJunkToken(bare: string): boolean {
  // 순수 숫자, (2), 복사본 번호, "(n of m)" 잔여물
  if (/^\(?\d+\)?$/.test(bare)) return true;
  if (/^\d+\s*of\s*\d+$/.test(bare)) return true;
  // 날짜(6/8자리)로 시작하는 토큰: #260503, #260503-1, #260308경기-10, #251218-10 등
  if (/^(?:\d{6}|\d{8})(?:[-_]|경기|$)/.test(bare)) return true;
  // 보정본/원본 + 번호 같은 편집 표시 (#보정본2 등)
  if (/^(보정본|원본|사본|복사본|편집본)\d*$/.test(bare)) return true;
  return false;
}

/** 날짜(YYMMDD/YYYYMMDD) 토큰인지 — dateTag 보존용. */
function isDateToken(bare: string): boolean {
  return /^\d{6}$/.test(bare) || /^\d{8}$/.test(bare);
}

function isLocationTag(bare: string): boolean {
  if (LOCATION_TAGS.has(bare)) return true;
  return LOCATION_KEYWORDS.some((kw) => bare.includes(kw));
}

/**
 * 태그를 "위치"가 아니라 "내용"으로 분류한다.
 * 파일명 태깅으로 넘어오며 순서가 들쭉날쭉해져, 위치 기반(tags[2]=moment)으로는
 * 사람 이름이 moment 로 새는 등 오분류가 생겼다. 내용 기준으로 바꾼다:
 *  - 날짜/순수숫자/복사본 번호 → 버림
 *  - 사람 이름(PERSON_TAGS) → withTags(함께)
 *  - 장소(체육관 등) → locationTag (첫 번째만)
 *  - 그 외(alone, coolmoment, 출근길, 팬사인회 …) → momentTag (첫 번째만)
 */
function assignPositionalTags(tags: string[]): {
  dateTag?: string;
  locationTag?: string;
  momentTag?: string;
  withTags: string[];
} {
  let dateTag: string | undefined;
  let locationTag: string | undefined;
  let momentTag: string | undefined;
  const withTags: string[] = [];

  for (const tag of tags) {
    if (META_POSITIONAL_TAGS.has(tag)) continue; // #hero, #banner 등은 별도 처리
    const bare = bareTag(tag);
    if (!bare) continue;

    if (isJunkToken(bare)) {
      // 날짜(순수 6/8자리)만 dateTag 후보로 보존(정렬 보조). 그 외 번호·날짜변형은 버림.
      if (!dateTag && isDateToken(bare)) dateTag = tag;
      continue;
    }
    if (PERSON_TAGS.has(bare)) {
      if (!withTags.includes(tag)) withTags.push(tag);
      continue;
    }
    if (isLocationTag(bare)) {
      if (!locationTag) locationTag = tag;
      continue;
    }
    // 나머지는 moment (첫 번째만 대표값으로)
    if (!momentTag) momentTag = tag;
  }

  return { dateTag, locationTag, momentTag, withTags };
}

function mapDriveFileRowToImage(file: DriveFileRow): DriveImage {
  const width = file.imageMediaMetadata?.width ?? 1200;
  const height = file.imageMediaMetadata?.height ?? 1800;
  const description = file.description ?? "";
  const tags = parseTags(description, file.name);
  const story = extractStory(description);
  const positional = assignPositionalTags(tags);
  const tagDateKey = Number((tags[0] ?? "").replace("#", "")) || 0;
  const schedule = parseScheduleFromFolderName(file.folderName);
  const effectiveFolderKey =
    file.folderSortKey > 0
      ? file.folderSortKey
      : schedule.dateKey > 0
        ? schedule.dateKey
        : tagDateKey;

  return {
    id: (file.id ?? "").trim(),
    name: file.name,
    description,
    story,
    tags,
    dateTag: positional.dateTag,
    locationTag: positional.locationTag,
    momentTag: positional.momentTag,
    withTags: positional.withTags,
    withTag: positional.withTags[0],
    folderName: file.folderName,
    scheduleDateKey: schedule.dateKey,
    scheduleLabel: schedule.label,
    scheduleDisplay: schedule.display,
    scheduleYear: schedule.year,
    folderSortKey: effectiveFolderKey,
    thumbnailUrl:
      (file.thumbnailLink && file.thumbnailLink.trim()) ||
      `https://lh3.googleusercontent.com/d/${file.id}=w800`,
    originalUrl: `https://lh3.googleusercontent.com/d/${file.id}`,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
    ratio: (width >= height ? "landscape" : "portrait") as "landscape" | "portrait",
    width,
    height,
  };
}

export async function fetchDriveGalleryImages(
  folderId?: string,
  options?: FetchDriveGalleryImagesOptions
): Promise<DriveImage[]> {
  const apiKey = process.env[GOOGLE_DRIVE_API_KEY_ENV_KEY];
  const driveFolderId =
    folderId === undefined
      ? process.env[GOOGLE_DRIVE_FOLDER_ID_ENV_KEY]
      : folderId.trim();
  const excludedFolderIds = new Set(
    (options?.excludeFolderIds ?? []).map((id) => id.trim()).filter(Boolean)
  );
  const excludedFolderNames = new Set(
    (options?.excludeFolderNames ?? DEFAULT_EXCLUDED_FOLDER_NAMES).map((n) =>
      n.trim().toLowerCase()
    )
  );

  if (!apiKey || !driveFolderId) {
    const missing = [
      ...(!apiKey ? [GOOGLE_DRIVE_API_KEY_ENV_KEY] : []),
      ...(!driveFolderId
        ? [folderId === undefined ? GOOGLE_DRIVE_FOLDER_ID_ENV_KEY : "folderId"]
        : []),
    ];
    throw new Error(
      `Missing environment variables: ${
        missing.length > 0 ? missing.join(", ") : "unknown"
      }`
    );
  }

  const driveApiKey = apiKey;
  const fetchFiles = <T,>(query: string, fields: string) =>
    listDriveFiles<T>(driveApiKey, query, fields);

  // 월드컵 전용 폴더는 어떤 경로로 닿더라도 일반 갤러리에 넣지 않는다
  const worldcupFolderId = process.env[WORLDCUP_FOLDER_ID_ENV_KEY]?.trim();
  if (worldcupFolderId && worldcupFolderId !== driveFolderId) {
    excludedFolderIds.add(worldcupFolderId);
  }

  let rootFolderName = "";
  try {
    const rootMetaUrl = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFolderId)}`
    );
    rootMetaUrl.searchParams.set("fields", "name");
    rootMetaUrl.searchParams.set("key", driveApiKey);
    rootMetaUrl.searchParams.set("supportsAllDrives", "true");
    const rootRes = await fetch(rootMetaUrl.toString(), DRIVE_FETCH_INIT);
    if (rootRes.ok) {
      const rootData = (await rootRes.json()) as { name?: string };
      rootFolderName = rootData.name ?? "";
    }
  } catch {
    /* ignore */
  }

  type QueueItem = { id: string; name: string };
  const queue: QueueItem[] = [{ id: driveFolderId, name: rootFolderName }];
  const visitedFolderIds = new Set<string>();
  const uniqueFiles = new Map<
    string,
    {
      id: string;
      name: string;
      description?: string;
      imageMediaMetadata?: { width?: number; height?: number };
      thumbnailLink?: string;
      folderSortKey: number;
      folderName: string;
    }
  >();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const { id: currentFolderId, name: currentFolderName } = current;
    if (excludedFolderIds.has(currentFolderId)) continue;
    if (visitedFolderIds.has(currentFolderId)) continue;
    visitedFolderIds.add(currentFolderId);

    const folderSortKey = parseDateKeyFromFolderLabel(currentFolderName);

    const [subfolders, imagesInFolder] = await Promise.all([
      fetchFiles<{ id: string; name: string }>(
        `'${currentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        "id,name"
      ),
      fetchFiles<{
        id: string;
        name: string;
        description?: string;
        imageMediaMetadata?: { width?: number; height?: number };
      }>(
        `'${currentFolderId}' in parents and mimeType contains 'image/' and trashed = false`,
        "id,name,description,imageMediaMetadata(width,height),thumbnailLink"
      ),
    ]);

    for (const folder of subfolders) {
      if (excludedFolderIds.has(folder.id)) continue;
      if (isExcludedFolderName(folder.name ?? "", excludedFolderNames)) continue;
      queue.push({ id: folder.id, name: folder.name ?? "" });
    }

    for (const file of imagesInFolder) {
      const fromFileName = parseDateKeyFromFolderLabel(file.name);
      const key = Math.max(folderSortKey, fromFileName);
      uniqueFiles.set(file.id, {
        ...file,
        folderSortKey: key,
        folderName: currentFolderName || "미분류",
      });
    }
  }

  return Array.from(uniqueFiles.values())
    .map((file) => mapDriveFileRowToImage(file))
    .sort((a, b) => {
      if (a.folderSortKey !== b.folderSortKey) {
        return b.folderSortKey - a.folderSortKey;
      }

      return b.name.localeCompare(a.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}
