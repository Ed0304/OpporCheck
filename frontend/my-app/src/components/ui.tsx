// Shared UI primitives: restrained cards, buttons, form fields,
// evidence quotes, and status labels. Status is always text, never
// color alone.

"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { motion } from "motion/react";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";
import { Enter, OC_DURATION, OC_EASE } from "@/components/motion";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-action shadow-sm hover:bg-brand-strong",
  secondary: "border border-edge bg-card text-ink shadow-sm hover:bg-brand-soft",
  ghost: "text-ink hover:bg-brand-soft",
  danger:
    "border border-red-300 text-red-700 hover:bg-red-50 " +
    "dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50",
};

const BUTTON_SIZES: Record<"sm" | "md" | "lg", string> = {
  sm: "min-h-9 px-3 text-[13px]",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-6 text-base",
};

// Motion redefines these gesture/animation handlers with its own
// signatures; omit the DOM versions so the props stay assignable.
// No caller passes drag or CSS-animation handlers to Button.
interface ButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"
> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return (
    <motion.button
      whileTap={props.disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: OC_DURATION.fast, ease: OC_EASE }}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_SIZES[size]} ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({
  title,
  eyebrow,
  description,
  actions,
  children,
  flush = false,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Remove body padding so tables and lists can run full-bleed. */
  flush?: boolean;
  className?: string;
}) {
  return (
    <motion.section
      aria-label={title}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: OC_DURATION.panel, ease: OC_EASE }}
      className={`oc-shadow-card overflow-hidden rounded-xl border border-edge bg-card ${className}`}
    >
      {(eyebrow || title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-semibold tracking-wider text-muted uppercase">
                {eyebrow}
              </p>
            )}
            {title && <h2 className="mt-0.5 text-[17px] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "mt-4" : "px-6 pt-4 pb-6"}>{children}</div>
    </motion.section>
  );
}

/** Quoted evidence: document excerpts and retrieved source quotes. */
export function EvidenceQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="mt-2 rounded-r-lg border-l-2 border-evidence/70 bg-evidence-soft/40 px-3 py-2 text-sm leading-6">
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

const CHIP: Record<StatusTone, string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  warn: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  bad: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200",
  info: "border-edge bg-brand-soft text-navy",
  idle: "border-edge bg-canvas text-muted",
  evidence:
    "border-evidence/30 bg-evidence-soft text-evidence dark:border-evidence/40",
};

const DOT: Record<StatusTone, string> = {
  ok: "bg-emerald-600 dark:bg-emerald-400",
  warn: "bg-amber-500 dark:bg-amber-400",
  bad: "bg-red-600 dark:bg-red-400",
  info: "bg-brand",
  idle: "bg-zinc-400",
  evidence: "bg-evidence",
};

/**
 * Restrained status chip: words first, color decorative. Tones describe
 * workflow state (complete, ready, needs review), never a safety verdict.
 */
export function StatusLabel({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap ${CHIP[tone]}`}
    >
      <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
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
    <div className="rounded-xl border border-dashed border-edge bg-canvas/60 px-6 py-10 text-center">
      <p className="text-[15px] font-semibold tracking-tight">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { language } = useLang();
  const text = label ?? getStrings(language).commonLoading;
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <span
        aria-hidden
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-edge border-t-brand"
      />
      {text}
    </span>
  );
}

/**
 * Consistent desk page head: small-caps eyebrow, tight title, muted
 * description, and right-aligned primary actions.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Enter className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {description && <p className="mt-1.5 leading-6 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </Enter>
  );
}

/** Real measured figures in a divided strip (counts, never verdicts). */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-xl border border-edge bg-edge sm:grid-cols-3">
      {children}
    </dl>
  );
}

export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-card px-5 py-4">
      <dt className="text-xs font-semibold tracking-wider text-muted uppercase">{label}</dt>
      <dd className="oc-tnum mt-1 text-2xl font-semibold tracking-tight">{children}</dd>
    </div>
  );
}

export interface DeskStep {
  label: string;
  state: "done" | "current" | "todo";
}

/**
 * Honest workflow position: states derive from real application state
 * passed by the caller (has input, approval covers text, report exists).
 */
export function Stepper({ steps, label }: { steps: DeskStep[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden className="h-px w-6 bg-edge sm:w-10" />}
            <span
              aria-current={step.state === "current" ? "step" : undefined}
              className={`inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-[13px] font-medium ${
                step.state === "done"
                  ? "border-evidence/30 bg-evidence-soft text-evidence"
                  : step.state === "current"
                    ? "border-edge bg-card text-ink shadow-sm"
                    : "border-edge bg-transparent text-muted"
              }`}
            >
              <span
                aria-hidden
                className={`oc-tnum inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  step.state === "done"
                    ? "bg-evidence text-white dark:text-evidence-soft"
                    : step.state === "current"
                      ? "bg-brand text-on-action"
                      : "bg-canvas text-muted"
                }`}
              >
                {step.state === "done" ? "✓" : index + 1}
              </span>
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Dense, scannable desk table. Wrap in Card flush for full-bleed rows. */
export function Table({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full text-sm">
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-y border-edge bg-canvas/70 text-left">{children}</tr>
    </thead>
  );
}

export function TH({ children }: { children: ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-2.5 text-xs font-semibold tracking-wider whitespace-nowrap text-muted uppercase first:pl-6 last:pr-6"
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-edge">{children}</tbody>;
}

export function TR({ children }: { children: ReactNode }) {
  return <tr className="transition-colors hover:bg-brand-soft/50">{children}</tr>;
}

export function TD({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3.5 align-middle first:pl-6 last:pr-6 ${className}`}>{children}</td>;
}
