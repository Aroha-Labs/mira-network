import { useQuery } from "@tanstack/react-query";
import { LLM_BASE_URL } from "src/config";

const fetchSupportedModels = async () => {
  const response = await fetch(`${LLM_BASE_URL}/models`);
  if (!response.ok) {
    throw new Error("Failed to fetch supported models");
  }
  const data = await response.json();
  return data.data.map((model: { id: string }) => model.id);
};

const useAllSupportedModels = () => {
  const {
    data: supportedModelsData,
    error: supportedModelsError,
    isLoading: isModelsLoading,
  } = useQuery<string[]>({
    queryKey: ["supportedModels"],
    queryFn: fetchSupportedModels,
  });

  return {
    supportedModelsData,
    supportedModelsError,
    isModelsLoading,
  };
};

export default useAllSupportedModels;
