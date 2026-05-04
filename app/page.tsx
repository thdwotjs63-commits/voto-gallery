"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/pagination";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Heart,
  Instagram,
  LayoutGrid,
  Link2,
  Share2,
  StretchHorizontal,
  Twitter,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { GalleryChangelog } from "@/components/gallery-changelog";
import {
  PhotoGridThumbnail,
  PHOTO_GRID_THUMB_SIZES_COMPACT,
} from "@/components/photo-grid";
import { PhotoDetailModal } from "@/components/photo-detail-modal";
import { isSupabaseConfigured, supabase } from "@/lib/supabase-client";
import { driveLh3FullDisplayUrl, type DriveImage } from "@/lib/drive-gallery-data";
import { fetchPhotoLikeCounts, normalizePhotoLikeId } from "@/lib/photo-likes";
import { trackGaEvent } from "@/lib/analytics";
import {
  buildPhotoDetailPageUrl,
  buildPhotoShareClipboardText,
} from "@/lib/photo-share";

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
  "max-h-[min(18rem,calc(100dvh-24px))] overflow-auto rounded-2xl border border-[#00287A]/25 bg-white/95 p-2 shadow-[0_18px_38px_rgba(0,40,122,0.18)] backdrop-blur-[10px]";

declare global {
  interface Window {
    enableVotoAdminBypass?: () => void;
    disableVotoAdminBypass?: () => void;
    votoAdminBypassStatus?: () => boolean;
  }
}

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

function matchesImageSelections(
  image: DriveImage,
  selections: {
    date: string;
    location: string;
    moment: string;
    with: string;
  },
  ignore?: {
    date?: boolean;
    location?: boolean;
    moment?: boolean;
    with?: boolean;
  }
) {
  if (
    !ignore?.date &&
    selections.date !== "all" &&
    image.folderName !== selections.date
  ) {
    return false;
  }
  if (
    !ignore?.location &&
    selections.location !== "all" &&
    image.locationTag !== selections.location
  ) {
    return false;
  }
  if (
    !ignore?.moment &&
    selections.moment !== "all" &&
    image.momentTag !== selections.moment
  ) {
    return false;
  }
  if (!ignore?.with && selections.with !== "all" && image.withTag !== selections.with) {
    return false;
  }
  return true;
}

