import ReactMarkdown from "react-markdown";
import jetBrainsMono from "src/app/fonts/jetBrainsMono";
import { Message } from "src/hooks/useChat";
import { cn } from "src/lib/utils";

interface MessageContentProps {
  msg: Message;
  errorMessage: string;
}

const MessageContent = ({ msg, errorMessage }: MessageContentProps) => {
  const getMessageContent = (msg: Message, errorMessage: string): string => {
    if (msg.role === "assistant") {
      if (errorMessage) {
        if (errorMessage === "Please login to continue.") {
          return "Please login to continue.";
        }
        return "--------/-_-/------";
      }
    }
    return msg.content;
  };

  return (
    <ReactMarkdown
      className={cn(jetBrainsMono.className, "prose space-y-1", {
        "text-white": msg.role === "user",
      })}
    >
      {getMessageContent(msg, errorMessage)}
    </ReactMarkdown>
  );
};

export default MessageContent;
