import MachineItem from "./MachineItem";
import { Machine } from "src/types/machine";

interface MachineListProps {
  machines: Machine[];
}

const MachineList = ({ machines }: MachineListProps) => {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">
          Connected Machines ({machines?.length || 0})
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {machines?.map((m) => (
          <MachineItem key={m.machine_uid} {...m} />
        ))}
      </div>
    </div>
  );
};

export default MachineList;
