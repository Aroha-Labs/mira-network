import { useEffect } from "react";
import ChartsLayout from "src/components/ChartLayout";
import useApiLogs from "src/hooks/useApiLogs";
import {
  apiLogsParamsState,
  DEFAULT_PARAMS,
} from "src/state/apiLogsParamsState";

const AnalyticsChart = () => {
  const { chartDataByDay } = useApiLogs();

  useEffect(() => {
    apiLogsParamsState.setState(() => DEFAULT_PARAMS);
  }, []);

  return <ChartsLayout data={chartDataByDay ?? []} title="" />;
};

export default AnalyticsChart;
