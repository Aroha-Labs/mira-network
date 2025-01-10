import { useSession } from "src/hooks/useSession";
import MachinesList from "./MachinesList";

interface MachinesHeaderProps {
  activeMachine: string;
  changeActiveMachine: (machine: string) => void;
}

const MachinesHeader = ({
  activeMachine,
  changeActiveMachine,
}: MachinesHeaderProps) => {
  const { data: userSession, error, isLoading } = useSession();

  const firstName = userSession?.user?.user_metadata?.full_name?.split(" ")[0];

  if (isLoading || error) {
    return null;
  }

  return (
    <div className="flex justify-between items-center p-4">
      {firstName && <p className="text-md">{firstName}&apos;s Network</p>}
      <MachinesList
        activeMachine={activeMachine}
        changeActiveMachine={changeActiveMachine}
      />
    </div>
  );
};

export default MachinesHeader;
