import { useCallback, useRef, useState } from "react";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";

export type Assessment = "TRUE" | "FALSE" | "NO CONSENSUS";
export type Domain = "general" | "legal";

export interface ModelAnswer {
  model: string;
  answer?: string;
  error?: string;
}

export interface ClaimProgress {
  id: string;
  claim: string;
  span_position?: [number, number];
  text_span?: string;
  original_question?: string;
  original_options?: Record<string, string>;
  claimed_answer?: string;
  consensus_answer?: string;
  assessment?: Assessment;
  modelAnswers: ModelAnswer[];
}

export interface VerifyResponse {
  documentId?: string;
  requestId: string;
  original_fact: string;
  domain: Domain;
  url?: string;
  minRequired: number;
  timestamp: string;
  errors?: string[];
  results: Array<{
    id: string;
    claim: string;
    assessment: Assessment;
    original_question: string;
    original_options: Record<string, string>;
    claimed_answer: string;
    consensus_answer: string;
    model_answers: ModelAnswer[];
    span_position?: [number, number];
    text_span?: string;
  }>;
}

export type VerifyStatus = "idle" | "running" | "done" | "error";

export interface VerifyOptions {
  fact: string;
  minRequired?: number;
  totalModels?: number;
  domain?: Domain;
  url?: string;
}

interface VerifyState {
  status: VerifyStatus;
  models: string[];
  claims: ClaimProgress[];
  response: VerifyResponse | null;
  error: string | null;
}

const initialState: VerifyState = {
  status: "idle",
  models: [],
  claims: [],
  response: null,
  error: null,
};

// Parse a raw SSE buffer into { event, data } records. The verify endpoint
// emits named events (`event: <type>` + `data: <json>`) plus a final `[DONE]`.
function parseSSEBlocks(buffer: string): {
  events: Array<{ event: string; data: string }>;
  rest: string;
} {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? ""; // last (possibly incomplete) block stays buffered
  for (const block of blocks) {
    if (!block.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    events.push({ event, data: dataLines.join("\n") });
  }
  return { events, rest };
}

export const useVerify = () => {
  const { user } = useSession();
  const [state, setState] = useState<VerifyState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => setState(initialState), []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => (s.status === "running" ? { ...s, status: "idle" } : s));
  }, []);

  const upsertClaim = (
    setS: typeof setState,
    id: string,
    update: (claim: ClaimProgress) => ClaimProgress,
    seed?: Partial<ClaimProgress>,
  ) => {
    setS((s) => {
      const idx = s.claims.findIndex((c) => c.id === id);
      if (idx === -1) {
        const fresh: ClaimProgress = {
          id,
          claim: seed?.claim ?? "",
          modelAnswers: [],
          ...seed,
        };
        return { ...s, claims: [...s.claims, update(fresh)] };
      }
      const claims = [...s.claims];
      claims[idx] = update(claims[idx]);
      return { ...s, claims };
    });
  };

  const verify = useCallback(
    async (opts: VerifyOptions) => {
      const fact = opts.fact.trim();
      if (!fact) return;
      if (!user) {
        setState({ ...initialState, status: "error", error: "Please login to continue." });
        return;
      }

      setState({ ...initialState, status: "running" });
      abortRef.current = new AbortController();

      try {
        const response = await fetch(`${API_BASE_URL}/v1/verify/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            fact,
            minRequired: opts.minRequired ?? 2,
            totalModels: opts.totalModels ?? 3,
            domain: opts.domain ?? "general",
            ...(opts.url ? { url: opts.url } : {}),
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          let detail = `Verification failed (${response.status})`;
          try {
            const body = await response.json();
            detail = body.detail || body.error?.message || detail;
          } catch {}
          throw new Error(detail);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (reader) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = parseSSEBlocks(buffer);
          buffer = rest;

          for (const { event, data } of events) {
            if (data === "[DONE]") continue;
            let payload: any;
            try {
              payload = JSON.parse(data);
            } catch {
              continue;
            }

            switch (event) {
              case "start":
                setState((s) => ({ ...s, models: payload.models ?? [] }));
                break;
              case "claims_extracted":
                setState((s) => ({
                  ...s,
                  claims: (payload.claims ?? []).map((c: any) => ({
                    id: c.id,
                    claim: c.claim,
                    span_position: c.span_position,
                    text_span: c.text_span,
                    modelAnswers: [],
                  })),
                }));
                break;
              case "claim_start":
                upsertClaim(setState, payload.questionId, (c) => c, {
                  claim: payload.claim,
                });
                break;
              case "model_result":
                upsertClaim(setState, payload.questionId, (c) => ({
                  ...c,
                  modelAnswers: [
                    ...c.modelAnswers.filter((m) => m.model !== payload.model),
                    { model: payload.model, answer: payload.answer },
                  ],
                }));
                break;
              case "model_error":
                upsertClaim(setState, payload.questionId, (c) => ({
                  ...c,
                  modelAnswers: [
                    ...c.modelAnswers.filter((m) => m.model !== payload.model),
                    { model: payload.model, error: payload.error },
                  ],
                }));
                break;
              case "claim_verified": {
                const r = payload.result;
                upsertClaim(
                  setState,
                  r.id,
                  (c) => ({
                    ...c,
                    assessment: r.assessment,
                    consensus_answer: r.consensus_answer,
                    original_question: r.original_question,
                    original_options: r.original_options,
                    claimed_answer: r.claimed_answer,
                    span_position: r.span_position,
                    text_span: r.text_span,
                    modelAnswers: r.model_answers ?? c.modelAnswers,
                  }),
                  { claim: r.claim },
                );
                break;
              }
              case "result":
                setState((s) => ({ ...s, status: "done", response: payload }));
                break;
              case "error":
                setState((s) => ({ ...s, status: "error", error: payload.message }));
                break;
            }
          }
        }

        setState((s) => (s.status === "running" ? { ...s, status: "done" } : s));
      } catch (error) {
        const err = error as Error;
        if (err.name === "AbortError") return;
        setState((s) => ({ ...s, status: "error", error: err.message || "Verification failed" }));
      }
    },
    [user],
  );

  return { ...state, verify, cancel, reset };
};
