import Link from "next/link";
import Card from "src/components/card";
import { Button } from "../button";

const TestApiKeyWithChat = () => {
  return (
    <Card>
      <div className="flex justify-between items-center p-4">
        <Link href="/chat">
          <Button className="bg-[#308F6A] text-white hover:bg-[#207A58] text-[13px] font-[500] leading-[13px]">
            &gt;&gt; Test API Key with Chat
          </Button>
        </Link>
        <p className="text-[#303030] text-sm font-bold opacity-50">“...”</p>
      </div>
    </Card>
  );
};

export default TestApiKeyWithChat;
