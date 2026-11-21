"use client";

// Workspace overview: welcome, review action, recent investigations,
// and a short explanation. Plain-language UI: no model IDs, inference
// modes, raw JSON, or latency figures here.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, EmptyState, Spinner, StatusLabel } from "@/components/ui";
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

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.ovWelcome}{displayName ? `, ${displayName}` : ""}</h1>
        <p className="mt-1 max-w-2xl leading-6 text-muted">
          {t.ovIntro}
        </p>
        <div className="mt-4">
          <Link
            href="/workspace/review"
            className="inline-flex h-11 items-center rounded-md bg-brand px-6 text-base font-medium text-on-action hover:bg-brand-strong"
          >
            {t.ovReviewCta}
          </Link>
        </div>
      </div>

      <Card
        title={t.ovRecent}
        actions={
          <Link href="/workspace/investigations" className="text-sm font-medium text-brand underline">
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
                className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-on-action hover:bg-brand-strong"
              >
                {t.ovReviewCta}
              </Link>
            }
          />
        )}
        {recent.items.length > 0 && (
          <ul className="divide-y divide-edge">
            {recent.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/workspace/investigations/${item.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5"
                >
                  <span className="min-w-44 flex-1 font-medium">{item.title}</span>
                  <span className="text-sm text-muted">{item.report?.destination_country ?? t.commonUnknownCountry}</span>
                  <StatusLabel tone={item.status === "complete" ? "ok" : "info"}>
                    {item.status === "complete" ? t.commonStatusComplete : t.commonStatusReviewed}
                  </StatusLabel>
                  <span className="text-sm text-muted">{formatDate(t, item.createdAt, item.report?.destination_country)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
