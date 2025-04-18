"use client";

import { useState, useRef, useEffect } from "react";
import AutoGrowTextarea from "./AutoGrowTextarea";
import {
  XMarkIcon,
  StopIcon,
  BeakerIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import api from "src/lib/axios";
import { Message, streamChatCompletion } from "src/utils/chat";
import { Spinner } from "./PageLoading";

interface TryFlowModalProps {
  onClose: () => void;
  onSave: (flow: { name: string; system_prompt: string; variables: string[] }) => void;
  initialFlow?: {
    id: number;
    name: string;
    system_prompt: string;
    variables: string[];
  };
  isLoading?: boolean;
}

const fetchSupportedModels = async () => {
  const { data } = await api.get("/v1/models");
  if (!data) throw new Error("Failed to fetch models");
  return data.data.map((model: { id: string }) => model.id);
};

const fetchChatCompletion = async (
  messages: Message[],
  onMessage: (chunk: string | Message) => void,
  controller: AbortController,
  model: string,
  variables: Record<string, string>,
  systemPrompt: string
) => {
  await streamChatCompletion(
    {
      messages,
      model,
      variables,
      systemPrompt,
      endpoint: "/v1/chat/completions",
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

export default function TryFlowModal({
  onClose,
  onSave,
  initialFlow,
  isLoading,
}: TryFlowModalProps) {
  const [name, setName] = useState(initialFlow?.name || "");
  const [systemPrompt, setSystemPrompt] = useState(initialFlow?.system_prompt || "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [selectedModel, setSelectedModel] = useState("");
  const [extractedVariables, setExtractedVariables] = useState<string[]>(
    initialFlow?.variables || []
  );
  const [showSaveForm, setShowSaveForm] = useState(!!initialFlow);
  const [saveClicked, setSaveClicked] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [, setErrorMessage] = useState("");
  const { data: supportedModelsData } = useQuery<string[]>({
    queryKey: ["supportedModels"],
    queryFn: fetchSupportedModels,
  });

  // Reset saveClicked when loading state changes from true to false
  useEffect(() => {
    if (!isLoading && saveClicked) {
      setSaveClicked(true);
    }
  }, [isLoading]);

  const handleExtractVariables = (prompt: string) => {
    const matches = prompt.match(/{{(.*?)}}/g) || [];
    const variables = matches.map((match) => match.replace(/{{|}}/g, ""));
    setExtractedVariables([...new Set(variables)]);
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setSystemPrompt(newPrompt);
    handleExtractVariables(newPrompt);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !selectedModel) return;

    const userMessage = { role: "user" as const, content: userInput };
    const assistantMessage = { role: "assistant" as const, content: "" };
    const updatedMessages = [...messages, userMessage];

    setMessages([...updatedMessages, assistantMessage]);
    setUserInput("");

    abortControllerRef.current = new AbortController();

    try {
      await fetchChatCompletion(
        updatedMessages,
        (chunk) => {
          if (typeof chunk === "string") {
            assistantMessage.content += chunk;
            setMessages((prevMessages) => [
              ...prevMessages.slice(0, -1),
              { ...assistantMessage },
            ]);
          }
        },
        abortControllerRef.current,
        selectedModel,
        variables,
        systemPrompt
      );
    } catch (error) {
      const err = error as Error;
      if (err.name !== "AbortError") {
        console.error("Failed to send message:", error);
        setMessages((prev) => prev.slice(0, -2));
        setUserInput(userInput);
        setErrorMessage(err.message || "Failed to send message. Please try again.");
      }
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleSave = () => {
    if (!name.trim() || !systemPrompt.trim()) return;
    setSaveClicked(true);
    onSave({
      name,
      system_prompt: systemPrompt,
      variables: extractedVariables,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
      <div className="flex flex-col w-full h-[90vh] max-w-6xl bg-gray-50 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 rounded-t-xl">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {initialFlow ? "Edit Flow" : "Try Flow"}
            </h2>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Model</option>
              {supportedModelsData?.map((model) => (
                <option key={model} value={model}>
                  {model.split("/").pop()}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 transition-colors duration-200 rounded-lg hover:bg-gray-100"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 gap-6 p-6 overflow-hidden">
          {/* Left Panel - System Prompt and Variables */}
          <div className="flex flex-col min-h-0 bg-white border border-gray-200 rounded-lg w-80">
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="space-y-6">
                {/* System Prompt Section */}
                <div>
                  <div className="flex items-center mb-4 text-gray-900">
                    <DocumentTextIcon className="w-5 h-5 mr-2" />
                    <h3 className="font-medium">System Prompt</h3>
                  </div>
                  <AutoGrowTextarea
                    value={systemPrompt}
                    onChange={handlePromptChange}
                    className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter system prompt with variables like {{variable_name}}"
                    rows={3}
                  />
                </div>

                {/* Variables Section */}
                {extractedVariables.length > 0 && (
                  <div>
                    <div className="flex items-center mb-4 text-gray-900">
                      <BeakerIcon className="w-5 h-5 mr-2" />
                      <h3 className="font-medium">Variables</h3>
                    </div>
                    <div className="space-y-4">
                      {extractedVariables.map((variable) => (
                        <div key={variable}>
                          <label className="block mb-1.5 text-sm font-medium text-gray-700">
                            {variable}
                          </label>
                          <input
                            type="text"
                            value={variables[variable] || ""}
                            onChange={(e) =>
                              setVariables((prev) => ({
                                ...prev,
                                [variable]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            placeholder={`Enter ${variable}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Save Flow Section */}
            <div className="p-6 border-t border-gray-200 rounded-b-lg bg-gray-50">
              {!showSaveForm ? (
                <button
                  onClick={() => setShowSaveForm(true)}
                  className="w-full px-4 py-2 text-sm font-medium text-white transition-colors duration-200 bg-green-600 rounded-lg hover:bg-green-700 focus:outline-hidden focus:ring-2 focus:ring-green-500"
                >
                  Save Flow
                </button>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter flow name"
                    disabled={isLoading}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={!name.trim() || !systemPrompt.trim() || isLoading}
                      className={`flex-1 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 rounded-lg focus:outline-hidden focus:ring-2 ${!isLoading && saveClicked
                        ? "bg-green-500 hover:bg-green-600 focus:ring-green-400"
                        : "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                          {initialFlow ? "Updating..." : "Saving..."}
                        </div>
                      ) : saveClicked ? (
                        <div className="flex items-center justify-center gap-2">
                          <CheckIcon className="w-4 h-4" />
                          {initialFlow ? "Updated!" : "Saved!"}
                        </div>
                      ) : (
                        <>{initialFlow ? "Update Flow" : "Save Flow"}</>
                      )}
                    </button>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-gray-500"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Chat */}
          <div className="flex flex-col flex-1 min-h-0 bg-white border border-gray-200 rounded-lg">
            <div className="flex-1 p-6 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <ChatBubbleLeftRightIcon className="w-16 h-16 mb-4" />
                  <div className="text-lg">Start a conversation...</div>
                  <p className="mt-2 text-sm text-gray-500">
                    Test your flow with different inputs and variables
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"
                        }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "assistant"
                          ? "bg-gray-100 text-gray-900"
                          : "bg-blue-600 text-white"
                          }`}
                      >
                        <p className="whitespace-pre-wrap">
                          {typeof msg.content === 'string'
                            ? msg.content
                            : JSON.stringify(msg.content, null, 2)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-center">
                      <Spinner />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 bg-white border-t border-gray-200 rounded-b-lg">
              <div className="flex space-x-3">
                <AutoGrowTextarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  className="flex-1 p-3 text-sm border border-gray-300 rounded-lg resize-none focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !selectedModel}
                    className="px-4 py-2 text-sm font-medium text-white transition-colors duration-200 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
