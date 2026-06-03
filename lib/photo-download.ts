/**
 * SPA를 떠나지 않고 다운로드를 시도합니다.
 * (모바일 Safari에서 window.open은 새 탭/전체 이탈로 라이트박스가 닫히는 경우가 많음)
 */
export function triggerPhotoDownload(url: string): void {
  if (!url || typeof document === "undefined") return;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("tabindex", "-1");
  iframe.style.cssText =
    "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
  iframe.src = url;
  document.body.appendChild(iframe);

  window.setTimeout(() => {
    iframe.remove();
  }, 120_000);
}
