"use client";

import { Bar, BarChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "src/components/Chart";

const ChartsLayout = ({
  data,
  title,
}: {
  data: { date: string; [key: string]: string | number }[];
  title: string;
}) => {
  // Extract the key for the bar from the first data entry
  const dataKey =
    Object.keys(data[0] || {})?.find((key) => key !== "date") ?? "";

  // Dynamically create chart configuration based on the data key
  const dynamicChartConfig = {
    [dataKey]: {
      label: `${dataKey
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())} `,
      color: "#308F6A",
    },
  };

  return (
    <div className="flex flex-col gap-10 p-4 w-full">
      {title && title !== "" && (
        <p className="text-xl text-slate-900">{title}</p>
      )}
      <ChartContainer
        config={dynamicChartConfig}
        className="min-h-[200px] w-full"
      >
        <BarChart accessibilityLayer data={data}>
          <ChartTooltip content={<ChartTooltipContent />} />
          {dataKey && (
            <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} />
          )}
        </BarChart>
      </ChartContainer>
    </div>
  );
};

export default ChartsLayout;
