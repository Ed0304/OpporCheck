// How-it-works page copy. Client component so it can follow the UI
// language preference; the server page keeps its metadata export and
// renders this.

"use client";

import Link from "next/link";
import { Enter, Reveal } from "@/components/motion";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

export default function HowItWorksContent() {
  const { language } = useLang();
  const t = getStrings(language);
  const steps = [
    { n: "1", title: t.howStep1Title, text: t.howStep1Text },
    { n: "2", title: t.howStep2Title, text: t.howStep2Text },
    { n: "3", title: t.howStep3Title, text: t.howStep3Text },
    { n: "4", title: t.howStep4Title, text: t.howStep4Text },
  ];
  return (
    <>
      <Enter className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{t.howTitle}</h1>
        <p className="mt-3 leading-7 text-muted">{t.howSubtitle}</p>
      </Enter>
      <Reveal className="mt-8 max-w-3xl" delay={0.05}>
      <ol className="flex flex-col">
        {steps.map((step, index) => (
          <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute left-[17px] top-10 h-[calc(100%-2.5rem)] w-px bg-paper-edge"
              />
            )}
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-paper-edge bg-paper text-sm font-bold text-brand shadow-[0_2px_10px_var(--oc-paper-shadow)]"
            >
              {step.n}
            </span>
            <div className="flex-1 rounded-lg border border-paper-edge bg-paper p-4 shadow-[0_2px_10px_var(--oc-paper-shadow)]">
              <h2 className="font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      </Reveal>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/register"
          className="inline-flex h-11 items-center rounded-md bg-brand px-6 text-base font-medium text-on-action transition-colors duration-200 ease-out hover:bg-brand-strong"
        >
          {t.landingGetStarted}
        </Link>
        <Link
          href="/resources"
          className="inline-flex h-11 items-center rounded-md border border-edge bg-card px-6 text-base font-medium transition-colors duration-150 ease-out hover:bg-brand-soft"
        >
          {t.howBrowse}
        </Link>
      </div>
    </>
  );
}
