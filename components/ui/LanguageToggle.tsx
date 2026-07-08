"use client";

import type { Language } from "@/lib/db/types";

const OPTIONS: { value: Language; label: string }[] = [
  { value: "es", label: "Espanol" },
  { value: "en", label: "English" },
  { value: "bilingual", label: "Bilingue" }
];

export function LanguageToggle({
  value,
  onChange
}: {
  value: Language;
  onChange: (lang: Language) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-fly-gray overflow-hidden">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2 text-xs font-semibold transition ${
            value === opt.value ? "bg-fly-gold text-fly-black" : "bg-fly-charcoal text-fly-white hover:bg-fly-gray/40"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
