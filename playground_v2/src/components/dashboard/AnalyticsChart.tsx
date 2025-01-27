import { addDays, format } from "date-fns";
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
    const today = new Date();
    const startDate = addDays(today, -5);
    const endDate = addDays(today, 1);
    const params = {
      ...DEFAULT_PARAMS,
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    };
    apiLogsParamsState.setState(() => params);
  }, []);

  return (
    <div className="pt-[38px]">
      <ChartsLayout data={chartDataByDay ?? []} title="" />
    </div>
  );
};

export default AnalyticsChart;
