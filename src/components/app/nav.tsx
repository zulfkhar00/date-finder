"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, MessageCircle, User } from "lucide-react";

// Order matters: Profile is the far-right tab.
const TABS = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/chats", label: "Chats", Icon: MessageCircle },
  { href: "/dates", label: "Dates", Icon: CalendarDays },
  { href: "/profile", label: "Profile", Icon: User }
] as const;

export function BottomNav({ base = "", needsYou = 0 }: { base?: string; needsYou?: number }) {
  const pathname = usePathname();
  return (
    <nav className="app-nav" aria-label="Main">
      <ul>
        {TABS.map(({ href, label, Icon }) => {
          const full = `${base}${href}`;
          const active = pathname === full || pathname.startsWith(`${full}/`);
          return (
            <li key={href}>
              <Link href={full} aria-current={active ? "page" : undefined}>
                <Icon size={24} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                {label}
                {href === "/chats" && needsYou > 0 ? <span className="dot" aria-label={`${needsYou} need you`}>{needsYou}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
