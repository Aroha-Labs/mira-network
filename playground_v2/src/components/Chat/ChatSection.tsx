import Card from "src/components/card";
import { useChatMessages } from "src/hooks/useChat";
import TypeMessage from "./TypeMessage";

import ChatScreen from "./ChatScreen";

const ChatSection = ({ selectedModel }: { selectedModel: string }) => {
  const { messages, isSending, errorMessage, sendMessage, refreshMessage } =
    useChatMessages({
      selectedModel,
    });

  const handleSubmit = (message: string) => {
    sendMessage(message);
  };

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
    </div>
  );
};

export default ChatSection;
