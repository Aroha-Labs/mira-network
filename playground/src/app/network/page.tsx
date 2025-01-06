"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import PageLoading from "src/components/PageLoading";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";
import CopyToClipboardIcon from "src/components/CopyToClipboardIcon";

interface Machine {
  machine_uid: string;
  network_ip: string;
  status: "online" | "offline";
}

const NetworkPage = () => {
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

  if (isLoading) return <PageLoading />;
  if (error) {
    return (
      <div className="flex items-center justify-center flex-1 bg-gray-100">
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">Failed to load machines.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center flex-1 bg-gray-100">
      <div className="w-full max-w-lg m-4 p-4 bg-white shadow rounded">
        <h2 className="text-xl font-semibold mb-4">Network Machines</h2>
        {machines?.map((m) => (
          <div
            key={m.machine_uid}
            className="border rounded p-4 mb-4 flex items-center justify-between"
          >
            <div>
              <div className="flex items-center">
                <p className="font-bold mr-2">{m.machine_uid}</p>
                <CopyToClipboardIcon text={m.machine_uid} />
              </div>
              <p>{m.status}</p>
            </div>
            <div
              className={`w-2 h-2 rounded-full ml-2 ${
                m.status === "online"
                  ? "bg-green-500 animate-pulse"
                  : "bg-gray-400"
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default NetworkPage;
