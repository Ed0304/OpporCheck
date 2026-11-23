"use client";

// OpporCheck milestone 1: Firebase AI Logic hybrid inference demo.
//
// Everything on this page runs in the browser via the Firebase Web SDK.
// No backend call is made: the SDK itself routes each prompt to the
// on-device model (Chrome Prompt API) or the cloud model.

import { useEffect, useRef, useState } from "react";
import {
  getGenerativeModel,
  InferenceMode,
  type AI,
  type GenerativeModel,
} from "firebase/ai";
import { getFirebaseClient, probeFirebaseConfig, type AppCheckStatus } from "@/lib/firebaseClient";
import {
  buildAnalysisPrompt,
  parseAnalysis,
  SAMPLE_OPPORTUNITY,
  opportunitySchema,
  type OpportunityAnalysis,
} from "@/lib/opportunityAnalysis";
import PrivacyCheckPanel from "@/components/PrivacyCheckPanel";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/SiteFooter";
import { getPublicLinks } from "@/components/PublicShell";
import Link from "next/link";
import {
  approvalCovers,
  assertAnalysisAllowed,
  hashContent,
  type PrivacyApproval,
} from "@/lib/privacyGate";
import { mapServiceError } from "@/lib/aiErrors";
import { useLang } from "@/lib/lang";
import { format, getStrings, type UiLanguage } from "@/lib/strings";

type DemoMode = "prefer-on-device" | "only-in-cloud";
type DeviceState = "idle" | "initializing" | "ready" | "error";

interface DeviceStatus {
  state: DeviceState;
  /** 0..1 while downloading, 1 when ready, null when unknown. */
  progress: number | null;
  message: string;
}

interface BrowserProbe {
  chromeVersion: number | null;
  isDesktop: boolean;
  meetsRequirement: boolean;
  /** Result of LanguageModel.availability(), or a probe status string. */
  promptApi: string;
}

interface RunResult {
  mode: DemoMode;
  /** Verbatim value of response.inferenceSource. */
  inferenceSource: string;
  latencyMs: number;
  rawText: string;
  data: OpportunityAnalysis | null;
  parseError: string | null;
  usedCloudFallback: boolean;
}

const MODE_LABEL: Record<DemoMode, string> = {
  "prefer-on-device": "PREFER_ON_DEVICE",
  "only-in-cloud": "ONLY_IN_CLOUD",
};

function createHybridModel(ai: AI, cloudModel: string): GenerativeModel {
  return getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: {
      model: cloudModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: opportunitySchema,
      },
    },
    onDeviceParams: {
      promptOptions: { responseConstraint: opportunitySchema },
    },
  });
}

function createCloudModel(ai: AI, cloudModel: string): GenerativeModel {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: cloudModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: opportunitySchema,
      },
    },
  });
}

function probeBrowserSync(): Omit<BrowserProbe, "promptApi"> {
  const ua = navigator.userAgent;
  const match = /Chrome\/(\d+)/.exec(ua);
  const isFork = /Edg\/|OPR\/|Brave\//.test(ua);
  const chromeVersion = match && !isFork ? Number.parseInt(match[1]!, 10) : null;
  const isDesktop = !/Mobile|Android|iPhone|iPad/.test(ua);
  return {
    chromeVersion,
    isDesktop,
    meetsRequirement:
      chromeVersion !== null && chromeVersion >= 139 && isDesktop && !isFork,
  };
}

interface LanguageModelProbe {
  availability: () => Promise<string>;
}

