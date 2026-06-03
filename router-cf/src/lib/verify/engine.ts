// Rich fact-verification engine, ported from
// verify.mira.network/backend/src/services/{verificationService,binarizeService}.ts
//
// Pure algorithm only: binarize a statement into multiple-choice questions, ask
// several models each question, take consensus, and label every claim
// TRUE / FALSE / NO CONSENSUS. Persistence, auth, rate-limiting and billing live
// in the route, not here.

import type OpenAI from "openai";
import { getModel, type ModelInfo } from "../models";
import {
  BINARIZER_MODEL,
  BINARIZER_TOOL,
  VERIFICATION_MODELS,
} from "./config";
import {
  BINARIZER_SYSTEM_GENERAL,
  BINARIZER_SYSTEM_LEGAL,
  BINARIZER_USER_GENERAL,
  BINARIZER_USER_LEGAL,
  VERIFICATION_SYSTEM,
  VERIFICATION_USER,
} from "./prompts";

export type Assessment = "TRUE" | "FALSE" | "NO CONSENSUS";
export type Domain = "general" | "legal";

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface BinarizerOptions {
  A: string;
  B: string;
  C?: string;
  D?: string;
}

export interface BinarizerQuestion {
  entity: string;
  original_claim: string;
  question: string;
  options: BinarizerOptions;
  claimed_answer: string;
  expected_answer?: string;
  questionID: string;
  span_position?: [number, number];
  span_text?: string;
}

export interface ClaimResult {
  id: string;
  claim: string;
  assessment: Assessment;
  original_question: string;
  original_options: BinarizerOptions;
  claimed_answer: string;
  model_answers: Array<{ model: string; answer: string }>;
  consensus_answer: string;
  span_position?: [number, number];
  text_span?: string;
}

export interface VerifyFactRequest {
  fact: string;
  minRequired: number;
  totalModels: number;
  url?: string;
  domain: Domain;
}

export interface VerifyResponse {
  requestId: string;
  original_fact: string;
  results: ClaimResult[];
  timestamp: string;
  minRequired: number;
  domain: Domain;
  url?: string;
  errors?: string[];
}

// Progress events streamed to the client (see route -> SSE).
export type ProgressEvent =
  | { type: "start"; fact: string; domain: Domain; models: string[] }
  | {
      type: "claims_extracted";
      requestId: string;
      claims: Array<{
        id: string;
        claim: string;
        span_position?: [number, number];
        text_span?: string;
      }>;
    }
  | { type: "claim_start"; questionId: string; claim: string }
  | { type: "model_result"; questionId: string; model: string; answer: string }
  | { type: "model_error"; questionId: string; model: string; error: string }
  | { type: "claim_verified"; result: ClaimResult }
  | { type: "error"; message: string };

export type OnProgress = (event: ProgressEvent) => void | Promise<void>;

export interface VerifyEngineResult {
  response: VerifyResponse;
  // Token usage keyed by router-cf model id, so the caller can price each model
  // with calculateCost() and deduct credits once.
  modelUsage: Record<string, Usage>;
}

function processTemplate(template: string, values: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return out;
}

function addUsage(acc: Record<string, Usage>, modelId: string, usage?: Usage) {
  if (!usage) return;
  const cur = acc[modelId] || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  cur.prompt_tokens += usage.prompt_tokens || 0;
  cur.completion_tokens += usage.completion_tokens || 0;
  cur.total_tokens += usage.total_tokens || 0;
  acc[modelId] = cur;
}

function binarizerPrompts(domain: Domain) {
  return domain === "legal"
    ? { system: BINARIZER_SYSTEM_LEGAL, user: BINARIZER_USER_LEGAL }
    : { system: BINARIZER_SYSTEM_GENERAL, user: BINARIZER_USER_GENERAL };
}

/**
 * Turn a statement into multiple-choice fact-check questions via a forced tool call.
 */
async function binarizeFact(
  client: OpenAI,
  fact: string,
  domain: Domain,
): Promise<{ requestId: string; questions: BinarizerQuestion[]; usage?: Usage }> {
  const modelInfo = getModel(BINARIZER_MODEL);
  if (!modelInfo) {
    throw new Error(`Binarizer model "${BINARIZER_MODEL}" is not in the model registry`);
  }

  const { system, user } = binarizerPrompts(domain);
  const response = await client.chat.completions.create({
    model: modelInfo.gatewayModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: processTemplate(user, { statement: fact }) },
    ],
    temperature: 0,
    tools: [BINARIZER_TOOL as unknown as OpenAI.ChatCompletionTool],
    tool_choice: {
      type: "function",
      function: { name: "generate_fact_check_questions" },
    },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  const args = (toolCall as any)?.function?.arguments;
  if (!args) {
    throw new Error("Binarizer returned no tool call — could not extract claims");
  }

  let parsed: { requestID?: string; questions?: BinarizerQuestion[] };
  try {
    parsed = JSON.parse(args);
  } catch {
    throw new Error("Binarizer returned malformed JSON");
  }

  const questions = (parsed.questions || []).map((q) => ({
    ...q,
    span_text: (q as any).span_text ?? (q as any).text_span,
  }));

  return {
    requestId: parsed.requestID || crypto.randomUUID(),
    questions,
    usage: response.usage ?? undefined,
  };
}

