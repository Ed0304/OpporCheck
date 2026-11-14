"use client";

// Individual investigation report: summary first, then the full review,
// the original posting, and official-source findings when present.
// Findings render only from stored data — nothing is invented here.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AnalysisResults from "@/components/AnalysisResults";
import { Button, Card, Spinner, StatusLabel } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getFirebaseClient } from "@/lib/firebaseClient";
import {
  getInvestigation,
  getInvestigationsDb,
  setInvestigationStatus,
  type Investigation,
  type InvestigationFinding,
} from "@/lib/investigations";

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AssessmentLabel({ value }: { value: string }) {
  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "supported") {
    return <StatusLabel tone="ok">Supported by source</StatusLabel>;
  }
  if (normalized === "conflicting") {
    return <StatusLabel tone="bad">Conflicts with source</StatusLabel>;
  }
  return <StatusLabel tone="warn">Insufficient evidence</StatusLabel>;
}

function FindingCard({ finding }: { finding: InvestigationFinding }) {
  return (
    <li className="rounded-md border border-edge p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{finding.claim}</p>
        <AssessmentLabel value={finding.assessment} />
      </div>
      <blockquote className="mt-2 border-l-2 border-edge pl-3 text-sm italic leading-6">
        &ldquo;{finding.excerpt}&rdquo;
      </blockquote>
      <p className="mt-2 text-sm">
        Source:{" "}
        <a
          href={finding.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
        >
          {finding.source_title} (opens in a new tab)
        </a>
      </p>
      <p className="mt-1 text-xs text-muted">Retrieved: {finding.retrieved_at}</p>
      <p className="mt-2 text-sm leading-6">{finding.explanation}</p>
      <p className="mt-2 text-sm leading-6">
        <span className="font-semibold">Follow-up question: </span>
        {finding.follow_up_question}
      </p>
    </li>
  );
}

export default function InvestigationReportPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [item, setItem] = useState<Investigation | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const db = getInvestigationsDb(getFirebaseClient().app);
      const loaded = await getInvestigation(db, params.id);
      if (cancelled) {
        return;
      }
      if (!loaded.ok) {
        setPhase("error");
        setMessage(loaded.message);
      } else if (!loaded.value) {
        setPhase("error");
        setMessage("This investigation doesn't exist or was deleted.");
      } else if (loaded.value.ownerId !== user.uid) {
        setPhase("error");
        setMessage("This investigation belongs to a different account.");
      } else {
        setItem(loaded.value);
        setPhase("ready");
      }
    })().catch((err: unknown) => {
      if (!cancelled) {
        setPhase("error");
        setMessage(err instanceof Error ? err.message : String(err));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user, params.id]);

  const markComplete = async () => {
    if (!user || !item || updating) {
      return;
    }
    setUpdating(true);
    try {
      const db = getInvestigationsDb(getFirebaseClient().app);
      const updated = await setInvestigationStatus(db, item.id, "complete");
      if (updated.ok) {
        setItem({ ...item, status: "complete" });
      } else {
        setMessage(updated.message);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdating(false);
    }
  };

  if (phase === "loading") {
    return <Spinner label="Loading investigation…" />;
  }

  if (phase === "error" || !item) {
    return (
      <Card title="Investigation unavailable">
        <p className="text-sm leading-6" role="alert">
          {message ?? "Something went wrong."}
        </p>
        <p className="mt-3 text-sm">
          <Link href="/workspace/investigations" className="text-brand underline">
            Back to investigations
          </Link>
        </p>
      </Card>
    );
  }

  const findings = item.findings ?? [];
  const report = item.report;
  const concerns = report?.concerns ?? [];
  const missing = report?.missing_information ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm">
          <Link href="/workspace/investigations" className="text-brand underline">
            ← All investigations
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{item.title}</h1>
          <StatusLabel tone={item.status === "complete" ? "ok" : "info"}>
            {item.status === "complete" ? "Complete" : "Reviewed"}
          </StatusLabel>
        </div>
        <p className="mt-1 text-sm text-muted">
          {report?.destination_country ?? "Unknown country"} · Reviewed{" "}
          {formatDateTime(item.createdAt)} · Updated {formatDateTime(item.updatedAt)}
        </p>
        {item.status !== "complete" && (
          <div className="mt-3">
            <Button variant="secondary" onClick={() => void markComplete()} disabled={updating}>
              {updating ? "Updating…" : "Mark complete"}
            </Button>
          </div>
        )}
        {message && (
          <p className="mt-2 text-sm" role="alert">
            {message}
          </p>
        )}
      </div>

      {!report ? (
        <Card title="Review unavailable">
          <p className="text-sm leading-6" role="alert">
            This investigation&apos;s saved review data couldn&apos;t be read because it
            doesn&apos;t match the expected format. The original posting text below is
            still available.
          </p>
        </Card>
      ) : (
        <>
          <Card title="Summary">
            <p className="leading-7">
              {report.occupation} ({report.employment_type}) in {report.destination_country}.{" "}
              {concerns.length} potential concern
              {concerns.length === 1 ? "" : "s"}, {missing.length} missing detail
              {missing.length === 1 ? "" : "s"}
              {findings.length > 0
                ? `, ${findings.length} official-source finding${findings.length === 1 ? "" : "s"}.`
                : " recorded."}
            </p>
          </Card>

          <Card title="Review details">
            <AnalysisResults report={report} />
          </Card>
        </>
      )}

      <Card title="Official-source findings">
        {findings.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {findings.map((finding, index) => (
              <FindingCard
                key={`${finding.source_url}-${finding.claim}-${index}`}
                finding={finding}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-muted">
            No official-source comparison has been run for this investigation yet.
            Official-source retrieval is planned but not connected — nothing here is
            checked against external sources.
          </p>
        )}
      </Card>

      <details className="rounded-lg border border-edge bg-card p-5">
        <summary className="cursor-pointer font-semibold">Original posting text</summary>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-sm leading-6 text-muted">
          {item.postingText}
        </pre>
      </details>
    </div>
  );
}
