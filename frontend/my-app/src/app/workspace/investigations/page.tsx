"use client";

// My investigations: title, destination, dates, status, and open /
// rename / delete actions. Scoped to the signed-in owner.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, Spinner, StatusLabel } from "@/components/ui";
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.invTitle}</h1>
          <p className="mt-1 text-muted">{t.invSubtitle}</p>
        </div>
        <Link
          href="/workspace/review"
          className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-on-action hover:bg-brand-strong"
        >
          {t.invReviewNew}
        </Link>
      </div>

      <Card>
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
                className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-on-action hover:bg-brand-strong"
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
          <ul className="divide-y divide-edge">
            {items.map((item) => (
              <li key={item.id} className="py-3">
                {renamingId === item.id ? (
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
                    <Button type="submit" disabled={busyId === item.id}>
                      {t.commonSave}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setRenamingId(null)}
                    >
                      {t.commonCancel}
                    </Button>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Link
                      href={`/workspace/investigations/${item.id}`}
                      className="min-w-44 flex-1 font-medium hover:underline"
                    >
                      {item.title}
                    </Link>
                    <span className="text-sm text-muted">{item.report?.destination_country ?? t.commonUnknownCountry}</span>
                    <StatusLabel tone={item.status === "complete" ? "ok" : "info"}>
                      {item.status === "complete" ? t.commonStatusComplete : t.commonStatusReviewed}
                    </StatusLabel>
                    <span className="text-sm text-muted" title={t.invLastUpdatedTitle}>
                      {formatDate(t, item.updatedAt ?? item.createdAt, item.report?.destination_country)}
                    </span>
                    <span className="flex gap-1 text-sm">
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
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
