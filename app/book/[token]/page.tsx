import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { isValidBookToken } from "@/lib/book-auth";
import {
  buildDemoMessages,
  loadAllBirthdayMessages,
  loadHiddenMessageIdsForBook,
} from "@/lib/book-data";
import {
  buildBookPages,
  selectVisibleBookMessages,
  type BookMessage,
} from "@/lib/book-pages";
import { BookViewer } from "./book-viewer";

export const dynamic = "force-dynamic";

const TITLE = "다인 선수 생일 축하해요 🎂";
const DESCRIPTION = "팬들이 마음을 모아 만든 생일 메시지북이에요";
const DEMO_MAX = 300;

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#1e3e96",
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ demo?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  if (!isValidBookToken(token)) notFound();
  return {
    title: TITLE,
    description: DESCRIPTION,
    robots: { index: false, follow: false, nocache: true },
    alternates: { canonical: null },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      siteName: "daeni.kr",
      type: "website",
      locale: "ko_KR",
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

function readDemoCount(raw: string | undefined): number | null {
  if (process.env.NODE_ENV !== "development" || raw === undefined) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, DEMO_MAX) : null;
}

async function loadVisibleMessages(): Promise<BookMessage[]> {
  const [messages, hiddenIds] = await Promise.all([
    loadAllBirthdayMessages(),
    loadHiddenMessageIdsForBook("book"),
  ]);
  return selectVisibleBookMessages(messages, hiddenIds);
}

export default async function BookPage({ params, searchParams }: Props) {
  const { token } = await params;
  if (!isValidBookToken(token)) notFound();

  const demoCount = readDemoCount((await searchParams).demo);
  let messages: BookMessage[];
  try {
    messages = demoCount === null ? await loadVisibleMessages() : buildDemoMessages(demoCount);
  } catch (error) {
    console.error("[book] failed to load messages", error);
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f6f3ee] px-6 text-center text-sm leading-relaxed text-[#1c1c24]">
        책을 불러오지 못했어요.
        <br />
        잠시 후 다시 열어 주세요.
      </main>
    );
  }

  return <BookViewer pages={buildBookPages(messages)} />;
}
