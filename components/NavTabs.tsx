"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Заказ" },
  { href: "/cake", label: "Торт на заказ" },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 mt-3.5 bg-surface-2 rounded-xl p-1">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 text-center py-2.5 px-2 text-xs font-bold rounded-lg transition-colors ${
              active ? "bg-accent text-accent-ink" : "text-fg-muted"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
