import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findStarPlayer, type StarPlayer } from "@/lib/star-players";
import { fetchVotoCategoryImages } from "@/lib/voto-gallery-data";
import { ALL_VOTO_CATEGORY } from "@/lib/voto-categories";
import { filterImagesByQuery } from "@/lib/voto-search-index";
import type { VotoImage } from "@/lib/voto-gallery-data";
import { DEFAULT_OG_IMAGE_URL, SITE_URL } from "@/lib/seo-metadata";

export const dynamic = "force-dynamic";

type StarPageProps = {
  params: Promise<{ name: string }>;
};

export async function generateMetadata({ params }: StarPageProps): Promise<Metadata> {
  const { name: raw } = await params;
  const player = findStarPlayer(raw);
  if (!player) {
    return { title: "선수 | DAENI.KR" };
  }
  const title = `${player.name} | DAENI.KR`;
  const description = player.team
    ? `${player.name} (${player.team}) — 사진, 구단 채널, 기록을 한곳에서.`
    : `${player.name} — 사진, 구단 채널, 기록을 한곳에서.`;
  const path = `/star/${player.slug}`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${path}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${path}`,
      type: "website",
      images: [{ url: DEFAULT_OG_IMAGE_URL }],
    },
  };
}

type HubLink = {
  href: string;
  label: string;
  sub: string;
  icon: string;
  external: boolean;
};

/** 링크 종류별 아이콘. 인스타·유튜브는 대표 로고, 나머지는 심플 아이콘. */
function BrandIcon({ kind }: { kind: string }) {
  const box = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl";
  if (kind === "instagram") {
    return (
      <span className={box} style={{ background: "linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)" }}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#fff" strokeWidth="2" aria-hidden>
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.5" cy="6.5" r="1.3" fill="#fff" stroke="none" />
        </svg>
      </span>
    );
  }
  if (kind === "youtube") {
    return (
      <span className={box} style={{ background: "#FF0000" }}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#fff" aria-hidden>
          <path d="M23 12s0-3.3-.42-4.9a2.56 2.56 0 0 0-1.8-1.8C19.2 5 12 5 12 5s-7.2 0-8.78.3a2.56 2.56 0 0 0-1.8 1.8C1 8.7 1 12 1 12s0 3.3.42 4.9a2.56 2.56 0 0 0 1.8 1.8C4.8 19 12 19 12 19s7.2 0 8.78-.3a2.56 2.56 0 0 0 1.8-1.8C23 15.3 23 12 23 12zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
        </svg>
      </span>
    );
  }
  if (kind === "naver") {
    return (
      <span className={box} style={{ background: "#03C75A" }}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#fff" aria-hidden>
          <path d="M16.3 3v9.2L8 3H3v18h5.7v-9.2L17 21h4V3h-4.7z" />
        </svg>
      </span>
    );
  }
  // home / 기타
  return (
    <span className={`${box} bg-white/10`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    </span>
  );
}

/** 팀 전체 이름 → 짧은 팀명 (홈페이지 버튼 라벨용) */
function shortTeamName(team?: string): string {
  if (!team) return "구단";
  // "현대건설 힐스테이트" → "현대건설", "SOOP SOOPers" → "SOOP"
  return team.split(" ")[0] || team;
}

function buildLinks(player: StarPlayer): HubLink[] {
  const links: HubLink[] = [];
  const t = shortTeamName(player.team);
  if (player.instagram?.trim()) {
    links.push({
      href: player.instagram,
      label: `${t} 인스타그램`,
      sub: "최신 소식 · 비하인드",
      icon: "instagram",
      external: true,
    });
  }
  if (player.youtube?.trim()) {
    links.push({
      href: player.youtube,
      label: `${t} 유튜브`,
      sub: "경기 하이라이트 · 영상",
      icon: "youtube",
      external: true,
    });
  }
  if (player.homepage?.trim()) {
    links.push({
      href: player.homepage,
      label: `${t} 홈페이지`,
      sub: "구단 공식 사이트",
      icon: "home",
      external: true,
    });
  }
  if (player.naverSports?.trim()) {
    links.push({
      href: player.naverSports,
      label: "네이버 스포츠 배구",
      sub: "뉴스 · 기록 · 일정",
      icon: "naver",
      external: true,
    });
  }
  return links;
}

/** sortTimeMs → "11.23" 식 표기 (KST). 0이면 null. */
function formatRecentDate(ms: number): string | null {
  if (!ms || !Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const yy = String(kst.getUTCFullYear()).slice(2);
  return `${yy}.${mm}.${dd}`;
}

export default async function StarPlayerPage({ params }: StarPageProps) {
  const { name: raw } = await params;
  const player = findStarPlayer(raw);
  if (!player) {
    notFound();
  }
  const links = buildLinks(player);
  const hasGallery = !!player.galleryQuery?.trim();

  // 서버에서 그 선수 사진을 미리 불러와 최신 썸네일 + 최근 날짜를 구한다.
  let recentImages: VotoImage[] = [];
  let photoCount = 0;
  let recentLabel: string | null = null;
  if (hasGallery) {
    try {
      const all = await fetchVotoCategoryImages(ALL_VOTO_CATEGORY);
      const mine = filterImagesByQuery(all, player.galleryQuery!).sort(
        (a, b) => b.sortTimeMs - a.sortTimeMs
      );
      photoCount = mine.length;
      recentImages = mine.slice(0, 4);
      if (mine[0]) recentLabel = formatRecentDate(mine[0].sortTimeMs);
    } catch {
      // 사진 로딩 실패해도 허브는 그대로 보여준다.
    }
  }

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-16 pt-16">
        {/* 헤더 — 선수 이름이 메인 */}
        <header className="text-center">
          <h1 className="text-[2.1rem] font-bold leading-tight tracking-tight text-white">
            {player.name}
          </h1>
          {player.team ? (
            <p className="mt-2 text-sm text-zinc-400">{player.team}</p>
          ) : null}
        </header>

        <nav className="mt-9 flex flex-col gap-3">
          {/* 사진 보기 — 최신 사진이 은은하게 비치는 버튼 */}
          {hasGallery ? (
            <Link
              href={player.photoHref ?? `/star/${player.slug}/photos`}
              className="group relative overflow-hidden rounded-2xl border border-white/10 transition hover:border-white/25"
            >
              {/* 배경: photoBg 지정 시 단일 이미지, 아니면 최신 썸네일들 */}
              {player.photoBg ? (
                <div
                  className="pointer-events-none absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${player.photoBg})` }}
                />
              ) : recentImages.length > 0 ? (
                <div className="pointer-events-none absolute inset-0 flex">
                  {recentImages.map((img) => (
                    <div
                      key={img.id}
                      className="h-full flex-1 bg-cover bg-center"
                      style={{ backgroundImage: `url(${img.thumbSrc})` }}
                    />
                  ))}
                </div>
              ) : null}
              {/* 어둡게 덮는 오버레이 (투명감) */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#0c0c0e]/92 via-[#0c0c0e]/80 to-[#0c0c0e]/70" />
              <div className="relative flex items-center gap-4 px-5 py-5">
                <span className="text-2xl" aria-hidden>
                  📷
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-white">
                    사진 보기
                  </span>
                  <span className="block truncate text-xs text-zinc-300/85">
                    {player.photoHref
                      ? "다인이 전체 사진 갤러리"
                      : `${photoCount > 0 ? `${photoCount}장` : "VOTO 갤러리"}${recentLabel ? ` · 최근 ${recentLabel}` : ""}`}
                  </span>
                </span>
                <span
                  className="text-white/60 transition group-hover:translate-x-0.5"
                  aria-hidden
                >
                  →
                </span>
              </div>
            </Link>
          ) : null}

          {/* 선수별 추가 링크 (daeni.kr 내부 기능 등) */}
          {(player.extraLinks ?? []).map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 transition hover:border-white/25 hover:bg-white/[0.08]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg" aria-hidden>
                  {link.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-white">{link.label}</span>
                  <span className="block truncate text-xs text-zinc-400">{link.sub}</span>
                </span>
                <span className="text-zinc-600 transition group-hover:text-zinc-300" aria-hidden>↗</span>
              </a>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 transition hover:border-white/25 hover:bg-white/[0.08]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg" aria-hidden>
                  {link.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-white">{link.label}</span>
                  <span className="block truncate text-xs text-zinc-400">{link.sub}</span>
                </span>
                <span className="text-zinc-600 transition group-hover:text-zinc-300" aria-hidden>→</span>
              </Link>
            )
          )}

          {/* 외부 링크들 — 깔끔한 단색 버튼 + 브랜드 아이콘 */}
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 transition hover:border-white/25 hover:bg-white/[0.08]"
            >
              <BrandIcon kind={link.icon} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-white">
                  {link.label}
                </span>
                <span className="block truncate text-xs text-zinc-400">{link.sub}</span>
              </span>
              <span className="text-zinc-600 transition group-hover:text-zinc-300" aria-hidden>
                ↗
              </span>
            </a>
          ))}

          {links.length === 0 && !hasGallery ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-zinc-500">
              준비 중이에요.
            </p>
          ) : null}
        </nav>

        <footer className="mt-auto pt-12 text-center">
          <Link href="/" className="text-xs text-zinc-500 transition hover:text-zinc-300">
            daeni.kr
          </Link>
        </footer>
      </div>
    </div>
  );
}
