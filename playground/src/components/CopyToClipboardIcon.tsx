import { useState } from "react";
import { ClipboardIcon, CheckIcon } from "@heroicons/react/24/outline";
import c from "clsx";

interface CopyToClipboardIconProps {
  text: string;
  className?: string;
  tooltipText?: string;
}

export default function CopyToClipboardIcon({
  text,
  className,
  tooltipText = "Copy to clipboard",
}: CopyToClipboardIconProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copyToClipboard}
      className={c(
        "group/copy relative inline-flex items-center justify-center p-1 rounded-md",
        "hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
        className
      )}
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-green-500" />
      ) : (
        <ClipboardIcon className="h-4 w-4" />
      )}
      <span className="sr-only">{copied ? "Copied!" : "Copy to clipboard"}</span>

      <span
        className={c(
          "absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 z-50",
          "text-xs text-white bg-gray-900 rounded shadow-sm",
          "opacity-0 group-hover/copy:opacity-100 transition-opacity duration-200",
          "pointer-events-none whitespace-nowrap"
        )}
      >
        {copied ? "Copied!" : tooltipText}
      </span>
    </button>
  );
}
