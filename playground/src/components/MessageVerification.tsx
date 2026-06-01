import { useMemo, useRef, useState } from "react";
import {
  Assessment,
  Message,
  VerifyClaimResult,
  VerifyDomain,
  verifyFactStream,
} from "src/utils/chat";
import {
  CheckCircleIcon,
  XCircleIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/solid";
import { Spinner } from "./PageLoading";

interface MessageVerificationProps {
  messages: Message[];
  models: string[];
  minYes?: number;
  systemMessage?: string;
}

// Local, progressively-built view of a claim as SSE events arrive.
interface ClaimView {
  id: string;
  claim: string;
  assessment?: Assessment;
  consensus_answer?: string;
  claimed_answer?: string;
  original_question?: string;
  original_options?: Record<string, string>;
  modelAnswers: { model: string; answer?: string; error?: string }[];
}

const ASSESSMENT_META: Record<
  Assessment,
  { label: string; className: string; Icon: typeof CheckCircleIcon }
> = {
  TRUE: { label: "TRUE", className: "text-green-700 bg-green-50 border-green-200", Icon: CheckCircleIcon },
  FALSE: { label: "FALSE", className: "text-red-700 bg-red-50 border-red-200", Icon: XCircleIcon },
  "NO CONSENSUS": {
    label: "NO CONSENSUS",
    className: "text-amber-700 bg-amber-50 border-amber-200",
    Icon: QuestionMarkCircleIcon,
  },
};

export const MessageVerification = ({
  messages,
  minYes: defaultMinYes = 2,
}: MessageVerificationProps) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [usedModels, setUsedModels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState<VerifyDomain>("general");
  const [totalModels, setTotalModels] = useState(3);
  const [minRequired, setMinRequired] = useState(defaultMinYes);
  const abortRef = useRef<AbortController | null>(null);

  // The statement to fact-check is the latest assistant (or last) message.
  const fact = useMemo(() => {
    const nonSystem = messages.filter((m) => m.role !== "system");
    const lastAssistant = [...nonSystem].reverse().find((m) => m.role === "assistant");
    return (lastAssistant ?? nonSystem[nonSystem.length - 1])?.content ?? "";
  }, [messages]);

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
    if (!fact.trim()) {
      setError("Nothing to verify yet — generate a response first.");
      return;
    }
    setIsVerifying(true);
    setError(null);
    setClaims([]);
    setUsedModels([]);
    abortRef.current = new AbortController();

    try {
      await verifyFactStream(
        { fact, domain, totalModels, minRequired },
        {
          onStart: (d) => setUsedModels(d.models),
          onClaimsExtracted: (d) =>
            setClaims(
              d.claims.map((c) => ({ id: c.id, claim: c.claim, modelAnswers: [] }))
            ),
          onModelResult: (d) =>
            upsertClaim(d.questionId, (c) => ({
              ...c,
              modelAnswers: [
                ...c.modelAnswers.filter((m) => m.model !== d.model),
                { model: d.model, answer: d.answer },
              ],
            })),
          onModelError: (d) =>
            upsertClaim(d.questionId, (c) => ({
              ...c,
              modelAnswers: [
                ...c.modelAnswers.filter((m) => m.model !== d.model),
                { model: d.model, error: d.error },
              ],
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
                modelAnswers: result.model_answers ?? c.modelAnswers,
              }),
              result.claim
            ),
          onError: (err) => setError(err.message),
        },
        abortRef.current.signal
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const summary = useMemo(() => {
    const verified = claims.filter((c) => c.assessment);
    return {
      total: claims.length,
      TRUE: verified.filter((c) => c.assessment === "TRUE").length,
      FALSE: verified.filter((c) => c.assessment === "FALSE").length,
      "NO CONSENSUS": verified.filter((c) => c.assessment === "NO CONSENSUS").length,
    };
  }, [claims]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-none p-6 bg-white border-b border-gray-200">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-600">Fact Verification</div>
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="flex items-center px-4 py-2 space-x-2 text-sm text-white bg-blue-600 rounded-lg shadow-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <>
                  <Spinner className="w-4 h-4" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Verify Statement</span>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center overflow-hidden border border-gray-200 rounded-lg">
              {(["general", "legal"] as VerifyDomain[]).map((d) => (
                <button
                  key={d}
                  disabled={isVerifying}
                  onClick={() => setDomain(d)}
                  className={`px-3 py-1.5 text-sm font-medium capitalize ${
                    domain === d ? "bg-blue-600 text-white" : "bg-white text-gray-600"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              Models
              <select
                value={totalModels}
                disabled={isVerifying}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTotalModels(v);
                  if (minRequired > v) setMinRequired(v);
                }}
                className="px-2 py-1 text-sm border border-gray-200 rounded-lg"
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              Min agreement
              <select
                value={minRequired}
                disabled={isVerifying}
                onChange={(e) => setMinRequired(Number(e.target.value))}
                className="px-2 py-1 text-sm border border-gray-200 rounded-lg"
              >
                {Array.from({ length: totalModels }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>

          {usedModels.length > 0 && (
            <p className="font-mono text-xs text-gray-400">using: {usedModels.join(", ")}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="flex-none px-6 py-3 border-b border-red-200 bg-red-50">
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}

      <div className="flex-1 p-6 overflow-y-auto">
        {summary.total > 0 && (
          <div className="flex flex-wrap gap-3 mb-4 text-sm">
            <span className="text-gray-600">{summary.total} claims</span>
            <span className="text-green-600">{summary.TRUE} true</span>
            <span className="text-red-600">{summary.FALSE} false</span>
            <span className="text-amber-600">{summary["NO CONSENSUS"]} no consensus</span>
          </div>
        )}

        <div className="space-y-3">
          {claims.map((claim) => {
            const meta = claim.assessment ? ASSESSMENT_META[claim.assessment] : null;
            return (
              <div key={claim.id} className="p-4 bg-white border border-gray-200 shadow-sm rounded-xl">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-900">{claim.claim}</p>
                  {meta ? (
                    <span
                      className={`flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${meta.className}`}
                    >
                      <meta.Icon className="w-4 h-4" />
                      {meta.label}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
                      <Spinner className="w-4 h-4" />
                      verifying
                    </span>
                  )}
                </div>

                {claim.original_question && (
                  <p className="mt-2 text-xs text-gray-500">{claim.original_question}</p>
                )}

                {claim.original_options && (
                  <ul className="mt-2 space-y-1">
                    {Object.entries(claim.original_options).map(([key, value]) => {
                      const isConsensus = key === claim.consensus_answer;
                      return (
                        <li
                          key={key}
                          className={`text-xs px-2 py-1 rounded ${
                            isConsensus ? "bg-gray-100 font-medium text-gray-800" : "text-gray-600"
                          }`}
                        >
                          <span className="font-mono">{key}.</span> {value}
                          {isConsensus && <span className="ml-2 text-[10px] text-gray-500">consensus</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {claim.modelAnswers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {claim.modelAnswers.map((m) => (
                      <span
                        key={m.model}
                        title={m.error}
                        className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
                          m.error ? "border-red-200 text-red-500" : "border-gray-200 text-gray-600"
                        }`}
                      >
                        {m.model}: {m.error ? "error" : m.answer || "…"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isVerifying && claims.length === 0 && (
          <p className="text-sm text-gray-400">Extracting claims…</p>
        )}
      </div>
    </div>
  );
};
