"use client";

import { useRouter, usePathname } from "next/navigation";
import { Images, ClipboardList, CalendarDays, Heart } from "lucide-react";

const ITEMS = [
  { key: "gallery", label: "갤러리", href: "/", icon: Images },
  { key: "records", label: "기록", href: "/records", icon: ClipboardList },
  { key: "schedule", label: "일정", href: "/schedule", icon: CalendarDays },
  { key: "guestbook", label: "방명록", href: "/?guestbook=1", icon: Heart },
];

export function SiteNav() {
  const router = useRouter();
  const pathname = usePathname();

  const go = (href: string) => {
    router.push(href);
  };

  const isActive = (href: string) => {
    if (href.startsWith("/?")) return false;
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <nav className="sticky top-0 z-[70] hidden border-b border-zinc-200/70 bg-white/85 backdrop-blur-md sm:block">
        <div className="mx-auto flex max-w-[1100px] items-center gap-1 px-5 py-2.5 sm:px-8">
          <span className="mr-3 text-sm font-medium lowercase tracking-[0.04em] text-zinc-900">voto gallery</span>
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => go(item.href)}
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
                onClick={() => go(item.href)}
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
