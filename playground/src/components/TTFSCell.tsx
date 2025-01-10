import { ApiLog } from "src/types/api-log";

const TTFSCell = ({ log }: { log: ApiLog }) => {
  const formatTime = (ttft: ApiLog["ttft"]) => {
    if (ttft < 1) {
      return `${(ttft * 1000).toFixed(0)}ms`;
    }
    return `${ttft.toFixed(2)}s`;
  };

  return (
    <div className="px-4 py-2">
      <span className="">{log.ttft ? formatTime(log.ttft) : "-"}</span>
    </div>
  );
};

export default TTFSCell;
