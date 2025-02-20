"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AutoGrowTextarea from "./AutoGrowTextarea";
import { StopIcon, ArrowLeftIcon } from "@heroicons/react/24/solid";
import {
  ChatBubbleBottomCenterIcon,
  BeakerIcon,
  WrenchIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import ConfirmModal from "./ConfirmModal";
import ChatBubble from "./ChatBubble";
import { Spinner } from "./PageLoading";
import api from "src/lib/axios";
import { Flow, Message, streamChatCompletion, Tool } from "src/utils/chat";
import ToolEditModal from "./ToolEditModal";

interface FlowChatProps {
  flow: Flow;
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
  <div className="flex items-center justify-between p-3 mb-2 transition-colors duration-200 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
    <div className="flex-1 min-w-0">
      <div className="font-medium text-gray-900">{tool.function.name}</div>
      <div className="mt-1 text-sm text-gray-500 truncate">
        {tool.function.description}
      </div>
    </div>
    <button
      onClick={onDelete}
      className="flex items-center px-3 py-1 ml-4 text-sm font-medium text-red-600 transition-colors duration-200 rounded-md bg-red-50 hover:bg-red-100"
    >
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

    const assistantMessage: Message = {
      role: "assistant",
      content: "",
      tool_calls: [],
      tool_responses: [],
    };
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
      const assistantMessage: Message = {
        role: "assistant",
        content: "",
        tool_calls: [],
        tool_responses: [],
      };
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
      const index = tools.findIndex((t) => t.function.name === editingTool.function.name);
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
    <div className="fixed inset-0 z-50 bg-gray-50">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <button
              onClick={onClose}
              className="p-2 text-gray-500 transition-colors duration-200 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900">{flow.name}</h2>
          </div>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            {supportedModelsOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel */}
          <div className="shrink-0 p-6 overflow-y-auto bg-white border-r border-gray-200 w-80">
            {/* System Prompt Section */}
            <div className="mb-8">
              <div className="flex items-center mb-4 text-gray-900">
                <DocumentTextIcon className="w-5 h-5 mr-2" />
                <h3 className="font-medium">System Prompt</h3>
              </div>
              <div className="p-4 text-sm text-gray-600 border border-gray-200 rounded-lg bg-gray-50">
                <p className="whitespace-pre-wrap">{flow.system_prompt}</p>
              </div>
            </div>

            {/* Variables Section */}
            {flow.variables.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center mb-4 text-gray-900">
                  <BeakerIcon className="w-5 h-5 mr-2" />
                  <h3 className="font-medium">Variables</h3>
                </div>
                <div className="space-y-4">
                  {flow.variables.map((variable) => (
                    <div key={variable}>
                      <label className="block mb-1.5 text-sm font-medium text-gray-700">
                        {variable}
                      </label>
                      <input
                        type="text"
                        value={variables[variable] || ""}
                        onChange={(e) => handleVariableChange(variable, e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        placeholder={`Enter ${variable}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tools Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center text-gray-900">
                  <WrenchIcon className="w-5 h-5 mr-2" />
                  <h3 className="font-medium">Tools</h3>
                </div>
                <button
                  onClick={handleAddTool}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors duration-200 bg-blue-50 rounded-md hover:bg-blue-100"
                >
                  Add Tool
                </button>
              </div>
              <div className="space-y-3">
                {tools.map((tool, index) => (
                  <div key={index} className="space-y-2">
                    <ToolItem tool={tool} onDelete={() => handleRemoveTool(index)} />
                    <button
                      onClick={() => handleEditTool(tool)}
                      className="w-full px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors duration-200 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                    >
                      Edit Tool
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Chat Area */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <ChatBubbleBottomCenterIcon className="w-16 h-16 mb-4" />
                  <div className="text-lg">Start a conversation...</div>
                  <p className="mt-2 text-sm text-gray-500">
                    Use the variables and tools in the sidebar to customize your chat
                  </p>
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

              {!isLoading && messages.length > 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={() => handleSubmit("continue")}
                    className="px-4 py-2 text-sm text-gray-600 transition-colors duration-200 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    Continue generating
                  </button>
                </div>
              )}

              {messages.length > 0 && (
                <div className="flex flex-col items-center text-center text-gray-500">
                  {isLoading ? (
                    <Spinner />
                  ) : (
                    <div className="text-sm">End of conversation</div>
                  )}
                  {!isLoading && (
                    <button
                      onClick={handleClearHistory}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      Clear History
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="max-w-4xl mx-auto">
                <div className="flex space-x-3">
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
                    className="flex-1 p-3 text-sm border border-gray-300 rounded-lg resize-none focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleSubmit()}
                      disabled={isLoading}
                      className="px-4 py-2 text-sm font-medium text-white transition-colors duration-200 bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      {isLoading ? "Sending..." : "Send"}
                    </button>
                    {isLoading && (
                      <button
                        onClick={handleStop}
                        className="p-2 text-white transition-colors duration-200 bg-red-500 rounded-lg hover:bg-red-600 focus:outline-hidden focus:ring-2 focus:ring-red-500"
                      >
                        <StopIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
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
      </div>

      {showConfirmModal && (
        <ConfirmModal
          title="Clear Chat History"
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
