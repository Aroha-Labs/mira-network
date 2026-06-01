"use client";

import { ReactNode, useMemo, useRef, useState } from "react";
import {
  Assessment,
  VerifyClaimResult,
  VerifyDomain,
  verifyFactStream,
} from "src/utils/chat";
import {
  ArrowPathIcon,
  CheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";

// Progressively-built view of a claim as SSE events arrive.
interface ClaimView {
  id: string;
  claim: string;
  assessment?: Assessment;
  consensus_answer?: string;
  claimed_answer?: string;
  original_question?: string;
  original_options?: Record<string, string>;
  modelAnswers: { model: string; answer?: string; error?: string }[];
  span_position?: [number, number];
  text_span?: string;
}

type Phase = "idle" | "extracting" | "verifying" | "complete" | "error";

const MAX_CHARS = 1000;

/* ---------------- Claim highlighter (inline spans in the statement) ---------------- */

function highlightClasses(assessment: Assessment): string {
  if (assessment === "TRUE") return "bg-green-100 border-b-2 border-green-500";
  if (assessment === "FALSE") return "bg-red-100 border-b-2 border-red-500";
  return "bg-gray-100 border-b-2 border-gray-500";
}

function ClaimHighlighter({ text, claims }: { text: string; claims: ClaimView[] }) {
  const segments = useMemo<ReactNode[]>(() => {
    const positions: { start: number; end: number; claim: ClaimView }[] = [];
    for (const claim of claims) {
      if (!claim.assessment) continue;
      let start = -1;
      let end = -1;
      if (claim.text_span) {
        const idx = text.indexOf(claim.text_span);
        if (idx >= 0) {
          start = idx;
          end = idx + claim.text_span.length;
        }
      }
      if (start < 0 && claim.span_position) {
        [start, end] = claim.span_position;
      }
      if (start >= 0 && end > start && end <= text.length) {
        positions.push({ start, end, claim });
      }
    }
    positions.sort((a, b) => a.start - b.start);

    // drop overlapping spans (keep the earliest)
    const kept: typeof positions = [];
    let lastEnd = -1;
    for (const p of positions) {
      if (p.start >= lastEnd) {
        kept.push(p);
        lastEnd = p.end;
      }
    }

    const out: ReactNode[] = [];
    let cursor = 0;
    kept.forEach((p, i) => {
      if (p.start > cursor) out.push(<span key={`t-${i}`}>{text.slice(cursor, p.start)}</span>);
      out.push(
        <span
          key={`h-${i}`}
          className={highlightClasses(p.claim.assessment!)}
          title={`${p.claim.assessment}: ${p.claim.claim}`}
        >
          {text.slice(p.start, p.end)}
        </span>
      );
      cursor = p.end;
    });
    if (cursor < text.length) out.push(<span key="end">{text.slice(cursor)}</span>);
    return out;
  }, [text, claims]);

  return <>{segments}</>;
}

/* ---------------- Status banner ---------------- */

function StatusBanner({ claims }: { claims: ClaimView[] }) {
  const verified = claims.filter((c) => c.assessment);
  if (verified.length === 0) return null;
  const t = verified.filter((c) => c.assessment === "TRUE").length;
  const f = verified.filter((c) => c.assessment === "FALSE").length;
  const n = verified.filter((c) => c.assessment === "NO CONSENSUS").length;

  let cls = "bg-yellow-50 text-yellow-800 border-yellow-100";
  let icon = <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
  let msg = "This claim is partially correct.";

  if (t > 0 && f === 0 && n === 0) {
    cls = "bg-green-50 text-green-800 border-green-100";
    icon = <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    msg = "This claim is factually correct.";
  } else if (f > 0 && t === 0 && n === 0) {
    cls = "bg-red-50 text-red-800 border-red-100";
    icon = <XCircleIcon className="h-5 w-5 text-red-500" />;
    msg = "This claim is factually incorrect.";
  } else if (n > 0 && t === 0 && f === 0) {
    cls = "bg-gray-50 text-gray-800 border-gray-100";
    icon = <ExclamationTriangleIcon className="h-5 w-5 text-gray-500" />;
    msg = "Unable to reach consensus on this claim.";
  } else if (n > 0) {
    cls = "bg-amber-50 text-amber-800 border-amber-100";
    icon = <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />;
    msg = "This claim has mixed results with some unverifiable parts.";
  }

  return (
    <div className={`p-3 rounded-md border flex items-center gap-2 mb-3 text-sm ${cls}`}>
      {icon}
      <span>{msg}</span>
    </div>
  );
}

/* ---------------- Verification steps ---------------- */

type StepState = "pending" | "active" | "completed";

function StepRow({
  state,
  title,
  description,
}: {
  state: StepState;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start relative z-10">
      <div
        className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center border-2 ${
          state === "active"
            ? "border-indigo-500 bg-indigo-50"
            : state === "completed"
            ? "border-green-500 bg-green-50"
            : "border-gray-300 bg-white"
        }`}
      >
        {state === "active" && <ArrowPathIcon className="h-3 w-3 text-indigo-500 animate-spin" />}
        {state === "completed" && <CheckIcon className="h-3 w-3 text-green-500" />}
      </div>
      <div className="ml-3 flex-grow">
        <h4
          className={`text-sm font-medium ${
            state === "active" ? "text-indigo-600" : state === "completed" ? "text-gray-700" : "text-gray-400"
          }`}
        >
          {title}
        </h4>
        <p className="text-xs text-gray-500 mt-0.5 flex items-center">
          <DocumentDuplicateIcon className="h-3 w-3 mr-1" />
          {description}
        </p>
      </div>
    </div>
  );
}

function VerificationSteps({ phase }: { phase: Phase }) {
  const s = (forExtract: StepState, forVerify: StepState, forComplete: StepState) => ({
    forExtract,
    forVerify,
    forComplete,
  });
  const map: Record<string, ReturnType<typeof s>> = {
    extracting: s("active", "pending", "pending"),
    verifying: s("completed", "active", "pending"),
    complete: s("completed", "completed", "completed"),
  };
  const st = map[phase] ?? map.extracting;

  return (
    <div className="p-4 overflow-y-auto rounded-lg">
      <div className="space-y-3 relative">
        <div className="absolute left-3 top-1 bottom-1 w-0.5 bg-gray-200" />
        <StepRow state={st.forExtract} title="Extracting Claims" description="Identifying individual claims in your statement" />
        <StepRow
          state={phase === "extracting" ? "pending" : "completed"}
          title="Evaluating Details"
          description="Transforming claims for evaluation"
        />
        <StepRow state={st.forVerify} title="Verifying Facts" description="Checking each claim with multiple AI models" />
        <StepRow state={st.forComplete} title="Verification Complete" description="All claims have been verified" />
      </div>
    </div>
  );
}

/* ---------------- Detailed analysis table ---------------- */

function consensusLabel(claim: ClaimView): string {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const m of claim.modelAnswers) {
    if (m.answer) {
      counts[m.answer] = (counts[m.answer] || 0) + 1;
    }
    total += 1;
  }
  const max = Object.values(counts).reduce((a, b) => Math.max(a, b), 0);
  return total ? `${max}/${total}` : "—";
}

function DetailedAnalysisTable({ claims }: { claims: ClaimView[] }) {
  return (
    <div className="mt-4 md:mt-10 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      <div className="p-4 border-b border-gray-100 bg-white">
        <p className="text-lg text-gray-700">Detailed Analysis</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Claim</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Assessment</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Consensus</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {claims.map((claim, index) => (
              <tr key={claim.id || index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-700">{claim.claim}</td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center">
                    {claim.assessment === "TRUE" && (
                      <>
                        <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                        <span className="text-green-700 font-medium">True</span>
                      </>
                    )}
                    {claim.assessment === "FALSE" && (
                      <>
                        <XCircleIcon className="h-4 w-4 text-red-500 mr-2" />
                        <span className="text-red-700 font-medium">False</span>
                      </>
                    )}
                    {claim.assessment === "NO CONSENSUS" && (
                      <>
                        <ExclamationCircleIcon className="h-4 w-4 text-gray-500 mr-2" />
                        <span className="text-gray-700 font-medium">No Consensus</span>
                      </>
                    )}
                    {!claim.assessment && <span className="text-gray-400">verifying…</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{consensusLabel(claim)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Main page ---------------- */

export const VerifyStandalone = () => {
  const [fact, setFact] = useState("");
  const [submittedFact, setSubmittedFact] = useState("");
  const [domain, setDomain] = useState<VerifyDomain>("general");
  const [totalModels, setTotalModels] = useState(3);
  const [minRequired, setMinRequired] = useState(2);

  const [phase, setPhase] = useState<Phase>("idle");
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [usedModels, setUsedModels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isProcessing = phase === "extracting" || phase === "verifying";
  const completed = phase === "complete" && claims.length > 0;

  const upsertClaim = (id: string, update: (c: ClaimView) => ClaimView, claim = "") => {
    setClaims((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return [...prev, update({ id, claim, modelAnswers: [] })];
      const next = [...prev];
      next[idx] = update(next[idx]);
      return next;
    });
  };

  const handleVerify = async () => {
    const value = fact.trim();
    if (!value || isProcessing || value.length > MAX_CHARS) return;
    setSubmittedFact(value);
    setPhase("extracting");
    setError(null);
    setClaims([]);
    setUsedModels([]);
    abortRef.current = new AbortController();

    try {
      await verifyFactStream(
        { fact: value, domain, totalModels, minRequired },
        {
          onStart: (d) => setUsedModels(d.models),
          onClaimsExtracted: (d) => {
            setClaims(
              d.claims.map((c) => ({
                id: c.id,
                claim: c.claim,
                span_position: c.span_position,
                text_span: c.text_span,
                modelAnswers: [],
              }))
            );
            setPhase("verifying");
          },
          onModelResult: (d) =>
            upsertClaim(d.questionId, (c) => ({
              ...c,
              modelAnswers: [...c.modelAnswers.filter((m) => m.model !== d.model), { model: d.model, answer: d.answer }],
            })),
          onModelError: (d) =>
            upsertClaim(d.questionId, (c) => ({
              ...c,
              modelAnswers: [...c.modelAnswers.filter((m) => m.model !== d.model), { model: d.model, error: d.error }],
            })),
          onClaimVerified: ({ result }: { result: VerifyClaimResult }) =>
            upsertClaim(
              result.id,
              (c) => ({
                ...c,
                assessment: result.assessment,
                consensus_answer: result.consensus_answer,
                claimed_answer: result.claimed_answer,
                original_question: result.original_question,
                original_options: result.original_options,
                span_position: result.span_position ?? c.span_position,
                text_span: result.text_span ?? c.text_span,
                modelAnswers: result.model_answers ?? c.modelAnswers,
              }),
              result.claim
            ),
          onError: (err) => {
            setError(err.message);
            setPhase("error");
          },
        },
        abortRef.current.signal
      );
      setPhase((p) => (p === "error" ? p : "complete"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setPhase("error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 py-8 sm:p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Fact Verification</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter a statement. It is broken into claims, each cross-checked by multiple models for consensus.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="flex-grow px-6 pt-6 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-1">Verify Your Content</h2>
                <p className="text-sm text-gray-500">Using consensus of {totalModels} models</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Domain:</label>
                  <select
                    value={domain}
                    disabled={isProcessing}
                    onChange={(e) => setDomain(e.target.value as VerifyDomain)}
                    className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="general">General</option>
                    <option value="legal">Legal</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Models:</label>
                  <select
                    value={totalModels}
                    disabled={isProcessing}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTotalModels(v);
                      if (minRequired > v) setMinRequired(v);
                    }}
                    className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Consensus:</label>
                  <select
                    value={minRequired}
                    disabled={isProcessing}
                    onChange={(e) => setMinRequired(Number(e.target.value))}
                    className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {Array.from({ length: totalModels }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n} of {totalModels}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <textarea
              value={fact}
              onChange={(e) => setFact(e.target.value)}
              maxLength={MAX_CHARS}
              disabled={isProcessing}
              placeholder="Enter a claim to verify"
              className="w-full border border-gray-200 rounded-lg p-4 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-700 bg-white text-sm disabled:opacity-60"
              style={{ minHeight: "240px", maxHeight: "400px" }}
            />
          </div>

          <div className="flex border-t border-gray-200 p-4 items-center justify-between text-xs text-gray-500">
            <span>{MAX_CHARS - fact.length} characters remaining</span>
            <button
              type="button"
              onClick={handleVerify}
              disabled={isProcessing || !fact.trim() || fact.length > MAX_CHARS}
              className="bg-black text-white rounded-md px-4 py-2 text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Verifying..." : "Verify →"}
            </button>
          </div>
        </div>

        {/* RIGHT — results */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="px-6 pt-6 flex-grow">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Verification Results</h2>
            <p className="text-sm text-gray-500 mb-4">See how AI models evaluate your statement</p>

            {completed && <StatusBanner claims={claims} />}

            <div className="relative min-h-[260px] rounded-lg bg-white">
              {error && (
                <div className="px-4 py-3 border border-red-100 rounded-lg bg-red-50 text-red-700 flex items-center text-sm">
                  <XCircleIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {!error && isProcessing && <VerificationSteps phase={phase} />}

              {!error && completed && (
                <div className="px-4 min-h-[200px] py-3 border border-gray-200 rounded-lg overflow-y-auto">
                  <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                    <ClaimHighlighter text={submittedFact} claims={claims} />
                  </p>
                </div>
              )}

              {!error && !isProcessing && !completed && (
                <div className="flex items-center justify-center p-8 border border-gray-200 rounded-lg">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-lg flex items-center justify-center mb-4">
                      <DocumentTextIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-500 mb-2">No Verification Results Yet</h3>
                    <p className="text-gray-400 text-sm">Enter a statement and press verify to begin.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 p-4 flex items-center justify-between text-xs text-gray-500">
            <span className="font-mono truncate">
              {usedModels.length ? `using: ${usedModels.join(", ")}` : "consensus of multiple models"}
            </span>
            {completed && (
              <span>
                {claims.filter((c) => c.assessment === "TRUE").length} true ·{" "}
                {claims.filter((c) => c.assessment === "FALSE").length} false ·{" "}
                {claims.filter((c) => c.assessment === "NO CONSENSUS").length} no consensus
              </span>
            )}
          </div>
        </div>
      </div>

      {claims.length > 0 && <DetailedAnalysisTable claims={claims} />}
    </div>
  );
};

export default VerifyStandalone;
