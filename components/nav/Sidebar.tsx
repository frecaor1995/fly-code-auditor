"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/db/types";
import { visibleLinks } from "./navLinks";
import { useLanguage } from "@/lib/i18n/useLanguage";

export function Sidebar({ role, userName }: { role: Role; userName: string }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <aside className="no-print hidden md:flex md:flex-col w-64 shrink-0 border-r border-fly-gray bg-fly-charcoal min-h-screen p-4">
      <div className="mb-8">
        <p className="text-fly-gold font-bold text-lg leading-tight">Fly Code Auditor</p>
        <p className="text-xs text-fly-lightgray/60">Fly Electric Solutions LLC</p>
      </div>
      <nav className="flex-1 space-y-1">
        {visibleLinks(role).map((link) => {
          const active = pathname === link.href || pathname?.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-fly-gold text-fly-black" : "text-fly-white hover:bg-fly-gray/30"
              }`}
            >
              <span>{link.icon}</span>
              <span>{t(link.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-fly-gray pt-3 mt-3">
        <p className="text-xs text-fly-lightgray/60 mb-2 truncate">{userName}</p>
        <button
          type="button"
          className="text-sm text-fly-lightgray/80 hover:text-fly-gold"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
        >
          {t("nav_logout")}
        </button>
      </div>
    </aside>
  );
}
