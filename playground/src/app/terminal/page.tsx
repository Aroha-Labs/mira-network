"use client";

import { useState } from "react";
import { useSession } from "src/hooks/useSession";
import TryFlowModal from "src/components/TryFlowModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "src/lib/axios";
import { CodeBlock, dracula } from "react-code-blocks";
import { Flow } from "src/utils/chat";

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

const getApiExample = (flow: Flow) => {
  const variablesSection =
    flow.variables.length > 0
      ? `"variables": {
      ${flow.variables.map((v) => `"${v}": "value"`).join(",\n      ")}
    },`
      : "";

  return `curl -X POST https://apis.mira.network/v1/flow/${flow.id}/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "your message"
      }
    ],
    "model": "gpt-4",
    ${variablesSection}
    "tools": [],
    "stream": false
  }'`;
};

export default function TerminalPage() {
  const { data: userSession, isLoading: isUserLoading } = useSession();
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [showTryFlow, setShowTryFlow] = useState(false);
  const [selectedApiTab, setSelectedApiTab] = useState(0);
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
          Error: {error instanceof Error ? error.message : "Failed to fetch flows"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-8 mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">API Playground</h1>
            <p className="mt-2 text-gray-600">
              Test and integrate your AI flows with our API
            </p>
          </div>
          <button
            onClick={() => setShowTryFlow(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg
              className="w-5 h-5 mr-2 -ml-1"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create New Flow
          </button>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Left Column - Flows List */}
          <div className="col-span-4">
            <div className="sticky top-8">
              <h2 className="mb-4 text-lg font-medium text-gray-900">Your Flows</h2>
              <div className="space-y-3">
                {flows?.map((flow) => (
                  <div
                    key={flow.id}
                    className={`p-4 bg-white border rounded-lg shadow-sm cursor-pointer transition-all ${
                      selectedFlow?.id === flow.id
                        ? "border-indigo-500 ring-1 ring-indigo-500"
                        : "border-gray-200 hover:border-indigo-500"
                    }`}
                    onClick={() => setSelectedFlow(flow)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{flow.name}</h3>
                        <p className="mt-1 text-xs text-gray-500">Flow ID: {flow.id}</p>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                        Active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Flow Details & API Docs */}
          <div className="col-span-8">
            {selectedFlow ? (
              <div className="space-y-6">
                {/* Flow Details Section */}
                <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {selectedFlow.name}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Last updated{" "}
                        {new Date(selectedFlow.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex space-x-3">
                      <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                        Edit
                      </button>
                      <a
                        href={`/playground?flowId=${selectedFlow.id}`}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                      >
                        <svg
                          className="w-4 h-4 mr-2"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Try in Playground
                      </a>
                    </div>
                  </div>

                  <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                    <h3 className="mb-2 text-sm font-medium text-gray-900">
                      System Prompt
                    </h3>
                    <p className="font-mono text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedFlow.system_prompt}
                    </p>
                  </div>

                  {selectedFlow.variables.length > 0 && (
                    <div className="mt-4">
                      <h3 className="mb-3 text-sm font-medium text-gray-900">
                        Required Variables
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedFlow.variables.map((variable) => (
                          <div
                            key={variable}
                            className="flex items-center p-3 border border-gray-200 rounded-md bg-gray-50"
                          >
                            <code className="text-sm text-indigo-600">{variable}</code>
                            <span className="ml-2 text-xs text-gray-500">string</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* API Documentation Section */}
                <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <h2 className="mb-6 text-lg font-medium text-gray-900">
                    API Documentation
                  </h2>

                  <div className="mb-6">
                    <div className="flex p-1 space-x-1 bg-gray-100 rounded-lg">
                      {["REST API", "Node.js (Coming Soon)", "Python (Coming Soon)"].map(
                        (tab, index) => (
                          <button
                            key={tab}
                            onClick={() => setSelectedApiTab(index)}
                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md ${
                              selectedApiTab === index
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-900"
                            }`}
                          >
                            {tab}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {selectedApiTab === 0 && (
                      <>
                        <div>
                          <h3 className="mb-3 text-sm font-medium text-gray-900">
                            Request
                          </h3>
                          <div className="overflow-hidden bg-[#282A36] rounded-lg">
                            <div className="flex items-center justify-between px-4 py-2 bg-[#1F2937] border-b border-gray-800">
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              </div>
                              <button
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    getApiExample(selectedFlow)
                                  )
                                }
                                className="px-2 py-1 text-xs text-gray-400 transition-colors hover:text-white"
                              >
                                Copy
                              </button>
                            </div>
                            <div className="p-4 overflow-x-auto font-mono">
                              <CodeBlock
                                text={getApiExample(selectedFlow)}
                                language="bash"
                                theme={dracula}
                                showLineNumbers={false}
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="mb-3 text-sm font-medium text-gray-900">
                            Response
                          </h3>
                          <div className="overflow-hidden bg-[#282A36] rounded-lg">
                            <div className="p-4 overflow-x-auto font-mono">
                              <CodeBlock
                                text={`{
  "id": "chat_xyz123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I assist you today?"
    }
  }]
}`}
                                language="json"
                                theme={dracula}
                                showLineNumbers={false}
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {selectedApiTab === 1 && (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="p-4 rounded-full bg-indigo-50">
                          <svg
                            className="w-8 h-8 text-indigo-600"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                          </svg>
                        </div>
                        <h3 className="mt-4 text-lg font-medium text-gray-900">
                          Node.js SDK Coming Soon
                        </h3>
                        <p className="max-w-sm mt-2 text-sm text-center text-gray-500">
                          We&apos;re working hard to bring you a powerful Node.js SDK.
                          Stay tuned for updates!
                        </p>
                      </div>
                    )}

                    {selectedApiTab === 2 && (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="p-4 rounded-full bg-indigo-50">
                          <svg
                            className="w-8 h-8 text-indigo-600"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                          </svg>
                        </div>
                        <h3 className="mt-4 text-lg font-medium text-gray-900">
                          Python SDK Coming Soon
                        </h3>
                        <p className="max-w-sm mt-2 text-sm text-center text-gray-500">
                          Our Python SDK is under development. Check back soon for a
                          seamless Python integration experience!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[400px] bg-white border border-gray-200 rounded-lg">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900">Select a Flow</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Choose a flow from the list to view its details and API documentation
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showTryFlow && (
        <TryFlowModal onClose={() => setShowTryFlow(false)} onSave={handleCreateFlow} />
      )}
    </div>
  );
}
