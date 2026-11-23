"use client";

// Individual comparison report: the stored Promise-to-Paper findings
// with their quoted evidence, plus rename and delete actions. Everything
// renders from stored data — page text itself was never persisted.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CompareReport, { type ReportDocument } from "@/components/CompareReport";
import { Button, Card, PageHeader, Spinner, Stat, StatGrid } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import {
  deleteComparisonReport,
  getComparisonReport,
  renameComparisonReport,
  type SavedComparisonReport,
} from "@/lib/comparisons";
import { localeForCountryName } from "@/lib/corridors";
import { getFirebaseClient } from "@/lib/firebaseClient";
import { getInvestigationsDb } from "@/lib/investigations";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleString(localeForCountryName(null), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ComparisonReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLang();
  const t = getStrings(language);
  const [item, setItem] = useState<SavedComparisonReport | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const db = getInvestigationsDb(getFirebaseClient().app);
      const loaded = await getComparisonReport(db, params.id);
      if (cancelled) {
        return;
      }
      if (!loaded.ok) {
        setPhase("error");
        setMessage(loaded.message);
      } else if (!loaded.value) {
        setPhase("error");
        setMessage(t.cmpdNotExist);
      } else if (loaded.value.ownerId !== user.uid) {
        setPhase("error");
        setMessage(t.cmpdOtherAccount);
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

  const handleRename = async () => {
    if (!user || !item || busy) {
      return;
    }
    if (renameValue.trim() === "") {
      setMessage(t.invTitleEmpty);
      return;
    }
    setBusy(true);
    try {
      const db = getInvestigationsDb(getFirebaseClient().app);
      const renamed = await renameComparisonReport(db, item.id, renameValue);
      if (renamed.ok) {
        setItem({ ...item, title: renameValue.trim() });
        setRenaming(false);
        setMessage(null);
      } else {
        setMessage(renamed.message);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !item || busy) {
      return;
    }
    setBusy(true);
    try {
      const db = getInvestigationsDb(getFirebaseClient().app);
      const deleted = await deleteComparisonReport(db, item.id);
      if (deleted.ok) {
        router.push("/workspace/comparisons");
      } else {
        setMessage(deleted.message);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (phase === "loading") {
    return <Spinner label={t.cmpdLoading} />;
  }

  if (phase === "error" || !item) {
    return (
      <Card title={t.cmpdUnavailable}>
        <p className="text-sm leading-6" role="alert">
          {message ?? t.cmpdNotExist}
        </p>
        <p className="mt-3 text-sm">
          <Link href="/workspace/comparisons" className="text-brand underline">
            {t.cmpdBack}
          </Link>
        </p>
      </Card>
    );
  }

  const reportDocs: ReportDocument[] = item.documents.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    documentType: doc.documentType,
    source: doc.source,
    pageCount: doc.pageCount,
    wasTrimmed: doc.wasTrimmed,
    termCount: doc.termCount,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm">
          <Link href="/workspace/comparisons" className="font-medium text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand">
            {t.cmpdAll}
          </Link>
        </p>
        <div className="mt-2">
          <PageHeader
            eyebrow={t.cmpRepTitle}
            title={item.title}
            description={`${t.cmpdComparedOn} ${formatDateTime(item.createdAt)} · ${t.cmpdUpdatedOn} ${formatDateTime(item.updatedAt)}`}
            actions={
              <>
                {renaming ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleRename();
                    }}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <label htmlFor="comparison-rename" className="sr-only">
                      {t.invNewTitleAria}
                    </label>
                    <input
                      id="comparison-rename"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      maxLength={120}
                      className="h-9 min-w-52 flex-1 rounded-md border border-edge bg-card px-3 text-sm"
                      autoFocus
                    />
                    <Button type="submit" size="sm" disabled={busy}>
                      {t.commonSave}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setRenaming(false)}
                    >
                      {t.commonCancel}
                    </Button>
                  </form>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRenaming(true);
                      setRenameValue(item.title);
                      setConfirmingDelete(false);
                    }}
                  >
                    {t.invRename}
                  </Button>
                )}
                {confirmingDelete ? (
                  <span className="flex gap-1 text-sm whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      disabled={busy}
                      className="cursor-pointer rounded px-2 py-1 font-medium text-danger hover:underline disabled:opacity-50"
                    >
                      {t.invConfirmDelete}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="cursor-pointer rounded px-2 py-1 text-muted hover:underline"
                    >
                      {t.commonCancel}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(true);
                      setRenaming(false);
                    }}
                    className="cursor-pointer rounded px-2 py-1 text-sm font-medium text-danger hover:underline"
                  >
                    {t.invDelete}
                  </button>
                )}
              </>
            }
          />
        </div>
        {message && (
          <p className="mt-2 text-sm" role="alert">
            {message}
          </p>
        )}
      </div>

      <StatGrid>
        <Stat label={t.cmpLibDocs}>{reportDocs.length}</Stat>
        <Stat label={t.cmpLibFindings}>{item.findings.length}</Stat>
      </StatGrid>

      <Card title={t.cmpRepTitle}>
        <CompareReport
          documents={reportDocs}
          findings={item.findings}
          droppedCount={item.droppedCount}
          // Stored reports keep only the dropped count, not the issue lines.
          droppedIssues={[]}
          limitations={item.limitations}
        />
      </Card>
    </div>
  );
}
