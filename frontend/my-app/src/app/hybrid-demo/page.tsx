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
import {
  approvalCovers,
  assertAnalysisAllowed,
  hashContent,
  type PrivacyApproval,
} from "@/lib/privacyGate";
import { mapServiceError } from "@/lib/aiErrors";

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

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/403|App Check|app-check|FH: \(auth/i.test(message)) {
    return (
      `${message} ` +
      "This usually means App Check is enforced but the request had no valid token. " +
      "Register a debug token for localhost (see README section below) or check the reCAPTCHA Enterprise key."
    );
  }
  return mapServiceError(message) ?? message;
}

function StatusDot({ tone }: { tone: "ok" | "warn" | "bad" | "idle" }) {
  const color =
    tone === "ok"
      ? "bg-emerald-600"
      : tone === "warn"
        ? "bg-amber-500"
        : tone === "bad"
          ? "bg-red-600"
          : "bg-zinc-400";
  return <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
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
  const [clientStatus, setClientStatus] = useState<ClientStatus>({
    phase: "pending",
    appCheck: null,
    message: null,
  });
  const [browser, setBrowser] = useState<BrowserProbe | null>(null);

  const [device, setDevice] = useState<DeviceStatus>({
    state: "idle",
    progress: null,
    message: "Not initialized.",
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
        setClientStatus({ phase: "error", appCheck: null, message: friendlyError(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [envProbe]);

  const handleInitDevice = async () => {
    const model = hybridRef.current;
    if (!model) {
      return;
    }
    setDevice({ state: "initializing", progress: 0, message: "Starting on-device model…" });
    try {
      // Must be called from a user gesture, before the first on-device query.
      // Resolves when the model is downloaded and ready; progress is 0..1.
      await model.initializeDeviceModel((progressValue) => {
        setDevice((prev) => ({
          ...prev,
          progress: progressValue,
          message: `Downloading on-device model: ${Math.round(progressValue * 10000) / 100}%`,
        }));
      });
      setDevice({ state: "ready", progress: 1, message: "On-device model is ready." });
    } catch (err) {
      setDevice({ state: "error", progress: null, message: friendlyError(err) });
    }
  };

  const handlePrivacyApproved = (next: PrivacyApproval, sanitized: string) => {
    if (hashContent(opportunityText) !== hashContent(privacySource)) {
      setRunError("The text changed while you were reviewing. Check privacy again.");
      return;
    }
    setApproval(next);
    setOpportunityText(sanitized);
    setPrivacyOpen(false);
  };

  const handleAnalyze = async () => {
    try {
      assertAnalysisAllowed(approval, opportunityText);
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
      setRunError(friendlyError(err));
    } finally {
      setRunning(false);
    }
  };

  const configOk = envProbe.missingConfigKeys.length === 0;
  const clientReady = clientStatus.phase === "ready";
  const initError = clientStatus.message;

  return (
    <div className="min-h-full bg-zinc-50 font-sans text-zinc-950 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">OpporCheck · Milestone 1</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Hybrid inference demo</h1>
        <p className="mt-2 max-w-2xl leading-7 text-zinc-700 dark:text-zinc-300">
          Analyzes an employment opportunity into structured JSON using Firebase AI Logic in the
          browser. The SDK routes each prompt to the on-device model or the cloud model depending
          on the selected mode and device capability.
        </p>

        {/* Environment status */}
        <section aria-label="Environment status" className="mt-8 rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">Environment</h2>
          <dl className="mt-2 divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
            <StatusRow label="Firebase config">
              {configOk ? (
                <span className="flex items-center gap-2"><StatusDot tone="ok" /> Loaded from env</span>
              ) : (
                <span className="flex items-center gap-2"><StatusDot tone="bad" /> Missing: {envProbe.missingConfigKeys.join(", ")}</span>
              )}
            </StatusRow>
            <StatusRow label="App Check">
              {clientStatus.appCheck === "configured" ? (
                <span className="flex items-center gap-2"><StatusDot tone="ok" /> reCAPTCHA Enterprise</span>
              ) : clientStatus.appCheck === "missing-site-key" ? (
                <span className="flex items-center gap-2"><StatusDot tone="warn" /> No site key (cloud calls may 403 if enforced)</span>
              ) : (
                <span className="flex items-center gap-2"><StatusDot tone="idle" /> Not initialized</span>
              )}
            </StatusRow>
            <StatusRow label="Cloud model">
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-zinc-800">
                {envProbe.cloudModelName}
              </code>
            </StatusRow>
            <StatusRow label="Browser">
              {browser === null ? (
                <span className="flex items-center gap-2"><StatusDot tone="idle" /> Checking…</span>
              ) : browser.meetsRequirement ? (
                <span className="flex items-center gap-2"><StatusDot tone="ok" /> Chrome {browser.chromeVersion} desktop</span>
              ) : (
                <span className="flex items-center gap-2">
                  <StatusDot tone="warn" />
                  {browser.chromeVersion === null
                    ? "Not Chrome desktop — on-device unavailable, cloud still works"
                    : `Chrome ${browser.chromeVersion} — needs v139+ on desktop`}
                </span>
              )}
            </StatusRow>
            <StatusRow label="Prompt API model">
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-zinc-800">
                {browser?.promptApi ?? "checking…"}
              </code>
            </StatusRow>
          </dl>
          {(!configOk || initError) && (
            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="font-semibold">Setup required before testing</p>
              <ol className="mt-1 list-decimal pl-5">
                <li>Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code> and fill in your Firebase web app keys.</li>
                <li>Provision AI Logic once: <code className="font-mono">npx -y firebase-tools@latest init ailogic</code> in your Firebase project directory.</li>
                <li>Restart <code className="font-mono">npm run dev</code> so the new env vars load.</li>
              </ol>
              {initError && <p className="mt-2">Error: {initError}</p>}
            </div>
          )}
        </section>

        {/* Step 1: initialize on-device model */}
        <section aria-label="Initialize on-device model" className="mt-6 rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">Step 1 · Initialize the on-device model</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            Chrome requires a user gesture before the on-device model can download. Click once;
            the first download can take several minutes. This step is optional for the cloud-only
            path.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleInitDevice}
              disabled={!clientReady || device.state === "initializing" || device.state === "ready"}
              className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {device.state === "initializing" ? "Downloading…" : "Initialize on-device model"}
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
              className="mt-3 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(device.progress * 100)}
              aria-label="On-device model download progress"
            >
              <div
                className="h-2 rounded-full bg-zinc-900 transition-[width] dark:bg-zinc-100"
                style={{ width: `${Math.round(device.progress * 100)}%` }}
              />
            </div>
          )}
          {device.state === "error" && (
            <p className="mt-2 text-sm leading-6">
              Download failed. Check the Chrome flag{" "}
              <code className="rounded bg-zinc-100 px-1 font-mono dark:bg-zinc-800">chrome://flags/#prompt-api-for-gemini-nano-multimodal-input</code>,
              available disk space, and that you are on Chrome desktop v139+. The cloud path below
              still works.
            </p>
          )}
        </section>

        {/* Step 2: run analysis */}
        <section aria-label="Run opportunity analysis" className="mt-6 rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">Step 2 · Analyze an opportunity</h2>
          <fieldset className="mt-3">
            <legend className="text-sm font-medium">Inference mode</legend>
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
                  <span className="text-zinc-600 dark:text-zinc-400"> — on-device when available, otherwise cloud fallback</span>
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
                  <span className="text-zinc-600 dark:text-zinc-400"> — cloud model only, never on-device</span>
                </span>
              </label>
            </div>
          </fieldset>
          <label htmlFor="opportunity-text" className="mt-4 block text-sm font-medium">
            Opportunity text
          </label>
          <textarea
            id="opportunity-text"
            value={opportunityText}
            onChange={(event) => setOpportunityText(event.target.value)}
            rows={8}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white p-3 font-mono text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="mt-3 rounded-md border border-zinc-300 p-3 dark:border-zinc-700">
            <p className="text-sm font-medium">
              Privacy Check{" "}
              <span className="font-normal text-zinc-600 dark:text-zinc-400">
                {approvalCovers(approval, opportunityText) ? "(approved)" : "(required)"}
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
                className="mt-2 h-9 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Check privacy
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
            className="mt-3 h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {running ? "Analyzing…" : `Analyze (${MODE_LABEL[mode]})`}
          </button>
          {runError && (
            <p className="mt-3 text-sm leading-6">
              <span className="font-semibold">Request failed:</span> {runError}
            </p>
          )}
          {result && (
            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span>
                  inferenceSource:{" "}
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono font-semibold dark:bg-zinc-800">
                    {result.inferenceSource}
                  </code>
                </span>
                <span>
                  Latency: <span className="font-semibold">{Math.round(result.latencyMs)} ms</span>
                </span>
                <span>
                  Mode: <span className="font-mono">{MODE_LABEL[result.mode]}</span>
                </span>
              </div>
              {result.usedCloudFallback && (
                <p className="mt-2 text-sm leading-6">
                  Notice: the on-device model was unavailable (not initialized, still downloading,
                  or unsupported), so the SDK fell back to the cloud model for this request.
                </p>
              )}
              {result.parseError && (
                <p className="mt-2 text-sm leading-6">{result.parseError}</p>
              )}
              {result.data && (
                <dl className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
                  <StatusRow label="Occupation">{result.data.occupation}</StatusRow>
                  <StatusRow label="Salary">{result.data.salary}</StatusRow>
                  <StatusRow label="Destination country">{result.data.destination_country}</StatusRow>
                  <StatusRow label="Employment type">
                    <span className="font-mono">{result.data.employment_type}</span>
                  </StatusRow>
                  <StatusRow label="Missing information">
                    {result.data.missing_information && result.data.missing_information.length > 0 ? (
                      <ul className="list-disc pl-4 text-left">
                        {result.data.missing_information.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      "None reported"
                    )}
                  </StatusRow>
                </dl>
              )}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium">Raw model output</summary>
                <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-50 p-3 font-mono text-xs leading-5 dark:bg-zinc-900">
                  {result.rawText}
                </pre>
              </details>
            </div>
          )}
        </section>

        {/* Test guide */}
        <section aria-label="How to test" className="mt-6 rounded-md border border-zinc-200 bg-white p-5 text-sm leading-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">How to test both paths</h2>
          <ol className="mt-2 list-decimal pl-5">
            <li>
              Use Chrome desktop v139+ with{" "}
              <code className="rounded bg-zinc-100 px-1 font-mono dark:bg-zinc-800">chrome://flags/#prompt-api-for-gemini-nano-multimodal-input</code>{" "}
              set to Enabled, then restart Chrome.
            </li>
            <li>
              On-device path: click “Initialize on-device model”, wait for Ready, select{" "}
              <span className="font-mono">PREFER_ON_DEVICE</span>, and Analyze. Expect{" "}
              <code className="rounded bg-zinc-100 px-1 font-mono dark:bg-zinc-800">inferenceSource: on_device</code>.
            </li>
            <li>
              Cloud path: select <span className="font-mono">ONLY_IN_CLOUD</span> and Analyze. Expect{" "}
              <code className="rounded bg-zinc-100 px-1 font-mono dark:bg-zinc-800">inferenceSource: in_cloud</code>.
            </li>
            <li>
              Fallback check: in a fresh Chrome profile (or with the flag disabled), select{" "}
              <span className="font-mono">PREFER_ON_DEVICE</span> without initializing and Analyze.
              Expect <code className="rounded bg-zinc-100 px-1 font-mono dark:bg-zinc-800">in_cloud</code> plus the fallback notice.
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}
