import useApiLogs from "src/hooks/useApiLogs";

const TotalTokens = () => {
  const { totalTokens, error, isLoading } = useApiLogs();

  return (
    <div className="flex gap-1 items-center">
      <p className="text-sm">
        {isLoading || error ? "_ _ " : totalTokens ?? 0}
      </p>
      <span className="text-[13px] opacity-40">Total Tokens</span>
    </div>
  );
};

export default TotalTokens;
