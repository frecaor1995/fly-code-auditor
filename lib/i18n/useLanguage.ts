"use client";

import { useCallback, useEffect, useState } from "react";
import { t, type DictionaryKey, type UiLanguage } from "./dictionary";
import type { Language } from "../db/types";

const STORAGE_KEY = "fca_ui_language";

export function useLanguage(initial: Language = "bilingual") {
  const [mode, setMode] = useState<Language>(initial);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved === "es" || saved === "en" || saved === "bilingual") {
      setMode(saved);
    }
  }, []);

  const changeMode = useCallback((next: Language) => {
    setMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const uiLang: UiLanguage = mode === "en" ? "en" : "es";
  const translate = useCallback((key: DictionaryKey) => t(uiLang, key), [uiLang]);

  return { mode, changeMode, uiLang, t: translate };
}
