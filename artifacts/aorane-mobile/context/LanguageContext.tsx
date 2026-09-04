import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { type LangCode, t as translate, SUPPORTED_LANGS } from "@/lib/translations";
import { MULTI_LANGUAGE_ENABLED } from "@/constants/features";
import { api } from "@/lib/api";
import { logSilentError } from "@/lib/silentCatch";

const STORAGE_KEY = "aorane.languageCode";

/** Maps a device locale (e.g. "hi-IN", "en-US", "ta") to the nearest
 * language we actually support, falling back to English. */
function detectDeviceLanguage(): LangCode {
  try {
    const locales = Localization.getLocales();
    for (const locale of locales) {
      const code = locale.languageCode?.toLowerCase();
      if (code && (SUPPORTED_LANGS as readonly string[]).includes(code)) {
        return code as LangCode;
      }
    }
  } catch {
    // Localization API unavailable (e.g. some web/test environments) — fall through
  }
  return "en";
}

type LanguageContextType = {
  lang: LangCode;
  setLang: (lang: LangCode) => Promise<void>;
  t: (key: Parameters<typeof translate>[1]) => string;
  isLoaded: boolean;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");
  const [isLoaded, setIsLoaded] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        // While multi-language is off, neither a saved preference nor the
        // device locale may select a language. Skipping this would leave a
        // user whose phone is set to Hindi — or who picked Hindi before the
        // switcher was hidden — on a half-translated app with no way back.
        if (!MULTI_LANGUAGE_ENABLED) {
          if (mountedRef.current) setLangState("en");
          return;
        }
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && (SUPPORTED_LANGS as readonly string[]).includes(stored)) {
          if (mountedRef.current) setLangState(stored as LangCode);
        } else {
          // No saved preference yet (first launch) — auto-detect from device.
          const detected = detectDeviceLanguage();
          if (mountedRef.current) setLangState(detected);
        }
      } catch (e) {
        logSilentError("language-load", e);
      } finally {
        if (mountedRef.current) setIsLoaded(true);
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  const setLang = useCallback(async (newLang: LangCode) => {
    setLangState(newLang);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newLang);
    } catch (e) {
      logSilentError("language-save-local", e);
    }
    // Sync to backend too, so the preference follows the user across
    // devices and so server-generated content (emails, notifications)
    // can eventually respect it. Best-effort — a failure here shouldn't
    // block the language switch from working locally.
    try {
      await api.updatePreferences({ languageCode: newLang });
    } catch (e) {
      logSilentError("language-save-backend", e);
    }
  }, []);

  const t = useCallback(
    (key: Parameters<typeof translate>[1]) => translate(lang, key),
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isLoaded }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
