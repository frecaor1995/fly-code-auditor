"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/db/types";
import { visibleLinks } from "./navLinks";
import { useLanguage } from "@/lib/i18n/useLanguage";

export function MobileNav({ role, userName }: { role: Role; userName: string }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden no-print">
      <header className="flex items-center justify-between px-4 py-3 border-b border-fly-gray bg-fly-charcoal sticky top-0 z-30">
        <div>
          <p className="text-fly-gold font-bold leading-tight">Fly Code Auditor</p>
          <p className="text-[10px] text-fly-lightgray/60">Fly Electric Solutions LLC</p>
        </div>
        <button
          type="button"
          aria-label="Menu"
          className="min-h-[3rem] min-w-[3rem] rounded-lg border border-fly-gray text-2xl"
          onClick={() => setOpen(true)}
        >
          ☰
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-fly-black/95 flex flex-col p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <p className="text-fly-gold font-bold text-lg">{userName}</p>
            <button
              type="button"
              aria-label="Cerrar"
              className="min-h-[3rem] min-w-[3rem] rounded-lg border border-fly-gray text-2xl"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
          <nav className="flex flex-col gap-2">
            {visibleLinks(role).map((link) => {
              const active = pathname === link.href || pathname?.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-4 text-base font-semibold ${
                    active ? "bg-fly-gold text-fly-black" : "bg-fly-charcoal text-fly-white"
                  }`}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span>{t(link.labelKey)}</span>
                </Link>
              );
            })}
            <button
              type="button"
              className="mt-4 rounded-xl px-4 py-4 text-base font-semibold border border-fly-gray text-fly-lightgray"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
            >
              {t("nav_logout")}
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
