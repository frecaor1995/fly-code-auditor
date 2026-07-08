"use client";

import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useLanguage } from "@/lib/i18n/useLanguage";

export function SettingsClient({ userName, roleLabel, email }: { userName: string; roleLabel: string; email: string }) {
  const { mode, changeMode } = useLanguage();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-fly-gray bg-fly-charcoal p-4 space-y-1">
        <h2 className="font-semibold text-fly-gold">Usuario</h2>
        <p className="text-sm">{userName}</p>
        <p className="text-xs text-fly-lightgray/60">{email}</p>
        <p className="text-xs text-fly-lightgray/60">Rol: {roleLabel}</p>
      </section>

      <section className="rounded-2xl border border-fly-gray bg-fly-charcoal p-4 space-y-2">
        <h2 className="font-semibold text-fly-gold">Idioma de la aplicacion / App language</h2>
        <p className="text-xs text-fly-lightgray/60">
          Espanol, English o Bilingue (muestra ambos en las respuestas del asistente).
        </p>
        <LanguageToggle value={mode} onChange={changeMode} />
      </section>
    </div>
  );
}
