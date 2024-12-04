import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import { useModels } from "./hooks/useModels";
import { DEFAULT_MODEL, LLM_BASE_URL } from "./config/llm";

// Header Component
const Header = () => (
  <header className="bg-blue-600 text-white p-4">
    <h1 className="text-2xl font-bold">Playground</h1>
    {/* <nav>
      <ul className="flex space-x-4">
        <li>
          <a href="#home" className="hover:underline">
            Home
          </a>
        </li>
        <li>
          <a href="#about" className="hover:underline">
            About
          </a>
        </li>
        <li>
          <a href="#contact" className="hover:underline">
            Contact
          </a>
        </li>
      </ul>
    </nav> */}
  </header>
);

// Footer Component
const Footer = () => (
  <footer className="bg-gray-800 text-white p-4 mt-32">
    <p className="text-center">
      &copy; 2023 My Application. All rights reserved.
    </p>
  </footer>
);

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

export default function Playground() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: "",
    },
  ]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [response, setResponse] = useState("");
  const [validationError, setValidationError] = useState<string>("");

  // Add new state for reply
  const [replyContent, setReplyContent] = useState("");

  // Add new state for reply role
  const [replyRole, setReplyRole] = useState<Message["role"]>("user");

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
      const { data } = await axios.post(`${LLM_BASE_URL}/chat/completions`, {
        model,
        messages,
      });
      return data;
    },
    onSuccess: (data) => {
      setResponse(data.choices[0].message.content);
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

  return (
    // Main container styling
    <div className="flex flex-col min-h-screen">
      <Header />
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
              models?.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Messages section */}
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 p-4 rounded-lg border transition-all ${
                roleColors[message.role]
              }`}
            >
              <select
                value={message.role}
                onChange={(e) => updateMessage(index, "role", e.target.value)}
                className="bg-white border-0 rounded-md shadow-sm py-1 px-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="system">System</option>
                <option value="user">User</option>
                <option value="assistant">Assistant</option>
              </select>
              <textarea
                value={message.content}
                onChange={(e) => {
                  updateMessage(index, "content", e.target.value);
                  autoResizeTextArea(e.target);
                }}
                onFocus={(e) => autoResizeTextArea(e.target)}
                className="flex-1 bg-white/50 border-0 rounded-md p-2 resize-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Enter ${message.role} message...`}
                rows={1}
              />
              <button
                onClick={() => removeMessage(index)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-white/50 transition-colors"
                title="Remove message"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
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
                <h3 className="text-xl font-semibold text-gray-900">
                  Assistant
                </h3>
              </div>
              <div className="flex gap-3">
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
              </div>
            </div>
            <ReactMarkdown className="prose max-w-none">
              {response}
            </ReactMarkdown>
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
      <Footer />
    </div>
  );
}
