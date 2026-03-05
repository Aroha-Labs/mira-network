import { z } from "zod";

// Common schemas
export const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

export const toolSchema = z.object({
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
  }),
});

// Chat completions
export const chatCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(messageSchema),
  stream: z.boolean().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  tools: z.array(toolSchema).optional(),
  tool_choice: z.union([z.string(), z.object({ type: z.string(), function: z.object({ name: z.string() }) })]).optional(),
});

export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>;

// Verify
export const verifyRequestSchema = z.object({
  messages: z.array(messageSchema),
  models: z.array(z.string()).min(1, "At least one model is required"),
  min_yes: z.number().min(1).optional(),
});

export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

// Flows
export const createFlowRequestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  system_prompt: z.string().min(1, "System prompt is required"),
});

export type CreateFlowRequest = z.infer<typeof createFlowRequestSchema>;

export const updateFlowRequestSchema = z.object({
  name: z.string().optional(),
  system_prompt: z.string().optional(),
});

export type UpdateFlowRequest = z.infer<typeof updateFlowRequestSchema>;

export const flowChatCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
  variables: z.record(z.string(), z.unknown()).optional(),
  stream: z.boolean().optional(),
  tools: z.array(toolSchema).optional(),
  tool_choice: z.union([z.string(), z.object({ type: z.string(), function: z.object({ name: z.string() }) })]).optional(),
});

export type FlowChatCompletionRequest = z.infer<typeof flowChatCompletionRequestSchema>;

// API Tokens
export const createApiTokenRequestSchema = z.object({
  description: z.string().optional(),
  meta_data: z.record(z.string(), z.unknown()).optional(),
});

export type CreateApiTokenRequest = z.infer<typeof createApiTokenRequestSchema>;

// Admin
export const addCreditRequestSchema = z.object({
  user_id: z.string(),
  amount: z.number(),
  description: z.string().optional(),
});

export type AddCreditRequest = z.infer<typeof addCreditRequestSchema>;

export const updateUserClaimsRequestSchema = z.object({
  roles: z.array(z.string()),
});

export type UpdateUserClaimsRequest = z.infer<typeof updateUserClaimsRequestSchema>;

export const updateSettingRequestSchema = z.object({
  value: z.unknown(),
  description: z.string().optional(),
});

export type UpdateSettingRequest = z.infer<typeof updateSettingRequestSchema>;

// Query params
export const paginationQuerySchema = z.object({
  page: z.coerce.number().min(1).optional(),
  page_size: z.coerce.number().min(1).max(100).optional(),
});

export const logsQuerySchema = paginationQuerySchema.extend({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  model: z.string().optional(),
  user_id: z.string().optional(),
});

export const usersQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  sort_by: z.string().optional(),
  sort_order: z.enum(["asc", "desc"]).optional(),
  min_credits: z.coerce.number().optional(),
  max_credits: z.coerce.number().optional(),
});