function FilterDropdown({
  label,
  selected,
  options,
  onSelect,
  groups,
  allLabel = "all",
  className = "",
  showOptionCounts = false,
  showZeroOptionCounts = false,
  optionCounts,
}: {
  label: string;
  selected: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  groups?: DropdownGroup[];
  allLabel?: string;
  className?: string;
  showOptionCounts?: boolean;
  showZeroOptionCounts?: boolean;
  optionCounts?: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuPortalRef = useRef<HTMLDivElement | null>(null);
  const [menuBox, setMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const maxHeight = Math.max(
      160,
      Math.min(window.innerHeight - rect.bottom - margin * 2, 18 * 16)
    );
    setMenuBox({
      top: rect.bottom + margin,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuBox(null);
      return undefined;
    }
    updateMenuPosition();
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuPortalRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const selectedOption = options.find((option) => option.value === selected);
  const display = selected === "all" ? allLabel : selectedOption?.label ?? selected;
  const isAllSelected = selected === "all";

  const countFor = (value: string) =>
    showOptionCounts && optionCounts ? (optionCounts[value] ?? 0) : null;

  const menuContent =
    open && menuBox ? (
      <motion.div
        ref={menuPortalRef}
        key={`${label}-menu-portal`}
        role="listbox"
        aria-label={`${label} options`}
        initial={{ opacity: 0, y: 6, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16, ease: "easeInOut" }}
        className={`${FILTER_DROPDOWN_MENU} fixed z-[200]`}
        style={{
          top: menuBox.top,
          left: menuBox.left,
          width: menuBox.width,
          maxHeight: menuBox.maxHeight,
        }}
      >
        <button
          type="button"
          onClick={() => {
            onSelect("all");
            setOpen(false);
          }}
          className={`mb-1 flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition ${
            selected === "all"
              ? "bg-[#00287A] text-white"
              : "text-[#00287A] hover:bg-[#00287A]/10"
          }`}
        >
          <span className="min-w-0 flex-1 truncate">{allLabel}</span>
        </button>

        {groups && groups.length > 0
          ? groups.map((group) => (
              <div key={`${label}-${group.label}`} className="mb-1">
                <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[#00287A]/70">
                  {group.label}
                </p>
                {group.options.map((option) => {
                  const n = countFor(option.value);
                  return (
                    <button
                      key={`${label}-${option.value}`}
                      type="button"
                      onClick={() => {
                        onSelect(option.value);
                        setOpen(false);
                      }}
                      className={`mb-1 flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-sm transition ${
                        selected === option.value
                          ? "bg-[#00287A] text-white"
                          : "text-[#00287A] hover:bg-[#00287A]/10"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {n !== null && (showZeroOptionCounts || n > 0) ? (
                        <span
                          className={`shrink-0 pl-2 text-right text-[11px] tabular-nums ${
                            selected === option.value ? "text-white/70" : "text-zinc-400"
                          }`}
                        >
                          ({n})
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          : options.map((option) => {
              const n = countFor(option.value);
              return (
                <button
                  key={`${label}-${option.value}`}
                  type="button"
                  onClick={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className={`mb-1 flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-sm transition ${
                    selected === option.value
                      ? "bg-[#00287A] text-white"
                      : "text-[#00287A] hover:bg-[#00287A]/10"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {n !== null && (showZeroOptionCounts || n > 0) ? (
                    <span
                      className={`shrink-0 pl-2 text-right text-[11px] tabular-nums ${
                        selected === option.value ? "text-white/70" : "text-zinc-400"
                      }`}
                    >
                      ({n})
                    </span>
                  ) : null}
                </button>
              );
            })}
      </motion.div>
    ) : null;

  return (
    <div ref={wrapRef} className={`relative z-[60] ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onTouchStart={(e) => {
          e.stopPropagation();
        }}
        className={`${FILTER_DROPDOWN_TRIGGER} touch-manipulation ${
          isAllSelected
            ? FILTER_DROPDOWN_TRIGGER_INACTIVE
            : FILTER_DROPDOWN_TRIGGER_ACTIVE
        }`}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1 truncate text-left">
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
          className={`pointer-events-none h-4 w-4 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {typeof document !== "undefined" && open && menuBox
        ? createPortal(menuContent, document.body)
        : null}
    </div>
  );
}

const BANNED_WORDS = ["씨발", "병신", "개새끼", "지랄", "fuck", "shit", "bitch"];
const CONTENT_MAX_LENGTH = 180;
const NICKNAME_MAX_LENGTH = 24;

const GALLERY_PAGE_SIZE = 12;
const GRID_INITIAL_LOAD = 50;
const GRID_PAGE_SIZE = 24;
const GRID_MIN_VISIBLE_COUNT = 20;

const THUMB_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTBlMGUwIi8+PC9zdmc+";

/** 피드 전용: Vercel 최적화 없이(lh3, unoptimized) 그리드 썸네일보다 큰 미리보기. */
function feedListImageUrl(image: DriveImage): string {
  return `https://lh3.googleusercontent.com/d/${image.id}=w1400`;
}

const FEED_SCROLL_POLL_MS = 50;
const FEED_SCROLL_MAX_MS = 2000;
const QUERY_DATE = "date";
const QUERY_PLACE = "place";
const QUERY_MOMENT = "moment";
const QUERY_WITH = "with";
const QUERY_SORT = "sort";
const QUERY_PHOTO = "photo";
const QUERY_VIEW = "view";
const SCROLL_RESTORE_PHOTO_KEY = "voto_restore_photo_id";
const SCROLL_RESTORE_Y_KEY = "voto_restore_scroll_y";
const SCROLL_RESTORE_VIEW_KEY = "voto_restore_view_mode";
const SCROLL_RESTORE_GRID_VISIBLE_KEY = "voto_restore_grid_visible";
const SCROLL_RESTORE_LIGHTBOX_PHOTO_KEY = "voto_restore_lightbox_photo_id";

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

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const [images, setImages] = useState<DriveImage[]>([]);
  const [likesByPhoto, setLikesByPhoto] = useState<Record<string, number>>({});
  const [likingByPhoto, setLikingByPhoto] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [photoDetailModalImage, setPhotoDetailModalImage] = useState<DriveImage | null>(
    null
  );
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
  const sortAnchorMobileRef = useRef<HTMLDivElement | null>(null);
  const sortAnchorDesktopRef = useRef<HTMLDivElement | null>(null);
  const [heroScrollY, setHeroScrollY] = useState(0);
  const [heroVisible, setHeroVisible] = useState(false);
  const lastScrollYRef = useRef(0);
  const lastGuestSubmitRef = useRef<{ content: string; at: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState(GALLERY_PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const gridListRef = useRef<HTMLElement | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "feed">("grid");
  const viewModeRef = useRef(viewMode);
  const visibleCountRef = useRef(visibleCount);
  const [guestbookModalOpen, setGuestbookModalOpen] = useState(false);
  const feedScrollTargetIdRef = useRef<string | null>(null);
  const [feedScrollSession, setFeedScrollSession] = useState(0);
  const [feedScrollPriorityId, setFeedScrollPriorityId] = useState<string | null>(
    null
  );
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [quizBubbleOpen, setQuizBubbleOpen] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [urlQueryString, setUrlQueryString] = useState("");
  const shareToastTimerRef = useRef<number | null>(null);
  const shareWrapRef = useRef<HTMLDivElement | null>(null);
  const quizWrapRef = useRef<HTMLDivElement | null>(null);
  const photoParamHandledRef = useRef<string | null>(null);
  const didHydrateFiltersFromUrlRef = useRef(false);
  const didRestoreScrollFromSessionRef = useRef(false);
  const skipNextUrlHydrationRef = useRef(false);
  const lastDateLocationSelectionRef = useRef<{ date: string; location: string } | null>(null);
  const lightboxIndexRef = useRef(lightboxIndex);
  const lightboxOpenPhotoIdRef = useRef<string | null>(null);
  const sortedFilteredImagesRef = useRef<DriveImage[]>([]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    lightboxIndexRef.current = lightboxIndex;
  }, [lightboxIndex]);

  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

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
    try {
      window.sessionStorage.removeItem(SCROLL_RESTORE_LIGHTBOX_PHOTO_KEY);
    } catch {
      // ignore
    }
    setLightboxIndex(-1);
    setPhotoDetailModalImage(null);
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
    if (typeof window === "undefined") return;
    const syncFromLocation = () => {
      setUrlQueryString(window.location.search);
    };
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  const parsedUrlParams = useMemo(
    () => new URLSearchParams(urlQueryString.replace(/^\?/, "")),
    [urlQueryString]
  );
  const urlDate = (parsedUrlParams.get(QUERY_DATE) ?? "all").trim() || "all";
  const urlPlace =
    (parsedUrlParams.get(QUERY_PLACE) ?? parsedUrlParams.get("location") ?? "all").trim() ||
    "all";
  const urlMoment = (parsedUrlParams.get(QUERY_MOMENT) ?? "all").trim() || "all";
  const urlWith = (parsedUrlParams.get(QUERY_WITH) ?? "all").trim() || "all";
  const rawUrlSort = (parsedUrlParams.get(QUERY_SORT) ?? "latest").trim();
  const urlSort: "latest" | "oldest" | "popular" =
    rawUrlSort === "oldest" || rawUrlSort === "popular" ? rawUrlSort : "latest";
  const rawUrlView = (parsedUrlParams.get(QUERY_VIEW) ?? "").trim().toLowerCase();
  const urlViewMode: "grid" | "feed" = rawUrlView === "feed" ? "feed" : "grid";

  useEffect(() => {
    if (skipNextUrlHydrationRef.current) {
      skipNextUrlHydrationRef.current = false;
      return;
    }
    setSelectedDateTag((prev) => (prev === urlDate ? prev : urlDate));
    setSelectedLocationTag((prev) => (prev === urlPlace ? prev : urlPlace));
    setSelectedMomentTag((prev) => (prev === urlMoment ? prev : urlMoment));
    setSelectedWithTag((prev) => (prev === urlWith ? prev : urlWith));
    setSortOrder((prev) => (prev === urlSort ? prev : urlSort));
    setViewMode((prev) => (prev === urlViewMode ? prev : urlViewMode));
    didHydrateFiltersFromUrlRef.current = true;
  }, [urlDate, urlMoment, urlPlace, urlSort, urlViewMode, urlWith]);

  const galleryPhotoIdsKey = useMemo(
    () =>
      [...new Set(images.map((image) => normalizePhotoLikeId(image.id)).filter(Boolean))]
        .sort()
        .join("|"),
    [images]
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const photoIds = galleryPhotoIdsKey ? galleryPhotoIdsKey.split("|") : [];
    if (photoIds.length === 0) return;

    let mounted = true;

    const loadLikes = async () => {
      const counts = await fetchPhotoLikeCounts(supabase, photoIds);
      if (!mounted) return;
      setLikesByPhoto(() => {
        const next: Record<string, number> = {};
        for (const id of photoIds) {
          next[id] = counts[id] ?? 0;
        }
        return next;
      });
    };

    void loadLikes();

    return () => {
      mounted = false;
    };
  }, [galleryPhotoIdsKey, isSupabaseConfigured]);

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
    const driveFileId = normalizePhotoLikeId(photoId);
    if (!driveFileId || !isSupabaseConfigured || likingByPhoto[driveFileId]) return;

    const now = Date.now();
    const lastClick = lastLikeClickAtRef.current[driveFileId] ?? 0;
    if (now - lastClick < 700) return;
    lastLikeClickAtRef.current[driveFileId] = now;

    const previousCount = likesRef.current[driveFileId] ?? 0;
    setLikingByPhoto((prev) => ({ ...prev, [driveFileId]: true }));
    setLikesByPhoto((prev) => ({ ...prev, [driveFileId]: previousCount + 1 }));

    try {
      const { error: insertError } = await supabase
        .from("photo_likes")
        .insert({ photo_id: driveFileId });

      if (insertError) {
        throw insertError;
      }
    } catch (likeError) {
      console.error("Failed to update like:", likeError);
      setLikesByPhoto((prev) => ({ ...prev, [driveFileId]: previousCount }));
    } finally {
      setLikingByPhoto((prev) => ({ ...prev, [driveFileId]: false }));
    }
  };

  const filterSelections = useMemo(
    () => ({
      date: selectedDateTag,
      location: selectedLocationTag,
      moment: selectedMomentTag,
      with: selectedWithTag,
    }),
    [selectedDateTag, selectedLocationTag, selectedMomentTag, selectedWithTag]
  );

  const filtersActive =
    selectedDateTag !== "all" ||
    selectedLocationTag !== "all" ||
    selectedMomentTag !== "all" ||
    selectedWithTag !== "all";

  const dropdownTags = useMemo(() => {
    const dateCandidates = images.filter((image) =>
      matchesImageSelections(image, filterSelections, { date: true })
    );
    const locationCandidates = images.filter((image) =>
      matchesImageSelections(image, filterSelections, { location: true })
    );
    const momentCandidates = images.filter((image) =>
      matchesImageSelections(image, filterSelections, { moment: true })
    );
    const withCandidates = images.filter((image) =>
      matchesImageSelections(image, filterSelections, { with: true })
    );

    return {
      date: Array.from(
        new Map(
          dateCandidates
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
          locationCandidates
            .map((image) => image.locationTag)
            .filter((tag): tag is string => Boolean(tag))
        )
      ).sort((a, b) => a.localeCompare(b)),
      moment: Array.from(
        new Set(
          momentCandidates
            .map((image) => image.momentTag)
            .filter((tag): tag is string => Boolean(tag))
        )
      ).sort((a, b) => a.localeCompare(b)),
      with: Array.from(
        new Set(
          withCandidates
            .map((image) => image.withTag)
            .filter((tag): tag is string => Boolean(tag))
        )
      ).sort((a, b) => a.localeCompare(b)),
    };
  }, [images, filterSelections]);

  const dropdownOptionCounts = useMemo(() => {
    if (!filtersActive) return null;

    const dateCount: Record<string, number> = {};
    for (const image of images) {
      if (!matchesImageSelections(image, filterSelections, { date: true })) continue;
      if (!image.folderName) continue;
      dateCount[image.folderName] = (dateCount[image.folderName] ?? 0) + 1;
    }

    const locationCount: Record<string, number> = {};
    for (const image of images) {
      if (!matchesImageSelections(image, filterSelections, { location: true })) continue;
      const tag = image.locationTag;
      if (!tag) continue;
      locationCount[tag] = (locationCount[tag] ?? 0) + 1;
    }

    const momentCount: Record<string, number> = {};
    for (const image of images) {
      if (!matchesImageSelections(image, filterSelections, { moment: true })) continue;
      const tag = image.momentTag;
      if (!tag) continue;
      momentCount[tag] = (momentCount[tag] ?? 0) + 1;
    }

    const withCount: Record<string, number> = {};
    for (const image of images) {
      if (!matchesImageSelections(image, filterSelections, { with: true })) continue;
      const tag = image.withTag;
      if (!tag) continue;
      withCount[tag] = (withCount[tag] ?? 0) + 1;
    }

    return { date: dateCount, location: locationCount, moment: momentCount, with: withCount };
  }, [images, filterSelections, filtersActive]);

  const dateYearGroups = useMemo(
    () => getDateYearGroups(dropdownTags.date),
    [dropdownTags.date]
  );

  useEffect(() => {
    if (loading) return;
    if (images.length === 0) return;
    if (
      selectedDateTag !== "all" &&
      !dropdownTags.date.some((option) => option.value === selectedDateTag)
    ) {
      setSelectedDateTag("all");
    }
    if (
      selectedLocationTag !== "all" &&
      !dropdownTags.location.includes(selectedLocationTag)
    ) {
      setSelectedLocationTag("all");
    }
    if (selectedMomentTag !== "all" && !dropdownTags.moment.includes(selectedMomentTag)) {
      setSelectedMomentTag("all");
    }
    if (selectedWithTag !== "all" && !dropdownTags.with.includes(selectedWithTag)) {
      setSelectedWithTag("all");
    }
  }, [
    dropdownTags.date,
    dropdownTags.location,
    dropdownTags.moment,
    dropdownTags.with,
    selectedDateTag,
    selectedLocationTag,
    selectedMomentTag,
    selectedWithTag,
    loading,
    images.length,
  ]);

  const filteredImages = useMemo(
    () => images.filter((image) => matchesImageSelections(image, filterSelections)),
    [images, filterSelections]
  );

  const sortedFilteredImages = useMemo(
    () =>
      [...filteredImages].sort((a, b) => {
        if (sortOrder === "popular") {
          const likeDiff =
            (likesByPhoto[b.id] ?? 0) - (likesByPhoto[a.id] ?? 0);
          if (likeDiff !== 0) return likeDiff;
          if (b.folderSortKey !== a.folderSortKey) {
            return b.folderSortKey - a.folderSortKey;
          }
          return a.id.localeCompare(b.id);
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

  useEffect(() => {
    sortedFilteredImagesRef.current = sortedFilteredImages;
  }, [sortedFilteredImages]);

  useEffect(() => {
    lightboxOpenPhotoIdRef.current =
      lightboxIndex >= 0 ? sortedFilteredImages[lightboxIndex]?.id ?? null : null;
  }, [lightboxIndex, sortedFilteredImages]);

  const clearLightboxRestoreKey = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(SCROLL_RESTORE_LIGHTBOX_PHOTO_KEY);
    } catch {
      // ignore quota / private mode
    }
  }, []);

  const closeGalleryLightbox = useCallback(() => {
    clearLightboxRestoreKey();
    setLightboxIndex(-1);
  }, [clearLightboxRestoreKey]);

  const consumeLightboxRestoreFromSession = useCallback(() => {
    if (typeof window === "undefined") return false;
    if (lightboxIndexRef.current >= 0) return false;
    const params = new URLSearchParams(urlQueryString.replace(/^\?/, ""));
    if (params.get(QUERY_PHOTO)) return false;
    const id = window.sessionStorage.getItem(SCROLL_RESTORE_LIGHTBOX_PHOTO_KEY)?.trim();
    if (!id) return false;
    window.sessionStorage.removeItem(SCROLL_RESTORE_LIGHTBOX_PHOTO_KEY);
    const idx = sortedFilteredImagesRef.current.findIndex((img) => img.id === id);
    if (idx < 0) return false;
    setLightboxIndex(idx);
    return true;
  }, [urlQueryString]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(SCROLL_RESTORE_VIEW_KEY, viewMode);
    } catch {
      // ignore quota / private mode
    }
  }, [viewMode]);

  useEffect(() => {
    const persistLightboxWhenLeaving = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState !== "hidden") return;
      if (lightboxIndexRef.current < 0) return;
      const id = lightboxOpenPhotoIdRef.current;
      if (!id) return;
      try {
        window.sessionStorage.setItem(SCROLL_RESTORE_LIGHTBOX_PHOTO_KEY, id);
      } catch {
        // ignore
      }
    };
    document.addEventListener("visibilitychange", persistLightboxWhenLeaving);
    window.addEventListener("pagehide", persistLightboxWhenLeaving);
    return () => {
      document.removeEventListener("visibilitychange", persistLightboxWhenLeaving);
      window.removeEventListener("pagehide", persistLightboxWhenLeaving);
    };
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void consumeLightboxRestoreFromSession();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [consumeLightboxRestoreFromSession]);

  useEffect(() => {
    if (loading) return;
    if (sortedFilteredImages.length === 0) return;
    void consumeLightboxRestoreFromSession();
  }, [loading, sortedFilteredImages, consumeLightboxRestoreFromSession]);

  useEffect(() => {
    if (!didHydrateFiltersFromUrlRef.current) return;

    const params = new URLSearchParams(urlQueryString.replace(/^\?/, ""));
    const setOrDelete = (key: string, value: string, fallback: string) => {
      if (!value || value === fallback) {
        params.delete(key);
        return;
      }
      params.set(key, value);
    };

    setOrDelete(QUERY_DATE, selectedDateTag, "all");
    setOrDelete(QUERY_PLACE, selectedLocationTag, "all");
    setOrDelete(QUERY_MOMENT, selectedMomentTag, "all");
    setOrDelete(QUERY_WITH, selectedWithTag, "all");
    setOrDelete(QUERY_SORT, sortOrder, "latest");
    setOrDelete(QUERY_VIEW, viewMode, "grid");
    params.delete("location");

    const nextQuery = params.toString();
    const currentQuery = urlQueryString.replace(/^\?/, "");
    if (nextQuery === currentQuery) return;

    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    skipNextUrlHydrationRef.current = true;
    window.history.pushState(null, "", nextUrl);
    setUrlQueryString(nextQuery ? `?${nextQuery}` : "");
  }, [
    pathname,
    selectedDateTag,
    selectedLocationTag,
    selectedMomentTag,
    selectedWithTag,
    sortOrder,
    urlQueryString,
    viewMode,
  ]);

  const visibleGalleryImages = useMemo(
    () => sortedFilteredImages.slice(0, visibleCount),
    [sortedFilteredImages, visibleCount]
  );

  useEffect(() => {
    const previous = lastDateLocationSelectionRef.current;
    lastDateLocationSelectionRef.current = {
      date: selectedDateTag,
      location: selectedLocationTag,
    };
    if (!previous) return;

    const justResetToAll =
      selectedDateTag === "all" &&
      selectedLocationTag === "all" &&
      (previous.date !== "all" || previous.location !== "all");
    if (!justResetToAll) return;
    if (sortedFilteredImages.length === 0) return;

    setVisibleCount((count) => Math.max(count, 1));
    const firstPhotoId = sortedFilteredImages[0]?.id;
    if (!firstPhotoId) return;

    window.requestAnimationFrame(() => {
      scrollToPhoto(firstPhotoId);
    });
  }, [selectedDateTag, selectedLocationTag, sortedFilteredImages]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const persistScrollState = () => {
      const nodes = document.querySelectorAll<HTMLElement>('[id^="photo-"]');
      const topCandidate = Array.from(nodes).find((node) => node.getBoundingClientRect().bottom > 120);
      const photoId = topCandidate?.id.replace("photo-", "");
      if (photoId) {
        window.sessionStorage.setItem(SCROLL_RESTORE_PHOTO_KEY, photoId);
      }
      window.sessionStorage.setItem(SCROLL_RESTORE_Y_KEY, String(window.scrollY));
      window.sessionStorage.setItem(SCROLL_RESTORE_VIEW_KEY, viewModeRef.current);
      if (viewModeRef.current === "grid") {
        window.sessionStorage.setItem(
          SCROLL_RESTORE_GRID_VISIBLE_KEY,
          String(visibleCountRef.current)
        );
      }
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        persistScrollState();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", persistScrollState);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", persistScrollState);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (viewMode !== "grid") return;
    const initial = Math.min(GRID_INITIAL_LOAD, filteredTotal || GRID_INITIAL_LOAD);
    setVisibleCount(initial);
  }, [
    selectedDateTag,
    selectedLocationTag,
    selectedMomentTag,
    selectedWithTag,
    sortOrder,
    images.length,
    filteredTotal,
    viewMode,
  ]);

  useEffect(() => {
    if (didRestoreScrollFromSessionRef.current) return;
    if (loading) return;
    if (sortedFilteredImages.length === 0) return;
    const params = new URLSearchParams(urlQueryString.replace(/^\?/, ""));
    if (params.get(QUERY_PHOTO)) return;
    if (typeof window === "undefined") return;

    const urlSaysGrid = params.get(QUERY_VIEW)?.toLowerCase() === "grid";
    const sessionView = window.sessionStorage.getItem(SCROLL_RESTORE_VIEW_KEY);
    const restoreAsGrid =
      urlSaysGrid || (sessionView === "grid" && params.get(QUERY_VIEW) == null);

    const savedY = Number(window.sessionStorage.getItem(SCROLL_RESTORE_Y_KEY) ?? "");

    if (restoreAsGrid) {
      didRestoreScrollFromSessionRef.current = true;
      setViewMode((prev) => (prev === "grid" ? prev : "grid"));
      const savedVisibleRaw = window.sessionStorage.getItem(SCROLL_RESTORE_GRID_VISIBLE_KEY);
      const savedVisible = Number.parseInt(savedVisibleRaw ?? "", 10);
      const cap = sortedFilteredImages.length;
      if (Number.isFinite(savedVisible) && savedVisible > 0) {
        setVisibleCount((c) => Math.max(c, Math.min(savedVisible, cap)));
      } else {
        setVisibleCount((c) => Math.max(c, Math.min(GRID_INITIAL_LOAD, cap)));
      }
      if (Number.isFinite(savedY) && savedY > 0) {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: savedY, behavior: "auto" });
        });
      }
      return;
    }

    const savedPhotoId = window.sessionStorage.getItem(SCROLL_RESTORE_PHOTO_KEY)?.trim();
    if (savedPhotoId) {
      const idx = sortedFilteredImages.findIndex((img) => img.id === savedPhotoId);
      if (idx >= 0) {
        didRestoreScrollFromSessionRef.current = true;
        setViewMode("feed");
        setVisibleCount((c) => Math.max(c, idx + 1));
        feedScrollTargetIdRef.current = savedPhotoId;
        setFeedScrollPriorityId(savedPhotoId);
        setFeedScrollSession((n) => n + 1);
        return;
      }
    }

    if (Number.isFinite(savedY) && savedY > 0) {
      didRestoreScrollFromSessionRef.current = true;
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: savedY, behavior: "auto" });
      });
    }
  }, [loading, sortedFilteredImages, urlQueryString]);

  const fetchNextPage = useCallback(() => {
    const pageSize = viewMode === "grid" ? GRID_PAGE_SIZE : GALLERY_PAGE_SIZE;
    setVisibleCount((previous) =>
      Math.min(previous + pageSize, filteredTotal)
    );
  }, [filteredTotal, viewMode]);

  // 그리드는 위 이펙트 + 스크롤 복원이 담당. 피드일 때만 초기 개수를 맞춘다(viewMode로 한 프레임 URL 지연도 처리).
  useEffect(() => {
    if (viewMode === "grid" || urlViewMode === "grid") return;
    const initial = GALLERY_PAGE_SIZE;
    setVisibleCount(Math.min(initial, filteredTotal || initial));
  }, [
    selectedDateTag,
    selectedLocationTag,
    selectedMomentTag,
    selectedWithTag,
    sortOrder,
    images.length,
    filteredTotal,
    urlViewMode,
    viewMode,
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
      { root: null, rootMargin: "1200px 0px", threshold: 0 }
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

  useEffect(() => {
    if (viewMode !== "grid") return;
    if (visibleCount >= filteredTotal) return;

    const maybeLoadByScroll = () => {
      if (visibleCount >= filteredTotal) return;
      const scrollBottom = window.scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      if (docHeight - scrollBottom < 1200) {
        fetchNextPage();
      }
    };

    window.addEventListener("scroll", maybeLoadByScroll, { passive: true });
    window.addEventListener("resize", maybeLoadByScroll);
    maybeLoadByScroll();

    return () => {
      window.removeEventListener("scroll", maybeLoadByScroll);
      window.removeEventListener("resize", maybeLoadByScroll);
    };
  }, [viewMode, visibleCount, filteredTotal, fetchNextPage]);

  const handleViewModeToggle = () => {
    const desktopAnchor = sortAnchorDesktopRef.current;
    const mobileAnchor = sortAnchorMobileRef.current;
    const anchor =
      desktopAnchor && desktopAnchor.offsetParent !== null ? desktopAnchor : mobileAnchor;
    anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
    setViewMode((prev) => {
      const next = prev === "feed" ? "grid" : "feed";
      if (next === "grid") {
        setVisibleCount(Math.min(GRID_INITIAL_LOAD, filteredTotal || GRID_INITIAL_LOAD));
      } else {
        setVisibleCount(Math.min(GALLERY_PAGE_SIZE, filteredTotal || GALLERY_PAGE_SIZE));
      }
      return next;
    });
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

  const bestPicks = useMemo(() => {
    const byLikes = (a: DriveImage, b: DriveImage) => {
      const likeDiff = (likesByPhoto[b.id] ?? 0) - (likesByPhoto[a.id] ?? 0);
      if (likeDiff !== 0) return likeDiff;
      return a.id.localeCompare(b.id);
    };
    return [...images].sort(byLikes).slice(0, 3);
  }, [images, likesByPhoto]);

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

  const showShareToast = useCallback((message: string) => {
    if (shareToastTimerRef.current) {
      clearTimeout(shareToastTimerRef.current);
    }
    setShareToast(message);
    shareToastTimerRef.current = window.setTimeout(() => {
      setShareToast(null);
      shareToastTimerRef.current = null;
    }, 3800);
  }, []);

  const closePhotoDetailModal = useCallback(() => {
    setPhotoDetailModalImage(null);
    const params = new URLSearchParams(urlQueryString);
    params.delete(QUERY_PHOTO);
    const nextQuery = params.toString();
    skipNextUrlHydrationRef.current = true;
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    setUrlQueryString(nextQuery ? `?${nextQuery}` : "");
  }, [pathname, router, urlQueryString]);

  useEffect(() => {
    const params = new URLSearchParams(urlQueryString);
    const raw = params.get(QUERY_PHOTO);
    const photoId = raw?.trim() ?? "";
    if (!photoId) {
      photoParamHandledRef.current = null;
      return;
    }
    if (loading) return;
    if (images.length === 0) return;

    const found = images.find((img) => img.id === photoId);
    if (!found) {
      if (photoParamHandledRef.current !== `missing:${photoId}`) {
        photoParamHandledRef.current = `missing:${photoId}`;
        showShareToast("링크의 사진을 찾을 수 없습니다.");
        const nextParams = new URLSearchParams(urlQueryString);
        nextParams.delete(QUERY_PHOTO);
        const nextQuery = nextParams.toString();
        skipNextUrlHydrationRef.current = true;
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
        setUrlQueryString(nextQuery ? `?${nextQuery}` : "");
      }
      return;
    }

    const openKey = `open:${photoId}`;
    if (photoParamHandledRef.current === openKey) return;
    photoParamHandledRef.current = openKey;
    try {
      window.sessionStorage.removeItem(SCROLL_RESTORE_LIGHTBOX_PHOTO_KEY);
    } catch {
      // ignore
    }
    setLightboxIndex(-1);
    setPhotoDetailModalImage(found);
  }, [images, loading, pathname, router, showShareToast, urlQueryString]);

  const copyPhotoShareLink = useCallback(
    async (photoId: string) => {
      const url = buildPhotoDetailPageUrl(photoId);
      const text = buildPhotoShareClipboardText(photoId);

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          // title/text 없이 url만 전달 — 카카오톡 등에서 링크·본문이 두 말풍선으로 쪼개지는 현상 완화
          await navigator.share({ url });
          showShareToast("해당 사진의 공유 링크가 준비되었습니다.");
          return true;
        } catch (err) {
          const name = err instanceof Error ? err.name : "";
          if (name === "AbortError") {
            return false;
          }
        }
      }

      try {
        await navigator.clipboard.writeText(text);
        showShareToast("해당 사진의 공유 링크가 복사되었습니다.");
        return true;
      } catch {
        window.prompt("링크를 복사해 주세요:", url);
        return false;
      }
    },
    [showShareToast]
  );

  const handleFeedShareDelegation = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const el = (event.target as HTMLElement).closest("[data-photo-share]");
      if (!el) return;
      const id = el.getAttribute("data-photo-share");
      if (!id) return;
      event.preventDefault();
      event.stopPropagation();
      void copyPhotoShareLink(id);
    },
    [copyPhotoShareLink]
  );

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

  const applyTagToggle = (
    tag: string,
    type: "date" | "location" | "moment" | "with"
  ) => {
    if (type === "date") {
      setSelectedDateTag((prev) => (prev === tag ? "all" : tag));
      return;
    }
    if (type === "location") {
      setSelectedLocationTag((prev) => (prev === tag ? "all" : tag));
      return;
    }
    if (type === "moment") {
      setSelectedMomentTag((prev) => (prev === tag ? "all" : tag));
      return;
    }
    setSelectedWithTag((prev) => (prev === tag ? "all" : tag));
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
    if (!quizBubbleOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setQuizBubbleOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [quizBubbleOpen]);

  useEffect(() => {
    if (!quizBubbleOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (quizWrapRef.current?.contains(target)) return;
      setQuizBubbleOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [quizBubbleOpen]);

  useEffect(() => {
    return () => {
      if (shareToastTimerRef.current) {
        clearTimeout(shareToastTimerRef.current);
      }
    };
  }, []);

  const dateDropdownCountProps =
    filtersActive && dropdownOptionCounts
      ? { showOptionCounts: true as const, optionCounts: dropdownOptionCounts.date }
      : { showOptionCounts: false as const };

  const locationDropdownCountProps =
    filtersActive && dropdownOptionCounts
      ? { showOptionCounts: true as const, optionCounts: dropdownOptionCounts.location }
      : { showOptionCounts: false as const };

  const withDropdownCountProps =
    filtersActive && dropdownOptionCounts
      ? { showOptionCounts: true as const, optionCounts: dropdownOptionCounts.with }
      : { showOptionCounts: false as const };

  const momentDropdownCountProps =
    filtersActive && dropdownOptionCounts
      ? { showOptionCounts: true as const, optionCounts: dropdownOptionCounts.moment }
      : { showOptionCounts: false as const };

  const mobileDateDropdownCountProps = dropdownOptionCounts
    ? {
        showOptionCounts: true as const,
        showZeroOptionCounts: true as const,
        optionCounts: dropdownOptionCounts.date,
      }
    : { showOptionCounts: false as const };

  const mobileLocationDropdownCountProps = dropdownOptionCounts
    ? {
        showOptionCounts: true as const,
        showZeroOptionCounts: true as const,
        optionCounts: dropdownOptionCounts.location,
      }
    : { showOptionCounts: false as const };

  const mobileWithDropdownCountProps = dropdownOptionCounts
    ? {
        showOptionCounts: true as const,
        showZeroOptionCounts: true as const,
        optionCounts: dropdownOptionCounts.with,
      }
    : { showOptionCounts: false as const };

  const mobileMomentDropdownCountProps = dropdownOptionCounts
    ? {
        showOptionCounts: true as const,
        showZeroOptionCounts: true as const,
        optionCounts: dropdownOptionCounts.moment,
      }
    : { showOptionCounts: false as const };

  return (
    <>
      <div
        className={`fixed left-0 right-0 top-0 z-[55] transition-transform duration-300 ${
          showStickyHeader ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto mt-2 w-[calc(100%-16px)] max-w-[1280px] rounded-xl border border-white/35 bg-white/65 px-3 py-2 backdrop-blur-md sm:mt-3 sm:w-[calc(100%-24px)] sm:px-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium lowercase tracking-[0.04em] text-zinc-900">
              voto gallery
            </span>
            <Link
              href="/voto"
              className="inline-flex min-h-8 items-center rounded-full border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-zinc-700"
            >
              Voto Photo 바로가기 📸
            </Link>
            <span className="text-[10px] text-zinc-500 sm:text-xs">
              © 2025 VOTO. All rights reserved.
            </span>
          </div>
          <div className="space-y-2 pb-1">
            <div className="md:hidden touch-pan-x overflow-x-auto whitespace-nowrap hide-scrollbar">
              <div className="relative z-[1] inline-flex items-center gap-2 pr-1">
                <FilterDropdown
                  label="DATE"
                  selected={selectedDateTag}
                  options={dropdownTags.date}
                  groups={dateYearGroups}
                  onSelect={setSelectedDateTag}
                  allLabel="all"
                  className="w-[17.5rem] shrink-0"
                  {...mobileDateDropdownCountProps}
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
                  className="w-[11.5rem] shrink-0"
                  {...mobileLocationDropdownCountProps}
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
                  className="w-[10.5rem] shrink-0"
                  {...mobileWithDropdownCountProps}
                />
                <FilterDropdown
                  label="MOMENT"
                  selected={selectedMomentTag}
                  options={dropdownTags.moment.map((tag) => ({
                    value: tag,
                    label: tag,
                  }))}
                  onSelect={setSelectedMomentTag}
                  allLabel="all"
                  className="w-[11rem] shrink-0"
                  {...mobileMomentDropdownCountProps}
                />
                <FilterDropdown
                  label="SORT"
                  selected={sortOrder}
                  options={[
                    { value: "latest", label: "최신순" },
                    { value: "oldest", label: "오래된 순" },
                    { value: "popular", label: "인기순" },
                  ]}
                  onSelect={(value) =>
                    setSortOrder(value as "latest" | "oldest" | "popular")
                  }
                  allLabel="기본"
                  className="w-[10rem] shrink-0"
                />
              </div>
            </div>

            <div className="hidden md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.25fr)_minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,1fr)] md:gap-2">
              <FilterDropdown
                label="DATE"
                selected={selectedDateTag}
                options={dropdownTags.date}
                groups={dateYearGroups}
                onSelect={setSelectedDateTag}
                allLabel="all"
                className="w-full"
                {...mobileDateDropdownCountProps}
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
                {...mobileLocationDropdownCountProps}
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
                {...mobileWithDropdownCountProps}
              />
              <FilterDropdown
                label="MOMENT"
                selected={selectedMomentTag}
                options={dropdownTags.moment.map((tag) => ({
                  value: tag,
                  label: tag,
                }))}
                onSelect={setSelectedMomentTag}
                allLabel="all"
                className="w-full"
                {...momentDropdownCountProps}
              />
              <FilterDropdown
                label="SORT"
                selected={sortOrder}
                options={[
                  { value: "latest", label: "최신순" },
                  { value: "oldest", label: "오래된 순" },
                  { value: "popular", label: "인기순" },
                ]}
                onSelect={(value) =>
                  setSortOrder(value as "latest" | "oldest" | "popular")
                }
                allLabel="기본"
                className="w-full"
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setGuestbookModalOpen(true)}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#b18f00] bg-[#FFD200] px-3 py-2 text-[12px] font-bold text-black shadow-[0_6px_12px_rgba(0,0,0,0.16)] transition duration-150 active:scale-95"
              >
                <Heart className="h-4 w-4" aria-hidden />
                Cheers
              </button>
              <button
                type="button"
                onClick={handleViewModeToggle}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#b18f00] bg-[#FFD200] px-3 py-2 text-[12px] font-bold text-black shadow-[0_6px_12px_rgba(0,0,0,0.16)] transition duration-150 active:scale-95"
              >
                {viewMode === "feed" ? (
                  <>
                    <LayoutGrid className="h-4 w-4" aria-hidden />
                    Grid
                  </>
                ) : (
                  <>
                    <StretchHorizontal className="h-4 w-4" aria-hidden />
                    Feed
                  </>
                )}
              </button>
            </div>
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
              src={driveLh3FullDisplayUrl(heroImage.id)}
              alt={heroImage.name}
              fill
              priority
              unoptimized
              className="object-cover object-[center_28%] sm:object-center"
              sizes="100vw"
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
          <p className="mt-1 text-[15px] font-bold tracking-[0.18em] text-zinc-100 sm:text-[19px]">
            No.3 Kim Dain <span aria-hidden>🇰🇷</span>
          </p>
          <p className="mt-1 text-[11px] tracking-[0.2em] text-zinc-200 sm:text-xs">
            Hyundai Hillstate Volleyball Team
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
            <Link
              href="/voto"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/25 bg-zinc-800 px-3 py-2 text-[12px] font-bold text-white shadow-[0_8px_16px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-zinc-700 active:scale-95"
            >
              Voto Photo 바로가기 📸
            </Link>
            <a
              href="https://www.instagram.com/voto_v3?igsh=NDZrcGhndXQybzNm&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/35 bg-white/10 px-3 py-2 text-[12px] font-semibold text-white/90 shadow-[0_8px_16px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-white/20 hover:text-white active:scale-95"
              aria-label="Instagram 바로가기"
            >
              <Instagram className="h-4.5 w-4.5" aria-hidden />
              <span>voto</span>
            </a>
            <button
              type="button"
              onClick={() => void handleCopyPageLink()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-white/10 text-white/90 shadow-[0_8px_16px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-white/20 hover:text-white active:scale-95"
              aria-label="공유 링크 복사"
            >
              <Share2 className="h-4.5 w-4.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setGuestbookModalOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/35 bg-white/10 px-3 py-2 text-[12px] font-semibold text-white shadow-[0_8px_16px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:bg-white/20 active:scale-95"
            >
              <Heart className="h-4 w-4" aria-hidden />
              응원메시지 남기기
            </button>
          </div>

          <p className="mt-6 text-[11px] tracking-[0.2em] text-zinc-300 sm:text-xs">
            Photography by Voto.
          </p>

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
      <header className="mb-16 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6">
          <div className="shrink-0 text-base font-medium lowercase tracking-[0.04em] sm:text-lg">
            voto gallery
          </div>
          <Link
            href="/voto"
            className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-700"
          >
            Voto Photo 바로가기 📸
          </Link>
          <GalleryChangelog />
        </div>
        <div aria-hidden className="hidden h-6 w-16 shrink-0 sm:block" />
      </header>

      <main>
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
                          src={driveLh3FullDisplayUrl(image.id)}
                          alt={image.name}
                          fill
                          aria-hidden
                          unoptimized
                          className={`object-cover object-top blur-xl transition-transform duration-[5000ms] ${
                            activeBestIndex === index
                              ? "scale-[1.06]"
                              : "scale-100"
                          }`}
                          sizes="(max-width: 640px) 100vw, (max-width: 1200px) 90vw, 980px"
                        />
                        <div className="absolute inset-0 bg-black/45" />
                        <div className="absolute inset-0">
                          <Image
                            src={driveLh3FullDisplayUrl(image.id)}
                            alt={image.name}
                            fill
                            unoptimized
                            className="object-contain object-top"
                            sizes="(max-width: 640px) 100vw, (max-width: 1200px) 90vw, 980px"
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
                {...dateDropdownCountProps}
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
                {...locationDropdownCountProps}
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
                {...withDropdownCountProps}
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

              <div ref={sortAnchorMobileRef} className="flex gap-2 overflow-x-auto pb-1">
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
                  {...dateDropdownCountProps}
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
                  {...locationDropdownCountProps}
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
                  {...withDropdownCountProps}
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

              <div ref={sortAnchorDesktopRef} className="flex flex-wrap items-center gap-2.5">
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
                        onClick={() => {
                          const idx = sortedFilteredImages.findIndex(
                            (img) => img.id === image.id
                          );
                          if (idx >= 0) setLightboxIndex(idx);
                        }}
                        className={`relative block w-full overflow-hidden rounded-sm bg-zinc-100 ${
                          image.ratio === "portrait"
                            ? "aspect-[3/4]"
                            : "aspect-[4/3]"
                        }`}
                      >
                        <PhotoGridThumbnail
                          image={image}
                          sizes={PHOTO_GRID_THUMB_SIZES_COMPACT}
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
                  onClick={handleFeedShareDelegation}
                >
                  <GalleryFeedScrollOrchestrator
                    scrollSession={feedScrollSession}
                    scrollTargetRef={feedScrollTargetIdRef}
                    onScrollPriorityClear={() => setFeedScrollPriorityId(null)}
                  />
                  <p className="mx-auto mb-6 max-w-4xl rounded-xl border border-[#00287A]/15 bg-[#00287A]/[0.04] px-3 py-2 text-center text-[11px] leading-snug text-[#00287A]/80">
                    피드 모드: 더 큰 해상도(1400px)로 미리보기합니다. 모바일 데이터 사용량이 늘 수 있어요.
                  </p>
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
                          src={feedListImageUrl(image)}
                          alt={image.name}
                          fill
                          unoptimized
                          className="object-contain"
                          sizes="(max-width: 1024px) 92vw, 896px"
                          quality={82}
                          priority={image.id === feedScrollPriorityId}
                          placeholder="blur"
                          blurDataURL={THUMB_BLUR_DATA_URL}
                        />
                      </button>

                      <div className="mx-auto mt-3 flex max-w-4xl items-center justify-between gap-2 px-1">
                        <button
                          type="button"
                          onClick={() => handleLike(image.id)}
                          disabled={Boolean(likingByPhoto[image.id])}
                          className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          ♥ {likesByPhoto[image.id] ?? 0}
                        </button>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <a
                            href={image.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 transition hover:bg-zinc-200"
                            aria-label={`Download ${image.name}`}
                            onClick={() =>
                              trackGaEvent("photo_download", {
                                location: "feed",
                                photo_id: image.id,
                              })
                            }
                          >
                            ↓ Download
                          </a>
                          <button
                            type="button"
                            data-photo-share={image.id}
                            className="inline-flex min-h-9 min-w-9 touch-manipulation items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200"
                            aria-label="이 사진 공유 링크 복사"
                          >
                            <Share2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </div>

                      {image.tags.length > 0 ? (
                        <div className="mx-auto mt-2 flex max-w-4xl flex-wrap gap-2 px-1">
                          {image.tags.map((tag) => (
                            <button
                              key={`${image.id}-${tag}`}
                              type="button"
                              onClick={() => {
                                if (image.dateTag === tag) {
                                  applyTagToggle(image.folderName, "date");
                                }
                                if (image.locationTag === tag) {
                                  applyTagToggle(tag, "location");
                                }
                                if (image.momentTag === tag) {
                                  applyTagToggle(tag, "moment");
                                }
                                if (image.withTag === tag) {
                                  applyTagToggle(tag, "with");
                                }
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
        Photography by Voto.
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

      {photoDetailModalImage ? (
        <PhotoDetailModal image={photoDetailModalImage} onClose={closePhotoDetailModal} />
      ) : null}

      <Lightbox
        open={lightboxIndex >= 0 && !photoDetailModalImage}
        close={closeGalleryLightbox}
        index={lightboxIndex}
        on={{
          view: ({ index }) => setLightboxIndex(index),
        }}
        plugins={[Zoom]}
        zoom={{ maxZoomPixelRatio: 3, zoomInMultiplier: 2 }}
        slides={sortedFilteredImages.map((image) => ({
          src: driveLh3FullDisplayUrl(image.id),
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
          slide: ({ slide }) => {
            const currentImage = sortedFilteredImages[lightboxIndex];
            return (
              <div className="relative h-full w-full">
                <Image
                  src={slide.src}
                  alt={slide.alt || "gallery image"}
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) min(92vw, 960px), 960px"
                  priority
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex max-h-[min(48vh,22rem)] flex-col justify-end sm:max-h-[min(42vh,20rem)]">
                  {(slide as { story?: string }).story ? (
                    <div className="pointer-events-auto min-h-0 shrink overflow-y-auto border-t border-white/10 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pb-2 pt-4 text-left text-zinc-100 sm:px-6">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-300">
                        Author&apos;s Note
                      </p>
                      <p className="mt-2 line-clamp-6 max-w-3xl text-sm leading-relaxed text-zinc-100/95 sm:line-clamp-none sm:text-[15px]">
                        {(slide as { story?: string }).story}
                      </p>
                    </div>
                  ) : null}
                  <div className="pointer-events-auto shrink-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-5">
                    <div className="flex w-full flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-3">
                      <div className="min-w-0 w-full flex-1 text-left md:w-auto">
                        {currentImage
                          ? (() => {
                              const filterTags = [
                                currentImage.scheduleDisplay || currentImage.folderName,
                                currentImage.locationTag,
                                currentImage.withTag,
                              ].filter(Boolean);
                              if (filterTags.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-1.5">
                                  {filterTags.map((tag) => (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => {
                                        if (tag === (currentImage.scheduleDisplay || currentImage.folderName)) {
                                          setSelectedDateTag(currentImage.folderName);
                                        } else if (tag === currentImage.locationTag) {
                                          setSelectedLocationTag(tag as string);
                                        } else if (tag === currentImage.withTag) {
                                          setSelectedWithTag(tag as string);
                                        }
                                        setViewMode("grid");
                                        setVisibleCount(
                                          Math.min(GRID_INITIAL_LOAD, filteredTotal || GRID_INITIAL_LOAD)
                                        );
                                        closeGalleryLightbox();
                                      }}
                                      className="max-w-full truncate rounded-full bg-black/60 px-2.5 py-1 text-left text-[11px] text-white transition hover:bg-black/75"
                                    >
                                      {tag}
                                    </button>
                                  ))}
                                </div>
                              );
                            })()
                          : null}
                      </div>
                      <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 md:w-auto md:justify-end">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (currentImage) void handleLike(currentImage.id);
                          }}
                          disabled={Boolean(currentImage && likingByPhoto[currentImage.id])}
                          className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white transition hover:bg-black/75 disabled:opacity-60"
                          aria-label="좋아요"
                        >
                          <Heart className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                          {currentImage ? (likesByPhoto[currentImage.id] ?? 0) : 0}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (currentImage) void copyPhotoShareLink(currentImage.id);
                          }}
                          className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white transition hover:bg-black/75"
                          aria-label="이 사진 공유 링크 복사"
                        >
                          <Share2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                          Share
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const url = (slide as { downloadUrl?: string }).downloadUrl;
                            if (!url) return;
                            trackGaEvent("photo_download", {
                              location: "lightbox",
                              photo_id: currentImage?.id ?? "",
                            });
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                          className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white transition hover:bg-black/75"
                        >
                          ↓ Download
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          },
        }}
      />

      <style jsx global>{`
        @keyframes quiz-volleyball-bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          35% {
            transform: translateY(-10px);
          }
          55% {
            transform: translateY(3px);
          }
          75% {
            transform: translateY(-4px);
          }
        }
        .quiz-volleyball-btn:hover,
        .quiz-volleyball-btn:focus-visible {
          animation: quiz-volleyball-bounce 0.55s ease-out;
        }
        @media (hover: none) {
          .quiz-volleyball-btn:active {
            animation: quiz-volleyball-bounce 0.55s ease-out;
          }
        }
        .swiper-pagination-bullet {
          width: 7px;
          height: 7px;
          background: rgba(255, 255, 255, 0.6);
          opacity: 1;
        }
        .swiper-pagination-bullet-active {
          background: #ffffff;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-4">
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
          onClick={handleViewModeToggle}
          aria-label={
            viewMode === "feed" ? "모아 보기로 전환" : "크게 보기로 전환"
          }
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#b18f00] bg-[#FFD200] text-black shadow-[0_8px_14px_rgba(0,0,0,0.18)] backdrop-blur-md transition duration-150 active:scale-95"
        >
          {viewMode === "feed" ? (
            <LayoutGrid className="h-4.5 w-4.5" aria-hidden />
          ) : (
            <StretchHorizontal className="h-4.5 w-4.5" aria-hidden />
          )}
        </button>
      </div>

      <div className="fixed bottom-5 left-5 z-40 flex flex-col items-start gap-4">
        <div ref={quizWrapRef} className="relative flex flex-col items-start">
          <AnimatePresence>
            {quizBubbleOpen ? (
              <motion.div
                key="quiz-bubble"
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-full left-0 mb-2 w-[15rem] rounded-2xl border-2 border-[#00287A] bg-white px-3 py-3 shadow-[0_10px_24px_rgba(0,40,122,0.2)]"
                role="dialog"
                aria-label="퀴즈 안내"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <p className="text-sm font-bold text-[#00287A]">오늘의 퀴즈 풀기!</p>
                <p className="mt-1 text-xs leading-snug text-[#00287A]/90">
                  현대건설 배구 퀴즈 페이지로 이동합니다.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuizBubbleOpen(false);
                      router.push("/quiz");
                    }}
                    className="min-h-9 flex-1 rounded-full bg-[#00287A] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-95"
                  >
                    이동
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuizBubbleOpen(false)}
                    className="min-h-9 rounded-full border border-[#00287A]/50 bg-white/90 px-3 py-1.5 text-xs font-medium text-[#00287A] transition hover:bg-white"
                  >
                    닫기
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <motion.button
            type="button"
            aria-label="퀴즈 실행"
            aria-expanded={quizBubbleOpen}
            onClick={() => setQuizBubbleOpen((open) => !open)}
            whileTap={{ scale: 0.94 }}
            className="quiz-volleyball-btn flex h-11 w-11 items-center justify-center rounded-full bg-[#FFD200] text-lg leading-none shadow-[0_6px_16px_rgba(0,40,122,0.22)] transition active:scale-95"
          >
            <span aria-hidden>🏐</span>
          </motion.button>
        </div>
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
            className="fixed bottom-[8.25rem] left-5 z-[60] max-w-[min(calc(100vw-2.5rem),22rem)] rounded-2xl border border-white/45 bg-zinc-950/82 px-4 py-3.5 text-left text-[13px] font-medium leading-snug text-white shadow-xl backdrop-blur-md sm:bottom-[9rem]"
          >
            {shareToast}
          </motion.div>
        ) : null}
      </AnimatePresence>
      </div>
    </>
  );
}
