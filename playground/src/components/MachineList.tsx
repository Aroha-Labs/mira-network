import MachineItem from "./MachineItem";
import { Machine } from "src/types/machine";

interface MachineListProps {
  machines: Machine[];
}

const MachineList = ({ machines }: MachineListProps) => {
  return (
    <div className="w-full max-w-lg m-4 p-4 bg-white shadow rounded">
      <h2 className="text-xl font-semibold mb-4">Network Machines</h2>
      {machines?.map((m) => (
        <MachineItem key={m.machine_uid} {...m} />
      ))}
    </div>
  );
};

export default MachineList;
