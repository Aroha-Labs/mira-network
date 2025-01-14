import useAllApiLogs from "src/hooks/useAllApiLogs";

const TotalInferenceCalls = () => {
  const { data, error, isLoading } = useAllApiLogs();

  return (
    <div className="flex gap-4 md:gap-1 items-center">
      <p className="text-sm">
        {isLoading || error ? "_ _ " : data?.total ?? 0}
      </p>
      <span className="text-[13px] opacity-40">Global Inference Calls</span>
    </div>
  );
};

export default TotalInferenceCalls;
