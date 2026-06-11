"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Images,
  ClipboardList,
  CalendarDays,
  Heart,
  Camera,
} from "lucide-react";

const ITEMS = [
  { key: "gallery", label: "HOME", href: "/", icon: Images },
  { key: "voto", label: "배구사진", href: "/voto", icon: Camera },
  { key: "schedule", label: "배구일정", href: "/schedule", icon: CalendarDays },
  { key: "records", label: "다인기록", href: "/records", icon: ClipboardList },
  { key: "guestbook", label: "방명록", href: "/?guestbook=1", icon: Heart },
];

export function SiteNav() {
  const router = useRouter();
  const pathname = usePathname();

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

  const handleItemClick = (item: (typeof ITEMS)[number]) => {
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

  return (
    <>
      <nav className="sticky top-0 z-[70] hidden border-b border-zinc-200/70 bg-white/85 backdrop-blur-md sm:block">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-1 px-5 py-2.5 sm:px-8">
          <span className="mr-3 text-sm font-medium lowercase tracking-[0.04em] text-zinc-900">voto gallery</span>
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleItemClick(item)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${
                  active ? "bg-[#00287A] text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
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
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleItemClick(item)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition ${
                  active ? "text-[#00287A]" : "text-zinc-500"
                }`}
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
