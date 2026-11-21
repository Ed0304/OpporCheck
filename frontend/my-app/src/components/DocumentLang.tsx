// Keeps <html lang> in sync with the UI language preference. The root
// layout is a server component and cannot read the preference, so this
// minimal client companion applies it after hydration (a blocking script
// in the layout sets the initial value before first paint).

"use client";

import { useEffect } from "react";
import { useLang } from "@/lib/lang";

export default function DocumentLang() {
  const { language } = useLang();
  useEffect(() => {
    document.documentElement.lang = language === "id" ? "id" : "en";
  }, [language]);
  return null;
}
