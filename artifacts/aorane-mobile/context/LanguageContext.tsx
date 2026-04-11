import React, { createContext, useContext, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type LangCode, translations, t as translate } from "@/lib/translations";

type LanguageContextType = {
  lang: LangCode;
  setLang: (lang: LangCode) => Promise<void>;
  t: (key: Parameters<typeof translate>[1]) => string;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");

  const setLang = useCallback(async (newLang: LangCode) => {
    setLangState(newLang);
    await AsyncStorage.setItem("app_language", newLang);
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
