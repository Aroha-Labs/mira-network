// Model configuration for the rich fact-verification feature.
// These reference IDs from the shared MODELS registry (src/lib/models.ts), so
// verify only ever uses models the AI Gateway already supports. Edit freely.

// Model used to binarize a statement into multiple-choice fact-check questions.
// Needs solid tool-calling — keep this a capable model.
export const BINARIZER_MODEL = "gpt-5.2";

// Models queried per claim to vote on the answer. Diversity across providers
// makes consensus meaningful. At most `totalModels` of these are used per run.
export const VERIFICATION_MODELS = [
  "gpt-5.2",
  "claude-haiku-4.5",
  "gemini-3-flash",
];

// Forced tool the binarizer must call. Ported verbatim from
// verify.mira.network/backend/src/prompts/system.tools.binarizer.json
export const BINARIZER_TOOL = {
  type: "function",
  function: {
    name: "generate_fact_check_questions",
    description:
      "Extracts objective entity-claim pairs from a statement and generates targeted quiz questions to test each claim",
    parameters: {
      type: "object",
      properties: {
        requestID: { type: "string" },
        source_statement: { type: "string" },
        metadata: { type: "object" },
        timestamp: { type: "string" },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              entity: { type: "string" },
              original_claim: { type: "string" },
              question: { type: "string" },
              span_position: {
                type: "array",
                items: { type: "number" },
                minItems: 2,
                maxItems: 2,
              },
              span_text: { type: "string" },
              options: {
                type: "object",
                properties: {
                  A: { type: "string" },
                  B: { type: "string" },
                  C: { type: "string" },
                  D: { type: "string" },
                },
                required: ["A", "B", "C", "D"],
              },
              expected_answer: { type: "string", enum: ["A", "B", "C", "D"] },
              claimed_answer: { type: "string", enum: ["A", "B", "C", "D"] },
              questionID: { type: "string" },
            },
            required: [
              "entity",
              "original_claim",
              "question",
              "span_position",
              "options",
              "expected_answer",
              "claimed_answer",
              "questionID",
            ],
          },
        },
      },
      required: ["requestID", "source_statement", "metadata", "timestamp", "questions"],
    },
  },
} as const;
