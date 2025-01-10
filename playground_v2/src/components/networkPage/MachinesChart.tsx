import Card from "src/components/card";
import MachinesHeader from "./MachinesHeader";

interface MachinesChartProps {
  activeMachine: string;
  changeActiveMachine: (machine: string) => void;
}

const MachinesChart = ({
  activeMachine,
  changeActiveMachine,
}: MachinesChartProps) => {
  return (
    <Card>
      <div className="flex flex-col gap-2">
        <MachinesHeader
          activeMachine={activeMachine}
          changeActiveMachine={changeActiveMachine}
        />
      </div>
    </Card>
  );
};

export default MachinesChart;
