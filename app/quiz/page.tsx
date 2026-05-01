import Link from "next/link";
import { PhotoQuizGame } from "@/components/photo-quiz-game";
import { fetchDriveGalleryImages } from "@/lib/drive-gallery-data";

export default async function QuizPage() {
  try {
    const photos = await fetchDriveGalleryImages();
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-white to-[#00287A]/[0.04]">
        <PhotoQuizGame photos={photos} />
      </div>
    );
  } catch {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <p className="text-4xl" aria-hidden>
          🏐
        </p>
        <h1 className="text-2xl font-bold text-[#00287A]">퀴즈를 불러오지 못했어요</h1>
        <p className="text-sm leading-relaxed text-[#00287A]/85">
          갤러리 API 설정을 확인한 뒤 다시 시도해 주세요.
        </p>
        <Link
          href="/"
          className="rounded-full border-2 border-[#00287A] bg-[#FFD200] px-6 py-2.5 text-sm font-semibold text-[#00287A] shadow-[0_6px_16px_rgba(0,40,122,0.18)] transition hover:opacity-95"
        >
          갤러리로 돌아가기
        </Link>
      </main>
    );
  }
}
