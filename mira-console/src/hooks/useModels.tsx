import { useQuery } from "@tanstack/react-query";
import axios from "axios";
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
  return useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const { data } = await axios.get<ModelsResponse>(
        `${LLM_BASE_URL}/models`
      );
      return data.data;
    },
  });
}
