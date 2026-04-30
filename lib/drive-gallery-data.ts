export type DriveImage = {
  id: string;
  name: string;
  description: string;
  story?: string;
  tags: string[];
  dateTag?: string;
  locationTag?: string;
  momentTag?: string;
  withTag?: string;
  folderSortKey: number;
  thumbnailUrl: string;
  originalUrl: string;
  downloadUrl: string;
  ratio: "portrait" | "landscape";
  width: number;
  height: number;
};

const REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY",
  "NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID",
] as const;

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  return Array.from(new Set(matches.map((tag) => tag.toLowerCase())));
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

const DRIVE_FETCH_INIT = { next: { revalidate: 300 } } as const;

export async function fetchDriveGalleryImages(): Promise<DriveImage[]> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;
  const folderId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID;

  if (!apiKey || !folderId) {
    const missing = REQUIRED_ENV_KEYS.filter((k) => !process.env[k]);
    throw new Error(
      `Missing environment variables: ${
        missing.length > 0 ? missing.join(", ") : "unknown"
      }`
    );
  }

  const driveApiKey = apiKey;
  const driveFolderId = folderId;

  async function fetchFiles<T>(query: string, fields: string): Promise<T[]> {
    let pageToken: string | undefined;
    const items: T[] = [];

    do {
      const params = new URLSearchParams({
        key: driveApiKey,
        pageSize: "1000",
        q: query,
        fields: `nextPageToken,files(${fields})`,
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

  let rootFolderName = "";
  try {
    const rootRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        driveFolderId
      )}?fields=name&key=${encodeURIComponent(driveApiKey)}`,
      DRIVE_FETCH_INIT
    );
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
      folderSortKey: number;
    }
  >();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const { id: currentFolderId, name: currentFolderName } = current;
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
        "id,name,description,imageMediaMetadata(width,height)"
      ),
    ]);

    for (const folder of subfolders) {
      queue.push({ id: folder.id, name: folder.name ?? "" });
    }

    for (const file of imagesInFolder) {
      const fromFileName = parseDateKeyFromFolderLabel(file.name);
      const key = Math.max(folderSortKey, fromFileName);
      uniqueFiles.set(file.id, {
        ...file,
        folderSortKey: key,
      });
    }
  }

  return Array.from(uniqueFiles.values())
    .map((file) => {
      const width = file.imageMediaMetadata?.width ?? 1200;
      const height = file.imageMediaMetadata?.height ?? 1800;
      const description = file.description ?? "";
      const tags = extractHashtags(description);
      const story = extractStory(description);
      const tagDateKey = Number((tags[0] ?? "").replace("#", "")) || 0;
      const effectiveFolderKey =
        file.folderSortKey > 0 ? file.folderSortKey : tagDateKey;

      return {
        id: file.id,
        name: file.name,
        description,
        story,
        tags,
        dateTag: tags[0],
        locationTag: tags[1],
        momentTag: tags[2],
        withTag: tags[3],
        folderSortKey: effectiveFolderKey,
        thumbnailUrl: `https://lh3.googleusercontent.com/d/${file.id}=w800`,
        originalUrl: `https://lh3.googleusercontent.com/d/${file.id}`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
        ratio: (width >= height ? "landscape" : "portrait") as
          | "landscape"
          | "portrait",
        width,
        height,
      };
    })
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
