import { Button } from "src/components/button";
import Card from "src/components/card";
import useUserCredits, {
  useUserCreditsHistory,
} from "src/hooks/useUserCredits";
import Progress from "../Progress";
import calculatePercentageUsed from "./calculateCreditsUsed";

const Credit = () => {
  const { userCredits, isCreditsLoading } = useUserCredits();
  const { userCreditsHistory } = useUserCreditsHistory();

  const percentageUsed = calculatePercentageUsed(userCreditsHistory ?? []);

  return (
    <Card>
      <div className="flex justify-between items-center pl-[20px] pr-[20px] pt-[14px] pb-[32px]">
        <div className="flex flex-col gap-[6px]">
          <p className="text-[#303030] text-[16px] font-[700] leading-[16px] capitalize">
            {isCreditsLoading
              ? "_ _ _"
              : `$${userCredits?.credits?.toFixed(2)}`}
          </p>
          <p className="text-[#303030] opacity-40 text-[13px] font-[500] leading-[13px] tracking-[-0.26px] capitalize">
            Left in Credits
          </p>
        </div>

        <Button disabled variant="disabled">
          Buy more
        </Button>
      </div>
      <div className="pt-[36px] pb-[32px] pl-[20px] pr-[20px]">
        <Progress value={percentageUsed} />
      </div>
    </Card>
  );
};

export default Credit;
