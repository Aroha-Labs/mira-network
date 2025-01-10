import ChartsLayout from "src/components/ChartLayout";
import useApiLogs from "src/hooks/useApiLogs";

const AnalyticsChart = () => {
  const { chartDataByDay } = useApiLogs();

  return <ChartsLayout data={chartDataByDay ?? []} title="" />;
};

export default AnalyticsChart;
