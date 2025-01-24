"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import FlowChat from "src/components/FlowChat";
import Loading from "src/components/PageLoading";
import api from "src/lib/axios";
import { Flow } from "src/utils/chat";
import { useEffect } from "react";

const fetchFlow = async (flowId: string) => {
  try {
    const { data } = await api.get(`/flows/${flowId}`);
    return data;
  } catch (error) {
    console.error("Error fetching flow:", error);
    return null;
  }
};

export default function Playground() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flowId = searchParams.get("flowId");

  useEffect(() => {
    if (!flowId) {
      router.push("/terminal");
    }
  }, [flowId, router]);

  const {
    data: flow,
    isLoading,
    error,
  } = useQuery<Flow>({
    queryKey: ["flow", flowId],
    queryFn: () => fetchFlow(flowId!),
    enabled: !!flowId,
    retry: 1,
  });

  if (isLoading) {
    return <Loading fullPage />;
  }

  if (error || !flow) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Flow Not Found</h3>
          <p className="mt-1 text-sm text-gray-500">
            The flow you&apos;re looking for doesn&apos;t exist or you don&apos;t have
            access to it.
          </p>
          <button
            onClick={() => router.push("/terminal")}
            className="px-4 py-2 mt-4 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            Back to Terminal
          </button>
        </div>
      </div>
    );
  }

  return <FlowChat flow={flow} onClose={() => router.push("/terminal")} />;
}
