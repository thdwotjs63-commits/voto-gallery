/** 김다인월드컵(/exhibition) — 월드컵 전용 드라이브 폴더의 사진 */

import {
  WORLDCUP_FOLDER_ID_ENV_KEY,
  driveLh3FullDisplayUrl,
  fetchDriveFolderImages,
} from "./drive-gallery-data";

export type ExhibitionPhoto = {
  /** 드라이브 파일 ID — 월드컵 기록의 photo_id */
  photoId: string;
  src: string;
  width: number;
  height: number;
  /** 화면에 보이는 사진명 (cleanPhotoName 결과) */
  name: string;
};

const COPY_SUFFIX_RE = /\s*의\s*사본(\s*\(\d+\))?\s*$/;
const COPY_PREFIX_RE = /^\s*(copy of|사본\s*-)\s+/i;
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?)$/i;
/** 정렬용 앞 번호: "01_", "2-", "03." … (연도 같은 4자리 숫자는 남긴다) */
const ORDER_PREFIX_RE = /^\d{1,3}\s*[_\-.)]\s*/;

/** 드라이브 파일명 → 화면용 사진명. "01_따봉.JPG의 사본" → "따봉" */
export function cleanPhotoName(fileName: string): string {
  let name = fileName.trim();
  for (let prev = ""; prev !== name; ) {
    prev = name;
    name = name.replace(COPY_SUFFIX_RE, "").replace(COPY_PREFIX_RE, "").replace(IMAGE_EXT_RE, "").trim();
  }
  return name.replace(ORDER_PREFIX_RE, "").trim() || name;
}

/** WORLDCUP_DRIVE_FOLDER_ID 폴더 바로 안의 이미지, 파일 이름 오름차순 (5분 캐시) */
export async function getWorldcupPhotos(): Promise<ExhibitionPhoto[]> {
  const folderId = process.env[WORLDCUP_FOLDER_ID_ENV_KEY]?.trim();
  if (!folderId) throw new Error(`Missing environment variables: ${WORLDCUP_FOLDER_ID_ENV_KEY}`);

  const images = await fetchDriveFolderImages(folderId);
  return images.map(({ id, name, width, height }) => ({
    photoId: id,
    src: driveLh3FullDisplayUrl(id),
    width,
    height,
    name: cleanPhotoName(name),
  }));
}
