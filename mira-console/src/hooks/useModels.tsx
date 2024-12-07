import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useStateSelectedProvider } from "../recoil/atoms";
import { LLM_BASE_URL } from "../config/llm";

interface Model {
  id: string;
  created: number;
  owned_by: string;
}

interface ModelsResponse {
  data: Model[];
}

export function useModels() {
  const [selectedProvider] = useStateSelectedProvider();
  const baseUrl = selectedProvider.baseUrl || LLM_BASE_URL;

  return useQuery({
    queryKey: ["models", selectedProvider.baseUrl],
    queryFn: async () => {
      const { data } = await axios.get<ModelsResponse>(`${baseUrl}/models`);
      return data.data;
    },
  });
}
