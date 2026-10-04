export type SaveCardResult = "saved" | "opened" | "blocked" | "failed";

const PAGE_STYLE =
  "margin:0;background:#FFFBF0;display:flex;flex-direction:column;align-items:center;padding:16px;font-family:sans-serif;color:#1E3A9E;";

/** /calculator 와 같은 방식: 보통은 다운로드, iOS·Safari 는 새 탭에 이미지를 띄워 길게 눌러 저장 */
export async function saveCardImage(element: HTMLElement, fileName: string): Promise<SaveCardResult> {
  const ua = navigator.userAgent;
  const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const useSafariFlow = isSafari || isIOS;

  // 팝업 차단을 피하려면 탭은 클릭 직후(비동기 작업 전)에 열어야 한다
  let safariWin: Window | null = null;
  if (useSafariFlow) {
    safariWin = window.open("", "_blank");
    if (safariWin) {
      safariWin.document.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>이미지 저장</title></head><body style="${PAGE_STYLE}"><p>이미지 만드는 중...</p></body></html>`
      );
      safariWin.document.close();
    }
  }

  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(element, {
      backgroundColor: "#FFFBF0",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob failed"))), "image/png");
    });
    const url = URL.createObjectURL(blob);

    if (useSafariFlow) {
      if (!safariWin || safariWin.closed) {
        URL.revokeObjectURL(url);
        return "blocked";
      }
      safariWin.document.open();
      safariWin.document.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${fileName}</title></head><body style="${PAGE_STYLE}"><p style="font-size:14px;margin:0 0 12px;text-align:center;">이미지를 길게 눌러 「사진에 저장」을 선택해 주세요.</p><img src="${url}" alt="${fileName}" style="max-width:100%;height:auto;"/></body></html>`
      );
      safariWin.document.close();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return "opened";
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return "saved";
  } catch (error) {
    if (safariWin && !safariWin.closed) safariWin.close();
    console.error("[worldcup] 이미지 저장 실패", error);
    return "failed";
  }
}
