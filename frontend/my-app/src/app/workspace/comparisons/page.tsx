"use client";

// Saved comparisons: title, document/finding counts, dates, and open /
// rename / delete actions. Scoped to the signed-in owner. Reports render
// from stored data only — page text itself was never persisted.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHeader, Spinner, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import {
  deleteComparisonReport,
  listUserComparisons,
  renameComparisonReport,
  type SavedComparisonReport,
} from "@/lib/comparisons";
import { localeForCountryName } from "@/lib/corridors";
import { getFirebaseClient } from "@/lib/firebaseClient";
import { getInvestigationsDb } from "@/lib/investigations";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  // Comparisons carry no destination country, so dates use the default locale.
  return new Date(iso).toLocaleDateString(localeForCountryName(null), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ComparisonsPage() {
  const { user } = useAuth();
  const { language } = useLang();
  const t = getStrings(language);
  const [items, setItems] = useState<SavedComparisonReport[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      return;
    }
    setPhase("loading");
    setMessage(null);
    try {
      const db = getInvestigationsDb(getFirebaseClient().app);
      const listed = await listUserComparisons(db, user.uid, 50);
      if (listed.ok) {
        setItems(listed.value);
        setPhase("ready");
      } else {
        setPhase("error");
        setMessage(listed.message);
      }
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    // Mount fetch: all state updates in async continuations. Handler
    // refreshes use reload() instead.
    void (async () => {
      const db = getInvestigationsDb(getFirebaseClient().app);
      const listed = await listUserComparisons(db, user.uid, 50);
      if (cancelled) {
        return;
      }
      if (listed.ok) {
        setItems(listed.value);
        setPhase("ready");
      } else {
        setPhase("error");
        setMessage(listed.message);
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
  }, [user]);

  const handleRename = async (id: string) => {
    if (!user) {
      return;
    }
    if (renameValue.trim() === "") {
      setMessage(t.invTitleEmpty);
      return;
    }
    setBusyId(id);
    try {
      const db = getInvestigationsDb(getFirebaseClient().app);
      const renamed = await renameComparisonReport(db, id, renameValue);
      if (renamed.ok) {
        setRenamingId(null);
        await reload();
      } else {
        setMessage(renamed.message);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) {
      return;
    }
    setBusyId(id);
    try {
      const db = getInvestigationsDb(getFirebaseClient().app);
      const deleted = await deleteComparisonReport(db, id);
      if (deleted.ok) {
        setConfirmingDeleteId(null);
        await reload();
      } else {
        setMessage(deleted.message);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t.wsSidebarAria}
        title={t.cmpRepTitle}
        description={t.cmpRepSubtitle}
        actions={
          <Link
            href="/workspace/compare"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 text-sm font-medium text-on-action shadow-sm transition-colors hover:bg-brand-strong"
          >
            {t.cmpRepNew}
          </Link>
        }
      />

      <Card flush={items.length > 0}>
        {phase === "loading" && <Spinner label={t.cmpLibLoading} />}
        {phase === "error" && (
          <p className="text-sm leading-6" role="alert">
            <span className="font-semibold">{t.cmpLibLoadFailed}</span> {message}
          </p>
        )}
        {phase === "ready" && items.length === 0 && (
          <EmptyState
            title={t.cmpRepEmptyTitle}
            description={t.cmpRepEmptyDesc}
            action={
              <Link
                href="/workspace/compare"
                className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-on-action hover:bg-brand-strong"
              >
                {t.cmpRepNew}
              </Link>
            }
          />
        )}
        {message && phase === "ready" && (
          <p className="mb-2 text-sm" role="alert">
            {message}
          </p>
        )}
        {items.length > 0 && (
          <Table label={t.cmpRepTitle}>
            <THead>
              <TH>{t.cmpLibComparison}</TH>
              <TH>{t.cmpLibDocs}</TH>
              <TH>{t.cmpLibFindings}</TH>
              <TH>{t.invLastUpdatedTitle}</TH>
              <TH>{t.tblActions}</TH>
            </THead>
            <TBody>
              {items.map((item) =>
                renamingId === item.id ? (
                  <tr key={item.id}>
                    <td colSpan={5} className="px-6 py-3.5">
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleRename(item.id);
                        }}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <label htmlFor={`rename-${item.id}`} className="sr-only">
                          {t.invNewTitleAria}
                        </label>
                        <input
                          id={`rename-${item.id}`}
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          maxLength={120}
                          className="h-9 min-w-52 flex-1 rounded-md border border-edge bg-card px-3 text-sm"
                          autoFocus
                        />
                        <Button type="submit" size="sm" disabled={busyId === item.id}>
                          {t.commonSave}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setRenamingId(null)}
                        >
                          {t.commonCancel}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <TR key={item.id}>
                    <TD className="font-medium">
                      <Link
                        href={`/workspace/comparisons/${item.id}`}
                        className="text-ink underline decoration-edge underline-offset-2 hover:decoration-brand"
                      >
                        {item.title}
                      </Link>
                    </TD>
                    <TD className="oc-tnum whitespace-nowrap text-muted">
                      {item.documents.length}
                    </TD>
                    <TD className="oc-tnum whitespace-nowrap text-muted">
                      {item.findings.length}
                    </TD>
                    <TD className="oc-tnum whitespace-nowrap text-muted">
                      {formatDate(item.updatedAt ?? item.createdAt)}
                    </TD>
                    <TD>
                      <span className="flex gap-1 text-sm whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(item.id);
                            setRenameValue(item.title);
                            setConfirmingDeleteId(null);
                          }}
                          className="cursor-pointer rounded px-2 py-1 font-medium text-brand hover:underline"
                        >
                          {t.invRename}
                        </button>
                        {confirmingDeleteId === item.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleDelete(item.id)}
                              disabled={busyId === item.id}
                              className="cursor-pointer rounded px-2 py-1 font-medium text-red-700 hover:underline disabled:opacity-50 dark:text-red-300"
                            >
                              {t.invConfirmDelete}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(null)}
                              className="cursor-pointer rounded px-2 py-1 text-muted hover:underline"
                            >
                              {t.commonCancel}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingDeleteId(item.id);
                              setRenamingId(null);
                            }}
                            className="cursor-pointer rounded px-2 py-1 font-medium text-red-700 hover:underline dark:text-red-300"
                          >
                            {t.invDelete}
                          </button>
                        )}
                      </span>
                    </TD>
                  </TR>
                ),
              )}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
