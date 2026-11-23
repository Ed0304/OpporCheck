// How-it-works page copy. Client component so it can follow the UI
// language preference; the server page keeps its metadata export and
// renders this.

"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import GetStartedLink from "@/components/GetStartedLink";
import { Enter, OC_DURATION, OC_EASE, Reveal } from "@/components/motion";
import { DeskArt, SpotBook, SpotCheck, SpotDocLens, SpotShield, SpotUpload } from "@/components/spot";
import { StatusLabel } from "@/components/ui";
import type { FindingAssessment } from "@/lib/investigations";
import { useLang } from "@/lib/lang";
import { ASSESSMENT_TONES, getAssessmentLabels } from "@/lib/reportLanguage";
import { getStrings } from "@/lib/strings";

export default function HowItWorksContent() {
  const { language } = useLang();
  const t = getStrings(language);
  const steps = [
    { n: "1", title: t.howStep1Title, text: t.howStep1Text, Art: SpotUpload, chip: "bg-brand-soft text-brand" },
    { n: "2", title: t.howStep2Title, text: t.howStep2Text, Art: SpotShield, chip: "bg-ok-soft text-ok" },
    { n: "3", title: t.howStep3Title, text: t.howStep3Text, Art: SpotDocLens, chip: "bg-evidence-soft text-evidence" },
    { n: "4", title: t.howStep4Title, text: t.howStep4Text, Art: SpotCheck, chip: "bg-brand-soft text-brand" },
    { n: "5", title: t.howStep5Title, text: t.howStep5Text, Art: SpotBook, chip: "bg-evidence-soft text-evidence" },
  ];
  const [openIndex, setOpenIndex] = useState<number | null>(0);
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
      <div className="mx-auto mt-8 hidden max-w-3xl items-start md:flex">
        {steps.map((step, index) => (
          <div key={step.title} className="flex min-w-0 flex-1 items-start last:flex-none">
            <a
              href={`#how-step-${step.n}`}
              onClick={() => setOpenIndex(index)}
              className="group flex w-24 shrink-0 flex-col items-center gap-2 rounded-lg p-1 text-center transition-colors hover:bg-brand-soft/60"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-paper-edge bg-paper text-sm font-bold text-brand shadow-[0_2px_10px_var(--oc-paper-shadow)] transition-colors group-hover:border-brand/60">
                {step.n}
              </span>
              <span className="text-xs leading-4 font-medium text-muted group-hover:text-ink">{step.title}</span>
            </a>
            {index < steps.length - 1 && (
              <span className="mx-2 mt-[17px] h-px min-w-6 flex-1 bg-paper-edge" />
            )}
          </div>
        ))}
      </div>
      <div className="mx-auto mt-8 max-w-3xl">
      <ol className="flex flex-col">
        {steps.map((step, index) => {
          const open = openIndex === index;
          return (
          <motion.li
            key={step.title}
            id={`how-step-${step.n}`}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-32px" }}
            transition={{
              duration: OC_DURATION.base,
              ease: OC_EASE,
              delay: Math.min(index * 0.06, 0.18),
            }}
            className="relative flex scroll-mt-24 gap-4 pb-12 last:pb-0"
          >
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="oc-flow-line absolute left-[17px] top-10 h-[calc(100%-2.5rem)] w-px bg-paper-edge"
              />
            )}
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-paper-edge bg-paper text-sm font-bold text-brand shadow-[0_2px_10px_var(--oc-paper-shadow)]"
            >
              {step.n}
            </span>
            <div className="oc-glass oc-lift min-w-0 flex-1 rounded-lg border border-edge">
              <h2>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`how-step-${step.n}-panel`}
                  onClick={() => setOpenIndex(open ? null : index)}
                  className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
                >
                  <span
                    aria-hidden
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${step.chip}`}
                  >
                    <step.Art size={18} />
                  </span>
                  <span className="min-w-0 flex-1 font-semibold">{step.title}</span>
                  <svg
                    aria-hidden
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-muted transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </h2>
              <div
                id={`how-step-${step.n}-panel`}
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="overflow-hidden">
                  <p className="pr-4 pb-4 pl-16 text-sm leading-6">{step.text}</p>
                </div>
              </div>
            </div>
          </motion.li>
          );
        })}
      </ol>
      </div>
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
                className="oc-glass oc-lift rounded-xl border border-edge p-4 sm:flex sm:items-start sm:gap-4"
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
        <GetStartedLink className="inline-flex h-11 items-center rounded-md bg-brand px-6 text-base font-medium text-on-action transition-colors duration-200 ease-out hover:bg-brand-strong">
          {t.landingGetStarted}
        </GetStartedLink>
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
