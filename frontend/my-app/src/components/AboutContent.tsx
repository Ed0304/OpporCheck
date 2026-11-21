// About page copy. Client component so it can follow the UI language
// preference; the server page keeps its metadata export and renders this.
//
// Body copy renders in ink (not muted) for readability; the full
// disclaimer is intentionally not repeated here because the site footer
// already carries it on every public page — a concise notice stands in.

"use client";

import Link from "next/link";
import { ContextualNotice } from "@/components/Disclaimer";
import { Enter, Reveal } from "@/components/motion";
import { DeskArt } from "@/components/spot";
import { getConciseNotice } from "@/lib/disclaimer";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

export default function AboutContent() {
  const { language } = useLang();
  const t = getStrings(language);
  const limits = [t.aboutNot1, t.aboutNot2, t.aboutNot3];
  const capabilities = [
    { title: t.landingCap1Title, text: t.landingCap1Text },
    { title: t.landingCap2Title, text: t.landingCap2Text },
    { title: t.landingCap3Title, text: t.landingCap3Text },
    { title: t.landingCap4Title, text: t.landingCap4Text },
  ];
  return (
    <>
      <Enter className="mx-auto max-w-3xl">
        <DeskArt className="mx-auto h-36 w-auto" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-navy">{t.aboutTitle}</h1>
        <p className="mt-4 text-lg leading-8">{t.aboutP1}</p>
        <p className="mt-4 leading-7">{t.aboutP2}</p>
      </Enter>

      <Reveal className="mx-auto mt-10 max-w-3xl">
        <section aria-labelledby="about-limits">
          <h2 id="about-limits" className="text-xl font-semibold text-ink">
            {t.aboutNotTitle}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {limits.map((limit) => (
              <li
                key={limit.slice(0, 24)}
                className="rounded-lg border border-edge bg-card px-4 py-3 leading-7"
              >
                {limit}
              </li>
            ))}
          </ul>
        </section>
      </Reveal>

      <Reveal className="mx-auto mt-10 max-w-3xl">
        <section aria-labelledby="about-how">
          <h2 id="about-how" className="text-xl font-semibold text-ink">
            {t.aboutHowTitle}
          </h2>
          <p className="mt-3 leading-7">{t.aboutHowText}</p>
        </section>
      </Reveal>

      <Reveal className="mx-auto mt-10 max-w-3xl">
        <section aria-labelledby="about-capabilities">
          <h2 id="about-capabilities" className="text-xl font-semibold text-ink">
            {t.landingCapabilities}
          </h2>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {capabilities.map((item) => (
              <li
                key={item.title}
                className="oc-shadow-card rounded-xl border border-edge bg-card p-4"
              >
                <h3 className="font-semibold text-ink">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </Reveal>

      <Reveal className="mx-auto mt-10 max-w-3xl">
        <ContextualNotice>{getConciseNotice(language)}</ContextualNotice>
      </Reveal>

      <div className="mx-auto mt-8 flex max-w-3xl flex-wrap gap-3">
        <Link
          href="/register"
          className="inline-flex h-11 items-center rounded-md bg-brand px-6 text-base font-medium text-on-action transition-colors duration-200 ease-out hover:bg-brand-strong"
        >
          {t.landingGetStarted}
        </Link>
        <Link
          href="/how-it-works"
          className="inline-flex h-11 items-center rounded-md border border-edge bg-card px-6 text-base font-medium transition-colors duration-150 ease-out hover:bg-brand-soft"
        >
          {t.landingHowItWorks}
        </Link>
      </div>
    </>
  );
}
