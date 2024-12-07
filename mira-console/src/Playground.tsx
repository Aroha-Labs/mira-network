import { useState, useRef, useEffect, useMemo } from "react"; // Add useEffect
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { useModels } from "./hooks/useModels";
import { LLM_BASE_URL } from "./config/llm";
import {
  useStateSelectedModel,
  useStateSelectedProvider,
} from "./recoil/atoms";
import { supabase } from "./supabase";

// Error display component
const ErrorMessage = ({ error }: { error: Error }) => (
  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
    <span className="block sm:inline">
      {error.message || "An unexpected error occurred"}
    </span>
  </div>
);

interface Message {
  role: "user" | "system" | "assistant";
  content: string;
}

// First, add this utility function at top level
const autoResizeTextArea = (element: HTMLTextAreaElement) => {
  element.style.height = "auto";
  element.style.height = element.scrollHeight + "px";
};

// Add to top of file
const roleColors = {
  system: "bg-purple-50 border-purple-200",
  user: "bg-blue-50 border-blue-200",
  assistant: "bg-green-50 border-green-200",
};

const rolePlaceholders = {
  system: "Define the AI's behavior and constraints...",
  user: "Enter your message or question...",
  assistant: "Enter the AI assistant's response...",
};

interface SavePromptForm {
  name: string;
  icon: string;
}

interface PlaygroundProps {
  flow?: {
    id: number;
    name: string;
    icon: string;
    system_prompt: string;
  };
}

interface Variables {
  [key: string]: string;
}

