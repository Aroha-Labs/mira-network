import {
  DefaultError,
  Optional,
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { ROUTER_BASE_URL } from "../config/llm";
import { Flow } from "../types";

export function useGetFlows() {
  const fetchFlows = async (): Promise<Flow[]> => {
    const res = await axios.get(`${ROUTER_BASE_URL}/flows`);
    return res.data;
  };

  return useQuery({
    queryKey: ["flows"],
    queryFn: fetchFlows,
    refetchInterval: false,
  });
}

export function useGetFlow(flowId: string) {
  const fetchFlow = async (): Promise<Flow> => {
    const res = await axios.get(`${ROUTER_BASE_URL}/flows/${flowId}`);
    return res.data;
  };

  return useQuery({
    queryKey: ["flows", flowId],
    queryFn: fetchFlow,
    refetchInterval: false,
  });
}

export function useUpdateFlow(
  options?: UseMutationOptions<
    Flow,
    DefaultError,
    Optional<Flow, "id">,
    unknown
  >
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...opt } = options || {};

  return useMutation({
    mutationKey: ["useUpdateFlow"],
    mutationFn: async (flow: Optional<Flow, "id">) => {
      if (!flow.id) {
        const res = await axios.post(`${ROUTER_BASE_URL}/flows`, flow);
        return res.data;
      }

      const res = await axios.patch(
        `${ROUTER_BASE_URL}/flows/${flow.id}`,
        flow
      );
      return res.data;
    },
    onSuccess: (data, flow, ctx) => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });

      if (flow.id) {
        queryClient.invalidateQueries({
          queryKey: ["flow", flow.id.toString()],
        });
      }

      if (onSuccess) {
        onSuccess(data, flow, ctx);
      }
    },
    ...opt,
  });
}

export function useCreateFlow(flow: Omit<Flow, "id">) {
  return useMutation({
    mutationKey: ["flows"],
    mutationFn: async () => {
      return await axios.post(`${ROUTER_BASE_URL}/flows`, flow);
    },
  });
}

export function useDeleteFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["deleteFlow"],
    mutationFn: async (flowId: string) => {
      await axios.delete(`${ROUTER_BASE_URL}/flows/${flowId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
    },
  });
}
