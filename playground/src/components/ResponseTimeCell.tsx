import { ApiLog } from "src/types/api-log";

const ResponseTimeCell = ({ log }: { log: ApiLog }) => {
  const formatTime = (time: number) => {
    if (time < 1) {
      return `${(time * 1000).toFixed(0)}ms`;
    }
    return `${time.toFixed(2)}s`;
  };

  return (
    <div className="px-4 py-2">
      <span className="">{formatTime(log.total_response_time)}</span>
    </div>
  );
};

export default ResponseTimeCell;
