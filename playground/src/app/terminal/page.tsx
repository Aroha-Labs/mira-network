"use client";

import { useState, useRef, useMemo, useEffect, Fragment } from "react";
import { useSession } from "src/hooks/useSession";
import TryFlowModal from "src/components/TryFlowModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "src/lib/axios";
import { CodeBlock, dracula } from "react-code-blocks";
import { Flow, Message, Tool, streamChatCompletion } from "src/utils/chat";
import Toast from "src/components/Toast";
import { Dialog } from "@headlessui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MetricsModal from "src/components/MetricsModal";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  Bars4Icon,
  XMarkIcon,
  CommandLineIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  BookOpenIcon,
} from "@heroicons/react/24/outline";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import AutoGrowTextarea from "src/components/AutoGrowTextarea";
import { StopIcon } from "@heroicons/react/24/solid";
import {
  ChatBubbleBottomCenterIcon,
  BeakerIcon,
  DocumentTextIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";
import ChatBubble from "src/components/ChatBubble";
import { Menu, Transition } from "@headlessui/react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { WrenchIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import ToolEditModal from "src/components/ToolEditModal";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Add new interface for flow stats
interface FlowStats {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_cost: number;
  model: string;
  model_pricing: {
    prompt_token: number;
    completion_token: number;
  };
  total_response_time: number;
  ttft: number;
  time_series: Array<{
    timestamp: string;
    tokens: number;
    cost: number;
  }>;
}

const fetchFlows = async () => {
  const { data } = await api.get("/flows");
  return data;
};

const createFlow = async (flow: {
  name: string;
  system_prompt: string;
  variables: string[];
}) => {
  return api.post("/flows", {
    name: flow.name,
    system_prompt: flow.system_prompt,
  });
};

const updateFlow = async (flow: {
  id: number;
  name: string;
  system_prompt: string;
  variables: string[];
}) => {
  return api.put(`/flows/${flow.id}`, {
    name: flow.name,
    system_prompt: flow.system_prompt,
  });
};

const deleteFlow = async (flowId: number) => {
  return api.delete(`/flows/${flowId}`);
};

const getApiExample = (
  flow: Flow,
  userMessage?: string,
  userVariables?: Record<string, string>
) => {
  const variablesSection =
    flow.variables.length > 0
      ? `"variables": {
      ${flow.variables
        .map((v) => `"${v}": "${userVariables?.[v] || "value"}"`)
        .join(",\n      ")}
    },`
      : "";

  return `curl -X POST https://apis.mira.network/v1/flow/${flow.id}/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "${userMessage || "your message"}"
      }
    ],
    "model": "gpt-4o",
    ${variablesSection}
    "tools": [],
    "stream": false
  }'`;
};

const fetchSupportedModels = async () => {
  const response = await api.get("/v1/models");
  if (response.status !== 200) throw new Error("Failed to fetch models");
  return response.data.data.map((model: { id: string }) => model.id);
};

const getCodeExample = (
  flow: Flow | null,
  language: string,
  variables: Record<string, string>
): string => {
  if (!flow) return "";

  const examples = {
    curl: `curl -X POST https://apis.mira.network/v1/flow/${flow.id}/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "your message"
      }
    ],
    "model": "gpt-4",
    ${
      flow.variables.length > 0
        ? `"variables": {
      ${flow.variables
        .map((v) => `"${v}": "${variables[v] || "value"}"`)
        .join(",\n      ")}
    },`
        : ""
    }
    "stream": false
  }'`,
    python: `from mira import MiraClient

mira = MiraClient('YOUR_API_KEY')

def chat():
    response = mira.flows.chat(
        flow_id=${flow.id},
        messages=[{'role': 'user', 'content': 'Hello!'}],
        variables=${JSON.stringify(variables, null, 2).replace(/"([^"]+)":/g, "'$1':")}
    )
    
    print(response.choices[0].message.content)`,
    node: `import { MiraClient } from '@mira/sdk';

const mira = new MiraClient('YOUR_API_KEY');

async function chat() {
  const response = await mira.flows.chat(${flow.id}, {
    messages: [{ role: 'user', content: 'Hello!' }],
    variables: ${JSON.stringify(variables, null, 2)},
  });
  
  console.log(response.choices[0].message.content);
}`,
    go: `package main

import (
    "fmt"
    "github.com/mira/sdk-go"
)

func main() {
    client := mira.NewClient("YOUR_API_KEY")
    
    response, err := client.Flows.Chat(${flow.id}, mira.ChatRequest{
        Messages: []mira.Message{
            {Role: "user", Content: "Hello!"},
        },
        Variables: ${JSON.stringify(variables, null, 2).replace(/"([^"]+)":/g, "$1:")},
    })
    
    if err != nil {
        panic(err)
    }
    
    fmt.Println(response.Choices[0].Message.Content)
}`,
  };

  return examples[language as keyof typeof examples] || examples.curl;
};

const TerminalPage = () => {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { data: userSession, isLoading: isUserLoading } = useSession();
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [showTryFlow, setShowTryFlow] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"chat" | "api" | "metrics">("chat");
  const [selectedApiTab, setSelectedApiTab] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [flowResponse, setFlowResponse] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const queryClient = useQueryClient();
  const [flowToDelete, setFlowToDelete] = useState<Flow | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [userInput, setUserInput] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    // Default to collapsed on mobile
    return window.innerWidth < 768;
  });
  const [showApiModal, setShowApiModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("curl");
  const [selectedModel, setSelectedModel] = useState("");
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showVariables, setShowVariables] = useState(false);
  const [showVariablesList, setShowVariablesList] = useState(false);
  const variablesListRef = useRef<HTMLDivElement>(null);
  const [showToolModal, setShowToolModal] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | undefined>();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        variablesListRef.current &&
        !variablesListRef.current.contains(event.target as Node)
      ) {
        setShowVariablesList(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const {
    data: flows,
    isLoading: isFlowLoading,
    error,
  } = useQuery<Flow[]>({
    queryKey: ["flows"],
    queryFn: fetchFlows,
    enabled: !!userSession?.user,
  });

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

  useEffect(() => {
    // Clear messages and variables when flow changes
    setMessages([]);
    setVariables({});
    setUserInput("");
    setFlowResponse(null);

    // Reset any error states
    setErrorMessage("");
    setIsLoading(false);

    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [selectedFlow?.id]);

  const createFlowMutation = useMutation({
    mutationFn: createFlow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      setToast({ message: "Flow created successfully!", type: "success" });
    },
    onError: (error) => {
      setToast({
        message: error instanceof Error ? error.message : "Failed to create flow",
        type: "error",
      });
    },
  });

  const updateFlowMutation = useMutation({
    mutationFn: updateFlow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      setToast({ message: "Flow updated successfully!", type: "success" });
    },
    onError: (error) => {
      setToast({
        message: error instanceof Error ? error.message : "Failed to update flow",
        type: "error",
      });
    },
  });

  const deleteFlowMutation = useMutation({
    mutationFn: deleteFlow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      setToast({ message: "Flow deleted successfully!", type: "success" });
      setShowDeleteConfirm(false);
      if (selectedFlow?.id === flowToDelete?.id) {
        setSelectedFlow(null);
      }
    },
    onError: (error) => {
      setToast({
        message: error instanceof Error ? error.message : "Failed to delete flow",
        type: "error",
      });
    },
  });

  const handleCreateFlow = async (flow: {
    name: string;
    system_prompt: string;
    variables: string[];
  }) => {
    createFlowMutation.mutate(flow);
  };

  const handleEditFlow = async (flow: {
    name: string;
    system_prompt: string;
    variables: string[];
  }) => {
    if (!selectedFlow) return;
    updateFlowMutation.mutate({
      id: selectedFlow.id,
      ...flow,
    });
  };

  const handleEditClick = () => {
    if (!selectedFlow) return;
    setIsEditing(true);
    setShowTryFlow(true);
  };

  const handleDeleteClick = (flow: Flow) => {
    setFlowToDelete(flow);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (flowToDelete) {
      deleteFlowMutation.mutate(flowToDelete.id);
    }
  };

  const handleRunFlow = async (variables: Record<string, string>, input: string) => {
    // Check if all required variables are set
    const missingVariables = selectedFlow?.variables.filter(
      (variable) => !variables[variable] || variables[variable].trim() === ""
    );

    if (missingVariables && missingVariables.length > 0) {
      setErrorMessage(
        `Please set the following variables: ${missingVariables.join(", ")}`
      );
      setShowVariables(true);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      const userMessage = { role: "user" as const, content: input };
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

      await streamChatCompletion(
        {
          messages: updatedMessages,
          model: selectedModel,
          variables,
          flowId: selectedFlow!.id,
          endpoint: `/v1/flow/${selectedFlow!.id}/chat/completions`,
          tools,
        },
        abortControllerRef.current,
        {
          onMessage: (chunk) => {
            console.log("Received chunk:", chunk);
            if (typeof chunk === "string") {
              assistantMessage.content += chunk;
            } else {
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
          onError: (error) => {
            console.error("Chat completion error:", error);
            throw error;
          },
        }
      );
    } catch (error) {
      const err = error as Error;
      if (err.name !== "AbortError") {
        console.error("Failed to send message:", error);
        setMessages((prev) => prev.slice(0, -2));
        setUserInput(input);
        setErrorMessage(err.message || "Failed to send message. Please try again.");
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
      await streamChatCompletion(
        {
          messages: messagesToKeep,
          model: selectedModel,
          variables,
          flowId: selectedFlow!.id,
          endpoint: `/v1/flow/${selectedFlow!.id}/chat/completions`,
          tools,
        },
        abortControllerRef.current,
        {
          onMessage: (chunk) => {
            console.log("Received refresh chunk:", chunk);
            if (typeof chunk === "string") {
              assistantMessage.content += chunk;
            } else {
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
          onError: (error) => {
            console.error("Failed to refresh message:", error);
            throw error;
          },
        }
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

  const handleVariableChange = (variable: string, value: string) => {
    setVariables((prev) => ({ ...prev, [variable]: value }));
    setErrorMessage("");
  };

  const handleAddTool = () => {
    setEditingTool({
      type: "function",
      function: {
        name: "",
        description: "",
        parameters: [],
      },
    });
    setShowToolModal(true);
  };

  const handleEditTool = (tool: Tool) => {
    setEditingTool({ ...tool }); // Create a deep copy to avoid mutating the original
    setShowToolModal(true);
  };

  const handleRemoveTool = (index: number) => {
    const newTools = [...tools];
    newTools.splice(index, 1);
    setTools(newTools);
  };

  if (isUserLoading) {
    return <div>Loading...</div>;
  }

  if (!userSession?.user) {
    return <div>You must be logged in to use this feature</div>;
  }

  if (isFlowLoading) {
    return (
      <div className="container px-4 py-8 mx-auto">
        <div className="text-center text-gray-600">Loading flows...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container px-4 py-8 mx-auto">
        <div className="text-center text-red-600">
          Error: {error instanceof Error ? error.message : "Failed to fetch flows"}
        </div>
      </div>
    );
  }

  const languageTabs = [
    { id: 'curl', name: 'cURL', icon: CommandLineIcon },
    { id: 'python', name: 'Python', icon: ({ className }: { className: string }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M14.25.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.06-.26.04-.21.02H8.77l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.36-.1.35-.07.32-.04.28-.02.21v3.06H3.17l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05-.05-1.23.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.18l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09-.33.22zM21.1 6.11l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01.21.03zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08-.33.23z"/>
      </svg>
    )},
    { id: 'node', name: 'Node.js', icon: ({ className }: { className: string }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.998,24c-0.321,0-0.641-0.084-0.922-0.247l-2.936-1.737c-0.438-0.245-0.224-0.332-0.08-0.383 c0.585-0.203,0.703-0.25,1.328-0.604c0.065-0.037,0.151-0.023,0.218,0.017l2.256,1.339c0.082,0.045,0.197,0.045,0.272,0l8.795-5.076 c0.082-0.047,0.134-0.141,0.134-0.238V6.921c0-0.099-0.053-0.192-0.137-0.242l-8.791-5.072c-0.081-0.047-0.189-0.047-0.271,0 L3.075,6.68C2.99,6.729,2.936,6.825,2.936,6.921v10.15c0,0.097,0.054,0.189,0.139,0.235l2.409,1.392 c1.307,0.654,2.108-0.116,2.108-0.89V7.787c0-0.142,0.114-0.253,0.256-0.253h1.115c0.139,0,0.255,0.112,0.255,0.253v10.021 c0,1.745-0.95,2.745-2.604,2.745c-0.508,0-0.909,0-2.026-0.551L2.28,18.675c-0.57-0.329-0.922-0.945-0.922-1.604V6.921 c0-0.659,0.353-1.275,0.922-1.603l8.795-5.082c0.557-0.315,1.296-0.315,1.848,0l8.794,5.082c0.57,0.329,0.924,0.944,0.924,1.603 v10.15c0,0.659-0.354,1.273-0.924,1.604l-8.794,5.078C12.643,23.916,12.324,24,11.998,24z M19.099,13.993 c0-1.9-1.284-2.406-3.987-2.763c-2.731-0.361-3.009-0.548-3.009-1.187c0-0.528,0.235-1.233,2.258-1.233 c1.807,0,2.473,0.389,2.747,1.607c0.024,0.115,0.129,0.199,0.247,0.199h1.141c0.071,0,0.138-0.031,0.186-0.081 c0.048-0.054,0.074-0.123,0.067-0.196c-0.177-2.098-1.571-3.076-4.388-3.076c-2.508,0-4.004,1.058-4.004,2.833 c0,1.925,1.488,2.457,3.895,2.695c2.88,0.282,3.103,0.703,3.103,1.269c0,0.983-0.789,1.402-2.642,1.402 c-2.327,0-2.839-0.584-3.011-1.742c-0.02-0.124-0.126-0.215-0.253-0.215h-1.137c-0.141,0-0.254,0.112-0.254,0.253 c0,1.482,0.806,3.248,4.655,3.248C17.501,17.007,19.099,15.91,19.099,13.993z"/>
      </svg>
    )},
    { id: 'go', name: 'Go', icon: ({ className }: { className: string }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M1.811 9.704l-.407.27a.07.07 0 00-.025.027c-.004.012-.002.025.004.037l.24.315c.005.008.013.014.023.018a.062.062 0 00.063-.009l.315-.21a.75.75 0 01.847-.016l3.5 2.375a.748.748 0 01.326.62v4.246c0 .256-.133.494-.352.628l-3.5 2.125a.75.75 0 01-.77.01l-3.5-2.125a.748.748 0 01-.352-.627V13.13c0-.256.133-.493.35-.627l.92-.565a1.578 1.578 0 011.612 0l.918.564a.748.748 0 01.35.627v2.74c0 .256.133.494.352.628l.777.472a.75.75 0 00.77-.01l.778-.471a.748.748 0 00.351-.628v-2.74c0-.256-.133-.493-.35-.627l-2.063-1.266a.75.75 0 00-.77.01l-2.063 1.266a.748.748 0 00-.35.627v2.74c0 .256.133.494.352.628l3.5 2.125a.75.75 0 00.77-.01l3.5-2.125a.748.748 0 00.352-.628v-4.246a.748.748 0 00-.326-.62l-3.5-2.375a.75.75 0 01-.847.016l-.315.21a.062.062 0 01-.063.009.047.047 0 01-.023-.018l-.24-.315a.052.052 0 01-.004-.037c.004-.01.013-.02.025-.027l.407-.27a1.58 1.58 0 011.77.035l3.5 2.375c.459.31.735.83.735 1.385v4.246c0 .555-.276 1.074-.735 1.385l-3.5 2.125a1.579 1.579 0 01-1.618-.021l-3.5-2.125A1.578 1.578 0 010 17.377v-4.246c0-.555.276-1.074.735-1.385l3.5-2.375a1.58 1.58 0 011.77-.035z"/>
      </svg>
    )},
  ];

  if (isUserLoading) {
    return <div>Loading...</div>;
  }

  if (!userSession?.user) {
    return <div>You must be logged in to use this feature</div>;
  }

  if (isFlowLoading) {
    return (
      <div className="container px-4 py-8 mx-auto">
        <div className="text-center text-gray-600">Loading flows...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container px-4 py-8 mx-auto">
        <div className="text-center text-red-600">
          Error: {error instanceof Error ? error.message : "Failed to fetch flows"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50 grow">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Collapsible Sidebar */}
      <div
        className={`${
          isSidebarCollapsed ? "w-16" : "w-64 md:w-80"
        } flex-shrink-0 bg-white border-r border-gray-200 transition-all duration-200 ease-in-out relative
        ${
          isSidebarCollapsed
            ? "lg:block"
            : "lg:block max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50"
        }
        ${!isSidebarCollapsed && !isSidebarOpen ? "max-lg:translate-x-[-100%]" : ""}
        `}
      >
        {/* Mobile Close Button */}
        {!isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="absolute p-2 text-gray-400 top-4 right-4 hover:text-gray-500 lg:hidden"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        )}

        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {!isSidebarCollapsed && (
              <h2 className="text-lg font-medium text-gray-900">Your Flows</h2>
            )}
            <button
              onClick={() => setShowTryFlow(true)}
              className={`inline-flex items-center p-2 text-sm font-medium text-indigo-600 rounded-md bg-indigo-50 hover:bg-indigo-100 ${
                isSidebarCollapsed ? "mx-auto" : ""
              }`}
              title="Create New Flow"
            >
              <svg
                className="w-5 h-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Flow List */}
        <div className="flex-1 overflow-y-auto">
          <div className={`${isSidebarCollapsed ? "p-2" : "p-4"} space-y-2`}>
            {flows?.map((flow) => (
              <div
                key={flow.id}
                className={`${
                  isSidebarCollapsed ? "p-2" : "p-3"
                } rounded-lg cursor-pointer transition-all ${
                  selectedFlow?.id === flow.id
                    ? "bg-blue-50 border-blue-500"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => setSelectedFlow(flow)}
                title={isSidebarCollapsed ? flow.name : undefined}
              >
                <div className="flex items-center justify-between">
                  {isSidebarCollapsed ? (
                    <div
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium ${
                        selectedFlow?.id === flow.id
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {flow.name.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium truncate">{flow.name}</h3>
                        <p className="mt-1 text-xs text-gray-500">Flow ID: {flow.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFlow(flow);
                            setShowMetrics(true);
                          }}
                          className="p-1 text-gray-400 rounded hover:text-indigo-500"
                          title="View Metrics"
                        >
                          <ChartBarIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(flow);
                          }}
                          className="p-1 text-gray-400 rounded hover:text-red-500"
                          title="Delete Flow"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop toggle button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute z-10 hidden p-1 bg-white border border-gray-200 rounded-full shadow-sm -right-3 top-6 lg:block hover:bg-gray-50"
        >
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
              isSidebarCollapsed ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex-shrink-0 bg-white shadow-sm px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-gray-500 hover:text-gray-600"
          >
            {isSidebarOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars4Icon className="h-6 w-6" />
            )}
          </button>
          <h1 className="text-lg font-medium text-gray-900">Terminal</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedFlow ? (
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <div className="flex-shrink-0 flex flex-col justify-between px-4 py-4 space-y-4 bg-white border-b border-gray-200 sm:flex-row sm:items-center sm:px-6 sm:space-y-0">
                <div className="flex items-center space-x-4">
                  <h2 className="text-xl font-semibold text-gray-900 truncate">
                    {selectedFlow.name}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  {/* Tools Button */}
                  <Menu as="div" className="relative">
                    <Menu.Button className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]">
                      <WrenchIcon className="w-4 h-4 mr-2" />
                      <span>Tools</span>
                      <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                        {tools.length}
                      </span>
                    </Menu.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 mt-2 w-80 origin-top-right bg-white border border-gray-200 rounded-lg shadow-lg focus:outline-none z-10">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-900">
                              Flow Tools
                            </h3>
                            <button
                              onClick={handleAddTool}
                              className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                            >
                              Add Tool
                            </button>
                          </div>
                          <div className="space-y-3">
                            {tools.length === 0 ? (
                              <div className="text-sm text-gray-500 text-center py-4">
                                No tools added yet
                              </div>
                            ) : (
                              tools.map((tool, index) => (
                                <div key={index} className="group relative">
                                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium text-sm text-gray-900">
                                        {tool.function.name}
                                      </span>
                                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => handleEditTool(tool)}
                                          className="p-1 text-gray-500 hover:text-blue-600"
                                          title="Edit Tool"
                                        >
                                          <PencilIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleRemoveTool(index)}
                                          className="p-1 text-gray-500 hover:text-red-600"
                                          title="Remove Tool"
                                        >
                                          <TrashIcon className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-xs text-gray-500 line-clamp-2">
                                      {tool.function.description}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </Menu.Items>
                    </Transition>
                  </Menu>

                  {/* Edit Flow Button */}
                  <button
                    onClick={handleEditClick}
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <PencilIcon className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Edit Flow</span>
                  </button>

                  {/* Get Code Button */}
                  <button
                    onClick={() => setShowCodeModal(true)}
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <CodeBracketIcon className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Get Code</span>
                  </button>

                  {/* Model Selector */}
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
                  >
                    {supportedModelsOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto">
                  <div className="h-full">
                    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                      {!flowResponse && messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 min-h-[400px]">
                          <ChatBubbleBottomCenterIcon className="w-16 h-16 mb-4" />
                          <div className="text-lg text-center">
                            Start a conversation...
                          </div>
                          {selectedFlow?.variables &&
                            selectedFlow.variables.length > 0 && (
                              <div className="mt-4 text-center">
                                <p className="text-sm text-gray-500 mb-2">
                                  This flow requires the following variables:
                                </p>
                                <div className="flex flex-wrap justify-center gap-2">
                                  {selectedFlow.variables.map((variable) => (
                                    <span
                                      key={variable}
                                      className={`px-2 py-1 text-xs rounded-full ${
                                        variables[variable]
                                          ? "bg-green-100 text-green-700"
                                          : "bg-yellow-100 text-yellow-700"
                                      }`}
                                    >
                                      {variable}
                                      {variables[variable] ? " ✓" : " ⚠️"}
                                    </span>
                                  ))}
                                </div>
                                <button
                                  onClick={() => setShowVariables(true)}
                                  className="mt-3 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                                >
                                  Set Variables
                                </button>
                              </div>
                            )}
                        </div>
                      ) : (
                        <>
                          {messages.map((msg, index) => (
                            <ChatBubble
                              key={index}
                              msg={msg}
                              userInfo={{ name: "You", avatar_url: "" }}
                              onDelete={() => handleDeleteMessage(index)}
                              onEdit={() => handleEditMessage(index)}
                              onRefresh={() => handleRefreshMessage(index)}
                              isLoading={isLoading}
                            />
                          ))}
                          {flowResponse && (
                            <ChatBubble
                              msg={{ role: "assistant" as const, content: flowResponse }}
                              userInfo={{ name: "Assistant", avatar_url: "" }}
                              onDelete={() => setFlowResponse(null)}
                              onEdit={() => {}}
                              onRefresh={() => {}}
                              isLoading={false}
                            />
                          )}
                        </>
                      )}

                      {isLoading && (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-8 h-8 border-2 border-indigo-600 rounded-full border-t-transparent animate-spin" />
                          <span className="ml-3 text-sm text-gray-600">
                            Running flow...
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Input Area */}
                <div className="flex-shrink-0 border-t border-gray-200 bg-white">
                  <div className="max-w-3xl mx-auto px-4 py-4">
                    {/* Error Message */}
                    {errorMessage && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center text-red-700 text-sm">
                          <ExclamationCircleIcon className="w-5 h-5 mr-2" />
                          {errorMessage}
                        </div>
                      </div>
                    )}

                    {/* Variables Quick Access */}
                    {selectedFlow?.variables && selectedFlow.variables.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <h3 className="text-sm font-medium text-gray-700">
                              Required Variables
                            </h3>
                            <div className="ml-2 flex gap-1">
                              {selectedFlow.variables.map((variable) => (
                                <span
                                  key={variable}
                                  className={`w-2 h-2 rounded-full ${
                                    variables[variable] ? "bg-green-500" : "bg-yellow-500"
                                  }`}
                                  title={`${variable} ${
                                    variables[variable] ? "is set" : "not set"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowVariables(!showVariables)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700"
                          >
                            {showVariables ? "Hide Variables" : "Show Variables"}
                          </button>
                        </div>
                        {showVariables && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-white rounded-lg border-2 border-blue-100 shadow-sm">
                            {selectedFlow.variables.map((variable) => (
                              <div key={variable} className="flex flex-col">
                                <label className="block mb-1 text-sm font-medium text-gray-700">
                                  {variable}
                                </label>
                                <input
                                  type="text"
                                  value={variables[variable] || ""}
                                  onChange={(e) => {
                                    handleVariableChange(variable, e.target.value);
                                    setErrorMessage("");
                                  }}
                                  className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    variables[variable]
                                      ? "border-green-300 bg-green-50"
                                      : "border-yellow-300 bg-yellow-50"
                                  }`}
                                  placeholder={`Enter ${variable}`}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
                      <div className="flex-1 relative">
                        <AutoGrowTextarea
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleRunFlow(variables, userInput);
                            } else if (e.key === "@") {
                              setShowVariablesList(true);
                            }
                          }}
                          placeholder="Type your message... (Use @ to insert variables, Shift+Enter for new line)"
                          className="flex-1 w-full p-3 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isLoading}
                        />
                        {showVariablesList &&
                          selectedFlow?.variables &&
                          selectedFlow.variables.length > 0 && (
                            <div
                              ref={variablesListRef}
                              className="absolute bottom-full mb-1 w-full max-h-48 overflow-y-auto bg-white rounded-lg border border-gray-200 shadow-lg"
                            >
                              {selectedFlow.variables.map((variable) => (
                                <button
                                  key={variable}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                                  onClick={() => {
                                    setUserInput((prev) => prev + `@{${variable}}`);
                                    setShowVariablesList(false);
                                  }}
                                >
                                  <span>{variable}</span>
                                  <span className="text-xs text-gray-500">
                                    {variables[variable] || "Not set"}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                      <div className="flex justify-end space-x-2 sm:justify-start">
                        <button
                          onClick={() => handleRunFlow(variables, userInput)}
                          disabled={isLoading}
                          className="flex-shrink-0 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {isLoading ? "Sending..." : "Send"}
                        </button>
                        {isLoading && (
                          <button
                            onClick={handleStop}
                            className="flex-shrink-0 p-2 text-white transition-colors duration-200 bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
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
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900">Select a Flow</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Choose a flow from the list to start chatting
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {showTryFlow && (
        <TryFlowModal
          onClose={() => {
            setShowTryFlow(false);
            setIsEditing(false);
          }}
          onSave={isEditing ? handleEditFlow : handleCreateFlow}
          initialFlow={
            isEditing && selectedFlow
              ? {
                  id: selectedFlow.id,
                  name: selectedFlow.name,
                  system_prompt: selectedFlow.system_prompt,
                  variables: selectedFlow.variables || [],
                }
              : undefined
          }
          isLoading={
            isEditing ? updateFlowMutation.isPending : createFlowMutation.isPending
          }
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            <h3 className="mb-4 text-lg font-medium text-gray-900">Delete Flow</h3>
            <p className="mb-6 text-sm text-gray-600">
              Are you sure you want to delete the flow "{flowToDelete?.name}"? This action
              cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                disabled={deleteFlowMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteFlowMutation.isPending}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteFlowMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Flow"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Code Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" />
            <div className="inline-block w-full max-w-3xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Get Code</h3>
                <button
                  onClick={() => setShowCodeModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Language Tabs */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-4" aria-label="Language">
                  {languageTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedLanguage(tab.id)}
                        className={`
                          whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm
                          ${selectedLanguage === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }
                          flex items-center space-x-2
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{tab.name}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Code Content */}
              <div className="mt-4">
                <div className="relative">
                  <pre className="p-4 bg-gray-50 rounded-lg overflow-x-auto text-sm font-mono">
                    <code>{getCodeExample(selectedFlow, selectedLanguage, variables)}</code>
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getCodeExample(selectedFlow, selectedLanguage, variables));
                      // You might want to add a toast notification here
                    }}
                    className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 bg-white rounded-md shadow-sm border border-gray-200"
                  >
                    <DocumentDuplicateIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tool Modal */}
      {showToolModal && (
        <ToolEditModal
          tool={editingTool}
          onSave={(tool) => {
            if (editingTool) {
              const toolIndex = tools.findIndex(
                (t) => t.function.name === editingTool.function.name
              );
              if (toolIndex !== -1) {
                const newTools = [...tools];
                newTools[toolIndex] = tool;
                setTools(newTools);
              } else {
                setTools([...tools, tool]);
              }
            } else {
              setTools([...tools, tool]);
            }
            setShowToolModal(false);
          }}
          onClose={() => setShowToolModal(false)}
        />
      )}

      {/* Keep existing modals */}
      {showMetrics && selectedFlow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-4xl p-6 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">Flow Metrics</h3>
              <button
                onClick={() => setShowMetrics(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <MetricsModal
              title={"metrics for flow " + selectedFlow.name}
              flowId={selectedFlow.id.toString()}
              onClose={() => setShowMetrics(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TerminalPage;
