import { useEffect, useRef } from "react";
import { useChatMessages } from "src/hooks/useChat";

interface ChatScreenProps {
  selectedModel: string;
}

const ChatScreen = ({ selectedModel }: ChatScreenProps) => {
  const { messages, isSending, errorMessage } = useChatMessages({
    selectedModel,
  });
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
          key={index}
          className={`flex ${
            msg.role === "user" ? "justify-end" : "justify-start"
          } mb-4`}
        >
          <div
            className={`${
              msg.role === "user"
                ? "border border-[#306E564F] bg-[#121212] max-w-[373px] text-right"
                : "border border-[#306E564F] bg-[#FFFFFF] max-w-[480px] text-left"
            } p-2 rounded-lg shadow-md`}
          >
            <div
              className={`${
                msg.role === "user" ? "text-white" : "text-black"
              } text-sm font-normal leading-[18px] tracking-[-0.013em] mb-1`}
            >
              {msg.role === "user" ? "You" : "System"}
            </div>
            <div className="text-sm">
              {msg.role === "system" && isSending
                ? "Processing..."
                : msg.role === "system" && errorMessage
                ? "Something went wrong..."
                : msg.content}
            </div>
          </div>
        </div>
      ))}
      <div ref={chatEndRef} />
    </div>
  );
};

export default ChatScreen;
