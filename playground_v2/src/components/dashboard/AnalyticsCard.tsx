import { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { Button } from "src/components/button";
import Card from "src/components/card";
import { API_BASE_URL } from "src/config";
import { cn } from "src/lib/utils";
import AnalyticsChart from "./AnalyticsChart";

const fetchInferenceCalls = async (token: string) => {
  const response = await axios.get(`${API_BASE_URL}/total-inference-calls`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

const AnalyticsCard = ({
  userSession,
  className,
}: {
  userSession?: Session | null;
  className?: string;
}) => {
  const {
    data: inferenceCalls,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["inferenceCalls"],
    queryFn: () => {
      if (!userSession?.access_token) {
        throw new Error("User session not found");
      }
      return fetchInferenceCalls(userSession.access_token);
    },
    enabled: !!userSession?.access_token,
  });

  return (
    <Card className={cn(className, "relative")}>
      <div className="flex justify-between items-center p-4">
        <div className="flex flex-col">
          <p className="text-xl font-bold text-[#303030]">
            {isLoading || error ? "_ _ _" : inferenceCalls}
          </p>
          <p className="text-[13px] text-[#303030] opacity-40">
            Inference calls
          </p>
        </div>

        <Link href="/analytics">
          <Button>View analytics</Button>
        </Link>
      </div>
      <div className="border-t border-solid border-[#0E291E21] h-[1px] absolute w-full left-[1px]"></div>

      <AnalyticsChart />
    </Card>
  );
};

export default AnalyticsCard;
