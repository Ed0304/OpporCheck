"use client";

// Workspace overview: welcome, review action, recent investigations,
// and a short explanation. Plain-language UI: no model IDs, inference
// modes, raw JSON, or latency figures here.

import Link from "next/link";
import { useEffect, useState } from "react";
import { SpotBook, SpotCompare, SpotDocLens } from "@/components/spot";
import {
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  StatusLabel,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { localeForCountryName } from "@/lib/corridors";
import { getFirebaseClient, probeFirebaseConfig } from "@/lib/firebaseClient";
import { useLang } from "@/lib/lang";
import { format, getStrings, type UiStrings } from "@/lib/strings";
import {
  getInvestigationsDb,
  listUserInvestigations,
  type Investigation,
} from "@/lib/investigations";

interface RecentState {
  phase: "idle" | "loading" | "ready" | "error";
  items: Investigation[];
  message: string | null;
}

function formatDate(t: UiStrings, iso: string | null, country?: string | null): string {
  if (!iso) {
    return t.commonJustNow;
  }
  return new Date(iso).toLocaleDateString(localeForCountryName(country), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function WorkspaceOverviewPage() {
  const { user } = useAuth();
  const { language } = useLang();
  const t = getStrings(language);
  const [envProbe] = useState(() => probeFirebaseConfig());
  const configOk = envProbe.missingConfigKeys.length === 0;
  const [recent, setRecent] = useState<RecentState>({ phase: "loading", items: [], message: null });

  useEffect(() => {
    if (!user || !configOk) {
      return;
    }
    let cancelled = false;
    // All state updates happen in async continuations, never synchronously.
    void (async () => {
      const db = getInvestigationsDb(getFirebaseClient().app);
      const listed = await listUserInvestigations(db, user.uid, 5);
      if (cancelled) {
        return;
      }
      if (listed.ok) {
        setRecent({ phase: "ready", items: listed.value, message: null });
      } else {
        setRecent({ phase: "error", items: [], message: listed.message });
      }
    })().catch((err: unknown) => {
      if (!cancelled) {
        setRecent({
          phase: "error",
          items: [],
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user, configOk]);

  const displayName = user?.displayName || user?.email || null;

  // Title-only actions: the page subtitles they used to repeat already
  // appear on their own pages, and the sidebar covers navigation. The
  // comparison action is visually primary to match the header CTA.
  const quickActions = [
    { href: "/workspace/compare", title: t.wsNavCompare, primary: true, Art: SpotCompare },
    { href: "/workspace/review", title: t.wsNavReview, primary: false, Art: SpotDocLens },
    { href: "/workspace/resources", title: t.wsNavResources, primary: false, Art: SpotBook },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t.wsSidebarAria}
        title={`${t.ovWelcome}${displayName ? `, ${displayName}` : ""}`}
        description={t.ovIntro}
        actions={
          <Link
            href="/workspace/compare"
            className="inline-flex min-h-12 items-center rounded-lg bg-brand px-6 text-base font-medium text-on-action shadow-sm transition-colors duration-200 ease-out hover:bg-brand-strong"
          >
            {t.ovCompareCta}
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            aria-label={action.title}
            className={`oc-glass oc-lift group flex items-center gap-4 rounded-xl border p-5 ${
              action.primary
                ? "border-brand/50"
                : "border-edge"
            }`}
          >
            <span
              aria-hidden
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                action.primary ? "bg-brand text-on-action" : "bg-brand-soft text-brand"
              }`}
            >
              <action.Art />
            </span>
            <span className="min-w-0 font-semibold tracking-tight">
              {action.title}{" "}
              <span
                aria-hidden
                className="inline-block text-muted transition-transform duration-150 ease-out group-hover:translate-x-0.5"
              >
                →
              </span>
            </span>
          </Link>
        ))}
      </div>

      <Card
        eyebrow={t.wsNavInvestigations}
        title={t.ovRecent}
        flush={recent.items.length > 0}
        actions={
          <Link href="/workspace/investigations" className="text-sm font-medium text-brand underline transition-colors duration-150 ease-out hover:text-brand-strong">
            {t.ovViewAll}
          </Link>
        }
      >
        {!configOk && (
          <p className="text-sm leading-6">
            {format(t.commonSetupMissing, { keys: envProbe.missingConfigKeys.join(", ") })}{" "}
            {t.commonSetupFillEnv}
          </p>
        )}
        {configOk && recent.phase === "loading" && <Spinner label={t.ovLoading} />}
        {recent.phase === "error" && (
          <p className="text-sm leading-6">
            <span className="font-semibold">{t.ovLoadFailed}</span>{" "}
            {recent.message}
          </p>
        )}
        {recent.phase === "ready" && recent.items.length === 0 && (
          <EmptyState
            title={t.ovEmptyTitle}
            description={t.ovEmptyDesc}
            action={
              <Link
                href="/workspace/review"
                className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-on-action transition-colors duration-200 ease-out hover:bg-brand-strong"
              >
                {t.ovReviewCta}
              </Link>
            }
          />
        )}
        {recent.items.length > 0 && (
          <Table label={t.ovRecent}>
            <THead>
              <TH>{t.tblInvestigation}</TH>
              <TH>{t.anCountry}</TH>
              <TH>{t.tblStatus}</TH>
              <TH>{t.invLastUpdatedTitle}</TH>
            </THead>
            <TBody>
              {recent.items.map((item) => (
                <TR key={item.id}>
                  <TD className="font-medium">
                    <Link
                      href={`/workspace/investigations/${item.id}`}
                      className="text-ink underline decoration-edge underline-offset-2 hover:decoration-brand"
                    >
                      {item.title}
                    </Link>
                  </TD>
                  <TD className="text-muted">
                    {item.report?.destination_country ?? t.commonUnknownCountry}
                  </TD>
                  <TD>
                    <StatusLabel tone={item.status === "complete" ? "ok" : "info"}>
                      {item.status === "complete" ? t.commonStatusComplete : t.commonStatusReviewed}
                    </StatusLabel>
                  </TD>
                  <TD className="oc-tnum text-muted">
                    {formatDate(t, item.createdAt, item.report?.destination_country)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
