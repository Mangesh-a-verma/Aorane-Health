import React, { createContext, useContext, useCallback } from "react";
import { type LangCode, t as translate } from "@/lib/translations";

// LANGUAGE SYSTEM: Currently locked to English.
// To re-enable multi-language: restore AsyncStorage + useState for lang,
// expose setLang in context, and add language selector UI in Profile screen.
const CURRENT_LANG: LangCode = "en";

type LanguageContextType = {
  lang: LangCode;
  setLang: (lang: LangCode) => Promise<void>;
  t: (key: Parameters<typeof translate>[1]) => string;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = CURRENT_LANG;

  // setLang is kept in API for forward compatibility — will be wired up
  // when multi-language UI is re-enabled.
  const setLang = useCallback(async (_newLang: LangCode) => {
    // Multi-language not active yet — no-op
  }, []);

  const t = useCallback(
    (key: Parameters<typeof translate>[1]) => translate(lang, key),
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
