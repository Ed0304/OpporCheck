// Language toggle for the evidence investigation panel: English / Bahasa
// Indonesia. Compact radio buttons; the choice persists via LangProvider.
// (The resources section uses its own local ResourceLanguageFilter.)

"use client";

import { useLang } from "@/lib/lang";
import { UI_LANGUAGES, getStrings } from "@/lib/strings";

export default function LanguageToggle() {
  const { language, setLanguage } = useLang();
  const t = getStrings(language);
  return (
    <div role="radiogroup" aria-label={t.languageLabel} className="flex gap-1">
      {UI_LANGUAGES.map((entry) => (
        <button
          key={entry.code}
          type="button"
          role="radio"
          aria-checked={language === entry.code}
          title={entry.label}
          onClick={() => setLanguage(entry.code)}
          className={`h-9 cursor-pointer rounded-md px-3 text-sm font-medium ${
            language === entry.code ? "bg-brand-soft text-navy" : "hover:bg-brand-soft"
          }`}
        >
          {entry.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