async function probePromptApi(): Promise<string> {
  try {
    const lm = (window as unknown as { LanguageModel?: LanguageModelProbe }).LanguageModel;
    if (!lm || typeof lm.availability !== "function") {
      return "not-exposed";
    }
    return await lm.availability();
  } catch (err) {
    return `probe-failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function friendlyError(err: unknown, language: UiLanguage = "en"): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/403|App Check|app-check|FH: \(auth/i.test(message)) {
    return `${message} ${getStrings(language).hdAppCheckHint}`;
  }
  return mapServiceError(message, language) ?? message;
}

function StatusDot({ tone }: { tone: "ok" | "warn" | "bad" | "idle" }) {
  const color =
    tone === "ok"
      ? "bg-ok"
      : tone === "warn"
        ? "bg-warn"
        : tone === "bad"
          ? "bg-danger"
          : "bg-muted";
  return <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

interface ClientStatus {
  phase: "pending" | "ready" | "error";
  appCheck: AppCheckStatus | null;
  message: string | null;
}

export default function HybridDemoPage() {
  // Env-only probe: safe to run as initial state on server and client.
  const [envProbe] = useState(() => probeFirebaseConfig());
  const { language } = useLang();
  const t = getStrings(language);
  const [clientStatus, setClientStatus] = useState<ClientStatus>({
    phase: "pending",
    appCheck: null,
    message: null,
  });
  const [browser, setBrowser] = useState<BrowserProbe | null>(null);

  const [device, setDevice] = useState<DeviceStatus>({
    state: "idle",
    progress: null,
    message: getStrings(language).hdDeviceIdle,
  });
  const [mode, setMode] = useState<DemoMode>("prefer-on-device");
  const [opportunityText, setOpportunityText] = useState(SAMPLE_OPPORTUNITY);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacyNonce, setPrivacyNonce] = useState(0);
  const [privacySource, setPrivacySource] = useState("");
  const [approval, setApproval] = useState<PrivacyApproval | null>(null);

  const hybridRef = useRef<GenerativeModel | null>(null);
  const cloudRef = useRef<GenerativeModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Browser-only setup runs in this async continuation so state updates
    // land after hydration, never synchronously in the effect body.
    void (async () => {
      const promptApi = await probePromptApi();
      if (cancelled) {
        return;
      }
      setBrowser({ ...probeBrowserSync(), promptApi });
      if (envProbe.missingConfigKeys.length > 0) {
        return;
      }
      try {
        const client = getFirebaseClient();
        hybridRef.current = createHybridModel(client.ai, envProbe.cloudModelName);
        cloudRef.current = createCloudModel(client.ai, envProbe.cloudModelName);
        setClientStatus({ phase: "ready", appCheck: client.appCheckStatus, message: null });
      } catch (err) {
        setClientStatus({ phase: "error", appCheck: null, message: friendlyError(err, language) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [envProbe, language]);

  const handleInitDevice = async () => {
    const model = hybridRef.current;
    if (!model) {
      return;
    }
    setDevice({ state: "initializing", progress: 0, message: t.hdDeviceStarting });
    try {
      // Must be called from a user gesture, before the first on-device query.
      // Resolves when the model is downloaded and ready; progress is 0..1.
      await model.initializeDeviceModel((progressValue) => {
        setDevice((prev) => ({
          ...prev,
          progress: progressValue,
          message: format(t.hdDeviceDownloading, {
            percent: String(Math.round(progressValue * 10000) / 100),
          }),
        }));
      });
      setDevice({ state: "ready", progress: 1, message: t.hdDeviceReady });
    } catch (err) {
      setDevice({ state: "error", progress: null, message: friendlyError(err, language) });
    }
  };

  const handlePrivacyApproved = (next: PrivacyApproval, sanitized: string) => {
    if (hashContent(opportunityText) !== hashContent(privacySource)) {
      setRunError(t.hdPrivacyChanged);
      return;
    }
    setApproval(next);
    setOpportunityText(sanitized);
    setPrivacyOpen(false);
  };

  const handleAnalyze = async () => {
    try {
      assertAnalysisAllowed(approval, opportunityText, language);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
      return;
    }
    const model = mode === "prefer-on-device" ? hybridRef.current : cloudRef.current;
    if (!model || running) {
      return;
    }
    setRunning(true);
    setRunError(null);
    setResult(null);
    const started = performance.now();
    try {
      const response = await model.generateContent(buildAnalysisPrompt(opportunityText));
      const latencyMs = performance.now() - started;
      const rawText = response.response.text();
      // Display the SDK-reported source verbatim: "on_device" | "in_cloud".
      const inferenceSource = String(response.response.inferenceSource ?? "unknown");
      const { data, parseError } = parseAnalysis(rawText);
      setResult({
        mode,
        inferenceSource,
        latencyMs,
        rawText,
        data,
        parseError,
        usedCloudFallback: mode === "prefer-on-device" && inferenceSource === "in_cloud",
      });
    } catch (err) {
      setRunError(friendlyError(err, language));
    } finally {
      setRunning(false);
    }
  };

  const configOk = envProbe.missingConfigKeys.length === 0;
  const clientReady = clientStatus.phase === "ready";
  const initError = clientStatus.message;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas font-sans text-ink">
      <AppHeader links={getPublicLinks(language)} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link
            href="/workspace"
            className="inline-flex h-10 items-center rounded-lg border border-edge bg-card px-4 font-medium text-ink transition-colors hover:bg-brand-soft"
          >
            <span aria-hidden>←&nbsp;</span>
            {t.hdBackToWorkspace}
          </Link>
          <Link href="/workspace/review" className="font-medium text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand">
            {t.wsNavReview}
          </Link>
          <Link href="/workspace/compare" className="font-medium text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand">
            {t.wsNavCompare}
          </Link>
        </div>
        <p className="text-sm text-muted">{t.hdEyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t.hdTitle}</h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted">
          {t.hdSubtitle}
        </p>

        {/* Environment status */}
        <section aria-label={t.hdEnvAria} className="oc-shadow-card mt-8 rounded-xl border border-edge bg-card p-5">
          <h2 className="text-lg font-semibold">{t.hdEnvTitle}</h2>
          <dl className="mt-2 divide-y divide-edge text-sm">
            <StatusRow label={t.hdEnvFirebaseConfig}>
              {configOk ? (
                <span className="flex items-center gap-2"><StatusDot tone="ok" /> {t.hdEnvConfigOk}</span>
              ) : (
                <span className="flex items-center gap-2"><StatusDot tone="bad" /> {format(t.hdEnvConfigMissing, { keys: envProbe.missingConfigKeys.join(", ") })}</span>
              )}
            </StatusRow>
            <StatusRow label={t.hdEnvAppCheck}>
              {clientStatus.appCheck === "configured" ? (
                <span className="flex items-center gap-2"><StatusDot tone="ok" /> reCAPTCHA Enterprise</span>
              ) : clientStatus.appCheck === "missing-site-key" ? (
                <span className="flex items-center gap-2"><StatusDot tone="warn" /> {t.hdEnvNoSiteKey}</span>
              ) : (
                <span className="flex items-center gap-2"><StatusDot tone="idle" /> {t.hdEnvNotInitialized}</span>
              )}
            </StatusRow>
            <StatusRow label={t.hdEnvCloudModel}>
              <code className="rounded bg-brand-soft px-1.5 py-0.5 font-mono text-[0.9em]">
                {envProbe.cloudModelName}
              </code>
            </StatusRow>
            <StatusRow label={t.hdEnvBrowser}>
              {browser === null ? (
                <span className="flex items-center gap-2"><StatusDot tone="idle" /> {t.hdEnvChecking}</span>
              ) : browser.meetsRequirement ? (
                <span className="flex items-center gap-2"><StatusDot tone="ok" /> {format(t.hdEnvChromeDesktop, { version: String(browser.chromeVersion) })}</span>
              ) : (
                <span className="flex items-center gap-2">
                  <StatusDot tone="warn" />
                  {browser.chromeVersion === null
                    ? t.hdEnvNotChrome
                    : format(t.hdEnvChromeOld, { version: String(browser.chromeVersion) })}
                </span>
              )}
            </StatusRow>
            <StatusRow label={t.hdEnvPromptApi}>
              <code className="rounded bg-brand-soft px-1.5 py-0.5 font-mono text-[0.9em]">
                {browser?.promptApi ?? t.hdEnvPromptChecking}
              </code>
            </StatusRow>
          </dl>
          {(!configOk || initError) && (
            <div className="mt-4 rounded-md border border-edge bg-canvas p-4 text-sm leading-6">
              <p className="font-semibold">{t.hdSetupTitle}</p>
              <ol className="mt-1 list-decimal pl-5">
                <li>{t.hdSetupStep1Before} <code className="font-mono">.env.example</code> {t.hdSetupStep1Mid} <code className="font-mono">.env.local</code> {t.hdSetupStep1After}</li>
                <li>{t.hdSetupStep2Before} <code className="font-mono">npx -y firebase-tools@latest init ailogic</code> {t.hdSetupStep2After}</li>
                <li>{t.hdSetupStep3Before} <code className="font-mono">npm run dev</code> {t.hdSetupStep3After}</li>
              </ol>
              {initError && <p className="mt-2">{t.hdSetupErrorLabel} {initError}</p>}
            </div>
          )}
        </section>

        {/* Step 1: initialize on-device model */}
        <section aria-label={t.hdStep1Aria} className="oc-shadow-card mt-6 rounded-xl border border-edge bg-card p-5">
          <h2 className="text-lg font-semibold">{t.hdStep1Title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {t.hdStep1Desc}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleInitDevice}
              disabled={!clientReady || device.state === "initializing" || device.state === "ready"}
              className="h-10 rounded-md bg-brand px-4 text-sm font-medium text-on-action transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {device.state === "initializing" ? t.hdInitDownloading : t.hdInitButton}
            </button>
            <span className="flex items-center gap-2 text-sm">
              <StatusDot
                tone={
                  device.state === "ready"
                    ? "ok"
                    : device.state === "error"
                      ? "bad"
                      : device.state === "initializing"
                        ? "warn"
                        : "idle"
                }
              />
              {device.message}
            </span>
          </div>
          {device.progress !== null && (
            <div
              className="mt-3 h-2 w-full rounded-full bg-edge"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(device.progress * 100)}
              aria-label={t.hdInitProgressAria}
            >
              <div
                className="h-2 rounded-full bg-brand transition-[width]"
                style={{ width: `${Math.round(device.progress * 100)}%` }}
              />
            </div>
          )}
          {device.state === "error" && (
            <p className="mt-2 text-sm leading-6">
              {t.hdInitFailedBefore}{" "}
              <code className="rounded bg-brand-soft px-1 font-mono">chrome://flags/#prompt-api-for-gemini-nano-multimodal-input</code>
              {t.hdInitFailedAfter}
            </p>
          )}
        </section>

        {/* Step 2: run analysis */}
        <section aria-label={t.hdStep2Aria} className="oc-shadow-card mt-6 rounded-xl border border-edge bg-card p-5">
          <h2 className="text-lg font-semibold">{t.hdStep2Title}</h2>
          <fieldset className="mt-3">
            <legend className="text-sm font-medium">{t.hdInferenceMode}</legend>
            <div className="mt-2 flex flex-col gap-2 text-sm">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="inference-mode"
                  value="prefer-on-device"
                  checked={mode === "prefer-on-device"}
                  onChange={() => setMode("prefer-on-device")}
                  className="mt-1"
                />
                <span>
                  <span className="font-mono font-medium">PREFER_ON_DEVICE</span>
                  <span className="text-muted"> {t.hdModePreferHint}</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="inference-mode"
                  value="only-in-cloud"
                  checked={mode === "only-in-cloud"}
                  onChange={() => setMode("only-in-cloud")}
                  className="mt-1"
                />
                <span>
                  <span className="font-mono font-medium">ONLY_IN_CLOUD</span>
                  <span className="text-muted"> {t.hdModeCloudHint}</span>
                </span>
              </label>
            </div>
          </fieldset>
          <label htmlFor="opportunity-text" className="mt-4 block text-sm font-medium">
            {t.hdOpportunityLabel}
          </label>
          <textarea
            id="opportunity-text"
            value={opportunityText}
            onChange={(event) => setOpportunityText(event.target.value)}
            rows={8}
            className="mt-1 w-full rounded-md border border-edge bg-card p-3 font-mono text-sm leading-6"
          />
          <div className="mt-3 rounded-md border border-edge p-3">
            <p className="text-sm font-medium">
              {t.hdPrivacyTitle}{" "}
              <span className="font-normal text-muted">
                {approvalCovers(approval, opportunityText) ? t.hdPrivacyApproved : t.hdPrivacyRequired}
              </span>
            </p>
            {!privacyOpen ? (
              <button
                type="button"
                disabled={running || opportunityText.trim().length === 0}
                onClick={() => {
                  setPrivacySource(opportunityText);
                  setPrivacyNonce((nonce) => nonce + 1);
                  setPrivacyOpen(true);
                }}
                className="mt-2 h-9 rounded-md bg-brand px-4 text-sm font-medium text-on-action transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.commonCheckPrivacy}
              </button>
            ) : (
              <div className="mt-2">
                <PrivacyCheckPanel
                  key={privacyNonce}
                  sourceText={privacySource}
                  disclosureMode={mode}
                  onApproved={handlePrivacyApproved}
                  onCancel={() => setPrivacyOpen(false)}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={
              !clientReady ||
              running ||
              opportunityText.trim().length === 0 ||
              !approvalCovers(approval, opportunityText)
            }
            className="mt-3 h-10 rounded-md bg-brand px-4 text-sm font-medium text-on-action transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? t.hdAnalyzing : format(t.hdAnalyzeButton, { mode: MODE_LABEL[mode] })}
          </button>
          {runError && (
            <p className="mt-3 text-sm leading-6">
              <span className="font-semibold">{t.hdRequestFailed}</span> {runError}
            </p>
          )}
          {result && (
            <div className="mt-4 border-t border-edge pt-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span>
                  inferenceSource:{" "}
                  <code className="rounded bg-brand-soft px-1.5 py-0.5 font-mono font-semibold">
                    {result.inferenceSource}
                  </code>
                </span>
                <span>
                  {t.hdLatency} <span className="font-semibold">{Math.round(result.latencyMs)} ms</span>
                </span>
                <span>
                  {t.hdModeLabel} <span className="font-mono">{MODE_LABEL[result.mode]}</span>
                </span>
              </div>
              {result.usedCloudFallback && (
                <p className="mt-2 text-sm leading-6">
                  {t.hdFallbackNotice}
                </p>
              )}
              {result.parseError && (
                <p className="mt-2 text-sm leading-6">{result.parseError}</p>
              )}
              {result.data && (
                <dl className="mt-3 divide-y divide-edge text-sm">
                  <StatusRow label={t.hdResultOccupation}>{result.data.occupation}</StatusRow>
                  <StatusRow label={t.hdResultSalary}>{result.data.salary}</StatusRow>
                  <StatusRow label={t.hdResultCountry}>{result.data.destination_country}</StatusRow>
                  <StatusRow label={t.hdResultEmpType}>
                    <span className="font-mono">{result.data.employment_type}</span>
                  </StatusRow>
                  <StatusRow label={t.hdResultMissing}>
                    {result.data.missing_information && result.data.missing_information.length > 0 ? (
                      <ul className="list-disc pl-4 text-left">
                        {result.data.missing_information.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      t.hdResultNone
                    )}
                  </StatusRow>
                </dl>
              )}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium">{t.hdRawOutput}</summary>
                <pre className="mt-2 overflow-x-auto rounded-md border border-edge bg-canvas p-3 font-mono text-xs leading-5">
                  {result.rawText}
                </pre>
              </details>
            </div>
          )}
        </section>

        {/* Test guide */}
        <section aria-label={t.hdTestAria} className="oc-shadow-card mt-6 rounded-xl border border-edge bg-card p-5 text-sm leading-6">
          <h2 className="text-lg font-semibold">{t.hdTestTitle}</h2>
          <ol className="mt-2 list-decimal pl-5">
            <li>
              {t.hdTest1Before}{" "}
              <code className="rounded bg-brand-soft px-1 font-mono">chrome://flags/#prompt-api-for-gemini-nano-multimodal-input</code>{" "}
              {t.hdTest1After}
            </li>
            <li>
              {t.hdTest2Before} “{t.hdInitButton}”, {t.hdTest2Mid}{" "}
              <span className="font-mono">PREFER_ON_DEVICE</span>{t.hdTest2After}{" "}
              <code className="rounded bg-brand-soft px-1 font-mono">inferenceSource: on_device</code>.
            </li>
            <li>
              {t.hdTest3Before} <span className="font-mono">ONLY_IN_CLOUD</span> {t.hdTest3Mid}{" "}
              <code className="rounded bg-brand-soft px-1 font-mono">inferenceSource: in_cloud</code>.
            </li>
            <li>
              {t.hdTest4Before}{" "}
              <span className="font-mono">PREFER_ON_DEVICE</span> {t.hdTest4Mid}{" "}
              <code className="rounded bg-brand-soft px-1 font-mono">in_cloud</code> {t.hdTest4After}
            </li>
          </ol>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
