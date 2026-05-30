import api from "src/lib/axios";

import { useSession } from "./useSession";

import { useQuery } from "@tanstack/react-query";

interface Machine {
  machine_uid: string;
  network_ip: string;
  status: "online" | "offline";
}
const useMachine = () => {
  const { user } = useSession();
  const {
    data: machines,
    isLoading,
    error,
  } = useQuery<Machine[]>({
    queryKey: ["machines", user?.id],
    queryFn: async () => {
      // NOTE: /machines is not yet implemented on the router-cf backend.
      const resp = await api.get(`/machines`);
      return resp.data;
    },
    enabled: !!user,
  });

  const onlineMachinesCount =
    machines?.filter((machine) => machine.status === "online").length ?? 0;

  return { machines, isLoading, onlineMachinesCount, error };
};

export default useMachine;
