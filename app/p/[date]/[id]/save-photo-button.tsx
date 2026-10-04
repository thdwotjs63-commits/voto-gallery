"use client";

import { useEffect, useRef } from "react";

function isAppleMobile(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SavePhotoButton({
  src,
  fileName,
}: {
  src: string;
  fileName: string;
}) {
  /** iOS 는 탭 직후에 share() 를 불러야 해서 미리 받아 둠 */
  const fileRef = useRef<File | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(src)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (alive) fileRef.current = new File([blob], fileName, { type: "image/jpeg" });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [src, fileName]);

  /** 안드로이드 크롬도 canShare 가 true 라서 공유 시트는 iOS 에서만 (갤럭시는 다운로드) */
  const handleSave = async () => {
    const file = fileRef.current;
    if (file && isAppleMobile() && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    if (file) {
      downloadFile(file);
      return;
    }
    window.location.href = src;
  };

  return (
    <button
      type="button"
      onClick={() => void handleSave()}
      className="w-full rounded-xl bg-[#c8202c] py-4 text-base font-bold text-white shadow-sm active:brightness-95"
    >
      📥 사진 저장
    </button>
  );
}
