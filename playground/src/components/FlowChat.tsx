"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AutoGrowTextarea from "./AutoGrowTextarea";
import { StopIcon } from "@heroicons/react/24/solid";
import { ChatBubbleBottomCenterIcon } from "@heroicons/react/24/outline";
import ConfirmModal from "./ConfirmModal";
import ChatBubble from "./ChatBubble";
import { Spinner } from "./PageLoading";
import api from "src/lib/axios";
import { API_BASE_URL } from "src/config";

interface FlowChatProps {
  flow: {
    id: number;
    name: string;
    system_prompt: string;
    variables: string[];
  };
  onClose: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const fetchSupportedModels = async () => {
  const response = await api.get("/v1/models");
  if (response.status !== 200) throw new Error("Failed to fetch models");
  return response.data.data.map((model: { id: string }) => model.id);
};

// const processStreamResponse = async (
//   response: Response,
//   onChunk: (chunk: string) => void
// ) => {
//   const reader = response.body?.getReader();
//   if (!reader) throw new Error("No reader available");

//   const decoder = new TextDecoder();
//   let buffer = "";

//   try {
//     while (true) {
//       const { done, value } = await reader.read();
//       if (done) break;

//       // Decode the chunk and add it to buffer
//       buffer += decoder.decode(value, { stream: true });

//       // Split on double newlines which typically separate SSE messages
//       const lines = buffer.split("\n\n");
//       // Keep the last (potentially incomplete) part in the buffer
//       buffer = lines.pop() || "";

//       for (const line of lines) {
//         // Skip empty lines
//         if (!line.trim()) continue;

//         // Handle lines that start with "data: "
//         if (line.includes("data: ")) {
//           const data = line.replace(/^data: /, "").trim();
//           if (data === "[DONE]") continue;

//           try {
//             const parsed = JSON.parse(data);
//             // Check for OPENROUTER PROCESSING message
//             if (parsed.choices?.[0]?.delta?.content) {
//               onChunk(parsed.choices[0].delta.content);
//             }
//           } catch (e) {
//             console.warn("Failed to parse chunk:", data);
//           }
//         }
//       }
//     }
//   } catch (error) {
//     if ((error as Error).name === "AbortError") {
//       throw error;
//     }
//     console.error("Error processing stream:", error);
//   } finally {
//     reader.releaseLock();
//   }
// };
const fetchChatCompletion = async (
  messages: Message[],
  onMessage: (chunk: string) => void,
  controller: AbortController,
  model: string,
  variables: Record<string, string>,
  flowId: number
) => {
  const response = await api.post(
    `${API_BASE_URL}/v1/flow/${flowId}/chat/completions`,
    {
      model,
      messages,
      variables,
      stream: true,
    },
    {
      signal: controller.signal,
      responseType: "text",
      onDownloadProgress: (progressEvent) => {
        const text = progressEvent.event.target.responseText;
        const newText = text.substring(progressEvent.loaded);

        // Split on data: and process each SSE message
        const lines = newText.split("data: ");
        for (const line of lines) {
          if (!line.trim()) continue;

          // Skip known non-content messages
          if (
            line.includes("[DONE]") ||
            line.includes("OPENROUTER PROCESSING") ||
            line.includes('"finish_reason":"stop"')
          ) {
            continue;
          }

          try {
            const data = JSON.parse(line);
            // Extract content from the delta or message
            if (data.choices?.[0]?.delta?.content) {
              onMessage(data.choices[0].delta.content);
            } else if (data.choices?.[0]?.message?.content) {
              onMessage(data.choices[0].message.content);
            }
          } catch (e) {
            const error = e as Error;
            // Only log if it's not an empty or partial chunk

            // TODO: report to new relic
            console.error("Error:", error);

            if (line.trim() && !line.includes('"content":""')) {
              console.debug("Failed to parse chunk:", line);
            }
          }
        }
      },
    }
  );

  if (response.status !== 200) {
    const data = response.data;
    throw new Error(data.detail || data.error?.message || "Failed to send message");
  }
};

export default function FlowChat({ flow, onClose }: FlowChatProps) {
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const { data: supportedModelsData } = useQuery<string[]>({
    queryKey: ["supportedModels"],
    queryFn: fetchSupportedModels,
  });

  const supportedModelsOptions = useMemo(() => {
    if (!supportedModelsData) return [];
    return supportedModelsData.map((m) => {
      const s = m.split("/");
      return { value: m, label: s[s.length - 1] };
    });
  }, [supportedModelsData]);

  useEffect(() => {
    if (supportedModelsData) {
      setSelectedModel(supportedModelsData[0]);
    }
  }, [supportedModelsData]);

  const handleVariableChange = (variable: string, value: string) => {
    setVariables((prev) => ({ ...prev, [variable]: value }));
  };

  const handleDeleteMessage = (index: number) => {
    setMessages([...messages.slice(0, index), ...messages.slice(index + 1)]);
  };

  const handleEditMessage = (index: number) => {
    const messageToEdit = messages[index];
    setUserInput(messageToEdit.content);
    setMessages(messages.slice(0, index));
  };

  const handleRefreshMessage = async (index: number) => {
    const messagesToKeep = messages.slice(0, index + 1);
    setMessages(messagesToKeep);
    setUserInput("");
    setIsLoading(true);
    setErrorMessage("");

    const assistantMessage = { role: "assistant", content: "" } as Message;
    const updatedMessages = [...messagesToKeep, assistantMessage];
    setMessages(updatedMessages);

    abortControllerRef.current = new AbortController();

    try {
      await fetchChatCompletion(
        messagesToKeep,
        (chunk) => {
          console.log("Received refresh chunk:", chunk);
          assistantMessage.content += chunk;
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            if (lastMessage.role === "assistant") {
              return [
                ...prevMessages.slice(0, -1),
                { ...lastMessage, content: assistantMessage.content },
              ];
            }
            return [...prevMessages, assistantMessage];
          });
        },
        abortControllerRef.current,
        selectedModel,
        variables,
        flow.id
      );
    } catch (error) {
      const err = error as Error;
      if (err.name !== "AbortError") {
        console.error("Failed to refresh message:", error);
        setMessages(messagesToKeep);
        setErrorMessage("Failed to refresh message. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (continueMessage?: string) => {
    const messageToSend = continueMessage || userInput.trim();
    if (!messageToSend) return;

    try {
      setIsLoading(true);
      setErrorMessage("");
      const userMessage = { role: "user" as const, content: messageToSend };
      const assistantMessage = { role: "assistant" as const, content: "" };
      const updatedMessages = [...messages, userMessage];

      setMessages([...updatedMessages, assistantMessage]);
      setUserInput("");

      abortControllerRef.current = new AbortController();

      await fetchChatCompletion(
        updatedMessages,
        (chunk) => {
          console.log("Received chunk:", chunk);
          assistantMessage.content += chunk;
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            if (lastMessage.role === "assistant") {
              return [
                ...prevMessages.slice(0, -1),
                { ...lastMessage, content: assistantMessage.content },
              ];
            }
            return [...prevMessages, assistantMessage];
          });
        },
        abortControllerRef.current,
        selectedModel,
        variables,
        flow.id
      );
    } catch (error) {
      const err = error as Error;
      if (err.name !== "AbortError") {
        console.error("Failed to send message:", error);
        setMessages((prev) => prev.slice(0, -2));
        setUserInput(messageToSend);
        setErrorMessage(err.message || "Failed to send message. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setShowConfirmModal(true);
  };

  const confirmClearHistory = () => {
    setMessages([]);
    setShowConfirmModal(false);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">{flow.name}</h2>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="p-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {supportedModelsOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel */}
          <div className="w-1/3 p-4 overflow-y-auto border-r border-gray-200">
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-medium text-gray-700">System Prompt</h3>
              <div className="p-3 rounded-md bg-gray-50">
                <p className="text-sm text-gray-600">{flow.system_prompt}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 text-sm font-medium text-gray-700">Variables</h3>
              <div className="space-y-3">
                {flow.variables.map((variable) => (
                  <div key={variable}>
                    <label className="block mb-1 text-sm text-gray-600">{variable}</label>
                    <input
                      type="text"
                      value={variables[variable] || ""}
                      onChange={(e) => handleVariableChange(variable, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Enter ${variable}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Chat Area */}
          <div className="flex flex-col flex-1">
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
                    userInfo={{ name: "You", avatar_url: "" }}
                    onDelete={() => handleDeleteMessage(index)}
                    onEdit={() => handleEditMessage(index)}
                    onRefresh={() => handleRefreshMessage(index)}
                    isLoading={isLoading}
                  />
                ))
              )}

              {!isLoading && messages.length ? (
                <div className="relative flex justify-start max-w-2xl px-4 mx-auto -top-4">
                  <button
                    className="text-sm text-gray-400 underline hover:text-gray-600 focus:outline-none"
                    onClick={() => handleSubmit("continue")}
                  >
                    Continue
                  </button>
                </div>
              ) : null}

              {messages.length > 0 && (
                <div className="flex flex-col items-center text-center text-gray-500">
                  {isLoading ? <Spinner /> : <div>End of messages</div>}
                  {!isLoading && (
                    <button
                      className="text-sm text-blue-400 underline hover:text-gray-600 focus:outline-none"
                      onClick={handleClearHistory}
                    >
                      Clean History
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 w-full p-4 bg-white border-t border-gray-300">
              <div className="flex justify-center max-w-2xl mx-auto space-x-2">
                <AutoGrowTextarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  className="flex-1 p-2 border border-gray-300 resize-none rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleSubmit()}
                  disabled={isLoading}
                  className="p-2 text-white bg-blue-500 rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {isLoading ? "Sending..." : "Send"}
                </button>
                {isLoading && (
                  <button
                    onClick={handleStop}
                    className="p-2 text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <StopIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
              {errorMessage && (
                <div className="mt-2 text-sm text-center text-red-500">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {showConfirmModal && (
        <ConfirmModal
          title="Confirm Clear History"
          onConfirm={confirmClearHistory}
          onCancel={() => setShowConfirmModal(false)}
        >
          Are you sure you want to clear the chat history?
        </ConfirmModal>
      )}
    </div>
  );
}
