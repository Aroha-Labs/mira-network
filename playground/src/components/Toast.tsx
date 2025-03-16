import { CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type = "success",
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return createPortal(
    <div className="fixed z-50 top-4 right-4 animate-fade-in">
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
          type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
        }`}
      >
        {type === "success" && <CheckCircleIcon className="w-5 h-5" />}
        <p className="text-sm font-medium">{message}</p>
        <button
          onClick={onClose}
          className="p-1 transition-colors rounded-full hover:bg-green-100"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>,
    document.body
  );
}
