import { DefaultError, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ROUTER_BASE_URL } from "../config/llm";

interface Machine {
  machine_uid: string;
  network_ip: string;
  status: "online" | "offline";
}

type UseQueryOptionType = Omit<
  Parameters<typeof useQuery<Machine[], DefaultError>>[0],
  "queryKey"
>;

export const useGetMachines = (options: UseQueryOptionType = {}) => {
  return useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const res = await axios.get<Machine[]>(`${ROUTER_BASE_URL}/machines`);
      return res.data;
    },
    ...options,
  });
};
