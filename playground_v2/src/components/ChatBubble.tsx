import {
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  FaceSmileIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { User } from "@supabase/supabase-js";
import { useState } from "react";
import ConfirmModal from "src/components/ConfirmModal";
import CopyToClipboardIcon from "src/components/CopyToClipboardIcon";
import ReactMarkdown from "src/components/ReactMarkdown";
import ProfileImage from "./ProfileImage";

interface ChatBubbleProps {
  msg: {
    role: string;
    content: string;
  };
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

  return (
    <div
      className={`flex flex-col space-y-2 max-w-2xl mx-auto ${
        msg.role === "user" ? "items-end" : "items-start"
      }`}
    >
      <div className="flex items-center gap-2 px-2">
        {msg.role === "user" ? (
          <ProfileImage
            src={userInfo.avatar_url}
            alt="User Avatar"
            className="h-6 w-6 inline-block"
          />
        ) : (
          <FaceSmileIcon className="h-6 w-6 inline-block" />
        )}
        <strong className="capitalize">
          {msg.role === "user"
            ? "You"
            : msg.role == "assistant"
            ? "Mira"
            : msg.role}
        </strong>
      </div>
      <div
        className={`px-3 py-2 shadow-md max-w-full min-w-48 w-auto ${
          msg.role === "user"
            ? "bg-sky-50 text-black self-end"
            : "bg-indigo-50 text-black self-start border border-gray-300"
        }`}
      >
        {showRaw ? (
          <pre className="whitespace-pre-wrap">{msg.content}</pre>
        ) : (
          <ReactMarkdown className="prose">{msg.content}</ReactMarkdown>
        )}

        <>
          <div className="border-t border-gray-300 my-2"></div>
          <div className="flex gap-2">
            <CopyToClipboardIcon text={msg.content} />
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="ml-2"
              disabled={isLoading}
            >
              {showRaw ? (
                <EyeSlashIcon className="h-5 w-5 text-gray-500" />
              ) : (
                <EyeIcon className="h-5 w-5 text-gray-500" />
              )}
            </button>
            {msg.role === "user" && (
              <>
                <button onClick={onEdit} className="ml-2" disabled={isLoading}>
                  <PencilIcon className="h-5 w-5 text-gray-500" />
                </button>
                <button
                  onClick={onRefresh}
                  className="ml-2"
                  disabled={isLoading}
                >
                  <ArrowPathIcon className="h-5 w-5 text-gray-500" />
                </button>
              </>
            )}
            <button
              onClick={handleDelete}
              className="ml-2"
              disabled={isLoading}
            >
              <TrashIcon className="h-5 w-5 text-gray-500" />
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
