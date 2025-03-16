import { ArrowsClockwise } from "@phosphor-icons/react";
import c from "clsx";
import { Button } from "src/components/button";

interface RefreshChatProps {
  onClick: () => void;
  className?: string;
}

export default function RefreshChat({
  onClick,
  className,
}: Readonly<RefreshChatProps>) {
  return (
    <Button
      onClick={onClick}
      className={c("p-0 h-fit", className)}
      variant="ghost"
      tooltip="Refresh chat"
    >
      <ArrowsClockwise className="h-4 w-4 opacity-30 hover:opacity-100" />
      <span className="sr-only">Refresh chat</span>
    </Button>
  );
}
