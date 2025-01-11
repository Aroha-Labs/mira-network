import useApiLogs from "src/hooks/useApiLogs";
import ChartsLayout from "../ChartLayout";

interface UsageByMachineProps {
  activeMachine: string;
}

const UsageByMachine = ({ activeMachine }: UsageByMachineProps) => {
  const { data } = useApiLogs();

  const filteredData =
    data?.logs?.filter((log) => log.machine_id === activeMachine) || [];

  const chartData = filteredData.map((log) => ({
    date: log.created_at,
    total_tokens: log.total_tokens,
  }));

  return <ChartsLayout data={chartData} title="" />;
};

export default UsageByMachine;
