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

function formatDate(iso: string | null, country?: string | null): string {
  if (!iso) {
    return "Just now";
  }
  return new Date(iso).toLocaleDateString(localeForCountryName(country), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function WorkspaceOverviewPage() {
  const { user } = useAuth();
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

  const displayName = user?.displayName || user?.email || "there";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome{displayName ? `, ${displayName}` : ""}</h1>
        <p className="mt-1 max-w-2xl leading-6 text-muted">
          OpporCheck turns a job posting into a structured review — facts, concerns with
          quoted evidence, missing details, and relevant official guidance — saved as an
          investigation you can revisit any time.
        </p>
        <div className="mt-4">
          <Link
            href="/workspace/review"
            className="inline-flex h-11 items-center rounded-md bg-brand px-6 text-base font-medium text-white hover:bg-brand-strong"
          >
            Review an opportunity
          </Link>
        </div>
      </div>

      <Card
        title="Recent investigations"
        actions={
          <Link href="/workspace/investigations" className="text-sm font-medium text-brand underline">
            View all
          </Link>
        }
      >
        {!configOk && (
          <p className="text-sm leading-6">
            Firebase isn&apos;t configured (missing: {envProbe.missingConfigKeys.join(", ")}).
            Fill in <code className="font-mono">.env.local</code> and restart the dev server.
          </p>
        )}
        {configOk && recent.phase === "loading" && <Spinner label="Loading investigations…" />}
        {recent.phase === "error" && (
          <p className="text-sm leading-6">
            <span className="font-semibold">Couldn&apos;t load investigations:</span>{" "}
            {recent.message}
          </p>
        )}
        {recent.phase === "ready" && recent.items.length === 0 && (
          <EmptyState
            title="No investigations yet"
            description="Review your first opportunity to see it here with its facts, concerns, and evidence."
            action={
              <Link
                href="/workspace/review"
                className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong"
              >
                Review an opportunity
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
                  <span className="text-sm text-muted">{item.report?.destination_country ?? "Unknown country"}</span>
                  <StatusLabel tone={item.status === "complete" ? "ok" : "info"}>
                    {item.status === "complete" ? "Complete" : "Reviewed"}
                  </StatusLabel>
                  <span className="text-sm text-muted">{formatDate(item.createdAt, item.report?.destination_country)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
