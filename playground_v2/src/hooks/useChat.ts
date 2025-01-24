import { useCallback, useRef, useState } from "react";
import { LLM_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";

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

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: ToolCall[];
  tool_responses?: ToolResponse[];
}

interface UseChatMessagesReturn {
  messages: Message[];
  isSending: boolean;
  errorMessage: string;
  sendMessage: (userInput: string) => Promise<void>;
  refreshMessage: (index: number) => Promise<void>;
}

const handleErrorResponse = async (response: Response) => {
  const data = await response.json();
  throw new Error(
    data.detail || data.error.message || "Failed to send message"
  );
};

const decodeAndFilterChunks = (decodedString: string) => {
  return decodedString
    .split("\n")
    .flatMap((c) => c.split("data: "))
    .filter((c) => {
      if (!c) return false;
      const wordsToIgnore = ["[DONE]", "[ERROR]", "OPENROUTER PROCESSING"];
      return !wordsToIgnore.some((w) => c.includes(w));
    });
};

const processChunks = (
  chunks: string[],
  onMessage: (chunk: string) => void
) => {
  for (const chunk of chunks) {
    try {
      const data = JSON.parse(chunk);
      if (data.error) {
        throw new Error(data.error.message);
      }
      const choice = data?.choices?.[0];
      onMessage(choice?.delta?.content || choice?.message?.content || "");
    } catch (error) {
      console.error("Failed to parse response:", error);
    }
  }
};

const fetchChatCompletion = async (
  messages: Message[],
  onMessage: (chunk: string) => void,
  controller: AbortController,
  model: string,
  token: string
) => {
  if (!model) {
    throw new Error("Model is required");
  }

  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal: controller.signal,
  });

  if (!response.ok) {
    await handleErrorResponse(response);
    return;
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader!.read();
    if (done) break;

    const chunks = decodeAndFilterChunks(
      decoder.decode(value, { stream: true })
    );
    processChunks(chunks, onMessage);
  }
};

export const useChatMessages = ({
  selectedModel,
}: {
  selectedModel: string;
}): UseChatMessagesReturn => {
  const { data: userSession } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userInput: string = "") => {
      const input = userInput.trim();
      if (!input) return;

      setIsSending(true);
      setErrorMessage("");

      const userMessage: Message = { role: "user", content: input };
      const assistantMessage: Message = { role: "assistant", content: "" };
      const updatedMessages = [...messages, userMessage];

      setMessages([...updatedMessages, assistantMessage]);

      abortControllerRef.current = new AbortController();

      if (!userSession?.access_token) {
        setErrorMessage("Please login to continue.");
        return;
      }

      try {
        await fetchChatCompletion(
          updatedMessages,
          (chunk) => {
            assistantMessage.content += chunk;
            setMessages((prevMessages) => [
              ...prevMessages.slice(0, -1),
              assistantMessage,
            ]);
          },
          abortControllerRef.current,
          selectedModel,
          userSession.access_token
        );
      } catch (error) {
        const err = error as Error;
        if (err.name !== "AbortError") {
          console.error("Failed to send message:", error);
          setMessages((prevMessages) => prevMessages.slice(0, -2));
          setErrorMessage(
            err.message || "Failed to send message. Please try again."
          );
        }
      } finally {
        setIsSending(false);
      }
    },
    [messages, userSession, selectedModel]
  );

  const refreshMessage = async (index: number) => {
    if (!userSession?.access_token) {
      setErrorMessage("Please login to continue.");
      return;
    }

    const messagesToKeep = messages.slice(0, index + 1);
    setMessages(messagesToKeep);

    setIsSending(true);
    setErrorMessage("");

    const assistantMessage: Message = { role: "assistant", content: "" };
    const updatedMessages = [...messagesToKeep, assistantMessage];

    setMessages(updatedMessages);

    setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    }, 200);

    const newMessages = messagesToKeep;

    abortControllerRef.current = new AbortController();

    try {
      await fetchChatCompletion(
        newMessages,
        (chunk) => {
          assistantMessage.content += chunk;
          setMessages((prevMessages) => [
            ...prevMessages.slice(0, -1),
            assistantMessage,
          ]);
        },
        abortControllerRef.current,
        selectedModel,
        userSession.access_token
      );
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Failed to send message:", error);
        setMessages((prevMessages) => prevMessages.slice(0, -1));
        setErrorMessage("Failed to send message. Please try again.");
      }
    } finally {
      setIsSending(false);
    }
  };

  return { messages, isSending, errorMessage, sendMessage, refreshMessage };
};
