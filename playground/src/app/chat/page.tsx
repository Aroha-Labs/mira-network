"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import ChatBubble from "src/components/ChatBubble";
// import SystemPromptInput from "src/components/SystemPromptInput";
import { ChatBubbleBottomCenterIcon, StopIcon } from "@heroicons/react/24/outline";
import { Cog6ToothIcon } from "@heroicons/react/24/solid";
import Loading, { Spinner } from "src/components/PageLoading";
import AutoGrowTextarea from "src/components/AutoGrowTextarea";
import ConfirmModal from "src/components/ConfirmModal";
import { LLM_BASE_URL } from "src/config";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "src/hooks/useSession";
import { Message, sanitizeText } from "src/utils/chat";
import { Brain } from "lucide-react";
import { trackEvent } from "src/lib/mira";
import api from "src/lib/axios";

const fetchChatCompletion = async (
  messages: Message[],
  onMessage: (message: Partial<Message>) => void,
  controller: AbortController,
  model: string,
  token: string,
  reasoningEffort: "disabled" | "low" | "medium" | "high" | undefined,
  maxTokens?: number
) => {
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
      reasoning_effort: reasoningEffort,
      max_tokens: maxTokens || undefined,
    }),
    signal: controller.signal,
  });

  if (!response.ok) {
    try {
      const data = await response.json();
      throw new Error(data.detail || data.error.message || "Failed to send message");
    } catch (error) {
      throw error;
    }
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let done = false;

  while (!done) {
    const { value, done: doneReading } = await reader!.read()!;
    done = doneReading;

    if (doneReading) continue;

    const chunks = decoder
      .decode(value, { stream: true })
      .split("\n")
      .flatMap((c) => c.split("data: "))
      .filter((c) => {
        if (!c) return false;
        const wordsToIgnore = ["[DONE]", "[ERROR]", "OPENROUTER PROCESSING"];
        return !wordsToIgnore.some((w) => c.includes(w));
      });

    for (const chunk of chunks) {
      let data;
      try {
        data = JSON.parse(chunk);

        if (data.error) {
          throw new Error(data.error.message);
        }
        const choice = data.choices[0];
        if (choice.delta) {
          const message: Partial<Message> = {};
          if (choice.delta.content !== undefined) {
            message.content = sanitizeText(choice.delta.content);
          }
          if (choice.delta.reasoning !== undefined) {
            message.reasoning = sanitizeText(choice.delta.reasoning);
          }
          if (Object.keys(message).length > 0) {
            onMessage(message);
          }
        } else if (choice.message) {
          onMessage({
            content: sanitizeText(choice.message.content),
            reasoning: sanitizeText(choice.message.reasoning),
          });
        }
      } catch (error) {
        console.error("Failed to parse response:", error);
      }
    }
  }
};

const fetchSupportedModels = async () => {
  const response = await api.get("/v1/models");
  console.log("Supported models:", response.data);
  return response.data.data.map((model: { id: string }) => model.id);
};

