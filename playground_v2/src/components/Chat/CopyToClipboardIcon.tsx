import { CheckIcon } from "@heroicons/react/24/outline";
import { CopySimple } from "@phosphor-icons/react";
import c from "clsx";
import { useState } from "react";
import { Button } from "src/components/button";

interface CopyToClipboardIconProps {
  text: string | null;
  className?: string;
}

export default function CopyToClipboardIcon({
  text,
  className,
}: Readonly<CopyToClipboardIconProps>) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      onClick={copyToClipboard}
      className={c("p-0 h-fit", className)}
      variant="ghost"
      tooltip={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-green-500 opacity-30 hover:opacity-100" />
      ) : (
        <CopySimple className="h-4 w-4 opacity-30 hover:opacity-100" />
      )}
      <span className="sr-only">
        {copied ? "Copied!" : "Copy to clipboard"}
      </span>
    </Button>
  );
}
