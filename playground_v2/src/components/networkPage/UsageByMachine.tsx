import { useStore } from "@tanstack/react-store";
import { eachDayOfInterval, format } from "date-fns";
import { useEffect } from "react";
import useApiLogs, { ApiLog } from "src/hooks/useApiLogs";
import { apiLogsParamsState } from "src/state/apiLogsParamsState";
import ChartsLayout from "../ChartLayout";

interface UsageByMachineProps {
  activeMachine: string;
}

interface InferenceCallsByDate {
  date: string;
  [key: string]: string | number;
}

const getInferenceCallsByDate = (
  startDate: string,
  endDate: string,
  data: ApiLog[]
): InferenceCallsByDate[] => {
  try {
    const interval = eachDayOfInterval({
      start: new Date(startDate),
      end: new Date(endDate),
    });

    return interval.map((date) => {
      const formattedDate = format(date, "yyyy-MM-dd");
      const inferenceCalls = data.filter(
        (log) =>
          format(new Date(log.created_at), "yyyy-MM-dd") === formattedDate
      ).length;

      return {
        date: formattedDate,
        inference_calls: inferenceCalls,
      };
    });
  } catch (error) {
    console.error("Error in getInferenceCallsByDate:", error);
    return [];
  }
};

const UsageByMachine = ({ activeMachine }: UsageByMachineProps) => {
  const { data } = useApiLogs();
  const params = useStore(apiLogsParamsState, (state) => state);

  useEffect(() => {
    apiLogsParamsState.setState((state) => ({
      ...state,
      machineId: activeMachine,
    }));
  }, [activeMachine]);

  const chartData = getInferenceCallsByDate(
    params.startDate,
    params.endDate,
    data?.logs ?? []
  );

  return <ChartsLayout data={chartData} title="" />;
};

export default UsageByMachine;