export default function Playground({ flow }: PlaygroundProps) {
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: flow?.system_prompt || "",
    },
  ]);
  const [model, setModel] = useStateSelectedModel();
  const [response, setResponse] = useState("");
  const [validationError, setValidationError] = useState<string>("");

  // Add new state for reply
  const [replyContent, setReplyContent] = useState("");

  // Add new state for reply role
  const [replyRole, setReplyRole] = useState<Message["role"]>("user");

  const [selectedProvider] = useStateSelectedProvider();

  const [isStreaming, setIsStreaming] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saveForm, setSaveForm] = useState<SavePromptForm>({
    name: "",
    icon: "",
  });

  // Add new state for form errors
  const [formError, setFormError] = useState<string>("");

  const [variables, setVariables] = useState<Variables>({});

  const validateMessages = (): boolean => {
    setValidationError("");

    // Check for empty content
    if (messages.some((msg) => !msg.content.trim())) {
      setValidationError("All messages must have content");
      return false;
    }

    // Check for multiple system messages
    const systemMessages = messages.filter((msg) => msg.role === "system");
    if (systemMessages.length > 1) {
      setValidationError("Cannot have multiple system messages");
      return false;
    }

    return true;
  };

  const {
    mutate,
    isPending,
    error: chatError,
    isError: isChatError,
  } = useMutation({
    mutationFn: async () => {
      setIsStreaming(true);
      abortControllerRef.current = new AbortController();

      try {
        const baseUrl = selectedProvider.baseUrl || LLM_BASE_URL;
        const headers: Record<string, string> = {};

        if (selectedProvider.apiKey) {
          headers["Authorization"] = `Bearer ${selectedProvider.apiKey}`;
        }

        const new_messages = [...messages.map((m) => ({ ...m }))];

        // Replace variables in system prompt
        const systemMessage = new_messages.find((m) => m.role === "system");
        if (systemMessage) {
          let content = systemMessage.content;
          Object.entries(variables).forEach(([key, value]) => {
            content = content.replace(new RegExp(`{${key}}`, "g"), value);
          });
          systemMessage.content = content;
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stream: true,
            model,
            messages: new_messages,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.body) {
          throw new Error("ReadableStream not supported in this browser.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const d = decoder.decode(value);
          if (d.includes("[DONE]")) break;

          try {
            const djson = JSON.parse(d.replace(/^data: /, ""));
            let chunk: any;
            if (djson.choices[0].delta) {
              // from stream response
              chunk = djson.choices[0].delta.content;
            } else {
              chunk = djson.choices[0].message.content;
            }
            setResponse((prev) => prev + chunk);
          } catch (e) {
            console.error("Error parsing JSON", e);
          }
        }
        setIsStreaming(false);
      } catch (error) {
        setIsStreaming(false);
        throw error;
      }
    },
  });

  // Update savePromptMutation
  const savePromptMutation = useMutation({
    mutationFn: async (data: SavePromptForm & { system_prompt: string }) => {
      if (flow) {
        // Update existing flow
        const { error } = await supabase
          .from("flows")
          .update({
            name: data.name,
            icon: data.icon,
            system_prompt: data.system_prompt,
          })
          .eq("id", flow.id);

        if (error) throw error;
      } else {
        // Create new flow
        const { error } = await supabase.from("flows").insert([data]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      setIsModalOpen(false);
      setSaveForm({ name: "", icon: "" });
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      if (flow) {
        // Also invalidate single flow query
        queryClient.invalidateQueries({
          queryKey: ["flow", flow.id.toString()],
        });
      }
    },
  });

  const {
    data: models,
    isLoading: isLoadingModels,
    error: modelsError,
    isError: isModelsError,
  } = useModels();

  const addMessage = () => {
    const lastMessage = messages[messages.length - 1];
    const newRole: "user" | "system" | "assistant" =
      lastMessage.role === "user" ? "assistant" : "user";

    setMessages([
      ...messages,
      {
        role: newRole,
        content: "",
      },
    ]);
  };

  const updateMessage = (
    index: number,
    field: "role" | "content",
    value: string
  ) => {
    const newMessages = [...messages];
    if (field === "role" && value === "system" && index !== 0) {
      setValidationError("System message can only be at the top");
      return;
    }
    newMessages[index] = { ...newMessages[index], [field]: value };
    setMessages(newMessages);
  };

  const removeMessage = (index: number) => {
    setMessages(messages.filter((_, i) => i !== index));
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(response);
      // Optional: Add toast/notification for success
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Update handleSubmit to use replyRole
  const handleSubmit = () => {
    if (validateMessages()) {
      // Replace variables in system prompt
      // const systemMessage = messages.find((m) => m.role === "system");
      // if (systemMessage) {
      //   let content = systemMessage.content;
      //   Object.entries(variables).forEach(([key, value]) => {
      //     content = content.replace(new RegExp(`{${key}}`, "g"), value);
      //   });
      //   systemMessage.content = content;
      // }

      if (response) {
        // Convert previous response to message
        setMessages([
          ...messages,
          { role: "assistant", content: response },
          ...(replyContent.trim()
            ? [{ role: replyRole, content: replyContent }]
            : []),
        ] as any);
        setResponse("");
        setReplyContent("");
        setReplyRole("user");
      }
      mutate();
    }
  };

  // Add this function to component
  const clearResponse = () => {
    setResponse("");
    setReplyContent("");
    setReplyRole("user");
  };

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  // Update handleSavePrompt with validation
  const handleSavePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(""); // Reset error state

    // Validate form
    const systemMessage = messages.find((m) => m.role === "system");
    if (!systemMessage?.content.trim()) {
      setFormError("System prompt cannot be empty");
      return;
    }

    if (!saveForm.name.trim()) {
      setFormError("Name is required");
      return;
    }

    if (!saveForm.icon.trim()) {
      setFormError("Icon is required");
      return;
    }

    try {
      await savePromptMutation.mutateAsync({
        ...saveForm,
        system_prompt: systemMessage.content,
      });
    } catch (error) {
      setFormError((error as Error).message || "Failed to save prompt");
    }
  };

  // Add useEffect to update system message when flow changes
  useEffect(() => {
    if (flow?.system_prompt) {
      setMessages((messages) => {
        const firstSystemIndex = messages.findIndex((m) => m.role === "system");
        if (firstSystemIndex === -1) {
          return [{ role: "system", content: flow.system_prompt }, ...messages];
        }

        const newMessages = [...messages];
        newMessages[firstSystemIndex] = {
          ...newMessages[firstSystemIndex],
          content: flow.system_prompt,
        };
        return newMessages;
      });
    }
  }, [flow?.system_prompt]);

  // Initialize form with existing values if editing
  useEffect(() => {
    if (flow) {
      setSaveForm({
        name: flow.name,
        icon: flow.icon,
      });
    }
  }, [flow]);

  // Add this function to extract variables
  const extractVariables = useMemo(() => {
    const systemMessage = messages.find((m) => m.role === "system");
    if (!systemMessage?.content) return [];

    const matches = systemMessage.content.match(/\{([^}]+)\}/g);
    return matches ? [...new Set(matches.map((m) => m.slice(1, -1)))] : [];
  }, [messages]);

  return (
    <main className="flex flex-col flex-grow p-4 gap-2 sm:container sm:mx-auto">
      {isModelsError && <ErrorMessage error={modelsError} />}

      {/* Model selector with better styling */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Model
        </label>
        <select
          className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={isLoadingModels}
        >
          {isLoadingModels ? (
            <option>Loading models...</option>
          ) : (
            <>
              <option key="" value="">
                Select a model
              </option>
              {models?.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* Messages section */}
      <div className="space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`mb-4 p-4 rounded-lg border ${roleColors[message.role]} shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-2">
              <select
                value={message.role}
                onChange={(e) =>
                  updateMessage(
                    index,
                    "role",
                    e.target.value as Message["role"]
                  )
                }
                className="px-3 py-2 text-sm rounded border border-gray-300"
                // disabled={message.role === "system" && index === 0}
              >
                <option value="system">System</option>
                <option value="user">User</option>
                <option value="assistant">Assistant</option>
              </select>

              <div className="flex-1"></div>

              {/* Conditional render for delete button */}
              {index > 0 && (
                <button
                  onClick={() => removeMessage(index)}
                  className="p-2 text-red-600 hover:text-red-700 rounded-lg hover:bg-red-50 transition-all duration-200 ease-in-out"
                  title="Remove message"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              )}

              {message.role === "system" && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-3 py-2 text-sm text-white bg-blue-500 rounded hover:bg-blue-600"
                >
                  Save Flow
                </button>
              )}
            </div>

            <textarea
              value={message.content}
              onChange={(e) => updateMessage(index, "content", e.target.value)}
              className={`w-full p-3 text-sm border rounded `}
              placeholder={rolePlaceholders[message.role]}
              rows={1}
              ref={(el) => {
                if (el) autoResizeTextArea(el);
              }}
            />

            {/* Show variables only for system message */}
            {message.role === "system" && extractVariables.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Variables
                </div>
                <div className="space-y-2">
                  {extractVariables.map((variable) => (
                    <div key={variable} className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">{`{${variable}}`}</label>
                      <input
                        type="text"
                        value={variables[variable] || ""}
                        onChange={(e) =>
                          setVariables((prev) => ({
                            ...prev,
                            [variable]: e.target.value,
                          }))
                        }
                        className="flex-1 px-3 py-2 text-sm border rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder={`Enter value for ${variable}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {validationError && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          {validationError}
        </div>
      )}

      {isChatError && <ErrorMessage error={chatError} />}

      {/* Response section */}
      {response && (
        <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-indigo-600"
              >
                <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                <path d="M4 9h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z" />
                <circle cx="8" cy="13" r="1" />
                <circle cx="16" cy="13" r="1" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900">Assistant</h3>
            </div>
            <div className="flex gap-3">
              {isStreaming ? (
                <button
                  onClick={handleStopStream}
                  className="text-gray-500 hover:text-red-600 p-2.5 rounded-lg hover:bg-red-50 transition-all duration-200 ease-in-out"
                  title="Stop generating"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </svg>
                </button>
              ) : (
                <>
                  {/* Delete button */}
                  <button
                    onClick={clearResponse}
                    className="text-gray-500 hover:text-red-600 p-2.5 rounded-lg hover:bg-red-50 transition-all duration-200 ease-in-out"
                    title="Clear response"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                  {/* Copy button */}
                  <button
                    onClick={copyToClipboard}
                    className="text-gray-500 hover:text-indigo-600 p-2.5 rounded-lg hover:bg-indigo-50 transition-all duration-200 ease-in-out"
                    title="Copy response"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
          <ReactMarkdown className="prose max-w-none">{response}</ReactMarkdown>
        </div>
      )}

      {/* Reply section */}
      {response && (
        <div className="flex gap-3 p-4 rounded-lg border bg-blue-50 border-blue-200">
          <select
            value={replyRole}
            onChange={(e) => setReplyRole(e.target.value as Message["role"])}
            className="bg-white/50 border-0 rounded-md shadow-sm py-1 px-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="user">User</option>
            <option value="assistant">Assistant</option>
            <option value="system">System</option>
          </select>
          <textarea
            value={replyContent}
            onChange={(e) => {
              setReplyContent(e.target.value);
              autoResizeTextArea(e.target);
            }}
            className="flex-1 bg-white/50 border-0 rounded-md p-2 resize-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your reply..."
          />
        </div>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-center min-h-screen px-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/30 transition-opacity"
              onClick={() => setIsModalOpen(false)}
            />

            {/* Modal panel */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full mx-auto p-6">
              {/* Update modal title based on operation */}
              <h2 className="text-lg font-medium text-gray-900">
                {flow ? "Update System Prompt" : "Save System Prompt"}
              </h2>

              <form onSubmit={handleSavePrompt}>
                {formError && (
                  <div className="my-4 p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
                    {formError}
                  </div>
                )}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={saveForm.name}
                    onChange={(e) =>
                      setSaveForm({ ...saveForm, name: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter a name for your flow"
                    required
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Icon (emoji)
                  </label>
                  <input
                    type="text"
                    value={saveForm.icon}
                    onChange={(e) =>
                      setSaveForm({ ...saveForm, icon: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter an emoji 😊"
                    required
                    maxLength={2}
                  />
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    disabled={savePromptMutation.isPending}
                  >
                    {savePromptMutation.isPending ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={addMessage}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Add Message
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Submitting..." : "Submit"}
        </button>
      </div>
    </main>
  );
}
