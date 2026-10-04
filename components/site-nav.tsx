"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Images,
  ClipboardList,
  CalendarDays,
  Heart,
  Camera,
  Gift,
  Sparkles,
} from "lucide-react";
import { BIRTHDAY_DEADLINE, BIRTHDAY_NOTICE_SHOW_FROM } from "@/lib/birthday";
import { useClock } from "@/lib/clock";
import { isBirthdayMessagePeriod } from "@/lib/home-notice";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: typeof Images;
};

const SAJU_ITEM: NavItem = { key: "saju", label: "궁합", href: "/saju", icon: Sparkles };
const BIRTHDAY_ITEM: NavItem = { key: "birthday", label: "생일", href: "/birthday", icon: Gift };

/** 생일 메시지 접수 기간에는 궁합 자리에 생일이 들어간다 */
function navItems(birthdaySlot: NavItem): NavItem[] {
  return [
    { key: "gallery", label: "HOME", href: "/", icon: Images },
    { key: "voto", label: "배구사진", href: "/voto", icon: Camera },
    { key: "schedule", label: "배구일정", href: "/schedule", icon: CalendarDays },
    { key: "records", label: "다인기록", href: "/records", icon: ClipboardList },
    birthdaySlot,
    { key: "guestbook", label: "방명록", href: "/?guestbook=1", icon: Heart },
  ];
}

/** 생일 아이콘 흔들림은 페이지를 처음 열었을 때 한 번만 */
let birthdayWiggleDone = false;

export function SiteNav() {
  const router = useRouter();
  const pathname = usePathname();
  const now = useClock();
  const slotPending = now === null;
  const birthdayPeriod =
    now !== null &&
    isBirthdayMessagePeriod(new Date(now), BIRTHDAY_NOTICE_SHOW_FROM, BIRTHDAY_DEADLINE);
  const items = navItems(birthdayPeriod ? BIRTHDAY_ITEM : SAJU_ITEM);
  const wiggleClass = birthdayWiggleDone ? "" : "site-nav-gift-wiggle";
  const onWiggleEnd = () => {
    birthdayWiggleDone = true;
  };

  const go = (href: string) => {
    router.push(href);
  };

  const handleGuestbook = () => {
    if (pathname === "/") {
      window.dispatchEvent(new Event("open-guestbook"));
    } else {
      router.push("/?guestbook=1");
    }
  };

  const handleItemClick = (item: NavItem) => {
    if (item.key === "guestbook") {
      handleGuestbook();
      return;
    }
    go(item.href);
  };

  const isActive = (href: string) => {
    if (href.startsWith("/?")) return false;
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  /** 시각을 알기 전에는 궁합/생일 칸을 비워 두고 자리만 유지한다 */
  const pendingProps = (item: NavItem) =>
    slotPending && item.key === SAJU_ITEM.key
      ? { "aria-hidden": true, tabIndex: -1, style: { visibility: "hidden" as const } }
      : {};

  return (
    <>
      <nav className="sticky top-0 z-[70] hidden border-b border-zinc-200/70 bg-white/85 backdrop-blur-md sm:block">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-1 px-5 py-2.5 sm:px-8">
          <span className="mr-3 text-sm font-medium lowercase tracking-[0.04em] text-zinc-900">voto gallery</span>
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            if (item.key === BIRTHDAY_ITEM.key) {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    active
                      ? "bg-[#C8202C] text-white"
                      : "bg-[rgba(200,32,44,0.12)] text-[#C8202C] hover:bg-[rgba(200,32,44,0.2)]"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${wiggleClass}`} onAnimationEnd={onWiggleEnd} />
                  {item.label}
                </button>
              );
            }
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleItemClick(item)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${
                  active ? "bg-[#00287A] text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
                {...pendingProps(item)}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <nav className="fixed bottom-0 left-0 right-0 z-[70] border-t border-zinc-200 bg-white/95 backdrop-blur-md sm:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            if (item.key === BIRTHDAY_ITEM.key) {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  aria-current={active ? "page" : undefined}
                  className="flex min-w-0 flex-1 flex-col items-center justify-center py-1"
                >
                  <span
                    className={`flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 text-[10px] font-bold transition ${
                      active ? "bg-[#C8202C] text-white" : "bg-[rgba(200,32,44,0.12)] text-[#C8202C]"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${wiggleClass}`} onAnimationEnd={onWiggleEnd} />
                    {item.label}
                  </span>
                </button>
              );
            }
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleItemClick(item)}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition ${
                  active ? "text-[#00287A]" : "text-zinc-500"
                }`}
                {...pendingProps(item)}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
