// Landing page copy. Client component so it can follow the UI language
// preference; the server page keeps its metadata export and renders this.

"use client";

import Link from "next/link";
import { DocSheet, DocStack } from "@/components/atelier";
import { Enter, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { EvidenceQuote, StatusLabel } from "@/components/ui";
import { getConciseNotice } from "@/lib/disclaimer";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

export default function LandingContent() {
  const { language } = useLang();
  const t = getStrings(language);
  const workflow = [
    { n: "01", title: t.landingStep1Title, text: t.landingStep1Text },
    { n: "02", title: t.landingStep2Title, text: t.landingStep2Text },
    { n: "03", title: t.landingStep3Title, text: t.landingStep3Text },
  ];
  const capabilities = [
    { title: t.landingCap1Title, text: t.landingCap1Text },
    { title: t.landingCap2Title, text: t.landingCap2Text },
    { title: t.landingCap3Title, text: t.landingCap3Text },
    { title: t.landingCap4Title, text: t.landingCap4Text },
  ];
  return (
    <>
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <Stagger className="max-w-2xl">
          <StaggerItem>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-navy">
              {t.landingTitle}
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-3 text-lg leading-8 text-muted">{t.landingSubtitle}</p>
          </StaggerItem>
          <StaggerItem>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex h-11 items-center rounded-md bg-brand px-6 text-base font-medium text-on-action transition-colors hover:bg-brand-strong"
              >
                {t.landingGetStarted}
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex h-11 items-center rounded-md border border-edge bg-card px-6 text-base font-medium transition-colors hover:bg-brand-soft"
              >
                {t.landingHowItWorks}
              </Link>
            </div>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted" role="note">
              {getConciseNotice(language)}
            </p>
          </StaggerItem>
        </Stagger>

        <Enter delay={0.15}>
        <figure aria-label={t.landingExampleAria}>
          <DocStack label={t.landingExampleBadge}>
            <DocSheet
              eyebrow={t.landingExampleBadge}
              title={t.landingExampleClaim}
              actions={<StatusLabel tone="ok">{t.landingExampleStatus}</StatusLabel>}
            >
              <EvidenceQuote>&ldquo;{t.landingExampleQuote}&rdquo;</EvidenceQuote>
              <p className="oc-animate-highlight mt-3 inline-flex items-center gap-1.5 rounded-full border border-edge bg-evidence-soft px-2.5 py-1 text-xs font-medium text-evidence">
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 rounded-full bg-evidence"
                />
                {t.landingPreviewAnnotation}
              </p>
              <p className="mt-2 text-xs text-muted">{t.landingExampleSource}</p>
              <ol className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-paper-edge pt-3 text-xs">
                <li>
                  <span className="inline-block rounded border border-paper-edge bg-page-edge px-2 py-0.5 font-medium">
                    {t.landingPreviewPromise}
                  </span>
                </li>
                <li>
                  <span aria-hidden="true" className="mr-1.5 text-muted">
                    &rarr;
                  </span>
                  <span className="inline-block rounded border border-paper-edge bg-page-edge px-2 py-0.5 font-medium">
                    {t.landingPreviewTerm}
                  </span>
                </li>
                <li>
                  <span aria-hidden="true" className="mr-1.5 text-muted">
                    &rarr;
                  </span>
                  <span className="inline-block rounded border border-paper-edge bg-page-edge px-2 py-0.5 font-medium">
                    {t.landingPreviewClarification}
                  </span>
                </li>
              </ol>
            </DocSheet>
          </DocStack>
          <figcaption className="mt-3 border-t border-edge pt-3 text-xs text-muted">
            {t.landingExampleCaption}
          </figcaption>
        </figure>
        </Enter>
      </div>

      <Reveal className="mt-12">
        <section aria-labelledby="what-is">
          <h2 id="what-is" className="text-2xl font-semibold">
            {t.landingWhatIs}
          </h2>
          <p className="mt-2 max-w-3xl leading-7 text-muted">{t.landingWhatIsText}</p>
        </section>
      </Reveal>

      <Reveal className="mt-10">
      <section aria-labelledby="workflow">
        <h2 id="workflow" className="text-2xl font-semibold">
          {t.landingWorkflow}
        </h2>
        <ol className="mt-4 grid gap-6 md:grid-cols-3">
          {workflow.map((item) => (
            <li key={item.title} className="border-t-2 border-edge pt-4">
              <p aria-hidden="true" className="text-2xl font-bold text-brand">
                {item.n}
              </p>
              <h3 className="mt-1 font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>
      </Reveal>

      <Reveal className="mt-10">
        <section aria-labelledby="capabilities">
          <h2 id="capabilities" className="text-2xl font-semibold">
            {t.landingCapabilities}
          </h2>
          <dl className="mt-4 grid gap-x-10 md:grid-cols-2">
            {capabilities.map((item) => (
              <div key={item.title} className="border-t border-edge py-4">
                <dt className="font-semibold">{item.title}</dt>
                <dd className="mt-1 text-sm leading-6 text-muted">{item.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      </Reveal>

      <Reveal className="mt-10">
        <section aria-labelledby="transparency">
          <h2 id="transparency" className="text-2xl font-semibold">
            {t.landingTransparency}
          </h2>
          <div className="mt-4 max-w-3xl leading-7 text-muted">
            <p>{t.landingTransparencyText}</p>
            <ul className="mt-2 list-disc pl-5">
              <li>{t.landingLimit1}</li>
              <li>{t.landingLimit2}</li>
              <li>{t.landingLimit3}</li>
            </ul>
          </div>
        </section>
      </Reveal>
    </>
  );
}
