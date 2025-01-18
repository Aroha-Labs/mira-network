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
import { Message, streamChatCompletion, Tool } from "src/utils/chat";
import ToolEditModal from "./ToolEditModal";

interface FlowChatProps {
  flow: {
    id: number;
    name: string;
    system_prompt: string;
    variables: string[];
    tools?: Tool[];
  };
  onClose: () => void;
}

const fetchSupportedModels = async () => {
  const response = await api.get("/v1/models");
  if (response.status !== 200) throw new Error("Failed to fetch models");
  return response.data.data.map((model: { id: string }) => model.id);
};

const fetchChatCompletion = async (
  messages: Message[],
  onMessage: (chunk: string | Message) => void,
  controller: AbortController,
  model: string,
  variables: Record<string, string>,
  flowId: number,
  tools: Tool[]
) => {
  await streamChatCompletion(
    {
      messages,
      model,
      variables,
      flowId,
      endpoint: `/v1/flow/${flowId}/chat/completions`,
      tools,
    },
    controller,
    {
      onMessage,
      onError: (error) => {
        console.error("Chat completion error:", error);
        throw error;
      },
    }
  );
};

interface ToolItemProps {
  tool: Tool;
  onDelete: () => void;
}

const ToolItem: React.FC<ToolItemProps> = ({ tool, onDelete }) => (
  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md mb-2">
    <div>
      <div className="font-medium">{tool.function.name}</div>
      <div className="text-sm text-gray-600">{tool.function.description}</div>
    </div>
    <button onClick={onDelete} className="text-red-600 hover:text-red-800">
      Remove
    </button>
  </div>
);

export default function FlowChat({ flow, onClose }: FlowChatProps) {
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [tools, setTools] = useState<Tool[]>(flow.tools || []);
  const [editingTool, setEditingTool] = useState<Tool | undefined>();
  const [showToolModal, setShowToolModal] = useState(false);
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
          if (typeof chunk === "string") {
            assistantMessage.content += chunk;
          } else {
            // Handle Message object with tool_calls
            if (chunk.content) {
              assistantMessage.content += chunk.content;
            }
            if (chunk.tool_calls) {
              assistantMessage.tool_calls = chunk.tool_calls;
            }
            if (chunk.tool_responses) {
              assistantMessage.tool_responses = chunk.tool_responses;
            }
          }
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            if (lastMessage.role === "assistant") {
              return [
                ...prevMessages.slice(0, -1),
                {
                  ...lastMessage,
                  content: assistantMessage.content,
                  tool_calls: assistantMessage.tool_calls || lastMessage.tool_calls,
                  tool_responses:
                    assistantMessage.tool_responses || lastMessage.tool_responses,
                },
              ];
            }
            return [...prevMessages, assistantMessage];
          });
        },
        abortControllerRef.current,
        selectedModel,
        variables,
        flow.id,
        tools
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
          if (typeof chunk === "string") {
            assistantMessage.content += chunk;
          } else {
            // Handle Message object with tool_calls
            if (chunk.content) {
              assistantMessage.content += chunk.content;
            }
            if (chunk.tool_calls) {
              assistantMessage.tool_calls = chunk.tool_calls;
            }
            if (chunk.tool_responses) {
              assistantMessage.tool_responses = chunk.tool_responses;
            }
          }
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            if (lastMessage.role === "assistant") {
              return [
                ...prevMessages.slice(0, -1),
                {
                  ...lastMessage,
                  content: assistantMessage.content,
                  tool_calls: assistantMessage.tool_calls || lastMessage.tool_calls,
                  tool_responses:
                    assistantMessage.tool_responses || lastMessage.tool_responses,
                },
              ];
            }
            return [...prevMessages, assistantMessage];
          });
        },
        abortControllerRef.current,
        selectedModel,
        variables,
        flow.id,
        tools
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

  const handleAddTool = () => {
    setEditingTool(undefined);
    setShowToolModal(true);
  };

  const handleEditTool = (tool: Tool) => {
    setEditingTool(tool);
    setShowToolModal(true);
  };

  const handleSaveTool = (tool: Tool) => {
    if (editingTool) {
      const index = tools.findIndex((t) => t.name === editingTool.name);
      if (index !== -1) {
        const newTools = [...tools];
        newTools[index] = tool;
        setTools(newTools);
      }
    } else {
      setTools([...tools, tool]);
    }
    setEditingTool(undefined);
    setShowToolModal(false);
  };

  const handleRemoveTool = (index: number) => {
    const newTools = [...tools];
    newTools.splice(index, 1);
    setTools(newTools);
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

            <div className="mb-6">
              <h3 className="mb-2 text-sm font-medium text-gray-700">Tools</h3>
              <div className="space-y-2">
                {tools.map((tool, index) => (
                  <div key={index}>
                    <ToolItem tool={tool} onDelete={() => handleRemoveTool(index)} />
                    <button
                      onClick={() => handleEditTool(tool)}
                      className="w-full py-2 px-4 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                    >
                      Edit Tool
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleAddTool}
                  className="w-full py-2 px-4 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                >
                  Add Tool
                </button>
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
      {showToolModal && (
        <ToolEditModal
          tool={editingTool}
          onSave={handleSaveTool}
          onClose={() => setShowToolModal(false)}
        />
      )}
    </div>
  );
}
