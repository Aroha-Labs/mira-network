import useTotalInferenceCalls from "src/hooks/useTotalInferenceCalls";

const TotalInferenceCalls = () => {
  const { data: inferenceCalls, error, isLoading } = useTotalInferenceCalls();

  return (
    <div className="flex gap-1 items-center">
      <p className="text-sm">{isLoading || error ? "_ _ " : inferenceCalls}</p>
      <span className="text-[13px] opacity-40">Global Inference Calls</span>
    </div>
  );
};

export default TotalInferenceCalls;
