"use client";

// Individual investigation report: summary first, then the full review,
// the original posting, and official-source findings when present.
// Findings render only from stored data — nothing is invented here.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AnalysisResults from "@/components/AnalysisResults";
import EvidenceInvestigation from "@/components/EvidenceInvestigation";
import { Button, Card, EvidenceQuote, Spinner, StatusLabel } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { localeForCountryName } from "@/lib/corridors";
import { getFirebaseClient } from "@/lib/firebaseClient";
import { useLang } from "@/lib/lang";
import {
  getAssessmentLabels,
  ASSESSMENT_TONES,
  type AssessmentTone,
} from "@/lib/reportLanguage";
import { getStrings, type UiStrings } from "@/lib/strings";
import {
  getInvestigation,
  getInvestigationsDb,
  setInvestigationStatus,
  type Investigation,
  type InvestigationFinding,
} from "@/lib/investigations";

function formatDateTime(t: UiStrings, iso: string | null, country?: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleString(localeForCountryName(country), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AssessmentLabel({ value }: { value: string }) {
  const { language } = useLang();
  const labels = getAssessmentLabels(language);
  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  const key =
    normalized === "supported" || normalized === "conflicting"
      ? normalized
      : "insufficient-evidence";
  const tone: AssessmentTone = ASSESSMENT_TONES[key];
  return <StatusLabel tone={tone}>{labels[key]}</StatusLabel>;
}

function FindingCard({ finding }: { finding: InvestigationFinding }) {
  const { language } = useLang();
  const t = getStrings(language);
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{finding.claim}</p>
        <AssessmentLabel value={finding.assessment} />
      </div>
      <EvidenceQuote>&ldquo;{finding.excerpt}&rdquo;</EvidenceQuote>
      <p className="mt-2 text-sm">
        {t.commonSourceLabel}{" "}
        <a
          href={finding.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-evidence underline decoration-evidence/40 underline-offset-2 hover:decoration-evidence"
        >
          {finding.source_title} {t.commonOpenInNewTab}
        </a>
      </p>
      <p className="mt-1 text-xs text-muted">
        {t.commonRetrievedLabel} {finding.retrieved_at}
      </p>
      <p className="mt-2 text-sm leading-6">{finding.explanation}</p>
      <p className="mt-2 text-sm leading-6">
        <span className="font-semibold">{t.commonFollowUpLabel} </span>
        {finding.follow_up_question}
      </p>
    </li>
  );
}

export default function InvestigationReportPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { language } = useLang();
  const t = getStrings(language);
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
        setMessage(t.invdNotExist);
      } else if (loaded.value.ownerId !== user.uid) {
        setPhase("error");
        setMessage(t.invdOtherAccount);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return <Spinner label={t.invdLoading} />;
  }

  if (phase === "error" || !item) {
    return (
      <Card title={t.invdUnavailable}>
        <p className="text-sm leading-6" role="alert">
          {message ?? t.invdFallbackError}
        </p>
        <p className="mt-3 text-sm">
          <Link href="/workspace/investigations" className="text-brand underline">
            {t.invdBack}
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
            {t.invdAll}
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{item.title}</h1>
          <StatusLabel tone={item.status === "complete" ? "ok" : "info"}>
            {item.status === "complete" ? t.commonStatusComplete : t.commonStatusReviewed}
          </StatusLabel>
        </div>
        <p className="mt-1 text-sm text-muted">
          {report?.destination_country ?? t.commonUnknownCountry} · {t.invdReviewedOn}{" "}
          {formatDateTime(t, item.createdAt, report?.destination_country)} · {t.invdUpdatedOn}{" "}
          {formatDateTime(t, item.updatedAt, report?.destination_country)}
        </p>
        {item.status !== "complete" && (
          <div className="mt-3">
            <Button variant="secondary" onClick={() => void markComplete()} disabled={updating}>
              {updating ? t.invdUpdating : t.invdMarkComplete}
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
        <Card title={t.invdReviewUnavailable}>
          <p className="text-sm leading-6" role="alert">
            {t.invdReviewUnreadable}
          </p>
        </Card>
      ) : (
        <>
          <Card title={t.invdSummary}>
            <p className="leading-7">
              {report.occupation} ({report.employment_type}) {t.invdSummaryIn}{" "}
              {report.destination_country}. {concerns.length}{" "}
              {concerns.length === 1 ? t.invdConcernOne : t.invdConcernMany},{" "}
              {missing.length} {missing.length === 1 ? t.invdMissingOne : t.invdMissingMany}
              {findings.length > 0
                ? `, ${findings.length} ${findings.length === 1 ? t.invdFindingOne : t.invdFindingMany}.`
                : ` ${t.invdRecorded}`}
            </p>
          </Card>

          <Card title={t.invdReviewDetails}>
            <AnalysisResults report={report} />
          </Card>
        </>
      )}

      <Card title={t.invdFindingsTitle}>
        {findings.length > 0 ? (
          <ul className="divide-y divide-edge">
            {findings.map((finding, index) => (
              <FindingCard
                key={`${finding.source_url}-${finding.claim}-${index}`}
                finding={finding}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-muted">{t.invdNoFindings}</p>
        )}
      </Card>

      {report && <EvidenceInvestigation report={report} postingText={item.postingText} />}

      <details className="rounded-lg border border-edge bg-card p-5">
        <summary className="cursor-pointer font-semibold">{t.invdOriginalPosting}</summary>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-sm leading-6 text-muted">
          {item.postingText}
        </pre>
      </details>
    </div>
  );
}
