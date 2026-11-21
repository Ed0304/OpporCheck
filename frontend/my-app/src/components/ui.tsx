// Shared UI primitives: restrained cards, buttons, form fields,
// evidence quotes, and status labels. Status is always text, never
// color alone.

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-action hover:bg-brand-strong",
  secondary: "border border-edge bg-card text-ink hover:bg-brand-soft",
  ghost: "text-ink hover:bg-brand-soft",
  danger:
    "border border-red-300 text-red-700 hover:bg-red-50 " +
    "dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={`rounded-lg border border-edge bg-card p-5 shadow-[0_1px_2px_rgba(23,59,112,0.06)] ${className}`}
    >
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Quoted evidence: document excerpts and retrieved source quotes. */
export function EvidenceQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="mt-2 border-l-2 border-evidence/70 pl-3 text-sm italic leading-6">
      {children}
    </blockquote>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint && !error && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="h-10 w-full rounded-md border border-edge bg-card px-3 text-sm text-ink placeholder:text-muted disabled:opacity-60"
      {...props}
    />
  );
}

export type StatusTone = "ok" | "warn" | "bad" | "info" | "idle" | "evidence";

const DOT: Record<StatusTone, string> = {
  ok: "bg-emerald-600",
  warn: "bg-amber-500",
  bad: "bg-red-600",
  info: "bg-brand",
  idle: "bg-zinc-400",
  evidence: "bg-evidence",
};

/** Text status label with a supporting dot (color is decorative). */
export function StatusLabel({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${DOT[tone]}`} />
      <span>{children}</span>
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-edge px-4 py-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <span
        aria-hidden
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-edge border-t-brand"
      />
      {label}
    </span>
  );
}
