"use client";

import { useState } from "react";
import { useSession } from "src/hooks/useSession";
import FlowChat from "src/components/FlowChat";
import TryFlowModal from "src/components/TryFlowModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "src/lib/axios";

interface Flow {
  id: number;
  name: string;
  system_prompt: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}

const fetchFlows = async () => {
  const { data } = await api.get("/flows");
  return data;
};

const createFlow = async (flow: {
  name: string;
  system_prompt: string;
  variables: string[];
}) => {
  return api.post("/flows", {
    name: flow.name,
    system_prompt: flow.system_prompt,
  });
};

export default function TerminalPage() {
  const { data: userSession, isLoading: isUserLoading } = useSession();
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [showTryFlow, setShowTryFlow] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: flows,
    isLoading,
    error,
  } = useQuery<Flow[]>({
    queryKey: ["flows"],
    queryFn: fetchFlows,
    enabled: !!userSession?.user,
  });

  const createFlowMutation = useMutation({
    mutationFn: createFlow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      setShowTryFlow(false);
    },
  });

  const handleCreateFlow = async (flow: {
    name: string;
    system_prompt: string;
    variables: string[];
  }) => {
    createFlowMutation.mutate(flow);
  };

  if (isUserLoading) {
    return <div>Loading...</div>;
  }

  if (!userSession?.user) {
    return <div>You must be logged in to use this feature</div>;
  }

  if (isLoading) {
    return (
      <div className="container px-4 py-8 mx-auto">
        <div className="text-center text-gray-600">Loading flows...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container px-4 py-8 mx-auto">
        <div className="text-center text-red-600">
          Error:{" "}
          {error instanceof Error ? error.message : "Failed to fetch flows"}
        </div>
      </div>
    );
  }

  return (
    <div className="container px-4 py-8 mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Flows</h1>
        <button
          onClick={() => setShowTryFlow(true)}
          className="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600"
        >
          Create New Flow
        </button>
      </div>

      <div className="grid gap-4">
        {flows?.map((flow) => (
          <div
            key={flow.id}
            className="p-6 transition-colors bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-500"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {flow.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Last updated: {new Date(flow.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="text-blue-500 hover:text-blue-600">
                  Edit
                </button>
                <button className="text-red-500 hover:text-red-600">
                  Delete
                </button>
              </div>
            </div>

            <div className="p-4 rounded-md bg-gray-50">
              <p className="font-mono text-sm text-gray-700">
                {flow.system_prompt}
              </p>
            </div>

            {flow.variables.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm text-gray-600">Variables:</p>
                <div className="flex gap-2">
                  {flow.variables.map((variable) => (
                    <span
                      key={variable}
                      className="px-2 py-1 text-sm text-gray-700 bg-gray-100 rounded-md"
                    >
                      {variable}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setSelectedFlow(flow)}
                className="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600"
              >
                Use Flow
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedFlow && (
        <FlowChat flow={selectedFlow} onClose={() => setSelectedFlow(null)} />
      )}

      {showTryFlow && (
        <TryFlowModal
          onClose={() => setShowTryFlow(false)}
          onSave={handleCreateFlow}
        />
      )}
    </div>
  );
}
