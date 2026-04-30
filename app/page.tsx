"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
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
import { ChevronDown, Instagram, Link2, Share2, Twitter } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase-client";
import type { DriveImage } from "@/lib/drive-gallery-data";

/** 트윗 작성창에 넣을 갤러리 제목 */
const GALLERY_SHARE_TITLE = "voto gallery — Captured Moments of Kim Da-in";
const FILTER_PILL_BASE =
  "min-h-11 shrink-0 rounded-full border border-[#00287A] px-3.5 py-2 text-xs font-medium transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:opacity-90";
const FILTER_PILL_ACTIVE = "bg-[#00287A] text-white";
const FILTER_PILL_INACTIVE = "bg-white text-[#00287A]";
const FILTER_SECTION_LABEL =
  "text-[11px] font-semibold uppercase tracking-wider text-[#00287A]/80";
const FILTER_DROPDOWN_TRIGGER =
  "flex min-h-11 w-full items-center justify-between gap-2 rounded-full border border-[#00287A] px-3.5 py-2 text-xs font-medium transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:opacity-90";
const FILTER_DROPDOWN_TRIGGER_ACTIVE = "!bg-[#00287A] !text-white";
const FILTER_DROPDOWN_TRIGGER_INACTIVE = "!bg-white !text-[#00287A]";
const FILTER_DROPDOWN_MENU =
  "absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-72 overflow-auto rounded-2xl border border-[#00287A]/25 bg-white/90 p-2 shadow-[0_18px_38px_rgba(0,40,122,0.18)] backdrop-blur-[10px]";

declare global {
  interface Window {
    enableVotoAdminBypass?: () => void;
    disableVotoAdminBypass?: () => void;
    votoAdminBypassStatus?: () => boolean;
  }
}

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

type DropdownOption = {
  value: string;
  label: string;
  sortKey?: number;
};

type DropdownGroup = {
  label: string;
  options: DropdownOption[];
};

function getDateYearGroups(dateOptions: DropdownOption[]): DropdownGroup[] {
  const map = new Map<string, DropdownOption[]>();

  for (const option of dateOptions) {
    const year = option.label.slice(0, 4).match(/^\d{4}$/)
      ? option.label.slice(0, 4)
      : "기타";
    if (!map.has(year)) map.set(year, []);
    map.get(year)?.push(option);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === "기타") return 1;
      if (b === "기타") return -1;
      return b.localeCompare(a);
    })
    .map(([label, options]) => ({
      label,
      options: [...options].sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0)),
    }));
}

