import { ApiLog } from "src/hooks/useApiLogs";

interface DayData {
  date: string;
  [key: string]: string | number;
}

const getAllDaysBetween = (
  start: string,
  end: string,
  logs: ApiLog[]
): DayData[] => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dates: DayData[] = [];

  for (
    let date = new Date(startDate);
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    const formattedDate = date.toISOString().split("T")[0];
    // Filter logs for the current date and sum their total_tokens
    const totalTokensForDate = logs
      .filter(
        (log) =>
          new Date(log.created_at).toISOString().split("T")[0] === formattedDate
      )
      .reduce((acc, log) => acc + log.total_tokens, 0);

    dates.push({
      date: formattedDate,
      total_tokens: totalTokensForDate,
    });
  }

  return dates;
};

export default getAllDaysBetween;