export default function Chat() {
  const { data: userSession, isLoading } = useSession();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [systemPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState<
    "disabled" | "low" | "medium" | "high"
  >("disabled");
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined);

  const {
    data: supportedModelsData,
    error: supportedModelsError,
    isLoading: isModelsLoading,
  } = useQuery<string[]>({
    queryKey: ["supportedModels"],
    queryFn: fetchSupportedModels,
  });

  useEffect(() => {
    if (supportedModelsData) {
      setSelectedModel(supportedModelsData[0]);
    }
  }, [supportedModelsData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const supportedModelsOptions = useMemo(() => {
    if (!supportedModelsData) return [];
    return supportedModelsData.map((m) => {
      const parts = m.split("/");
      const provider = parts[0];
      const modelName = parts[parts.length - 1];
      
      // Add provider indicator to the label
      let label = modelName;
      if (provider === "vllm") {
        label = `${modelName} (GPU)`;
      } else if (provider === "openrouter") {
        label = `${modelName} (Proxy)`;
      }
      
      return { value: m, label, provider };
    });
  }, [supportedModelsData]);

  // const handleSystemPromptChange = (v: string) => {
  //   setSystemPrompt(v);
  // };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
  };

  const handleReasoningEffortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setReasoningEffort(e.target.value as "disabled" | "low" | "medium" | "high");
  };

  const handleMaxTokensChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
    setMaxTokens(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const sendMessage = async (userInput: string = "") => {
    const i = (userInput || input).trim();

    if (!i) return;
    if (!userSession?.access_token) {
      setErrorMessage("Please login to continue.");
      return;
    }

    trackEvent("chat_message_sent", {
      model: selectedModel,
      reasoning_effort: reasoningEffort,
      message_length: i.length,
    });

    setIsSending(true);
    setErrorMessage("");

    const userMessage: Message = { role: "user", content: i };
    const assistantMessage: Message = {
      role: "assistant",
      content: "",
      reasoning: "",
    };
    const updatedMessages = [...messages, userMessage];

    setMessages([...updatedMessages, assistantMessage]);
    setInput("");

    setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    }, 200);

    const sp: Message = { role: "system", content: systemPrompt.trim() };
    const newMessages = sp.content ? [sp, ...updatedMessages] : updatedMessages;

    abortControllerRef.current = new AbortController();

    try {
      await fetchChatCompletion(
        newMessages,
        (chunk) => {
          if (chunk.content !== undefined) {
            assistantMessage.content = (assistantMessage.content || "") + chunk.content;
          }
          if (chunk.reasoning !== undefined) {
            assistantMessage.reasoning =
              (assistantMessage.reasoning || "") + chunk.reasoning;
          }
          setMessages((prevMessages) => [
            ...prevMessages.slice(0, -1),
            { ...assistantMessage },
          ]);
        },
        abortControllerRef.current,
        selectedModel,
        userSession.access_token,
        reasoningEffort === "disabled" ? undefined : reasoningEffort,
        maxTokens
      );
    } catch (error) {
      const err = error as Error;
      if (err.name !== "AbortError") {
        console.error("Failed to send message:", error);
        setMessages((prevMessages) => prevMessages.slice(0, -2));
        setInput(userMessage.content);
        setErrorMessage(err.message || "Failed to send message. Please try again.");
      }
    } finally {
      setIsSending(false);
    }
  };

  const sendContinueMessage = async () => {
    // setInput("continue");
    await sendMessage("continue");
  };

  const handleDeleteMessage = (index: number) => {
    setMessages([...messages.slice(0, index), ...messages.slice(index + 1)]);
  };

  const handleEditMessage = (index: number) => {
    const messageToEdit = messages[index];
    setInput(messageToEdit.content);
    setMessages(messages.slice(0, index));
  };

  const handleRefreshMessage = async (index: number) => {
    if (!userSession?.access_token) {
      setErrorMessage("Please login to continue.");
      return;
    }

    const messagesToKeep = messages.slice(0, index + 1);
    setMessages(messagesToKeep);
    setInput("");

    setIsSending(true);
    setErrorMessage("");

    const assistantMessage: Message = {
      role: "assistant",
      content: "",
      reasoning: "",
    };
    const updatedMessages = [...messagesToKeep, assistantMessage];

    setMessages(updatedMessages);

    setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    }, 200);

    const sp: Message = { role: "system", content: systemPrompt.trim() };
    const newMessages = sp.content ? [sp, ...messagesToKeep] : messagesToKeep;

    abortControllerRef.current = new AbortController();

    try {
      await fetchChatCompletion(
        newMessages,
        (chunk) => {
          if (chunk.content !== undefined) {
            assistantMessage.content = (assistantMessage.content || "") + chunk.content;
          }
          if (chunk.reasoning !== undefined) {
            assistantMessage.reasoning =
              (assistantMessage.reasoning || "") + chunk.reasoning;
          }
          setMessages((prevMessages) => [
            ...prevMessages.slice(0, -1),
            { ...assistantMessage },
          ]);
        },
        abortControllerRef.current,
        selectedModel,
        userSession.access_token,
        reasoningEffort === "disabled" ? undefined : reasoningEffort,
        maxTokens
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

  const handleClearHistory = () => {
    trackEvent("chat_clear_history", {});
    setShowConfirmModal(true);
  };

  const confirmClearHistory = () => {
    setMessages([]);
    setShowConfirmModal(false);
  };

  const cancelClearHistory = () => {
    setShowConfirmModal(false);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  if (isLoading || isModelsLoading) {
    return <Loading fullPage />;
  }

  if (supportedModelsError) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-red-500">Error loading models</div>
      </div>
    );
  }

  if (!userSession?.user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Link
          href="/login"
          className="p-4 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
        >
          Login
        </Link>
      </div>
    );
  }

  const userInfo = userSession.user.user_metadata as {
    name: string;
    avatar_url: string;
  };

  return (
    <div className="flex flex-col flex-1 items-center min-h-screen bg-gray-50">
      <div className="flex sticky top-0 justify-between items-center p-3 w-full bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center space-x-2">
          <select
            value={selectedModel}
            onChange={handleModelChange}
            className="p-2 text-sm bg-white rounded-md border border-gray-300 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400"
          >
            {supportedModelsOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="p-2 text-sm text-gray-600 rounded-md transition-colors hover:text-red-500 hover:bg-red-50 focus:outline-none"
              title="Clear chat history"
            >
              Clear History
            </button>
          )}
        </div>

        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`p-2 rounded-md transition-colors focus:outline-none ${showConfig ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
          title="Configuration"
        >
          <Cog6ToothIcon className="w-5 h-5" />
        </button>
      </div>

      {showConfig && (
        <div className="z-0 p-4 w-full bg-white border-b border-gray-200 shadow-sm transition-all duration-300 ease-in-out">
          <div className="flex flex-wrap gap-6 mx-auto max-w-3xl">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="reasoning-effort"
                className="text-sm font-medium text-gray-700"
              >
                Reasoning Depth
              </label>
              <div className="relative">
                <select
                  id="reasoning-effort"
                  value={reasoningEffort}
                  onChange={handleReasoningEffortChange}
                  className="py-2 pr-8 pl-10 w-56 text-sm font-medium bg-white rounded-lg border border-gray-300 shadow-sm transition-all duration-200 ease-in-out appearance-none cursor-pointer hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Select reasoning depth"
                >
                  <option value="disabled" className="text-gray-700 bg-gray-50">
                    💡 No Reasoning
                  </option>
                  <option value="low" className="text-blue-700 bg-blue-50">
                    🤔 Basic Reasoning
                  </option>
                  <option value="medium" className="text-yellow-700 bg-yellow-50">
                    🧐 Detailed Reasoning
                  </option>
                  <option value="high" className="text-red-700 bg-red-50">
                    🤯 Deep Reasoning
                  </option>
                </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <Brain
                    className={`w-4 h-4 ${
                      reasoningEffort === "disabled"
                        ? "text-gray-400"
                        : reasoningEffort === "low"
                          ? "text-blue-500"
                          : reasoningEffort === "medium"
                            ? "text-yellow-500"
                            : "text-red-500"
                    }`}
                  />
                </div>
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Choose how much reasoning the AI should use
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="max-tokens" className="text-sm font-medium text-gray-700">
                Max Output Tokens
              </label>
              <input
                id="max-tokens"
                type="number"
                value={maxTokens || ""}
                onChange={handleMaxTokensChange}
                placeholder="Unlimited"
                className="p-2 w-40 text-sm rounded-md border border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400"
                min="1"
                max="8192"
              />
              <p className="mt-1 text-xs text-gray-500">
                Limit response length (leave empty for default)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* <SystemPromptInput onChange={handleSystemPromptChange} /> */}
      <div className="overflow-y-auto flex-1 p-4 space-y-6 w-full">
        {messages.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-96 text-gray-500">
            <ChatBubbleBottomCenterIcon className="mb-6 w-16 h-16 text-gray-300" />
            <div className="mb-2 text-xl font-medium">Start chatting with AI</div>
            <div className="max-w-md text-sm text-center text-gray-400">
              Send a message to begin your conversation. Use the configuration options to
              customize the AI&apos;s response.
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <ChatBubble
              key={index}
              msg={msg}
              userInfo={userInfo}
              onDelete={() => handleDeleteMessage(index)}
              onEdit={() => handleEditMessage(index)}
              onRefresh={() => handleRefreshMessage(index)}
              isLoading={isSending}
            />
          ))
        )}

        {!isSending && messages.length ? (
          <div className="flex relative -top-4 justify-start px-4 mx-auto max-w-2xl">
            <button
              className="text-sm text-gray-400 underline hover:text-gray-600 focus:outline-hidden"
              onClick={sendContinueMessage}
            >
              Continue
            </button>
          </div>
        ) : null}

        {messages.length > 0 && (
          <div className="flex flex-col items-center text-center text-gray-500">
            {isSending ? <Spinner /> : <div>End of messages</div>}
            {!isSending && (
              <button
                className="text-sm text-blue-400 underline hover:text-gray-600 focus:outline-hidden"
                onClick={handleClearHistory}
              >
                Clean History
              </button>
            )}
          </div>
        )}
      </div>
      <div className="sticky bottom-0 p-4 w-full bg-white border-t border-gray-200 shadow-lg">
        <div className="flex flex-col gap-2 mx-auto max-w-3xl">
          <div className="flex justify-center space-x-2">
            <AutoGrowTextarea
              className="flex-1 p-3 text-base rounded-l-lg border border-gray-300 shadow-sm transition-colors resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Shift+Enter for new line)"
              disabled={isSending}
            />
            <button
              className="px-4 py-2 text-white bg-blue-600 rounded-r-lg shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => sendMessage(input)}
              disabled={isSending}
            >
              {isSending ? (
                <span className="flex items-center">
                  <Spinner className="mr-2 w-4 h-4" />
                  Sending
                </span>
              ) : (
                "Send"
              )}
            </button>
            {isSending && (
              <button
                className="p-2 text-white bg-red-500 rounded-md shadow-sm transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                onClick={handleStop}
                title="Stop generating"
              >
                <StopIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          {errorMessage && (
            <div className="px-3 py-2 mt-2 text-sm text-center text-red-600 bg-red-50 rounded-md border border-red-200">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
      {showConfirmModal && (
        <ConfirmModal
          title="Confirm Clear History"
          onConfirm={confirmClearHistory}
          onCancel={cancelClearHistory}
        >
          Are you sure you want to clear the chat history?
        </ConfirmModal>
      )}
    </div>
  );
}
