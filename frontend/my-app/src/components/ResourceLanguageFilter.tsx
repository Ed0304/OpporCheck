// Resource-language filter for the guidance surfaces: switches the
// resources section text between English and Indonesian. Local to the
// resources section: it never changes navigation, page titles, or any
// other surface. Quiet segmented control; the global :focus-visible
// ring marks keyboard focus.

import type { UiLanguage } from "@/lib/strings";

const OPTIONS: ReadonlyArray<{ code: UiLanguage; label: string }> = [
  { code: "en", label: "English" },
  { code: "id", label: "Indonesian" },
];

export default function ResourceLanguageFilter({
  value,
  onChange,
}: {
  value: UiLanguage;
  onChange: (language: UiLanguage) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span id="resource-language-label" className="text-xs text-muted">
        Resource language:
      </span>
      <div
        role="radiogroup"
        aria-labelledby="resource-language-label"
        className="inline-flex rounded-md border border-edge p-0.5"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={value === option.code}
            onClick={() => onChange(option.code)}
            className={`h-7 cursor-pointer rounded px-2 text-xs font-medium ${
              value === option.code
                ? "bg-brand-soft font-semibold text-navy"
                : "text-muted hover:bg-brand-soft hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
