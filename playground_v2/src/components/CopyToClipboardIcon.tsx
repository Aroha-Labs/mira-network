import { CheckCircleIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import c from "clsx";
import { useState } from "react";

import styles from "./CopyToClipboardIcon.module.scss";

interface CopyToClipboardIconProps {
  text: string;
}

export default function CopyToClipboardIcon({
  text,
}: CopyToClipboardIconProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative flex items-center">
      <div className={styles.tooltip} onClick={copyToClipboard}>
        {copied ? (
          <CheckCircleIcon className="h-6 w-5 text-green-500 cursor-pointer hover:text-green-700 transition-colors duration-200 ease-in-out" />
        ) : (
          <ClipboardIcon className="h-6 w-5 cursor-pointer hover:text-gray-700 transition-colors duration-200 ease-in-out" />
        )}
        <span
          className={c(
            styles.tooltiptext,
            "absolute bg-gray-700 text-white text-xs py-1 px-2 bottom-full -left-1/2 transform transition-opacity duration-200 ease-in-out opacity-0 group-hover:opacity-100"
          )}
        >
          {copied ? "Copied!" : "Copy to clipboard"}
        </span>
      </div>
    </div>
  );
}
