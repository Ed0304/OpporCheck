// Evidence investigation: transient claim-vs-official-source workflow.
//
// Flow: deterministic plan -> FastAPI excerpt retrieval -> Firebase AI
// Logic hybrid comparison -> validated, attribution-checked findings.
// Nothing here is saved: results live in component state only, because
// client-side findings writes are intentionally forbidden by the rules.
//
// Panel chrome follows the global website language preference. The
// deterministic plan text itself stays English (see LOCALIZATION.md);
// priorities shown beside it are internal enum values and stay English.

"use client";

import { useMemo, useState } from "react";
import { Button, Card, EmptyState, EvidenceQuote, Spinner, StatusLabel } from "@/components/ui";
import Disclaimer, { ContextualNotice } from "@/components/Disclaimer";
import PrivacyCheckPanel from "@/components/PrivacyCheckPanel";
import {
  approvalCovers,
  describeActualSource,
  hashContent,
  type PrivacyApproval,
} from "@/lib/privacyGate";
import { mapServiceError } from "@/lib/aiErrors";
import { useLang } from "@/lib/lang";
import {
  format,
  getPlanCategoryLabel,
  getSourceCategoryLabel,
  getStrings,
  type UiLanguage,
} from "@/lib/strings";
import { getInvestigationContextNotice } from "@/lib/disclaimer";
import {
  ASSESSMENT_TONES,
  getAssessmentLabels,
  getUnverifiedPhrase,
  type AssessmentTone,
} from "@/lib/reportLanguage";
import {
  buildComparisonPrompt,
  createComparisonModel,
  parseEvidenceComparison,
} from "@/lib/evidenceComparison";
import { getFirebaseClient, probeFirebaseConfig } from "@/lib/firebaseClient";
import {
  CORRIDORS,
  DEFAULT_CORRIDOR_CODE,
  resolveCorridorCode,
  type CorridorCode,
} from "@/lib/corridors";
import { buildInvestigationPlan } from "@/lib/investigationPlanner";
import type { InvestigationFinding } from "@/lib/investigations";
import type { OpportunityReport } from "@/lib/opportunityAnalyzer";
import {
  listOfficialSources,
  retrieveOfficialSources,
  sourceIdsForCategories,
  type RetrievalResult,
  type RetrievedSource,
  type SourceRetrievalError,
} from "@/lib/sources";
import type { OfficialSourceCategory } from "@/lib/validation";

function priorityTone(priority: string): "warn" | "info" | "idle" {
  if (priority === "high") {
    return "warn";
  }
  if (priority === "medium") {
    return "info";
  }
  return "idle";
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

function TransientFindingCard({ finding }: { finding: InvestigationFinding }) {
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

function friendlyError(err: unknown, language: UiLanguage): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/403|App Check|app-check/i.test(message)) {
    return getStrings(language).commonAppCheckEvidence;
  }
  return mapServiceError(message, language) ?? message;
}

type Phase = "idle" | "retrieving" | "comparing" | "ready" | "error";

