export const LIGHTBOX_RESTORE_PHOTO_ID_KEY = "voto_restore_lightbox_photo_id";

type TriggerPhotoDownloadOptions = {
  /** 다운로드로 탭이 바뀐 뒤 라이트박스를 다시 열 때 사용 */
  restorePhotoId?: string;
};

/**
 * Google Drive 다운로드 URL은 iframe(X-Frame-Options)에서 동작하지 않아
 * 새 탭/창으로 연다. restorePhotoId를 넘기면 복귀 시 라이트박스 복원에 사용한다.
 */
export function triggerPhotoDownload(
  url: string,
  options?: TriggerPhotoDownloadOptions
): void {
  if (!url || typeof document === "undefined") return;

  if (options?.restorePhotoId) {
    try {
      window.sessionStorage.setItem(
        LIGHTBOX_RESTORE_PHOTO_ID_KEY,
        options.restorePhotoId
      );
    } catch {
      // ignore quota / private mode
    }
  }

  const tab = window.open(url, "_blank", "noopener,noreferrer");
  if (tab) {
    tab.opener = null;
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
