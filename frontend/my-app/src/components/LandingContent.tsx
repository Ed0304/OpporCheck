// Landing page: centered welcome with a clear primary action and
// fictional sample documents below. Client component so copy follows
// the UI language preference; the server page keeps its metadata
// export and renders this.
//
// Page chrome uses theme tokens (canvas/card/ink/muted) so light mode
// renders light and dark mode renders black. The sample previews are
// deliberately theme-independent: fixed white paper with near-black
// content in both modes, with no dark: overrides anywhere inside.
// Each Bar carries exactly one background class — stacking two bg-*
// utilities on one element resolves unpredictably.
//
// The previews are pure CSS skeletons with generic words and zeros
// only — no names, addresses, or real figures anywhere. They are
// labeled as samples and the section states they are illustrative,
// not user submissions, and not verified by OpporCheck.

"use client";

import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { getConciseNotice } from "@/lib/disclaimer";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

function Bar({ className }: { className: string }) {
  return <div aria-hidden className={`rounded-full ${className}`} />;
}

function ReceiptPreview() {
  return (
    <div className="flex h-full flex-col items-center bg-white px-6 py-5 [color-scheme:light]">
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
    <div className="flex h-full flex-col bg-white px-5 py-5 [color-scheme:light]">
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
    <div className="flex h-full flex-col bg-white px-5 py-5 [color-scheme:light]">
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
    <div className="flex h-full flex-col bg-white px-5 py-5 [color-scheme:light]">
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
  const { user } = useAuth();
  const t = getStrings(language);
  // Signed-in visitors go straight to the desk; everyone else starts
  // with registration. Both destinations already exist and behave as
  // before — this only picks the sensible one.
  const primaryHref = user ? "/workspace/review" : "/register";
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
  const samples = [
    { name: t.landingSampleReceipt, focus: t.landingSampleReceiptFocus, Preview: ReceiptPreview },
    { name: t.landingSampleInvoice, focus: t.landingSampleInvoiceFocus, Preview: InvoicePreview },
    { name: t.landingSampleContract, focus: t.landingSampleContractFocus, Preview: ContractPreview },
    { name: t.landingSampleListing, focus: t.landingSampleListingFocus, Preview: ListingPreview },
  ];
  return (
    <div className="-mx-4 -my-10 bg-canvas text-ink sm:-mx-6 lg:-my-14">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 lg:pt-24">
        <Stagger className="mx-auto max-w-3xl text-center">
          <StaggerItem>
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-navy sm:text-5xl lg:text-6xl">
              {t.landingTitle}
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted">
              {t.landingSubtitle}
            </p>
          </StaggerItem>
          <StaggerItem>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={primaryHref}
                className="inline-flex min-h-12 items-center rounded-lg bg-brand px-7 text-base font-medium text-on-action transition-colors hover:bg-brand-strong"
              >
                {t.landingGetStarted}
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex min-h-12 items-center rounded-lg border border-edge px-7 text-base font-medium text-ink transition-colors hover:bg-brand-soft"
              >
                {t.landingHowItWorks}
              </Link>
            </div>
          </StaggerItem>
          <StaggerItem>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-muted" role="note">
              {getConciseNotice(language)}
            </p>
          </StaggerItem>
        </Stagger>

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
                  className="oc-shadow-card rounded-xl border border-edge bg-card p-4"
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg">
                    <span className="absolute top-2 left-2 z-10 rounded-full bg-black/85 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase">
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
            <ol className="mt-5 grid gap-4 md:grid-cols-3">
              {workflow.map((item) => (
                <li
                  key={item.title}
                  className="oc-shadow-card rounded-xl border border-edge bg-card p-5"
                >
                  <p aria-hidden="true" className="oc-tnum text-sm font-bold text-evidence">
                    {item.n}
                  </p>
                  <h3 className="mt-2 font-semibold tracking-tight text-ink">{item.title}</h3>
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
            <dl className="mt-4 grid gap-x-10 md:grid-cols-2">
              {capabilities.map((item) => (
                <div key={item.title} className="border-t border-edge py-4">
                  <dt className="font-semibold text-ink">{item.title}</dt>
                  <dd className="mt-1 text-sm leading-6 text-muted">{item.text}</dd>
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
            <div className="mt-4 leading-7 text-muted">
              <p>{t.landingTransparencyText}</p>
              <ul className="mt-2 list-disc pl-5">
                <li>{t.landingLimit1}</li>
                <li>{t.landingLimit2}</li>
                <li>{t.landingLimit3}</li>
              </ul>
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
