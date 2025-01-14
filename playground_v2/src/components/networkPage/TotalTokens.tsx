import { useEffect } from "react";
import useAllApiLogs from "src/hooks/useAllApiLogs";
import {
  apiLogsParamsState,
  DEFAULT_PARAMS,
} from "src/state/apiLogsParamsState";

const TotalTokens = () => {
  const { totalTokens, error, isLoading } = useAllApiLogs();

  useEffect(() => {
    apiLogsParamsState.setState(() => DEFAULT_PARAMS);
  }, []);

  return (
    <div className="flex gap-4 md:gap-1 items-center">
      <p className="text-sm">
        {isLoading || error ? "_ _ " : totalTokens ?? 0}
      </p>
      <span className="text-[13px] opacity-40">Total Tokens</span>
    </div>
  );
};

export default TotalTokens;
