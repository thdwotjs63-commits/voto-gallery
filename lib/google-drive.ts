type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  imageMediaMetadata?: {
    width?: number;
    height?: number;
  };
};

type GoogleDriveListResponse = {
  files?: GoogleDriveFile[];
};

export type GalleryImage = {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
};

const DEFAULT_IMAGE_SIZE = {
  width: 1200,
  height: 1800,
} as const;

export async function getGoogleDriveImages(): Promise<GalleryImage[]> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;
  const folderId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID;

  if (!apiKey || !folderId) {
    console.warn("Missing Google Drive API env vars.");
    return [];
  }

  const params = new URLSearchParams({
    key: apiKey,
    pageSize: "100",
    orderBy: "createdTime desc",
    fields: "files(id,name,mimeType,imageMediaMetadata(width,height))",
    q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      next: { revalidate: 300 },
    }
  );

  if (!response.ok) {
    console.error("Google Drive API request failed.", response.status);
    return [];
  }

  const data = (await response.json()) as GoogleDriveListResponse;

  return (data.files ?? [])
    .filter((file) => file.id)
    .map((file) => ({
      id: file.id,
      name: file.name || "drive image",
      src: `https://lh3.googleusercontent.com/d/${file.id}`,
      width: file.imageMediaMetadata?.width ?? DEFAULT_IMAGE_SIZE.width,
      height: file.imageMediaMetadata?.height ?? DEFAULT_IMAGE_SIZE.height,
    }));
}
