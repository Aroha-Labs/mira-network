import { format } from "date-fns";
import { useEffect } from "react";
import useApiLogs from "src/hooks/useApiLogs";
import {
  apiLogsParamsState,
  DEFAULT_PARAMS,
} from "src/state/apiLogsParamsState";
import ChartsLayout from "../ChartLayout";

interface UsageByMachineProps {
  activeMachine: string;
}

const UsageByMachine = ({ activeMachine }: UsageByMachineProps) => {
  const { data } = useApiLogs();

  useEffect(() => {
    apiLogsParamsState.setState(() => DEFAULT_PARAMS);
  }, []);

  const filteredData =
    data?.logs?.filter((log) => log.machine_id === activeMachine) || [];

  const chartData = filteredData.map((log) => ({
    date: format(new Date(log.created_at), "yyyy-MM-dd"),
    total_tokens: log.total_tokens,
  }));

  return <ChartsLayout data={chartData} title="" />;
};

export default UsageByMachine;
