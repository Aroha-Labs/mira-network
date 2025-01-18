import Link from "next/link";
import { Button } from "src/components/button";
import Card from "src/components/card";
import useTotalInferenceCalls from "src/hooks/useTotalInferenceCalls";
import { cn } from "src/lib/utils";
import AnalyticsChart from "./AnalyticsChart";

const AnalyticsCard = ({ className }: { className?: string }) => {
  const { data: inferenceCalls, error, isLoading } = useTotalInferenceCalls();

  return (
    <Card className={cn(className, "relative h-[388px] self-stretch")}>
      <div className="flex justify-between items-center pl-[20px] pr-[20px] pt-[14px] pb-[32px]">
        <div className="flex flex-col gap-[6px]">
          <p className="text-[18px] font-[700] leading-[18px] text-[#303030] capitalize">
            {isLoading || error ? "_ _ _" : inferenceCalls}
          </p>
          <p className="text-[#303030] text-[13px] font-[500] leading-[13px] tracking-[-0.26px] capitalize opacity-40">
            Inference calls
          </p>
        </div>

        <Link href="/analytics">
          <Button className="text-[#FFF] text-[13px] font-[500] leading-[15.6px] tracking-[-0.26px] capitalize">
            View analytics
          </Button>
        </Link>
      </div>
      <div className="border-t border-solid border-[rgba(14, 41, 30, 0.13)] h-[1px] absolute w-full left-[1px]"></div>

      <AnalyticsChart />
    </Card>
  );
};

export default AnalyticsCard;
