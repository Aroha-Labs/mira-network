"use client";

import { useState, useRef } from "react";
import AutoGrowTextarea from "./AutoGrowTextarea";
import { XMarkIcon, StopIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";

interface TryFlowModalProps {
  onClose: () => void;
  onSave: (flow: {
    name: string;
    system_prompt: string;
    variables: string[];
  }) => void;
  token: string;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

const fetchSupportedModels = async (token: string) => {
  const response = await fetch("http://localhost:8000/v1/models", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error("Failed to fetch models");
  const data = await response.json();
  return data.data.map((model: { id: string }) => model.id);
};

const processStreamResponse = async (
  response: Response,
  onChunk: (chunk: string) => void
) => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No reader available");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      console.log("Stream read:", { done, valueLength: value?.length });
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      console.log("Current buffer:", buffer);

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        console.log("Processing line:", line);
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          console.log("Data after slice:", data);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            console.log("Parsed data:", parsed);
            const content = parsed.choices?.[0]?.delta?.content || "";
            console.log("Extracted content:", content);
            if (content) onChunk(content);
          } catch (e) {
            console.warn("Failed to parse chunk:", data, e);
          }
        }
      }
    }
  } catch (error) {
    console.error("Stream processing error:", error);
    throw error;
  } finally {
    reader.releaseLock();
  }
};

export default function TryFlowModal({
  onClose,
  onSave,
  token,
}: TryFlowModalProps) {
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [extractedVariables, setExtractedVariables] = useState<string[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const {
    data: supportedModelsData,
    error: supportedModelsError,
    isLoading: isModelsLoading,
  } = useQuery<string[]>({
    queryKey: ["supportedModels"],
    queryFn: () => fetchSupportedModels(token),
  });

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

    setIsLoading(true);
    const userMessage = { role: "user" as const, content: userInput };
    const assistantMessage = { role: "assistant" as const, content: "" };
    const updatedMessages = [...messages, userMessage];

    setMessages([...updatedMessages, assistantMessage]);
    setUserInput("");

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("http://localhost:8000/flows/try", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          req: {
            system_prompt: systemPrompt,
            name: name || "Test Flow",
          },
          chat: {
            model: selectedModel,
            messages: updatedMessages,
            variables: variables,
            stream: true,
          },
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to send message");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done: doneReading } = await reader!.read();
        if (doneReading) break;

        const chunks = decoder
          .decode(value, { stream: true })
          .split("\n")
          .flatMap((c) => c.split("data: "))
          .filter((c) => {
            if (!c) return false;
            const wordsToIgnore = [
              "[DONE]",
              "[ERROR]",
              "OPENROUTER PROCESSING",
            ];
            return !wordsToIgnore.some((w) => c.includes(w));
          });

        for (const chunk of chunks) {
          try {
            const data = JSON.parse(chunk);
            console.log("Parsed chunk:", data);

            if (data.error) {
              throw new Error(data.error.message);
            }

            const choice = data.choices[0];
            const content = choice.delta
              ? choice.delta.content
              : choice.message?.content;

            if (content) {
              assistantMessage.content += content;
              setMessages((prevMessages) => [
                ...prevMessages.slice(0, -1),
                { ...assistantMessage },
              ]);
            }
          } catch (error) {
            console.error("Failed to parse response:", error);
          }
        }
      }
    } catch (error) {
      const err = error as Error;
      if (err.name !== "AbortError") {
        console.error("Failed to send message:", error);
        setMessages((prev) => prev.slice(0, -2));
        setUserInput(userInput);
        setErrorMessage(
          err.message || "Failed to send message. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleSave = () => {
    if (!name.trim() || !systemPrompt.trim()) return;
    onSave({
      name,
      system_prompt: systemPrompt,
      variables: extractedVariables,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-4xl h-[80vh] p-6 bg-white rounded-lg flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">Try New Flow</h2>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="p-1 border border-gray-300 rounded-md"
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
            className="text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Left Panel */}
          <div className="w-1/3 space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                System Prompt
              </label>
              <AutoGrowTextarea
                value={systemPrompt}
                onChange={handlePromptChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter system prompt with variables like {{variable_name}}"
              />
            </div>

            {extractedVariables.length > 0 && (
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Variables:
                </label>
                <div className="space-y-2">
                  {extractedVariables.map((variable) => (
                    <div key={variable}>
                      <label className="block text-sm text-gray-600">
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
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder={`Enter ${variable}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!showSaveForm ? (
              <button
                onClick={() => setShowSaveForm(true)}
                className="w-full px-4 py-2 text-white bg-green-500 rounded-md hover:bg-green-600"
              >
                Save Flow
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter flow name"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={!name.trim() || !systemPrompt.trim()}
                    className="flex-1 px-4 py-2 text-white bg-green-500 rounded-md hover:bg-green-600 disabled:opacity-50"
                  >
                    Confirm Save
                  </button>
                  <button
                    onClick={() => setShowSaveForm(false)}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Chat */}
          <div className="flex flex-col flex-1">
            <div className="flex-1 p-4 mb-4 overflow-y-auto border rounded-lg">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <div>Start chatting...</div>
                </div>
              ) : (
                messages.map((msg, index) => {
                  console.log("Rendering message:", msg);
                  return (
                    <div
                      key={index}
                      className={`mb-4 ${
                        msg.role === "assistant" ? "pl-4" : "pr-4"
                      }`}
                    >
                      <div
                        className={`p-3 rounded-lg ${
                          msg.role === "assistant"
                            ? "bg-gray-100"
                            : "bg-blue-100"
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2">
              <AutoGrowTextarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type your message..."
                className="flex-1 p-2 border border-gray-300 rounded-md"
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !selectedModel}
                className="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50"
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
          </div>
        </div>
      </div>
    </div>
  );
}
