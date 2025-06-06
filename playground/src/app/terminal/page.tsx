"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import {
  StopIcon,
  ArrowPathIcon,
  PlusIcon,
  XMarkIcon,
  ChevronRightIcon,
  PencilIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  UserCircleIcon,
  CheckIcon,
  ChartBarIcon,
} from "@heroicons/react/24/solid";
import { PlayIcon, Bars3Icon, CodeBracketIcon } from "@heroicons/react/24/outline";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import api from "src/lib/axios";
import { Message, streamChatCompletion, Tool } from "src/utils/chat";
import { useQueryClient } from "@tanstack/react-query";
import MetricsModal from "src/components/MetricsModal";
import FlowAPIExamplesModal from "src/components/FlowAPIExamplesModal";
import Link from "next/link";
import { useSession } from "src/hooks/useSession";
import { MessageVerification } from "src/components/MessageVerification";
import ReactMarkdown from "src/components/ReactMarkdown";
import { trackEvent } from "src/lib/mira";

interface Flow {
  id: string;
  name: string;
  system_prompt: string;
  variables: string[];
  tools?: Tool[];
}

const fetchFlows = async (): Promise<Flow[]> => {
  try {
    const response = await api.get("/flows");
    console.log("Flows response:", response.data); // Debug log
    return response.data || [];
  } catch (error) {
    console.error("Failed to fetch flows:", error);
    return [];
  }
};

const fetchSupportedModels = async (): Promise<string[]> => {
  try {
    const response = await api.get("/v1/models");
    return response.data.data.map((model: { id: string }) => model.id);
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return [];
  }
};

// Update the validation function
const validateConversationFlow = (
  messages: Message[]
): { isValid: boolean; error?: string } => {
  if (messages.length === 0) return { isValid: true };

  // Check for alternating user/assistant pattern after system
  for (let i = 1; i < messages.length; i++) {
    const currentMsg = messages[i];
    const prevMsg = messages[i - 1];

    if (currentMsg.role === prevMsg.role) {
      return {
        isValid: false,
        error: `Cannot have two consecutive ${currentMsg.role} messages`,
      };
    }

    if (prevMsg.role === "user" && currentMsg.role !== "assistant") {
      return {
        isValid: false,
        error: "User message must be followed by an assistant message",
      };
    }

    if (prevMsg.role === "assistant" && currentMsg.role !== "user") {
      return {
        isValid: false,
        error: "Assistant message must be followed by a user message",
      };
    }
  }

  return { isValid: true };
};

// Add this helper function
const extractVariables = (prompt: string): string[] => {
  const matches = prompt.match(/{{([^}]+)}}/g);
  if (!matches) return [];
  return matches.map((match) => match.slice(2, -2));
};

const updateFlow = async (
  flowId: string,
  data: { system_prompt: string; name: string }
) => {
  try {
    const response = await api.put(`/flows/${flowId}`, data);
    return response.data;
  } catch (error) {
    console.error("Failed to update flow:", error);
    throw error;
  }
};

const createFlow = async (data: { system_prompt: string; name: string }) => {
  try {
    const response = await api.post("/flows", data);
    return response.data;
  } catch (error) {
    console.error("Failed to create flow:", error);
    throw error;
  }
};

// Comment out the deleteFlow function
// const deleteFlow = async (flowId: string) => {
//   try {
//     const response = await api.delete(`/flows/${flowId}`);
//     return response.data;
//   } catch (error) {
//     console.error("Failed to delete flow:", error);
//     throw error;
//   }
// };

