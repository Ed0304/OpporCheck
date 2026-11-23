// Landing page: split hero with headline, Promise-to-Paper action, and a
// three-card comparison graphic (HeroComposition), with fictional sample
// documents below. Client component so copy follows the UI language
// preference; the server page keeps its metadata export and renders this.
//
// Page chrome uses theme tokens (canvas/card/ink/muted) so light mode
// renders light and dark mode renders black. The sample previews are
// deliberately theme-independent: fixed warm paper with near-black
// content in both modes, with no dark: overrides anywhere inside.
// Each Bar carries exactly one background class — stacking two bg-*
// utilities on one element resolves unpredictably.
//
// The previews are pure CSS skeletons with generic words and zeros
// only — no names, addresses, or real figures anywhere. They are
// labeled as samples and the section states they are illustrative,
// not user submissions, and not verified by OpporCheck. Paper content
// starts below the overlaid sample badge (pt-10) so nothing overlaps.

"use client";

import Link from "next/link";
import GetStartedLink from "@/components/GetStartedLink";
import HeroComposition from "@/components/HeroComposition";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { SpotBook, SpotCheck, SpotDocLens, SpotInfo, SpotShield, SpotText, SpotUpload } from "@/components/spot";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

function Bar({ className }: { className: string }) {
  return <div aria-hidden className={`rounded-full ${className}`} />;
}

function ReceiptPreview() {
  return (
    <div className="flex h-full flex-col items-center bg-[#f6f2e9] px-6 pt-10 pb-5 [color-scheme:light]">
      <Bar className="h-2 w-16 bg-zinc-900" />
      <Bar className="mt-2 h-1.5 w-24 bg-zinc-300" />
      <div aria-hidden className="my-3 w-full border-t border-dashed border-zinc-400" />
      <Bar className="h-1.5 w-full bg-zinc-300" />
      <Bar className="mt-1.5 h-1.5 w-full bg-zinc-300" />
      <Bar className="mt-1.5 h-1.5 w-3/4 bg-zinc-300" />
      <div aria-hidden className="my-3 w-full border-t border-dashed border-zinc-400" />
      <p aria-hidden className="text-[10px] font-bold tracking-widest text-zinc-900">
        TOTAL 0.00
      </p>
    </div>
  );
}

function InvoicePreview() {
  return (
    <div className="flex h-full flex-col bg-[#f6f2e9] px-5 pt-10 pb-5 [color-scheme:light]">
      <div className="flex items-center justify-between">
        <Bar className="h-2.5 w-20 bg-zinc-900" />
        <p aria-hidden className="text-[9px] font-bold tracking-widest text-zinc-900">
          № 0000
        </p>
      </div>
      <div aria-hidden className="mt-3 border-t border-zinc-300" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center justify-between border-b border-zinc-200 py-2">
          <Bar className="h-1.5 w-2/3 bg-zinc-300" />
          <Bar className="h-1.5 w-8 bg-zinc-300" />
        </div>
      ))}
      <div className="mt-auto flex items-center justify-between">
        <Bar className="h-1.5 w-12 bg-zinc-300" />
        <Bar className="h-2 w-14 bg-zinc-900" />
      </div>
    </div>
  );
}

function ContractPreview() {
  return (
    <div className="flex h-full flex-col bg-[#f6f2e9] px-5 pt-10 pb-5 [color-scheme:light]">
      <Bar className="h-2.5 w-3/4 bg-zinc-900" />
      <Bar className="mt-2 h-1.5 w-full bg-zinc-300" />
      <Bar className="mt-1.5 h-1.5 w-full bg-zinc-300" />
      <Bar className="mt-1.5 h-1.5 w-5/6 bg-zinc-300" />
      <p aria-hidden className="mt-3 text-[10px] font-bold text-zinc-900">
        § 1
      </p>
      <Bar className="mt-1.5 h-1.5 w-full bg-zinc-300" />
      <Bar className="mt-1.5 h-1.5 w-2/3 bg-zinc-300" />
      <div aria-hidden className="mt-auto w-2/3 border-t-2 border-zinc-500 pt-1">
        <Bar className="h-1 w-16 bg-zinc-300" />
      </div>
    </div>
  );
}

