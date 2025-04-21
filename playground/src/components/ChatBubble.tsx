import {
  FaceSmileIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  PencilIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { Brain } from "lucide-react";
import CopyToClipboardIcon from "src/components/CopyToClipboardIcon";
import ConfirmModal from "src/components/ConfirmModal";
import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import ProfileImage from "./ProfileImage";
import ToolDisplay from "./ToolDisplay";
import { Message } from "src/utils/chat";
import ReactMarkdown from "./ReactMarkdown";

interface ChatBubbleProps {
  msg: Message;
  userInfo: User["user_metadata"];
  onDelete: () => void;
  onEdit: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function ChatBubble({
  msg,
  userInfo,
  onDelete,
  onEdit,
  onRefresh,
  isLoading,
}: ChatBubbleProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [hasReasoning, setHasReasoning] = useState(false);

  useEffect(() => {
    // Only set hasReasoning if there's actual reasoning content
    setHasReasoning(Boolean(msg.reasoning && msg.reasoning.trim()));
  }, [msg.reasoning]);

  const handleDelete = () => {
    setShowConfirmModal(true);
  };

  const confirmDelete = () => {
    onDelete();
    setShowConfirmModal(false);
  };

  const cancelDelete = () => {
    setShowConfirmModal(false);
  };

  // Get the reasoning display text
  const getReasoningText = () => {
    if (isLoading && !msg.reasoning) {
      return "Thinking...";
    }
    return msg.reasoning || "";
  };

  const getReasoningLevel = () => {
    const text = getReasoningText();
    if (!text || text === "Thinking...") return "none";

    // Simple heuristic based on length
    const length = text.length;
    if (length < 100) return "low";
    if (length < 300) return "medium";
    return "high";
  };

  return (
    <div
      className={`group flex flex-col space-y-2 max-w-2xl mx-auto ${
        msg.role === "user" ? "items-end" : "items-start"
      }`}
    >
      <div className="flex items-center gap-2 px-2">
        {msg.role === "user" ? (
          <ProfileImage
            src={userInfo.avatar_url}
            alt="User Avatar"
            className="inline-block w-6 h-6 rounded-full"
          />
        ) : (
          <FaceSmileIcon className="inline-block w-6 h-6" />
        )}
        <strong className="capitalize">
          {msg.role === "user" ? "You" : msg.role == "assistant" ? "Mira" : msg.role}
        </strong>
      </div>
      <div
        className={`px-3 py-2 rounded-lg shadow-md max-w-full min-w-48 w-auto ${
          msg.role === "assistant"
            ? "bg-gray-50"
            : msg.role === "system"
              ? "bg-blue-50"
              : msg.role === "user"
                ? "bg-sky-50 text-black self-end rounded-tr-lg"
                : "bg-indigo-50 text-black self-start rounded-tl-lg border border-gray-300"
        }`}
      >
        <div className="flex-1 space-y-2 overflow-x-auto">
          {showRaw ? (
            <pre className="whitespace-pre-wrap">{msg.content}</pre>
          ) : (
            <div className="prose">
              <ReactMarkdown>
                {msg.content || (isLoading ? "Thinking..." : "")}
              </ReactMarkdown>
            </div>
          )}
          {hasReasoning && showReasoning && (
            <div className="pt-2 mt-2 border-t border-gray-200">
              <div className="mb-1 text-sm font-medium text-gray-500">Reasoning:</div>
              <div className="p-2 text-sm text-gray-700 rounded bg-yellow-50">
                <ReactMarkdown>{getReasoningText()}</ReactMarkdown>
              </div>
            </div>
          )}
          {(msg.tool_calls || msg.tool_responses) && (
            <ToolDisplay toolCalls={msg.tool_calls} toolResponses={msg.tool_responses} />
          )}
        </div>
        <>
          <div className="my-2 border-t border-gray-300"></div>
          <div className="flex gap-2">
            <CopyToClipboardIcon text={msg.content} />
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="ml-2"
              disabled={isLoading}
              title={showRaw ? "Show formatted" : "Show raw"}
            >
              {showRaw ? (
                <EyeSlashIcon className="w-5 h-5 text-gray-500" />
              ) : (
                <EyeIcon className="w-5 h-5 text-gray-500" />
              )}
            </button>
            {hasReasoning && (
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className={`ml-2 ${
                  showReasoning ? "text-blue-500" : "text-gray-500"
                } hover:text-blue-600`}
                title={`${showReasoning ? "Hide" : "Show"} reasoning`}
              >
                <Brain className="w-5 h-5" />
              </button>
            )}
            {msg.role === "user" && (
              <>
                <button onClick={onEdit} className="ml-2" disabled={isLoading}>
                  <PencilIcon className="w-5 h-5 text-gray-500" />
                </button>
                <button onClick={onRefresh} className="ml-2" disabled={isLoading}>
                  <ArrowPathIcon className="w-5 h-5 text-gray-500" />
                </button>
              </>
            )}
            <button onClick={handleDelete} className="ml-2" disabled={isLoading}>
              <TrashIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </>
      </div>
      {showConfirmModal && (
        <ConfirmModal
          title="Confirm Delete"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        >
          Are you sure you want to delete this message?
        </ConfirmModal>
      )}
    </div>
  );
}
