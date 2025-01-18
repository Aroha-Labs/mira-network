import { useEffect } from "react";
import useMachine from "src/hooks/useMachine";
import { Button } from "../button";

interface MachinesListProps {
  activeMachine: string;
  changeActiveMachine: (machine: string) => void;
}

const MachinesList = ({
  activeMachine,
  changeActiveMachine,
}: MachinesListProps) => {
  const { machines, isLoading, error } = useMachine();

  useEffect(() => {
    if (machines && machines.length > 0) {
      changeActiveMachine(machines?.[0]?.machine_uid ?? "");
    }
  }, [machines]);

  if (isLoading || error) {
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-[6px]">
      {machines?.map((machine) => (
        <div key={machine.machine_uid} className="flex items-center gap-1">
          <Button
            variant={
              activeMachine === machine.machine_uid ? "default" : "secondary"
            }
            onClick={() => changeActiveMachine(machine.machine_uid)}
          >
            <span
              className={`w-2 h-2 ${
                machine.status === "online" ? "bg-green-500" : "bg-gray-500"
              }`}
            ></span>
            {machine.machine_uid}
          </Button>
        </div>
      ))}
    </div>
  );
};

export default MachinesList;
