// How-it-works page copy. Client component so it can follow the UI
// language preference; the server page keeps its metadata export and
// renders this.

"use client";

import Link from "next/link";
import { Enter, Reveal } from "@/components/motion";
import { DeskArt, SpotBook, SpotCheck, SpotDocLens, SpotUpload } from "@/components/spot";
import { StatusLabel } from "@/components/ui";
import type { FindingAssessment } from "@/lib/investigations";
import { useLang } from "@/lib/lang";
import { ASSESSMENT_TONES, getAssessmentLabels } from "@/lib/reportLanguage";
import { getStrings } from "@/lib/strings";

export default function HowItWorksContent() {
  const { language } = useLang();
  const t = getStrings(language);
  const steps = [
    { n: "1", title: t.howStep1Title, text: t.howStep1Text, Art: SpotUpload },
    { n: "2", title: t.howStep2Title, text: t.howStep2Text, Art: SpotDocLens },
    { n: "3", title: t.howStep3Title, text: t.howStep3Text, Art: SpotBook },
    { n: "4", title: t.howStep4Title, text: t.howStep4Text, Art: SpotCheck },
  ];
  const labels = getAssessmentLabels(language);
  const glossary: Array<{ assessment: FindingAssessment; meaning: string }> = [
    { assessment: "supported", meaning: t.howGlossarySupportedText },
    { assessment: "conflicting", meaning: t.howGlossaryConflictingText },
    { assessment: "insufficient-evidence", meaning: t.howGlossaryInsufficientText },
  ];
  return (
    <>
      <Enter className="mx-auto max-w-3xl">
        <DeskArt className="mx-auto h-36 w-auto" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-navy">{t.howTitle}</h1>
        <p className="mt-3 leading-7 text-muted">{t.howSubtitle}</p>
      </Enter>
      <div aria-hidden className="mx-auto mt-8 hidden max-w-3xl items-start md:flex">
        {steps.map((step, index) => (
          <div key={step.title} className="flex min-w-0 flex-1 items-start last:flex-none">
            <div className="flex w-24 shrink-0 flex-col items-center gap-2 text-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-paper-edge bg-paper text-sm font-bold text-brand shadow-[0_2px_10px_var(--oc-paper-shadow)]">
                {step.n}
              </span>
              <span className="text-xs leading-4 font-medium text-muted">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <span className="mx-2 mt-[17px] h-px min-w-6 flex-1 bg-paper-edge" />
            )}
          </div>
        ))}
      </div>
      <Reveal className="mx-auto mt-8 max-w-3xl" delay={0.05}>
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
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"
                >
                  <step.Art size={18} />
                </span>
                <h2 className="font-semibold">{step.title}</h2>
              </div>
              <p className="mt-2 text-sm leading-6">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      </Reveal>
      <Reveal className="mx-auto mt-12 max-w-3xl">
        <section aria-labelledby="finding-labels">
          <h2 id="finding-labels" className="text-2xl font-semibold tracking-tight text-navy">
            {t.howGlossaryTitle}
          </h2>
          <p className="mt-2 leading-7 text-muted">{t.howGlossaryIntro}</p>
          <ul className="mt-4 flex flex-col gap-4">
            {glossary.map((item) => (
              <li
                key={item.assessment}
                className="oc-shadow-card rounded-xl border border-edge bg-card p-4 sm:flex sm:items-start sm:gap-4"
              >
                <div className="sm:w-64 sm:shrink-0">
                  <StatusLabel tone={ASSESSMENT_TONES[item.assessment]} wrap>
                    {labels[item.assessment]}
                  </StatusLabel>
                </div>
                <p className="mt-2 text-sm leading-6 sm:mt-0.5">{item.meaning}</p>
              </li>
            ))}
          </ul>
        </section>
      </Reveal>
      <div className="mx-auto mt-8 flex max-w-3xl flex-wrap gap-3">
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