export default function EvidenceInvestigation({
  report,
  postingText,
}: {
  report: OpportunityReport;
  postingText: string;
}) {
  const [envProbe] = useState(() => probeFirebaseConfig());
  const { language } = useLang();
  const t = getStrings(language);
  const configOk = envProbe.missingConfigKeys.length === 0;
  const [corridorCode, setCorridorCode] = useState<CorridorCode>(
    () => resolveCorridorCode(report.destination_country) ?? DEFAULT_CORRIDOR_CODE,
  );
  const profile = CORRIDORS[corridorCode];
  const plan = useMemo(
    () => buildInvestigationPlan(report, postingText, undefined, undefined, corridorCode),
    [report, postingText, corridorCode],
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [retrieval, setRetrieval] = useState<RetrievalResult | null>(null);
  const [findings, setFindings] = useState<InvestigationFinding[]>([]);
  const [findingIssues, setFindingIssues] = useState<string[]>([]);
  const [uncovered, setUncovered] = useState<OfficialSourceCategory[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [inferenceSource, setInferenceSource] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacyNonce, setPrivacyNonce] = useState(0);
  const [privacySource, setPrivacySource] = useState("");
  const [approval, setApproval] = useState<PrivacyApproval | null>(null);
  const [sanitizedPosting, setSanitizedPosting] = useState<string | null>(null);
  const [privacySourceHash, setPrivacySourceHash] = useState<string | null>(null);

  const running = phase === "retrieving" || phase === "comparing";

  // The run is allowed only on approved cleaned text whose source snapshot
  // still matches the stored posting. Displayed questions stay derived
  // from the stored text (local display of the user's own data); everything
  // transmitted (retrieval questions, comparison prompt) uses the run plan.
  const effectiveSanitized =
    sanitizedPosting !== null &&
    privacySourceHash === hashContent(postingText) &&
    approval !== null &&
    approvalCovers(approval, sanitizedPosting)
      ? sanitizedPosting
      : null;

  const handlePrivacyApproved = (next: PrivacyApproval, sanitized: string) => {
    if (hashContent(postingText) !== hashContent(privacySource)) {
      setRunError(t.evPostingChanged);
      return;
    }
    setApproval(next);
    setSanitizedPosting(sanitized);
    setPrivacySourceHash(hashContent(privacySource));
    setPrivacyOpen(false);
  };

  const changeCorridor = (code: CorridorCode) => {
    setCorridorCode(code);
    setPhase("idle");
    setStatus("");
    setRetrieval(null);
    setFindings([]);
    setFindingIssues([]);
    setUncovered([]);
    setRunError(null);
  };

  const handleRun = async () => {
    if (running) {
      return;
    }
    if (effectiveSanitized === null) {
      setPhase("error");
      setStatus("");
      setRunError(t.evApproveFirst);
      return;
    }
    const runPlan = buildInvestigationPlan(
      report,
      effectiveSanitized,
      undefined,
      undefined,
      corridorCode,
    );
    if (runPlan.items.length === 0) {
      setPhase("error");
      setStatus("");
      setRunError(t.evNoQuestionsApproved);
      return;
    }
    setRunError(null);
    setRetrieval(null);
    setFindings([]);
    setFindingIssues([]);
    setUncovered([]);
    setInferenceSource(null);
    setPhase("retrieving");
    setStatus(t.evContacting);
    try {
      const catalog = await listOfficialSources(corridorCode, language);
      const categories = [...new Set(runPlan.items.map((item) => item.source_category))];
      const questions = runPlan.items.map((item) => item.research_question);
      const matched = sourceIdsForCategories(catalog, categories);
      // Origin-country context: categories the destination catalog does not
      // cover (such as origin-protection) resolve against the Indonesian
      // catalog instead, keeping origin and destination findings separate.
      let uncovered = matched.uncovered;
      let originIds: string[] = [];
      if (corridorCode !== "GB" && uncovered.length > 0) {
        const originCatalog = await listOfficialSources("ID", language);
        const originMatched = sourceIdsForCategories(originCatalog, uncovered);
        uncovered = originMatched.uncovered;
        originIds = originMatched.ids;
      }
      setUncovered(uncovered);
      if (matched.ids.length === 0 && originIds.length === 0) {
        setPhase("error");
        setStatus("");
        setRunError(t.evNoApprovedSource);
        return;
      }
      const result =
        matched.ids.length > 0
          ? await retrieveOfficialSources(matched.ids, questions, corridorCode, language)
          : { sources: [], errors: [] };
      let originSources: RetrievedSource[] = [];
      let originErrors: SourceRetrievalError[] = [];
      if (originIds.length > 0) {
        const originResult = await retrieveOfficialSources(originIds, questions, "ID", language);
        originSources = originResult.sources;
        originErrors = originResult.errors;
      }
      const merged: RetrievalResult = {
        sources: [...result.sources, ...originSources],
        errors: [...result.errors, ...originErrors],
      };
      setRetrieval(merged);
      if (merged.sources.length === 0) {
        setPhase("error");
        setStatus("");
        setRunError(t.evNoneReached);
        return;
      }
      setPhase("comparing");
      setStatus(t.evComparing);
      const client = getFirebaseClient();
      const model = createComparisonModel(client.ai, client.cloudModelName);
      const response = await model.generateContent(buildComparisonPrompt(runPlan.items, merged.sources));
      setInferenceSource(String(response.response.inferenceSource ?? "unknown"));
      const parsed = parseEvidenceComparison(response.response.text(), merged.sources);
      setFindings(parsed.findings);
      setFindingIssues(parsed.issues);
      if (parsed.parseError) {
        setPhase("error");
        setStatus("");
        setRunError(parsed.parseError);
        return;
      }
      setPhase("ready");
      setStatus("");
    } catch (err) {
      setPhase("error");
      setStatus("");
      setRunError(friendlyError(err, language));
    }
  };

  const grouped = useMemo(() => {
    const groups: Record<string, InvestigationFinding[]> = {
      supported: [],
      conflicting: [],
      "insufficient-evidence": [],
    };
    for (const finding of findings) {
      const key = finding.assessment.trim().toLowerCase().replace(/_/g, "-");
      (groups[key] ?? groups["insufficient-evidence"])!.push(finding);
    }
    return groups;
  }, [findings]);

  const retrievalErrors = retrieval?.errors ?? [];
  const retrievedSources: RetrievedSource[] = retrieval?.sources ?? [];
  const showResults = retrieval !== null && (phase === "ready" || phase === "error");
  const groupLabels = [
    ["supported", t.evGroupSupported],
    ["conflicting", t.evGroupConflicting],
    ["insufficient-evidence", t.evGroupInsufficient],
  ] as const;

  return (
    <Card
      title={t.evidenceTitle}
      description={format(t.evidenceDescription, { name: profile.displayName })}
    >
      {!configOk && (
        <p className="mb-3 text-sm leading-6">
          {format(t.evConfigMissing, { keys: envProbe.missingConfigKeys.join(", ") })}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">{t.destinationLabel}</span>
          <select
            value={corridorCode}
            disabled={running}
            onChange={(event) => changeCorridor(event.target.value as CorridorCode)}
            className="h-10 rounded-md border border-edge bg-card px-3 text-sm"
          >
            {Object.values(CORRIDORS).map((entry) => (
              <option
                key={entry.code}
                value={entry.code}
                disabled={!entry.hasPlannerPack}
              >
                {entry.displayName}
                {entry.hasPlannerPack ? "" : ` — ${t.rulesNotAdded}`}
              </option>
            ))}
          </select>
        </label>
        <p className="pb-2 text-sm text-muted" role="status">
          {t.rulesApplied}: {profile.displayName} ·{" "}
          {profile.status === "sources_verified"
            ? t.statusSourcesVerified
            : t.statusPartial}
          {profile.lastReviewed ? ` · ${t.sourcesVerifiedOn} ${profile.lastReviewed}` : ""}
        </p>
      </div>

      {plan.items.length === 0 ? (
        profile.hasPlannerPack ? (
          <EmptyState
            title={t.noQuestionsTitle}
            description={format(t.noQuestionsDescription, { name: profile.displayName })}
          />
        ) : (
          <EmptyState
            title={format(t.notCoveredTitle, { name: profile.displayName })}
            description={format(t.notCoveredDescription, { name: profile.displayName })}
          />
        )
      ) : (
        <section aria-labelledby="oc-plan">
          <h3 id="oc-plan" className="font-semibold">
            {format(t.evPlanTitle, { count: String(plan.items.length) })}
          </h3>
          <ul className="mt-2 divide-y divide-edge">
            {plan.items.map((item) => (
              <li key={item.research_question} className="py-4">
                <p className="font-medium leading-6">{item.research_question}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{item.why_it_matters}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <StatusLabel tone={priorityTone(item.priority)}>
                    {format(t.evPriorityLabel, { priority: item.priority })}
                  </StatusLabel>
                  <span className="text-muted">
                    {getPlanCategoryLabel(language, item.category)}
                  </span>
                  <span className="text-muted">
                    {format(t.evRecommendedSource, {
                      label: getSourceCategoryLabel(language, item.source_category),
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-md border border-edge p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusLabel tone={effectiveSanitized !== null ? "ok" : "idle"}>
                {effectiveSanitized !== null ? t.evPrivacyApproved : t.evPrivacyRequired}
              </StatusLabel>
            </div>
            {!privacyOpen ? (
              <div className="mt-2">
                <Button
                  variant="secondary"
                  disabled={running}
                  onClick={() => {
                    setPrivacySource(postingText);
                    setPrivacyNonce((nonce) => nonce + 1);
                    setPrivacyOpen(true);
                  }}
                >
                  {t.commonCheckPrivacy}
                </Button>
                <p className="mt-2 text-sm text-muted">{t.evPrivacyExplainer}</p>
              </div>
            ) : (
              <div className="mt-2">
                <PrivacyCheckPanel
                  key={privacyNonce}
                  sourceText={privacySource}
                  disclosureMode="prefer-on-device"
                  onApproved={handlePrivacyApproved}
                  onCancel={() => setPrivacyOpen(false)}
                />
              </div>
            )}
          </div>
          <div className="mt-4">
            <Button
              onClick={() => void handleRun()}
              disabled={!configOk || running || effectiveSanitized === null}
            >
              {running ? t.evInvestigating : phase === "idle" ? t.evRun : t.evRunAgain}
            </Button>
          </div>
          <p aria-live="polite" className="mt-2 text-sm text-muted">
            {running ? status : ""}
          </p>
          {running && (
            <p className="mt-1">
              <Spinner label={status || t.commonWorking} />
            </p>
          )}
        </section>
      )}

      {runError && (
        <p role="alert" className="mt-4 text-sm leading-6">
          <span className="font-semibold">{t.evFailedLabel}</span> {runError}
        </p>
      )}

      {showResults && (
        <div className="mt-6 flex flex-col gap-6">
          <section aria-labelledby="oc-sources">
            <h3 id="oc-sources" className="font-semibold">
              {format(t.evSourcesTitle, { count: String(retrievedSources.length) })}
            </h3>
            {retrievedSources.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-2">
                {retrievedSources.map((source) => (
                  <li key={source.source_id} className="text-sm leading-6">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-evidence underline decoration-evidence/40 underline-offset-2 hover:decoration-evidence"
                    >
                      {source.title} {t.commonOpenInNewTab}
                    </a>{" "}
                    <span className="text-muted">
                      · {t.commonRetrievedLabel} {source.retrieved_at} · {source.excerpts.length}{" "}
                      {source.excerpts.length === 1 ? t.evExcerptOne : t.evExcerptMany}
                    </span>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-muted">
                        {t.evShowExcerpts}
                      </summary>
                      <div className="mt-1 flex flex-col gap-2">
                        {source.excerpts.map((excerpt, index) => (
                          <EvidenceQuote key={`${source.source_id}-${index}`}>
                            &ldquo;{excerpt.text}&rdquo;
                            {excerpt.truncated && (
                              <span className="text-muted"> {t.evTrimmed}</span>
                            )}
                          </EvidenceQuote>
                        ))}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted">{t.evNoSources}</p>
            )}
          </section>

          {phase === "ready" && (
            <section aria-labelledby="oc-findings">
              <h3 id="oc-findings" className="font-semibold">
                {format(t.evFindingsTitle, { count: String(findings.length) })}
              </h3>
              {inferenceSource !== null && (
                <p className="mt-1 text-sm text-muted" role="status">
                  {t.evComparisonPrefix}{" "}
                  {describeActualSource(inferenceSource, language).label.toLowerCase()}
                </p>
              )}
              <p className="mt-1 text-sm leading-6 text-muted">{t.evQuotesNote}</p>
              <div className="mt-2">
                <ContextualNotice>{getInvestigationContextNotice(language)}</ContextualNotice>
              </div>
              {findings.length === 0 ? (
                <p className="mt-2 text-sm leading-6">
                  {t.evNoFindings} {getUnverifiedPhrase(language)}
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-4">
                  {groupLabels.map(
                    ([key, label]) =>
                      grouped[key]!.length > 0 && (
                        <div key={key}>
                          <h4 className="text-sm font-semibold">
                            {label} ({grouped[key]!.length})
                          </h4>
                          <ul className="mt-2 divide-y divide-edge">
                            {grouped[key]!.map((finding, index) => (
                              <TransientFindingCard
                                key={`${finding.source_url}-${finding.claim}-${index}`}
                                finding={finding}
                              />
                            ))}
                          </ul>
                        </div>
                      ),
                  )}
                </div>
              )}
            </section>
          )}

          {(retrievalErrors.length > 0 ||
            uncovered.length > 0 ||
            findingIssues.length > 0) && (
            <section aria-labelledby="oc-limits">
              <h3 id="oc-limits" className="font-semibold">
                {t.evLimitsTitle}
              </h3>
              <ul className="mt-1 list-disc pl-5 text-sm leading-7">
                {retrievalErrors.map((failure) => (
                  <li key={failure.source_id}>
                    {format(t.evCouldNotCheck, { url: failure.url, error: failure.error })}
                  </li>
                ))}
                {uncovered.map((category) => (
                  <li key={category}>
                    {format(t.evNoSourceCovers, {
                      label: getSourceCategoryLabel(language, category),
                    })}
                  </li>
                ))}
                {findingIssues.length > 0 && (
                  <li>
                    {format(t.evDropped, {
                      count: String(findingIssues.length),
                      resultWord:
                        findingIssues.length === 1 ? t.evDroppedResultOne : t.evDroppedResultMany,
                      verb: findingIssues.length === 1 ? t.evDroppedVerbOne : t.evDroppedVerbMany,
                      pronoun:
                        findingIssues.length === 1
                          ? t.evDroppedPronounOne
                          : t.evDroppedPronounMany,
                    })}
                  </li>
                )}
                <li>{t.evOnlyExcerpts}</li>
                <li>{t.evGuidanceGeneral}</li>
                <li>{t.commonMissingMeansUnverified}</li>
              </ul>
            </section>
          )}

          <Disclaimer />
        </div>
      )}
    </Card>
  );
}
