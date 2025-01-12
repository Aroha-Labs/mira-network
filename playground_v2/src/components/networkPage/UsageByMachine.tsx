import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";
import useApiLogs from "src/hooks/useApiLogs";
import {
  apiLogsParamsState,
  DEFAULT_PARAMS,
} from "src/state/apiLogsParamsState";
import getAllDaysBetween from "src/utils/getAllDaysBetween";
import ChartsLayout from "../ChartLayout";

interface UsageByMachineProps {
  activeMachine: string;
}

const UsageByMachine = ({ activeMachine }: UsageByMachineProps) => {
  const { data } = useApiLogs();
  const params = useStore(apiLogsParamsState, (state) => state);

  useEffect(() => {
    apiLogsParamsState.setState(() => DEFAULT_PARAMS);
  }, []);

  const filteredData =
    data?.logs?.filter((log) => log.machine_id === activeMachine) || [];

  const chartData = getAllDaysBetween(
    params.startDate,
    params.endDate,
    filteredData
  );

  return <ChartsLayout data={chartData} title="" />;
};

export default UsageByMachine;
