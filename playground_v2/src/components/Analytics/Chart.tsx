import useApiLogs from "src/hooks/useApiLogs";
import Card from "../card";
import ChartsLayout from "../ChartLayout";

const Chart = () => {
  const { chartDataByDay } = useApiLogs();

  return (
    <Card contentClassName="max-h-[600px]">
      <ChartsLayout data={chartDataByDay ?? []} title="" />
    </Card>
  );
};

export default Chart;
