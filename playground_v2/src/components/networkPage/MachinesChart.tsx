import Card from "src/components/card";
import MachinesHeader from "./MachinesHeader";
import UsageByMachine from "./UsageByMachine";

interface MachinesChartProps {
  activeMachine: string;
  changeActiveMachine: (machine: string) => void;
}

const MachinesChart = ({
  activeMachine,
  changeActiveMachine,
}: MachinesChartProps) => {
  return (
    <Card contentClassName="max-h-[600px]" className="max-w-[720px]">
      <div className="flex flex-col gap-2">
        <MachinesHeader
          activeMachine={activeMachine}
          changeActiveMachine={changeActiveMachine}
        />
        <UsageByMachine activeMachine={activeMachine} />
      </div>
    </Card>
  );
};

export default MachinesChart;
