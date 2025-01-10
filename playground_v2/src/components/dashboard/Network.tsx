import Link from "next/link";
import Card from "src/components/card";
import useMachine from "src/hooks/useMachine";
import { Button } from "../button";

const Network = () => {
  const { onlineMachinesCount } = useMachine();
  return (
    <Card>
      <div className="flex justify-between items-center p-4">
        <Link href="/network">
          <Button className="bg-[#E9E9E9] text-[#303030] hover:bg-[#D7D7D7] hover:text-[#202020]">
            &gt;&gt; Network
          </Button>
        </Link>

        <p className="text-[#303030] text-sm font-bold opacity-50">
          {onlineMachinesCount} NODES LIVE
        </p>
      </div>
    </Card>
  );
};

export default Network;
