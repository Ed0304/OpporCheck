// Shared UI primitives: restrained cards, buttons, form fields,
// evidence quotes, and status labels. Status is always text, never
// color alone.

"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from "react";
import { motion } from "motion/react";
import { SpotUpload } from "@/components/spot";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";
import { Enter, OC_DURATION, OC_EASE } from "@/components/motion";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-on-action shadow-sm enabled:hover:bg-brand-strong " +
    "enabled:hover:shadow-[0_6px_20px_var(--oc-glow)] enabled:active:scale-[0.98]",
  secondary:
    "border border-edge bg-card text-ink shadow-sm enabled:hover:border-brand/50 " +
    "enabled:hover:bg-brand-soft enabled:active:scale-[0.98]",
  ghost: "text-ink enabled:hover:bg-brand-soft enabled:active:scale-[0.98]",
  danger:
    "border border-danger/50 text-danger enabled:hover:bg-danger-soft " +
    "enabled:active:scale-[0.98]",
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
      className={`oc-glass-strong overflow-hidden rounded-xl border border-edge ${className}`}
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
        <p role="alert" className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="oc-field h-10 w-full rounded-md border border-edge bg-card px-3 text-sm text-ink placeholder:text-muted disabled:opacity-60"
      {...props}
    />
  );
}

export type StatusTone = "ok" | "warn" | "bad" | "info" | "idle" | "evidence";

const CHIP: Record<StatusTone, string> = {
  ok: "border-ok/40 bg-ok-soft text-ok",
  warn: "border-warn/40 bg-warn-soft text-warn",
  bad: "border-danger/40 bg-danger-soft text-danger",
  info: "border-brand/30 bg-brand-soft text-navy",
  idle: "border-edge bg-canvas text-muted",
  evidence: "border-evidence/30 bg-evidence-soft text-evidence",
};

const DOT: Record<StatusTone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-danger",
  info: "bg-brand",
  idle: "bg-muted",
  evidence: "bg-evidence",
};

/**
 * Restrained status chip: words first, color decorative. Tones describe
 * workflow state (complete, ready, needs review), never a safety verdict.
 */
export function StatusLabel({
  tone,
  children,
  wrap = false,
}: {
  tone: StatusTone;
  children: ReactNode;
  /** Allow long labels to wrap instead of overflowing narrow containers. */
  wrap?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${wrap ? "whitespace-normal" : "whitespace-nowrap"} ${CHIP[tone]}`}
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
  illustration,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  /** Decorative glyph; defaults to a restrained document mark. */
  illustration?: ReactNode;
}) {
  return (
    <div className="oc-glass rounded-xl border border-dashed border-edge px-6 py-10 text-center">
      {illustration ?? (
        <svg
          aria-hidden
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-auto mb-3 text-brand/70"
        >
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      )}
      <p className="text-[15px] font-semibold tracking-tight">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Styled file picker: the native input stays (screen-reader and keyboard
 * operable) while a button-styled label and a filename readout replace
 * the browser's unstyled control. Focus rings through peer-focus-visible.
 */
export function FilePicker({
  id,
  accept,
  disabled = false,
  onSelect,
  fileName,
  chooseLabel,
  noFileLabel,
  inputRef,
}: {
  id: string;
  accept: string;
  disabled?: boolean;
  onSelect: (file: File | undefined) => void;
  /** Last selected file name, or null when nothing is chosen. */
  fileName: string | null;
  chooseLabel: string;
  noFileLabel: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => onSelect(event.target.files?.[0])}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        aria-disabled={disabled}
        className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-edge bg-card px-4 text-sm font-medium shadow-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-brand-soft"
        }`}
      >
        <SpotUpload size={16} />
        {chooseLabel}
      </label>
      <span role="status" className="min-w-0 flex-1 basis-40 truncate text-sm text-muted">
        {fileName ?? noFileLabel}
      </span>
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
      <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-2">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden className="h-px w-6 bg-edge sm:w-10" />}
            <motion.span
              aria-current={step.state === "current" ? "step" : undefined}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: OC_DURATION.base,
                ease: OC_EASE,
                delay: Math.min(index * 0.05, 0.15),
              }}
              className={`inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-[13px] font-medium whitespace-nowrap ${
                step.state === "done"
                  ? "border-ok/40 bg-ok-soft text-ok"
                  : step.state === "current"
                    ? "border-brand/60 bg-card text-ink shadow-sm ring-1 ring-brand/30"
                    : "border-edge bg-transparent text-muted"
              }`}
            >
              <span
                aria-hidden
                className={`oc-tnum inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  step.state === "done"
                    ? "bg-ok text-white dark:text-canvas"
                    : step.state === "current"
                      ? "bg-brand text-on-action"
                      : "bg-canvas text-muted"
                }`}
              >
                {step.state === "done" ? "✓" : index + 1}
              </span>
              {step.label}
            </motion.span>
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