function ListingPreview() {
  return (
    <div className="flex h-full flex-col bg-[#f6f2e9] px-5 pt-10 pb-5 [color-scheme:light]">
      <span
        aria-hidden
        className="inline-flex w-fit rounded-full bg-zinc-900 px-2 py-0.5 text-[9px] font-bold tracking-wide text-white"
      >
        0.00
      </span>
      <Bar className="mt-2 h-2.5 w-full bg-zinc-900" />
      <Bar className="mt-1.5 h-2.5 w-1/2 bg-zinc-900" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="mt-2 flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
          <Bar className="h-1.5 flex-1 bg-zinc-300" />
        </div>
      ))}
      <div aria-hidden className="mt-auto h-7 w-full rounded-md bg-zinc-900" />
    </div>
  );
}

export default function LandingContent() {
  const { language } = useLang();
  const t = getStrings(language);
  const workflow = [
    { n: "01", title: t.landingStep1Title, text: t.landingStep1Text, Art: SpotUpload },
    { n: "02", title: t.landingStep2Title, text: t.landingStep2Text, Art: SpotDocLens },
    { n: "03", title: t.landingStep3Title, text: t.landingStep3Text, Art: SpotBook },
  ];
  const capabilities = [
    { title: t.landingCap1Title, text: t.landingCap1Text, Art: SpotText, chip: "bg-brand-soft text-brand" },
    { title: t.landingCap2Title, text: t.landingCap2Text, Art: SpotDocLens, chip: "bg-warn-soft text-warn" },
    { title: t.landingCap3Title, text: t.landingCap3Text, Art: SpotCheck, chip: "bg-evidence-soft text-evidence" },
    { title: t.landingCap4Title, text: t.landingCap4Text, Art: SpotShield, chip: "bg-ok-soft text-ok" },
  ];
  const samples = [
    { name: t.landingSampleReceipt, focus: t.landingSampleReceiptFocus, Preview: ReceiptPreview },
    { name: t.landingSampleInvoice, focus: t.landingSampleInvoiceFocus, Preview: InvoicePreview },
    { name: t.landingSampleContract, focus: t.landingSampleContractFocus, Preview: ContractPreview },
    { name: t.landingSampleListing, focus: t.landingSampleListingFocus, Preview: ListingPreview },
  ];
  return (
    <div className="-mx-4 -my-10 text-ink sm:-mx-6 lg:-my-14">
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-6 lg:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <Stagger className="mx-auto w-full max-w-3xl text-center lg:mx-0 lg:text-left">
            <StaggerItem>
              <p>
                <span className="inline-flex rounded-full border border-edge bg-card px-3 py-1 text-xs font-semibold tracking-wider text-brand uppercase">
                  {t.wsNavCompare}
                </span>
              </p>
            </StaggerItem>
            <StaggerItem>
              <h1 className="mt-4 text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-navy sm:text-5xl lg:text-6xl">
                {t.landingTitle}
              </h1>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-5 text-lg leading-8 text-muted">
                {t.landingSubtitle}
              </p>
            </StaggerItem>
            <StaggerItem>
              <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                <GetStartedLink className="inline-flex min-h-12 items-center rounded-lg bg-brand px-7 text-base font-medium text-on-action transition-colors hover:bg-brand-strong">
                  {t.landingGetStarted}
                </GetStartedLink>
                <Link
                  href="/how-it-works"
                  className="inline-flex min-h-12 items-center rounded-lg border border-edge px-7 text-base font-medium text-ink transition-colors hover:bg-brand-soft"
                >
                  {t.landingSeeHow}
                </Link>
              </div>
              <p className="mt-3 text-sm leading-6">
                <Link
                  href="/workspace/review"
                  className="font-medium text-brand underline decoration-brand/40 underline-offset-2 transition-colors hover:decoration-brand"
                >
                  {t.landingReviewOneAlt}
                </Link>
              </p>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-5 text-sm leading-6 text-muted" role="note">
                {t.landingHeroNote}
              </p>
            </StaggerItem>
          </Stagger>
          <HeroComposition />
        </div>

        <Reveal className="mt-20">
          <section aria-labelledby="samples">
            <h2
              id="samples"
              className="text-center text-2xl font-semibold tracking-tight text-navy"
            >
              {t.landingSamplesTitle}
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-6 text-muted">
              {t.landingSamplesNote}
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {samples.map(({ name, focus, Preview }) => (
                <li
                  key={name}
                  className="oc-glass oc-lift rounded-xl border border-edge p-4"
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg">
                    <span className="absolute top-2 left-2 z-10 rounded-full border border-edge bg-card px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-brand uppercase">
                      {t.landingSampleBadge}
                    </span>
                    <div aria-hidden className="h-full w-full">
                      <Preview />
                    </div>
                  </div>
                  <p className="mt-3 font-semibold tracking-tight text-ink">{name}</p>
                  <p className="mt-0.5 text-sm leading-6 text-muted">{focus}</p>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>

        <Reveal className="mx-auto mt-20 max-w-3xl">
          <section aria-labelledby="what-is">
            <p
              id="what-is"
              className="text-xs font-semibold tracking-wider text-muted uppercase"
            >
              {t.landingWhatIs}
            </p>
            <p className="mt-2 text-xl leading-8 font-medium tracking-tight text-balance text-navy">
              {t.landingWhatIsText}
            </p>
          </section>
        </Reveal>

        <Reveal className="mx-auto mt-14 max-w-5xl">
          <section aria-labelledby="workflow">
            <h2 id="workflow" className="text-2xl font-semibold tracking-tight text-navy">
              {t.landingWorkflow}
            </h2>
            <p className="mt-2 text-muted">{t.landingWorkflowIntro}</p>
            <ol className="mt-5 grid gap-4 md:grid-cols-3">
              {workflow.map((item) => (
                <li
                  key={item.title}
                  className="oc-glass oc-lift rounded-xl border border-edge p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand"
                    >
                      <item.Art size={18} />
                    </span>
                    <p aria-hidden="true" className="oc-tnum text-sm font-bold text-evidence">
                      {item.n}
                    </p>
                  </div>
                  <h3 className="mt-3 font-semibold tracking-tight text-ink">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{item.text}</p>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        <Reveal className="mx-auto mt-14 max-w-5xl">
          <section aria-labelledby="capabilities">
            <h2 id="capabilities" className="text-2xl font-semibold tracking-tight text-navy">
              {t.landingCapabilities}
            </h2>
            <p className="mt-2 text-muted">{t.landingCapabilitiesIntro}</p>
            <dl className="mt-4 grid gap-x-10 md:grid-cols-2">
              {capabilities.map((item) => (
                <div key={item.title} className="flex gap-3 border-t border-edge py-4">
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.chip}`}
                  >
                    <item.Art size={18} />
                  </span>
                  <div className="min-w-0">
                    <dt className="font-semibold text-ink">{item.title}</dt>
                    <dd className="mt-1 text-sm leading-6 text-muted">{item.text}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>
        </Reveal>

        <Reveal className="mx-auto mt-14 max-w-3xl">
          <section aria-labelledby="transparency">
            <h2 id="transparency" className="text-2xl font-semibold tracking-tight text-navy">
              {t.landingTransparency}
            </h2>
            <div className="mt-4 leading-7 text-ink">
              <p>{t.landingTransparencyText}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {[t.landingLimit1, t.landingLimit2, t.landingLimit3].map((limit) => (
                  <li key={limit.slice(0, 24)} className="flex items-start gap-2.5">
                    <span aria-hidden className="mt-1.5 shrink-0 text-evidence">
                      <SpotInfo size={16} />
                    </span>
                    <span>{limit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </Reveal>

        <Reveal className="mx-auto mt-16 max-w-3xl text-center">
          <section aria-labelledby="closing">
            <h2
              id="closing"
              className="text-2xl font-semibold tracking-tight text-balance text-navy"
            >
              {t.landingClosingTitle}
            </h2>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <GetStartedLink className="inline-flex min-h-12 items-center rounded-lg bg-brand px-7 text-base font-medium text-on-action transition-colors hover:bg-brand-strong">
                {t.landingGetStarted}
              </GetStartedLink>
              <Link
                href="/how-it-works"
                className="inline-flex min-h-12 items-center rounded-lg border border-edge px-7 text-base font-medium text-ink transition-colors hover:bg-brand-soft"
              >
                {t.landingHowItWorks}
              </Link>
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
