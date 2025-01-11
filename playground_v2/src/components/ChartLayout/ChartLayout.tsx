"use client";

import { Bar, BarChart, Cell, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "src/components/Chart";
import { v4 as uuidv4 } from "uuid";
import EmptyChart from "./EmptyChart";

const ChartsLayout = ({
  data,
  title,
}: {
  data: { date: string; [key: string]: string | number }[];
  title: string;
}) => {
  if (data.length === 0) {
    return <EmptyChart />;
  }

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
          <XAxis dataKey="date" hide />
          {dataKey && (
            <Bar
              dataKey={dataKey}
              fill={`var(--color-${dataKey})`}
              minPointSize={10}
            >
              {data.map((entry) => (
                <Cell
                  key={uuidv4()}
                  fill={
                    Number(entry[dataKey]) > 0
                      ? `var(--color-${dataKey})`
                      : "#308f6a66"
                  }
                />
              ))}
            </Bar>
          )}
        </BarChart>
      </ChartContainer>
    </div>
  );
};

export default ChartsLayout;
