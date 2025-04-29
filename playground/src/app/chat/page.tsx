"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import ChatBubble from "src/components/ChatBubble";
// import SystemPromptInput from "src/components/SystemPromptInput";
import { ChatBubbleBottomCenterIcon, StopIcon } from "@heroicons/react/24/outline";
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
  reasoningEffort: "disabled" | "low" | "medium" | "high" | undefined
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState<
    "disabled" | "low" | "medium" | "high"
  >("disabled");

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
      const s = m.split("/");
      return { value: m, label: s[s.length - 1] };
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

    trackEvent('chat_message_sent', {
      model: selectedModel,
      reasoning_effort: reasoningEffort,
      message_length: i.length
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
        reasoningEffort === "disabled" ? undefined : reasoningEffort
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
        reasoningEffort === "disabled" ? undefined : reasoningEffort
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
    trackEvent('chat_clear_history', {});
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500">Error loading models</div>
      </div>
    );
  }

  if (!userSession?.user) {
    return (
      <div className="flex items-center justify-center h-screen">
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
    <div className="flex flex-col items-center flex-1 bg-gray-100">
      <div className="flex self-start justify-center p-1 m-1 bg-white">
        <select
          value={selectedModel}
          onChange={handleModelChange}
          className="p-1 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        >
          {supportedModelsOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {/* <SystemPromptInput onChange={handleSystemPromptChange} /> */}
      <div className="flex-1 w-full p-4 space-y-6 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <ChatBubbleBottomCenterIcon className="w-12 h-12 mb-4" />
            <div>Start chatting...</div>
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
          <div className="relative flex justify-start max-w-2xl px-4 mx-auto -top-4">
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
      <div className="sticky bottom-0 w-full p-4 bg-white border-t border-gray-300">
        <div className="flex flex-col max-w-2xl gap-2 mx-auto">
          <div className="flex justify-center space-x-2">
            <div className="relative flex items-center gap-2">
              <select
                value={reasoningEffort}
                onChange={handleReasoningEffortChange}
                className="py-2 pl-10 pr-8 text-sm font-medium transition-all duration-200 ease-in-out bg-white border border-gray-300 rounded-lg shadow-sm appearance-none cursor-pointer hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="absolute transform -translate-y-1/2 pointer-events-none left-3 top-1/2">
                <Brain
                  className={`w-4 h-4 ${reasoningEffort === "disabled"
                    ? "text-gray-400"
                    : reasoningEffort === "low"
                      ? "text-blue-500"
                      : reasoningEffort === "medium"
                        ? "text-yellow-500"
                        : "text-red-500"
                    }`}
                />
              </div>
              <div className="absolute transform -translate-y-1/2 pointer-events-none right-2 top-1/2">
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
            <AutoGrowTextarea
              className="flex-1 p-2 border border-gray-300 resize-none rounded-l-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Shift+Enter for new line)"
              disabled={isSending}
            />
            <button
              className="p-2 text-white bg-blue-500 rounded-r-md hover:bg-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              onClick={() => sendMessage(input)}
              disabled={isSending}
            >
              {isSending ? "Sending..." : "Send"}
            </button>
            {isSending && (
              <button
                className="p-2 text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                onClick={handleStop}
              >
                <StopIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          {errorMessage && (
            <div className="mt-2 text-sm text-center text-red-500">{errorMessage}</div>
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
