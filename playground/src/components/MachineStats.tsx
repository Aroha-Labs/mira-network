"use client";

import { useQuery } from "@tanstack/react-query";
import api from "src/lib/axios";
import { ComputerDesktopIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

interface Machine {
  id: number;
  network_ip: string;
  status: "online" | "offline";
  name?: string;
  description?: string;
  created_at: string;
  disabled: boolean;
  traffic_weight?: number;
  supported_models?: string[];
}

const fetchMachines = async () => {
  const response = await api.get<Machine[]>("/machines", {
    params: { include_disabled: false },
  });
  return response.data;
};

export default function MachineStats() {
  const {
    data: machines,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["machines-stats"],
    queryFn: fetchMachines,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const onlineMachines =
    machines?.filter((m) => m.status === "online" && !m.disabled) || [];
  const offlineMachines =
    machines?.filter((m) => m.status === "offline" && !m.disabled) || [];
  const totalWeight = onlineMachines.reduce(
    (sum, m) => sum + (m.traffic_weight || 0.5),
    0
  );

  if (isLoading) {
    return (
      <div className="p-4 w-full max-w-md bg-white rounded-sm shadow-sm">
        <div className="animate-pulse">
          <div className="mb-3 w-1/3 h-4 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-sm border border-gray-200 shadow-sm">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
          <div className="flex gap-2 items-center">
            <ComputerDesktopIcon className="w-5 h-5 text-gray-600" />
            <h3 className="text-sm font-medium text-gray-900">Machine Network Status</h3>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1 text-gray-400 rounded transition-colors hover:text-gray-600 hover:bg-gray-50"
            title="Refresh"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {machines?.length || 0}
              </div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {onlineMachines.length}
              </div>
              <div className="text-xs text-gray-500">Online</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {offlineMachines.length}
              </div>
              <div className="text-xs text-gray-500">Offline</div>
            </div>
          </div>

          {/* Machine List */}
          {machines && machines.length > 0 ? (
            <div className="overflow-y-auto space-y-2 max-h-48">
              {machines.map((machine) => (
                <div
                  key={machine.id}
                  className="flex justify-between items-center p-2 bg-gray-50 rounded-md transition-colors hover:bg-gray-100"
                >
                  <div className="flex gap-2 items-center min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        machine.status === "online" ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {machine.name || "Unnamed Machine"}
                      </div>
                      <div className="font-mono text-xs text-gray-500">
                        {machine.network_ip}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-2 items-center">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {Math.round((machine.traffic_weight || 0.5) * 100)}%
                    </span>
                    {machine.supported_models && machine.supported_models.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {machine.supported_models.length} models
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-gray-500">No machines registered</p>
            </div>
          )}

          {/* Load Distribution */}
          {onlineMachines.length > 0 && (
            <div className="pt-4 mt-4 border-t border-gray-100">
              <div className="mb-2 text-xs font-medium text-gray-700">
                Load Distribution
              </div>
              <div className="space-y-1">
                {onlineMachines.map((machine) => {
                  const percentage =
                    totalWeight > 0
                      ? ((machine.traffic_weight || 0.5) / totalWeight) * 100
                      : 0;
                  return (
                    <div key={machine.id} className="flex gap-2 items-center">
                      <div className="w-24 text-xs text-gray-600 truncate">
                        {machine.name || machine.network_ip}
                      </div>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full">
                        <div
                          className="h-2 bg-blue-500 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-10 text-xs text-right text-gray-500">
                        {percentage.toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
