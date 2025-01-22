import Card from "src/components/card";
import TypeMessage from "./TypeMessage";
const ChatSection = () => {
  return (
    <Card className="h-[388px] overflow-y-auto relative">
      <TypeMessage />
    </Card>
  );
};

export default ChatSection;