function formatOptions(options: BinarizerOptions): string {
  return Object.entries(options)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

/**
 * Ask one model a single multiple-choice question; return its letter answer.
 */
async function getModelAnswer(
  client: OpenAI,
  modelInfo: ModelInfo,
  question: string,
  options: BinarizerOptions,
): Promise<{ answer: string; usage?: Usage; error?: string }> {
  try {
    const userPrompt = processTemplate(VERIFICATION_USER, {
      question,
      options: formatOptions(options),
    });
    const response = await client.chat.completions.create({
      model: modelInfo.gatewayModel,
      messages: [
        { role: "system", content: VERIFICATION_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 10,
    });
    const raw = response.choices[0]?.message?.content?.trim() || "";
    return { answer: raw.charAt(0).toUpperCase(), usage: response.usage ?? undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { answer: "", error: `Model ${modelInfo.id} failed: ${message}` };
  }
}

/**
 * Most common answer that reaches the minRequired vote threshold (else "").
 */
function getConsensusAnswer(
  answers: Array<{ model: string; answer: string }>,
  minRequired: number,
): string {
  const counts: Record<string, number> = {};
  for (const { answer } of answers) {
    if (!answer) continue;
    counts[answer] = (counts[answer] || 0) + 1;
  }
  return (
    Object.entries(counts)
      .filter(([, count]) => count >= minRequired)
      .sort(([, a], [, b]) => b - a)
      .map(([answer]) => answer)[0] || ""
  );
}

/**
 * Run the full verify flow. Streams progress via onProgress; returns the final
 * response plus per-model token usage for billing.
 */
export async function verifyFact(
  client: OpenAI,
  req: VerifyFactRequest,
  onProgress?: OnProgress,
): Promise<VerifyEngineResult> {
  const modelUsage: Record<string, Usage> = {};
  const errors: string[] = [];

  // Resolve the verification models we'll actually query.
  const selectedModelIds = VERIFICATION_MODELS.slice(
    0,
    Math.max(1, Math.min(req.totalModels, VERIFICATION_MODELS.length)),
  );
  const selectedModels = selectedModelIds
    .map((id) => getModel(id))
    .filter((m): m is ModelInfo => Boolean(m));

  await onProgress?.({
    type: "start",
    fact: req.fact,
    domain: req.domain,
    models: selectedModels.map((m) => m.id),
  });

  // 1. Binarize.
  const { requestId, questions, usage: binarizerUsage } = await binarizeFact(
    client,
    req.fact,
    req.domain,
  );
  addUsage(modelUsage, BINARIZER_MODEL, binarizerUsage);

  await onProgress?.({
    type: "claims_extracted",
    requestId,
    claims: questions.map((q) => ({
      id: q.questionID,
      claim: `${q.entity} ${q.original_claim}`.trim(),
      span_position: q.span_position,
      text_span: q.span_text,
    })),
  });

  // 2. Verify each claim by querying every selected model.
  const results: ClaimResult[] = [];
  for (const q of questions) {
    const claim = `${q.entity} ${q.original_claim}`.trim();
    await onProgress?.({ type: "claim_start", questionId: q.questionID, claim });

    const modelAnswers = await Promise.all(
      selectedModels.map(async (modelInfo) => {
        const { answer, usage, error } = await getModelAnswer(
          client,
          modelInfo,
          q.question,
          q.options,
        );
        addUsage(modelUsage, modelInfo.id, usage);
        if (error) {
          errors.push(error);
          await onProgress?.({
            type: "model_error",
            questionId: q.questionID,
            model: modelInfo.id,
            error,
          });
        } else {
          await onProgress?.({
            type: "model_result",
            questionId: q.questionID,
            model: modelInfo.id,
            answer,
          });
        }
        return { model: modelInfo.id, answer };
      }),
    );

    const consensus = getConsensusAnswer(modelAnswers, req.minRequired);
    let assessment: Assessment;
    if (!consensus) assessment = "NO CONSENSUS";
    else if (consensus === q.claimed_answer) assessment = "TRUE";
    else assessment = "FALSE";

    const result: ClaimResult = {
      id: q.questionID,
      claim,
      assessment,
      original_question: q.question,
      original_options: q.options,
      claimed_answer: q.claimed_answer,
      model_answers: modelAnswers,
      consensus_answer: consensus,
      span_position: q.span_position,
      text_span: q.span_text,
    };
    results.push(result);
    await onProgress?.({ type: "claim_verified", result });
  }

  const response: VerifyResponse = {
    requestId,
    original_fact: req.fact,
    results,
    timestamp: new Date().toISOString(),
    minRequired: req.minRequired,
    domain: req.domain,
    url: req.url,
    errors: errors.length ? errors : undefined,
  };

  return { response, modelUsage };
}
