"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import PageLoading from "src/components/PageLoading";
import { API_BASE_URL } from "src/config";
import { useSession } from "src/hooks/useSession";
import MachineList from "src/components/MachineList";

const NetworkPage = () => {
  const { data: userSession } = useSession();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const {
    data: machines,
    isLoading: isLoadingMachines,
    error: machinesError,
  } = useQuery({
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

  if (isLoadingMachines) return <PageLoading />;
  if (machinesError) {
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
    <div className="flex flex-col flex-1 bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            Network Overview
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and monitor your connected machines
          </p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <MachineList machines={machines} />
      </div>
    </div>
  );
};

export default NetworkPage;
