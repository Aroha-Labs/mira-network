"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import ChatBubble from "src/components/ChatBubble";
// import SystemPromptInput from "src/components/SystemPromptInput";
import {
  ChatBubbleBottomCenterIcon,
  StopIcon,
  PaperClipIcon,
  XCircleIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import Loading, { Spinner } from "src/components/PageLoading";
import AutoGrowTextarea from "src/components/AutoGrowTextarea";
import ConfirmModal from "src/components/ConfirmModal";
import { LLM_BASE_URL } from "src/config";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "src/hooks/useSession";
import { Message, MessageContentPart } from "src/utils/chat";

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

// Helper function to upload a single file
const uploadFile = async (file: File, token: string): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  const uploadUrl = `${LLM_BASE_URL}/upload/image`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = `Failed to upload ${file.name}. Status: ${response.status}`;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch (e) {
      // Ignore JSON parsing error if response is not JSON
    }
    throw new Error(errorDetail);
  }

  const result = await response.json();
  const { s3_url } = result;
  if (!s3_url) {
    throw new Error(`Failed to get S3 URL after uploading ${file.name}.`);
  }

  console.log(`Uploaded ${file.name}, S3 URL: ${s3_url}`);
  return s3_url;
};

export default function Chat() {
  const { data: userSession, isLoading } = useSession();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [systemPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [isUploading, setIsUploading] = useState(false);

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      if (selectedFiles.length + newFiles.length > 5) {
        setErrorMessage("You can upload a maximum of 5 images.");
        return;
      }
      const validFiles = newFiles.filter((file) => {
        if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
          setErrorMessage(`Unsupported file type: ${file.name}`);
          return false;
        }
        if (file.size > 5 * 1024 * 1024) {
          setErrorMessage(`File too large (max 5MB): ${file.name}`);
          return false;
        }
        return true;
      });

      setSelectedFiles((prevFiles) => [...prevFiles, ...validFiles]);

      validFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews((prevPreviews) => [...prevPreviews, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });

      event.target.value = "";
      setErrorMessage("");
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = (index: number) => {
    setSelectedFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
    setImagePreviews((prevPreviews) => prevPreviews.filter((_, i) => i !== index));
  };

  const sendMessage = async (userInput: string = "") => {
    const textInput = (userInput || input).trim();

    if (!textInput && selectedFiles.length === 0) return;

    if (!userSession?.access_token) {
      setErrorMessage("Please login to continue.");
      return;
    }

    setIsUploading(true);
    setIsSending(false);
    setErrorMessage("");
    setInput("");

    let userMessageContent: MessageContentPart[] = [];
    let userMessageForState: Message;
    let textForInputOnError = textInput;
    let uploadedImageUrls: string[] = [];

    try {
      if (selectedFiles.length > 0) {
        const uploadPromises = selectedFiles.map((file) =>
          uploadFile(file, userSession.access_token!)
        );
        uploadedImageUrls = await Promise.all(uploadPromises);
      }
      setIsUploading(false);

      if (textInput) {
        userMessageContent.push({ type: "text", text: textInput });
      }
      const imageContentParts: MessageContentPart[] = uploadedImageUrls.map((url) => ({
        type: "image_url",
        image_url: { url: url },
      }));
      userMessageContent.push(...imageContentParts);

      if (userMessageContent.length === 0) {
        console.warn("Message content is empty after processing inputs.");
        setInput(textForInputOnError);
        return;
      }

      userMessageForState = { role: "user", content: userMessageContent };

      setIsSending(true);
      const assistantMessage: Message = { role: "assistant", content: "" };
      const updatedMessages = [...messages, userMessageForState];
      setMessages([...updatedMessages, assistantMessage]);

      const filesToClear = [...selectedFiles];
      setSelectedFiles([]);

      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });
      }, 200);

      const sp: Message = { role: "system", content: systemPrompt.trim() };
      const messagesForApi = sp.content ? [sp, ...updatedMessages] : updatedMessages;

      abortControllerRef.current = new AbortController();
      await fetchChatCompletion(
        messagesForApi,
        (chunk) => {
          if (typeof assistantMessage.content === "string") {
            assistantMessage.content += chunk;
            setMessages((prevMessages) => [
              ...prevMessages.slice(0, -1),
              assistantMessage,
            ]);
          }
        },
        abortControllerRef.current,
        selectedModel,
        userSession.access_token
      );
      setErrorMessage("");
    } catch (error) {
      const err = error as Error;
      if (err.name !== "AbortError") {
        console.error("Failed to send message:", error);
        if (isSending) {
          setMessages((prevMessages) => prevMessages.slice(0, -2));
        }
        setInput(textForInputOnError);
        setErrorMessage(err.message || "Failed to send message. Please try again.");
      } else {
        setErrorMessage("");
      }
    } finally {
      setIsUploading(false);
      setIsSending(false);
      if (!errorMessage) {
        setImagePreviews([]);
      }
    }
  };

  const sendContinueMessage = async () => {
    await sendMessage("continue");
  };

  const handleDeleteMessage = (index: number) => {
    setMessages([...messages.slice(0, index), ...messages.slice(index + 1)]);
  };

  const handleEditMessage = (index: number) => {
    const messageToEdit = messages[index];
    let textToEdit = "";
    if (typeof messageToEdit.content === "string") {
      textToEdit = messageToEdit.content;
    } else if (Array.isArray(messageToEdit.content)) {
      const textPart = messageToEdit.content.find((part) => part.type === "text");
      if (textPart) {
        textToEdit = (textPart as { type: "text"; text: string }).text;
      }
      setSelectedFiles([]);
      setImagePreviews([]);
    }

    setInput(textToEdit);
    setMessages(messages.slice(0, index));
  };

  const handleRefreshMessage = async (index: number) => {
    if (!userSession?.access_token) {
      setErrorMessage("Please login to continue.");
      return;
    }

    if (isSending) return;

    const userMessageToResend = messages[index];
    if (userMessageToResend.role !== "user") {
      console.warn("Cannot refresh a non-user message.");
      return;
    }

    const messagesToKeep = messages.slice(0, index + 1);
    setMessages(messagesToKeep);
    setInput("");
    setSelectedFiles([]);
    setImagePreviews([]);

    setIsSending(true);
    setErrorMessage("");

    const assistantMessage: Message = { role: "assistant", content: "" };
    const updatedMessages = [...messagesToKeep, assistantMessage];

    setMessages(updatedMessages);

    setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    }, 200);

    const sp: Message = { role: "system", content: systemPrompt.trim() };
    const messagesForApi = sp.content ? [sp, ...messagesToKeep] : messagesToKeep;

    abortControllerRef.current = new AbortController();

    try {
      await fetchChatCompletion(
        messagesForApi,
        (chunk) => {
          if (typeof assistantMessage.content === "string") {
            assistantMessage.content += chunk;
            setMessages((prevMessages) => [
              ...prevMessages.slice(0, -1),
              assistantMessage,
            ]);
          }
        },
        abortControllerRef.current,
        selectedModel,
        userSession.access_token
      );
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Failed to refresh message:", error);
        setMessages((prevMessages) => prevMessages.slice(0, -1));
        setErrorMessage("Failed to refresh message. Please try again.");
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
          className="p-4 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
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
    <div className="flex flex-col items-center flex-1 bg-gray-100">
      <div className="flex self-start justify-center p-1 m-1 bg-white">
        <select
          value={selectedModel}
          onChange={handleModelChange}
          className="p-1 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 "
        >
          {supportedModelsOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {/* <SystemPromptInput onChange={handleSystemPromptChange} /> */}
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
              userInfo={userInfo}
              onDelete={() => handleDeleteMessage(index)}
              onEdit={() => handleEditMessage(index)}
              onRefresh={() => handleRefreshMessage(index)}
              isLoading={isSending}
            />
          ))
        )}

        {!isSending && messages.length ? (
          <div className="relative flex justify-start max-w-2xl px-4 mx-auto -top-4">
            <button
              className="text-sm text-gray-400 underline hover:text-gray-600 focus:outline-hidden"
              onClick={sendContinueMessage}
            >
              Continue
            </button>
          </div>
        ) : null}

        {messages.length > 0 && (
          <div className="flex flex-col items-center text-center text-gray-500">
            {isSending ? <Spinner /> : <div>End of messages</div>}
            {!isSending && (
              <button
                className="text-sm text-blue-400 underline hover:text-gray-600 focus:outline-hidden"
                onClick={handleClearHistory}
              >
                Clean History
              </button>
            )}
          </div>
        )}
      </div>
      <div className="sticky bottom-0 w-full p-4 bg-white border-t border-gray-300">
        {imagePreviews.length > 0 && (
          <div className="flex flex-wrap max-w-2xl gap-2 p-2 mx-auto mb-2 border border-gray-200 rounded-md">
            {imagePreviews.map((previewUrl, index) => (
              <div key={index} className="relative group">
                <img
                  src={previewUrl}
                  alt={`preview ${index}`}
                  className="object-cover w-16 h-16 rounded-md"
                />
                <button
                  onClick={() => handleRemoveImage(index)}
                  className="absolute top-0 right-0 p-0.5 text-gray-600 bg-white rounded-full opacity-0 group-hover:opacity-100 hover:text-red-500 focus:outline-none"
                  aria-label="Remove image"
                >
                  <XCircleIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-center max-w-2xl mx-auto space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png, image/jpeg, image/webp, image/gif"
            multiple
            style={{ display: "none" }}
          />
          <button
            className="p-2 text-gray-500 border border-gray-300 rounded-l-md hover:bg-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            onClick={handleAttachmentClick}
            disabled={isSending || isUploading}
            aria-label="Attach image"
          >
            <PhotoIcon className="w-5 h-5" />
          </button>
          <AutoGrowTextarea
            className="flex-1 p-2 border border-gray-300 resize-none focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message or attach images..."
            disabled={isSending || isUploading}
          />
          <button
            className="p-2 text-white bg-blue-500 rounded-r-md hover:bg-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            onClick={() => sendMessage(input)}
            disabled={
              isUploading || isSending || (!input.trim() && selectedFiles.length === 0)
            }
          >
            {isUploading ? "Uploading..." : isSending ? "Sending..." : "Send"}
          </button>
          {(isSending || isUploading) && (
            <button
              className="p-2 text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-hidden focus:ring-2 focus:ring-red-500"
              onClick={handleStop}
            >
              <StopIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        {errorMessage && (
          <div className="mt-2 text-sm text-center text-red-500">{errorMessage}</div>
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
