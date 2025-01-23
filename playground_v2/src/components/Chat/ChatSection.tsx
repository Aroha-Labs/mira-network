import Card from "src/components/card";
import { useChatMessages } from "src/hooks/useChat";
import TypeMessage from "./TypeMessage";

import { useEffect, useRef } from "react";
import ChatScreen from "./ChatBubble";

const ChatSection = ({ selectedModel }: { selectedModel: string }) => {
  const { messages, sendMessage } = useChatMessages({ selectedModel });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (message: string) => {
    sendMessage(message);
  };

  useEffect(() => {
    if (cardRef.current) {
      cardRef.current.scrollTop = cardRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <Card ref={cardRef} className="h-[388px] overflow-y-auto relative">
      <ChatScreen selectedModel={selectedModel} />
      <TypeMessage onSubmit={handleSubmit} />
    </Card>
  );
};

export default ChatSection;
