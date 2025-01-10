import { API_BASE_URL } from "src/config";

import axios from "axios";

import { useSession } from "./useSession";

import { useQuery } from "@tanstack/react-query";

interface Machine {
  machine_uid: string;
  network_ip: string;
  status: "online" | "offline";
}
const useMachine = () => {
  const { data: userSession } = useSession();
  const {
    data: machines,
    isLoading,
    error,
  } = useQuery<Machine[]>({
    queryKey: ["machines"],
    queryFn: async () => {
      if (!userSession?.access_token) throw new Error("User session not found");
      const resp = await axios.get(`${API_BASE_URL}/machines`, {
        headers: { Authorization: `Bearer ${userSession.access_token}` },
      });
      return resp.data;
    },
    enabled: !!userSession?.access_token,
  });

  const onlineMachinesCount =
    machines?.filter((machine) => machine.status === "online").length ?? 0;

  return { machines, isLoading, onlineMachinesCount, error };
};

export default useMachine;