function FilterDropdown({
  label,
  selected,
  options,
  onSelect,
  groups,
  allLabel = "all",
  className = "",
}: {
  label: string;
  selected: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  groups?: DropdownGroup[];
  allLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selectedOption = options.find((option) => option.value === selected);
  const display = selected === "all" ? allLabel : selectedOption?.label ?? selected;
  const isAllSelected = selected === "all";

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`${FILTER_DROPDOWN_TRIGGER} ${
          isAllSelected
            ? FILTER_DROPDOWN_TRIGGER_INACTIVE
            : FILTER_DROPDOWN_TRIGGER_ACTIVE
        }`}
        aria-expanded={open}
      >
        <span className="truncate">
          <span
            className={`mr-1 text-[10px] uppercase ${
              isAllSelected ? "text-[#00287A]/75" : "text-white/75"
            }`}
          >
            {label}
          </span>
          <span className={isAllSelected ? "text-[#00287A]" : "text-white"}>
            {display}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key={`${label}-menu`}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className={FILTER_DROPDOWN_MENU}
          >
            <button
              type="button"
              onClick={() => {
                onSelect("all");
                setOpen(false);
              }}
              className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                selected === "all"
                  ? "bg-[#00287A] text-white"
                  : "text-[#00287A] hover:bg-[#00287A]/10"
              }`}
            >
              {allLabel}
            </button>

            {(groups && groups.length > 0
              ? groups.map((group) => (
                  <div key={`${label}-${group.label}`} className="mb-1">
                    <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[#00287A]/70">
                      {group.label}
                    </p>
                    {group.options.map((option) => (
                      <button
                        key={`${label}-${option.value}`}
                        type="button"
                        onClick={() => {
                          onSelect(option.value);
                          setOpen(false);
                        }}
                        className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          selected === option.value
                            ? "bg-[#00287A] text-white"
                            : "text-[#00287A] hover:bg-[#00287A]/10"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ))
              : [
                  <div key={`${label}-flat`}>
                    {options.map((option) => (
                      <button
                        key={`${label}-${option.value}`}
                        type="button"
                        onClick={() => {
                          onSelect(option.value);
                          setOpen(false);
                        }}
                        className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          selected === option.value
                            ? "bg-[#00287A] text-white"
                            : "text-[#00287A] hover:bg-[#00287A]/10"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>,
                ])}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const BANNED_WORDS = ["씨발", "병신", "개새끼", "지랄", "fuck", "shit", "bitch"];
const CONTENT_MAX_LENGTH = 180;
const NICKNAME_MAX_LENGTH = 24;

const GALLERY_PAGE_SIZE = 12;
const GRID_MIN_VISIBLE_COUNT = 20;

const THUMB_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTBlMGUwIi8+PC9zdmc+";

const THUMB_SIZES =
  "(max-width: 640px) 92vw, (max-width: 768px) 48vw, (max-width: 1024px) 31vw, (max-width: 1280px) 24vw, 20vw";

const THUMB_SIZES_COMPACT =
  "(max-width: 640px) 28vw, (max-width: 1024px) 16vw, 11vw";

const FEED_SCROLL_POLL_MS = 50;
const FEED_SCROLL_MAX_MS = 2000;

function scrollToPhoto(photoDriveId: string) {
  const el = document.getElementById(`photo-${photoDriveId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function GalleryFeedScrollOrchestrator({
  scrollSession,
  scrollTargetRef,
  onScrollPriorityClear,
}: {
  scrollSession: number;
  scrollTargetRef: MutableRefObject<string | null>;
  onScrollPriorityClear: () => void;
}) {
  const onClearRef = useRef(onScrollPriorityClear);
  onClearRef.current = onScrollPriorityClear;

  useEffect(() => {
    const rawId = scrollTargetRef.current;
    if (!rawId) return;

    let finished = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const htmlEl = document.documentElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = htmlEl.style.overflow;
    let elapsed = 0;
    let lockActive = false;

    const blockWheel: EventListener = (event) => {
      event.preventDefault();
    };

    const releaseScrollLock = () => {
      if (!lockActive) return;
      lockActive = false;
      document.body.style.overflow = previousBodyOverflow;
      htmlEl.style.overflow = previousHtmlOverflow;
      window.removeEventListener("wheel", blockWheel);
    };

    const applyScrollLock = () => {
      if (lockActive) return;
      lockActive = true;
      document.body.style.overflow = "hidden";
      htmlEl.style.overflow = "hidden";
      window.addEventListener("wheel", blockWheel, { passive: false });
    };

    const complete = () => {
      if (finished) return;
      finished = true;
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
      scrollTargetRef.current = null;
      onClearRef.current();
      releaseScrollLock();
    };

    applyScrollLock();

    const tryScrollToTarget = () => {
      if (finished) return true;
      const id = scrollTargetRef.current;
      if (!id) {
        complete();
        return true;
      }
      const el = document.getElementById(`photo-${id}`);
      if (el) {
        scrollToPhoto(id);
        complete();
        return true;
      }
      return false;
    };

    if (tryScrollToTarget()) {
      return () => {
        finished = true;
        if (intervalId !== undefined) clearInterval(intervalId);
        releaseScrollLock();
      };
    }

    intervalId = setInterval(() => {
      if (finished) return;
      if (tryScrollToTarget()) return;
      elapsed += FEED_SCROLL_POLL_MS;
      if (elapsed >= FEED_SCROLL_MAX_MS) {
        complete();
      }
    }, FEED_SCROLL_POLL_MS);

    return () => {
      finished = true;
      if (intervalId !== undefined) clearInterval(intervalId);
      releaseScrollLock();
    };
  }, [scrollSession, scrollTargetRef]);

  return null;
}

function GalleryThumbnail({
  image,
  sizes = THUMB_SIZES,
}: {
  image: DriveImage;
  sizes?: string;
}) {
  const [sharp, setSharp] = useState(false);
  return (
    <div className="relative size-full">
      <Image
        src={image.thumbnailUrl}
        alt={image.name}
        fill
        sizes={sizes}
        quality={60}
        placeholder="blur"
        blurDataURL={THUMB_BLUR_DATA_URL}
        className={`object-contain transition-[opacity,filter] duration-700 ease-out ${
          sharp ? "opacity-100 [filter:blur(0px)]" : "opacity-90 [filter:blur(14px)]"
        }`}
        onLoadingComplete={() => setSharp(true)}
      />
    </div>
  );
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
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([]);
  const [guestNickname, setGuestNickname] = useState("");
  const [guestContent, setGuestContent] = useState("");
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [guestbookError, setGuestbookError] = useState<string | null>(null);
  const likesRef = useRef<Record<string, number>>({});
  const lastLikeClickAtRef = useRef<Record<string, number>>({});
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const [heroScrollY, setHeroScrollY] = useState(0);
  const [heroVisible, setHeroVisible] = useState(false);
  const lastScrollYRef = useRef(0);
  const lastGuestSubmitRef = useRef<{ content: string; at: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState(GALLERY_PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const gridListRef = useRef<HTMLElement | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "feed">("feed");
  const [guestbookModalOpen, setGuestbookModalOpen] = useState(false);
  const feedScrollTargetIdRef = useRef<string | null>(null);
  const [feedScrollSession, setFeedScrollSession] = useState(0);
  const [feedScrollPriorityId, setFeedScrollPriorityId] = useState<string | null>(
    null
  );
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const shareToastTimerRef = useRef<number | null>(null);
  const shareWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await fetch("/api/drive-gallery");
        const payload = (await response.json()) as
          | DriveImage[]
          | { error?: string };

        if (!response.ok) {
          const message =
            typeof (payload as { error?: string }).error === "string"
              ? (payload as { error: string }).error
              : `Gallery request failed (${response.status})`;
          throw new Error(message);
        }

        const driveImages = payload as DriveImage[];
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
    if (typeof window === "undefined") return;

    const setAdminBypass = (enabled: boolean) => {
      if (enabled) {
        window.localStorage.setItem("is_admin", "true");
      } else {
        window.localStorage.removeItem("is_admin");
      }
    };

    window.enableVotoAdminBypass = () => setAdminBypass(true);
    window.disableVotoAdminBypass = () => setAdminBypass(false);
    window.votoAdminBypassStatus = () =>
      window.localStorage.getItem("is_admin") === "true";

    const isAdminBypass = window.localStorage.getItem("is_admin") === "true";
    if (isAdminBypass) {
      return () => {
        delete window.enableVotoAdminBypass;
        delete window.disableVotoAdminBypass;
        delete window.votoAdminBypassStatus;
      };
    }

    const storageKey = "voto_visitor_session_id";
    let sessionId = window.localStorage.getItem(storageKey);
    if (!sessionId) {
      sessionId = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      window.localStorage.setItem(storageKey, sessionId);
    }

    void fetch("/api/visitors/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      keepalive: true,
    }).catch(() => {
      // Swallow tracking errors; this should never block rendering.
    });

    return () => {
      delete window.enableVotoAdminBypass;
      delete window.disableVotoAdminBypass;
      delete window.votoAdminBypassStatus;
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
    if (!isSupabaseConfigured) return;

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
    if (!isSupabaseConfigured) return;

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

    if (!isSupabaseConfigured) {
      setGuestbookError("게스트북을 사용하려면 Supabase 환경 변수를 설정해 주세요.");
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
    if (!isSupabaseConfigured || likingByPhoto[photoId]) return;

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
        new Map(
          images
            .map((image) => ({
              value: image.folderName,
              label: image.scheduleDisplay || image.folderName,
              sortKey: image.scheduleDateKey || image.folderSortKey || 0,
            }))
            .filter((item) => Boolean(item.value))
            .map((item) => [item.value, item] as const)
        ).values()
      ).sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0)),
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
  const dateYearGroups = useMemo(
    () => getDateYearGroups(dropdownTags.date),
    [dropdownTags.date]
  );

  const filteredImages = useMemo(
    () =>
      images.filter((image) => {
        if (selectedDateTag !== "all" && image.folderName !== selectedDateTag) {
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

  const filteredTotal = sortedFilteredImages.length;

  const visibleGalleryImages = useMemo(
    () => sortedFilteredImages.slice(0, visibleCount),
    [sortedFilteredImages, visibleCount]
  );

  const fetchNextPage = useCallback(() => {
    setVisibleCount((previous) =>
      Math.min(previous + GALLERY_PAGE_SIZE, filteredTotal)
    );
  }, [filteredTotal]);

  useEffect(() => {
    setVisibleCount(GALLERY_PAGE_SIZE);
  }, [
    selectedDateTag,
    selectedLocationTag,
    selectedMomentTag,
    selectedWithTag,
    sortOrder,
    images.length,
  ]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || visibleCount >= filteredTotal) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.unobserve(node);
        fetchNextPage();
      },
      { root: null, rootMargin: "320px 0px", threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visibleCount, filteredTotal, viewMode, fetchNextPage]);

  useEffect(() => {
    if (viewMode !== "grid") return;
    if (visibleCount >= filteredTotal) return;

    const measureAndLoad = () => {
      const minRequired = Math.min(GRID_MIN_VISIBLE_COUNT, filteredTotal);
      const needsMinBatch = visibleCount < minRequired;
      const gridHeight = gridListRef.current?.getBoundingClientRect().height ?? 0;
      const needsMoreByHeight =
        gridHeight > 0 && gridHeight < window.innerHeight;

      if (needsMinBatch || needsMoreByHeight) {
        fetchNextPage();
      }
    };

    const rafId = window.requestAnimationFrame(measureAndLoad);
    return () => window.cancelAnimationFrame(rafId);
  }, [viewMode, visibleCount, filteredTotal, fetchNextPage]);

  const handleGridThumbNavigate = (photoId: string) => {
    const idx = sortedFilteredImages.findIndex((img) => img.id === photoId);
    if (idx < 0) return;
    feedScrollTargetIdRef.current = photoId;
    setFeedScrollPriorityId(photoId);
    setFeedScrollSession((n) => n + 1);
    setVisibleCount((c) => Math.max(c, idx + 1));
    setViewMode("feed");
  };

  useEffect(() => {
    if (viewMode === "grid") {
      setFeedScrollPriorityId(null);
    }
  }, [viewMode]);

  useEffect(() => {
    if (!guestbookModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setGuestbookModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [guestbookModalOpen]);

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

  const showShareToast = (message: string) => {
    if (shareToastTimerRef.current) {
      clearTimeout(shareToastTimerRef.current);
    }
    setShareToast(message);
    shareToastTimerRef.current = window.setTimeout(() => {
      setShareToast(null);
      shareToastTimerRef.current = null;
    }, 3800);
  };

  const copyCurrentPageUrl = async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      return true;
    } catch {
      return false;
    }
  };

  const handleCopyPageLink = async () => {
    const ok = await copyCurrentPageUrl();
    if (ok) {
      showShareToast("주소가 복사되었습니다. 원하는 곳에 붙여넣으세요!");
      setShareMenuOpen(false);
    } else {
      window.prompt("주소를 복사해 주세요:", window.location.href);
    }
  };

  const handleTwitterShare = () => {
    const href = window.location.href;
    const draft = `${GALLERY_SHARE_TITLE}\n\n${href}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(draft)}`,
      "_blank",
      "noopener,noreferrer"
    );
    setShareMenuOpen(false);
  };

  const handleInstagramShare = async () => {
    const ok = await copyCurrentPageUrl();
    if (ok) {
      showShareToast(
        "링크를 복사했습니다. 인스타 스토리나 프로필에 공유해 보세요!"
      );
    } else {
      window.prompt("주소를 복사해 주세요:", window.location.href);
    }
    setShareMenuOpen(false);
  };

  useEffect(() => {
    if (!shareMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShareMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shareMenuOpen]);

  useEffect(() => {
    return () => {
      if (shareToastTimerRef.current) {
        clearTimeout(shareToastTimerRef.current);
      }
    };
  }, []);

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
              className="min-h-11 shrink-0 rounded-full border border-[#00287A] bg-white px-3.5 text-xs font-medium text-[#00287A] transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:opacity-90"
            >
              전체
            </button>
            <select
              value={selectedDateTag}
              onChange={(event) => setSelectedDateTag(event.target.value)}
              className="min-h-11 shrink-0 rounded-full border border-[#00287A] bg-white px-3.5 text-xs font-medium text-[#00287A] outline-none transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:opacity-90"
            >
              <option value="all">Date</option>
              {dropdownTags.date.map((option) => (
                <option key={`sticky-date-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={selectedLocationTag}
              onChange={(event) => setSelectedLocationTag(event.target.value)}
              className="min-h-11 shrink-0 rounded-full border border-[#00287A] bg-white px-3.5 text-xs font-medium text-[#00287A] outline-none transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:opacity-90"
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
              className="min-h-11 shrink-0 rounded-full border border-[#00287A] bg-white px-3.5 text-xs font-medium text-[#00287A] outline-none transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:opacity-90"
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
              className="min-h-11 shrink-0 rounded-full border border-[#00287A] bg-white px-3.5 text-xs font-medium text-[#00287A] outline-none transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:opacity-90"
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
              className="min-h-11 shrink-0 rounded-full border border-[#00287A] bg-white px-3.5 text-xs font-medium text-[#00287A] outline-none transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:opacity-90"
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
                className={`${FILTER_PILL_BASE} ${FILTER_PILL_INACTIVE}`}
              >
                전체 보기
              </button>

              <FilterDropdown
                label="DATE"
                selected={selectedDateTag}
                options={dropdownTags.date}
                groups={dateYearGroups}
                onSelect={setSelectedDateTag}
                allLabel="all"
                className="w-full"
              />

              <FilterDropdown
                label="LOCATION"
                selected={selectedLocationTag}
                options={dropdownTags.location.map((tag) => ({
                  value: tag,
                  label: tag,
                }))}
                onSelect={setSelectedLocationTag}
                allLabel="all"
                className="w-full"
              />

              <FilterDropdown
                label="WITH"
                selected={selectedWithTag}
                options={dropdownTags.with.map((tag) => ({
                  value: tag,
                  label: tag,
                }))}
                onSelect={setSelectedWithTag}
                allLabel="all"
                className="w-full"
              />

              <div className="flex gap-2 overflow-x-auto pb-1">
                <div className={`${FILTER_SECTION_LABEL} self-center`}>
                  Moment
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMomentTag("all")}
                  className={`${FILTER_PILL_BASE} ${
                    selectedMomentTag === "all"
                      ? FILTER_PILL_ACTIVE
                      : FILTER_PILL_INACTIVE
                  }`}
                >
                  all
                </button>
                {dropdownTags.moment.map((tag) => (
                  <button
                    key={`m-moment-${tag}`}
                    type="button"
                    onClick={() => setSelectedMomentTag(tag)}
                    className={`${FILTER_PILL_BASE} ${
                      selectedMomentTag === tag
                        ? FILTER_PILL_ACTIVE
                        : FILTER_PILL_INACTIVE
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                <div className={`${FILTER_SECTION_LABEL} self-center`}>
                  Sort
                </div>
                <button
                  type="button"
                  onClick={() => setSortOrder("latest")}
                  className={`${FILTER_PILL_BASE} ${
                    sortOrder === "latest"
                      ? FILTER_PILL_ACTIVE
                      : FILTER_PILL_INACTIVE
                  }`}
                >
                  최신순
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder("oldest")}
                  className={`${FILTER_PILL_BASE} ${
                    sortOrder === "oldest"
                      ? FILTER_PILL_ACTIVE
                      : FILTER_PILL_INACTIVE
                  }`}
                >
                  오래된 순
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder("popular")}
                  className={`${FILTER_PILL_BASE} ${
                    sortOrder === "popular"
                      ? FILTER_PILL_ACTIVE
                      : FILTER_PILL_INACTIVE
                  }`}
                >
                  인기순
                </button>
              </div>
            </div>

            <div className="mb-8 hidden md:block space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDateTag("all");
                    setSelectedLocationTag("all");
                    setSelectedMomentTag("all");
                    setSelectedWithTag("all");
                  }}
                  className={`${FILTER_PILL_BASE} ${FILTER_PILL_INACTIVE}`}
                >
                  전체 보기
                </button>
                <FilterDropdown
                  label="DATE"
                  selected={selectedDateTag}
                  options={dropdownTags.date}
                  groups={dateYearGroups}
                  onSelect={setSelectedDateTag}
                  allLabel="all"
                  className="w-[22rem]"
                />
                <FilterDropdown
                  label="LOCATION"
                  selected={selectedLocationTag}
                  options={dropdownTags.location.map((tag) => ({
                    value: tag,
                    label: tag,
                  }))}
                  onSelect={setSelectedLocationTag}
                  allLabel="all"
                  className="w-[13rem]"
                />
                <FilterDropdown
                  label="WITH"
                  selected={selectedWithTag}
                  options={dropdownTags.with.map((tag) => ({
                    value: tag,
                    label: tag,
                  }))}
                  onSelect={setSelectedWithTag}
                  allLabel="all"
                  className="w-[12rem]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className={FILTER_SECTION_LABEL}>Moment</span>
                <button
                  type="button"
                  onClick={() => setSelectedMomentTag("all")}
                  className={`${FILTER_PILL_BASE} ${
                    selectedMomentTag === "all"
                      ? FILTER_PILL_ACTIVE
                      : FILTER_PILL_INACTIVE
                  }`}
                >
                  all
                </button>
                {dropdownTags.moment.map((tag) => (
                  <button
                    key={`d-moment-${tag}`}
                    type="button"
                    onClick={() => setSelectedMomentTag(tag)}
                    className={`${FILTER_PILL_BASE} ${
                      selectedMomentTag === tag
                        ? FILTER_PILL_ACTIVE
                        : FILTER_PILL_INACTIVE
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className={FILTER_SECTION_LABEL}>Sort</span>
                <button
                  type="button"
                  onClick={() => setSortOrder("latest")}
                  className={`${FILTER_PILL_BASE} ${
                    sortOrder === "latest"
                      ? FILTER_PILL_ACTIVE
                      : FILTER_PILL_INACTIVE
                  }`}
                >
                  최신순
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder("oldest")}
                  className={`${FILTER_PILL_BASE} ${
                    sortOrder === "oldest"
                      ? FILTER_PILL_ACTIVE
                      : FILTER_PILL_INACTIVE
                  }`}
                >
                  오래된 순
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder("popular")}
                  className={`${FILTER_PILL_BASE} ${
                    sortOrder === "popular"
                      ? FILTER_PILL_ACTIVE
                      : FILTER_PILL_INACTIVE
                  }`}
                >
                  인기순
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {viewMode === "grid" ? (
                <motion.section
                  key="gallery-grid"
                  ref={gridListRef}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                  className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
                >
                  {visibleGalleryImages.map((image) => (
                    <article
                      key={image.id}
                      id={`photo-${image.id}`}
                      className="mb-0"
                    >
                      <button
                        type="button"
                        onClick={() => handleGridThumbNavigate(image.id)}
                        className={`relative block w-full overflow-hidden rounded-sm bg-zinc-100 ${
                          image.ratio === "portrait"
                            ? "aspect-[3/4]"
                            : "aspect-[4/3]"
                        }`}
                      >
                        <GalleryThumbnail
                          image={image}
                          sizes={THUMB_SIZES_COMPACT}
                        />
                        <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1 py-0.5 text-[9px] font-medium text-white tabular-nums">
                          ♥{likesByPhoto[image.id] ?? 0}
                        </span>
                      </button>
                    </article>
                  ))}
                  {visibleCount < filteredTotal ? (
                    <div
                      ref={loadMoreRef}
                      className="col-span-full min-h-12 shrink-0"
                      aria-hidden
                    />
                  ) : null}
                </motion.section>
              ) : (
                <motion.section
                  key="gallery-feed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                  className="flex flex-col gap-14 sm:gap-16"
                >
                  <GalleryFeedScrollOrchestrator
                    scrollSession={feedScrollSession}
                    scrollTargetRef={feedScrollTargetIdRef}
                    onScrollPriorityClear={() => setFeedScrollPriorityId(null)}
                  />
                  {visibleGalleryImages.map((image) => (
                    <article
                      key={image.id}
                      id={`photo-${image.id}`}
                      className="scroll-mt-28"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxIndex(
                            sortedFilteredImages.findIndex(
                              (img) => img.id === image.id
                            )
                          )
                        }
                        className="relative mx-auto block w-full max-w-4xl overflow-hidden rounded-lg bg-zinc-100"
                        style={{
                          aspectRatio: `${image.width} / ${image.height}`,
                        }}
                      >
                        <Image
                          src={image.originalUrl}
                          alt={image.name}
                          fill
                          className="object-contain"
                          sizes="(max-width: 1024px) 92vw, 896px"
                          quality={88}
                          priority={image.id === feedScrollPriorityId}
                          placeholder="blur"
                          blurDataURL={THUMB_BLUR_DATA_URL}
                        />
                      </button>

                      <div className="mx-auto mt-3 flex max-w-4xl items-center justify-between px-1">
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
                        <div className="mx-auto mt-2 flex max-w-4xl flex-wrap gap-2 px-1">
                          {image.tags.map((tag) => (
                            <button
                              key={`${image.id}-${tag}`}
                              type="button"
                              onClick={() => {
                                if (image.dateTag === tag) {
                                  setSelectedDateTag(image.folderName);
                                }
                                if (image.locationTag === tag)
                                  setSelectedLocationTag(tag);
                                if (image.momentTag === tag) setSelectedMomentTag(tag);
                                if (image.withTag === tag) setSelectedWithTag(tag);
                              }}
                              className={`${FILTER_PILL_BASE} ${
                                selectedLocationTag === tag ||
                                selectedMomentTag === tag ||
                                selectedWithTag === tag
                                  ? FILTER_PILL_ACTIVE
                                  : FILTER_PILL_INACTIVE
                              } lowercase text-[11px]`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                  {visibleCount < filteredTotal ? (
                    <div
                      ref={loadMoreRef}
                      className="min-h-12 w-full shrink-0"
                      aria-hidden
                    />
                  ) : null}
                </motion.section>
              )}
            </AnimatePresence>
          </>
        ) : (
          <p className="text-sm text-zinc-500">
            No Google Drive images found. Check API key and folder ID in
            .env.local.
          </p>
        )}
      </main>

      <footer className="mt-20 border-t border-zinc-200/80 py-6 text-center text-xs text-zinc-500">
        © 2025 VOTO. All rights reserved.
      </footer>

      <AnimatePresence>
        {guestbookModalOpen ? (
          <motion.div
            key="guestbook-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <button
              type="button"
              aria-label="모달 닫기"
              className="absolute inset-0 bg-zinc-950/55 backdrop-blur-md"
              onClick={() => setGuestbookModalOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="guestbook-modal-title"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex max-h-[min(85dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950 text-zinc-100 shadow-2xl"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-5 py-4">
                <h3
                  id="guestbook-modal-title"
                  className="text-lg font-medium tracking-wide"
                >
                  Message for Dain
                </h3>
                <button
                  type="button"
                  onClick={() => setGuestbookModalOpen(false)}
                  aria-label="닫기"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <span className="text-xl leading-none" aria-hidden>
                    ×
                  </span>
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <p className="text-sm text-zinc-400">
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
                          <p className="text-sm font-medium text-zinc-100">
                            {entry.nickname}
                          </p>
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
                    <p className="text-sm text-zinc-500">
                      Be the first to leave a message.
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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

      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white/70 text-lg text-zinc-800 shadow-md backdrop-blur-md transition hover:bg-white/85"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => setViewMode((m) => (m === "feed" ? "grid" : "feed"))}
          aria-label={
            viewMode === "feed" ? "모아 보기로 전환" : "크게 보기로 전환"
          }
          className="flex min-h-11 min-w-[4.75rem] flex-col items-center justify-center rounded-full border border-white/40 bg-white/70 px-2.5 py-1 text-[10px] font-semibold leading-tight text-zinc-800 shadow-md backdrop-blur-md transition hover:bg-white/85"
        >
          {viewMode === "feed" ? (
            <>
              <span>모아보기</span>
              <span className="text-[9px] font-normal text-zinc-500">Grid</span>
            </>
          ) : (
            <>
              <span>크게보기</span>
              <span className="text-[9px] font-normal text-zinc-500">Feed</span>
            </>
          )}
        </button>
      </div>

      <div className="fixed bottom-5 left-5 z-40 flex flex-col items-start gap-2">
        <div ref={shareWrapRef} className="relative flex flex-col items-start">
          <AnimatePresence>
            {shareMenuOpen ? (
              <motion.div
                key="share-submenu"
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.96 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-full left-0 mb-2 flex w-[15.5rem] flex-col gap-1 rounded-2xl border border-white/40 bg-white/55 p-2 shadow-lg backdrop-blur-md"
                role="menu"
                aria-label="공유 메뉴"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleTwitterShare}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-zinc-800 transition hover:bg-white/60"
                >
                  <Twitter className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  트위터 / X
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleCopyPageLink()}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-zinc-800 transition hover:bg-white/60"
                >
                  <Link2 className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  링크 복사
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleInstagramShare()}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-zinc-800 transition hover:bg-white/60"
                >
                  <Instagram
                    className="h-[18px] w-[18px] shrink-0"
                    aria-hidden
                  />
                  인스타그램
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setShareMenuOpen((open) => !open)}
            aria-expanded={shareMenuOpen}
            aria-haspopup="menu"
            aria-label="공유하기"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white/55 text-zinc-800 shadow-md backdrop-blur-md transition hover:bg-white/75"
          >
            <Share2 className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setGuestbookModalOpen(true)}
          aria-label="응원메시지 남기기"
          className="min-h-11 rounded-full border border-white/35 bg-white/70 px-3 text-xs text-zinc-800 shadow-md backdrop-blur-md transition hover:bg-white/85"
        >
          응원메시지 남기기
        </button>
      </div>

      <AnimatePresence>
        {shareToast ? (
          <motion.div
            key={shareToast}
            role="status"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-[5.75rem] left-5 z-[60] max-w-[min(calc(100vw-2.5rem),22rem)] rounded-2xl border border-white/45 bg-zinc-950/82 px-4 py-3.5 text-left text-[13px] font-medium leading-snug text-white shadow-xl backdrop-blur-md sm:bottom-24"
          >
            {shareToast}
          </motion.div>
        ) : null}
      </AnimatePresence>
      </div>
    </>
  );
}
