import Link from "next/link";
import Card from "src/components/card";
import { Button } from "../button";

const ApiLogs = () => {
  return (
    <Card>
      <div className="flex justify-between items-center p-4">
        <Link href="/api-logs">
          <Button className="bg-[#E9E9E9] text-[#303030] hover:bg-[#D7D7D7] hover:text-[#202020]">
            &gt;&gt; API Logs
          </Button>
        </Link>

        <p className="text-[#303030] text-sm font-bold opacity-50">
          -- / -- / --
        </p>
      </div>
    </Card>
  );
};

export default ApiLogs;
