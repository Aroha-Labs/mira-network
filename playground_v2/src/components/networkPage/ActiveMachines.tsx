import useMachine from "src/hooks/useMachine";

const ActiveMachines = () => {
  const { onlineMachinesCount, isLoading, error } = useMachine();

  return (
    <div className="flex gap-4 md:gap-1 items-center">
      <p className="text-sm">
        {isLoading || error ? "_ _ " : onlineMachinesCount ?? 0}
      </p>
      <span className="text-[13px] opacity-40">Active Nodes</span>
    </div>
  );
};

export default ActiveMachines;
