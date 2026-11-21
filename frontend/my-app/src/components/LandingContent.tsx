// Landing page: dark, centered, desktop-first welcome with a clear
// primary action and fictional sample documents below. Client component
// so copy follows the UI language preference; the server page keeps its
// metadata export and renders this.
//
// The sample previews are pure CSS skeletons with generic words and
// zeros only — no names, addresses, or real figures anywhere. They are
// labeled as samples and the section states they are illustrative,
// not user submissions, and not verified by OpporCheck.

"use client";

import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { getConciseNotice } from "@/lib/disclaimer";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

function Bar({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-full bg-zinc-200 ${className}`} />;
}

function ReceiptPreview() {
  return (
    <div className="flex h-full flex-col items-center bg-white px-6 py-5">
      <Bar className="h-2 w-16 bg-zinc-300" />
      <Bar className="mt-2 h-1.5 w-24" />
      <div aria-hidden className="my-3 w-full border-t border-dashed border-zinc-300" />
      <Bar className="h-1.5 w-full" />
      <Bar className="mt-1.5 h-1.5 w-full" />
      <Bar className="mt-1.5 h-1.5 w-3/4" />
      <div aria-hidden className="my-3 w-full border-t border-dashed border-zinc-300" />
      <p aria-hidden className="text-[10px] font-bold tracking-widest text-zinc-400">
        TOTAL 0.00
      </p>
    </div>
  );
}

function InvoicePreview() {
  return (
    <div className="flex h-full flex-col bg-white px-5 py-5">
      <div className="flex items-center justify-between">
        <Bar className="h-2.5 w-20 bg-zinc-800" />
        <p aria-hidden className="text-[9px] font-bold tracking-widest text-zinc-400">
          № 0000
        </p>
      </div>
      <div aria-hidden className="mt-3 border-t border-zinc-200" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center justify-between border-b border-zinc-100 py-2">
          <Bar className="h-1.5 w-2/3" />
          <Bar className="h-1.5 w-8" />
        </div>
      ))}
      <div className="mt-auto flex items-center justify-between">
        <Bar className="h-1.5 w-12" />
        <Bar className="h-2 w-14 bg-zinc-800" />
      </div>
    </div>
  );
}

function ContractPreview() {
  return (
    <div className="flex h-full flex-col bg-white px-5 py-5">
      <Bar className="h-2.5 w-3/4 bg-zinc-800" />
      <Bar className="mt-2 h-1.5 w-full" />
      <Bar className="mt-1.5 h-1.5 w-full" />
      <Bar className="mt-1.5 h-1.5 w-5/6" />
      <p aria-hidden className="mt-3 text-[10px] font-bold text-zinc-400">
        § 1
      </p>
      <Bar className="mt-1.5 h-1.5 w-full" />
      <Bar className="mt-1.5 h-1.5 w-2/3" />
      <div aria-hidden className="mt-auto w-2/3 border-t-2 border-zinc-300 pt-1">
        <Bar className="h-1 w-16" />
      </div>
    </div>
  );
}

function ListingPreview() {
  return (
    <div className="flex h-full flex-col bg-white px-5 py-5">
      <span
        aria-hidden
        className="inline-flex w-fit rounded-full bg-teal-100 px-2 py-0.5 text-[9px] font-bold tracking-wide text-teal-800"
      >
        0.00
      </span>
      <Bar className="mt-2 h-2.5 w-full bg-zinc-800" />
      <Bar className="mt-1.5 h-2.5 w-1/2 bg-zinc-800" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="mt-2 flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
          <Bar className="h-1.5 flex-1" />
        </div>
      ))}
      <div aria-hidden className="mt-auto h-7 w-full rounded-md bg-zinc-800" />
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
    <div className="-mx-4 -my-10 bg-zinc-950 text-zinc-200 sm:-mx-6 lg:-my-14">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 lg:pt-24">
        <Stagger className="mx-auto max-w-3xl text-center">
          <StaggerItem>
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
              {t.landingTitle}
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
              {t.landingSubtitle}
            </p>
          </StaggerItem>
          <StaggerItem>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={primaryHref}
                className="inline-flex min-h-12 items-center rounded-lg bg-white px-7 text-base font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
              >
                {t.landingGetStarted}
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex min-h-12 items-center rounded-lg border border-white/15 px-7 text-base font-medium text-white transition-colors hover:bg-white/10"
              >
                {t.landingHowItWorks}
              </Link>
            </div>
          </StaggerItem>
          <StaggerItem>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-zinc-500" role="note">
              {getConciseNotice(language)}
            </p>
          </StaggerItem>
        </Stagger>

        <Reveal className="mt-20">
          <section aria-labelledby="samples">
            <h2
              id="samples"
              className="text-center text-2xl font-semibold tracking-tight text-white"
            >
              {t.landingSamplesTitle}
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-6 text-zinc-500">
              {t.landingSamplesNote}
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {samples.map(({ name, focus, Preview }) => (
                <li
                  key={name}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg">
                    <span className="absolute top-2 left-2 z-10 rounded-full bg-zinc-950/85 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase">
                      {t.landingSampleBadge}
                    </span>
                    <div aria-hidden className="h-full w-full">
                      <Preview />
                    </div>
                  </div>
                  <p className="mt-3 font-semibold tracking-tight text-white">{name}</p>
                  <p className="mt-0.5 text-sm leading-6 text-zinc-400">{focus}</p>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>

        <Reveal className="mx-auto mt-20 max-w-3xl">
          <section aria-labelledby="what-is">
            <p
              id="what-is"
              className="text-xs font-semibold tracking-wider text-zinc-500 uppercase"
            >
              {t.landingWhatIs}
            </p>
            <p className="mt-2 text-xl leading-8 font-medium tracking-tight text-balance text-white">
              {t.landingWhatIsText}
            </p>
          </section>
        </Reveal>

        <Reveal className="mx-auto mt-14 max-w-5xl">
          <section aria-labelledby="workflow">
            <h2 id="workflow" className="text-2xl font-semibold tracking-tight text-white">
              {t.landingWorkflow}
            </h2>
            <ol className="mt-5 grid gap-4 md:grid-cols-3">
              {workflow.map((item) => (
                <li
                  key={item.title}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-5"
                >
                  <p aria-hidden="true" className="oc-tnum text-sm font-bold text-teal-300">
                    {item.n}
                  </p>
                  <h3 className="mt-2 font-semibold tracking-tight text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">{item.text}</p>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        <Reveal className="mx-auto mt-14 max-w-5xl">
          <section aria-labelledby="capabilities">
            <h2 id="capabilities" className="text-2xl font-semibold tracking-tight text-white">
              {t.landingCapabilities}
            </h2>
            <dl className="mt-4 grid gap-x-10 md:grid-cols-2">
              {capabilities.map((item) => (
                <div key={item.title} className="border-t border-white/10 py-4">
                  <dt className="font-semibold text-white">{item.title}</dt>
                  <dd className="mt-1 text-sm leading-6 text-zinc-400">{item.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        </Reveal>

        <Reveal className="mx-auto mt-14 max-w-3xl">
          <section aria-labelledby="transparency">
            <h2 id="transparency" className="text-2xl font-semibold tracking-tight text-white">
              {t.landingTransparency}
            </h2>
            <div className="mt-4 leading-7 text-zinc-400">
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
