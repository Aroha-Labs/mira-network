import Card from "src/components/card";
import { useChatMessages } from "src/hooks/useChat";
import TypeMessage from "./TypeMessage";

import { useEffect, useState } from "react";
import ChatScreen from "./ChatScreen";
import ErrorModal from "./ErrorModal";

const ChatSection = ({ selectedModel }: { selectedModel: string }) => {
  const { messages, isSending, errorMessage, sendMessage, refreshMessage } =
    useChatMessages({
      selectedModel,
    });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSubmit = (message: string) => {
    sendMessage(message);
  };

  useEffect(() => {
    if (errorMessage === "Insufficient credits") {
      setIsModalOpen(true);
    }
  }, [errorMessage]);

  return (
    <div className="h-[388px] overflow-hidden relative">
      <Card className="h-[388px] overflow-hidden relative pb-[10px]">
        <ChatScreen
          messages={messages}
          isSending={isSending}
          errorMessage={errorMessage}
          refreshMessage={refreshMessage}
        />
      </Card>
      <TypeMessage onSubmit={handleSubmit} />
      {isModalOpen && <ErrorModal setIsModalOpen={setIsModalOpen} />}
    </div>
  );
};

export default ChatSection;
