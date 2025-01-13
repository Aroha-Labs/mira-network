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

interface Message {
  role: string;
  content: string;
}

const fetchChatCompletion = async (
  messages: Message[],
  onMessage: (chunk: string) => void,
  controller: AbortController,
  model: string,
  token: string
) => {
  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      // model: "llama3.2",
      messages,
      stream: true,
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
      // split by newline and `data: `
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
        onMessage(choice.delta ? choice.delta.content : choice.message.content);
      } catch (error) {
        console.error("Failed to parse response:", error);
      }
    }
  }
};

const fetchSupportedModels = async () => {
  const response = await fetch(`${LLM_BASE_URL}/models`);
  if (!response.ok) {
    throw new Error("Failed to fetch supported models");
  }
  const data = await response.json();
  return data.data.map((model: { id: string }) => model.id);
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

    setIsSending(true);
    setErrorMessage("");

    const userMessage = { role: "user", content: i };
    const assistantMessage = { role: "assistant", content: "" };
    const updatedMessages = [...messages, userMessage];

    setMessages([...updatedMessages, assistantMessage]);
    setInput("");

    setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    }, 200);

    // if system prompt is not empty, send it as the first message
    const sp: Message = { role: "system", content: systemPrompt.trim() };
    const newMessages = sp.content ? [sp, ...updatedMessages] : updatedMessages;

    abortControllerRef.current = new AbortController();

    try {
      await fetchChatCompletion(
        newMessages,
        (chunk) => {
          assistantMessage.content += chunk;
          setMessages((prevMessages) => [...prevMessages.slice(0, -1), assistantMessage]);
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

    const assistantMessage = { role: "assistant", content: "" };
    const updatedMessages = [...messagesToKeep, assistantMessage];

    setMessages(updatedMessages);

    setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    }, 200);

    // if system prompt is not empty, send it as the first message
    const sp: Message = { role: "system", content: systemPrompt.trim() };
    const newMessages = sp.content ? [sp, ...messagesToKeep] : messagesToKeep;

    abortControllerRef.current = new AbortController();

    try {
      await fetchChatCompletion(
        newMessages,
        (chunk) => {
          assistantMessage.content += chunk;
          setMessages((prevMessages) => [...prevMessages.slice(0, -1), assistantMessage]);
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

  const handleClearHistory = () => {
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
          className="bg-blue-500 text-white p-4 rounded-lg hover:bg-blue-600"
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
    <div className="flex flex-col items-center bg-gray-100 flex-1">
      <div className="m-1 p-1 bg-white flex justify-center self-start">
        <select
          value={selectedModel}
          onChange={handleModelChange}
          className="border border-gray-300 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 "
        >
          {supportedModelsOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {/* <SystemPromptInput onChange={handleSystemPromptChange} /> */}
      <div className="flex-1 overflow-y-auto w-full p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <ChatBubbleBottomCenterIcon className="h-12 w-12 mb-4" />
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
          <div className="max-w-2xl mx-auto flex justify-start px-4 -top-4 relative">
            <button
              className="text-sm text-gray-400 hover:text-gray-600 underline focus:outline-none"
              onClick={sendContinueMessage}
            >
              Continue
            </button>
          </div>
        ) : null}

        {messages.length > 0 && (
          <div className="text-center text-gray-500 flex flex-col items-center">
            {isSending ? <Spinner /> : <div>End of messages</div>}
            {!isSending && (
              <button
                className="text-sm text-blue-400 hover:text-gray-600 underline focus:outline-none"
                onClick={handleClearHistory}
              >
                Clean History
              </button>
            )}
          </div>
        )}
      </div>
      <div className="w-full p-4 bg-white border-t border-gray-300 sticky bottom-0">
        <div className="max-w-2xl mx-auto flex justify-center space-x-2">
          <AutoGrowTextarea
            className="flex-1 border border-gray-300 p-2 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Shift+Enter for new line)"
            disabled={isSending}
          />
          <button
            className="bg-blue-500 text-white p-2 rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => sendMessage(input)}
            disabled={isSending}
          >
            {isSending ? "Sending..." : "Send"}
          </button>
          {isSending && (
            <button
              className="bg-red-500 text-white p-2 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
              onClick={handleStop}
            >
              <StopIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        {errorMessage && (
          <div className="text-red-500 text-sm mt-2 text-center">{errorMessage}</div>
        )}
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
