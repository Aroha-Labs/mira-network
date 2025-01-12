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
      <div className="flex justify-between items-center p-4">
        <div className="flex flex-col">
          <p className="text-xl font-bold text-[#303030]">
            {isCreditsLoading ? "_ _ _" : userCredits?.credits?.toFixed(2)}
          </p>
          <p className="text-[13px] text-[#303030] opacity-40">
            Left in Credits
          </p>
        </div>

        <Button disabled variant="disabled">
          Buy more
        </Button>
      </div>
      <div className="p-4">
        <Progress value={percentageUsed} />
      </div>
    </Card>
  );
};

export default Credit;
