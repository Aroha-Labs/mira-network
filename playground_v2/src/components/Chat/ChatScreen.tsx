import { useEffect, useRef } from "react";
import { Message } from "src/hooks/useChat";
import { cn } from "src/lib/utils";
import ChatBubble from "./ChatBubble";

interface ChatScreenProps {
  messages: Message[];
  isSending: boolean;
  errorMessage: string;
}

const getMessageStatus = (
  msg: Message,
  isSending: boolean,
  errorMessage: string
): string => {
  switch (msg.role) {
    case "user":
      return "You";
    case "assistant":
      if (errorMessage) {
        return "something went wrong..";
      }
      if (isSending) {
        return "processing..";
      }
      return "Mira";
    default:
      return "";
  }
};

const ChatScreen = ({ messages, isSending, errorMessage }: ChatScreenProps) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4">
      {messages.map((msg, index) => (
        <div
          key={`${msg.role}-${index}`}
          className={cn("flex mb-4", {
            "justify-end": msg.role === "user",
            "justify-start": msg.role !== "user",
          })}
        >
          <div
            className={cn("p-2", {
              "max-w-[373px] text-right": msg.role === "user",
              "max-w-[480px] text-left": msg.role !== "user",
            })}
          >
            <div className="text-black mb-[6px] opacity-30 text-[12px] font-normal leading-[18px] tracking-[-0.013em]">
              {getMessageStatus(msg, isSending, errorMessage)}
            </div>
            <pre
              className={cn("text-sm p-[10px] text-left overflow-auto", {
                "text-white border border-[#306E564F] bg-[#121212]":
                  msg.role === "user",
                "text-black border border-[#306E564F] bg-[#FFFFFF]":
                  msg.role !== "user",
              })}
            >
              <ChatBubble msg={msg} errorMessage={errorMessage} />
            </pre>
          </div>
        </div>
      ))}
      <div ref={chatEndRef} />
    </div>
  );
};

export default ChatScreen;
