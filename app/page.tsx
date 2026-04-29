"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/pagination";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase-client";

type DriveImage = {
  id: string;
  name: string;
  description: string;
  story?: string;
  tags: string[];
  dateTag?: string;
  locationTag?: string;
  momentTag?: string;
  withTag?: string;
  /** YYYYMMDD from parent folder name (e.g. 260413 → 20260413); 0 if none */
  folderSortKey: number;
  thumbnailUrl: string;
  originalUrl: string;
  downloadUrl: string;
  ratio: "portrait" | "landscape";
  width: number;
  height: number;
};

type PhotoLikeRow = {
  id: number;
  photo_id: string;
};

type GuestbookEntry = {
  id: number;
  nickname: string;
  content: string;
  created_at: string;
};

const BANNED_WORDS = ["씨발", "병신", "개새끼", "지랄", "fuck", "shit", "bitch"];
const CONTENT_MAX_LENGTH = 180;
const NICKNAME_MAX_LENGTH = 24;

const REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY",
  "NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID",
] as const;

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  return Array.from(new Set(matches.map((tag) => tag.toLowerCase())));
}

function extractStory(text: string): string | undefined {
  const withoutHashtags = text.replace(/#[\p{L}\p{N}_-]+/gu, " ");
  const normalized = withoutHashtags.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

/** Parse calendar date from folder/file label: YYYYMMDD or YYMMDD (YY 00–69 → 20YY) */
function parseDateKeyFromFolderLabel(text: string): number {
  let best = 0;
  const eight = text.match(/\b(19\d{6}|20\d{6})\b/g);
  if (eight) {
    for (const m of eight) {
      const n = Number(m);
      if (n > best) best = n;
    }
  }
  const stripped = text.replace(/\b(19\d{6}|20\d{6})\b/g, " ");
  const yymmdd = stripped.matchAll(/\b(\d{2})(\d{2})(\d{2})\b/g);
  for (const m of yymmdd) {
    const yy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) continue;
    const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
    const key = yyyy * 10000 + mm * 100 + dd;
    if (key > best) best = key;
  }
  return best;
}

async function getGoogleDriveImages(): Promise<DriveImage[]> {
  const envApiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY;
  const envFolderId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID;

  const apiKey = envApiKey;
  const folderId = envFolderId;

  console.log("[Google Drive] Config source: .env.local");

  if (!apiKey || !folderId) {
    const missingKeys = REQUIRED_ENV_KEYS.filter((key) => !process.env[key]);
    console.log("[Google Drive] Env check:", {
      NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY: Boolean(envApiKey),
      NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID: Boolean(envFolderId),
    });
    console.log(
      "[Google Drive] Missing env keys:",
      missingKeys.length > 0 ? missingKeys.join(", ") : "(unknown)"
    );
    throw new Error(
      `Missing environment variables: ${
        missingKeys.length > 0 ? missingKeys.join(", ") : "unknown"
      }`
    );
  }

  const resolvedApiKey = apiKey;

  async function fetchFiles<T>(query: string, fields: string): Promise<T[]> {
    let pageToken: string | undefined;
    const items: T[] = [];

    do {
      const params = new URLSearchParams({
        key: resolvedApiKey,
        pageSize: "1000",
        q: query,
        fields: `nextPageToken,files(${fields})`,
      });

      if (pageToken) {
        params.set("pageToken", pageToken);
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(`Google Drive API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        nextPageToken?: string;
        files?: T[];
      };

      items.push(...(data.files ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    return items;
  }

  let rootFolderName = "";
  try {
    const rootRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        folderId
      )}?fields=name&key=${encodeURIComponent(resolvedApiKey)}`,
      { cache: "no-store" }
    );
    if (rootRes.ok) {
      const rootData = (await rootRes.json()) as { name?: string };
      rootFolderName = rootData.name ?? "";
    }
  } catch {
    /* ignore */
  }

  type QueueItem = { id: string; name: string };
  const queue: QueueItem[] = [{ id: folderId, name: rootFolderName }];
  const visitedFolderIds = new Set<string>();
  const uniqueFiles = new Map<
    string,
    {
      id: string;
      name: string;
      description?: string;
      imageMediaMetadata?: { width?: number; height?: number };
      folderSortKey: number;
    }
  >();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const { id: currentFolderId, name: currentFolderName } = current;
    if (visitedFolderIds.has(currentFolderId)) continue;
    visitedFolderIds.add(currentFolderId);

    const folderSortKey = parseDateKeyFromFolderLabel(currentFolderName);

    const [subfolders, imagesInFolder] = await Promise.all([
      fetchFiles<{ id: string; name: string }>(
        `'${currentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        "id,name"
      ),
      fetchFiles<{
        id: string;
        name: string;
        description?: string;
        imageMediaMetadata?: { width?: number; height?: number };
      }>(
        `'${currentFolderId}' in parents and mimeType contains 'image/' and trashed = false`,
        "id,name,description,imageMediaMetadata(width,height)"
      ),
    ]);

    for (const folder of subfolders) {
      queue.push({ id: folder.id, name: folder.name ?? "" });
    }

    for (const file of imagesInFolder) {
      const fromFileName = parseDateKeyFromFolderLabel(file.name);
      const key = Math.max(folderSortKey, fromFileName);
      uniqueFiles.set(file.id, {
        ...file,
        folderSortKey: key,
      });
    }
  }

  return Array.from(uniqueFiles.values())
    .map((file) => {
      const width = file.imageMediaMetadata?.width ?? 1200;
      const height = file.imageMediaMetadata?.height ?? 1800;
      const description = file.description ?? "";
      const tags = extractHashtags(description);
      const story = extractStory(description);
      const tagDateKey = Number((tags[0] ?? "").replace("#", "")) || 0;
      const effectiveFolderKey =
        file.folderSortKey > 0 ? file.folderSortKey : tagDateKey;

      return {
        id: file.id,
        name: file.name,
        description,
        story,
        tags,
        dateTag: tags[0],
        locationTag: tags[1],
        momentTag: tags[2],
        withTag: tags[3],
        folderSortKey: effectiveFolderKey,
        thumbnailUrl: `https://lh3.googleusercontent.com/d/${file.id}=w800`,
        originalUrl: `https://lh3.googleusercontent.com/d/${file.id}`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
        ratio: (width >= height ? "landscape" : "portrait") as
          | "landscape"
          | "portrait",
        width,
        height,
      };
    })
    .sort((a, b) => {
      if (a.folderSortKey !== b.folderSortKey) {
        return b.folderSortKey - a.folderSortKey;
      }

      return b.name.localeCompare(a.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

export default function Home() {
  const [images, setImages] = useState<DriveImage[]>([]);
  const [likesByPhoto, setLikesByPhoto] = useState<Record<string, number>>({});
  const [likingByPhoto, setLikingByPhoto] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [selectedDateTag, setSelectedDateTag] = useState("all");
  const [selectedLocationTag, setSelectedLocationTag] = useState("all");
  const [selectedMomentTag, setSelectedMomentTag] = useState("all");
  const [selectedWithTag, setSelectedWithTag] = useState("all");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest" | "popular">(
    "latest"
  );
  const [activeBestIndex, setActiveBestIndex] = useState(0);
  const [showTopButton, setShowTopButton] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([]);
  const [guestNickname, setGuestNickname] = useState("");
  const [guestContent, setGuestContent] = useState("");
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [guestbookError, setGuestbookError] = useState<string | null>(null);
  const likesRef = useRef<Record<string, number>>({});
  const lastLikeClickAtRef = useRef<Record<string, number>>({});
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const guestbookRef = useRef<HTMLElement | null>(null);
  const [heroScrollY, setHeroScrollY] = useState(0);
  const [heroVisible, setHeroVisible] = useState(false);
  const lastScrollYRef = useRef(0);
  const lastGuestSubmitRef = useRef<{ content: string; at: number } | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const driveImages = await getGoogleDriveImages();
        if (mounted) {
          setImages(driveImages);
        }
      } catch (err) {
        if (mounted) {
          const message =
            err instanceof Error ? err.message : "Failed to load images.";
          setError(message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setLightboxIndex(-1);
  }, [selectedDateTag, selectedLocationTag, selectedMomentTag, selectedWithTag]);

  useEffect(() => {
    setHeroVisible(true);

    const onScroll = () => {
      const currentY = window.scrollY;
      const previousY = lastScrollYRef.current;

      setHeroScrollY(currentY);
      setShowTopButton(currentY > 320);

      if (currentY < 80) {
        setShowStickyHeader(false);
      } else if (currentY > previousY) {
        setShowStickyHeader(false);
      } else {
        setShowStickyHeader(true);
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    likesRef.current = likesByPhoto;
  }, [likesByPhoto]);

  useEffect(() => {
    const photoIds = images.map((image) => image.id);
    if (photoIds.length === 0) return;

    let mounted = true;

    const loadLikes = async () => {
      const { data, error: likesError } = await supabase
        .from("photo_likes")
        .select("id,photo_id")
        .in("photo_id", photoIds);

      if (likesError) {
        console.error("Failed to load likes:", likesError.message);
        return;
      }

      const baseMap = Object.fromEntries(photoIds.map((id) => [id, 0]));
      const rows = (data ?? []) as PhotoLikeRow[];
      const mergedMap = rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.photo_id] = (acc[row.photo_id] ?? 0) + 1;
        return acc;
      }, baseMap);

      if (mounted) {
        setLikesByPhoto(mergedMap);
      }
    };

    loadLikes();

    return () => {
      mounted = false;
    };
  }, [images]);

  useEffect(() => {
    let mounted = true;

    const loadGuestbook = async () => {
      const { data, error: guestbookError } = await supabase
        .from("guestbook")
        .select("id,nickname,content,created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (guestbookError) {
        console.error("Failed to load guestbook:", guestbookError.message);
        return;
      }

      if (mounted) {
        setGuestbookEntries((data ?? []) as GuestbookEntry[]);
      }
    };

    loadGuestbook();

    const channel = supabase
      .channel("guestbook-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "guestbook" },
        (payload) => {
          const entry = payload.new as GuestbookEntry;
          setGuestbookEntries((prev) =>
            prev.some((item) => item.id === entry.id) ? prev : [entry, ...prev]
          );
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const handleGuestbookSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nickname = guestNickname.trim();
    const content = guestContent.trim();
    if (!nickname || !content || guestSubmitting) return;

    setGuestbookError(null);

    const lowered = content.toLowerCase();
    const hasBannedWord = BANNED_WORDS.some((word) => lowered.includes(word));
    const hasUrl = /(https?:\/\/|www\.)/i.test(content);
    const hasRepeatedSpam = /(.)\1{6,}/.test(content);
    const isTooManySameChars = content.replace(/\s/g, "").length > 0 &&
      new Set(content.replace(/\s/g, "")).size <= 2 &&
      content.length > 24;
    const lastSubmit = lastGuestSubmitRef.current;
    const isDuplicateFastSubmit =
      lastSubmit &&
      lastSubmit.content === content &&
      Date.now() - lastSubmit.at < 30_000;

    if (hasBannedWord) {
      setGuestbookError("욕설/비속어가 포함된 메시지는 등록할 수 없습니다.");
      return;
    }
    if (hasUrl || hasRepeatedSpam || isTooManySameChars || isDuplicateFastSubmit) {
      setGuestbookError("스팸으로 의심되는 메시지는 등록할 수 없습니다.");
      return;
    }

    setGuestSubmitting(true);
    try {
      const { data, error: insertError } = await supabase
        .from("guestbook")
        .insert({ nickname, content })
        .select("id,nickname,content,created_at")
        .single();

      if (insertError) {
        throw insertError;
      }

      const inserted = data as GuestbookEntry;
      setGuestbookEntries((prev) =>
        prev.some((item) => item.id === inserted.id) ? prev : [inserted, ...prev]
      );
      lastGuestSubmitRef.current = { content, at: Date.now() };
      setGuestNickname("");
      setGuestContent("");
    } catch (submitError) {
      console.error("Failed to submit guestbook:", submitError);
    } finally {
      setGuestSubmitting(false);
    }
  };

  const handleLike = async (photoId: string) => {
    if (likingByPhoto[photoId]) return;

    const now = Date.now();
    const lastClick = lastLikeClickAtRef.current[photoId] ?? 0;
    if (now - lastClick < 700) return;
    lastLikeClickAtRef.current[photoId] = now;

    const previousCount = likesRef.current[photoId] ?? 0;
    setLikingByPhoto((prev) => ({ ...prev, [photoId]: true }));
    setLikesByPhoto((prev) => ({ ...prev, [photoId]: previousCount + 1 }));

    try {
      const { error: insertError } = await supabase
        .from("photo_likes")
        .insert({ photo_id: photoId });

      if (insertError) {
        throw insertError;
      }
    } catch (likeError) {
      console.error("Failed to update like:", likeError);
      setLikesByPhoto((prev) => ({ ...prev, [photoId]: previousCount }));
    } finally {
      setLikingByPhoto((prev) => ({ ...prev, [photoId]: false }));
    }
  };

  const dropdownTags = useMemo(
    () => ({
      date: Array.from(
        new Set(
          images
            .map((image) => image.dateTag)
            .filter((tag): tag is string => Boolean(tag))
        )
      ).sort((a, b) => a.localeCompare(b)),
      location: Array.from(
        new Set(
          images
            .map((image) => image.locationTag)
            .filter((tag): tag is string => Boolean(tag))
        )
      ).sort((a, b) => a.localeCompare(b)),
      moment: Array.from(
        new Set(
          images
            .map((image) => image.momentTag)
            .filter((tag): tag is string => Boolean(tag))
        )
      ).sort((a, b) => a.localeCompare(b)),
      with: Array.from(
        new Set(
          images
            .map((image) => image.withTag)
            .filter((tag): tag is string => Boolean(tag))
        )
      ).sort((a, b) => a.localeCompare(b)),
    }),
    [images]
  );

  const filteredImages = useMemo(
    () =>
      images.filter((image) => {
        if (selectedDateTag !== "all" && image.dateTag !== selectedDateTag) {
          return false;
        }
        if (
          selectedLocationTag !== "all" &&
          image.locationTag !== selectedLocationTag
        ) {
          return false;
        }
        if (selectedMomentTag !== "all" && image.momentTag !== selectedMomentTag) {
          return false;
        }
        if (selectedWithTag !== "all" && image.withTag !== selectedWithTag) {
          return false;
        }
        return true;
      }),
    [images, selectedDateTag, selectedLocationTag, selectedMomentTag, selectedWithTag]
  );

  const sortedFilteredImages = useMemo(
    () =>
      [...filteredImages].sort((a, b) => {
        if (sortOrder === "popular") {
          return (likesByPhoto[b.id] ?? 0) - (likesByPhoto[a.id] ?? 0);
        }
        if (sortOrder === "latest") {
          if (a.folderSortKey !== b.folderSortKey) {
            return b.folderSortKey - a.folderSortKey;
          }
          return b.name.localeCompare(a.name, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }
        if (a.folderSortKey !== b.folderSortKey) {
          return a.folderSortKey - b.folderSortKey;
        }
        return a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }),
    [filteredImages, sortOrder, likesByPhoto]
  );

  const bestPicks = useMemo(
    () =>
      [...images]
        .sort((a, b) => (likesByPhoto[b.id] ?? 0) - (likesByPhoto[a.id] ?? 0))
        .slice(0, 3),
    [images, likesByPhoto]
  );

  const heroImage = useMemo(
    () => images.find((image) => image.tags.includes("#hero")) ?? images[0],
    [images]
  );

  const heroBackgroundTranslate = Math.max(-heroScrollY * 0.12, -140);
  const heroTextTranslate = Math.max(-heroScrollY * 0.32, -220);

  const scrollToGallery = () => {
    galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToGuestbook = () => {
    guestbookRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div
        className={`fixed left-0 right-0 top-0 z-40 transition-transform duration-300 ${
          showStickyHeader ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto mt-2 w-[calc(100%-16px)] max-w-[1280px] rounded-xl border border-white/35 bg-white/65 px-3 py-2 backdrop-blur-md sm:mt-3 sm:w-[calc(100%-24px)] sm:px-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium lowercase tracking-[0.04em] text-zinc-900">
              voto gallery
            </span>
            <span className="text-[10px] text-zinc-500 sm:text-xs">
              © 2025 VOTO. All rights reserved.
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                setSelectedDateTag("all");
                setSelectedLocationTag("all");
                setSelectedMomentTag("all");
                setSelectedWithTag("all");
              }}
              className="min-h-11 shrink-0 rounded-full bg-zinc-100 px-3 text-xs text-zinc-700"
            >
              전체
            </button>
            <select
              value={selectedDateTag}
              onChange={(event) => setSelectedDateTag(event.target.value)}
              className="min-h-11 shrink-0 rounded-full bg-zinc-100 px-3 text-xs text-zinc-700 outline-none"
            >
              <option value="all">Date</option>
              {dropdownTags.date.map((tag) => (
                <option key={`sticky-date-${tag}`} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <select
              value={selectedLocationTag}
              onChange={(event) => setSelectedLocationTag(event.target.value)}
              className="min-h-11 shrink-0 rounded-full bg-zinc-100 px-3 text-xs text-zinc-700 outline-none"
            >
              <option value="all">Location</option>
              {dropdownTags.location.map((tag) => (
                <option key={`sticky-location-${tag}`} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <select
              value={selectedMomentTag}
              onChange={(event) => setSelectedMomentTag(event.target.value)}
              className="min-h-11 shrink-0 rounded-full bg-zinc-100 px-3 text-xs text-zinc-700 outline-none"
            >
              <option value="all">Moment</option>
              {dropdownTags.moment.map((tag) => (
                <option key={`sticky-moment-${tag}`} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <select
              value={selectedWithTag}
              onChange={(event) => setSelectedWithTag(event.target.value)}
              className="min-h-11 shrink-0 rounded-full bg-zinc-100 px-3 text-xs text-zinc-700 outline-none"
            >
              <option value="all">With</option>
              {dropdownTags.with.map((tag) => (
                <option key={`sticky-with-${tag}`} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <select
              value={sortOrder}
              onChange={(event) =>
                  setSortOrder(
                    event.target.value as "latest" | "oldest" | "popular"
                  )
              }
              className="min-h-11 shrink-0 rounded-full bg-zinc-100 px-3 text-xs text-zinc-700 outline-none"
            >
              <option value="latest">최신순</option>
              <option value="oldest">오래된 순</option>
                <option value="popular">인기순</option>
            </select>
          </div>
        </div>
      </div>

      <section className="relative h-screen w-full overflow-hidden bg-black">
        {heroImage ? (
          <div
            className="absolute inset-0 will-change-transform"
            style={{ transform: `translate3d(0, ${heroBackgroundTranslate}px, 0)` }}
          >
            <Image
              src={heroImage.originalUrl}
              alt={heroImage.name}
              fill
              priority
              className="object-cover object-[center_28%] sm:object-center"
              sizes="100vw"
              quality={85}
            />
          </div>
        ) : null}

        <div className="absolute inset-0 bg-black/55" />

        <div
          className={`relative z-10 flex h-full flex-col items-center justify-center px-6 text-center text-white transition-all duration-1000 ${
            heroVisible ? "opacity-100" : "opacity-0"
          }`}
          style={{ transform: `translate3d(0, ${heroTextTranslate}px, 0)` }}
        >
          <h1 className="text-3xl font-medium tracking-wide sm:text-4xl md:text-5xl">
            Captured Moments of Kim Da-in
          </h1>
          <p className="mt-4 text-sm tracking-[0.24em] text-zinc-200 sm:text-base">
            Photography by Voto.
          </p>

          <a
            href="https://www.instagram.com/voto_v3?igsh=NDZrcGhndXQybzNm&utm_source=qr"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-4 py-2 text-sm text-white/90 transition hover:-translate-y-0.5 hover:bg-white/20 hover:text-white"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
            </svg>
            <span>@voto_v3</span>
          </a>

          <button
            type="button"
            onClick={scrollToGallery}
            className="mt-10 rounded-full border border-white/50 px-6 py-2 text-sm tracking-wide text-white transition hover:bg-white/10"
          >
            Explore Gallery
          </button>

          <button
            type="button"
            onClick={scrollToGallery}
            className="mt-6 animate-bounce text-2xl text-zinc-200"
            aria-label="Scroll to gallery"
          >
            ↓
          </button>
        </div>
      </section>

      <div
        ref={galleryRef}
        className="mx-auto min-h-screen w-full max-w-[1280px] bg-[#FFFFFF] px-5 pb-16 pt-8 sm:px-8 md:px-12"
      >
      <header className="mb-16 flex items-center justify-between">
        <div className="text-base font-medium lowercase tracking-[0.04em] sm:text-lg">
          voto gallery
        </div>
        <div aria-hidden className="h-6 w-16" />
      </header>

      <main>
        <p className="mb-12 text-xs lowercase tracking-[0.18em] text-zinc-500 sm:mb-14">
          theme : 3
        </p>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : images.length > 0 ? (
          <>
            <section className="mb-10">
              <h2 className="mb-4 text-sm font-medium tracking-wide text-zinc-800">
                🏆 Best Picks
              </h2>
              <div className="relative mx-auto w-full max-w-[980px] overflow-hidden rounded-md bg-black">
                <Swiper
                  modules={[Autoplay, EffectFade, Pagination]}
                  effect="fade"
                  fadeEffect={{ crossFade: true }}
                  loop={bestPicks.length > 1}
                  speed={1200}
                  autoplay={
                    bestPicks.length > 1
                      ? { delay: 5000, disableOnInteraction: false }
                      : false
                  }
                  pagination={{ clickable: true }}
                  onSlideChange={(swiper) => setActiveBestIndex(swiper.realIndex)}
                  className="aspect-[3/4] sm:aspect-[4/5] lg:aspect-[5/6]"
                >
                  {bestPicks.map((image, index) => (
                    <SwiperSlide key={`best-${image.id}`}>
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxIndex(images.findIndex((img) => img.id === image.id))
                        }
                        className="relative block h-full w-full"
                      >
                        <Image
                          src={image.originalUrl}
                          alt={image.name}
                          fill
                          aria-hidden
                          className={`object-cover object-top blur-xl transition-transform duration-[5000ms] ${
                            activeBestIndex === index
                              ? "scale-[1.06]"
                              : "scale-100"
                          }`}
                          sizes="(max-width: 640px) 100vw, (max-width: 1200px) 90vw, 980px"
                          quality={50}
                        />
                        <div className="absolute inset-0 bg-black/45" />
                        <div className="absolute inset-0">
                          <Image
                            src={image.originalUrl}
                            alt={image.name}
                            fill
                            className="object-contain object-top"
                            sizes="(max-width: 640px) 100vw, (max-width: 1200px) 90vw, 980px"
                            quality={88}
                          />
                        </div>
                        <div className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] text-white">
                          BEST {index + 1}
                        </div>
                        <div className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] text-white">
                          ♥ {likesByPhoto[image.id] ?? 0}
                        </div>
                      </button>
                    </SwiperSlide>
                  ))}
                </Swiper>
              </div>
            </section>

            <div className="mb-8 md:hidden space-y-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedDateTag("all");
                  setSelectedLocationTag("all");
                  setSelectedMomentTag("all");
                  setSelectedWithTag("all");
                }}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 transition hover:bg-zinc-200"
              >
                전체 보기
              </button>

              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Date</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedDateTag("all")}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                      selectedDateTag === "all"
                        ? "bg-zinc-300 text-zinc-900"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    all
                  </button>
                  {dropdownTags.date.map((tag) => (
                    <button
                      key={`m-date-${tag}`}
                      type="button"
                      onClick={() => setSelectedDateTag(tag)}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                        selectedDateTag === tag
                          ? "bg-zinc-300 text-zinc-900"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">Location</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedLocationTag("all")}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                      selectedLocationTag === "all"
                        ? "bg-zinc-300 text-zinc-900"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    all
                  </button>
                  {dropdownTags.location.map((tag) => (
                    <button
                      key={`m-location-${tag}`}
                      type="button"
                      onClick={() => setSelectedLocationTag(tag)}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                        selectedLocationTag === tag
                          ? "bg-zinc-300 text-zinc-900"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 self-center">
                  Moment
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMomentTag("all")}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                    selectedMomentTag === "all"
                      ? "bg-zinc-300 text-zinc-900"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  all
                </button>
                {dropdownTags.moment.map((tag) => (
                  <button
                    key={`m-moment-${tag}`}
                    type="button"
                    onClick={() => setSelectedMomentTag(tag)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                      selectedMomentTag === tag
                        ? "bg-zinc-300 text-zinc-900"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 self-center">
                  With
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedWithTag("all")}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                    selectedWithTag === "all"
                      ? "bg-zinc-300 text-zinc-900"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  all
                </button>
                {dropdownTags.with.map((tag) => (
                  <button
                    key={`m-with-${tag}`}
                    type="button"
                    onClick={() => setSelectedWithTag(tag)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                      selectedWithTag === tag
                        ? "bg-zinc-300 text-zinc-900"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 self-center">
                  Sort
                </div>
                <button
                  type="button"
                  onClick={() => setSortOrder("latest")}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                    sortOrder === "latest"
                      ? "bg-zinc-300 text-zinc-900"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  최신순
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder("oldest")}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                    sortOrder === "oldest"
                      ? "bg-zinc-300 text-zinc-900"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  오래된 순
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder("popular")}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                    sortOrder === "popular"
                      ? "bg-zinc-300 text-zinc-900"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  인기순
                </button>
              </div>
            </div>

            <div className="mb-8 hidden md:flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDateTag("all");
                  setSelectedLocationTag("all");
                  setSelectedMomentTag("all");
                  setSelectedWithTag("all");
                }}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 transition hover:bg-zinc-200"
              >
                전체 보기
              </button>

              <select
                value={selectedDateTag}
                onChange={(event) => setSelectedDateTag(event.target.value)}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 outline-none ring-0"
              >
                <option value="all">Date</option>
                {dropdownTags.date.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>

              <select
                value={selectedLocationTag}
                onChange={(event) => setSelectedLocationTag(event.target.value)}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 outline-none ring-0"
              >
                <option value="all">Location</option>
                {dropdownTags.location.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>

              <select
                value={selectedMomentTag}
                onChange={(event) => setSelectedMomentTag(event.target.value)}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 outline-none ring-0"
              >
                <option value="all">Moment</option>
                {dropdownTags.moment.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>

              <select
                value={selectedWithTag}
                onChange={(event) => setSelectedWithTag(event.target.value)}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 outline-none ring-0"
              >
                <option value="all">With</option>
                {dropdownTags.with.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>

              <select
                value={sortOrder}
                onChange={(event) =>
                  setSortOrder(
                    event.target.value as "latest" | "oldest" | "popular"
                  )
                }
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 outline-none ring-0"
              >
                <option value="latest">최신순</option>
                <option value="oldest">오래된 순</option>
                <option value="popular">인기순</option>
              </select>
            </div>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {sortedFilteredImages.map((image) => (
              <article key={image.id} className="mb-2">
                <button
                  type="button"
                  onClick={() =>
                    setLightboxIndex(
                      sortedFilteredImages.findIndex((img) => img.id === image.id)
                    )
                  }
                  className={`relative block w-full overflow-hidden rounded-sm bg-zinc-100 ${
                    image.ratio === "portrait" ? "aspect-[2/3]" : "aspect-[3/2]"
                  }`}
                >
                  <Image
                    src={image.thumbnailUrl}
                    alt={image.name}
                    fill
                    className="object-contain"
                    sizes="(max-width: 640px) 92vw, (max-width: 768px) 48vw, (max-width: 1024px) 31vw, (max-width: 1280px) 24vw, 20vw"
                    quality={60}
                  />
                </button>

                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleLike(image.id)}
                    disabled={Boolean(likingByPhoto[image.id])}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ♥ {likesByPhoto[image.id] ?? 0}
                  </button>
                  <a
                    href={image.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 transition hover:bg-zinc-200"
                    aria-label={`Download ${image.name}`}
                  >
                    ↓ Download
                  </a>
                </div>

                {image.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {image.tags.map((tag) => (
                      <button
                        key={`${image.id}-${tag}`}
                        type="button"
                        onClick={() => {
                          if (image.dateTag === tag) setSelectedDateTag(tag);
                          if (image.locationTag === tag) setSelectedLocationTag(tag);
                          if (image.momentTag === tag) setSelectedMomentTag(tag);
                          if (image.withTag === tag) setSelectedWithTag(tag);
                        }}
                        className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] lowercase text-zinc-600 transition hover:bg-zinc-200"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
              ))}
            </section>
          </>
        ) : (
          <p className="text-sm text-zinc-500">
            No Google Drive images found. Check API key and folder ID in
            .env.local.
          </p>
        )}
      </main>

      <section
        ref={guestbookRef}
        className="mt-16 rounded-2xl border border-zinc-800/70 bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 sm:py-8"
      >
        <h3 className="text-lg font-medium tracking-wide">Message for Dain</h3>
        <p className="mt-2 text-sm text-zinc-400">
          다인이에게 이쁜 응원의 말을 남겨주세요.
        </p>

        <form onSubmit={handleGuestbookSubmit} className="mt-5 space-y-3">
          <input
            type="text"
            value={guestNickname}
            onChange={(event) => setGuestNickname(event.target.value)}
            placeholder="Nickname"
            maxLength={NICKNAME_MAX_LENGTH}
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-500"
          />
          <div className="-mt-1 text-right text-[11px] text-zinc-500">
            {guestNickname.length}/{NICKNAME_MAX_LENGTH}
          </div>
          <textarea
            value={guestContent}
            onChange={(event) => setGuestContent(event.target.value)}
            placeholder="Write your message..."
            maxLength={CONTENT_MAX_LENGTH}
            rows={4}
            className="min-h-28 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-500"
          />
          <div className="-mt-1 text-right text-[11px] text-zinc-500">
            {guestContent.length}/{CONTENT_MAX_LENGTH}
          </div>
          {guestbookError ? (
            <p className="text-xs text-rose-400">{guestbookError}</p>
          ) : null}
          <button
            type="submit"
            disabled={guestSubmitting}
            className="min-h-11 rounded-full bg-white/90 px-5 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guestSubmitting ? "Sending..." : "Send Message"}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          <AnimatePresence initial={false}>
            {guestbookEntries.map((entry) => (
              <motion.article
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-zinc-100">{entry.nickname}</p>
                  <p className="text-[11px] text-zinc-500">
                    {new Date(entry.created_at).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                  {entry.content}
                </p>
              </motion.article>
            ))}
          </AnimatePresence>
          {guestbookEntries.length === 0 ? (
            <p className="text-sm text-zinc-500">Be the first to leave a message.</p>
          ) : null}
        </div>
      </section>

      <footer className="mt-20 border-t border-zinc-200/80 py-6 text-center text-xs text-zinc-500">
        © 2025 VOTO. All rights reserved.
      </footer>

      <Lightbox
        open={lightboxIndex >= 0}
        close={() => setLightboxIndex(-1)}
        index={lightboxIndex}
        plugins={[Zoom]}
        zoom={{ maxZoomPixelRatio: 3, zoomInMultiplier: 2 }}
        slides={sortedFilteredImages.map((image) => ({
          src: image.originalUrl,
          alt: image.name,
          width: image.width,
          height: image.height,
          story: image.story,
          downloadUrl: image.downloadUrl,
        }))}
        styles={{
          container: { backgroundColor: "rgba(0, 0, 0, 0.92)" },
          button: { color: "#ffffff", filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.5))" },
        }}
        render={{
          slide: ({ slide }) => (
            <div className="relative h-full w-full">
              <Image
                src={slide.src}
                alt={slide.alt || "gallery image"}
                fill
                className="object-contain"
                sizes="100vw"
                quality={95}
                priority
              />
              <a
                href={(slide as { downloadUrl?: string }).downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white transition hover:bg-black/75"
              >
                ↓ Download
              </a>
              {(slide as { story?: string }).story ? (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-5 pb-6 pt-12 text-left text-zinc-100 sm:px-8">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-300">
                    Author&apos;s Note
                  </p>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-100/95 sm:text-[15px]">
                    {(slide as { story?: string }).story}
                  </p>
                </div>
              ) : null}
            </div>
          ),
        }}
      />

      <style jsx global>{`
        .swiper-pagination-bullet {
          width: 7px;
          height: 7px;
          background: rgba(255, 255, 255, 0.6);
          opacity: 1;
        }
        .swiper-pagination-bullet-active {
          background: #ffffff;
        }
      `}</style>

      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className={`fixed bottom-5 right-5 z-40 h-11 w-11 rounded-full border border-white/40 bg-white/70 text-lg text-zinc-800 shadow-md backdrop-blur-md transition-all duration-300 ${
          showTopButton
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        ↑
      </button>

      <button
        type="button"
        onClick={scrollToGuestbook}
        aria-label="응원메시지 남기기"
        className={`fixed bottom-5 left-5 z-40 min-h-11 rounded-full border border-white/35 bg-white/70 px-3 text-xs text-zinc-800 shadow-md backdrop-blur-md transition-all duration-300 ${
          showTopButton
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        응원메시지 남기기
      </button>
      </div>
    </>
  );
}