export default function Workbench() {
  const { data: userSession } = useSession();

  // UI state
  const [isSliderOpen, setIsSliderOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [showMetrics, setShowMetrics] = useState(false);
  const [showAPIExamples, setShowAPIExamples] = useState(false);
  const [isSavingFlow, setIsSavingFlow] = useState(false);
  const [isCreatingFlow, setIsCreatingFlow] = useState(false);

  // Flow state
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [tools, setTools] = useState<Tool[]>([]);

  // Preview state
  const [previewMessage, setPreviewMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [conversation, setConversation] = useState<Message[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch flows with better error handling
  const { data: flows = [], isLoading: isFlowsLoading } = useQuery<Flow[]>({
    queryKey: ["flows"],
    queryFn: fetchFlows,
    staleTime: 30000, // Cache for 30 seconds
    retry: 2,
  });

  // Fetch models
  useQuery({
    queryKey: ["models"],
    queryFn: fetchSupportedModels,
    staleTime: 30000,
  } as UseQueryOptions<string[]>);

  // Fetch models with initial selection
  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: fetchSupportedModels,
    staleTime: 30000,
    enabled: !selectedModel,
  } as UseQueryOptions<string[]>);

  // Set initial model when available
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0]);
    }
  }, [models, selectedModel]);

  // Debug log for flows
  // console.log("Current flows:", flows);

  // Add state for editable system prompt
  const [editableSystemPrompt, setEditableSystemPrompt] = useState("");

  // Update system prompt when flow changes
  useEffect(() => {
    if (selectedFlow) {
      setEditableSystemPrompt(selectedFlow.system_prompt);
    }
  }, [selectedFlow]);

  // Add state for collapsible sections
  const [sectionsOpen, setSectionsOpen] = useState({
    tools: true,
    system: true,
    conversation: true,
  });

  // Update variables when system prompt changes
  useEffect(() => {
    if (selectedFlow) {
      const extractedVars = extractVariables(editableSystemPrompt);
      setVariables((prevVariables) => {
        const newVars = extractedVars.reduce((acc, v) => {
          // Keep existing value if it exists and is not empty
          const existingValue = prevVariables[v];
          if (existingValue && existingValue.trim() !== "") {
            return { ...acc, [v]: existingValue };
          }
          // Initialize as empty string
          return { ...acc, [v]: "" };
        }, {});

        // Only update if there are actual changes
        if (JSON.stringify(newVars) === JSON.stringify(prevVariables)) {
          return prevVariables;
        }
        return newVars;
      });
    }
  }, [editableSystemPrompt, selectedFlow]);

  // Add queryClient
  const queryClient = useQueryClient();

  // Add toast state near other states
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
    visible: boolean;
  } | null>(null);

  // Add state for editing flow name
  const [editingFlowName, setEditingFlowName] = useState<string | null>(null);
  const [newFlowName, setNewFlowName] = useState("");
  const [isUpdatingFlowName, setIsUpdatingFlowName] = useState(false);

  // Add this near the top with other state
  const [isMobileView, setIsMobileView] = useState(false);
  const [activePanel, setActivePanel] = useState<"left" | "right">("left");

  // Add useEffect for handling responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Clear states when flow changes
  useEffect(() => {
    setPreviewMessage(null);
    setIsLoading(false);
    setIsGenerating(false);
    setErrorMessage("");
    setConversation([]);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [selectedFlow?.id]);

  const handleRun = async () => {
    if (!selectedFlow) return;

    // Validate variables
    const emptyVars = Object.entries(variables)
      .filter(([_, value]) => !value || value.trim() === "")
      .map(([key]) => key);

    if (emptyVars.length > 0) {
      setErrorMessage(`Please fill in the following variables: ${emptyVars.join(", ")}`);
      return;
    }

    // Track terminal execution
    trackEvent("terminal_execution", {
      flow_id: selectedFlow.id,
      flow_name: selectedFlow.name,
      model: selectedModel || "claude-3-opus-20240229",
      has_variables: Object.keys(variables).length > 0,
      has_tools: tools.length > 0,
    });

    try {
      setIsLoading(true);
      setIsGenerating(true);
      setErrorMessage("");

      const messages = [
        {
          role: "system" as const,
          content: editableSystemPrompt,
        },
        ...conversation,
      ];

      const assistantMessage: Message = {
        role: "assistant",
        content: "",
        tool_calls: [],
        tool_responses: [],
      };

      setPreviewMessage(assistantMessage);
      abortControllerRef.current = new AbortController();

      await streamChatCompletion(
        {
          messages,
          model: selectedModel || "claude-3-opus-20240229",
          endpoint: "/v1/chat/completions",
          systemPrompt: editableSystemPrompt,
          variables,
          tools,
          flowId: Number(selectedFlow.id),
        },
        abortControllerRef.current,
        {
          onMessage: (chunk: string | Message) => {
            if (typeof chunk === "string") {
              setPreviewMessage((prev) =>
                prev ? { ...prev, content: prev.content + chunk } : null
              );
            } else {
              setPreviewMessage((prev) =>
                prev
                  ? {
                      ...prev,
                      content: prev.content + chunk.content,
                      tool_calls: chunk.tool_calls || prev.tool_calls,
                      tool_responses: chunk.tool_responses || prev.tool_responses,
                    }
                  : null
              );
            }
          },
          onError: (error: Error) => {
            console.error("Chat error:", error);
            setErrorMessage(error.message);
          },
        }
      );
    } catch (error) {
      console.error("Failed to generate response:", error);
      setErrorMessage("Failed to generate response. Please try again.");
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  const handleAddToConversation = () => {
    if (!previewMessage) return;

    const newMessages = [...conversation, previewMessage];
    const validation = validateConversationFlow(newMessages);

    if (!validation.isValid) {
      setErrorMessage(validation.error || "Invalid conversation flow");
      return;
    }

    setConversation(newMessages);
    setPreviewMessage(null);
  };

  const handleRedo = () => {
    handleRun();
  };

  // Update the Add Message button handler
  const handleAddMessage = () => {
    const newMessage: Message = {
      role: "user" as const,
      content: "",
      tool_calls: [],
      tool_responses: [],
    };
    const newMessages = [...conversation, newMessage];
    const validation = validateConversationFlow(newMessages);

    if (!validation.isValid) {
      setErrorMessage(validation.error || "Invalid conversation flow");
      return;
    }

    setConversation(newMessages);
  };

  const toggleSection = (section: keyof typeof sectionsOpen) => {
    setSectionsOpen((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSaveFlow = async () => {
    if (!selectedFlow) return;

    trackEvent("terminal_flow_save", {
      flow_id: selectedFlow.id,
      flow_name: selectedFlow.name,
    });

    try {
      setIsSavingFlow(true);
      await updateFlow(String(selectedFlow.id), {
        system_prompt: editableSystemPrompt,
        name: selectedFlow.name,
      });

      // Wait for the query to invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ["flows"] });

      // Show success toast
      setToast({
        message: "Flow saved successfully",
        type: "success",
        visible: true,
      });

      // Hide toast after 3 seconds
      setTimeout(() => {
        setToast(null);
      }, 3000);
    } catch (error) {
      console.error("Failed to save flow", error);
      // Show error toast
      setToast({
        message: "Failed to save flow",
        type: "error",
        visible: true,
      });

      // Hide toast after 3 seconds
      setTimeout(() => {
        setToast(null);
      }, 3000);
    } finally {
      setIsSavingFlow(false);
    }
  };

  // Add this right before the return statement
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Add function to handle flow creation
  const handleCreateFlow = async () => {
    if (isCreatingFlow) return;

    trackEvent("terminal_flow_create", {});

    try {
      setIsCreatingFlow(true);
      const newFlow = await createFlow({
        name: "New Flow",
        system_prompt: "",
      });

      // Wait for the query to invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ["flows"] });

      setSelectedFlow(newFlow);
      setEditingFlowName(newFlow.id);
      setNewFlowName(newFlow.name);
      setEditableSystemPrompt("");
      setVariables({});
      setTools([]);

      setToast({
        message: "Flow created successfully",
        type: "success",
        visible: true,
      });
    } catch (error) {
      console.error("Failed to create flow", error);
      setToast({
        message: "Failed to create flow",
        type: "error",
        visible: true,
      });
    } finally {
      setIsCreatingFlow(false);
    }
  };

  // Add function to handle flow name update
  const handleUpdateFlowName = async (flowId: string, newName: string) => {
    if (isUpdatingFlowName || !newName.trim()) return;

    trackEvent("terminal_flow_rename", {
      flow_id: flowId,
      new_name: newName,
    });

    try {
      setIsUpdatingFlowName(true);
      await updateFlow(String(flowId), {
        name: newName,
        system_prompt: selectedFlow?.system_prompt || "",
      });

      // Wait for the query to invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ["flows"] });

      setEditingFlowName(null);

      setToast({
        message: "Flow name updated",
        type: "success",
        visible: true,
      });
    } catch (error) {
      console.error("Failed to update flow name", error);
      setToast({
        message: "Failed to update flow name",
        type: "error",
        visible: true,
      });
    } finally {
      setIsUpdatingFlowName(false);
    }
  };

  const [showVerification, setShowVerification] = useState(false);
  const [verificationSystemMessage, setVerificationSystemMessage] = useState("");

  // Ref for the slider panel
  const sliderRef = useRef<HTMLDivElement>(null);

  // Handle outside click to close slider
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        isSliderOpen &&
        sliderRef.current &&
        !sliderRef.current.contains(event.target as Node)
      ) {
        setIsSliderOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isSliderOpen]);

  // Comment out delete flow state
  // const [isDeletingFlow, setIsDeletingFlow] = useState(false);
  // const [flowIdToDelete, setFlowIdToDelete] = useState<string | null>(null);

  // Update the computation for any operation in progress
  const isAnyOperationInProgress = isSavingFlow || isCreatingFlow || isUpdatingFlowName;

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

  return (
    <div className="relative flex h-screen overflow-hidden bg-gray-100">
      {/* Add Toast */}
      {toast && (
        <div className="fixed z-50 top-4 right-4 animate-fade-in">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg ${
              toast.type === "success"
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="flex items-center space-x-2">
              {toast.type === "success" ? (
                <div className="w-2 h-2 bg-green-500 rounded-full" />
              ) : (
                <div className="w-2 h-2 bg-red-500 rounded-full" />
              )}
              <p
                className={`text-sm font-medium ${
                  toast.type === "success" ? "text-green-800" : "text-red-800"
                }`}
              >
                {toast.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Metrics Modal */}
      {showMetrics && selectedFlow && (
        <MetricsModal
          onClose={() => setShowMetrics(false)}
          flowId={selectedFlow.id}
          title={`Metrics for Flow: ${selectedFlow.name}`}
        />
      )}

      {/* Add API Examples Modal */}
      {showAPIExamples && selectedFlow && (
        <FlowAPIExamplesModal
          onClose={() => setShowAPIExamples(false)}
          flowId={selectedFlow.id}
          flowName={selectedFlow.name}
          variables={Object.keys(variables)}
        />
      )}

      {/* Flow Slider - Update classes for mobile */}
      <div
        className={`absolute inset-y-0 left-0 z-30 w-full md:w-96 transform transition-transform duration-300 ease-in-out ${
          isSliderOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div ref={sliderRef} className="relative flex flex-col h-full bg-white shadow-xl">
          {/* Simple overlay to disable panel when any operation is in progress */}
          {isAnyOperationInProgress && (
            <div className="absolute inset-0 z-50 bg-white/20"></div>
          )}

          <div className="flex flex-col border-b border-gray-200">
            <div className="flex items-center justify-between p-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Flows</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {flows.length} {flows.length === 1 ? "flow" : "flows"} available
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCreateFlow}
                  disabled={isCreatingFlow}
                  className={`inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors group relative ${
                    isCreatingFlow ? "opacity-75 cursor-not-allowed" : ""
                  }`}
                >
                  {isCreatingFlow ? (
                    <>
                      <svg className="w-4 h-4 mr-1.5 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Creating...
                    </>
                  ) : (
                    <>
                      <PlusIcon className="w-4 h-4 mr-1.5" />
                      New Flow
                    </>
                  )}
                  <span className="absolute px-2 py-1 mb-2 text-xs font-medium text-white transition-opacity transform -translate-x-1/2 bg-gray-900 rounded-sm opacity-0 bottom-full left-1/2 group-hover:opacity-100 whitespace-nowrap">
                    Create a new flow
                  </span>
                </button>
                <button
                  onClick={() => setIsSliderOpen(false)}
                  className="relative p-2 text-gray-500 transition-colors rounded-full hover:text-gray-700 hover:bg-gray-100 group"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                  <span className="absolute right-0 px-2 py-1 mb-2 text-xs font-medium text-white transition-opacity bg-gray-900 rounded-sm opacity-0 bottom-full group-hover:opacity-100 whitespace-nowrap">
                    Hide flows panel
                  </span>
                </button>
              </div>
            </div>
            {selectedFlow && (
              <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <UserCircleIcon className="w-8 h-8 text-gray-400" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        {selectedFlow.name}
                      </h3>
                      <p className="text-xs text-gray-500">Currently editing</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveFlow}
                    disabled={isSavingFlow}
                    className={`inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors ${
                      isSavingFlow ? "opacity-75 cursor-not-allowed" : ""
                    }`}
                  >
                    {isSavingFlow ? (
                      <>
                        <svg className="w-4 h-4 mr-1.5 animate-spin" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <ArrowDownTrayIcon className="w-4 h-4 mr-1.5" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 p-6 space-y-4 overflow-y-auto">
            {/* Loading State */}
            {isFlowsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-full p-4 border border-gray-200 rounded-xl animate-pulse"
                  >
                    <div className="w-1/3 h-5 mb-3 bg-gray-200 rounded-sm"></div>
                    <div className="w-2/3 h-4 bg-gray-200 rounded-sm"></div>
                  </div>
                ))}
              </div>
            ) : flows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Bars3Icon className="w-12 h-12 mb-4" />
                <p className="text-lg font-medium">No flows available</p>
                <p className="mt-1 text-sm text-gray-400">
                  Create your first flow to get started
                </p>
              </div>
            ) : (
              flows.map((flow) => (
                <button
                  key={flow.id}
                  onClick={() => {
                    if (editingFlowName !== flow.id) {
                      setSelectedFlow(flow);
                      setVariables({});
                      setTools(flow.tools || []);
                      setIsSliderOpen(false);
                    }
                  }}
                  className={`w-full p-4 text-left transition-all rounded-xl border relative group ${
                    selectedFlow?.id === flow.id
                      ? "bg-linear-to-br from-indigo-50 to-white border-indigo-200 shadow-xs"
                      : "border-gray-200 hover:border-indigo-200 hover:bg-linear-to-br hover:from-gray-50 hover:to-white"
                  }`}
                >
                  {selectedFlow?.id === flow.id && (
                    <div className="absolute border-2 border-indigo-500 pointer-events-none -inset-px rounded-xl"></div>
                  )}
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      {editingFlowName === flow.id ? (
                        <div className="flex-1 mr-2">
                          <input
                            type="text"
                            value={newFlowName}
                            onChange={(e) => setNewFlowName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleUpdateFlowName(flow.id, newFlowName);
                              } else if (e.key === "Escape") {
                                setEditingFlowName(null);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-xs"
                            placeholder="Enter flow name..."
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="font-medium text-gray-900 transition-colors group-hover:text-indigo-600">
                          {flow.name}
                          <div className="inline-flex items-center ml-2 text-xs text-gray-500">
                            <span>ID: {flow.id}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(flow.id).then(() => {
                                  const tooltip = e.currentTarget.querySelector(
                                    ".copy-tooltip"
                                  ) as HTMLElement;
                                  if (tooltip) {
                                    tooltip.textContent = "Copied!";
                                    tooltip.classList.remove("opacity-0");
                                    setTimeout(() => {
                                      tooltip.textContent = "Copy ID";
                                      tooltip.classList.add("opacity-0");
                                    }, 1000);
                                  }
                                });
                              }}
                              className="relative inline-flex items-center p-1 ml-1 text-gray-400 transition-all rounded hover:text-indigo-600 hover:bg-indigo-50 group/copy"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-3.5 h-3.5"
                              >
                                <path d="M7.5 3.375c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 013.75 3.75v1.875C13.5 8.161 14.34 9 15.375 9h1.875A3.75 3.75 0 0121 12.75v3.375C21 17.16 20.16 18 19.125 18h-9.75A1.875 1.875 0 017.5 16.125V3.375z" />
                                <path d="M15 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0017.25 7.5h-1.875A.375.375 0 0115 7.125V5.25zM4.875 6H6v10.125A3.375 3.375 0 009.375 19.5H16.5v1.125c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V7.875C3 6.839 3.84 6 4.875 6z" />
                              </svg>
                              <span className="absolute px-2 py-1 mb-2 text-xs font-medium text-white transition-opacity -translate-x-1/2 bg-gray-900 rounded opacity-0 pointer-events-none copy-tooltip bottom-full left-1/2 whitespace-nowrap">
                                Copy ID
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (editingFlowName === flow.id) {
                              handleUpdateFlowName(flow.id, newFlowName);
                            } else {
                              setEditingFlowName(flow.id);
                              setNewFlowName(flow.name);
                            }
                          }}
                          disabled={isUpdatingFlowName && editingFlowName === flow.id}
                          className={`p-1.5 text-gray-400 rounded-md hover:text-indigo-600 hover:bg-indigo-50 transition-colors ${
                            isUpdatingFlowName && editingFlowName === flow.id
                              ? "opacity-75 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          {isUpdatingFlowName && editingFlowName === flow.id ? (
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                          ) : editingFlowName === flow.id ? (
                            <CheckIcon className="w-4 h-4" />
                          ) : (
                            <PencilIcon className="w-4 h-4" />
                          )}
                        </button>
                        {/* Delete button temporarily removed
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Are you sure you want to delete this flow?")) {
                              handleDeleteFlow(flow.id);
                            }
                          }}
                          disabled={isDeletingFlow && flowIdToDelete === flow.id}
                          className={`p-1.5 text-gray-400 rounded-md hover:text-red-600 hover:bg-red-50 transition-colors ${
                            isDeletingFlow && flowIdToDelete === flow.id ? "opacity-75 cursor-not-allowed" : ""
                          }`}
                        >
                          {isDeletingFlow && flowIdToDelete === flow.id ? (
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                          ) : (
                            <TrashIcon className="w-4 h-4" />
                          )}
                        </button>
                        */}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {flow.system_prompt || (
                        <span className="italic text-gray-400">No system prompt set</span>
                      )}
                    </div>
                    {flow.variables.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {flow.variables.map((variable, index) => (
                          <span
                            key={index}
                            className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-md"
                          >
                            {variable}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Update for mobile responsiveness */}
      <div className="flex flex-1">
        {/* Toggle Slider Button - Fixed below top bar */}
        <button
          onClick={() => setIsSliderOpen(true)}
          className={`fixed top-17 left-6 z-20 p-2 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-white hover:border-gray-300 hover:shadow-md transition-all duration-200 ${
            isSliderOpen ? "hidden" : "flex items-center space-x-2"
          }`}
        >
          <Bars3Icon className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
          <span className="hidden text-sm font-medium text-gray-500 group-hover:text-gray-700 md:inline">
            Show Flows
          </span>
        </button>

        {/* Mobile Panel Toggle */}
        {isMobileView && (
          <div className="fixed z-20 flex items-center p-1 space-x-2 -translate-x-1/2 bg-white rounded-full shadow-lg bottom-4 left-1/2">
            <button
              onClick={() => setActivePanel("left")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activePanel === "left"
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setActivePanel("right")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activePanel === "right"
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Preview
            </button>
          </div>
        )}

        {/* Left Panel - Update for mobile */}
        <div
          className={`flex flex-col w-full md:w-1/2 pt-12 p-6 overflow-y-auto border-r border-gray-200 transition-all duration-300 ${
            isMobileView && activePanel === "right" ? "hidden" : "block"
          }`}
        >
          {selectedFlow ? (
            <>
              {/* System Message */}
              <div className="mb-6 border border-gray-200 rounded-lg bg-linear-to-b from-gray-50 to-white">
                <div
                  className="flex items-center justify-between px-4 py-3 border-b border-gray-200 cursor-pointer bg-linear-to-b from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100"
                  onClick={() => toggleSection("system")}
                >
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-md">
                      system
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      System Prompt
                    </span>
                  </div>
                  {sectionsOpen.system ? (
                    <ChevronUpIcon className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                {sectionsOpen.system && (
                  <>
                    <div className="p-4">
                      <textarea
                        value={editableSystemPrompt}
                        onChange={(e) => setEditableSystemPrompt(e.target.value)}
                        rows={5}
                        className="w-full p-3 font-mono text-sm text-gray-700 transition-shadow bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter system prompt... Use {{variable}} for variables"
                      />
                    </div>

                    {/* Variables */}
                    {Object.entries(variables).length > 0 && (
                      <div className="px-4 py-3 border-t border-gray-200 bg-linear-to-b from-gray-50 to-white">
                        <h4 className="mb-3 text-sm font-medium text-gray-700">
                          Variables
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(variables).map(([key, value]) => (
                            <div key={key} className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-600">
                                {key}:
                              </span>
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  setVariables((prev) => ({
                                    ...prev,
                                    [key]: newValue,
                                  }));
                                }}
                                className={`flex-1 px-3 py-1.5 text-sm border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
                                  !value || value.trim() === ""
                                    ? "border-red-300 bg-red-50"
                                    : "border-gray-300 bg-white hover:border-gray-400"
                                }`}
                                placeholder="Required"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Conversation Flow */}
              <div className="mb-6 border border-gray-200 rounded-lg bg-linear-to-b from-gray-50 to-white">
                <div
                  className="flex items-center justify-between px-4 py-3 border-b border-gray-200 cursor-pointer bg-linear-to-b from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100"
                  onClick={() => toggleSection("conversation")}
                >
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-md">
                      conversation
                    </span>
                    <span className="text-sm font-medium text-gray-700">Messages</span>
                  </div>
                  {sectionsOpen.conversation ? (
                    <ChevronUpIcon className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                {sectionsOpen.conversation && (
                  <div className="p-4 space-y-4">
                    {/* Conversation Messages */}
                    {conversation.map((message, index) => (
                      <div
                        key={index}
                        className={`border rounded-lg ${
                          message.role === "user"
                            ? "bg-blue-50 border-blue-200"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <div className="flex items-center justify-between px-4 py-2 border-b border-inherit">
                          <div className="flex items-center space-x-2">
                            <select
                              value={message.role}
                              onChange={(e) => {
                                const newMessages = [...conversation];
                                newMessages[index] = {
                                  ...message,
                                  role: e.target.value as "user" | "assistant" | "system",
                                };
                                setConversation(newMessages);
                              }}
                              className={`px-2 py-1 text-xs font-medium rounded-md border-0 focus:ring-1 focus:ring-indigo-500 ${
                                message.role === "user"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              <option value="user">user</option>
                              <option value="assistant">assistant</option>
                              <option value="system">system</option>
                            </select>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => {
                                setConversation(
                                  conversation.filter((_, i) => i !== index)
                                );
                              }}
                              className="p-1 text-red-500 hover:text-red-700"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="p-4">
                          <textarea
                            value={message.content}
                            onChange={(e) => {
                              const newMessages = [...conversation];
                              newMessages[index] = {
                                ...message,
                                content: e.target.value,
                              };
                              setConversation(newMessages);
                            }}
                            rows={3}
                            className="w-full p-3 text-sm transition-colors border border-gray-200 rounded-lg resize-none bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white"
                            placeholder={
                              message.role === "user"
                                ? "Type your message..."
                                : "Assistant's response..."
                            }
                          />
                        </div>
                      </div>
                    ))}

                    {/* Add Message Button */}
                    <button
                      onClick={handleAddMessage}
                      className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-linear-to-b from-white to-gray-50 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors group relative"
                    >
                      <PlusIcon className="w-4 h-4 md:mr-1.5" />
                      Add Message
                    </button>
                  </div>
                )}
              </div>

              {/* Tools Editor - Moved to the bottom */}
              {/* <div
                className={`border border-gray-200 rounded-lg bg-linear-to-b from-gray-50 to-white ${
                  sectionsOpen.tools ? "flex-1" : ""
                }`}
              >
                <div
                  className="flex items-center justify-between px-4 py-3 border-b border-gray-200 cursor-pointer bg-linear-to-b from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100"
                  onClick={() => toggleSection("tools")}
                >
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-md">
                      tools
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      Function Tools
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newTool: Tool = {
                          type: "function",
                          function: {
                            name: "",
                            description: "",
                            parameters: {
                              type: "object",
                              properties: {},
                              required: [],
                            },
                          },
                        };
                        setTools([...tools, newTool]);
                      }}
                      className="px-2 py-1 text-sm text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50"
                    >
                      Add Tool
                    </button>
                    {sectionsOpen.tools ? (
                      <ChevronUpIcon className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </div>
                {sectionsOpen.tools && (
                  <div className="p-4 space-y-4">
                    {tools.map((tool, index) => (
                      <div
                        key={index}
                        className="p-4 bg-white border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-medium text-gray-900">
                            Function {index + 1}
                          </h4>
                          <button
                            onClick={() => setTools(tools.filter((_, i) => i !== index))}
                            className="p-1 text-red-500 rounded-md hover:text-red-700 hover:bg-red-50"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="block mb-1 text-xs font-medium text-gray-700">
                              Name
                            </label>
                            <input
                              type="text"
                              value={tool.function.name}
                              onChange={(e) => {
                                const newTools = [...tools];
                                newTools[index] = {
                                  ...tool,
                                  function: {
                                    ...tool.function,
                                    name: e.target.value,
                                  },
                                };
                                setTools(newTools);
                              }}
                              className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Enter function name..."
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-xs font-medium text-gray-700">
                              Description
                            </label>
                            <textarea
                              value={tool.function.description}
                              onChange={(e) => {
                                const newTools = [...tools];
                                newTools[index] = {
                                  ...tool,
                                  function: {
                                    ...tool.function,
                                    description: e.target.value,
                                  },
                                };
                                setTools(newTools);
                              }}
                              rows={2}
                              className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Enter function description..."
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-xs font-medium text-gray-700">
                              Parameters (JSON)
                            </label>
                            <textarea
                              value={JSON.stringify(tool.function.parameters, null, 2)}
                              onChange={(e) => {
                                try {
                                  const params = JSON.parse(e.target.value);
                                  const newTools = [...tools];
                                  newTools[index] = {
                                    ...tool,
                                    function: {
                                      ...tool.function,
                                      parameters: params,
                                    },
                                  };
                                  setTools(newTools);
                                } catch (err) {
                                  console.error("Failed to update tool parameters", err);
                                }
                              }}
                              rows={4}
                              className="w-full px-3 py-1 font-mono text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="{}"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {tools.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-6 text-gray-500">
                        <WrenchIcon className="w-8 h-8 mb-2" />
                        <p className="text-sm">No tools added yet</p>
                      </div>
                    )}
                  </div>
                )}
              </div> */}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-500">
              <Bars3Icon className="w-12 h-12 mb-4" />
              <p>Select a flow to get started</p>
            </div>
          )}
        </div>

        {/* Right Panel - Update for mobile */}
        <div
          className={`flex flex-col w-full md:w-1/2 p-6 bg-gray-50 transition-all duration-300 ${
            isMobileView && activePanel === "left" ? "hidden" : "block"
          }`}
        >
          {/* Header Controls - Make more compact for mobile */}
          <div className="flex flex-col justify-between mb-6 space-y-4 md:flex-row md:items-center md:space-y-0">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isLoading
                      ? "bg-yellow-500 animate-pulse"
                      : conversation.length === 0
                        ? "bg-gray-400"
                        : "bg-green-500"
                  }`}
                ></div>
                <span className="text-sm font-medium text-gray-600">
                  {isLoading
                    ? "Generating..."
                    : conversation.length === 0
                      ? "Add messages to start"
                      : "Ready to generate"}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Model:</label>
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="pl-3 pr-10 py-1.5 text-sm border border-gray-300 rounded-md bg-white shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                  >
                    {Array.isArray(models) &&
                      models.map((modelId: string) => (
                        <option key={modelId} value={modelId}>
                          {modelId.split("/").pop()}
                        </option>
                      ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                href="/help/flows"
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors group relative"
              >
                <QuestionMarkCircleIcon className="w-4 h-4 md:mr-1.5" />

                <span className="absolute px-2 py-1 mb-2 text-xs font-medium text-white transition-opacity bg-gray-900 rounded-sm opacity-0 bottom-full left-1/2 group-hover:opacity-100 whitespace-nowrap">
                  How to use flows
                </span>
              </Link>
              {selectedFlow && (
                <button
                  onClick={() => setShowMetrics(true)}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors group relative"
                >
                  <ChartBarIcon className="w-4 h-4 md:mr-1.5" />

                  <span className="absolute px-2 py-1 mb-2 text-xs font-medium text-white transition-opacity bg-gray-900 rounded-sm opacity-0 bottom-full left-1/2 group-hover:opacity-100 whitespace-nowrap">
                    View flow metrics and analytics
                  </span>
                </button>
              )}
              {selectedFlow && (
                <button
                  onClick={() => {
                    trackEvent("terminal_api_examples_view", {
                      flow_id: selectedFlow.id,
                      flow_name: selectedFlow.name,
                    });
                    setShowAPIExamples(true);
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors group relative"
                >
                  <CodeBracketIcon className="w-4 h-4 md:mr-1.5" />

                  <span className="absolute px-2 py-1 mb-2 text-xs font-medium text-white transition-opacity bg-gray-900 rounded-sm opacity-0 bottom-full left-1/2 group-hover:opacity-100 whitespace-nowrap">
                    View API integration examples
                  </span>
                </button>
              )}
              <button
                onClick={handleRedo}
                disabled={!previewMessage || isLoading}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group relative"
              >
                <ArrowPathIcon className="w-4 h-4 md:mr-1.5" />
                {/* <span className="hidden md:inline">Regenerate</span> */}
                <span className="absolute px-2 py-1 mb-2 text-xs font-medium text-white transition-opacity transform -translate-x-1/2 bg-gray-900 rounded-sm opacity-0 bottom-full left-1/2 group-hover:opacity-100 whitespace-nowrap">
                  Generate a new response
                </span>
              </button>
              {isLoading ? (
                <button
                  onClick={handleStop}
                  className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-colors bg-red-600 rounded-md hover:bg-red-700 group"
                >
                  <StopIcon className="w-4 h-4 md:mr-1.5" />
                  <span className="hidden md:inline">Stop</span>
                  <span className="absolute px-2 py-1 mb-2 text-xs font-medium text-white transition-opacity transform -translate-x-1/2 bg-gray-900 rounded-sm opacity-0 bottom-full left-1/2 group-hover:opacity-100 whitespace-nowrap">
                    Stop generation
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleRun}
                  disabled={!selectedFlow || conversation.length === 0}
                  className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-colors bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <PlayIcon className="w-4 h-4 md:mr-1.5" />
                  {/* <span className="hidden md:inline">Generate</span> */}
                  <span className="absolute px-2 py-1 mb-2 text-xs font-medium text-white transition-opacity transform -translate-x-1/2 bg-gray-900 rounded-sm opacity-0 bottom-full left-1/2 group-hover:opacity-100 whitespace-nowrap">
                    Generate response
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Preview Content - Adjust height for mobile */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="text-sm font-medium text-gray-900">Response Preview</div>
              <div className="flex space-x-2">
                <button
                  onClick={handleAddToConversation}
                  disabled={!previewMessage || isGenerating}
                  className={`px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                    (!previewMessage || isGenerating) && "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <CheckIcon className="w-4 h-4" />
                  <span>Add to Conversation</span>
                </button>
                <button
                  onClick={() => setShowVerification(!showVerification)}
                  disabled={!previewMessage || isGenerating}
                  className={`px-3 py-1 ${
                    showVerification
                      ? "bg-gray-600 hover:bg-gray-700"
                      : "bg-green-600 hover:bg-green-700"
                  } text-white rounded flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                    (!previewMessage || isGenerating) && "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <ChartBarIcon className="w-4 h-4" />
                  <span>{showVerification ? "Hide Verification" : "Verify"}</span>
                </button>
              </div>
            </div>
            <div className="relative flex-1 overflow-hidden">
              <div className="w-full h-[calc(100vh-13rem)] overflow-y-auto">
                <div className="p-4">
                  {previewMessage ? (
                    <div className="prose max-w-none">
                      <ReactMarkdown>{previewMessage.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[calc(100vh-17rem)] text-gray-500">
                      <PlayIcon className="w-12 h-12 mb-4 text-indigo-300" />
                      <div className="text-lg font-medium">Ready to Generate</div>
                      <div className="mt-1 text-sm text-gray-400">
                        {conversation.length === 0 ? (
                          <div className="flex items-center">
                            <PlusIcon className="w-4 h-4 mr-1" />
                            <span>Add messages to get started</span>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <PlayIcon className="w-4 h-4 mr-1" />
                            <span>Click Generate to create a response</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 mt-4 text-red-700 border border-red-100 rounded-lg bg-red-50">
              <div className="flex">
                <XMarkIcon className="w-5 h-5 mr-2 shrink-0" />
                <div>
                  <p className="font-medium">Generation failed</p>
                  <p className="mt-1 text-sm text-red-600">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-screen verification panel */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-xs z-50 transition-all duration-300 ${
          showVerification ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setShowVerification(false)}
      >
        <div
          className={`absolute inset-y-0 right-0 w-full md:w-2/3 lg:w-1/2 bg-white shadow-2xl transform transition-transform duration-300 ease-out ${
            showVerification ? "translate-x-0" : "translate-x-full"
          } flex flex-col h-full`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between flex-none px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Response Verification</h2>
            <button
              onClick={() => setShowVerification(false)}
              className="p-2 text-gray-500 transition-colors rounded-full hover:bg-gray-100 hover:text-gray-700"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-auto">
            {previewMessage && (
              <>
                <div className="flex-none p-4 bg-white border-b border-gray-200">
                  <label
                    htmlFor="verification-system-message"
                    className="block mb-2 text-sm font-medium text-gray-700"
                  >
                    System Message for Verification
                  </label>
                  <textarea
                    id="verification-system-message"
                    value={verificationSystemMessage}
                    onChange={(e) => setVerificationSystemMessage(e.target.value)}
                    placeholder="Enter a system message for verification (optional)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                  />
                </div>
                <div className="flex-1">
                  <MessageVerification
                    messages={
                      verificationSystemMessage
                        ? [
                            { role: "system", content: verificationSystemMessage },
                            ...conversation,
                            previewMessage,
                          ]
                        : [...conversation, previewMessage]
                    }
                    models={models}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
