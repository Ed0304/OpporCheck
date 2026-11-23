"use client";

// My investigations: title, destination, dates, status, and open /
// rename / delete actions. Scoped to the signed-in owner.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHeader, Spinner, StatusLabel, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { localeForCountryName } from "@/lib/corridors";
import { getFirebaseClient } from "@/lib/firebaseClient";
import { useLang } from "@/lib/lang";
import { getStrings, type UiStrings } from "@/lib/strings";
import {
  deleteInvestigation,
  getInvestigationsDb,
  listUserInvestigations,
  renameInvestigation,
  type Investigation,
} from "@/lib/investigations";

function formatDate(t: UiStrings, iso: string | null, country?: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleDateString(localeForCountryName(country), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function InvestigationsPage() {
  const { user } = useAuth();
  const { language } = useLang();
  const t = getStrings(language);
  const [items, setItems] = useState<Investigation[]>([]);
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
      const listed = await listUserInvestigations(db, user.uid, 50);
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
      const listed = await listUserInvestigations(db, user.uid, 50);
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
      const renamed = await renameInvestigation(db, id, renameValue);
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
      const deleted = await deleteInvestigation(db, id);
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
        title={t.invTitle}
        description={t.invSubtitle}
        actions={
          <Link
            href="/workspace/review"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 text-sm font-medium text-on-action shadow-sm transition-colors hover:bg-brand-strong"
          >
            {t.invReviewNew}
          </Link>
        }
      />

      <Card flush={items.length > 0}>
        {phase === "loading" && <Spinner label={t.ovLoading} />}
        {phase === "error" && (
          <p className="text-sm leading-6" role="alert">
            <span className="font-semibold">{t.ovLoadFailed}</span> {message}
          </p>
        )}
        {phase === "ready" && items.length === 0 && (
          <EmptyState
            title={t.ovEmptyTitle}
            description={t.invEmptyDesc}
            action={
              <Link
                href="/workspace/review"
                className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-on-action hover:bg-brand-strong"
              >
                {t.ovReviewCta}
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
          <Table label={t.invTitle}>
            <THead>
              <TH>{t.tblInvestigation}</TH>
              <TH>{t.anCountry}</TH>
              <TH>{t.tblStatus}</TH>
              <TH>{t.invLastUpdatedTitle}</TH>
              <TH>{t.tblActions}</TH>
            </THead>
            <TBody>
              {items.map((item) => (
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
                        href={`/workspace/investigations/${item.id}`}
                        className="text-ink underline decoration-edge underline-offset-2 hover:decoration-brand"
                      >
                        {item.title}
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap text-muted">
                      {item.report?.destination_country ?? t.commonUnknownCountry}
                    </TD>
                    <TD>
                      <StatusLabel tone={item.status === "complete" ? "ok" : "info"}>
                        {item.status === "complete" ? t.commonStatusComplete : t.commonStatusReviewed}
                      </StatusLabel>
                    </TD>
                    <TD className="oc-tnum whitespace-nowrap text-muted">
                      {formatDate(t, item.updatedAt ?? item.createdAt, item.report?.destination_country)}
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
                              className="cursor-pointer rounded px-2 py-1 font-medium text-danger hover:underline disabled:opacity-50"
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
                            className="cursor-pointer rounded px-2 py-1 font-medium text-danger hover:underline"
                          >
                            {t.invDelete}
                          </button>
                        )}
                      </span>
                    </TD>
                  </TR>
                )
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
