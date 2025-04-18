import { supabase } from "src/utils/supabase/client";
import api from "src/lib/axios";

export interface TextContentPart {
  type: "text";
  text: string;
}

export interface ImageContentPart {
  type: "image_url";
  image_url: {
    url: string; // Can be data URL or web URL
  };
}

export type MessageContentPart = TextContentPart | ImageContentPart;

export interface Message {
  role: "user" | "assistant" | "system";
  // Allow content to be a string (for simple text messages or assistant responses)
  // or an array of content parts (for user messages with text and images).
  content: string | MessageContentPart[];
  tool_calls?: ToolCall[];
  tool_responses?: ToolResponse[];
}

interface StreamProcessor {
  onMessage: (chunk: string | Message) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
}

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  items?: {
    type: string;
  };
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface Tool {
  type: "function";
  function: FunctionDefinition;
}

interface ChatCompletionOptions {
  messages: Message[];
  model: string;
  variables?: Record<string, string>;
  systemPrompt?: string;
  flowId?: number;
  endpoint: string;
  tools?: Tool[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  index: number;
  response?: string;
}

export interface ToolResponse {
  tool_call_id: string;
  content: string;
}

export interface Flow {
  id: number;
  name: string;
  system_prompt: string;
  updated_at: string;
  variables: string[];
  tools?: Tool[];
}

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  return {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function processStream(
  response: Response,
  { onMessage, onError, onDone }: StreamProcessor
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No reader available");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === "") continue;

        if (trimmedLine.startsWith("data: ")) {
          const data = trimmedLine.slice(5).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            console.log("Parsed SSE data:", parsed); // Enable debug log to see the response structure

            // Direct content field (current implementation)
            if (parsed.content) {
              onMessage(parsed.content);
            }
            // OpenAI-style format with choices and delta
            else if (parsed.choices && parsed.choices.length > 0) {
              const choice = parsed.choices[0];
              if (choice.delta && choice.delta.content) {
                onMessage(choice.delta.content);
              } else if (choice.message && choice.message.content) {
                onMessage(choice.message.content);
              }
            }
            // Log unhandled formats to help debug
            else {
              console.log("Unhandled SSE data format:", parsed);
            }

            if (parsed.tool_calls) {
              const toolCalls = parsed.tool_calls.map(
                (call: {
                  id?: string;
                  function?: {
                    name?: string;
                    arguments?: string;
                  };
                  index?: number;
                }) => ({
                  id: call.id || "",
                  name: call.function?.name || "",
                  arguments: call.function?.arguments || "",
                  index: call.index || 0,
                })
              );

              // Only send tool calls if they have meaningful data
              if (
                toolCalls.some(
                  (call: { id?: string; name?: string; arguments?: string }) =>
                    call.id && call.name && call.arguments
                )
              ) {
                onMessage({
                  role: "assistant",
                  content: "",
                  tool_calls: toolCalls,
                } as Message);
              }
            }
            if (parsed.tool_response) {
              onMessage({
                role: "assistant",
                content: "",
                tool_responses: [
                  {
                    content: parsed.tool_response.content,
                    tool_call_id: parsed.tool_response.tool_call_id || "",
                  },
                ],
              } as Message);
            }
          } catch (error) {
            console.warn("Parse error for line:", {
              line: trimmedLine,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }
    onDone?.();
  } catch (error) {
    console.error("Stream processing error:", error);
    if ((error as Error).name === "AbortError") {
      throw error;
    }
    onError?.(error as Error);
  } finally {
    reader.releaseLock();
  }
}

interface ChatRequestBody {
  messages: Message[];
  model: string;
  variables?: Record<string, string>;
  tools?: Tool[];
  stream: boolean;
  model_provider?: {
    base_url: string;
    api_key: string;
  } | null;
  flow_id?: number;
}

interface FlowRequestBody {
  req: {
    system_prompt?: string;
    name: string;
  };
  chat: ChatRequestBody;
}

export async function streamChatCompletion(
  options: ChatCompletionOptions,
  controller: AbortController,
  handlers: StreamProcessor
) {
  try {
    const headers = await getAuthHeaders();
    const { endpoint, flowId, systemPrompt, tools, ...chatOptions } = options;

    // Convert tools to match backend's Tool model exactly
    const serializedTools = tools?.map((tool) => {
      const toolDict = {
        type: "function",
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        },
      };
      // Convert to a plain object to ensure no class instances
      return JSON.parse(JSON.stringify(toolDict));
    });

    let body;
    if (endpoint === "/v1/chat/completions") {
      // Direct chat completion - include system prompt in messages
      const messages = systemPrompt
        ? [{ role: "system" as const, content: systemPrompt }, ...chatOptions.messages]
        : chatOptions.messages;

      // Replace variables in system prompt if both are present
      if (systemPrompt && options.variables) {
        const systemMessage = messages[0];
        // Only replace if content is a string
        if (typeof systemMessage.content === "string") {
          let systemText = systemMessage.content;
          Object.entries(options.variables).forEach(([key, value]) => {
            systemText = systemText.replace(new RegExp(`{{${key}}}`, "g"), value);
          });
          console.log("Replaced variables in system prompt", systemText);
          messages[0] = { ...systemMessage, content: systemText };
        } else {
          // Handle the case where system message content is not a string (e.g., log a warning)
          // This shouldn't happen for system prompts, but good to have a check.
          console.warn(
            "System message content is not a string, cannot replace variables."
          );
        }
      }

      body = {
        ...chatOptions,
        messages,
        tools: serializedTools,
        stream: true,
      } as ChatRequestBody;
    } else {
      // Flow request - use existing format
      body = flowId
        ? ({
          ...chatOptions,
          tools: serializedTools,
          stream: true,
        } as ChatRequestBody)
        : ({
          req: {
            system_prompt: systemPrompt,
            name: "Test Flow",
          },
          chat: {
            ...chatOptions,
            tools: serializedTools,
            stream: true,
          },
        } as FlowRequestBody);
    }

    let url = `${api.defaults.baseURL}${endpoint}`;

    if (flowId && endpoint === "/v1/chat/completions") {
      url = `${url}?flow_id=${flowId}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail ||
        errorData.message ||
        `Request failed with status ${response.status}`
      );
    }

    await processStream(response, handlers);
  } catch (error) {
    console.error("Chat completion error:", error);
    if (error instanceof Error) {
      handlers.onError?.(error);
    } else {
      handlers.onError?.(new Error("Unknown error occurred"));
    }
    throw error;
  }
}

export interface VerificationRequest {
  messages: Message[];
  models: string[];
  min_yes: number;
}

export interface VerificationResponse {
  result: "yes" | "no";
  results: {
    result: "yes" | "no";
    response: {
      result: "yes" | "no";
      content: string;
    };
    model: string;
  }[];
}

export const verifyMessages = async (
  request: VerificationRequest
): Promise<VerificationResponse> => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${api.defaults.baseURL}/v1/verify`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Verification failed: ${response.statusText}`);
  }

  return response.json();
};
