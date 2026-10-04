import type { Metadata } from "next";
import { BlobNotFoundError } from "@vercel/blob";
import { boothBlobHead } from "@/lib/booth-blob";
import {
  boothPhotoApiPath,
  boothPhotoBlobPath,
  isBoothDateKey,
  isBoothPhotoId,
} from "@/lib/booth-share";
import { SavePhotoButton } from "./save-photo-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "다인네컷 📸 | daeni.kr",
  robots: { index: false, follow: false },
};

async function boothPhotoExists(date: string, id: string): Promise<boolean> {
  if (!isBoothDateKey(date) || !isBoothPhotoId(id)) return false;
  try {
    await boothBlobHead("p", boothPhotoBlobPath(date, id));
    return true;
  } catch (error) {
    if (!(error instanceof BlobNotFoundError)) {
      console.error("[p] blob head failed", error);
    }
    return false;
  }
}

export default async function BoothPhotoPage({
  params,
}: {
  params: Promise<{ date: string; id: string }>;
}) {
  const { date, id } = await params;
  const exists = await boothPhotoExists(date, id);
  const src = boothPhotoApiPath(date, id);

  return (
    <main className="flex min-h-dvh flex-col items-center bg-white px-4 pb-10 pt-5 text-zinc-900">
      <p className="text-sm font-semibold tracking-wide text-zinc-500">다인네컷 📸</p>
      {exists ? (
        <div className="mt-4 flex w-full max-w-md flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="다인네컷 사진"
            className="max-h-[78dvh] w-auto max-w-full rounded-lg shadow-[0_6px_28px_rgba(28,28,36,0.14)]"
          />
          <SavePhotoButton src={src} fileName={`daeni-4cut-${date}.jpg`} />
          <p className="text-center text-xs leading-relaxed text-zinc-500">
            아이폰은 사진을 길게 눌러 &lsquo;사진 앱에 저장&rsquo;도 돼요
          </p>
        </div>
      ) : (
        <p className="mt-24 text-center text-sm leading-relaxed text-zinc-600">
          사진을 찾을 수 없어요
          <br />
          (보관 기간이 지났을 수 있어요)
        </p>
      )}
    </main>
  );
}
